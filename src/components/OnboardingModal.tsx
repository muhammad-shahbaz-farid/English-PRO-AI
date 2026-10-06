import React, { useState } from 'react';
import {
  Sparkles,
  Target,
  Clock,
  GraduationCap,
  Mic,
  PenLine,
  SpellCheck2,
  BookOpen,
  Languages,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { SimplifiedLevel, LearningGoal } from '../types';
import { Button } from './ui/Button';
import { playChime } from '../utils/speech';

interface OnboardingModalProps {
  isOpen: boolean;
  userName: string;
  onComplete: (data: {
    level: SimplifiedLevel;
    goal: LearningGoal;
    dailyPracticeGoal: number;
  }) => void;
  onClose?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  userName,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedLevel, setSelectedLevel] = useState<SimplifiedLevel>('Intermediate');
  const [selectedGoal, setSelectedGoal] = useState<LearningGoal>('Speaking');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(15);

  if (!isOpen) return null;

  const handleLevelSelect = (level: SimplifiedLevel) => {
    setSelectedLevel(level);
  };

  const handleGoalSelect = (goal: LearningGoal) => {
    setSelectedGoal(goal);
  };

  const handleMinutesSelect = (minutes: number) => {
    setSelectedMinutes(minutes);
  };

  const handleNext = () => {
    playChime('click');
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else {
      playChime('success');
      onComplete({
        level: selectedLevel,
        goal: selectedGoal,
        dailyPracticeGoal: selectedMinutes,
      });
    }
  };

  const handleBack = () => {
    playChime('click');
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  const levelOptions: {
    level: SimplifiedLevel;
    cefr: string;
    title: string;
    description: string;
    badge: string;
  }[] = [
    {
      level: 'Beginner',
      cefr: 'A1 – A2',
      title: 'Beginner',
      description: 'You understand basic words and simple sentences. You want to build foundational confidence and speak without anxiety.',
      badge: 'Foundations',
    },
    {
      level: 'Intermediate',
      cefr: 'B1 – B2',
      title: 'Intermediate',
      description: 'You can hold everyday conversations. You want to speak more naturally, reduce hesitation, and refine grammar precision.',
      badge: 'Most Popular',
    },
    {
      level: 'Advanced',
      cefr: 'C1 – C2',
      title: 'Advanced',
      description: 'You are comfortable in English. You want to master professional nuance, complex writing flow, and native-level fluency.',
      badge: 'Professional',
    },
  ];

  const goalOptions: {
    goal: LearningGoal;
    title: string;
    description: string;
    icon: React.ElementType;
  }[] = [
    {
      goal: 'Speaking',
      title: 'Speaking Fluency',
      description: 'Master natural pronunciation, reduce filler words, and gain conversational confidence.',
      icon: Mic,
    },
    {
      goal: 'Writing',
      title: 'Professional Writing',
      description: 'Craft polished emails, essays, and reports with tone clarity and concise structure.',
      icon: PenLine,
    },
    {
      goal: 'Grammar',
      title: 'Grammar Precision',
      description: 'Eliminate recurring tense, preposition, and syntax errors with bilingual insights.',
      icon: SpellCheck2,
    },
    {
      goal: 'Vocabulary',
      title: 'Vocabulary Vault',
      description: 'Acquire high-frequency CEFR vocabulary, idioms, and collocations for expressive power.',
      icon: BookOpen,
    },
    {
      goal: 'General English',
      title: 'General English',
      description: 'A comprehensive, well-rounded daily routine across speaking, writing, and vocabulary.',
      icon: Languages,
    },
  ];

  const minuteOptions: {
    minutes: number;
    title: string;
    description: string;
    badge: string;
  }[] = [
    {
      minutes: 5,
      title: '5 Minutes / Day',
      description: 'Quick micro-habit. Perfect for busy schedules to keep your daily streak alive.',
      badge: 'Casual',
    },
    {
      minutes: 10,
      title: '10 Minutes / Day',
      description: 'Steady, consistent progress. Great balance for noticeable weekly improvements.',
      badge: 'Recommended',
    },
    {
      minutes: 20,
      title: '20 Minutes / Day',
      description: 'Focused growth. Accelerate conversational fluency and expand your vocabulary fast.',
      badge: 'Accelerated',
    },
    {
      minutes: 30,
      title: '30 Minutes / Day',
      description: 'Intensive immersion. Rapid advancement for interviews, exams, or career milestones.',
      badge: 'Intensive',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#12161C] rounded-2xl border border-slate-200/80 dark:border-white/[0.08] shadow-2xl overflow-hidden transition-all flex flex-col max-h-[90vh]">
        {/* Header with Step Tracker */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#6D6FF2]/10 text-[#6D6FF2] flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2
                  id="onboarding-modal-title"
                  className="text-base font-semibold text-slate-900 dark:text-[#F5F7FA]"
                >
                  Personalize Your English Routine
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#A8B0BA]">
                  Welcome, {userName || 'Learner'}! Tailor your daily learning engine.
                </p>
              </div>
            </div>

            {/* Step Counter */}
            <div className="text-xs font-semibold text-[#6D6FF2] bg-[#6D6FF2]/10 px-2.5 py-1 rounded-full shrink-0">
              Step {step} of 3
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#6D6FF2] h-full transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA] flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#6D6FF2]" />
                  What is your current English proficiency level?
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#A8B0BA]">
                  This calibrates the difficulty of AI conversation scenarios, vocabulary, and grammar feedback.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {levelOptions.map((opt) => {
                  const isSelected = selectedLevel === opt.level;
                  return (
                    <div
                      key={opt.level}
                      onClick={() => handleLevelSelect(opt.level)}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-150 flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'border-[#6D6FF2] bg-[#6D6FF2]/5 dark:bg-[#6D6FF2]/10 shadow-xs'
                          : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] bg-white dark:bg-[#151920]'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center space-x-2.5">
                          <span className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA]">
                            {opt.title}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-[#727B87]">
                            ({opt.cefr})
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-[#A8B0BA]">
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-[#A8B0BA] leading-relaxed">
                          {opt.description}
                        </p>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected
                            ? 'border-[#6D6FF2] bg-[#6D6FF2] text-white'
                            : 'border-slate-300 dark:border-white/[0.2]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA] flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#6D6FF2]" />
                  What is your primary English learning goal?
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#A8B0BA]">
                  Your daily practice plan will prioritize this skill first each day.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {goalOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedGoal === opt.goal;
                  return (
                    <div
                      key={opt.goal}
                      onClick={() => handleGoalSelect(opt.goal)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#6D6FF2] bg-[#6D6FF2]/5 dark:bg-[#6D6FF2]/10 shadow-xs'
                          : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] bg-white dark:bg-[#151920]'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              isSelected
                                ? 'bg-[#6D6FF2] text-white'
                                : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-[#A8B0BA]'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-[#6D6FF2] bg-[#6D6FF2] text-white'
                                : 'border-slate-300 dark:border-white/[0.2]'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA]">
                            {opt.title}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-[#A8B0BA] mt-1 leading-relaxed">
                            {opt.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#6D6FF2]" />
                  What is your daily practice commitment?
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#A8B0BA]">
                  Small, deliberate daily practice produces far better retention than sporadic long sessions.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {minuteOptions.map((opt) => {
                  const isSelected = selectedMinutes === opt.minutes;
                  return (
                    <div
                      key={opt.minutes}
                      onClick={() => handleMinutesSelect(opt.minutes)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all duration-150 flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#6D6FF2] bg-[#6D6FF2]/5 dark:bg-[#6D6FF2]/10 shadow-xs'
                          : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/[0.15] bg-white dark:bg-[#151920]'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-sm bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-[#A8B0BA]">
                            {opt.badge}
                          </span>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-[#6D6FF2] bg-[#6D6FF2] text-white'
                                : 'border-slate-300 dark:border-white/[0.2]'
                            }`}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-[#F5F7FA]">
                            {opt.title}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-[#A8B0BA] mt-1 leading-relaxed">
                            {opt.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between">
          <div>
            {step > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Back
              </Button>
            ) : (
              <span className="text-xs text-slate-400 dark:text-[#727B87]">
                You can change these anytime in Profile
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              id="onboarding-next-btn"
              variant="primary"
              size="md"
              onClick={handleNext}
              rightIcon={
                step === 3 ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )
              }
            >
              {step === 3 ? 'Save & Build My Plan' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
