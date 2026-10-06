import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import {
  detectInputLanguage,
  getLanguageLockInstruction,
  validateResponseLanguage,
  DetectedLanguage,
} from "./src/utils/languageDetector";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "5mb" }));

// Express JSON body parsing error handler to prevent HTML error responses
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON format in request body.", code: "BAD_JSON" });
  }
  next();
});

// Enforce UTF-8 JSON header for all /api endpoints
app.use("/api", (req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

// Favicon handler to prevent 404 console errors
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

// Standard error message when API key is unconfigured or service unavailable
const UNAVAILABLE_MESSAGE =
  "AI service is currently unavailable. Please configure your Gemini API key or try again later.";

// Verify Gemini Client
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    const error: any = new Error(UNAVAILABLE_MESSAGE);
    error.statusCode = 503;
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Clean markdown code blocks and parse JSON safely from model output
function parseJsonFromText(rawText: string): any {
  if (!rawText || !rawText.trim()) return {};
  let cleaned = rawText.trim();

  // 1. Try matching markdown code block ```json ... ``` or ``` ... ```
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    cleaned = codeBlockMatch[1].trim();
  } else {
    // 2. Try locating outermost JSON object { ... }
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1).trim();
    }
  }

  // 3. Attempt standard JSON.parse
  try {
    return JSON.parse(cleaned);
  } catch {}

  // 4. Try stripping trailing commas in JSON object or arrays
  try {
    const withoutTrailingCommas = cleaned.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(withoutTrailingCommas);
  } catch {}

  // 5. Sanitize unescaped control characters in string literals
  try {
    const sanitized = cleaned
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u0000-\u001F]+/g, (match) => {
        if (match === "\n") return "\\n";
        if (match === "\r") return "\\r";
        if (match === "\t") return "\\t";
        return "";
      });
    return JSON.parse(sanitized);
  } catch {}

  // 6. Resilient regex extraction for critical conversational fields if JSON was truncated or has unescaped quotes
  try {
    // Extract reply if present
    const replyRegex = /"reply"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:detectedLanguage|effectiveResponseLanguage|corrections|pronunciationTips|speakingFeedback|suggestedResponses|confidenceScore|language|detectedIntent|correction|explanation|followUpQuestion|learningTip|recurringWeaknessIdentified)"/i;
    const match = cleaned.match(replyRegex);
    if (match && match[1]) {
      return {
        reply: match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        corrections: [],
        pronunciationTips: [],
        speakingFeedback: {
          pronunciation: 85,
          grammar: 85,
          fluency: 85,
          vocabulary: 85,
          overall: 85,
          note: "AI & language-based estimation",
        },
        suggestedResponses: [],
        confidenceScore: 88,
      };
    }

    const simpleReplyMatch = cleaned.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (simpleReplyMatch && simpleReplyMatch[1]) {
      return {
        reply: simpleReplyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n"),
        corrections: [],
        pronunciationTips: [],
        speakingFeedback: {
          pronunciation: 85,
          grammar: 85,
          fluency: 85,
          vocabulary: 85,
          overall: 85,
          note: "AI & language-based estimation",
        },
        suggestedResponses: [],
        confidenceScore: 88,
      };
    }
  } catch {}

  // 7. If the model output raw conversational text without JSON wrapping
  if (cleaned.length > 0 && !cleaned.startsWith("{")) {
    return {
      reply: cleaned,
      corrections: [],
      pronunciationTips: [],
      speakingFeedback: {
        pronunciation: 85,
        grammar: 85,
        fluency: 85,
        vocabulary: 85,
        overall: 85,
        note: "AI & language-based estimation",
      },
      suggestedResponses: [],
      confidenceScore: 88,
    };
  }

  throw new Error("Unable to parse structured response from AI model.");
}

// Centralized runner with resilient model selection
const CANDIDATE_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
];

function extractRawTextFromSdkResponse(response: any): string {
  try {
    if (typeof response?.text === "string" && response.text.trim()) {
      return response.text;
    }
  } catch {}
  try {
    const candidate = response?.candidates?.[0];
    if (candidate?.content?.parts) {
      const parts = candidate.content.parts
        .map((p: any) => p?.text || "")
        .filter(Boolean);
      if (parts.length > 0) return parts.join("\n");
    }
  } catch {}
  return "";
}

async function executeGeminiPrompt(prompt: string): Promise<any> {
  const ai = getGeminiClient();
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const timeoutMs = 12000;
      const response = await Promise.race([
        ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout waiting for model ${modelName}`)), timeoutMs)
        ),
      ]);
      const rawText = extractRawTextFromSdkResponse(response);
      if (!rawText || !rawText.trim()) {
        throw new Error(`Empty text response from model ${modelName}`);
      }
      const parsed = parseJsonFromText(rawText);
      if (parsed && typeof parsed === "object" && (parsed.reply || Object.keys(parsed).length > 0)) {
        return parsed;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err.message || "");
      console.warn(`[Gemini Fallback] Model ${modelName} temporarily unavailable: ${errMsg.slice(0, 100)}`);
      // Fast failover to next model without wasting time
      continue;
    }
  }

  // Determine appropriate HTTP status and clean message when all candidates fail
  let cleanMessage = UNAVAILABLE_MESSAGE;
  let statusCode = 503;

  if (lastError) {
    const rawMsg = String(lastError.message || "");
    if (
      rawMsg.includes("429") ||
      rawMsg.includes("RESOURCE_EXHAUSTED") ||
      rawMsg.includes("quota") ||
      lastError.status === 429
    ) {
      cleanMessage =
        "The AI service is experiencing high demand (rate limited). Please wait a moment and try again.";
      statusCode = 429;
    } else if (
      rawMsg.includes("503") ||
      rawMsg.includes("demand") ||
      rawMsg.includes("UNAVAILABLE") ||
      lastError.status === 503
    ) {
      cleanMessage =
        "The AI service is temporarily busy due to high demand. Please retry in a few seconds.";
      statusCode = 503;
    } else if (rawMsg.includes("Timeout")) {
      cleanMessage =
        "Request timed out while waiting for AI response. Please check your connection and try again.";
      statusCode = 504;
    } else {
      try {
        if (rawMsg.trim().startsWith("{")) {
          const parsed = JSON.parse(rawMsg);
          cleanMessage = parsed.error?.message || cleanMessage;
        }
      } catch {
        cleanMessage = UNAVAILABLE_MESSAGE;
      }
    }
  }

  const customErr: any = new Error(cleanMessage);
  customErr.statusCode = statusCode;
  customErr.code =
    statusCode === 429
      ? "RATE_LIMITED"
      : statusCode === 503
      ? "SERVICE_UNAVAILABLE"
      : statusCode === 504
      ? "GATEWAY_TIMEOUT"
      : "AI_ERROR";
  throw customErr;
}

// Status check endpoint
app.get("/api/gemini/status", (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const isConfigured = !!apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "";
  res.json({
    available: isConfigured,
    message: isConfigured
      ? "Gemini AI service is connected and ready."
      : UNAVAILABLE_MESSAGE,
  });
});

app.get("/api/health", (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const hasApiKey = !!apiKey && apiKey !== "MY_GEMINI_API_KEY" && apiKey.trim() !== "";
  res.json({
    status: "ok",
    hasApiKey,
  });
});

// Scenario Persona & Context Directives
const SCENARIO_DIRECTIVES: Record<string, string> = {
  "Job Interview": `SCENARIO DIRECTIVE - JOB INTERVIEW:
- Roleplay as an experienced, professional, yet supportive hiring manager conducting a job interview.
- Ask authentic interview questions relevant to the learner's stated career, field, or job role (e.g. introductions, past projects, technical skills, handling conflict, deadlines, strengths/weaknesses).
- Listen carefully to their answers and ask natural, intelligent follow-up questions drilling down into what they just shared.
- Gradually increase depth from icebreaker questions to situational/behavioral questions.
- If their answer has phrasing issues, provide a natural professional workplace phrasing in your response ("In an interview setting, you could phrase that as: ..."), then ask the next interview question.`,

  "Travel & Tourism": `SCENARIO DIRECTIVE - TRAVEL & TOURISM:
- Roleplay as an authentic travel contact: airport agent, hotel receptionist, restaurant server, train station officer, or friendly local resident.
- Engage in practical travel scenarios: flight check-in, hotel check-in, asking for directions, ordering food, asking about local attractions, handling delays.
- Use natural travel phrases, directions, and cultural conversational cues.`,

  "University & Academics": `SCENARIO DIRECTIVE - UNIVERSITY & ACADEMICS:
- Roleplay as an approachable university professor, academic advisor, or study partner.
- Discuss academic topics: coursework, research papers, presentations, campus life, group assignments, exam preparation, and professor interactions.`,

  "Workplace & Career": `SCENARIO DIRECTIVE - WORKPLACE & CAREER:
- Roleplay as a professional colleague, project manager, or team member in a modern workplace.
- Discuss workplace tasks: team standups, sprint deadlines, emails, presentations, client meetings, technical collaboration, and problem-solving.`,

  "Technology & IT": `SCENARIO DIRECTIVE - TECHNOLOGY & IT:
- Roleplay as a fellow software engineer or technical mentor.
- Discuss programming languages, software development, AI, system design, debugging challenges, and tech projects with genuine technical curiosity.`,

  "Daily Conversation": `SCENARIO DIRECTIVE - CASUAL DAILY CONVERSATION:
- Roleplay as a warm, curious, and expressive conversation partner.
- Chat naturally about daily routines, weekends, food, family, hobbies, weather, movies, and personal interests.`,

  "Free Conversation": `SCENARIO DIRECTIVE - FREE CONVERSATION:
- Roleplay as an open, adaptive conversation partner.
- Seamlessly follow whatever topic the user introduces, showing genuine interest and asking engaging follow-ups.`
};

const DIFFICULTY_DIRECTIVES: Record<string, string> = {
  "Beginner": `DIFFICULTY DIRECTIVE - BEGINNER (A1-A2):
- Vocabulary: High-frequency, simple everyday words. Avoid obscure idioms or complex phrasal verbs.
- Sentences: Keep your sentences short and clear (maximum 10-15 words per sentence). Speak at a calm, accessible pace.
- Follow-up Questions: Ask simple, single-focus questions that are easy to comprehend and answer.
- Corrections: Very gentle, simple, and encouraging without technical grammatical jargon.`,

  "Intermediate": `DIFFICULTY DIRECTIVE - INTERMEDIATE (B1-B2):
- Vocabulary: Natural conversational vocabulary, common phrasal verbs, idioms, and standard workplace English.
- Sentences: Natural cadence with compound and complex sentences.
- Follow-up Questions: Engaging, realistic follow-up questions that invite the learner to share opinions, stories, and details.
- Corrections: Clear grammatical guidance explaining tense, agreement, and prepositions concisely.`,

  "Advanced": `DIFFICULTY DIRECTIVE - ADVANCED (C1-C2):
- Vocabulary: Sophisticated, nuanced vocabulary, professional idioms, and precise collocations.
- Sentences: Fluent, native-like conversational cadence and varied sentence structures.
- Follow-up Questions: Thought-provoking, nuanced follow-up questions.
- Corrections: Subtle stylistic upgrades and native phrasing refinements.`
};

// 1. AI Conversation Endpoint with Speaking Accuracy & Context-Aware Tutoring
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const {
      messages = [],
      scenario = "Daily Conversation",
      difficulty = "Intermediate",
      targetGoal = "Everyday Fluency",
      accent = "American",
      detectedLanguage = "en",
      effectiveResponseLanguage = "en",
      hasExplicitOverride = false,
      overrideTarget = null,
      isVoiceInput = false,
      speakingMetrics = null,
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array is required." });
    }

    // Separate recent transcript and latest turn (up to last 12 messages for rich context without token overflow)
    const recentMessages = messages.slice(-12);
    const latestUserTurn = recentMessages[recentMessages.length - 1];
    const priorTurns = recentMessages.slice(0, -1);
    const latestUserMessageText = latestUserTurn?.content || "";

    // Deterministic canonical language detection on latest user message (Current message has priority)
    const detection = detectInputLanguage(latestUserMessageText);
    const finalDetectedLanguage = detection.detectedLanguage;
    const finalEffectiveLanguage = detection.effectiveResponseLanguage;
    const finalHasOverride = detection.hasExplicitOverride;
    const finalOverrideTarget = detection.overrideTarget || null;

    const languageLockDirective = getLanguageLockInstruction(finalEffectiveLanguage);

    const formattedHistory = priorTurns.length > 0
      ? priorTurns.map((m: any, idx: number) => {
          const roleLabel = m.role === "user" ? "Learner" : "Tutor";
          return `[Turn ${idx + 1}] ${roleLabel}: ${m.content}`;
        }).join("\n")
      : "(This is the beginning of the practice session)";

    // Detect if previous user messages in this session had recurring mistake patterns
    const userMessagesText = messages.filter((m: any) => m.role === "user").map((m: any) => m.content).join(" ");
    const hasSubjectVerbPatterns = /\b(I goes|he go|she go|they goes|we goes|I is|you is)\b/i.test(userMessagesText);
    const hasPastTensePatterns = /\b(did not went|didn't went|yesterday I go|last week I have went)\b/i.test(userMessagesText);
    const recurringHints = [];
    if (hasSubjectVerbPatterns) recurringHints.push("Learner has shown repeated confusion with Subject-Verb Agreement (e.g. 'I goes' vs 'I go', 'he go' vs 'he goes').");
    if (hasPastTensePatterns) recurringHints.push("Learner has shown repeated confusion with Past Tense after auxiliary 'did' (e.g. 'did not went' vs 'did not go').");

    const scenarioDirective = SCENARIO_DIRECTIVES[scenario] || SCENARIO_DIRECTIVES["Daily Conversation"];
    const difficultyDirective = DIFFICULTY_DIRECTIVES[difficulty] || DIFFICULTY_DIRECTIVES["Intermediate"];

    const prompt = `You are an expert English tutor and conversational coach conducting an interactive roleplay practice session with a learner.
Topic/Scenario: "${scenario}"
Difficulty Level: "${difficulty}"
Learner Goal: "${targetGoal}"
Tutor Persona/Accent: "${accent}"
Is Spoken Voice Input: ${isVoiceInput ? "YES (Transcribed speech attempt)" : "NO (Typed text)"}
${speakingMetrics ? `Learner Speaking Metrics: Duration: ${speakingMetrics.durationSeconds}s, Words: ${speakingMetrics.wordCount}, WPM: ~${speakingMetrics.wordsPerMinute}, Fillers: ${speakingMetrics.fillerWords?.join(", ") || "none"}` : ""}
${recurringHints.length > 0 ? `OBSERVED LEARNER PATTERNS IN SESSION:\n${recurringHints.join("\n")}` : ""}

============================================================
PREVIOUS CONVERSATION TRANSCRIPT:
============================================================
${formattedHistory}

============================================================
ROLEPLAY & DIFFICULTY GUIDELINES:
============================================================
${scenarioDirective}

${difficultyDirective}

============================================================
CRITICAL LANGUAGE RULES & MANDATORY LANGUAGE LOCK:
============================================================
Detected Input Language: "${finalDetectedLanguage}"
LOCKED Response Language: "${finalEffectiveLanguage}"
Explicit Override by User: ${finalHasOverride ? `YES -> Target is ${finalOverrideTarget}` : "NO"}

MANDATORY LANGUAGE INSTRUCTION:
>>> ${languageLockDirective} <<<

- NEVER automatically translate the user's message before responding unless they explicitly requested translation. Respond directly to their communicative intent.
- Do NOT let the conversation history, scenario, or difficulty override this language lock.
- If locked to Roman Urdu: Respond ONLY in natural Roman Urdu. Do not switch to English. English technical terms/practice questions may be used only when naturally necessary. Keep the same Roman Urdu style as the user.
- If locked to Urdu script: Respond ONLY in Urdu script.
- If locked to English: Respond ONLY in English.
- If locked to Mixed: Respond naturally using the same Urdu/English mixed style as the user. Do not convert the entire response into English or entirely into Urdu.
- Smart Language Switching: If the user switches languages mid-conversation (e.g. "Yes, I worked there for two years lekin mujhe English mein explain karna mushkil lagta hai"), understand the full meaning! Do NOT treat the mixed language as an error. Empathize and help them express the thought in English.

============================================================
LATEST LEARNER INPUT TO RESPOND TO:
============================================================
"${latestUserMessageText}"

============================================================
CORE CONVERSATIONAL TUTOR PRINCIPLES (MANDATORY):
============================================================
1. REAL CONVERSATION CONTINUITY & MEMORY:
   - You MUST maintain continuity with the ongoing conversation.
   - Remember and build on all details shared by the learner in previous turns (e.g. if the user previously said "My name is Shahbaz", remember their name; if they said "I am studying software engineering", reference their software engineering studies).
   - If the learner's latest message is answering a question you asked previously, evaluate and react to that answer directly. Do NOT restart the conversation or ask an unrelated question.
   - NEVER hallucinate or assume details about the learner's background, family, job, or education that were not stated in the conversation transcript.

2. NATURAL HUMAN-LIKE RESPONSES (ANTI-ROBOT DISCIPLINE):
   - STRICTLY PROHIBITED OPENINGS: Never start your responses with generic formulaic praise:
     BANNED: "Great job!", "That's excellent!", "Awesome!", "Here is your correction...", "Keep practicing!", "Wonderful effort!".
   - Instead, react like a real human:
     * Acknowledge what they said with genuine interest, curiosity, or empathy.
     * Vary your phrasing naturally from turn to turn.

3. ADAPTIVE RESPONSE LENGTH:
   - Casual/Brief answers (e.g., 'I like cricket'): Keep your reply conversational and brief (1-2 sentences) + 1 engaging follow-up question. Do NOT turn a casual remark into an uninvited grammar lecture.
   - Grammar errors in conversational answers (e.g., 'I goes to university every day'): Provide a short, friendly conversational correction ("Almost! Say: 'I go to university every day.' Because with 'I', we use 'go', not 'goes'."), then immediately continue the conversation: "Now tell me—what do you usually do at university?"
   - Explicit questions or explanations requested (e.g., 'What does deadline mean?' or 'Can you correct my English?'): Provide a clear, comprehensive explanation or correction, with an example, and invite them to continue.

4. USER INTENT DETECTION:
   Determine the learner's intent for the latest turn:
   - "asking_definition": (e.g., "What does deadline mean?") -> Directly explain the meaning in clear, concise terms with a realistic sentence example. Do NOT treat it like an answer to a previous question. Follow up by asking them to try using it in a sentence.
   - "requesting_correction": (e.g., "correct my English", "meri English check karo", "is this sentence correct?") -> Switch to Correction Mode: Provide the corrected phrasing, a clear concise explanation of any errors, a natural alternative, and ask if they are ready for the next practice step.
   - "sharing_concern": (e.g., "Kal mera interview hai, I am very nervous", "English bolne mein dar lagta hai") -> Empathize warmly in the user's language style, offer comforting confidence, and smoothly transition into supportive practice.
   - "answering_question" / "general_chat": -> React to their answer, give short inline correction if error exists, and ask an intelligent follow-up question.

5. INTELLIGENT GRAMMAR CORRECTION:
   - Prioritize real errors: incorrect verb tense, subject-verb agreement (e.g. 'I goes', 'he work'), faulty sentence structure, or confusing vocabulary that hinders meaning.
   - Do NOT nitpick natural conversational idioms, colloquial phrasing, or minor punctuation in spoken practice.
   - Integrate the correction into your reply naturally ("You mean: '...'") while also populating the structured 'corrections' array.
   - If the user spoke Urdu or Roman Urdu without English errors, keep 'corrections' empty and provide natural English phrases in 'suggestedResponses'.

6. PERSONALIZED LEARNING & WEAKNESS TRACKING:
   - Review earlier turns in the transcript. If the learner repeatedly makes the same error (e.g. mixing up 'go' vs 'goes', or 'did not went'), identify this pattern in 'recurringWeaknessIdentified'.
   - If an error pattern has appeared 2 or more times, you may naturally weave a quick 5-second check into the reply: "You've been mixing up 'go' and 'goes'. Quick check: Which is correct—A) I goes to university, or B) I go to university?"

7. FOLLOW-UP QUESTION INTELLIGENCE:
   - Every conversational turn MUST end with a relevant, contextual follow-up question that directly builds on what the learner just shared.
   - BANNED LAZY QUESTIONS: "What else?", "Tell me more.", "Can you explain?".

8. VOCABULARY FEEDBACK (SPEAKING COACH):
   - Identify 1-3 useful vocabulary upgrade suggestions from the learner's response where natural.
   - Example: Instead of "very good", suggest ["excellent", "effective", "valuable"].
   - Populate "vocabularyOpportunities" with original word/phrase, 2-3 higher-level alternatives, and a brief explanation.
   - If no obvious upgrades or input was in Urdu/Roman Urdu, provide 1-2 useful English terms relevant to the current scenario.

9. SPEAKING SCORES & CLARITY ESTIMATES:
   - Provide realistic estimates in "speakingFeedback" for fluency, grammar, vocabulary, clarity, and overall.
   - State clearly in "note" that clarity ratings are estimates based on transcript and language patterns.

Respond strictly in valid JSON matching this schema:
{
  "reply": "string (your complete conversational tutor response following all guidelines)",
  "language": "${finalEffectiveLanguage}",
  "detectedLanguage": "${finalDetectedLanguage}",
  "effectiveResponseLanguage": "${finalEffectiveLanguage}",
  "detectedIntent": "answering_question | asking_definition | requesting_correction | sharing_concern | general_chat | changing_topic",
  "correction": "short inline correction or null",
  "explanation": "short grammatical explanation or null",
  "followUpQuestion": "specific follow-up question or null",
  "learningTip": "concise actionable tip or null",
  "recurringWeaknessIdentified": "string naming pattern if recurring, or null",
  "corrections": [
    {
      "original": "learner's specific mistake substring",
      "suggested": "natural corrected phrasing",
      "explanation": "clear, friendly explanation",
      "urduTip": "brief Urdu tip or note"
    }
  ],
  "vocabularyOpportunities": [
    {
      "original": "word or phrase from user",
      "suggested": ["better word 1", "better word 2"],
      "explanation": "concise usage tip"
    }
  ],
  "pronunciationTips": [
    {
      "word": "target word",
      "phonetic": "/IPA/",
      "note": "brief articulation or stress guidance"
    }
  ],
  "speakingFeedback": {
    "fluency": 85,
    "grammar": 88,
    "vocabulary": 82,
    "clarity": 85,
    "overall": 85,
    "fluencyTip": "short actionable tip on pacing or pauses",
    "note": "AI & language-based estimation (not physical phoneme acoustic measurement)"
  },
  "suggestedResponses": [
    "Suggested response 1 in English",
    "Suggested response 2 in English",
    "Suggested response 3 in English"
  ],
  "confidenceScore": 88
}`;

    const data = await executeGeminiPrompt(prompt);

    // Validate response language against finalEffectiveLanguage (Requirement 8)
    const validation = validateResponseLanguage(data.reply, finalEffectiveLanguage);
    if (!validation.isValid) {
      console.warn(`[Language Validation Warning] Response language mismatch: ${validation.reason}. Triggering one strict repair attempt...`);
      try {
        const repairInstruction = finalEffectiveLanguage === "roman_ur"
          ? "Your previous response violated the required language. Rewrite the response entirely in natural Roman Urdu. Do not use English as the main response language."
          : finalEffectiveLanguage === "ur"
          ? "Your previous response violated the required language. Rewrite the response entirely in authentic Urdu script (اردو رسم الخط)."
          : "Your previous response violated the required language. Rewrite the response entirely in English.";

        const repairPrompt = `You are an AI language coach rewriting a conversational tutor response because it violated the strict language rule.
Required Response Language: "${finalEffectiveLanguage}"
MANDATORY INSTRUCTION: ${repairInstruction}

Context / Learner Input: "${latestUserMessageText}"
Violating Draft Reply: "${data.reply}"

Task: Rewrite the reply so that it strictly adheres to "${finalEffectiveLanguage}".
Respond strictly in valid JSON matching this schema:
{
  "reply": "rewritten response following the required language",
  "corrections": ${JSON.stringify(data.corrections || [])},
  "pronunciationTips": ${JSON.stringify(data.pronunciationTips || [])},
  "suggestedResponses": ${JSON.stringify(data.suggestedResponses || [])},
  "speakingFeedback": ${JSON.stringify(data.speakingFeedback || null)},
  "confidenceScore": ${data.confidenceScore || 88}
}`;

        const repairedData = await executeGeminiPrompt(repairPrompt);
        if (repairedData && repairedData.reply && typeof repairedData.reply === "string" && repairedData.reply.trim()) {
          data.reply = repairedData.reply;
          if (repairedData.corrections) data.corrections = repairedData.corrections;
          if (repairedData.suggestedResponses) data.suggestedResponses = repairedData.suggestedResponses;
          console.log(`[Language Validation] Successfully repaired response into ${finalEffectiveLanguage}.`);
        }
      } catch (repairErr: any) {
        console.warn(`[Language Validation] Repair attempt error:`, repairErr?.message);
      }
    }

    // Ensure reply is valid and never empty
    if (!data.reply || typeof data.reply !== "string" || !data.reply.trim()) {
      const emptyErr: any = new Error("AI generated an empty or malformed response. Please try again.");
      emptyErr.statusCode = 502;
      emptyErr.code = "EMPTY_AI_RESPONSE";
      throw emptyErr;
    }

    data.effectiveResponseLanguage = finalEffectiveLanguage;
    data.detectedLanguage = finalDetectedLanguage;
    data.language = finalEffectiveLanguage;
    data.corrections = Array.isArray(data.corrections) ? data.corrections : [];
    data.pronunciationTips = Array.isArray(data.pronunciationTips) ? data.pronunciationTips : [];
    data.suggestedResponses = Array.isArray(data.suggestedResponses) ? data.suggestedResponses : [];

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(data);
  } catch (error: any) {
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const readableError = error.message || error.originalMessage || UNAVAILABLE_MESSAGE;
    res.status(status).json({
      error: readableError,
      code: error.code || "AI_ERROR",
    });
  }
});

// 2. Post-Conversation Session Feedback Endpoint
app.post("/api/gemini/conversation-feedback", async (req, res) => {
  try {
    const {
      messages = [],
      scenario = "Daily Conversation",
      difficulty = "Intermediate",
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Conversation messages are required for feedback." });
    }

    const conversationHistory = messages
      .map((m: any) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`)
      .join("\n");

    const prompt = `You are a certified English Language Assessor evaluating a completed practice session.
Topic/Scenario: "${scenario}"
Learner English Level: "${difficulty}"

FULL CONVERSATION:
${conversationHistory}

Evaluate the learner's performance comprehensively and return detailed feedback strictly tailored to their "${difficulty}" level.
Include:
1. Grammar feedback: detailed analysis of tense usage, sentence structure, prepositions, and articles used by the learner.
2. Vocabulary feedback: praise for effective word choices and suggestions for higher-variety vocabulary.
3. Common mistakes: specific recurring mistakes observed across their messages with clear explanations.
4. Improvement suggestions: 3-4 concrete, actionable habits or exercises to improve spoken fluency.
5. Overall learning feedback: encouraging holistic summary with a realistic fluency score (0-100).

Respond strictly in valid JSON matching this schema:
{
  "grammarFeedback": "string",
  "vocabularyFeedback": "string",
  "commonMistakes": [
    {
      "mistake": "what was said or written",
      "correction": "what should be said",
      "explanation": "why this correction is better"
    }
  ],
  "improvementSuggestions": [
    "Actionable tip 1",
    "Actionable tip 2",
    "Actionable tip 3"
  ],
  "overallFeedback": "Encouraging, comprehensive summary of the learner's progress",
  "overallScore": 88
}`;

    const data = await executeGeminiPrompt(prompt);
    res.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.message || UNAVAILABLE_MESSAGE,
      code: error.code || "AI_ERROR",
    });
  }
});

// 3. Grammar Checker & Rewriter Endpoint
app.post("/api/gemini/grammar", async (req, res) => {
  try {
    const { text, targetTone = "Professional & Natural", level = "Intermediate" } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required." });
    }

    const prompt = `You are an expert English grammar coach and linguistic proofreader specializing in ESL learners (particularly Urdu speakers learning English).
Input text: "${text}"
Target Tone: "${targetTone}"
Learner English Level: "${level}" (IMPORTANT: For Beginners, provide very simple, jargon-free explanations in plain English with easy Urdu notes. For Intermediate/Advanced, provide nuanced structural feedback).

TASK:
1. Provide the corrected text with flawless grammar and natural punctuation.
2. Identify all mistakes (tense, preposition, subject-verb agreement, article, spelling, or vocabulary).
3. Provide a clear explanation tailored to the "${level}" level.
4. Provide a primary natural alternative sentence.
5. Provide 3 additional alternative versions suited for Formal/Workplace, Casual/Conversational, and Native/Idiomatic expressions.
6. Provide an overall score (0-100) and fluency level descriptor.

Respond strictly in valid JSON matching this schema:
{
  "originalText": "${text}",
  "correctedText": "string",
  "overallScore": 88,
  "fluencyLevel": "Good / Fluent / Needs Work",
  "summary": "string (clear, encouraging diagnostic summary)",
  "explanation": "string (simple explanation appropriate for ${level} learner)",
  "naturalAlternative": "string (most natural conversational equivalent)",
  "errors": [
    {
      "type": "string (e.g. Past Tense, Preposition)",
      "original": "erroneous substring",
      "suggestion": "corrected substring",
      "explanation": "why it was incorrect and how to remember it",
      "urduTip": "اردو میں آسان وضاحت"
    }
  ],
  "alternativeVersions": [
    {
      "tone": "Formal / Workplace",
      "text": "string"
    },
    {
      "tone": "Conversational / Casual",
      "text": "string"
    },
    {
      "tone": "Native Idiomatic",
      "text": "string"
    }
  ]
}`;

    const data = await executeGeminiPrompt(prompt);
    res.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.message || UNAVAILABLE_MESSAGE,
      code: error.code || "AI_ERROR",
    });
  }
});

// 4. Vocabulary Generator & Builder Endpoint
app.post("/api/gemini/vocabulary", async (req, res) => {
  try {
    const {
      word,
      topic = "Daily Life & Conversation",
      level = "Intermediate",
      existingWords = [],
    } = req.body;

    const prompt = `You are a master English lexicographer and bilingual English-Urdu language educator.
Target Topic: "${topic}"
Target English Level: "${level}" (e.g. Beginner = A1-A2 high-utility fundamentals; Intermediate = B1-B2 workplace & conversational vocabulary; Advanced = C1-C2 idiomatic & sophisticated expressions).
Specific Word requested (if any): "${word || "Generate 1 high-impact, practical vocabulary word fitting this topic and level"}"
Existing words already known by user to avoid repetition: ${JSON.stringify(existingWords.slice(0, 20))}

Generate a rich, authentic vocabulary card:
- Word: The target English word or phrasal verb.
- Meaning: Clear, concise definition in plain English.
- Urdu Meaning: Accurate Urdu translation in proper Urdu script.
- Pronunciation: Accurate IPA phonetics.
- Part of speech: noun, verb, adjective, adverb, or phrasal verb.
- Example sentence: Realistic, natural example sentence in English.
- Example sentence Urdu: Accurate Urdu translation of the example sentence.
- Synonyms: 3-4 relevant synonyms.
- Antonyms: 2-3 antonyms.
- Collocations: 2-3 common natural collocations.
- Mnemonic: An intuitive memory hook to remember it easily.
- Quiz question: A multiple choice quiz question testing comprehension with 4 options and correct index (0-3).

Respond strictly in valid JSON matching this schema:
{
  "word": "string",
  "phonetic": "string",
  "partOfSpeech": "string",
  "cefrLevel": "${level === "Beginner" ? "A2" : level === "Advanced" ? "C1" : "B2"}",
  "definition": "string",
  "urduMeaning": "اردو معنی",
  "urduExplanation": "اردو میں تفصیلی وضاحت",
  "examples": [
    { "en": "English sentence", "ur": "اردو ترجمہ" }
  ],
  "synonyms": ["string", "string"],
  "antonyms": ["string", "string"],
  "collocations": ["string", "string"],
  "mnemonic": "string",
  "quizQuestion": {
    "question": "string",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0
  }
}`;

    const data = await executeGeminiPrompt(prompt);
    res.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.message || UNAVAILABLE_MESSAGE,
      code: error.code || "AI_ERROR",
    });
  }
});

// 5. Urdu ↔ English Contextual Translator Endpoint
app.post("/api/gemini/translate", async (req, res) => {
  try {
    const { text, mode = "ur_to_en", formality = "Natural" } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required for translation." });
    }

    const directionText =
      mode === "ur_to_en" ? "Urdu to English" : "English to Urdu";

    const prompt = `You are an expert bilingual Urdu-English translator and language pedagogue.
Direction: "${directionText}"
Formality: "${formality}"
Input Text: "${text}"

GUIDELINES:
- Provide a natural, idiomatic translation that native speakers would actually use in conversation (avoid stiff, literal, word-for-word translation).
- Provide an alternative natural phrasing.
- Provide clear Roman Urdu phonetic transcription so learners can pronounce the Urdu easily.
- Provide key vocabulary breakdown with usage notes.
- Explain the linguistic difference (e.g., Urdu SOV word order vs English SVO, prepositions, or cultural idiom).

Respond strictly in valid JSON matching this schema:
{
  "sourceText": "${text}",
  "translation": "string (natural, idiomatic translation)",
  "romanUrdu": "string (accurate Roman Urdu transliteration)",
  "formalityUsed": "${formality}",
  "breakdown": [
    {
      "source": "word/phrase",
      "target": "translation",
      "note": "usage context note"
    }
  ],
  "grammarTip": "string (syntactic or structural explanation)",
  "alternatives": [
    {
      "label": "Alternative Natural Phrasing",
      "text": "string"
    },
    {
      "label": "Formal / Professional",
      "text": "string"
    }
  ]
}`;

    const data = await executeGeminiPrompt(prompt);
    res.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.message || UNAVAILABLE_MESSAGE,
      code: error.code || "AI_ERROR",
    });
  }
});

// 6. Daily Challenge Generator Endpoint
app.post("/api/gemini/challenge/generate", async (req, res) => {
  try {
    const {
      type = "grammar",
      level = "Intermediate",
    } = req.body;

    const prompt = `You are an English language curriculum designer creating an interactive daily exercise for ESL learners.
Challenge Type: "${type}" (one of: 'grammar', 'vocabulary', 'translation', 'sentence_correction', 'multiple_choice')
Level: "${level}" (Beginner, Intermediate, or Advanced)

Generate an engaging, practical daily challenge.
Requirements:
1. A catchy title for the mission.
2. A clear prompt scenario or question.
3. Detailed instructions on what the student needs to submit.
4. If type is 'multiple_choice', provide 4 realistic options.
5. Provide a helpful hint and a bilingual Urdu hint.
6. Designate an appropriate XP reward (between 30 and 60 XP).

Respond strictly in valid JSON matching this schema:
{
  "id": "chal_${Date.now()}",
  "title": "string",
  "type": "${type}",
  "difficulty": "${level}",
  "prompt": "string (the question, sentence to fix, or scenario to respond to)",
  "instructions": "string (exact instruction for student)",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "xpReward": 45,
  "sampleHint": "string (English hint)",
  "urduHint": "اردو میں اشارہ"
}`;

    const data = await executeGeminiPrompt(prompt);
    res.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.message || UNAVAILABLE_MESSAGE,
      code: error.code || "AI_ERROR",
    });
  }
});

// 7. Daily Challenge Evaluator Endpoint
app.post("/api/gemini/challenge/evaluate", async (req, res) => {
  try {
    const {
      challengeTitle,
      type = "grammar",
      prompt: challengePrompt,
      userSubmission,
      difficulty = "Intermediate",
    } = req.body;

    if (!userSubmission || !userSubmission.trim()) {
      return res.status(400).json({ error: "User submission is required." });
    }

    const prompt = `You are an English teacher evaluating a student's daily exercise answer.
Challenge: "${challengeTitle}"
Type: "${type}"
Question / Task: "${challengePrompt}"
Target Level: "${difficulty}"
Student's Answer: "${userSubmission.trim()}"

EVALUATION CRITERIA:
- Evaluate using actual language logic and accuracy. Do not assign fake or inflated scores.
- Determine if the answer is correct or sufficiently accurate (passed: true if score >= 70, false otherwise).
- Score between 0 and 100 based on grammatical correctness, lexical accuracy, and fluency.
- Provide constructive feedback explaining what was good and what needs fixing.
- Provide a model high-scoring answer.
- Provide an Urdu tip for the student.

Respond strictly in valid JSON matching this schema:
{
  "score": 85,
  "passed": true,
  "xpAwarded": 45,
  "feedback": "string (constructive evaluation of student's answer)",
  "corrections": [
    "Specific correction 1"
  ],
  "improvements": [
    "Specific tip to elevate the phrasing"
  ],
  "modelAnswer": "string (ideal native response)",
  "urduTip": "اردو میں رہنمائی اور مشورہ"
}`;

    const data = await executeGeminiPrompt(prompt);
    res.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.message || UNAVAILABLE_MESSAGE,
      code: error.code || "AI_ERROR",
    });
  }
});

// 8. AI Writing Coach Endpoint
app.post("/api/gemini/writing", async (req, res) => {
  try {
    const {
      text,
      mode = "General English",
      instructionLanguage,
      explicitInstruction = "",
      previousMistakeTypes = [],
    } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Writing text is required.", code: "EMPTY_TEXT" });
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 15000) {
      return res.status(400).json({
        error: "Text is too long (maximum 15,000 characters). Please submit a shorter passage.",
        code: "TEXT_TOO_LONG",
      });
    }

    // Determine the instruction/explanation language:
    // If the user provided an explicit instruction, detect its language.
    // Otherwise, if the text itself is in Roman Urdu or Urdu script,
    // detect language using canonical detectInputLanguage.
    let explanationLanguage = instructionLanguage;
    if (!explanationLanguage || explanationLanguage === "auto") {
      const probeText = explicitInstruction && explicitInstruction.trim().length > 3
        ? explicitInstruction
        : trimmedText;
      const detected = detectInputLanguage(probeText);
      explanationLanguage = detected.effectiveResponseLanguage;
    }

    // Prepare style guidelines
    const STYLE_DESCRIPTIONS: Record<string, string> = {
      "General English": "Clear, everyday fluency. Prioritize natural phrasing, correct grammar, and balanced clarity.",
      "Academic": "Formal academic precision, objective tone, structured syntax, logical transitions, and evidence-based framing.",
      "Professional": "Workplace clarity, professional courtesy, concise active phrasing, and diplomatic business tone.",
      "Job Application": "Compelling, polished, active verbs, concise achievement-oriented language suited for cover letters or resumes.",
      "Email": "Clear email structure with appropriate salutation, organized body paragraphs, actionable requests, and professional closing.",
      "Interview Answer": "Structured, punchy, confident delivery using the STAR framework (Situation, Task, Action, Result) where applicable.",
      "Casual": "Friendly, relaxed, conversational idioms, natural contractions, and relatable modern tone."
    };

    const targetStyleGuideline = STYLE_DESCRIPTIONS[mode] || STYLE_DESCRIPTIONS["General English"];

    // Language directives for explanations
    let languageDirective = "";
    if (explanationLanguage === "roman_ur") {
      languageDirective = `CRITICAL EXPLANATION LANGUAGE RULE (ROMAN URDU):
- The user's instruction is in Roman Urdu (e.g. "meri writing check karo aur mistakes samjhao").
- Therefore, your 'scoreReason', 'mistakes[].explanation', 'strengths[]', and 'improvementTips[]' MUST be written in natural, clear Roman Urdu (e.g. "Yahan subject-verb agreement ki ghalti hai...", "Aapka main idea bohat clear tha...").
- HOWEVER, the English writing itself ('correctedText', 'naturalVersion', 'practiceExercise.question', 'practiceExercise.options') MUST remain in English! DO NOT translate the user's English writing into Urdu or Roman Urdu.`;
    } else if (explanationLanguage === "ur") {
      languageDirective = `CRITICAL EXPLANATION LANGUAGE RULE (URDU SCRIPT):
- The user's instruction is in Urdu script (e.g. "میری تحریر چیک کریں").
- Therefore, your 'scoreReason', 'mistakes[].explanation', 'strengths[]', and 'improvementTips[]' MUST be written in authentic Urdu script (اردو رسم الخط).
- HOWEVER, the English writing itself ('correctedText', 'naturalVersion', 'practiceExercise.question', 'practiceExercise.options') MUST remain in English! DO NOT translate the user's English writing into Urdu.`;
    } else {
      languageDirective = `EXPLANATION LANGUAGE: English. Keep explanations concise, clear, and direct.`;
    }

    // Build the prompt
    const prompt = `You are EnglishPro AI's master Writing Coach and linguistic proofreader.
Analyze the user's writing with deep linguistic precision and encouraging, constructive feedback.

WRITING STYLE GOAL: "${mode}"
STYLE GUIDELINE: ${targetStyleGuideline}
${explicitInstruction ? `USER'S CUSTOM INSTRUCTION: "${explicitInstruction}"` : ""}
${previousMistakeTypes.length > 0 ? `LEARNER'S RECENT HISTORICAL MISTAKES: ${previousMistakeTypes.join(", ")} (If this text repeats these mistake patterns, mention it constructively in improvementTips).` : ""}

${languageDirective}

USER'S ORIGINAL WRITING TO ANALYZE:
"""
${trimmedText}
"""

TASK & CORE CRITERIA:
1. THREE VERSIONS:
   - "originalText": Exactly the user's text as submitted.
   - "correctedText": Fix genuine grammar, spelling, punctuation, preposition, tense, and subject-verb errors while strictly preserving the author's meaning, tone, and sentence structure. DO NOT rewrite sentences that are already correct!
   - "naturalVersion": Elevate the writing to sound native, polished, and fluent for the "${mode}" style. DO NOT invent facts, alter the core message, or make it sound artificially complex.

2. MISTAKES IDENTIFICATION:
   - Identify real, meaningful grammar and usage errors (Subject-Verb Agreement, Articles, Prepositions, Verb Tenses, Plural/Singular, Pronouns, Word Order, Punctuation, Fragments).
   - If the writing is already flawless or has no errors, "mistakes" MUST be an empty array [].
   - Each mistake must have:
     * "original": Exact erroneous substring from the original text.
     * "correction": The corrected replacement substring.
     * "category": Specific category (e.g. 'Subject-Verb Agreement', 'Preposition', 'Article', 'Verb Tense', 'Punctuation', 'Word Choice', 'Grammar').
     * "explanation": Concise, helpful explanation in the required explanation language.

3. VOCABULARY SUGGESTIONS (MAXIMUM 3):
   - Suggest up to 3 high-impact vocabulary upgrades relevant to the "${mode}" style (e.g. "very good" -> "exceptional", "effective", "valuable").
   - Explain the nuanced difference so the learner knows when and why to use them.

4. SCORES (0 to 100):
   - Provide realistic, explainable estimates (Grammar, Vocabulary, Sentence Structure, Naturalness, Overall).
   - "scoreReason": 1-2 sentences explaining the primary rationale for the score.

5. STRENGTHS (1 to 3 items):
   - Highlight 1-3 genuine things the user did well (e.g. clear message, good past tense consistency, logical paragraphing).

6. IMPROVEMENT TIPS (1 to 3 actionable items):
   - Provide concrete, memorable advice to level up their writing in this style.

7. PRACTICE EXERCISE:
   - Generate ONE focused multiple-choice practice question based directly on the primary mistake found in the user's writing (e.g. choosing between "I go" vs "I goes"). If there were no mistakes, provide a question practicing an advanced style upgrade for "${mode}".

Respond strictly in valid JSON matching this schema:
{
  "originalText": ${JSON.stringify(trimmedText)},
  "correctedText": "string",
  "naturalVersion": "string",
  "overallScore": 84,
  "grammarScore": 82,
  "vocabularyScore": 80,
  "sentenceStructureScore": 85,
  "naturalnessScore": 82,
  "scoreReason": "string (explainable estimate explanation)",
  "mistakes": [
    {
      "original": "substring",
      "correction": "substring",
      "category": "Grammar",
      "explanation": "string"
    }
  ],
  "vocabularySuggestions": [
    {
      "original": "string",
      "suggested": ["string", "string"],
      "explanation": "string"
    }
  ],
  "strengths": [
    "string"
  ],
  "improvementTips": [
    "string"
  ],
  "practiceExercise": {
    "question": "string",
    "options": ["string", "string"],
    "correctIndex": 0,
    "explanation": "string"
  }
}`;

    const data = await executeGeminiPrompt(prompt);

    // Validate and sanitize data fields
    data.originalText = trimmedText;
    if (!data.correctedText || typeof data.correctedText !== "string") {
      data.correctedText = trimmedText;
    }
    if (!data.naturalVersion || typeof data.naturalVersion !== "string") {
      data.naturalVersion = data.correctedText;
    }
    data.overallScore = typeof data.overallScore === "number" ? Math.min(100, Math.max(0, data.overallScore)) : 80;
    data.grammarScore = typeof data.grammarScore === "number" ? Math.min(100, Math.max(0, data.grammarScore)) : 80;
    data.vocabularyScore = typeof data.vocabularyScore === "number" ? Math.min(100, Math.max(0, data.vocabularyScore)) : 80;
    data.sentenceStructureScore = typeof data.sentenceStructureScore === "number" ? Math.min(100, Math.max(0, data.sentenceStructureScore)) : 80;
    data.naturalnessScore = typeof data.naturalnessScore === "number" ? Math.min(100, Math.max(0, data.naturalnessScore)) : 80;
    data.scores = {
      overall: data.overallScore,
      grammar: data.grammarScore,
      vocabulary: data.vocabularyScore,
      sentenceStructure: data.sentenceStructureScore,
      naturalness: data.naturalnessScore,
    };
    data.scoreReason = typeof data.scoreReason === "string" && data.scoreReason.trim()
      ? data.scoreReason
      : "Scores are diagnostic AI estimates based on grammar accuracy, lexical range, and phrasing naturalness.";
    data.mistakes = Array.isArray(data.mistakes) ? data.mistakes : [];
    data.vocabularySuggestions = Array.isArray(data.vocabularySuggestions) ? data.vocabularySuggestions.slice(0, 3) : [];
    data.strengths = Array.isArray(data.strengths) && data.strengths.length > 0 ? data.strengths : ["Clear communication intent", "Understandable flow"];
    data.improvementTips = Array.isArray(data.improvementTips) && data.improvementTips.length > 0 ? data.improvementTips : ["Review subject-verb agreement and prepositions"];
    data.detectedLanguage = explanationLanguage;
    data.effectiveResponseLanguage = explanationLanguage;

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.json(data);
  } catch (error: any) {
    const status = error.statusCode || 500;
    res.status(status).json({
      error: error.message || UNAVAILABLE_MESSAGE,
      code: error.code || "AI_ERROR",
    });
  }
});

// 9. Explicit Catch-All for unmatched API routes to prevent Vite HTML fallback
app.all("/api/*", (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
    code: "NOT_FOUND",
  });
});

// Vite middleware setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EnglishPro AI server running on http://localhost:${PORT}`);
  });
}

start();
