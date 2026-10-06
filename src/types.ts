export type AppView =
  | 'landing'
  | 'dashboard'
  | 'conversation'
  | 'speaking'
  | 'writing'
  | 'grammar'
  | 'vocabulary'
  | 'translator'
  | 'challenges'
  | 'progress'
  | 'profile'
  | 'settings';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type CefrLevel = CEFRLevel;
export type SimplifiedLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type LearningGoal =
  | 'Speaking'
  | 'Writing'
  | 'Grammar'
  | 'Vocabulary'
  | 'General English'
  | 'Workplace & Career'
  | 'IELTS / TOEFL'
  | 'Everyday Fluency'
  | 'Travel'
  | 'Academic';

export interface UserProfile {
  uid: string;
  id: string; // compatibility alias
  name: string;
  email: string;
  avatar?: string;
  nativeLanguage: string;
  englishLevel: CEFRLevel;
  simplifiedLevel?: SimplifiedLevel;
  targetLevel: CEFRLevel; // compatibility alias
  learningGoal: LearningGoal;
  primaryGoal: LearningGoal; // compatibility alias
  dailyPracticeGoal: number; // in minutes
  dailyGoalMinutes: number; // compatibility alias
  hasCompletedOnboarding?: boolean;
  createdAt: string;
  streakDays: number;
  lastActiveDate: string;
  totalXp: number;
  wordsMasteredCount: number;
  conversationsCount: number;
  grammarChecksCount: number;
  translationsCount: number;
  practiceMinutes: number;
  writingChecksCount?: number;
  speakingSessionsCount?: number;
  speakingMinutes?: number;
  wordsSpokenCount?: number;
  averageWpm?: number;
  challengesCompletedCount: number;
  badges: Badge[];
  isLoggedIn: boolean;
  isGuest?: boolean;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  isUnlocked: boolean;
}

export interface AppSettings {
  darkMode: boolean;
  theme?: 'light' | 'dark';
  accentPreference: 'American' | 'British' | 'Australian' | 'Indian';
  speechRate: number; // 0.7 to 1.3
  showUrduAssistance: boolean;
  autoPlayVoice: boolean;
  soundEffects: boolean;
}

export type DetectedLanguage = 'en' | 'ur' | 'roman_ur' | 'mixed';

export type SpeechUiState =
  | 'Ready'
  | 'Microphone ready'
  | 'Listening...'
  | 'Transcribing...'
  | 'Review your transcript'
  | 'Sending...'
  | 'AI is thinking...'
  | 'AI is speaking...'
  | 'Speaking response...';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string; // The active text or AI reply
  originalInput?: string; // Preserved raw original user input/transcript before any processing
  originalTranscript?: string; // Exact recorded speech transcript from mic
  editedTranscript?: string; // User-edited transcript if modified before sending
  detectedLanguage?: DetectedLanguage;
  effectiveResponseLanguage?: DetectedLanguage;
  isVoiceInput?: boolean;
  speakingDurationSeconds?: number;
  speakingMetrics?: {
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
  };
  speakingScores?: {
    pronunciationScore: number;
    grammarScore: number;
    fluencyScore: number;
    vocabularyScore: number;
    clarityScore?: number;
    overallScore: number;
    pronunciationDisclaimer: string;
  };
  speakingFeedback?: {
    fluency: number;
    grammar: number;
    vocabulary: number;
    clarity: number;
    overall: number;
    fluencyTip?: string;
  };
  timestamp: string;
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
  vocabularyOpportunities?: {
    original: string;
    suggested: string[];
    explanation?: string;
  }[];
  suggestedResponses?: string[];
  confidenceScore?: number;
  followUpQuestion?: string;
  learningTip?: string;
  detectedIntent?: string;
  primaryCorrection?: string;
  recurringWeaknessIdentified?: string;
}

export interface Scenario {
  id: string;
  title: string;
  category: 'Career' | 'Daily Life' | 'Exams' | 'Social' | 'Travel';
  description: string;
  initialPrompt: string;
  icon: string;
  difficulty: CEFRLevel;
  role: string;
  aiRole: string;
}

export interface GrammarError {
  type: string;
  original: string;
  suggestion: string;
  explanation: string;
  urduTip?: string;
}

export interface GrammarAnalysisResult {
  originalText: string;
  correctedText: string;
  overallScore: number;
  fluencyLevel: string;
  summary: string;
  errors: GrammarError[];
  alternativeVersions: {
    tone: string;
    text: string;
  }[];
}

export interface VocabularyWord {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  cefrLevel: CEFRLevel;
  definition: string;
  urduMeaning: string;
  urduExplanation: string;
  examples: { en: string; ur: string }[];
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  mnemonic: string;
  isMastered?: boolean;
  quizQuestion?: {
    question: string;
    options: string[];
    correctIndex: number;
  };
}

export interface TranslationResult {
  sourceText: string;
  translation: string;
  romanUrdu: string;
  formalityUsed: string;
  breakdown: {
    source: string;
    target: string;
    note: string;
  }[];
  grammarTip: string;
  alternatives: {
    label: string;
    text: string;
  }[];
}

export interface DailyChallenge {
  id: string;
  title: string;
  category?: 'Speaking' | 'Grammar' | 'Vocabulary' | 'Translation';
  prompt: string;
  description: string;
  xpReward: number;
  isCompleted: boolean;
  hint?: string;
  sampleAnswer?: string;
  targetCriteria?: string;
  type?: ChallengeType;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  instructions?: string;
  options?: string[];
  sampleHint?: string;
  urduHint?: string;
  modelAnswer?: string;
}

export interface PracticeSessionRecord {
  id: string;
  type: 'conversation' | 'grammar' | 'vocabulary' | 'translation' | 'challenge';
  title: string;
  timestamp: string;
  durationMinutes: number;
  xpEarned: number;
  summary: string;
}

export interface ConversationFeedbackResult {
  grammarFeedback: string;
  vocabularyFeedback: string;
  commonMistakes: {
    mistake: string;
    correction: string;
    explanation: string;
  }[];
  improvementSuggestions: string[];
  overallFeedback: string;
  overallScore: number;
}

export type ChallengeType =
  | 'grammar'
  | 'vocabulary'
  | 'translation'
  | 'sentence_correction'
  | 'multiple_choice';

export interface GeneratedChallenge {
  id: string;
  title: string;
  type: ChallengeType;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  prompt: string;
  instructions: string;
  options?: string[];
  xpReward: number;
  sampleHint?: string;
  urduHint?: string;
  modelAnswer?: string;
}

export interface ChallengeEvaluationResult {
  score: number;
  passed: boolean;
  xpAwarded: number;
  feedback: string;
  corrections?: string[];
  improvements?: string[];
  modelAnswer?: string;
  urduTip?: string;
}

// AI Writing Coach Types
export type WritingStyleMode =
  | 'General English'
  | 'Academic'
  | 'Professional'
  | 'Job Application'
  | 'Email'
  | 'Interview Answer'
  | 'Casual';

export interface WritingMistake {
  original: string;
  correction: string;
  category: string; // 'Subject-Verb Agreement' | 'Preposition' | 'Article' | 'Verb Tense' | 'Punctuation' | 'Word Choice' | 'Grammar'
  explanation: string;
}

export interface WritingVocabSuggestion {
  original: string;
  suggested: string[];
  explanation: string;
}

export interface WritingPracticeExercise {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface WritingAnalysisResult {
  originalText: string;
  correctedText: string;
  naturalVersion: string;
  overallScore: number;
  grammarScore: number;
  vocabularyScore: number;
  sentenceStructureScore: number;
  naturalnessScore: number;
  scoreReason: string;
  mistakes: WritingMistake[];
  vocabularySuggestions: WritingVocabSuggestion[];
  strengths: string[];
  improvementTips: string[];
  practiceExercise?: WritingPracticeExercise;
  detectedLanguage?: 'en' | 'ur' | 'roman_ur' | 'mixed';
  effectiveResponseLanguage?: 'en' | 'ur' | 'roman_ur' | 'mixed';
}

