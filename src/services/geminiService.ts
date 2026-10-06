import {
  ChatMessage,
  GrammarAnalysisResult,
  VocabularyWord,
  TranslationResult,
  ConversationFeedbackResult,
  GeneratedChallenge,
  ChallengeEvaluationResult,
  ChallengeType,
  WritingAnalysisResult,
  WritingStyleMode,
} from '../types';

export const AI_UNAVAILABLE_MESSAGE =
  'AI service is currently unavailable. Please configure your Gemini API key or try again later.';

// Inflight request tracker to prevent duplicate requests
const inflightRequests = new Set<string>();

/**
 * Format status codes into clear, human-readable user messages
 */
function getReadableStatusMessage(status: number): string {
  switch (status) {
    case 429:
      return 'The AI service is experiencing high demand (rate limited). Please wait a moment and try again.';
    case 503:
      return 'The AI service is temporarily busy or undergoing maintenance. Please retry in a few seconds.';
    case 500:
    case 502:
    case 504:
      return 'The server encountered an issue processing your request. Please try again.';
    case 404:
      return 'The requested AI endpoint was not found on the server.';
    default:
      return status >= 400
        ? `Server responded with status ${status}. Please try again.`
        : 'Unexpected response from server. Please try again.';
  }
}

async function callAiEndpoint<T>(
  endpoint: string,
  body: Record<string, any>,
  requestKey?: string,
  timeoutMs = 50000
): Promise<T> {
  const key = requestKey || `${endpoint}_${JSON.stringify(body)}`;

  if (inflightRequests.has(key)) {
    throw new Error('A request is already in progress. Please wait.');
  }

  inflightRequests.add(key);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');

    // Handle non-JSON responses (e.g. HTML 503, proxy gateway pages, or SPA fallback)
    if (!isJson) {
      const rawText = await response.text();
      // Safe preview: first 120 chars, strip newlines/tabs, no sensitive data
      const safePreview = rawText.slice(0, 120).replace(/[\r\n\t]+/g, ' ').trim();
      console.warn(`[AI API Non-JSON Response] Status: ${response.status} ${response.statusText}, Endpoint: ${endpoint}, Preview: "${safePreview}"`);

      // If the response is HTML, never let response.json() run and cause "Unexpected token '<'"
      if (rawText.trim().startsWith('<') || !response.ok) {
        if (!response.ok) {
          throw new Error(getReadableStatusMessage(response.status));
        }
        throw new Error('Received unexpected HTML response from AI server. Please try again.');
      }

      // If status was 200 but returned unexpected non-JSON
      throw new Error(`Unexpected non-JSON response received from ${endpoint}. Please try again.`);
    }

    // Response is JSON
    let responseData: any;
    try {
      responseData = await response.json();
    } catch (parseError: any) {
      console.error(`[AI API JSON Parse Error] Endpoint: ${endpoint}, Status: ${response.status}`, parseError);
      throw new Error('Received invalid JSON from the server. Please try again.');
    }

    if (!response.ok || (responseData && responseData.error)) {
      const errorMsg = responseData?.error || responseData?.message || getReadableStatusMessage(response.status);
      throw new Error(errorMsg);
    }

    return responseData as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn(`[AI API Timeout] Request to ${endpoint} timed out after ${timeoutMs / 1000}s`);
      throw new Error('Request timed out while waiting for AI response. Please check your connection and try again.');
    }

    if (err.message && err.message.includes('already in progress')) {
      throw err;
    }

    // Handle client-side fetch network drops
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      console.warn(`[AI API Network Error] Endpoint: ${endpoint}:`, err.message);
      throw new Error('Unable to connect to the AI service. Please check your network connection.');
    }

    // Standardize error message for user UI
    console.error(`AI call to ${endpoint} failed:`, err.message || err);
    throw new Error(err.message || AI_UNAVAILABLE_MESSAGE);
  } finally {
    clearTimeout(timeoutId);
    inflightRequests.delete(key);
  }
}

export class GeminiService {
  /**
   * Check if Gemini API service is available on the backend
   */
  static async checkStatus(): Promise<{ available: boolean; message?: string }> {
    try {
      const res = await fetch('/api/gemini/status', {
        headers: { Accept: 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.toLowerCase().includes('application/json')) {
        return { available: false, message: AI_UNAVAILABLE_MESSAGE };
      }
      return await res.json();
    } catch {
      return { available: false, message: AI_UNAVAILABLE_MESSAGE };
    }
  }

  /**
   * Interactive AI Tutor Conversation with Language Preservation & Speaking Feedback
   */
  static async sendChatMessage(params: {
    messages: { role: 'user' | 'assistant'; content: string }[];
    scenario: string;
    difficulty: string;
    targetGoal?: string;
    accent?: string;
    detectedLanguage?: string;
    effectiveResponseLanguage?: string;
    hasExplicitOverride?: boolean;
    overrideTarget?: string;
    isVoiceInput?: boolean;
    speakingMetrics?: any;
  }): Promise<{
    reply: string;
    detectedLanguage?: string;
    effectiveResponseLanguage?: string;
    corrections?: {
      original: string;
      suggested: string;
      explanation: string;
      urduTip?: string;
    }[];
    pronunciationTips?: {
      word: string;
      phonetic: string;
      note: string;
    }[];
    speakingFeedback?: {
      fluency: number;
      grammar: number;
      vocabulary: number;
      clarity?: number;
      pronunciation?: number;
      overall: number;
      fluencyTip?: string;
      note?: string;
    };
    vocabularyOpportunities?: {
      original: string;
      suggested: string[];
      explanation?: string;
    }[];
    suggestedResponses?: string[];
    confidenceScore?: number;
    language?: string;
    correction?: string | null;
    explanation?: string | null;
    followUpQuestion?: string | null;
    learningTip?: string | null;
    detectedIntent?: string;
    recurringWeaknessIdentified?: string | null;
  }> {
    return callAiEndpoint('/api/gemini/chat', params, `chat_${Date.now()}`);
  }

  /**
   * Post-conversation complete session feedback
   */
  static async getConversationFeedback(params: {
    messages: { role: 'user' | 'assistant'; content: string }[];
    scenario: string;
    difficulty: string;
  }): Promise<ConversationFeedbackResult> {
    return callAiEndpoint(
      '/api/gemini/conversation-feedback',
      params,
      `feedback_${Date.now()}`
    );
  }

  /**
   * Real-time Grammar Checker
   */
  static async checkGrammar(params: {
    text: string;
    targetTone?: string;
    level?: string;
  }): Promise<GrammarAnalysisResult & { explanation?: string; naturalAlternative?: string }> {
    return callAiEndpoint('/api/gemini/grammar', params, `grammar_${params.text.trim()}`);
  }

  /**
   * Vocabulary Generator
   */
  static async generateVocabulary(params: {
    word?: string;
    topic: string;
    level: string;
    existingWords?: string[];
  }): Promise<VocabularyWord> {
    const data = await callAiEndpoint<any>(
      '/api/gemini/vocabulary',
      params,
      `vocab_${params.word || params.topic}_${Date.now()}`
    );

    return {
      id: `vocab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      word: data.word,
      phonetic: data.phonetic || '',
      partOfSpeech: data.partOfSpeech || 'noun',
      cefrLevel: data.cefrLevel || (params.level === 'Beginner' ? 'A2' : params.level === 'Advanced' ? 'C1' : 'B2'),
      definition: data.definition || '',
      urduMeaning: data.urduMeaning || '',
      urduExplanation: data.urduExplanation || '',
      examples: Array.isArray(data.examples) ? data.examples : [],
      synonyms: Array.isArray(data.synonyms) ? data.synonyms : [],
      antonyms: Array.isArray(data.antonyms) ? data.antonyms : [],
      collocations: Array.isArray(data.collocations) ? data.collocations : [],
      mnemonic: data.mnemonic || '',
      isMastered: false,
      quizQuestion: data.quizQuestion,
    };
  }

  /**
   * Contextual Bilingual Urdu ↔ English Translator
   */
  static async translateText(params: {
    text: string;
    mode: 'ur_to_en' | 'en_to_ur';
    formality?: string;
  }): Promise<TranslationResult> {
    return callAiEndpoint('/api/gemini/translate', params, `translate_${params.mode}_${params.text.trim()}`);
  }

  /**
   * Generate an authentic daily exercise with Gemini
   */
  static async generateDailyChallenge(params: {
    type: ChallengeType;
    level: 'Beginner' | 'Intermediate' | 'Advanced';
  }): Promise<GeneratedChallenge> {
    return callAiEndpoint(
      '/api/gemini/challenge/generate',
      params,
      `challenge_gen_${params.type}_${Date.now()}`
    );
  }

  /**
   * Evaluate student's answer using Gemini
   */
  static async evaluateChallenge(params: {
    challengeTitle: string;
    type: ChallengeType;
    prompt: string;
    userSubmission: string;
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  }): Promise<ChallengeEvaluationResult> {
    return callAiEndpoint(
      '/api/gemini/challenge/evaluate',
      params,
      `challenge_eval_${Date.now()}`
    );
  }

  /**
   * Production-quality AI Writing Coach with three versions, style alignment,
   * granular mistakes breakdown, vocabulary suggestions, and personalized practice.
   */
  static async checkWriting(params: {
    text: string;
    mode?: WritingStyleMode;
    instructionLanguage?: 'en' | 'ur' | 'roman_ur' | 'mixed' | 'auto';
    explicitInstruction?: string;
    previousMistakeTypes?: string[];
  }): Promise<WritingAnalysisResult> {
    return callAiEndpoint(
      '/api/gemini/writing',
      params,
      `writing_${params.mode || 'general'}_${Date.now()}`
    );
  }
}
