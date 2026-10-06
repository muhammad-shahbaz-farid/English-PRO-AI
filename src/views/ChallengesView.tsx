import React, { useState, useEffect, useRef } from 'react';
import {
  Flame,
  Zap,
  Check,
  AlertTriangle,
  Lightbulb,
  Mic,
  MicOff,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Volume2,
} from 'lucide-react';
import {
  UserProfile,
  DailyChallenge,
  ChallengeType,
  ChallengeEvaluationResult,
  AppSettings,
} from '../types';
import { playChime, playTextToSpeech as playPronunciation } from '../utils/speech';
import { GeminiService, AI_UNAVAILABLE_MESSAGE } from '../services/geminiService';
import { recordChallengeAttempt } from '../utils/learningMemory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';

interface ChallengesViewProps {
  user: UserProfile;
  challenges: DailyChallenge[];
  setChallenges?: (challenges: DailyChallenge[]) => void;
  settings?: AppSettings;
  onUpdateUserXp?: (xp: number) => void;
  onCompleteChallenge?: (challengeId: string, xpEarned: number) => void;
  onUpdateStreak?: () => void;
}

const CHALLENGE_TYPES: { type: ChallengeType; label: string; desc: string }[] = [
  { type: 'grammar', label: 'Grammar', desc: 'Syntax and tenses' },
  { type: 'vocabulary', label: 'Vocabulary', desc: 'Idioms and lexical precision' },
  { type: 'sentence_correction', label: 'Correction', desc: 'Fluency doctor' },
  { type: 'translation', label: 'Translation', desc: 'Urdu to natural English' },
  { type: 'multiple_choice', label: 'Quiz', desc: 'Quick diagnostic check' },
];

export const ChallengesView: React.FC<ChallengesViewProps> = ({
  user,
  challenges,
  setChallenges,
  settings,
  onUpdateUserXp,
  onCompleteChallenge,
  onUpdateStreak,
}) => {
  const [selectedType, setSelectedType] = useState<ChallengeType>('sentence_correction');
  const [selectedDifficulty, setSelectedDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [currentChallenge, setCurrentChallenge] = useState<DailyChallenge | null>(challenges[0] || null);
  const [userSubmission, setUserSubmission] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<ChallengeEvaluationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [completedCount, setCompletedCount] = useState(
    challenges.filter((c) => c.isCompleted).length
  );

  // Clean up voice recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Generate a fresh challenge
  const handleGenerateChallenge = async (typeToGenerate?: ChallengeType) => {
    setIsGenerating(true);
    setErrorMessage('');
    setEvaluationResult(null);
    setUserSubmission('');
    setSelectedOption(null);

    const type = typeToGenerate || selectedType;

    try {
      const generated = await GeminiService.generateDailyChallenge({
        type,
        level: selectedDifficulty,
      });

      const newChallenge: DailyChallenge = {
        id: `challenge_${Date.now()}`,
        title: generated.title,
        description: generated.instructions || `Daily ${type} mission`,
        type: generated.type,
        difficulty: generated.difficulty,
        xpReward: generated.xpReward || 25,
        isCompleted: false,
        prompt: generated.prompt,
        instructions: generated.instructions,
        sampleHint: generated.sampleHint,
        urduHint: generated.urduHint,
        options: generated.options,
        modelAnswer: generated.modelAnswer,
      };

      setCurrentChallenge(newChallenge);
      playChime('click');
    } catch (err: any) {
      console.error('Challenge generation error:', err);
      setErrorMessage(err.message || AI_UNAVAILABLE_MESSAGE);
    } finally {
      setIsGenerating(false);
    }
  };

  // Evaluate user submission
  const handleEvaluate = async () => {
    if (!currentChallenge) return;

    const submissionText =
      currentChallenge.type === 'multiple_choice'
        ? selectedOption || ''
        : userSubmission.trim();

    if (!submissionText) {
      setErrorMessage('Please type or select an answer before submitting.');
      return;
    }

    setIsEvaluating(true);
    setErrorMessage('');

    try {
      const result = await GeminiService.evaluateChallenge({
        challengeTitle: currentChallenge.title,
        type: currentChallenge.type || 'sentence_correction',
        prompt: currentChallenge.prompt,
        userSubmission: submissionText,
        difficulty: currentChallenge.difficulty || 'Intermediate',
      });

      setEvaluationResult(result);

      recordChallengeAttempt(user?.uid || user?.id || 'guest_user', {
        challengeId: currentChallenge.id,
        title: currentChallenge.title,
        category: currentChallenge.category,
        type: currentChallenge.type,
        score: result.score || (result.passed ? 85 : 40),
        passed: result.passed,
      });

      if (result.passed) {
        playChime('success');
        const xp = result.xpAwarded || currentChallenge.xpReward;
        onCompleteChallenge?.(currentChallenge.id, xp);
        onUpdateUserXp?.(xp);
        onUpdateStreak?.();
        if (setChallenges) {
          setChallenges(
            challenges.map((c) => (c.id === currentChallenge.id ? { ...c, isCompleted: true } : c))
          );
        }
        setCompletedCount((prev) => prev + 1);
      } else {
        playChime('click');
      }
    } catch (err: any) {
      console.error('Evaluation error:', err);
      setErrorMessage(err.message || AI_UNAVAILABLE_MESSAGE);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Toggle voice recognition
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition is not supported in this browser. Please type your answer.');
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
        recognitionRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
      };
      recognition.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setIsRecording(false);
        recognitionRef.current = null;
      };
      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setUserSubmission((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
      recognitionRef.current = null;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        icon={Zap}
        title="Daily English Challenges"
        description="Strengthen grammar, vocabulary, sentence structure, and conversational reflexes through dynamic daily practice missions."
        badge="Missions"
        actions={
          <div className="flex items-center space-x-2">
            <Badge variant="warning" size="md">
              <Flame className="w-3.5 h-3.5 mr-1 fill-amber-500 text-amber-500" />
              {user.streakDays || 0}d Streak
            </Badge>
            <Badge variant="primary" size="md">
              {completedCount} Completed
            </Badge>
          </div>
        }
      />

      {/* Challenge Configuration Card */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Challenge Type Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Challenge Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CHALLENGE_TYPES.map((t) => (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => {
                      setSelectedType(t.type);
                      handleGenerateChallenge(t.type);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      selectedType === t.type
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Difficulty
              </label>
              <div className="flex items-center space-x-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700">
                {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedDifficulty(lvl)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      selectedDifficulty === lvl
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Each completed challenge awards XP and boosts your learning streak.
            </p>
            <Button
              onClick={() => handleGenerateChallenge()}
              disabled={isGenerating}
              isLoading={isGenerating}
              variant="primary"
              size="sm"
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex items-center space-x-3 ml-4">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => {
                if (userSubmission || selectedOption) {
                  handleEvaluate();
                } else {
                  handleGenerateChallenge();
                }
              }}
              leftIcon={<RotateCcw className="w-3 h-3" />}
            >
              Retry
            </Button>
            <button
              onClick={() => setErrorMessage('')}
              className="text-amber-700 hover:text-amber-900 dark:text-amber-300 text-xs font-semibold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Active Challenge Workspace */}
      {currentChallenge && (
        <Card className="space-y-0">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <Badge variant="primary" size="sm">
                  {(currentChallenge.type || 'challenge').replace('_', ' ')}
                </Badge>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Difficulty: {currentChallenge.difficulty || 'Intermediate'}
                </span>
              </div>
              <CardTitle>{currentChallenge.title}</CardTitle>
            </div>

            <Badge variant="warning" size="md">
              +{currentChallenge.xpReward} XP Reward
            </Badge>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Prompt Box */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Question / Scenario
              </span>
              <p className="text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
                "{currentChallenge.prompt}"
              </p>
              {currentChallenge.instructions && (
                <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="font-medium">{currentChallenge.instructions}</span>
                </p>
              )}
            </div>

            {/* Hints if available */}
            {(currentChallenge.sampleHint || currentChallenge.urduHint) && (
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 space-y-1 text-xs text-amber-950 dark:text-amber-200">
                <div className="flex items-center space-x-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Helpful Clues:</span>
                </div>
                {currentChallenge.sampleHint && <p>• {currentChallenge.sampleHint}</p>}
                {currentChallenge.urduHint && (
                  <p className="font-urdu pt-0.5 text-xs leading-relaxed">
                    • اردو میں اشارہ: {currentChallenge.urduHint}
                  </p>
                )}
              </div>
            )}

            {/* Interaction Area: Multiple Choice vs Text/Voice Submission */}
            {currentChallenge.type === 'multiple_choice' && currentChallenge.options ? (
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Select Your Answer:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {currentChallenge.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedOption(opt)}
                      className={`p-3.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        selectedOption === opt
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-2xs'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Your Response
                  </label>
                  <Button
                    type="button"
                    onClick={handleToggleVoice}
                    variant={isRecording ? 'danger' : 'ghost'}
                    size="xs"
                    leftIcon={isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  >
                    {isRecording ? 'Listening...' : 'Dictate'}
                  </Button>
                </div>

                <textarea
                  rows={3}
                  value={userSubmission}
                  onChange={(e) => setUserSubmission(e.target.value)}
                  placeholder="Type or speak your answer in English..."
                  className="w-full p-3.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all"
                />
              </div>
            )}

            {/* Submit for evaluation */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleEvaluate}
                disabled={
                  isEvaluating ||
                  (currentChallenge.type === 'multiple_choice' ? !selectedOption : !userSubmission.trim())
                }
                isLoading={isEvaluating}
                variant="primary"
                size="md"
                leftIcon={<ShieldCheck className="w-4 h-4" />}
              >
                Submit
              </Button>
            </div>

            {/* Real AI Evaluation Result */}
            {evaluationResult && (
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-850/70 border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        evaluationResult.passed
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300'
                      }`}
                    >
                      {evaluationResult.passed ? <Check className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {evaluationResult.passed ? 'Mission Passed!' : 'Needs Revision'}
                      </h4>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Diagnostic Score: {evaluationResult.score}/100
                      </span>
                    </div>
                  </div>

                  {evaluationResult.passed && (
                    <Badge variant="success" size="md">
                      +{evaluationResult.xpAwarded || currentChallenge.xpReward} XP Earned
                    </Badge>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {evaluationResult.feedback}
                </p>

                {evaluationResult.modelAnswer && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                        High-Scoring Model Answer:
                      </span>
                      <button
                        onClick={() => playPronunciation(evaluationResult.modelAnswer!)}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1"
                        title="Listen to audio pronunciation"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      "{evaluationResult.modelAnswer}"
                    </p>
                  </div>
                )}

                {evaluationResult.urduTip && (
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs font-urdu text-amber-950 dark:text-amber-100">
                    اردو رہنمائی: {evaluationResult.urduTip}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!currentChallenge && !isGenerating && !errorMessage && (
        <EmptyState
          icon={Zap}
          title="No active challenge selected"
          description="Choose a category above (Grammar, Vocabulary, Translation, or Correction) and click Generate to start today's quest."
          actionLabel="Start First Challenge"
          onAction={() => handleGenerateChallenge()}
        />
      )}
    </div>
  );
};
