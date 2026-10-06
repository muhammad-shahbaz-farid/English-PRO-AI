// Speaking Fluency & Speech Metrics Utility for EnglishPro AI Speaking Coach

export interface SpeakingMetrics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerWords: string[];
  fillerWordCount: number;
  repeatedWords: string[];
  sentenceCount?: number;
  averageWordsPerSentence?: number;
  fluencyStatus: 'natural' | 'hesitant' | 'rapid' | 'balanced';
  metricsSummary: string;
}

export interface SpeakingFeedbackScores {
  fluencyScore: number;
  grammarScore: number;
  vocabularyScore: number;
  clarityScore: number; // Clarity estimate based on transcript and language patterns
  overallScore: number;
  pronunciationScore: number; // Backward compatibility alias for clarity
  pronunciationDisclaimer: string;
}

export interface SpeakingSessionSummary {
  fluencyStatus: 'Excellent' | 'Good' | 'Improving';
  grammarStatus: 'Excellent' | 'Good' | 'Improving';
  vocabularyStatus: 'Rich' | 'Good' | 'Improving';
  clarityStatus: 'Clear' | 'Good' | 'Improving';
  wordsSpoken: number;
  averageWpm: number;
  fillerWordsCount: number;
  fillerWordsList: string[];
  topImprovement: string;
  usefulVocabulary: string[];
}

// Strict list of dedicated hesitation and conversational filler words
const SIMPLE_FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'umm', 'uhh',
  'actually', 'basically', 'literally',
  'matlab', 'yani',
]);

const MULTI_WORD_FILLERS = [
  'you know',
  'i mean',
  'sort of',
  'kind of',
  'waise to',
  'acha to',
];

// Words that indicate "like" is used as a verb/preposition, NOT a filler word
const LIKE_VERB_PRECEDING_WORDS = new Set([
  'i', 'we', 'you', 'they', 'he', 'she', 'who',
  'to', 'would', 'really', 'just', 'do', 'did', 'does', 'not', "don't", "didn't",
]);

/**
 * Calculate speaking metrics based on transcript and actual recorded duration.
 * Accurately measures:
 * - duration
 * - wordCount
 * - wordsPerMinute
 * - fillerWords
 * - repeatedWords
 * - sentenceCount
 * - averageWordsPerSentence
 */
export function calculateSpeakingMetrics(
  transcript: string,
  durationSeconds: number
): SpeakingMetrics {
  const cleaned = (transcript || '').trim();
  const effectiveSeconds = Math.max(Math.round(durationSeconds), 1);

  if (!cleaned) {
    return {
      durationSeconds: Math.max(0, durationSeconds),
      wordCount: 0,
      wordsPerMinute: 0,
      fillerWords: [],
      fillerWordCount: 0,
      repeatedWords: [],
      sentenceCount: 0,
      averageWordsPerSentence: 0,
      fluencyStatus: 'balanced',
      metricsSummary: 'No words detected in audio segment.',
    };
  }

  // Tokenize words preserving unicode letters
  const rawTokens = cleaned
    .toLowerCase()
    .replace(/[^\p{L}\s']/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const wordCount = rawTokens.length;
  const wordsPerMinute = Math.round((wordCount / (effectiveSeconds / 60)));

  // Detect filler words with high precision (avoid false positives on normal words like 'I like cricket')
  const detectedFillers: string[] = [];
  const lowerTranscript = cleaned.toLowerCase();

  // 1. Multi-word fillers
  for (const filler of MULTI_WORD_FILLERS) {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = lowerTranscript.match(regex);
    if (matches) {
      for (let i = 0; i < matches.length; i++) {
        detectedFillers.push(filler);
      }
    }
  }

  // 2. Single-word dedicated fillers
  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];

    if (SIMPLE_FILLER_WORDS.has(token)) {
      detectedFillers.push(token);
      continue;
    }

    // Special check for 'like':
    // If preceded by a subject pronoun or modal verb (e.g. "I like cricket", "we like", "would like"),
    // it is a genuine verb, NOT a filler word!
    if (token === 'like') {
      const prevWord = i > 0 ? rawTokens[i - 1] : '';
      if (!LIKE_VERB_PRECEDING_WORDS.has(prevWord)) {
        // Standalone or conversational filler 'like'
        detectedFillers.push('like');
      }
    }
  }

  // Detect repeated consecutive words (e.g. "I I", "went went")
  const repeatedWords: string[] = [];
  for (let i = 0; i < rawTokens.length - 1; i++) {
    if (rawTokens[i] === rawTokens[i + 1] && rawTokens[i].length >= 1) {
      repeatedWords.push(`${rawTokens[i]} ${rawTokens[i + 1]}`);
    }
  }

  // Calculate sentenceCount and averageWordsPerSentence
  // Speech-to-text might include terminal punctuation [.!?] or omit it
  const punctuationMatches = cleaned.match(/[.!?]+/g);
  let sentenceCount = punctuationMatches ? punctuationMatches.length : 0;

  if (sentenceCount === 0) {
    // If no punctuation was provided by speech recognition, estimate sentences:
    // Simple short speech (<14 words) is 1 sentence; longer speech is estimated based on conjunctions or 8-10 words per sentence
    if (wordCount <= 12) {
      sentenceCount = 1;
    } else {
      const clauseConjunctions = cleaned.match(/\b(and|but|because|however|although|so|then|lekin|kyunke)\b/gi);
      sentenceCount = clauseConjunctions ? Math.min(Math.max(2, clauseConjunctions.length + 1), Math.ceil(wordCount / 6)) : Math.max(1, Math.round(wordCount / 9));
    }
  }

  const averageWordsPerSentence = sentenceCount > 0
    ? Math.round((wordCount / sentenceCount) * 10) / 10
    : wordCount;

  // Evaluate pace & fluency status
  // Normal conversational English is roughly 110 - 150 WPM
  let fluencyStatus: SpeakingMetrics['fluencyStatus'] = 'balanced';
  let paceDescription = 'ideal conversational pace';

  if (wordsPerMinute < 80) {
    fluencyStatus = 'hesitant';
    paceDescription = 'deliberate pace with thoughtful pauses';
  } else if (wordsPerMinute > 175) {
    fluencyStatus = 'rapid';
    paceDescription = 'very fast pace — consider slowing slightly for clarity';
  } else {
    fluencyStatus = 'natural';
    paceDescription = 'natural, smooth conversational pace';
  }

  let summary = `Spoke ~${wordCount} words in ${effectiveSeconds}s (~${wordsPerMinute} WPM, ${paceDescription}).`;
  if (detectedFillers.length > 0) {
    const uniqueFillers = Array.from(new Set(detectedFillers)).join(', ');
    summary += ` Noticed ${detectedFillers.length} filler word(s) (${uniqueFillers}).`;
  }
  if (repeatedWords.length > 0) {
    summary += ` Repeated: "${repeatedWords.slice(0, 2).join('", "')}".`;
  }

  return {
    durationSeconds: effectiveSeconds,
    wordCount,
    wordsPerMinute,
    fillerWords: detectedFillers,
    fillerWordCount: detectedFillers.length,
    repeatedWords,
    sentenceCount,
    averageWordsPerSentence,
    fluencyStatus,
    metricsSummary: summary,
  };
}

/**
 * Standardized score estimation with clear clarity / pronunciation disclaimer.
 * Requirement 4: Scores are estimates based on transcript and language patterns.
 */
export function estimateSpeakingScores(
  metrics: SpeakingMetrics,
  grammarErrorCount: number = 0,
  confidenceScore: number = 85
): SpeakingFeedbackScores {
  // Baseline fluency score from WPM and filler count
  let fluencyScore = 85;
  if (metrics.wordsPerMinute >= 100 && metrics.wordsPerMinute <= 155) {
    fluencyScore += 10;
  } else if (metrics.wordsPerMinute < 75 || metrics.wordsPerMinute > 185) {
    fluencyScore -= 15;
  }

  if (metrics.fillerWordCount > 2) {
    fluencyScore -= Math.min(25, metrics.fillerWordCount * 4);
  }
  fluencyScore = Math.min(100, Math.max(45, fluencyScore));

  // Grammar score based on error count
  let grammarScore = 95 - grammarErrorCount * 12;
  grammarScore = Math.min(100, Math.max(50, grammarScore));

  // Vocabulary score based on length and sentence structure
  let vocabularyScore = metrics.wordCount >= 12 ? 88 : metrics.wordCount >= 6 ? 82 : 74;
  const avgWordsPerSentence = metrics.averageWordsPerSentence ?? (metrics.sentenceCount ? metrics.wordCount / metrics.sentenceCount : metrics.wordCount);
  if (avgWordsPerSentence >= 7 && avgWordsPerSentence <= 18) {
    vocabularyScore += 4;
  }
  vocabularyScore = Math.min(100, Math.max(50, vocabularyScore));

  // Clarity estimate based on speech confidence and fluency
  const clarityScore = Math.min(98, Math.max(60, Math.round((confidenceScore * 0.7) + (fluencyScore * 0.3))));

  // Overall score
  const overallScore = Math.round(
    clarityScore * 0.25 +
    grammarScore * 0.35 +
    fluencyScore * 0.25 +
    vocabularyScore * 0.15
  );

  return {
    fluencyScore,
    grammarScore,
    vocabularyScore,
    clarityScore,
    pronunciationScore: clarityScore,
    overallScore,
    pronunciationDisclaimer: 'Speaking scores are estimates based on your transcript and language patterns, not laboratory-grade pronunciation analysis.',
  };
}

/**
 * Generate natural constructive fluency coaching feedback based on metrics.
 * Requirement 7: WPM, filler words, repeated words, and pausing advice.
 */
export function generateFluencyFeedback(metrics: SpeakingMetrics): string {
  if (metrics.fillerWordCount > 0) {
    const fillerExample = metrics.fillerWords[0];
    const countStr = metrics.fillerWordCount === 1 ? 'once' : `${metrics.fillerWordCount} times`;
    return `Your speaking pace was comfortable (~${metrics.wordsPerMinute} WPM), but you used '${fillerExample}' ${countStr}. Try pausing briefly instead of using filler sounds.`;
  }

  if (metrics.wordsPerMinute < 80) {
    return `Your speaking pace was thoughtful and deliberate (~${metrics.wordsPerMinute} WPM). As you get more comfortable, try linking your sentences for a more continuous flow.`;
  }

  if (metrics.wordsPerMinute > 175) {
    return `You spoke at a brisk pace (~${metrics.wordsPerMinute} WPM). Consider pausing after key ideas to give your listener time to absorb your thoughts.`;
  }

  if (metrics.repeatedWords.length > 0) {
    return `Good conversational energy! Watch out for small word repetitions like "${metrics.repeatedWords[0]}" when thinking of the next word.`;
  }

  return `Natural conversational flow with comfortable pacing (~${metrics.wordsPerMinute} WPM) and clear structure.`;
}

/**
 * Generate a compact Speaking Session Summary after multiple speaking turns.
 * Requirement 12: Summary of Fluency, Grammar, Vocabulary, Clarity, Words, WPM, Fillers, Top Improvement, and Useful Vocabulary.
 */
export function generateSpeakingSessionSummary(
  spokenMessages: {
    speakingMetrics?: Partial<SpeakingMetrics>;
    speakingScores?: Partial<SpeakingFeedbackScores>;
    corrections?: { original: string; suggested: string; explanation: string }[];
    vocabularyOpportunities?: { original: string; suggested: string[] }[];
  }[]
): SpeakingSessionSummary {
  if (spokenMessages.length === 0) {
    return {
      fluencyStatus: 'Good',
      grammarStatus: 'Good',
      vocabularyStatus: 'Good',
      clarityStatus: 'Good',
      wordsSpoken: 0,
      averageWpm: 0,
      fillerWordsCount: 0,
      fillerWordsList: [],
      topImprovement: 'Complete speaking turns using the microphone to generate your personalized summary.',
      usefulVocabulary: ['confident', 'experience', 'challenging'],
    };
  }

  let totalWords = 0;
  let totalWpmSum = 0;
  let wpmCount = 0;
  let totalFillers = 0;
  const fillersList: string[] = [];
  let totalErrors = 0;
  const collectedVocab: string[] = [];

  for (const msg of spokenMessages) {
    if (msg.speakingMetrics) {
      totalWords += msg.speakingMetrics.wordCount || 0;
      if ((msg.speakingMetrics.wordsPerMinute || 0) > 0) {
        totalWpmSum += msg.speakingMetrics.wordsPerMinute || 0;
        wpmCount++;
      }
      totalFillers += msg.speakingMetrics.fillerWordCount || 0;
      if (Array.isArray(msg.speakingMetrics.fillerWords)) {
        fillersList.push(...msg.speakingMetrics.fillerWords);
      }
    }
    if (msg.corrections) {
      totalErrors += msg.corrections.length;
    }
    if (msg.vocabularyOpportunities) {
      for (const v of msg.vocabularyOpportunities) {
        if (Array.isArray(v.suggested)) {
          collectedVocab.push(...v.suggested);
        }
      }
    }
  }

  const averageWpm = wpmCount > 0 ? Math.round(totalWpmSum / wpmCount) : 0;
  const uniqueFillers = Array.from(new Set(fillersList));

  // Determine qualitative statuses
  const fluencyStatus: SpeakingSessionSummary['fluencyStatus'] =
    totalFillers <= 1 && averageWpm >= 95 && averageWpm <= 160 ? 'Excellent' : totalFillers <= 3 ? 'Good' : 'Improving';

  const grammarStatus: SpeakingSessionSummary['grammarStatus'] =
    totalErrors === 0 ? 'Excellent' : totalErrors <= 2 ? 'Good' : 'Improving';

  const vocabularyStatus: SpeakingSessionSummary['vocabularyStatus'] =
    collectedVocab.length >= 3 || totalWords >= 60 ? 'Rich' : totalWords >= 25 ? 'Good' : 'Improving';

  const clarityStatus: SpeakingSessionSummary['clarityStatus'] =
    averageWpm >= 85 && averageWpm <= 165 ? 'Clear' : 'Good';

  // Determine top actionable improvement
  let topImprovement = 'Try using longer complete sentences instead of very short responses.';
  if (totalFillers >= 3) {
    topImprovement = `Notice your use of filler words (${uniqueFillers.slice(0, 2).join(', ')}). Replacing fillers with a silent 1-second pause sounds much more confident.`;
  } else if (totalErrors >= 2) {
    topImprovement = 'Focus on subject-verb agreement and consistent past/present tenses when sharing stories.';
  } else if (averageWpm < 85 && totalWords > 15) {
    topImprovement = 'Build your speaking speed by practicing common phrases as single rhythmic units.';
  } else if (averageWpm > 175) {
    topImprovement = 'Slow your tempo slightly so your key ideas resonate with greater impact.';
  }

  // Curate useful vocabulary list
  const usefulVocabulary = collectedVocab.length > 0
    ? Array.from(new Set(collectedVocab)).slice(0, 4)
    : ['confident', 'experience', 'challenging', 'collaborate'];

  return {
    fluencyStatus,
    grammarStatus,
    vocabularyStatus,
    clarityStatus,
    wordsSpoken: totalWords,
    averageWpm,
    fillerWordsCount: totalFillers,
    fillerWordsList: uniqueFillers,
    topImprovement,
    usefulVocabulary,
  };
}
