import {
  UserProfile,
  DailyChallenge,
  VocabularyWord,
  AppView,
  PracticeSessionRecord,
} from '../types';
import { loadPracticeSessions } from './storage';

export interface SpeakingSessionRecord {
  id: string;
  timestamp: string;
  durationSeconds: number;
  wordCount: number;
  wpm: number;
  overallScore: number;
  pronunciationScore?: number;
  grammarScore?: number;
  fluencyScore?: number;
  vocabularyScore?: number;
  clarityScore?: number;
}

export interface WritingSessionRecord {
  id: string;
  timestamp: string;
  mode: string;
  wordCount: number;
  overallScore: number;
  grammarScore: number;
  vocabularyScore: number;
  sentenceStructureScore: number;
  naturalnessScore: number;
}

export interface GrammarMistakeOccurrence {
  id: string;
  category: string;
  original: string;
  correction: string;
  explanation: string;
  timestamp: string;
}

export interface GrammarCategorySummary {
  category: string;
  count: number;
  lastDetected: string;
  isRepeatedWeakness: boolean; // count >= 2
  examples: { original: string; correction: string; explanation: string }[];
}

export interface ChallengeRecord {
  challengeId: string;
  title: string;
  category?: string;
  type?: string;
  score: number;
  passed: boolean;
  timestamp: string;
}

export interface UserLearningMemory {
  uid: string;
  speakingHistory: SpeakingSessionRecord[];
  writingHistory: WritingSessionRecord[];
  grammarMistakes: GrammarMistakeOccurrence[];
  challengeHistory: ChallengeRecord[];
  lastPracticeDate?: string;
  updatedAt: string;
}

export interface SkillDetail {
  skill: 'Speaking' | 'Writing' | 'Grammar' | 'Vocabulary' | 'Fluency';
  hasEnoughData: boolean;
  score: number | null; // null if not enough data
  scoreLabel: string; // e.g. "82/100" or "Not enough data yet"
  evidenceCount: number;
  evidenceLabel: string;
  recentActivity: string;
  trend: 'improving' | 'steady' | 'declining' | 'first_session' | 'insufficient_data';
  trendLabel: string; // "Your first recorded session", "+4% vs previous", "Not enough data yet"
  recommendedAction: string;
  targetView: AppView;
  metrics: Record<string, string | number>;
}

export interface LearningInsight {
  id: string;
  type: 'strength' | 'focus_area' | 'habit' | 'milestone' | 'info';
  title: string;
  description: string;
  metric?: string;
}

export interface NextBestPractice {
  title: string;
  reason: string;
  targetView: AppView;
  actionLabel: string;
  topic?: string;
  category: 'speaking' | 'writing' | 'grammar' | 'vocabulary' | 'challenge' | 'general';
}

function getMemoryKey(uid: string): string {
  const safeUid = uid || 'guest_user';
  return `englishpro_learning_memory_${safeUid}`;
}

/**
 * Standardize grammar error categories for consistent grouping
 */
export function normalizeGrammarCategory(rawCategory?: string): string {
  if (!rawCategory) return 'Grammar & Syntax';
  const c = rawCategory.trim().toLowerCase();

  if (c.includes('subject') || c.includes('agreement') || c.includes('singular') || c.includes('plural')) {
    return 'Subject-Verb Agreement';
  }
  if (c.includes('tense') || c.includes('past') || c.includes('present') || c.includes('future') || c.includes('verb form')) {
    return 'Tenses';
  }
  if (c.includes('article') || c.includes('a/an') || c.includes('determiner')) {
    return 'Articles';
  }
  if (c.includes('preposition') || c.includes('in/at/on') || c.includes('prepositional')) {
    return 'Prepositions';
  }
  if (c.includes('vocabulary') || c.includes('word choice') || c.includes('diction') || c.includes('collocation')) {
    return 'Word Choice';
  }
  if (c.includes('structure') || c.includes('syntax') || c.includes('clause') || c.includes('run-on') || c.includes('fragment')) {
    return 'Sentence Structure';
  }
  if (c.includes('punctuation') || c.includes('comma') || c.includes('period') || c.includes('apostrophe')) {
    return 'Punctuation';
  }
  // Title-case fallback for clean representation
  return rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
}

/**
 * Load user's learning memory from localStorage
 */
export function loadLearningMemory(uid: string): UserLearningMemory {
  try {
    const key = getMemoryKey(uid);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed: UserLearningMemory = JSON.parse(raw);
      return {
        uid: parsed.uid || uid,
        speakingHistory: Array.isArray(parsed.speakingHistory) ? parsed.speakingHistory : [],
        writingHistory: Array.isArray(parsed.writingHistory) ? parsed.writingHistory : [],
        grammarMistakes: Array.isArray(parsed.grammarMistakes) ? parsed.grammarMistakes : [],
        challengeHistory: Array.isArray(parsed.challengeHistory) ? parsed.challengeHistory : [],
        lastPracticeDate: parsed.lastPracticeDate || '',
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (e) {
    console.error('Failed to load learning memory:', e);
  }

  return {
    uid,
    speakingHistory: [],
    writingHistory: [],
    grammarMistakes: [],
    challengeHistory: [],
    lastPracticeDate: '',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save user's learning memory to localStorage
 */
export function saveLearningMemory(uid: string, memory: UserLearningMemory) {
  try {
    const key = getMemoryKey(uid);
    memory.updatedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(memory));
  } catch (e) {
    console.error('Failed to save learning memory:', e);
  }
}

/**
 * Record a speaking session with metrics and scores
 */
export function recordSpeakingSession(
  uid: string,
  record: Omit<SpeakingSessionRecord, 'id' | 'timestamp'>
) {
  try {
    const memory = loadLearningMemory(uid);
    const newSession: SpeakingSessionRecord = {
      ...record,
      id: `spk_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    memory.speakingHistory = [newSession, ...memory.speakingHistory].slice(0, 50);
    memory.lastPracticeDate = new Date().toISOString();
    saveLearningMemory(uid, memory);
  } catch (e) {
    console.error('Failed to record speaking session:', e);
  }
}

/**
 * Record a writing session with metrics and scores
 */
export function recordWritingSession(
  uid: string,
  record: Omit<WritingSessionRecord, 'id' | 'timestamp'>
) {
  try {
    const memory = loadLearningMemory(uid);
    const newSession: WritingSessionRecord = {
      ...record,
      id: `wrt_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    memory.writingHistory = [newSession, ...memory.writingHistory].slice(0, 50);
    memory.lastPracticeDate = new Date().toISOString();
    saveLearningMemory(uid, memory);
  } catch (e) {
    console.error('Failed to record writing session:', e);
  }
}

/**
 * Record grammar mistakes identified in Grammar Doctor or Writing Coach
 */
export function recordGrammarMistakes(
  uid: string,
  mistakes: { category?: string; original: string; correction: string; explanation: string }[]
) {
  if (!mistakes || mistakes.length === 0) return;
  try {
    const memory = loadLearningMemory(uid);
    const now = new Date().toISOString();
    const newOccurrences: GrammarMistakeOccurrence[] = mistakes.map((m) => ({
      id: `grm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      category: normalizeGrammarCategory(m.category),
      original: m.original.trim(),
      correction: m.correction.trim(),
      explanation: m.explanation.trim(),
      timestamp: now,
    }));

    memory.grammarMistakes = [...newOccurrences, ...memory.grammarMistakes].slice(0, 60);
    saveLearningMemory(uid, memory);
  } catch (e) {
    console.error('Failed to record grammar mistakes:', e);
  }
}

/**
 * Record a daily challenge completion
 */
export function recordChallengeAttempt(
  uid: string,
  record: Omit<ChallengeRecord, 'timestamp'>
) {
  try {
    const memory = loadLearningMemory(uid);
    const newAttempt: ChallengeRecord = {
      ...record,
      timestamp: new Date().toISOString(),
    };
    memory.challengeHistory = [newAttempt, ...memory.challengeHistory].slice(0, 50);
    memory.lastPracticeDate = new Date().toISOString();
    saveLearningMemory(uid, memory);
  } catch (e) {
    console.error('Failed to record challenge attempt:', e);
  }
}

/**
 * Clear learning memory on data reset
 */
export function clearLearningMemory(uid: string) {
  try {
    const key = getMemoryKey(uid);
    localStorage.removeItem(key);
    localStorage.removeItem(`englishpro_grammar_ctx_${uid || 'guest_user'}`);
  } catch (e) {
    console.error('Failed to clear learning memory:', e);
  }
}

/**
 * Group grammar mistakes by category and detect repeated patterns
 */
export function getGrammarWeaknessSummary(uid: string): GrammarCategorySummary[] {
  const memory = loadLearningMemory(uid);
  const map = new Map<string, { count: number; lastDetected: string; examples: { original: string; correction: string; explanation: string }[] }>();

  for (const m of memory.grammarMistakes) {
    const cat = m.category;
    const existing = map.get(cat) || { count: 0, lastDetected: m.timestamp, examples: [] };
    existing.count += 1;
    if (new Date(m.timestamp) > new Date(existing.lastDetected)) {
      existing.lastDetected = m.timestamp;
    }
    if (existing.examples.length < 2) {
      existing.examples.push({
        original: m.original,
        correction: m.correction,
        explanation: m.explanation,
      });
    }
    map.set(cat, existing);
  }

  const result: GrammarCategorySummary[] = [];
  map.forEach((data, category) => {
    result.push({
      category,
      count: data.count,
      lastDetected: data.lastDetected,
      isRepeatedWeakness: data.count >= 2,
      examples: data.examples,
    });
  });

  // Sort repeated weaknesses first, then by count descending
  return result.sort((a, b) => {
    if (a.isRepeatedWeakness && !b.isRepeatedWeakness) return -1;
    if (!a.isRepeatedWeakness && b.isRepeatedWeakness) return 1;
    return b.count - a.count;
  });
}

/**
 * Evaluate trends across session history
 */
function evaluateSessionTrend(scores: number[]): {
  trend: 'improving' | 'steady' | 'declining' | 'first_session' | 'insufficient_data';
  trendLabel: string;
} {
  if (scores.length === 0) {
    return { trend: 'insufficient_data', trendLabel: 'Not enough data yet' };
  }
  if (scores.length === 1) {
    return { trend: 'first_session', trendLabel: 'Your first recorded session' };
  }

  // Scores are ordered newest to oldest
  const recent = scores[0];
  const priorAvg = scores.slice(1).reduce((acc, s) => acc + s, 0) / (scores.length - 1);
  const diff = Math.round(recent - priorAvg);

  if (diff > 2) {
    return { trend: 'improving', trendLabel: `+${diff}% vs earlier sessions` };
  } else if (diff < -2) {
    return { trend: 'declining', trendLabel: `${diff}% vs earlier sessions` };
  }
  return { trend: 'steady', trendLabel: 'Steady performance' };
}

/**
 * Compute the Skill Model for Speaking, Writing, Grammar, Vocabulary, Fluency
 */
export function getSkillAnalytics(
  user: UserProfile,
  vocabulary: VocabularyWord[],
  challenges: DailyChallenge[]
): Record<'Speaking' | 'Writing' | 'Grammar' | 'Vocabulary' | 'Fluency', SkillDetail> {
  const uid = user.uid || user.id || 'guest_user';
  const memory = loadLearningMemory(uid);
  const generalSessions = loadPracticeSessions();

  // 1. Speaking Skill
  const spkHistory = memory.speakingHistory;
  const spkScores = spkHistory.map((s) => s.overallScore).filter(Boolean);
  const spkTrend = evaluateSessionTrend(spkScores);
  const spkAvgScore = spkScores.length > 0 ? Math.round(spkScores.reduce((a, b) => a + b, 0) / spkScores.length) : null;
  const totalSpkWpm = spkHistory.reduce((a, b) => a + (b.wpm || 0), 0);
  const avgSpkWpm = spkHistory.length > 0 ? Math.round(totalSpkWpm / spkHistory.length) : user.averageWpm || 0;
  const totalSpkWords = spkHistory.reduce((a, b) => a + (b.wordCount || 0), 0) || user.wordsSpokenCount || 0;
  const totalSpkSec = spkHistory.reduce((a, b) => a + (b.durationSeconds || 0), 0) || (user.speakingMinutes || 0) * 60;

  const speakingSkill: SkillDetail = {
    skill: 'Speaking',
    hasEnoughData: spkHistory.length > 0 || (user.conversationsCount || 0) > 0,
    score: spkAvgScore,
    scoreLabel: spkAvgScore !== null ? `${spkAvgScore}/100` : 'Not enough data yet',
    evidenceCount: spkHistory.length || user.conversationsCount || 0,
    evidenceLabel:
      spkHistory.length === 1
        ? '1 speaking session recorded'
        : spkHistory.length > 1
        ? `${spkHistory.length} speaking sessions recorded`
        : '0 sessions recorded',
    recentActivity: spkHistory.length > 0 ? 'Recorded session in history' : 'No recorded sessions',
    trend: spkTrend.trend,
    trendLabel: spkTrend.trendLabel,
    recommendedAction: 'Practice a 60-second vocal scenario in Speaking Coach',
    targetView: 'speaking',
    metrics: {
      'Average Pace': avgSpkWpm > 0 ? `${avgSpkWpm} WPM` : '—',
      'Words Spoken': totalSpkWords,
      'Speaking Time': totalSpkSec > 0 ? `${Math.round(totalSpkSec / 60)} min` : '0 min',
      'Session Count': spkHistory.length || user.conversationsCount || 0,
    },
  };

  // 2. Writing Skill
  const wrtHistory = memory.writingHistory;
  const wrtScores = wrtHistory.map((w) => w.overallScore).filter(Boolean);
  const wrtTrend = evaluateSessionTrend(wrtScores);
  const wrtAvgScore = wrtScores.length > 0 ? Math.round(wrtScores.reduce((a, b) => a + b, 0) / wrtScores.length) : null;
  const wrtAvgGrammar = wrtHistory.length > 0 ? Math.round(wrtHistory.reduce((a, b) => a + (b.grammarScore || 0), 0) / wrtHistory.length) : 0;
  const wrtAvgVocab = wrtHistory.length > 0 ? Math.round(wrtHistory.reduce((a, b) => a + (b.vocabularyScore || 0), 0) / wrtHistory.length) : 0;

  const writingSkill: SkillDetail = {
    skill: 'Writing',
    hasEnoughData: wrtHistory.length > 0 || (user.writingChecksCount || 0) > 0,
    score: wrtAvgScore,
    scoreLabel: wrtAvgScore !== null ? `${wrtAvgScore}/100` : 'Not enough data yet',
    evidenceCount: wrtHistory.length || user.writingChecksCount || 0,
    evidenceLabel:
      wrtHistory.length === 1
        ? '1 writing analysis recorded'
        : wrtHistory.length > 1
        ? `${wrtHistory.length} writing analyses recorded`
        : '0 analyses recorded',
    recentActivity: wrtHistory.length > 0 ? 'Analyzed text in history' : 'No writing analyses',
    trend: wrtTrend.trend,
    trendLabel: wrtTrend.trendLabel,
    recommendedAction: 'Submit a message or email in Writing Coach',
    targetView: 'writing',
    metrics: {
      'Grammar Accuracy': wrtAvgGrammar > 0 ? `${wrtAvgGrammar}%` : '—',
      'Vocab Quality': wrtAvgVocab > 0 ? `${wrtAvgVocab}%` : '—',
      'Analyses Count': wrtHistory.length || user.writingChecksCount || 0,
    },
  };

  // 3. Grammar Skill
  const grammarSummary = getGrammarWeaknessSummary(uid);
  const totalGrammarChecks = (user.grammarChecksCount || 0) + (generalSessions.filter((s) => s.type === 'grammar').length);
  const grammarMistakesCount = memory.grammarMistakes.length;
  // Calculate score if grammar checks exist
  let grammarScore: number | null = null;
  if (totalGrammarChecks > 0) {
    // Grounded score: starts at 85, deducts 3 per repeated weakness, min 60
    const repeatedCount = grammarSummary.filter((g) => g.isRepeatedWeakness).length;
    grammarScore = Math.max(60, Math.min(95, 88 - repeatedCount * 4));
  }

  const grammarSkill: SkillDetail = {
    skill: 'Grammar',
    hasEnoughData: totalGrammarChecks > 0,
    score: grammarScore,
    scoreLabel: grammarScore !== null ? `${grammarScore}/100` : 'Not enough data yet',
    evidenceCount: totalGrammarChecks,
    evidenceLabel:
      totalGrammarChecks === 1
        ? '1 grammar diagnostic performed'
        : totalGrammarChecks > 1
        ? `${totalGrammarChecks} grammar diagnostics performed`
        : '0 grammar checks',
    recentActivity: totalGrammarChecks > 0 ? `${grammarMistakesCount} error patterns cataloged` : 'No checks logged',
    trend: totalGrammarChecks === 1 ? 'first_session' : totalGrammarChecks > 1 ? 'steady' : 'insufficient_data',
    trendLabel: totalGrammarChecks === 1 ? 'Your first recorded session' : totalGrammarChecks > 1 ? 'Active tracking' : 'Not enough data yet',
    recommendedAction: grammarSummary.some((g) => g.isRepeatedWeakness)
      ? `Review ${grammarSummary.find((g) => g.isRepeatedWeakness)?.category} in Grammar Doctor`
      : 'Run a quick diagnostic check in Grammar Doctor',
    targetView: 'grammar',
    metrics: {
      'Diagnostics Run': totalGrammarChecks,
      'Patterns Logged': grammarMistakesCount,
      'Weakness Areas': grammarSummary.filter((g) => g.isRepeatedWeakness).length,
    },
  };

  // 4. Vocabulary Skill
  const masteredCount = vocabulary.filter((w) => w.isMastered).length || user.wordsMasteredCount || 0;
  const practicingCount = vocabulary.length - masteredCount;
  // Score is calculated if at least 1 word has been mastered
  let vocabScore: number | null = null;
  if (masteredCount > 0) {
    vocabScore = Math.min(100, Math.max(50, Math.round((masteredCount / Math.max(1, vocabulary.length)) * 100)));
  }

  const vocabSkill: SkillDetail = {
    skill: 'Vocabulary',
    hasEnoughData: masteredCount > 0,
    score: vocabScore,
    scoreLabel: vocabScore !== null ? `${vocabScore}/100` : 'Not enough data yet',
    evidenceCount: masteredCount,
    evidenceLabel: `${masteredCount} mastered words`,
    recentActivity: `${masteredCount} mastered • ${practicingCount} in practice`,
    trend: masteredCount >= 3 ? 'improving' : masteredCount === 1 ? 'first_session' : 'insufficient_data',
    trendLabel: masteredCount === 1 ? 'Your first recorded session' : masteredCount >= 3 ? 'Growing word bank' : 'Not enough data yet',
    recommendedAction: 'Practice and quiz 3 new words in Vocabulary Vault',
    targetView: 'vocabulary',
    metrics: {
      'Mastered Words': masteredCount,
      'In Practice': practicingCount,
      'Vault Total': vocabulary.length,
    },
  };

  // 5. Fluency Skill
  // Derived from spoken fluency scores and speech turns
  const fluencyScores = spkHistory.map((s) => s.fluencyScore || (s.wpm >= 100 && s.wpm <= 150 ? 85 : 70));
  const fluencyAvg = fluencyScores.length > 0 ? Math.round(fluencyScores.reduce((a, b) => a + b, 0) / fluencyScores.length) : null;
  const fluencyTrend = evaluateSessionTrend(fluencyScores);

  const fluencySkill: SkillDetail = {
    skill: 'Fluency',
    hasEnoughData: spkHistory.length > 0,
    score: fluencyAvg,
    scoreLabel: fluencyAvg !== null ? `${fluencyAvg}/100` : 'Not enough data yet',
    evidenceCount: spkHistory.length,
    evidenceLabel:
      spkHistory.length === 1
        ? '1 speaking assessment'
        : spkHistory.length > 1
        ? `${spkHistory.length} speaking assessments`
        : '0 speaking assessments',
    recentActivity: avgSpkWpm > 0 ? `Paced at ~${avgSpkWpm} WPM` : 'No pacing data',
    trend: fluencyTrend.trend,
    trendLabel: fluencyTrend.trendLabel,
    recommendedAction: 'Engage in conversational AI dialogue to build rhythm',
    targetView: 'conversation',
    metrics: {
      'Cadence': avgSpkWpm > 0 ? `${avgSpkWpm} WPM` : '—',
      'Assessed Turns': spkHistory.length,
    },
  };

  return {
    Speaking: speakingSkill,
    Writing: writingSkill,
    Grammar: grammarSkill,
    Vocabulary: vocabSkill,
    Fluency: fluencySkill,
  };
}

/**
 * Generate authentic educational Learning Insights based strictly on real stored data
 */
export function getLearningInsights(
  user: UserProfile,
  vocabulary: VocabularyWord[],
  challenges: DailyChallenge[]
): LearningInsight[] {
  const uid = user.uid || user.id || 'guest_user';
  const memory = loadLearningMemory(uid);
  const grammarSummary = getGrammarWeaknessSummary(uid);
  const masteredCount = vocabulary.filter((w) => w.isMastered).length;
  const insights: LearningInsight[] = [];

  const spkCount = memory.speakingHistory.length + (user.conversationsCount || 0);
  const wrtCount = memory.writingHistory.length + (user.writingChecksCount || 0);
  const grmCount = user.grammarChecksCount || 0;
  const totalActivities = spkCount + wrtCount + grmCount + masteredCount;

  // New user / zero activity
  if (totalActivities === 0) {
    insights.push({
      id: 'ins_welcome',
      type: 'info',
      title: 'Welcome to EnglishPro AI',
      description: 'Complete your first practice session to build your personal learning history and unlock skill analytics.',
    });
    return insights;
  }

  // 1. Practice focus insight
  if (spkCount > wrtCount && spkCount > grmCount) {
    insights.push({
      id: 'ins_focus_spk',
      type: 'habit',
      title: 'Speaking-Focused Routine',
      description: `Your recent practice has focused mostly on speaking (${spkCount} sessions recorded). Consider balancing with writing for comprehensive fluency.`,
      metric: `${spkCount} sessions`,
    });
  } else if (wrtCount > spkCount) {
    insights.push({
      id: 'ins_focus_wrt',
      type: 'habit',
      title: 'Writing-Focused Routine',
      description: `You have completed ${wrtCount} writing analyses. Add speaking exercises to reinforce your active verbal recall.`,
      metric: `${wrtCount} analyses`,
    });
  }

  // 2. Untapped skill insight
  if (wrtCount === 0 && (spkCount > 0 || grmCount > 0)) {
    insights.push({
      id: 'ins_no_wrt',
      type: 'focus_area',
      title: 'Writing Needs Practice',
      description: 'You have not practiced writing recently. Try submitting a short work email or paragraph in Writing Coach.',
    });
  } else if (spkCount === 0 && (wrtCount > 0 || grmCount > 0)) {
    insights.push({
      id: 'ins_no_spk',
      type: 'focus_area',
      title: 'Speaking Needs Practice',
      description: 'No vocal sessions recorded yet. Speaking aloud engages memory pathways faster than passive reading.',
    });
  }

  // 3. Repeated grammar weakness insight
  const repeated = grammarSummary.find((g) => g.isRepeatedWeakness);
  if (repeated) {
    insights.push({
      id: 'ins_grammar_rep',
      type: 'focus_area',
      title: `Grammar Focus: ${repeated.category}`,
      description: `${repeated.category} has appeared ${repeated.count} times in your grammar diagnostics. Spend 5 minutes reviewing this structure.`,
      metric: `${repeated.count} occurrences`,
    });
  }

  // 4. Vocabulary milestone insight
  if (masteredCount >= 5) {
    insights.push({
      id: 'ins_vocab_milestone',
      type: 'milestone',
      title: 'Vocabulary Growth',
      description: `You have mastered ${masteredCount} vocabulary words in your personal vault. Keep expanding your active lexicon.`,
      metric: `${masteredCount} mastered`,
    });
  }

  // 5. Streak insight
  if ((user.streakDays || 0) >= 3) {
    insights.push({
      id: 'ins_streak',
      type: 'strength',
      title: 'Consistent Habit',
      description: `You have maintained an unbroken ${user.streakDays}-day practice habit. Regular practice is the proven driver of English retention.`,
      metric: `${user.streakDays} days`,
    });
  }

  return insights.slice(0, 4);
}

/**
 * Output ONE primary Next Best Practice recommendation
 */
export function getNextBestPractice(
  user: UserProfile,
  vocabulary: VocabularyWord[],
  challenges: DailyChallenge[]
): NextBestPractice {
  const uid = user.uid || user.id || 'guest_user';
  const memory = loadLearningMemory(uid);
  const grammarSummary = getGrammarWeaknessSummary(uid);
  const masteredCount = vocabulary.filter((w) => w.isMastered).length;

  const spkCount = memory.speakingHistory.length + (user.conversationsCount || 0);
  const wrtCount = memory.writingHistory.length + (user.writingChecksCount || 0);
  const grmCount = user.grammarChecksCount || 0;
  const chgCount = memory.challengeHistory.length + (user.challengesCompletedCount || 0);
  const totalActivities = spkCount + wrtCount + grmCount + masteredCount + chgCount;
  const pendingChallenge = challenges.find((c) => !c.isCompleted);

  // 0. Insufficient data for new user
  if (totalActivities === 0 && grammarSummary.length === 0) {
    return {
      title: 'Start your daily learning plan',
      reason: 'Begin your daily practice routine to build your personal learning history.',
      targetView: 'dashboard',
      actionLabel: 'View Plan',
      category: 'general',
    };
  }

  // 1. Repeated grammar weakness has top priority
  const repeatedWeakness = grammarSummary.find((g) => g.isRepeatedWeakness);
  if (repeatedWeakness) {
    return {
      title: `Review ${repeatedWeakness.category}`,
      reason: `${repeatedWeakness.category} has appeared ${repeatedWeakness.count} times in your recent checks.`,
      targetView: 'grammar',
      actionLabel: 'Practice Grammar',
      topic: repeatedWeakness.category,
      category: 'grammar',
    };
  }

  // 2. If user goal is Speaking and speaking practice is low
  if ((user.learningGoal === 'Speaking' || user.primaryGoal === 'Speaking') && spkCount < 2) {
    return {
      title: 'Practice Speaking',
      reason: 'You have completed less speaking practice than your current learning goal.',
      targetView: 'speaking',
      actionLabel: 'Start Practice',
      category: 'speaking',
    };
  }

  // 3. If user goal is Writing and writing practice is low
  if ((user.learningGoal === 'Writing' || user.primaryGoal === 'Writing') && wrtCount < 2) {
    return {
      title: 'Complete a Writing Exercise',
      reason: 'Your primary focus is writing, but no recent writing analysis is logged.',
      targetView: 'writing',
      actionLabel: 'Analyze Writing',
      category: 'writing',
    };
  }

  // 4. Vocabulary reinforcement
  if (masteredCount < 5) {
    return {
      title: 'Learn 5 new vocabulary words',
      reason: 'Strengthen your core lexicon with high-frequency CEFR vocabulary.',
      targetView: 'vocabulary',
      actionLabel: 'Open Vault',
      category: 'vocabulary',
    };
  }

  // 5. Daily Challenge
  if (pendingChallenge) {
    return {
      title: 'Complete today’s challenge',
      reason: 'Finish your daily mission to preserve your unbroken practice streak.',
      targetView: 'challenges',
      actionLabel: 'Tackle Challenge',
      category: 'challenge',
    };
  }

  // 6. Default / New user
  return {
    title: 'Start your daily learning plan',
    reason: 'Begin your daily practice routine to build your personal learning history.',
    targetView: 'dashboard',
    actionLabel: 'View Plan',
    category: 'general',
  };
}
