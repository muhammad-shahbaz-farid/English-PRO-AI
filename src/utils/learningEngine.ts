import {
  UserProfile,
  CEFRLevel,
  SimplifiedLevel,
  LearningGoal,
  AppView,
  DailyChallenge,
  PracticeSessionRecord,
} from '../types';
import { loadPracticeSessions } from './storage';

export interface LearningContext {
  englishLevel: SimplifiedLevel;
  cefrLevel: CEFRLevel;
  learningGoal: LearningGoal;
  dailyGoalMinutes: number;
  todayPracticeMinutes: number;
  speakingSessionsCount: number;
  writingChecksCount: number;
  grammarChecksCount: number;
  wordsMasteredCount: number;
  challengesCompletedCount: number;
  recentGrammarMistakes: string[];
  totalActivitiesCount: number;
  isNewUser: boolean;
}

export interface PlanActivityItem {
  id: string;
  title: string;
  category: 'Speaking' | 'Writing' | 'Grammar' | 'Vocabulary' | 'Challenge' | 'Conversation';
  description: string;
  estimatedMinutes: number;
  targetView: AppView;
  isCompleted: boolean;
  priority: 'high' | 'recommended' | 'optional';
  reason: string;
  xpReward: number;
}

export interface DailyPlanSummary {
  items: PlanActivityItem[];
  completedCount: number;
  totalCount: number;
  remainingCount: number;
  completionPercentage: number;
  todayPracticeMinutes: number;
  dailyGoalMinutes: number;
}

export interface LearningRecommendation {
  title: string;
  description: string;
  reason: string;
  targetView: AppView;
  actionLabel: string;
  isNeutralEmptyState: boolean;
  category: 'speaking' | 'writing' | 'grammar' | 'vocabulary' | 'challenge' | 'general';
}

/**
 * Maps CEFR level to 3-tier SimplifiedLevel
 */
export function cefrToSimplifiedLevel(cefr?: CEFRLevel): SimplifiedLevel {
  switch (cefr) {
    case 'A1':
    case 'A2':
      return 'Beginner';
    case 'C1':
    case 'C2':
      return 'Advanced';
    case 'B1':
    case 'B2':
    default:
      return 'Intermediate';
  }
}

/**
 * Maps SimplifiedLevel to CEFRLevel
 */
export function simplifiedToCefrLevel(level: SimplifiedLevel): CEFRLevel {
  switch (level) {
    case 'Beginner':
      return 'A2';
    case 'Advanced':
      return 'C1';
    case 'Intermediate':
    default:
      return 'B1';
  }
}

/**
 * Gets formatted today date YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Record grammar error category in educational context (no personal data)
 */
export function recordGrammarMistakesContext(uid: string, errors: string[]) {
  if (!errors || errors.length === 0) return;
  try {
    const key = `englishpro_grammar_ctx_${uid || 'guest_user'}`;
    const raw = localStorage.getItem(key);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const sanitized = errors.map((e) => e.trim()).filter(Boolean);
    const merged = Array.from(new Set([...sanitized, ...existing])).slice(0, 10);
    localStorage.setItem(key, JSON.stringify(merged));
  } catch (e) {
    console.error('Failed to save grammar mistakes context', e);
  }
}

/**
 * Retrieve educational grammar mistake history
 */
export function getGrammarMistakesContext(uid: string): string[] {
  try {
    const key = `englishpro_grammar_ctx_${uid || 'guest_user'}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to get grammar mistakes context', e);
  }
  return [];
}

/**
 * Load completed plan items for today
 */
function getCompletedPlanItemIds(uid: string): string[] {
  try {
    const today = getTodayDateString();
    const key = `englishpro_plan_completed_${uid || 'guest_user'}_${today}`;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load completed plan items', e);
  }
  return [];
}

/**
 * Save completed plan item ID for today (does NOT award duplicate XP)
 */
export function togglePlanActivityCompleted(uid: string, activityId: string): boolean {
  try {
    const today = getTodayDateString();
    const key = `englishpro_plan_completed_${uid || 'guest_user'}_${today}`;
    const existing = getCompletedPlanItemIds(uid);
    let updated: string[];
    let isNowCompleted = false;

    if (existing.includes(activityId)) {
      updated = existing.filter((id) => id !== activityId);
      isNowCompleted = false;
    } else {
      updated = [...existing, activityId];
      isNowCompleted = true;
    }

    localStorage.setItem(key, JSON.stringify(updated));
    return isNowCompleted;
  } catch (e) {
    console.error('Failed to toggle plan activity', e);
    return false;
  }
}

/**
 * Builds learning context for the current user based strictly on real activity
 */
export function getLearningContext(user: UserProfile): LearningContext {
  const uid = user.uid || user.id || 'guest_user';
  const simplifiedLevel = user.simplifiedLevel || cefrToSimplifiedLevel(user.englishLevel || user.targetLevel || 'B1');
  const cefrLevel = user.englishLevel || user.targetLevel || simplifiedToCefrLevel(simplifiedLevel);
  const learningGoal = user.learningGoal || user.primaryGoal || 'General English';
  const dailyGoalMinutes = user.dailyPracticeGoal || user.dailyGoalMinutes || 15;

  // Filter today's practice sessions
  const sessions = loadPracticeSessions();
  const todayStr = getTodayDateString();
  const todaySessions = sessions.filter((s) => s.timestamp && s.timestamp.startsWith(todayStr));
  const todayPracticeMinutes = todaySessions.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

  const speakingSessionsCount = (user.speakingSessionsCount || 0) + (user.conversationsCount || 0);
  const writingChecksCount = user.writingChecksCount || 0;
  const grammarChecksCount = user.grammarChecksCount || 0;
  const wordsMasteredCount = user.wordsMasteredCount || 0;
  const challengesCompletedCount = user.challengesCompletedCount || 0;
  const recentGrammarMistakes = getGrammarMistakesContext(uid);

  const totalActivitiesCount =
    speakingSessionsCount +
    writingChecksCount +
    grammarChecksCount +
    wordsMasteredCount +
    challengesCompletedCount +
    recentGrammarMistakes.length +
    sessions.length;

  const isNewUser = totalActivitiesCount === 0;

  return {
    englishLevel: simplifiedLevel,
    cefrLevel,
    learningGoal,
    dailyGoalMinutes,
    todayPracticeMinutes,
    speakingSessionsCount,
    writingChecksCount,
    grammarChecksCount,
    wordsMasteredCount,
    challengesCompletedCount,
    recentGrammarMistakes,
    totalActivitiesCount,
    isNewUser,
  };
}

/**
 * Generates personalized "Today's Learning Plan" based on user's real level, goal and recent activity
 */
export function getTodaysLearningPlan(user: UserProfile, challenges: DailyChallenge[]): DailyPlanSummary {
  const ctx = getLearningContext(user);
  const uid = user.uid || user.id || 'guest_user';
  const manualCompletedIds = getCompletedPlanItemIds(uid);

  // Check today's real sessions from storage
  const sessions = loadPracticeSessions();
  const todayStr = getTodayDateString();
  const todaySessions = sessions.filter((s) => s.timestamp && s.timestamp.startsWith(todayStr));

  const hasSpeakingSessionToday = todaySessions.some(
    (s) => s.type === 'conversation' || s.title.toLowerCase().includes('speaking') || s.title.toLowerCase().includes('voice')
  );
  const hasWritingSessionToday = todaySessions.some(
    (s) => s.type === 'grammar' && (s.title.toLowerCase().includes('writing') || s.summary.toLowerCase().includes('writing'))
  );
  const hasGrammarSessionToday = todaySessions.some(
    (s) => s.type === 'grammar' && !s.title.toLowerCase().includes('writing')
  );
  const hasVocabSessionToday = todaySessions.some((s) => s.type === 'vocabulary');
  const hasChallengeSessionToday =
    todaySessions.some((s) => s.type === 'challenge') ||
    challenges.some((c) => c.isCompleted);

  const activeChallenge = challenges.find((c) => !c.isCompleted) || challenges[0];

  // Build personalized activities
  const planItems: PlanActivityItem[] = [];

  // Primary Goal Activity
  if (ctx.learningGoal === 'Speaking' || ctx.learningGoal === 'Everyday Fluency') {
    planItems.push({
      id: 'plan_speaking_core',
      title: 'Speaking Fluency Drill',
      category: 'Speaking',
      description:
        ctx.englishLevel === 'Beginner'
          ? 'Record simple daily answers and practice vocal clarity with Speaking Coach.'
          : ctx.englishLevel === 'Advanced'
          ? 'Deliver a structured 60-second impromptu speech and assess WPM pacing.'
          : 'Practice speaking out loud to test conversational fluency and filler-word rate.',
      estimatedMinutes: 5,
      targetView: 'speaking',
      isCompleted: hasSpeakingSessionToday || manualCompletedIds.includes('plan_speaking_core'),
      priority: 'high',
      reason: `Aligned with your primary goal: ${ctx.learningGoal}`,
      xpReward: 30,
    });
  } else if (ctx.learningGoal === 'Writing' || ctx.learningGoal === 'Academic') {
    planItems.push({
      id: 'plan_writing_core',
      title: 'Structured Writing Analysis',
      category: 'Writing',
      description:
        ctx.englishLevel === 'Beginner'
          ? 'Submit a short sentence or message to verify basic punctuation and tense.'
          : ctx.englishLevel === 'Advanced'
          ? 'Analyze an academic or professional excerpt for formal tone and conciseness.'
          : 'Refine paragraph flow, subject-verb agreement, and professional vocabulary.',
      estimatedMinutes: 5,
      targetView: 'writing',
      isCompleted: hasWritingSessionToday || manualCompletedIds.includes('plan_writing_core'),
      priority: 'high',
      reason: `Aligned with your primary goal: ${ctx.learningGoal}`,
      xpReward: 30,
    });
  } else if (ctx.learningGoal === 'Grammar') {
    planItems.push({
      id: 'plan_grammar_core',
      title: 'Grammar Doctor Diagnosis',
      category: 'Grammar',
      description:
        ctx.englishLevel === 'Beginner'
          ? 'Review common mistakes in past tense and prepositions with bilingual Urdu tips.'
          : 'Diagnose complex sentence structure and eliminate recurring grammatical errors.',
      estimatedMinutes: 4,
      targetView: 'grammar',
      isCompleted: hasGrammarSessionToday || manualCompletedIds.includes('plan_grammar_core'),
      priority: 'high',
      reason: `Aligned with your primary goal: ${ctx.learningGoal}`,
      xpReward: 25,
    });
  } else if (ctx.learningGoal === 'Vocabulary') {
    planItems.push({
      id: 'plan_vocab_core',
      title: 'Target Vocabulary Acquisition',
      category: 'Vocabulary',
      description: `Master 3 high-yield CEFR ${ctx.cefrLevel} words with Urdu explanations, examples, and quiz retention.`,
      estimatedMinutes: 4,
      targetView: 'vocabulary',
      isCompleted: hasVocabSessionToday || manualCompletedIds.includes('plan_vocab_core'),
      priority: 'high',
      reason: `Aligned with your primary goal: ${ctx.learningGoal}`,
      xpReward: 25,
    });
  } else {
    // General English / Workplace / Travel
    planItems.push({
      id: 'plan_conversation_core',
      title: 'Interactive AI Roleplay',
      category: 'Conversation',
      description:
        ctx.learningGoal === 'Workplace & Career'
          ? 'Practice a professional meeting or interview scenario with instant feedback.'
          : 'Hold an open-ended conversational exchange with immediate speech corrections.',
      estimatedMinutes: 5,
      targetView: 'conversation',
      isCompleted: hasSpeakingSessionToday || manualCompletedIds.includes('plan_conversation_core'),
      priority: 'high',
      reason: `Tailored for ${ctx.learningGoal}`,
      xpReward: 35,
    });
  }

  // Complementary Skill Activity 1 (Vocabulary or Grammar)
  if (ctx.learningGoal !== 'Vocabulary') {
    planItems.push({
      id: 'plan_vocab_boost',
      title: 'Vocabulary Vault Drill',
      category: 'Vocabulary',
      description: `Review flashcards in ${ctx.cefrLevel} tier to strengthen active vocabulary retention.`,
      estimatedMinutes: 3,
      targetView: 'vocabulary',
      isCompleted: hasVocabSessionToday || manualCompletedIds.includes('plan_vocab_boost'),
      priority: 'recommended',
      reason: 'Complementary word power enhancement',
      xpReward: 20,
    });
  } else {
    planItems.push({
      id: 'plan_speaking_boost',
      title: 'Verbal Word Application',
      category: 'Speaking',
      description: 'Use your newly acquired vocabulary words in a recorded speaking session.',
      estimatedMinutes: 4,
      targetView: 'speaking',
      isCompleted: hasSpeakingSessionToday || manualCompletedIds.includes('plan_speaking_boost'),
      priority: 'recommended',
      reason: 'Reinforces vocabulary through spoken recall',
      xpReward: 25,
    });
  }

  // Daily Challenge Activity
  planItems.push({
    id: 'plan_daily_challenge',
    title: activeChallenge?.title || 'Daily Language Mission',
    category: 'Challenge',
    description: activeChallenge?.description || 'Complete today’s targeted quest to maintain streak consistency.',
    estimatedMinutes: 3,
    targetView: 'challenges',
    isCompleted: hasChallengeSessionToday || manualCompletedIds.includes('plan_daily_challenge'),
    priority: 'recommended',
    reason: 'Daily streak & habit reinforcement',
    xpReward: activeChallenge?.xpReward || 25,
  });

  // Complementary Skill Activity 2 (Active Production)
  if (ctx.learningGoal === 'Speaking') {
    planItems.push({
      id: 'plan_grammar_check',
      title: 'Quick Grammar Check',
      category: 'Grammar',
      description: 'Check a quick sentence in Grammar Doctor to solidify correct phrase construction.',
      estimatedMinutes: 3,
      targetView: 'grammar',
      isCompleted: hasGrammarSessionToday || manualCompletedIds.includes('plan_grammar_check'),
      priority: 'optional',
      reason: 'Prevents spoken grammar errors from repeating',
      xpReward: 20,
    });
  } else {
    planItems.push({
      id: 'plan_voice_check',
      title: 'Speaking Confidence Check',
      category: 'Speaking',
      description: 'Record a 30-second speech response to exercise verbal pronunciation.',
      estimatedMinutes: 3,
      targetView: 'speaking',
      isCompleted: hasSpeakingSessionToday || manualCompletedIds.includes('plan_voice_check'),
      priority: 'optional',
      reason: 'Balances written study with spoken articulation',
      xpReward: 20,
    });
  }

  const completedCount = planItems.filter((i) => i.isCompleted).length;
  const totalCount = planItems.length;
  const remainingCount = totalCount - completedCount;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    items: planItems,
    completedCount,
    totalCount,
    remainingCount,
    completionPercentage,
    todayPracticeMinutes: ctx.todayPracticeMinutes,
    dailyGoalMinutes: ctx.dailyGoalMinutes,
  };
}

/**
 * Computes an honest, data-grounded Learning Recommendation based on real activity
 */
export function getLearningRecommendation(user: UserProfile): LearningRecommendation {
  const ctx = getLearningContext(user);

  // 1. Recommend Grammar Doctor if recent grammar mistakes were detected
  if (ctx.recentGrammarMistakes && ctx.recentGrammarMistakes.length > 0) {
    const errorList = ctx.recentGrammarMistakes.slice(0, 2).join(' & ');
    return {
      title: 'Grammar Doctor Recommendation',
      description: `Recent grammar review detected patterns in ${errorList}. Spend 4 minutes in Grammar Doctor to solidify the correct structures.`,
      reason: `Targeting recent grammar patterns: ${errorList}`,
      targetView: 'grammar',
      actionLabel: 'Diagnose Grammar',
      isNeutralEmptyState: false,
      category: 'grammar',
    };
  }

  // 2. Clean neutral recommendation if no recorded user activity
  if (ctx.isNewUser) {
    let targetView: AppView = 'speaking';
    if (ctx.learningGoal === 'Writing' || ctx.learningGoal === 'Academic') targetView = 'writing';
    else if (ctx.learningGoal === 'Grammar') targetView = 'grammar';
    else if (ctx.learningGoal === 'Vocabulary') targetView = 'vocabulary';
    else if (ctx.learningGoal === 'General English' || ctx.learningGoal === 'Workplace & Career') targetView = 'conversation';

    return {
      title: 'Start your first practice session',
      description:
        'Welcome to EnglishPro AI. Build your English practice routine by completing your personalized daily plan.',
      reason: 'Account initialized • Set your foundational practice routine',
      targetView,
      actionLabel: 'Begin Practice',
      isNeutralEmptyState: true,
      category: 'general',
    };
  }

  // 3. Evaluate real activity distribution
  const speakingCount = ctx.speakingSessionsCount;
  const writingCount = ctx.writingChecksCount;
  const vocabCount = ctx.wordsMasteredCount;
  const grammarCount = ctx.grammarChecksCount;

  // If primary goal is Speaking and speaking activity is low
  if ((ctx.learningGoal === 'Speaking' || ctx.learningGoal === 'Everyday Fluency') && speakingCount <= 1) {
    return {
      title: 'Speaking Coach Recommendation',
      description:
        'Your primary goal is Speaking, but your recorded speaking practice is low. Practice a short voice prompt to track your fluency and pace.',
      reason: 'Speaking volume is low relative to your primary goal',
      targetView: 'speaking',
      actionLabel: 'Practice Voice',
      isNeutralEmptyState: false,
      category: 'speaking',
    };
  }

  // If primary goal is Writing and writing activity is low
  if ((ctx.learningGoal === 'Writing' || ctx.learningGoal === 'Academic') && writingCount <= 1) {
    return {
      title: 'Writing Coach Recommendation',
      description:
        'Your primary focus is Writing. Analyze an email draft or paragraph in Writing Coach to review clarity, tone, and conciseness.',
      reason: 'Writing checks count is low relative to your primary goal',
      targetView: 'writing',
      actionLabel: 'Analyze Writing',
      isNeutralEmptyState: false,
      category: 'writing',
    };
  }

  // Identify skill with the lowest activity count
  const counts = [
    { type: 'speaking', count: speakingCount, view: 'speaking' as AppView, name: 'Speaking Coach', verb: 'Record voice response' },
    { type: 'writing', count: writingCount, view: 'writing' as AppView, name: 'Writing Coach', verb: 'Analyze text draft' },
    { type: 'vocabulary', count: vocabCount, view: 'vocabulary' as AppView, name: 'Vocabulary', verb: 'Master new words' },
    { type: 'grammar', count: grammarCount, view: 'grammar' as AppView, name: 'Grammar Doctor', verb: 'Check grammar' },
  ];

  counts.sort((a, b) => a.count - b.count);
  const lowest = counts[0];

  if (lowest.type === 'speaking') {
    return {
      title: 'Speaking Coach Recommendation',
      description:
        'Speaking activity is low. Speaking aloud engages memory pathways faster than passive reading. Record a 1-minute vocal response.',
      reason: `Speaking count (${speakingCount}) is your lowest active skill`,
      targetView: 'speaking',
      actionLabel: 'Open Speaking Coach',
      isNeutralEmptyState: false,
      category: 'speaking',
    };
  }

  if (lowest.type === 'vocabulary') {
    return {
      title: 'Vocabulary Recommendation',
      description:
        'Vocabulary activity is low. Add 3 new words to your mastered vocabulary vault to expand your descriptive range.',
      reason: `Words mastered (${vocabCount}) is currently low`,
      targetView: 'vocabulary',
      actionLabel: 'Open Vocabulary',
      isNeutralEmptyState: false,
      category: 'vocabulary',
    };
  }

  if (lowest.type === 'writing') {
    return {
      title: 'Writing Coach Recommendation',
      description:
        'Writing practice is low. Test a sentence or work message to review three-tier structural improvements and tone options.',
      reason: `Writing checks (${writingCount}) is currently low`,
      targetView: 'writing',
      actionLabel: 'Open Writing Coach',
      isNeutralEmptyState: false,
      category: 'writing',
    };
  }

  // Default to Grammar Doctor
  return {
    title: 'Grammar Doctor Recommendation',
    description:
      'Grammar activity is low. Run a quick check on common sentence pitfalls to ensure flawless structure in your communication.',
    reason: `Grammar checks (${grammarCount}) is currently low`,
    targetView: 'grammar',
    actionLabel: 'Open Grammar Doctor',
    isNeutralEmptyState: false,
    category: 'grammar',
  };
}
