import React, { useMemo } from 'react';
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  Flame,
  Zap,
  BookOpen,
  ShieldCheck,
  Lock,
  Mic,
  PenTool,
  Award,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Info,
  Calendar,
  Layers,
  Activity,
  Compass,
} from 'lucide-react';
import { UserProfile, DailyChallenge, VocabularyWord, AppView } from '../types';
import { loadPracticeSessions } from '../utils/storage';
import {
  loadLearningMemory,
  getSkillAnalytics,
  getGrammarWeaknessSummary,
  getLearningInsights,
  SkillDetail,
} from '../utils/learningMemory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';

interface ProgressViewProps {
  user: UserProfile;
  challenges: DailyChallenge[];
  vocabulary: VocabularyWord[];
  setCurrentView?: (view: AppView) => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({
  user,
  challenges,
  vocabulary,
  setCurrentView,
}) => {
  const uid = user.uid || user.id || 'guest_user';
  const memory = useMemo(() => loadLearningMemory(uid), [uid]);
  const recentSessions = useMemo(() => loadPracticeSessions(), [uid]);

  const skillAnalytics = useMemo(
    () => getSkillAnalytics(user, vocabulary, challenges),
    [user, vocabulary, challenges, memory]
  );

  const grammarWeaknesses = useMemo(
    () => getGrammarWeaknessSummary(uid),
    [uid, memory]
  );

  const insights = useMemo(
    () => getLearningInsights(user, vocabulary, challenges),
    [user, vocabulary, challenges, memory]
  );

  const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const currentLevelIndex = cefrLevels.indexOf(user.englishLevel || user.targetLevel || 'B1');
  const masteredCount = vocabulary.filter((w) => w.isMastered).length;

  const spkHistory = memory.speakingHistory || [];
  const wrtHistory = memory.writingHistory || [];

  // Badges evaluated from real user stats
  const badges = [
    {
      id: 'b1',
      title: 'Voice Unlocked',
      desc: 'Completed speaking practice session',
      icon: Mic,
      unlocked: (user.conversationsCount || 0) > 0 || spkHistory.length > 0,
      color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60',
    },
    {
      id: 'b2',
      title: 'Grammar Virtuoso',
      desc: 'Analyzed & corrected 5+ sentences',
      icon: ShieldCheck,
      unlocked: (user.grammarChecksCount || 0) >= 5,
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60',
    },
    {
      id: 'b3',
      title: 'Word Collector',
      desc: 'Mastered 10 high-impact CEFR words',
      icon: BookOpen,
      unlocked: masteredCount >= 10,
      color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60',
    },
    {
      id: 'b4',
      title: 'Consistent Fire',
      desc: 'Maintained a 3+ day unbroken streak',
      icon: Flame,
      unlocked: (user.streakDays || 0) >= 3,
      color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60',
    },
    {
      id: 'b5',
      title: 'Fluency Champion',
      desc: 'Earn 500 Total Fluency XP through practice',
      icon: Award,
      unlocked: (user.totalXp || 0) >= 500,
      color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60',
    },
  ];

  // Whether enough data exists for historical progress
  const hasSpeakingTrendData = spkHistory.length >= 2;
  const hasWritingTrendData = wrtHistory.length >= 2;
  const hasAnyTrendData = hasSpeakingTrendData || hasWritingTrendData;

  const skillsList: SkillDetail[] = [
    skillAnalytics.Speaking,
    skillAnalytics.Writing,
    skillAnalytics.Grammar,
    skillAnalytics.Vocabulary,
    skillAnalytics.Fluency,
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-9">
      {/* Header */}
      <PageHeader
        icon={TrendingUp}
        title="Learning Memory & Skill Analytics"
        description="Grounded proficiency metrics, recurring grammar patterns, and verifiable progress history."
        badge="Analytics"
        actions={
          <div className="flex items-center space-x-2">
            <Badge variant="primary" size="md">
              Level: {user.englishLevel || user.targetLevel || 'B1'}
            </Badge>
            <Badge variant="default" size="md">
              Focus: {user.learningGoal || user.primaryGoal || 'Speaking'}
            </Badge>
          </div>
        }
      />

      {/* SECTION 8: YOUR ENGLISH SKILLS (5-SKILL MODEL) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-[#F5F7FA]">
              Your English Skills
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#A8B0BA]">
              Every score reflects genuine activity evidence. Skills without enough sessions are labeled accordingly.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skillsList.map((skill) => {
            const hasData = skill.hasEnoughData && skill.score !== null;
            return (
              <Card
                key={skill.skill}
                hoverEffect
                className="p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
                      {skill.skill}
                    </span>
                    <Badge
                      variant={
                        skill.trend === 'improving'
                          ? 'success'
                          : skill.trend === 'first_session'
                          ? 'primary'
                          : 'default'
                      }
                      size="sm"
                    >
                      {skill.trendLabel}
                    </Badge>
                  </div>

                  <div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-[#F5F7FA]">
                        {skill.scoreLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-[#A8B0BA] mt-0.5">
                      {skill.evidenceLabel}
                    </p>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] text-xs">
                    {Object.entries(skill.metrics).map(([key, value]) => (
                      <div key={key} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.03]">
                        <span className="text-[10px] text-slate-400 dark:text-[#727B87] block">
                          {key}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-[#F5F7FA] mt-0.5 block truncate">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-[#A8B0BA] italic pt-1">
                    Activity: {skill.recentActivity}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 dark:text-[#727B87] truncate max-w-[180px]">
                    {skill.recommendedAction}
                  </span>
                  {setCurrentView && (
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => setCurrentView(skill.targetView)}
                      rightIcon={<ArrowRight className="w-3 h-3" />}
                    >
                      Practice
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* SECTION 9: LEARNING INSIGHTS */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#6D6FF2]" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-[#F5F7FA]">
            Learning Insights
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {insights.map((insight) => (
            <Card key={insight.id} className="p-4 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-[#F5F7FA]">
                    {insight.title}
                  </span>
                  {insight.metric && (
                    <Badge variant="primary" size="sm">
                      {insight.metric}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-[#A8B0BA] leading-relaxed">
                  {insight.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* SECTION 5: GRAMMAR WEAKNESS DETECTION */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-[#F5F7FA] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#6D6FF2]" />
              Grammar Weakness Detection
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#A8B0BA]">
              Cataloged patterns from Grammar Doctor and Writing Coach. Repeated errors are flagged for deliberate practice.
            </p>
          </div>
        </div>

        {grammarWeaknesses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {grammarWeaknesses.map((item) => (
              <Card
                key={item.category}
                className={`p-4 transition-all ${
                  item.isRepeatedWeakness
                    ? 'border-amber-500/40 bg-amber-50/10 dark:bg-amber-950/10'
                    : ''
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 dark:text-[#F5F7FA]">
                      {item.category}
                    </span>
                    <Badge
                      variant={item.isRepeatedWeakness ? 'warning' : 'default'}
                      size="sm"
                    >
                      {item.isRepeatedWeakness
                        ? `Repeated Practice Area (${item.count}x)`
                        : `${item.count} occurrence`}
                    </Badge>
                  </div>

                  {item.examples.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.03] space-y-1 text-xs">
                      <div className="text-slate-500 dark:text-[#A8B0BA]">
                        <span className="text-rose-500 font-medium">Slip:</span> "{item.examples[0].original}"
                      </div>
                      <div className="text-slate-700 dark:text-[#F5F7FA]">
                        <span className="text-emerald-500 font-medium">Correction:</span> "{item.examples[0].correction}"
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400 dark:text-[#727B87]">
                      {item.isRepeatedWeakness
                        ? 'Repeated pattern identified'
                        : 'Single error cataloged'}
                    </span>
                    {setCurrentView && (
                      <Button
                        size="xs"
                        variant={item.isRepeatedWeakness ? 'primary' : 'outline'}
                        onClick={() => setCurrentView('grammar')}
                        rightIcon={<ArrowRight className="w-3 h-3" />}
                      >
                        Practice this topic
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center space-y-1.5">
            <ShieldCheck className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-800 dark:text-[#F5F7FA]">
              No grammar weaknesses cataloged yet
            </p>
            <p className="text-xs text-slate-500 dark:text-[#A8B0BA] max-w-md mx-auto">
              Run checks in Grammar Doctor or Writing Coach to diagnose sentence construction and syntax habits.
            </p>
          </Card>
        )}
      </div>

      {/* SECTION 12: PROGRESS HISTORY */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#6D6FF2]" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-[#F5F7FA]">
            Progress History
          </h2>
        </div>

        {hasAnyTrendData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Speaking History */}
            {hasSpeakingTrendData && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F5F7FA]">
                    Speaking Score & Pace History
                  </h3>
                  <Badge variant="primary" size="sm">
                    {spkHistory.length} Sessions
                  </Badge>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                  {spkHistory.slice(0, 4).map((s) => (
                    <div key={s.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-[#F5F7FA]">
                          Score: {s.overallScore}%
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-[#727B87] ml-2">
                          {s.wpm} WPM • {s.wordCount} words
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(s.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Writing History */}
            {hasWritingTrendData && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900 dark:text-[#F5F7FA]">
                    Writing Score History
                  </h3>
                  <Badge variant="primary" size="sm">
                    {wrtHistory.length} Analyses
                  </Badge>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.06] text-xs">
                  {wrtHistory.slice(0, 4).map((w) => (
                    <div key={w.id} className="py-2 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-[#F5F7FA]">
                          Score: {w.overallScore}%
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-[#727B87] ml-2">
                          Grammar: {w.grammarScore}% • Vocab: {w.vocabularyScore}%
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(w.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <Card className="p-6 text-center space-y-1.5">
            <Clock className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-800 dark:text-[#F5F7FA]">
              Keep practicing to build your progress history
            </p>
            <p className="text-xs text-slate-500 dark:text-[#A8B0BA] max-w-md mx-auto">
              Progress trends and historical curves are rendered once at least two recorded sessions exist.
            </p>
          </Card>
        )}
      </div>

      {/* CEFR Level Ladder Card */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3">
          <div>
            <CardTitle className="text-base">CEFR Language Proficiency Track</CardTitle>
            <CardDescription className="text-xs">
              Target Level: {user.englishLevel || user.targetLevel} • Focus: {user.learningGoal || user.primaryGoal}
            </CardDescription>
          </div>
          <Badge variant="primary" size="sm">
            Current Target: {user.englishLevel || user.targetLevel}
          </Badge>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            {cefrLevels.map((lvl, index) => {
              const isTarget = lvl === (user.englishLevel || user.targetLevel);
              const isCompleted = index < currentLevelIndex;

              return (
                <div
                  key={lvl}
                  className={`p-3.5 rounded-xl border text-center transition-all ${
                    isTarget
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : isCompleted
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <div className="text-base font-extrabold font-display">{lvl}</div>
                  <div className="text-[10px] font-semibold mt-0.5">
                    {lvl === 'A1' && 'Beginner'}
                    {lvl === 'A2' && 'Elementary'}
                    {lvl === 'B1' && 'Intermediate'}
                    {lvl === 'B2' && 'Upper Int.'}
                    {lvl === 'C1' && 'Advanced'}
                    {lvl === 'C2' && 'Mastery'}
                  </div>
                  <div className="mt-1.5 text-[10px] font-bold">
                    {isTarget ? 'Current Goal' : isCompleted ? 'Completed' : 'Upcoming'}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Badges Section */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Award className="w-4 h-4 text-amber-500" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-[#F5F7FA]">
            Milestones & Badges
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {badges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div
                key={badge.id}
                className={`p-3 rounded-xl border transition-all flex items-center space-x-3 ${
                  badge.unlocked
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xs'
                    : 'bg-slate-50/60 dark:bg-slate-800/20 border-dashed border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    badge.unlocked ? badge.color : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {badge.unlocked ? <Icon className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {badge.title}
                    </h4>
                    {badge.unlocked && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {badge.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
