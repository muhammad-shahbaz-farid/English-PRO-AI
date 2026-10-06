import React, { useState, useMemo } from 'react';
import {
  MessageCircle,
  Mic,
  PenLine,
  SpellCheck2,
  BookOpen,
  Languages,
  Target,
  Clock,
  Flame,
  Zap,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  SlidersHorizontal,
  Compass,
  AlertCircle,
} from 'lucide-react';
import { AppView, UserProfile, DailyChallenge, AppSettings, VocabularyWord } from '../types';
import { loadPracticeSessions, loadVocabulary } from '../utils/storage';
import {
  getTodaysLearningPlan,
  getLearningRecommendation,
  getLearningContext,
  togglePlanActivityCompleted,
} from '../utils/learningEngine';
import { getNextBestPractice } from '../utils/learningMemory';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { playChime } from '../utils/speech';

interface DashboardViewProps {
  user: UserProfile;
  challenges: DailyChallenge[];
  setCurrentView: (view: AppView) => void;
  settings: AppSettings;
  onOpenOnboarding?: () => void;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  challenges,
  setCurrentView,
  settings,
  onOpenOnboarding,
  onOpenLogin,
  onOpenSignup,
}) => {
  const [toggleKey, setToggleKey] = useState(0);
  const recentSessions = loadPracticeSessions();

  const ctx = useMemo(() => getLearningContext(user), [user, toggleKey]);
  const dailyPlan = useMemo(
    () => getTodaysLearningPlan(user, challenges),
    [user, challenges, toggleKey]
  );
  const recommendation = useMemo(
    () => getLearningRecommendation(user),
    [user, toggleKey]
  );
  const nextBestPractice = useMemo(() => {
    const vocab = loadVocabulary();
    return getNextBestPractice(user, vocab, challenges);
  }, [user, challenges, toggleKey]);

  const streakDays = user.streakDays || 0;
  const totalXp = user.totalXp || 0;
  const displayName = user.isLoggedIn && user.name ? user.name : 'Learner';

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleToggleActivity = (e: React.MouseEvent, activityId: string) => {
    e.stopPropagation();
    playChime('click');
    togglePlanActivityCompleted(user.uid || user.id, activityId);
    setToggleKey((prev) => prev + 1);
  };

  const practiceModules = [
    {
      id: 'practice-conversation',
      view: 'conversation' as AppView,
      title: 'AI Conversation',
      desc: 'Real-time interactive dialogues with speech corrections and contextual conversational feedback.',
      icon: MessageCircle,
      cta: 'Start Dialogue',
    },
    {
      id: 'practice-speaking',
      view: 'speaking' as AppView,
      title: 'Speaking Coach',
      desc: 'Voice recording with fluency metrics, WPM pacing, and pronunciation coaching.',
      icon: Mic,
      cta: 'Practice Voice',
    },
    {
      id: 'practice-writing',
      view: 'writing' as AppView,
      title: 'Writing Coach',
      desc: 'Three-tier sentence restructuring with style modes for professional and academic texts.',
      icon: PenLine,
      cta: 'Analyze Writing',
    },
  ];

  const skillModules = [
    {
      id: 'skill-grammar',
      view: 'grammar' as AppView,
      title: 'Grammar Doctor',
      desc: 'Instant diagnostic feedback on ESL errors, tenses, and prepositions with bilingual tips.',
      icon: SpellCheck2,
    },
    {
      id: 'skill-vocabulary',
      view: 'vocabulary' as AppView,
      title: 'Vocabulary',
      desc: 'Curated CEFR vocabulary flashcards with Urdu meanings, collocations, and retention drills.',
      icon: BookOpen,
    },
    {
      id: 'skill-translator',
      view: 'translator' as AppView,
      title: 'Translator',
      desc: 'Natural idiomatic translation with Roman Urdu transliterations and structural comparisons.',
      icon: Languages,
    },
    {
      id: 'skill-challenges',
      view: 'challenges' as AppView,
      title: 'Daily Challenges',
      desc: 'Targeted fluency quests across grammar, vocabulary, sentence correction, and quiz drills.',
      icon: Target,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header & Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-white/[0.07]">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-[#F5F7FA]">
              {getTimeGreeting()}, {displayName}
            </h1>
            <Badge variant="primary" size="sm">
              {ctx.englishLevel} ({ctx.cefrLevel})
            </Badge>
            <Badge variant="default" size="sm">
              Goal: {ctx.learningGoal}
            </Badge>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-500 dark:text-[#A8B0BA] max-w-xl leading-normal">
            {ctx.isNewUser
              ? "Welcome to EnglishPro AI. Let's build your English practice routine."
              : `Your personalized daily practice plan is calibrated for ${ctx.englishLevel} level and ${ctx.learningGoal} mastery.`}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          {onOpenOnboarding && (
            <Button
              id="dashboard-customize-plan-btn"
              onClick={onOpenOnboarding}
              variant="outline"
              size="sm"
              leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            >
              Adjust Goals
            </Button>
          )}
          <Button
            id="dashboard-start-conversation-btn"
            onClick={() => setCurrentView('conversation')}
            variant="primary"
            size="sm"
            leftIcon={<MessageCircle className="w-4 h-4" />}
          >
            Start Conversation
          </Button>
        </div>
      </div>

      {/* Guest Mode Call-to-Action Banner */}
      {(!user.isLoggedIn || user.isGuest) && (
        <div className="p-3.5 rounded-[12px] bg-[#6D6FF2]/10 dark:bg-[#6D6FF2]/15 border border-[#6D6FF2]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <Sparkles className="w-4 h-4 text-[#6D6FF2] shrink-0" />
            <p className="text-xs text-slate-700 dark:text-[#A8B0BA]">
              <span className="font-semibold text-slate-900 dark:text-[#F5F7FA]">You are currently in Guest Mode.</span> Create a free account or sign in to permanently save your learning memory, streaks, and progress across devices.
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {onOpenLogin && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenLogin}
                className="text-xs bg-white dark:bg-[#14181D]"
              >
                Sign In
              </Button>
            )}
            {onOpenSignup && (
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenSignup}
                className="text-xs"
              >
                Create Account
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Streak */}
        <div className="p-4 rounded-[12px] bg-white dark:bg-[#14181D] border border-slate-200/80 dark:border-white/[0.07] flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
              Day Streak
            </span>
            <Flame className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-[#F5F7FA]">
            {streakDays}
            <span className="text-xs font-normal text-slate-400 dark:text-[#727B87] ml-1">days</span>
          </div>
        </div>

        {/* Total XP */}
        <div className="p-4 rounded-[12px] bg-white dark:bg-[#14181D] border border-slate-200/80 dark:border-white/[0.07] flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-500">
            <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
              Total XP
            </span>
            <Zap className="w-4 h-4" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-[#F5F7FA]">
            {totalXp}
            <span className="text-xs font-normal text-slate-400 dark:text-[#727B87] ml-1">XP</span>
          </div>
        </div>

        {/* Today's Practice Progress */}
        <div className="p-4 rounded-[12px] bg-white dark:bg-[#14181D] border border-slate-200/80 dark:border-white/[0.07] flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
              Today's Practice
            </span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-[#F5F7FA]">
              {dailyPlan.todayPracticeMinutes}
              <span className="text-xs font-normal text-slate-400 dark:text-[#727B87] ml-1">
                / {dailyPlan.dailyGoalMinutes} min
              </span>
            </div>
          </div>
        </div>

        {/* Current Level & Goal */}
        <div className="p-4 rounded-[12px] bg-white dark:bg-[#14181D] border border-slate-200/80 dark:border-white/[0.07] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#6D6FF2]">
            <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
              Focus Goal
            </span>
            <Target className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <div className="text-base sm:text-lg font-semibold tracking-tight text-slate-900 dark:text-[#F5F7FA] truncate">
              {ctx.learningGoal}
            </div>
            <div className="text-[11px] text-slate-400 dark:text-[#727B87] truncate">
              Level: {ctx.englishLevel}
            </div>
          </div>
        </div>
      </div>

      {/* TODAY'S LEARNING PLAN (PERSONALIZED DAILY ENGINE) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-[#F5F7FA]">
                Today's Learning Plan
              </h2>
              <Badge variant={dailyPlan.completedCount === dailyPlan.totalCount ? 'success' : 'primary'} size="sm">
                {dailyPlan.completedCount}/{dailyPlan.totalCount} Done
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#A8B0BA] mt-0.5">
              Personalized tasks based on your {ctx.englishLevel} level and {ctx.learningGoal} target.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-[#A8B0BA]">
            <span>
              {dailyPlan.remainingCount === 0
                ? 'All goals completed today!'
                : `${dailyPlan.remainingCount} remaining`}
            </span>
            <div className="w-24 sm:w-32 bg-slate-200 dark:bg-white/[0.08] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#6D6FF2] h-full transition-all duration-300"
                style={{ width: `${dailyPlan.completionPercentage}%` }}
              />
            </div>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {dailyPlan.completionPercentage}%
            </span>
          </div>
        </div>

        {/* Plan Activity Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {dailyPlan.items.map((item) => (
            <Card
              key={item.id}
              hoverEffect
              className={`p-4 transition-all duration-150 flex flex-col justify-between ${
                item.isCompleted
                  ? 'border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/10'
                  : ''
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-[#A8B0BA]">
                      {item.category}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-[#727B87] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {item.estimatedMinutes} min
                    </span>
                  </div>

                  <Badge
                    variant={item.priority === 'high' ? 'primary' : 'default'}
                    size="sm"
                  >
                    {item.priority === 'high' ? 'High Priority' : 'Recommended'}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA] flex items-center gap-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-[#A8B0BA] mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="text-[11px] text-slate-400 dark:text-[#727B87] italic">
                  {item.reason}
                </div>
              </div>

              <div className="pt-3.5 mt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => handleToggleActivity(e, item.id)}
                  className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-[#A8B0BA] hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                  title="Mark completion status"
                >
                  {item.isCompleted ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Completed</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      <span>Mark done</span>
                    </>
                  )}
                </button>

                <Button
                  size="sm"
                  variant={item.isCompleted ? 'secondary' : 'primary'}
                  onClick={() => setCurrentView(item.targetView)}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  {item.isCompleted ? 'Practice Again' : 'Start Practice'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* RECOMMENDED NEXT (COMPACT SECTION) */}
      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-[#727B87] flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-[#6D6FF2]" />
          Recommended Next
        </div>

        <Card className="p-4 sm:p-5 border-l-4 border-l-[#6D6FF2]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA]">
                  {nextBestPractice.title}
                </span>
                {nextBestPractice.topic && (
                  <Badge variant="primary" size="sm">
                    {nextBestPractice.topic}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-[#A8B0BA] leading-relaxed">
                "{nextBestPractice.reason}"
              </p>
            </div>

            <Button
              id="dashboard-recommended-next-btn"
              variant="primary"
              size="sm"
              onClick={() => setCurrentView(nextBestPractice.targetView)}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              className="shrink-0"
            >
              {nextBestPractice.actionLabel}
            </Button>
          </div>
        </Card>
      </div>

      {/* Practice Modules */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
          Practice Modules
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {practiceModules.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.id}
                hoverEffect
                className="p-5 cursor-pointer flex flex-col justify-between"
                onClick={() => setCurrentView(item.view)}
              >
                <div className="space-y-3">
                  <div className="w-9 h-9 rounded-[9px] bg-slate-100 dark:bg-[#181D23] border border-slate-200 dark:border-white/[0.08] text-[#6D6FF2] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA]">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-[#A8B0BA] mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
                <div className="pt-4 mt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-xs font-medium text-[#6D6FF2]">
                  <span>{item.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Improve Your Skills */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
          Improve Your Skills
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {skillModules.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.id}
                hoverEffect
                className="p-4 cursor-pointer flex flex-col justify-between"
                onClick={() => setCurrentView(item.view)}
              >
                <div className="space-y-2.5">
                  <div className="w-8 h-8 rounded-[8px] bg-slate-100 dark:bg-[#181D23] border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-[#A8B0BA] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-slate-900 dark:text-[#F5F7FA]">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-[#727B87] mt-1 leading-relaxed line-clamp-3">
                      {item.desc}
                    </p>
                  </div>
                </div>
                <div className="pt-3 mt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-[#A8B0BA] group-hover:text-[#6D6FF2]">
                  <span>Open tool</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
            Recent Activity
          </span>
          <button
            onClick={() => setCurrentView('progress')}
            className="text-xs text-[#6D6FF2] hover:underline cursor-pointer"
          >
            View Analytics
          </button>
        </div>

        {recentSessions.length > 0 ? (
          <Card>
            <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {recentSessions.slice(0, 3).map((sess) => (
                <div
                  key={sess.id}
                  className="p-3.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-7 h-7 rounded-[7px] bg-slate-100 dark:bg-[#181D23] text-[#6D6FF2] flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-[#F5F7FA] truncate">
                        {sess.title}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-[#727B87] truncate">
                        {sess.durationMinutes}m duration • {sess.summary}
                      </p>
                    </div>
                  </div>
                  {sess.xpEarned > 0 && (
                    <Badge variant="success" size="sm">
                      +{sess.xpEarned} XP
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-6 text-center space-y-2">
            <p className="text-xs text-slate-500 dark:text-[#A8B0BA]">
              No practice sessions recorded yet. Start any activity above to log your first session.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
