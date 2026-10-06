// Centralized Deterministic Language Detection & Language Lock Utility for EnglishPro AI

export type DetectedLanguage = 'en' | 'ur' | 'roman_ur' | 'mixed';

export interface LanguageSignals {
  romanUrduWords: number;
  englishWords: number;
  urduScriptChars: number;
  romanUrduPhrases: number;
  romanUrduScore: number;
  englishGrammarScore: number;
}

export interface LanguageDetectionResult {
  detectedLanguage: DetectedLanguage;
  confidence: number; // 0.0 - 1.0
  hasExplicitOverride: boolean;
  overrideTarget?: DetectedLanguage;
  effectiveResponseLanguage: DetectedLanguage;
  summary: string;
  signals: LanguageSignals;
  // Backward compatibility fields
  urduScriptCharCount?: number;
  latinWordCount?: number;
  romanUrduWordCount?: number;
}

// Regex matching Urdu / Arabic / Persian script characters
const URDU_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;

/**
 * High-confidence Roman Urdu vocabulary markers commonly used in conversational Pakistani Urdu.
 * Includes common spelling variants (e.g. mujhe/mujhy, ap/aap, kese/kaise, etc.)
 */
export const ROMAN_URDU_MARKERS = new Set([
  // Pronouns & Demonstratives
  'main', 'mein', 'mai', 'me', 'mujhe', 'mujhy', 'mujhko', 'mera', 'meri', 'mere',
  'hum', 'humein', 'hume', 'hamara', 'hamari', 'hamare', 'humara', 'humari', 'humare',
  'ap', 'aap', 'apka', 'aapka', 'apki', 'aapki', 'apke', 'aapke',
  'tum', 'tumhara', 'tumhari', 'tumhare', 'tumhein', 'tumhe',
  'tu', 'tera', 'teri', 'tere',
  'vo', 'woh', 'wo', 'yeh', 'ye', 'yahan', 'wahan', 'idhar', 'udhar',
  'us', 'uska', 'uske', 'uski', 'use', 'usey', 'un', 'unka', 'unke', 'unki', 'unhein', 'unhe',
  'is', 'iska', 'iske', 'iski', 'ise', 'isey', 'in', 'inka', 'inke', 'inki', 'inhein',

  // Auxiliaries & Tenses
  'hai', 'hain', 'hen', 'ho', 'hoon', 'hun',
  'tha', 'thi', 'the', 'thay',
  'hoga', 'hogi', 'honge', 'hoge', 'hona', 'hone',

  // Verbs
  'kar', 'kr', 'karo', 'karna', 'krna', 'karni', 'krni', 'karne', 'krne',
  'karta', 'karti', 'karte', 'kiya', 'kiye',
  'dena', 'do', 'dein', 'de', 'diya', 'diye', 'dya',
  'lena', 'lo', 'lein', 'le', 'liya', 'liye', 'lie', 'lye',
  'chahiye', 'chahye', 'chahta', 'chahti', 'chahte',
  'sakta', 'sakti', 'sakte', 'sakun', 'sakoon',
  'raha', 'rahi', 'rahe',
  'batao', 'btao', 'batayein', 'bataen', 'bata', 'batana',
  'samjhao', 'samjhaen', 'samjho', 'samjh', 'samajh',
  'seekhna', 'seekhni', 'seekh', 'seekho', 'seekhein',
  'bolo', 'bolna', 'bol', 'bolein',
  'likhna', 'likho', 'likh', 'likhein',
  'parhna', 'padhna', 'parho', 'parh',
  'aata', 'aati', 'aate', 'aana', 'aane', 'aaye', 'aao', 'aa', 'araha', 'arahi', 'arahe',
  'gaya', 'gayi', 'gaye', 'jao', 'jana', 'jata', 'jati', 'jate',
  'rakho', 'rakhna', 'rakh', 'soch', 'socho', 'sochna', 'dekh', 'dekho', 'dekhna', 'sun', 'suno', 'sunna',

  // Postpositions & Prepositions
  'k', 'ke', 'ki', 'ka', 'ko', 'se', 'pe', 'par', 'paer', 'tak',
  'bhi', 'to', 'toh', 'ne', 'wala', 'wali', 'wale',

  // Question words & Adverbs
  'kya', 'kyun', 'kyu', 'kyon', 'kese', 'kaise', 'kesy',
  'kab', 'kahan', 'kidhar', 'kisko', 'kis', 'konsa', 'konsi', 'konse', 'kaun', 'kon',
  'kuch', 'kch', 'koi', 'sub', 'sab', 'sirf',
  'lekin', 'magar', 'kyunke', 'kyuke', 'kyonke', 'isliye', 'islye', 'agar', 'warna',
  'phir', 'fir', 'pehle', 'pehly', 'baad', 'aaj', 'kal', 'parson', 'ab', 'abhi', 'hamesha',
  'waqt', 'zaroorat', 'zaroori', 'laazmi', 'waise', 'aise', 'aese', 'jaise', 'jese', 'jaisa', 'jaisi',
  'bohot', 'bohat', 'bahut', 'zyada', 'ziada', 'kam',
  'nahi', 'ni', 'nahin', 'na', 'mat',
  'acha', 'accha', 'achi', 'achhi', 'ache', 'achhe',
  'theek', 'thik', 'thk', 'thoda', 'thori', 'thore', 'thora',
  'tayari', 'tyari', 'shukriya', 'dost', 'bhai', 'yaar', 'baat', 'batain', 'shuru', 'khatam',
]);

// Multi-word Roman Urdu phrases that provide decisive lexical signal
const ROMAN_URDU_PHRASE_PATTERNS: RegExp[] = [
  /\b(?:k|ke|ki|ka)\s+(?:liye|lie|lye)\b/i,
  /\b(?:karna|karni|karne|krna|krni|krne)\s+(?:hai|tha|thi|the|hoga|chahiye|chahye)\b/i,
  /\b(?:samajh|samjh)\s+(?:nahi|ni|nahin)\b/i,
  /\b(?:nahi|ni|nahin)\s+(?:aa\s+raha|aa\s+rahi|aa\s+rahe|araha|arahi|arahe)\b/i,
  /\b(?:help|madad)\s+(?:karo|karein|kren|kr\s+do|kar\s+do|kar|chahiye)\b/i,
  /\b(?:practice|tayari|tyari)\s+(?:karni|karna|krni|krna)\s+(?:hai|chahiye)\b/i,
  /\b(?:questions?|sawal)\s+(?:do|dein|poocho|pucho)\b/i,
  /\b(?:kaise|kese|kesy)\s+(?:karun|karein|karna|hoga)\b/i,
  /\b(?:kya|kya\s+karna)\s+(?:hai|hoga|karein)\b/i,
  /\b(?:correct|sahi|theek)\s+(?:hai|hain|hen)\b/i,
  /\b(?:student|developer|engineer)\s+(?:hun|hoon|hai)\b/i,
  /\b(?:mein|main|me)\s+help\b/i,
  /\b(?:mera|meri)\s+kal\b|\bkal\s+(?:mera|meri)\b/i,
  /\b(?:ap|aap)\s+mujhe|\bmujhe\s+(?:ap|aap)\b/i,
  /\b(?:batao|btao|bata\s+dein)\b/i,
  /\b(?:seekhni|seekhna)\s+hai\b/i,
  /\b(?:shuru|start)\s+(?:karein|karo|karna)\b/i,
];

// Distinctive English grammatical tokens (rarely/never function as grammatical skeleton in Roman Urdu)
const ENGLISH_GRAMMAR_TOKENS = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'am', 'is', 'are', 'was', 'were',
  'have', 'has', 'had',
  'does', 'did',
  'can', 'could', 'will', 'would', 'should',
  'my', 'your', 'his', 'her', 'our', 'their',
  'the', 'a', 'an',
  'this', 'that', 'these', 'those',
  'what', 'where', 'when', 'why', 'how', 'who', 'which',
  'at', 'from', 'with', 'by', 'about',
  'and', 'but', 'because', 'very', 'some', 'any',
  'give', 'want', 'need', 'mean', 'means', 'explain',
]);

// English multi-word phrases that strongly indicate an English clause
const ENGLISH_CLAUSE_PATTERNS: RegExp[] = [
  /\b(?:give\s+me)\b/i,
  /\b(?:i\s+want\s+to|i\s+would\s+like\s+to)\b/i,
  /\b(?:my\s+name\s+is)\b/i,
  /\b(?:can\s+you|could\s+you)\b/i,
  /\b(?:what\s+does|what\s+is|what\s+are)\b/i,
  /\b(?:i\s+am\s+(?:very\s+)?(?:nervous|excited|happy|studying|working|preparing))\b/i,
  /\b(?:explain\s+(?:this|the|sentence))\b/i,
  /\b(?:for\s+(?:my|the)\s+interview)\b/i,
  /\b(?:questions?\s+for\s+practice)\b/i,
  /\b(?:ask\s+me\s+questions?\s+in\s+english)\b/i,
  /\b(?:in\s+english\s+please)\b/i,
];

// Explicit override phrase detection patterns
interface OverridePattern {
  target: DetectedLanguage;
  patterns: RegExp[];
}

const OVERRIDE_PATTERNS: OverridePattern[] = [
  {
    target: 'roman_ur',
    patterns: [
      /\b(?:in\s+roman\s+urdu|reply\s+in\s+roman\s+urdu|write\s+in\s+roman\s+urdu)\b/i,
      /(?:roman\s*urdu|رومن\s*اردو)\s*(?:mein|me|main|mai|میں)\s*(?:explain|samjhao|batao|likho|کرو|کریں|بتائیں|سمجھائیں|jawab|bolo)?/i,
    ],
  },
  {
    target: 'en',
    patterns: [
      /\b(?:in\s+english|ask(?:\s+me)?\s+(?:questions?\s+)?in\s+english|questions?\s+in\s+english|explain\s+(?:this\s+)?in\s+english|speak\s+(?:in\s+)?english|reply\s+in\s+english|write\s+in\s+english)\b/i,
      /(?:english|انگلش|انگریزی)\s*(?:mein|me|main|mai|میں)\s*(?:explain|samjhao|batao|likho|کرو|کریں|بتائیں|سمجھائیں|answer|reply|poocho|pucho)?/i,
    ],
  },
  {
    target: 'ur',
    patterns: [
      /\b(?:in\s+urdu|speak\s+(?:in\s+)?urdu|reply\s+in\s+urdu|write\s+in\s+urdu)\b/i,
      /(?<!roman\s*)(?:urdu|اردو)\s*(?:mein|me|main|mai|میں)\s*(?:explain|samjhao|batao|likho|کرو|کریں|بتائیں|سمجھائیں|jawab|bolo)?/i,
    ],
  },
];

/**
 * Check if the text contains an explicit language override request
 */
export function detectExplicitOverride(text: string): { hasOverride: boolean; target?: DetectedLanguage } {
  const normalized = text.trim();
  for (const { target, patterns } of OVERRIDE_PATTERNS) {
    for (const pat of patterns) {
      if (pat.test(normalized)) {
        return { hasOverride: true, target };
      }
    }
  }
  return { hasOverride: false };
}

/**
 * Robust Deterministic Language Detection for EnglishPro AI
 * Classifies every user message into exactly one of: 'en' | 'ur' | 'roman_ur' | 'mixed'
 */
export function detectInputLanguage(input: string): LanguageDetectionResult {
  const rawText = input || '';
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      detectedLanguage: 'en',
      confidence: 1.0,
      hasExplicitOverride: false,
      effectiveResponseLanguage: 'en',
      summary: 'Empty input defaults to English',
      signals: {
        romanUrduWords: 0,
        englishWords: 0,
        urduScriptChars: 0,
        romanUrduPhrases: 0,
        romanUrduScore: 0,
        englishGrammarScore: 0,
      },
      urduScriptCharCount: 0,
      latinWordCount: 0,
      romanUrduWordCount: 0,
    };
  }

  // Check explicit override first
  const { hasOverride, target: overrideTarget } = detectExplicitOverride(trimmed);

  // 1. Urdu Script Analysis
  const urduMatches = trimmed.match(URDU_SCRIPT_REGEX) || [];
  const urduScriptChars = urduMatches.length;

  // Extract Latin words
  const latinWords = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => /^[a-z]+$/i.test(w) && w.length > 0);

  const latinWordCount = latinWords.length;

  // 2. Pure or Dominant Urdu Script Detection
  if (urduScriptChars > 0) {
    if (latinWordCount >= 3) {
      // Significant mix of Urdu script + Latin words (e.g. "مجھے job interview کی practice کرنی ہے")
      const detected = 'mixed';
      return {
        detectedLanguage: detected,
        confidence: 0.94,
        hasExplicitOverride: hasOverride,
        overrideTarget,
        effectiveResponseLanguage: hasOverride && overrideTarget ? overrideTarget : detected,
        summary: 'Detected mixed Urdu script and English input',
        signals: {
          romanUrduWords: 0,
          englishWords: latinWordCount,
          urduScriptChars,
          romanUrduPhrases: 0,
          romanUrduScore: 5,
          englishGrammarScore: 5,
        },
        urduScriptCharCount: urduScriptChars,
        latinWordCount,
        romanUrduWordCount: 0,
      };
    } else {
      // Pure Urdu script
      const detected = 'ur';
      return {
        detectedLanguage: detected,
        confidence: 0.99,
        hasExplicitOverride: hasOverride,
        overrideTarget,
        effectiveResponseLanguage: hasOverride && overrideTarget ? overrideTarget : detected,
        summary: 'Detected authentic Urdu script input',
        signals: {
          romanUrduWords: 0,
          englishWords: latinWordCount,
          urduScriptChars,
          romanUrduPhrases: 0,
          romanUrduScore: 0,
          englishGrammarScore: 0,
        },
        urduScriptCharCount: urduScriptChars,
        latinWordCount,
        romanUrduWordCount: 0,
      };
    }
  }

  // 3. Latin Script Analysis: Roman Urdu vs English vs Mixed
  let romanUrduWords = 0;
  let englishGrammarWords = 0;
  let romanUrduScore = 0;
  let englishGrammarScore = 0;

  for (const w of latinWords) {
    const isRoman = ROMAN_URDU_MARKERS.has(w);
    const isEnglishGrammar = ENGLISH_GRAMMAR_TOKENS.has(w);

    if (isRoman && !isEnglishGrammar) {
      romanUrduWords++;
      romanUrduScore += 2.0;
    } else if (isRoman && isEnglishGrammar) {
      // Homograph (e.g. 'me', 'to', 'do', 'in', 'is', 'main')
      // Handled by contextual checks below
      romanUrduWords++;
      romanUrduScore += 1.0;
      englishGrammarScore += 0.5;
    } else if (isEnglishGrammar) {
      englishGrammarWords++;
      englishGrammarScore += 2.0;
    }
  }

  // Multi-word phrase matching
  let romanUrduPhrases = 0;
  for (const pat of ROMAN_URDU_PHRASE_PATTERNS) {
    if (pat.test(trimmed)) {
      romanUrduPhrases++;
      romanUrduScore += 3.5;
    }
  }

  let englishClauses = 0;
  for (const pat of ENGLISH_CLAUSE_PATTERNS) {
    if (pat.test(trimmed)) {
      englishClauses++;
      englishGrammarScore += 3.5;
    }
  }

  // Classification Decision Engine
  let detectedLanguage: DetectedLanguage = 'en';
  let confidence = 0.90;

  // A. Check for genuine Mixed Code-Switching:
  // Both a distinct Roman Urdu clause AND a distinct English grammatical clause are present
  // e.g. "Kal mera interview hai and I am very nervous"
  // e.g. "mujhe interview ki practice karni hai, but please ask me questions in English"
  const hasStrongRomanUrdu = romanUrduScore >= 3.5 || (romanUrduWords >= 2 && romanUrduPhrases >= 1);
  const hasStrongEnglishClause = englishClauses >= 1 || (englishGrammarScore >= 3.5 && englishGrammarWords >= 2);

  if (hasStrongRomanUrdu && hasStrongEnglishClause) {
    detectedLanguage = 'mixed';
    confidence = 0.94;
  } else if (hasStrongRomanUrdu || romanUrduScore > englishGrammarScore || (romanUrduWords >= 1 && englishGrammarScore === 0)) {
    // B. Dominant or Pure Roman Urdu:
    // Even if it contains English loanwords like "question", "practice", "interview", "software", "student", "correct", etc.
    detectedLanguage = 'roman_ur';
    confidence = Math.min(0.99, 0.85 + (romanUrduScore / 30));
  } else {
    // C. Dominant or Pure English
    detectedLanguage = 'en';
    confidence = Math.min(0.99, 0.88 + (englishGrammarScore / 25));
  }

  // Effective Response Language honors explicit override if present
  const effectiveResponseLanguage = hasOverride && overrideTarget ? overrideTarget : detectedLanguage;

  const summary = hasOverride && overrideTarget
    ? `User explicitly requested response in ${getLanguageDisplayName(overrideTarget)} (detected input: ${getLanguageDisplayName(detectedLanguage)})`
    : `Detected ${getLanguageDisplayName(detectedLanguage)} input (confidence: ${(confidence * 100).toFixed(0)}%)`;

  return {
    detectedLanguage,
    confidence: Number(confidence.toFixed(2)),
    hasExplicitOverride: hasOverride,
    overrideTarget,
    effectiveResponseLanguage,
    summary,
    signals: {
      romanUrduWords,
      englishWords: latinWordCount - romanUrduWords,
      urduScriptChars,
      romanUrduPhrases,
      romanUrduScore,
      englishGrammarScore,
    },
    urduScriptCharCount: urduScriptChars,
    latinWordCount,
    romanUrduWordCount: romanUrduWords,
  };
}

/**
 * User-friendly display names for languages
 */
export function getLanguageDisplayName(lang: DetectedLanguage): string {
  switch (lang) {
    case 'en':
      return 'English';
    case 'ur':
      return 'Urdu';
    case 'roman_ur':
      return 'Roman Urdu';
    case 'mixed':
      return 'Mixed';
    default:
      return 'English';
  }
}

/**
 * Return badge styling info for UI
 */
export function getLanguageBadgeStyle(lang: DetectedLanguage): { bg: string; text: string; label: string } {
  switch (lang) {
    case 'en':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
        text: 'text-emerald-700 dark:text-emerald-300',
        label: 'English',
      };
    case 'ur':
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-300 font-urdu',
        label: 'Urdu',
      };
    case 'roman_ur':
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800',
        text: 'text-purple-700 dark:text-purple-300',
        label: 'Roman Urdu',
      };
    case 'mixed':
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
        text: 'text-indigo-700 dark:text-indigo-300',
        label: 'Mixed',
      };
    default:
      return {
        bg: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
        text: 'text-slate-600 dark:text-slate-300',
        label: 'English',
      };
  }
}

/**
 * Strict Language Lock Instruction for Gemini prompt
 * Requirement 3: Must be injected immediately before the user message
 */
export function getLanguageLockInstruction(effectiveLanguage: DetectedLanguage): string {
  switch (effectiveLanguage) {
    case 'roman_ur':
      return 'Respond ONLY in natural Roman Urdu. Do not switch to English. English technical terms may be used only when naturally necessary. Do not translate the user\'s Roman Urdu into English. Keep the same Roman Urdu style as the user.';
    case 'ur':
      return 'Respond ONLY in Urdu script. Do not switch to English unless the user explicitly requests English.';
    case 'en':
      return 'Respond ONLY in English.';
    case 'mixed':
      return 'Respond naturally using the same Urdu/English mixed style as the user. Do not convert the entire response into English or entirely into Urdu.';
  }
}

/**
 * Validates whether Gemini\'s response complies with the locked language.
 * Requirement 8: Allows detecting if a response erroneously slipped into English when Roman Urdu was locked.
 */
export function validateResponseLanguage(
  replyText: string,
  expectedLanguage: DetectedLanguage
): { isValid: boolean; reason?: string } {
  const text = (replyText || '').trim();
  if (!text) {
    return { isValid: false, reason: 'Empty response' };
  }

  const urduMatches = text.match(URDU_SCRIPT_REGEX) || [];
  const urduCharCount = urduMatches.length;

  if (expectedLanguage === 'ur') {
    // Must contain substantial Urdu script
    if (urduCharCount < 10 && text.length > 20) {
      return { isValid: false, reason: 'Expected Urdu script but received non-Urdu text.' };
    }
    return { isValid: true };
  }

  if (expectedLanguage === 'en') {
    // Must NOT be Urdu script
    if (urduCharCount > 15) {
      return { isValid: false, reason: 'Expected English but received Urdu script.' };
    }
    return { isValid: true };
  }

  if (expectedLanguage === 'roman_ur') {
    // Must NOT be Urdu script
    if (urduCharCount > 15) {
      return { isValid: false, reason: 'Expected Roman Urdu but received Urdu script.' };
    }

    // Check if the response is overwhelmingly pure English without any Roman Urdu conversational framing
    const latinWords = text
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => /^[a-z]+$/i.test(w) && w.length > 0);

    let romanUrduFound = 0;
    for (const w of latinWords) {
      if (ROMAN_URDU_MARKERS.has(w)) {
        romanUrduFound++;
      }
    }

    // Note: English sample questions like "Tell me about yourself" inside a Roman Urdu response are allowed.
    // But if there are 0 Roman Urdu words in a substantial response (e.g. > 10 words), it is purely English!
    if (latinWords.length > 8 && romanUrduFound === 0) {
      return { isValid: false, reason: 'Response is entirely in English without Roman Urdu framing.' };
    }

    return { isValid: true };
  }

  // Mixed allows both
  return { isValid: true };
}
