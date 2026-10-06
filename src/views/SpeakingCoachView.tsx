import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Clock,
  Award,
  Headphones,
  Info,
  BookOpen,
  Languages,
  Send,
  Zap,
} from 'lucide-react';
import { UserProfile, AppSettings } from '../types';
import {
  startVoiceRecognition,
  isSpeechRecognitionSupported,
  playTextToSpeech,
  stopSpeechSynthesis,
  playChime,
} from '../utils/speech';
import {
  calculateSpeakingMetrics,
  estimateSpeakingScores,
  SpeakingMetrics,
  SpeakingFeedbackScores,
} from '../utils/speakingMetrics';
import { GeminiService } from '../services/geminiService';
import { recordSpeakingSession } from '../utils/learningMemory';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export type SpeakingState =
  | 'ready'
  | 'listening'
  | 'processing'
  | 'review'
  | 'sending'
  | 'thinking'
  | 'speaking';

interface SpeakingPrompt {
  id: string;
  category: 'IELTS' | 'Workplace' | 'Everyday' | 'Interview';
  title: string;
  description: string;
  suggestedDuration: string;
  targetVocab: string[];
}

const SPEAKING_PROMPTS: SpeakingPrompt[] = [
  {
    id: 'ielts-journey',
    category: 'IELTS',
    title: 'Describe a memorable journey you took',
    description: 'You should say where you went, who you were with, what happened, and explain why it was particularly memorable.',
    suggestedDuration: '1 - 2 minutes',
    targetVocab: ['picturesque', 'unforgettable', 'scenic route', 'hospitality'],
  },
  {
    id: 'work-project',
    category: 'Workplace',
    title: 'Deliver a project update to leadership',
    description: 'Outline key milestones achieved this sprint, current blockers your team is resolving, and expected delivery date.',
    suggestedDuration: '45 - 90 seconds',
    targetVocab: ['milestone', 'mitigate risk', 'deliverable', 'stakeholder'],
  },
  {
    id: 'everyday-weekend',
    category: 'Everyday',
    title: 'Share your ideal relaxing weekend',
    description: 'Describe the activities that help you unwind, recharge, and prepare for a productive week ahead.',
    suggestedDuration: '1 minute',
    targetVocab: ['rejuvenating', 'unwind', 'tranquil', 'leisure'],
  },
  {
    id: 'interview-strength',
    category: 'Interview',
    title: 'Tell me about a difficult challenge you overcame',
    description: 'Use the STAR format (Situation, Task, Action, Result) to explain how you navigated a problem at work or university.',
    suggestedDuration: '1 - 2 minutes',
    targetVocab: ['proactive', 'resolved', 'collaborated', 'outcome'],
  },
];

interface SpeakingCoachViewProps {
  user: UserProfile;
  settings: AppSettings;
  onUpdateUserXp: (xp: number) => void;
  onRecordSession?: (session: {
    type: 'conversation' | 'grammar' | 'vocabulary' | 'challenge' | 'translation';
    title: string;
    durationMinutes: number;
    xpEarned: number;
    summary: string;
  }) => void;
}

export const SpeakingCoachView: React.FC<SpeakingCoachViewProps> = ({
  user,
  settings,
  onUpdateUserXp,
  onRecordSession,
}) => {
  const [selectedPrompt, setSelectedPrompt] = useState<SpeakingPrompt>(SPEAKING_PROMPTS[0]);
  const [speechState, setSpeechState] = useState<SpeakingState>('ready');
  const [transcript, setTranscript] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [metrics, setMetrics] = useState<SpeakingMetrics | null>(null);
  const [scores, setScores] = useState<SpeakingFeedbackScores | null>(null);
  const [aiFeedback, setAiFeedback] = useState<{
    reply: string;
    fluencyTip?: string;
    corrections?: { original: string; suggested: string; explanation: string; urduTip?: string }[];
    pronunciationTips?: { word: string; phonetic: string; note: string }[];
  } | null>(null);
  const [isPlayingAiSpeech, setIsPlayingAiSpeech] = useState(false);
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'preparing' | 'speaking' | 'unavailable' | 'error'>('idle');
  const [voiceNotice, setVoiceNotice] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [supported, setSupported] = useState(true);

  const stopRecognitionRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    setSupported(isSpeechRecognitionSupported());
    return () => {
      isMountedRef.current = false;
      if (stopRecognitionRef.current) {
        stopRecognitionRef.current();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopSpeechSynthesis();
    };
  }, []);

  // Timer while listening
  useEffect(() => {
    if (speechState === 'listening') {
      startTimeRef.current = Date.now();
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [speechState]);

  const startRecording = () => {
    setErrorMessage('');
    setAiFeedback(null);
    setScores(null);
    setMetrics(null);
    setTranscript('');
    stopSpeechSynthesis();
    setIsPlayingAiSpeech(false);
    setTtsStatus('idle');
    setVoiceNotice('');

    try {
      const stopFn = startVoiceRecognition({
        onInterim: (interim: string) => {
          setTranscript(interim);
        },
        onResult: (final: string) => {
          setTranscript(final);
        },
        onError: (error: any, userMessage: string) => {
          console.warn('Voice recognition error:', error);
          if (error !== 'no-speech') {
            setErrorMessage(userMessage || `Microphone notice: ${error}. You can also type or review manually.`);
          }
        },
        onEnd: () => {
          // Handled via manual stop button
        }
      });

      stopRecognitionRef.current = stopFn;
      setSpeechState('listening');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not access microphone.');
      setSpeechState('ready');
    }
  };

  const finishRecording = () => {
    const finalSeconds = Math.max(1, recordingSeconds);
    if (stopRecognitionRef.current) {
      stopRecognitionRef.current();
      stopRecognitionRef.current = null;
    }
    setSpeechState('processing');

    setTimeout(() => {
      const computedMetrics = calculateSpeakingMetrics(transcript, finalSeconds);
      const computedScores = estimateSpeakingScores(computedMetrics);
      setMetrics(computedMetrics);
      setScores(computedScores);
      setSpeechState('review');
    }, 400);
  };

  const handleAnalyzeSubmission = async () => {
    if (speechState === 'sending' || speechState === 'thinking') return;

    if (!transcript.trim()) {
      setErrorMessage('Please speak or type a sentence before analyzing.');
      setSpeechState('review');
      return;
    }

    const currentMetrics = metrics || calculateSpeakingMetrics(transcript, Math.max(1, recordingSeconds));
    const currentScores = scores || estimateSpeakingScores(currentMetrics);
    setMetrics(currentMetrics);
    setScores(currentScores);

    setSpeechState('sending');
    setTimeout(() => {
      setSpeechState('thinking');
    }, 400);

    try {
      const result = await GeminiService.sendChatMessage({
        messages: [
          {
            role: 'user',
            content: `[Speaking Practice for topic "${selectedPrompt.title}"]\nStudent Transcript:\n"${transcript}"`,
          },
        ],
        scenario: 'speaking-coach',
        difficulty: user.englishLevel || 'B1',
        isVoiceInput: true,
        speakingMetrics: metrics,
      });

      setAiFeedback({
        reply: result.reply || 'Great effort! Your speaking practice demonstrates clear intent.',
        fluencyTip: result.speakingFeedback?.fluencyTip,
        corrections: result.corrections,
        pronunciationTips: result.pronunciationTips,
      });

      // Award XP
      const xpEarned = Math.max(15, Math.min(40, Math.round((scores?.overallScore || 75) / 2.5)));
      onUpdateUserXp(xpEarned);
      playChime('success');

      if (onRecordSession) {
        onRecordSession({
          type: 'conversation',
          title: `Speaking: ${selectedPrompt.title}`,
          durationMinutes: Math.max(1, Math.ceil(recordingSeconds / 60)),
          xpEarned,
          summary: `Spoke ${metrics?.wordCount || 0} words at ${metrics?.wordsPerMinute || 0} WPM (${scores?.overallScore || 75}% score).`,
        });
      }

      recordSpeakingSession(user.uid || user.id || 'guest_user', {
        durationSeconds: Math.max(1, recordingSeconds),
        wordCount: metrics?.wordCount || 0,
        wpm: metrics?.wordsPerMinute || 0,
        overallScore: scores?.overallScore || 75,
        pronunciationScore: scores?.pronunciationScore,
        grammarScore: scores?.grammarScore,
        fluencyScore: scores?.fluencyScore,
        vocabularyScore: scores?.vocabularyScore,
        clarityScore: scores?.clarityScore,
      });

      setSpeechState('speaking');
      // Speak AI oral coaching feedback if autoplay is enabled
      if (settings.autoPlayVoice && result.reply && result.reply.trim().length > 0) {
        handlePlayAiSpeech(result.reply);
      }
    } catch (err: any) {
      console.warn('AI speech evaluation fallback:', err);
      // Fallback local assessment
      setAiFeedback({
        reply: `Good practice on "${selectedPrompt.title}". You spoke ${metrics?.wordCount || 0} words with a pace of ${metrics?.wordsPerMinute || 0} WPM. Focus on linking your sentences smoothly without hesitations.`,
        fluencyTip: metrics?.fillerWordCount ? `Try replacing filler words like "${metrics.fillerWords[0]}" with a natural silent pause.` : 'Pacing is steady and comprehensible.',
      });
      onUpdateUserXp(20);
      setSpeechState('speaking');
    }
  };

  const handlePlayAiSpeech = (text: string) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return;
    }

    // Toggle pause/stop if already speaking
    if (ttsStatus === 'speaking') {
      stopSpeechSynthesis();
      setIsPlayingAiSpeech(false);
      setTtsStatus('idle');
      return;
    }

    stopSpeechSynthesis();
    setIsPlayingAiSpeech(false);
    setTtsStatus('preparing');
    setVoiceNotice('');

    playTextToSpeech(text, {
      accent: settings.accentPreference,
      rate: settings.speechRate || 1,
      onStart: () => {
        if (!isMountedRef.current) return;
        setTtsStatus('speaking');
        setIsPlayingAiSpeech(true);
      },
      onEnd: () => {
        if (!isMountedRef.current) return;
        setTtsStatus('idle');
        setIsPlayingAiSpeech(false);
      },
      onVoiceUnavailable: (lang) => {
        if (!isMountedRef.current) return;
        setTtsStatus('unavailable');
        setIsPlayingAiSpeech(false);
        if (lang.toLowerCase().startsWith('ur')) {
          setVoiceNotice('Urdu speech voice is not installed on this browser or device. Coaching feedback is displayed in text.');
        } else {
          setVoiceNotice('Speech voice is not available on this browser. Coaching feedback is displayed in text.');
        }
      },
      onError: (err) => {
        if (!isMountedRef.current) return;
        setTtsStatus('error');
        setIsPlayingAiSpeech(false);
        if (err.code !== 'canceled' && err.code !== 'interrupted') {
          setVoiceNotice('Speech playback encountered an issue. Tap "Listen to Advice" to retry.');
        }
      },
    });
  };

  const handleReset = () => {
    stopSpeechSynthesis();
    setIsPlayingAiSpeech(false);
    setTtsStatus('idle');
    setVoiceNotice('');
    setTranscript('');
    setMetrics(null);
    setScores(null);
    setAiFeedback(null);
    setRecordingSeconds(0);
    setSpeechState('ready');
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-[#F5F7FA]">
            Speaking Coach
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#A8B0BA] mt-0.5">
            Voice recording with real-time acoustics, WPM pacing, fluency metrics, and AI oral feedback.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[8px] bg-slate-100 dark:bg-[#14181D] border border-slate-200 dark:border-white/[0.07] text-xs text-slate-600 dark:text-[#A8B0BA]">
            <Clock className="w-3.5 h-3.5 text-[#6D6FF2]" />
            <span>Target: {user.englishLevel || 'B1'} CEFR</span>
          </div>
        </div>
      </div>

      {/* Browser Speech Compatibility Notice */}
      {!supported && (
        <div className="p-3.5 rounded-[10px] bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-start space-x-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Speech Recognition is best supported in modern Chrome, Edge, or Safari. You can still type your speech for evaluation.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-[10px] bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="p-1 hover:opacity-75 cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Prompt Selector */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-[#727B87]">
          Select Practice Prompt
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {SPEAKING_PROMPTS.map((p) => {
            const isSelected = selectedPrompt.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPrompt(p);
                  handleReset();
                }}
                className={`p-3 rounded-[10px] text-left transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-[#6D6FF2]/10 dark:bg-[#6D6FF2]/15 border-[#6D6FF2]/40 text-slate-900 dark:text-[#F5F7FA] shadow-2xs'
                    : 'bg-white dark:bg-[#14181D] border-slate-200 dark:border-white/[0.07] text-slate-700 dark:text-[#A8B0BA] hover:border-slate-300 dark:hover:border-white/[0.14]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] uppercase tracking-wide ${
                    isSelected
                      ? 'bg-[#6D6FF2] text-white'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-[#727B87]'
                  }`}>
                    {p.category}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-[#727B87]">{p.suggestedDuration}</span>
                </div>
                <h4 className="text-xs font-medium leading-snug line-clamp-1 text-slate-900 dark:text-[#F5F7FA]">
                  {p.title}
                </h4>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Recording Workspace */}
      <Card variant="surface" className="p-6 sm:p-8 space-y-6">
        {/* Active Prompt Header */}
        <div className="p-4 rounded-[10px] bg-slate-50 dark:bg-[#181D23] border border-slate-200/80 dark:border-white/[0.06]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-[#6D6FF2] uppercase tracking-wide">
              {selectedPrompt.category} Mission
            </span>
            <span className="text-xs text-slate-500 dark:text-[#727B87]">
              Pacing Goal: 110–150 WPM
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-[#F5F7FA] mt-1">
            {selectedPrompt.title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A8B0BA] mt-1">
            {selectedPrompt.description}
          </p>
          <div className="flex items-center flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/[0.04]">
            <span className="text-[11px] font-medium text-slate-400 dark:text-[#727B87]">Suggested Lexicon:</span>
            {selectedPrompt.targetVocab.map((v) => (
              <span
                key={v}
                className="text-[11px] px-2 py-0.5 rounded-[5px] bg-white dark:bg-[#14181D] border border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-[#A8B0BA]"
              >
                {v}
              </span>
            ))}
          </div>
        </div>

        {/* Center Microphone & State Control */}
        <div className="flex flex-col items-center justify-center py-4 space-y-4">
          {/* Status Label */}
          <div className="text-center space-y-1">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
              Current State
            </span>
            <div className="text-base sm:text-lg font-medium text-slate-900 dark:text-[#F5F7FA] flex items-center justify-center space-x-2">
              {speechState === 'ready' && <span>Ready to Speak</span>}
              {speechState === 'listening' && (
                <span className="text-[#6D6FF2] flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-[#6D6FF2] animate-pulse" />
                  <span>Listening... ({formatTimer(recordingSeconds)})</span>
                </span>
              )}
              {speechState === 'processing' && <span className="text-amber-500">Processing Audio...</span>}
              {speechState === 'review' && <span>Review Transcript</span>}
              {speechState === 'sending' && <span>Sending to AI...</span>}
              {speechState === 'thinking' && (
                <span className="text-[#6D6FF2] flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 animate-spin text-[#6D6FF2]" />
                  <span>AI Thinking & Analyzing...</span>
                </span>
              )}
              {speechState === 'speaking' && (
                <span className="text-emerald-500 flex items-center space-x-2">
                  <Headphones className="w-4 h-4 text-emerald-500" />
                  <span>
                    {ttsStatus === 'preparing'
                      ? 'Preparing AI Voice...'
                      : ttsStatus === 'speaking'
                      ? 'Speaking Coaching Advice...'
                      : 'Coaching Feedback Ready'}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Large Microphone Control */}
          <div className="relative flex items-center justify-center">
            {/* Subtle animated ring during listening */}
            {speechState === 'listening' && (
              <div className="absolute inset-0 -m-3 rounded-full border border-[#6D6FF2]/40 animate-ping opacity-30 pointer-events-none" />
            )}

            {speechState === 'ready' && (
              <button
                type="button"
                onClick={startRecording}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#6D6FF2] hover:bg-[#7C7FF5] text-white flex flex-col items-center justify-center transition-all duration-150 shadow-md hover:scale-102 cursor-pointer focus-visible:outline-none"
                aria-label="Start recording speech"
              >
                <Mic className="w-8 h-8 sm:w-9 sm:h-9" />
                <span className="text-[10px] font-medium mt-1">Record</span>
              </button>
            )}

            {speechState === 'listening' && (
              <button
                type="button"
                onClick={finishRecording}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex flex-col items-center justify-center transition-all duration-150 shadow-md hover:scale-102 cursor-pointer focus-visible:outline-none"
                aria-label="Stop recording"
              >
                <Square className="w-7 h-7 sm:w-8 sm:h-8 fill-current" />
                <span className="text-[10px] font-medium mt-1">Done</span>
              </button>
            )}

            {(speechState === 'processing' || speechState === 'sending' || speechState === 'thinking') && (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-slate-200 dark:bg-[#181D23] border border-slate-300 dark:border-white/[0.1] text-slate-500 dark:text-[#A8B0BA] flex flex-col items-center justify-center">
                <Sparkles className="w-7 h-7 animate-spin text-[#6D6FF2]" />
                <span className="text-[10px] font-medium mt-1">Analyzing</span>
              </div>
            )}

            {(speechState === 'review' || speechState === 'speaking') && (
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-14 h-14 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-[#181D23] dark:hover:bg-[#1C2229] border border-slate-300 dark:border-white/[0.1] text-slate-700 dark:text-[#A8B0BA] flex flex-col items-center justify-center transition-colors cursor-pointer"
                  title="Record again"
                >
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-[9px] mt-0.5">Retry</span>
                </button>

                {speechState === 'review' && (
                  <button
                    type="button"
                    onClick={handleAnalyzeSubmission}
                    className="h-14 px-6 rounded-full bg-[#6D6FF2] hover:bg-[#7C7FF5] text-white font-medium text-sm flex items-center space-x-2 transition-all shadow-sm hover:scale-102 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Speech</span>
                  </button>
                )}

                {speechState === 'speaking' && aiFeedback?.reply && (
                  <button
                    type="button"
                    onClick={() => handlePlayAiSpeech(aiFeedback.reply)}
                    className="h-14 px-6 rounded-full bg-[#6D6FF2] hover:bg-[#7C7FF5] text-white font-medium text-sm flex items-center space-x-2 transition-all shadow-sm cursor-pointer"
                  >
                    {ttsStatus === 'preparing' ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin text-white" />
                        <span>Preparing Voice...</span>
                      </>
                    ) : ttsStatus === 'speaking' ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>Pause Oral Advice</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>Listen to Advice</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 dark:text-[#727B87] text-center max-w-sm">
            {speechState === 'ready' && 'Press the microphone and speak naturally in English.'}
            {speechState === 'listening' && 'Speak clearly into your microphone. Tap Done when finished.'}
            {speechState === 'review' && 'Review your words below before submitting for AI analysis.'}
            {speechState === 'speaking' && 'Your speaking metrics and tutor evaluation are presented below.'}
          </p>
        </div>

        {/* Live Transcript / Review Textarea */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-500 dark:text-[#A8B0BA] uppercase tracking-wide text-[11px]">
              {speechState === 'listening' ? 'Live Speech Recognition' : 'Your Spoken Transcript'}
            </span>
            {metrics && (
              <span className="text-slate-400 dark:text-[#727B87]">
                {metrics.wordCount} words • {recordingSeconds}s
              </span>
            )}
          </div>

          <div className="relative">
            <textarea
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                if (speechState === 'review' || speechState === 'ready') {
                  const updated = calculateSpeakingMetrics(e.target.value, Math.max(1, recordingSeconds));
                  setMetrics(updated);
                  setScores(estimateSpeakingScores(updated));
                }
              }}
              placeholder={
                speechState === 'listening'
                  ? 'Listening for your speech...'
                  : 'Your spoken transcript will appear here. You can also type or edit words directly.'
              }
              rows={3}
              readOnly={speechState === 'listening'}
              className="w-full px-3.5 py-3 rounded-[10px] bg-slate-50 dark:bg-[#101318] border border-slate-200 dark:border-white/[0.07] text-slate-900 dark:text-[#F5F7FA] text-sm focus:outline-none focus:border-[#6D6FF2] resize-y transition-colors"
            />
          </div>
        </div>

        {/* Clean Analytics Presentation (Metrics Row) */}
        {(metrics || scores) && (
          <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.06] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
                Speaking Metrics & Analytics
              </span>
              {scores && (
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#6D6FF2]">
                  <Award className="w-3.5 h-3.5" />
                  <span>Overall Score: {scores.overallScore}%</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Fluency */}
              <div className="p-3 rounded-[10px] bg-slate-50 dark:bg-[#181D23] border border-slate-200/80 dark:border-white/[0.06] text-center">
                <div className="text-[11px] font-medium text-slate-400 dark:text-[#727B87] uppercase tracking-wide">
                  Fluency
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FA] mt-1">
                  {scores?.fluencyScore || 85}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-[#A8B0BA] capitalize">
                  {metrics?.fluencyStatus || 'Balanced'}
                </div>
              </div>

              {/* Grammar */}
              <div className="p-3 rounded-[10px] bg-slate-50 dark:bg-[#181D23] border border-slate-200/80 dark:border-white/[0.06] text-center">
                <div className="text-[11px] font-medium text-slate-400 dark:text-[#727B87] uppercase tracking-wide">
                  Grammar
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FA] mt-1">
                  {scores?.grammarScore || 80}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-[#A8B0BA]">
                  {aiFeedback?.corrections?.length ? `${aiFeedback.corrections.length} fixes` : 'Sound syntax'}
                </div>
              </div>

              {/* Vocabulary */}
              <div className="p-3 rounded-[10px] bg-slate-50 dark:bg-[#181D23] border border-slate-200/80 dark:border-white/[0.06] text-center">
                <div className="text-[11px] font-medium text-slate-400 dark:text-[#727B87] uppercase tracking-wide">
                  Vocabulary
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FA] mt-1">
                  {scores?.vocabularyScore || 82}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-[#A8B0BA]">
                  {selectedPrompt.targetVocab.filter((v) => transcript.toLowerCase().includes(v.toLowerCase())).length}/4 Target
                </div>
              </div>

              {/* Clarity */}
              <div className="p-3 rounded-[10px] bg-slate-50 dark:bg-[#181D23] border border-slate-200/80 dark:border-white/[0.06] text-center">
                <div className="text-[11px] font-medium text-slate-400 dark:text-[#727B87] uppercase tracking-wide">
                  Clarity
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FA] mt-1">
                  {scores?.clarityScore || 88}%
                </div>
                <div className="text-[10px] text-slate-500 dark:text-[#A8B0BA]">
                  Articulate
                </div>
              </div>

              {/* Words */}
              <div className="p-3 rounded-[10px] bg-slate-50 dark:bg-[#181D23] border border-slate-200/80 dark:border-white/[0.06] text-center">
                <div className="text-[11px] font-medium text-slate-400 dark:text-[#727B87] uppercase tracking-wide">
                  Words
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FA] mt-1">
                  {metrics?.wordCount || 0}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-[#A8B0BA]">
                  {recordingSeconds}s duration
                </div>
              </div>

              {/* WPM */}
              <div className="p-3 rounded-[10px] bg-slate-50 dark:bg-[#181D23] border border-slate-200/80 dark:border-white/[0.06] text-center">
                <div className="text-[11px] font-medium text-slate-400 dark:text-[#727B87] uppercase tracking-wide">
                  WPM
                </div>
                <div className="text-lg font-semibold text-slate-900 dark:text-[#F5F7FA] mt-1">
                  {metrics?.wordsPerMinute || 0}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-[#A8B0BA]">
                  Optimal: 120–150
                </div>
              </div>
            </div>

            {/* Fillers & Repetitions */}
            {metrics && (metrics.fillerWordCount > 0 || metrics.repeatedWords.length > 0) && (
              <div className="p-3 rounded-[10px] bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start space-x-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  {metrics.fillerWordCount > 0 && (
                    <p>
                      Detected {metrics.fillerWordCount} conversational filler word{metrics.fillerWordCount > 1 ? 's' : ''}: <span className="font-medium underline">{metrics.fillerWords.join(', ')}</span>. Practice pausing in silence instead of using fillers.
                    </p>
                  )}
                  {metrics.repeatedWords.length > 0 && (
                    <p>
                      Repeated consecutive words: <span className="font-medium">{metrics.repeatedWords.join(', ')}</span>.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Tutor Coaching Result */}
        {aiFeedback && (
          <div className="pt-4 border-t border-slate-200/80 dark:border-white/[0.06] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-400 dark:text-[#727B87]">
                Coach Feedback & Guidance
              </span>
              <button
                type="button"
                onClick={() => handlePlayAiSpeech(aiFeedback.reply)}
                className="flex items-center space-x-1.5 text-xs text-[#6D6FF2] hover:underline cursor-pointer"
              >
                {ttsStatus === 'speaking' ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : ttsStatus === 'preparing' ? (
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {ttsStatus === 'preparing'
                    ? 'Preparing Voice...'
                    : ttsStatus === 'speaking'
                    ? 'Pause Oral Advice'
                    : 'Hear Advice'}
                </span>
              </button>
            </div>

            {voiceNotice && (
              <div className="p-3 rounded-[8px] bg-slate-100 dark:bg-[#14181D] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-600 dark:text-[#A8B0BA] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-[#6D6FF2] shrink-0" />
                  <span>{voiceNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setVoiceNotice('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="p-4 rounded-[10px] bg-slate-50 dark:bg-[#181D23] border border-slate-200/80 dark:border-white/[0.06] space-y-3">
              <p className="text-sm text-slate-800 dark:text-[#F5F7FA] leading-relaxed">
                {aiFeedback.reply}
              </p>

              {aiFeedback.fluencyTip && (
                <div className="p-2.5 rounded-[8px] bg-[#6D6FF2]/10 border border-[#6D6FF2]/20 text-xs text-slate-700 dark:text-[#A8B0BA] flex items-start space-x-2">
                  <Zap className="w-4 h-4 text-[#6D6FF2] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-[#F5F7FA]">Fluency Booster: </span>
                    <span>{aiFeedback.fluencyTip}</span>
                  </div>
                </div>
              )}

              {/* Granular Corrections if any */}
              {aiFeedback.corrections && aiFeedback.corrections.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.04]">
                  <span className="text-xs font-semibold text-slate-700 dark:text-[#F5F7FA]">
                    Suggested Grammar & Structure Refinements:
                  </span>
                  <div className="space-y-2">
                    {aiFeedback.corrections.map((c, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-[8px] bg-white dark:bg-[#14181D] border border-slate-200 dark:border-white/[0.06] text-xs space-y-1"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="line-through text-rose-500">{c.original}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">{c.suggested}</span>
                        </div>
                        <p className="text-slate-500 dark:text-[#A8B0BA]">{c.explanation}</p>
                        {c.urduTip && (
                          <p className="text-amber-700 dark:text-amber-400 font-urdu pt-0.5">
                            {c.urduTip}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pronunciation Tips if any */}
              {aiFeedback.pronunciationTips && aiFeedback.pronunciationTips.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.04]">
                  <span className="text-xs font-semibold text-slate-700 dark:text-[#F5F7FA]">
                    Pronunciation Guidance:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {aiFeedback.pronunciationTips.map((p, i) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 rounded-[8px] bg-white dark:bg-[#14181D] border border-slate-200 dark:border-white/[0.06] text-xs flex items-center space-x-2"
                      >
                        <span className="font-semibold text-slate-900 dark:text-[#F5F7FA]">{p.word}</span>
                        <span className="text-slate-400 dark:text-[#727B87] font-mono">[{p.phonetic}]</span>
                        <button
                          type="button"
                          onClick={() => playTextToSpeech(p.word, { accent: settings.accentPreference })}
                          className="p-1 hover:text-[#6D6FF2] cursor-pointer"
                          title="Listen to pronunciation"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
