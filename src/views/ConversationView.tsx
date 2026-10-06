import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lightbulb,
  ChevronDown,
  Award,
  AlertTriangle,
  FileText,
  X,
  Edit3,
  Clock,
  BarChart2,
  Globe,
  Check,
  MessageSquare,
} from 'lucide-react';
import {
  Scenario,
  ChatMessage,
  UserProfile,
  AppSettings,
  ConversationFeedbackResult,
  SpeechUiState,
  DetectedLanguage,
} from '../types';
import { SCENARIOS } from '../data/defaultData';
import {
  playTextToSpeech,
  stopSpeechSynthesis,
  startVoiceRecognition,
  isSpeechRecognitionSupported,
  playChime,
} from '../utils/speech';
import { loadScenarioChat, saveScenarioChat, saveUser } from '../utils/storage';
import { GeminiService, AI_UNAVAILABLE_MESSAGE } from '../services/geminiService';
import {
  detectInputLanguage,
  getLanguageDisplayName,
  getLanguageBadgeStyle,
} from '../utils/languageDetector';
import {
  calculateSpeakingMetrics,
  estimateSpeakingScores,
  generateFluencyFeedback,
  generateSpeakingSessionSummary,
  SpeakingMetrics,
  SpeakingFeedbackScores,
  SpeakingSessionSummary,
} from '../utils/speakingMetrics';

interface ConversationViewProps {
  user: UserProfile;
  settings: AppSettings;
  onUpdateUserXp: (xpToAdd: number) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  user,
  settings,
  onUpdateUserXp,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [scenarioDropdownOpen, setScenarioDropdownOpen] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);

  // Microphone and Speech States
  const [speechUiState, setSpeechUiState] = useState<SpeechUiState>('Ready');
  const [micLanguageMode, setMicLanguageMode] = useState<'auto' | 'en' | 'ur'>('auto');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [liveRecordingDuration, setLiveRecordingDuration] = useState(0);

  // Transcript Review State (Review before sending to Gemini - Requirement 1 & 2)
  const [isReviewingTranscript, setIsReviewingTranscript] = useState(false);
  const [originalTranscript, setOriginalTranscript] = useState('');
  const [reviewTranscript, setReviewTranscript] = useState('');
  const [reviewDuration, setReviewDuration] = useState(0);
  const [reviewMetrics, setReviewMetrics] = useState<SpeakingMetrics | null>(null);

  // Speaking Session Summary State (Requirement 12)
  const [speakingSummaryModalOpen, setSpeakingSummaryModalOpen] = useState(false);

  // Right side feedback panel tab
  const [feedbackPanelTab, setFeedbackPanelTab] = useState<'coaching' | 'speaking'>('coaching');

  // Session feedback state
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<ConversationFeedbackResult | null>(null);
  const [feedbackError, setFeedbackError] = useState('');

  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const durationTimerRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef<string>('');
  const isSendingRef = useRef(false);

  // Live language detection for current input (either typed or in review)
  const activeInputText = isReviewingTranscript ? reviewTranscript : inputValue;
  const currentLanguageDetection = detectInputLanguage(activeInputText);

  // Spoken turns and speaking summary across current session
  const spokenTurns = useMemo(() => {
    return messages.filter((m) => m.role === 'user' && m.isVoiceInput);
  }, [messages]);

  const spokenTurnsCount = spokenTurns.length;

  const currentSpeakingSummary = useMemo(() => {
    const spokenPayloads = spokenTurns.map((userMsg) => {
      // Find following assistant message if available
      const userIndex = messages.findIndex((m) => m.id === userMsg.id);
      const aiResponse = userIndex >= 0 ? messages[userIndex + 1] : undefined;
      return {
        speakingMetrics: userMsg.speakingMetrics,
        speakingScores: aiResponse?.speakingScores,
        corrections: aiResponse?.corrections,
        vocabularyOpportunities: aiResponse?.vocabularyOpportunities,
      };
    });
    return generateSpeakingSessionSummary(spokenPayloads);
  }, [messages, spokenTurns]);

  // Initialize difficulty from user target level if possible
  useEffect(() => {
    if (user.targetLevel === 'A1' || user.targetLevel === 'A2') {
      setDifficulty('Beginner');
    } else if (user.targetLevel === 'C1' || user.targetLevel === 'C2') {
      setDifficulty('Advanced');
    } else {
      setDifficulty('Intermediate');
    }
  }, [user.targetLevel]);

  // Load chat messages when scenario changes
  useEffect(() => {
    const saved = loadScenarioChat(selectedScenario.id);
    if (saved && saved.length > 0) {
      setMessages(saved);
    } else {
      const initialMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        role: 'assistant',
        content: selectedScenario.initialPrompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedResponses: [
          'Hello! I am excited to practice my English speaking with you today.',
          'Could you please guide me through this topic step by step?',
          'Let me share my thoughts on this situation.',
        ],
      };
      setMessages([initialMsg]);
      saveScenarioChat(selectedScenario.id, [initialMsg]);

      if (settings.autoPlayVoice) {
        setSpeechUiState('Speaking response...');
        playTextToSpeech(initialMsg.content, {
          accent: settings.accentPreference,
          rate: settings.speechRate,
          onEnd: () => setSpeechUiState('Microphone ready'),
        });
      }
    }
    setErrorMessage('');
    setFeedbackResult(null);
    setIsReviewingTranscript(false);
    setReviewTranscript('');
  }, [selectedScenario.id]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      stopSpeechSynthesis();
    };
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isReviewingTranscript]);

  // Timer for active recording duration
  useEffect(() => {
    if (isRecording) {
      setLiveRecordingDuration(0);
      durationTimerRef.current = setInterval(() => {
        setLiveRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [isRecording]);

  /**
   * Handle Starting Voice Recording
   */
  const handleStartVoice = () => {
    setErrorMessage('');
    setRecordingError('');
    setIsReviewingTranscript(false);
    setReviewTranscript('');
    stopSpeechSynthesis();
    setActiveSpeechId(null);

    if (!isSpeechRecognitionSupported()) {
      setRecordingError(
        'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari, or type your response below.'
      );
      return;
    }

    accumulatedTranscriptRef.current = '';
    const startTime = Date.now();
    setRecordingStartTime(startTime);
    setSpeechUiState('Listening...');

    const recognitionLocale =
      micLanguageMode === 'ur'
        ? 'ur-PK'
        : micLanguageMode === 'en'
        ? 'en-US'
        : typeof navigator !== 'undefined' && navigator.language
        ? navigator.language
        : 'en-US';

    try {
      const recognition = startVoiceRecognition({
        lang: recognitionLocale,
        onResult: (transcript) => {
          accumulatedTranscriptRef.current = transcript;
          setSpeechUiState('Transcribing...');
        },
        onError: (_err, friendlyMessage) => {
          setIsRecording(false);
          setSpeechUiState('Ready');
          setRecordingError(friendlyMessage || "Your browser couldn't capture the speech. Please try again.");
        },
        onEnd: () => {
          // Finish recording and transition to Review stage
          handleFinishRecording(startTime);
        },
      });

      if (recognition) {
        recognitionRef.current = recognition;
        setIsRecording(true);
        playChime('click');
      }
    } catch (e: any) {
      setIsRecording(false);
      setSpeechUiState('Ready');
      setRecordingError("Your browser couldn't capture the speech. Please try again.");
    }
  };

  /**
   * Handle Stopping Voice Recording & Entering Review State
   */
  const handleStopVoice = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsRecording(false);
  };

  /**
   * Internal finish recording handler: computes duration and opens Review stage
   * Requirement 1 & 2: Store original speech and allow review before sending
   */
  const handleFinishRecording = (startTime: number) => {
    setIsRecording(false);
    const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const transcript = accumulatedTranscriptRef.current.trim();

    if (!transcript) {
      setRecordingError("Your browser couldn't capture the speech. Please try again.");
      setSpeechUiState('Ready');
      return;
    }

    // Calculate initial speaking metrics
    const metrics = calculateSpeakingMetrics(transcript, duration);
    setOriginalTranscript(transcript);
    setReviewTranscript(transcript);
    setReviewDuration(duration);
    setReviewMetrics(metrics);
    setIsReviewingTranscript(true);
    setSpeechUiState('Review your transcript');
    playChime('click');
  };

  /**
   * Discard review transcript
   */
  const handleCancelReview = () => {
    setIsReviewingTranscript(false);
    setOriginalTranscript('');
    setReviewTranscript('');
    setReviewMetrics(null);
    setSpeechUiState('Ready');
  };

  /**
   * Re-record voice
   */
  const handleReRecord = () => {
    handleCancelReview();
    setTimeout(() => {
      handleStartVoice();
    }, 150);
  };

  /**
   * Send User Message (Voice Transcript or Typed Input) to Gemini
   * Preserves user's original speech, detects language, and enforces response language rules.
   */
  const handleSendMessage = async (
    textToSend?: string,
    voiceMeta?: {
      isVoice: boolean;
      durationSeconds: number;
      metrics: SpeakingMetrics | null;
      originalTranscript?: string;
    }
  ) => {
    const rawText = (textToSend !== undefined ? textToSend : inputValue).trim();
    if (!rawText || isLoading || isSendingRef.current) return;
    isSendingRef.current = true;

    const isVoice = voiceMeta ? voiceMeta.isVoice : false;
    const durationSeconds = voiceMeta ? voiceMeta.durationSeconds : 0;
    const origTrans = voiceMeta?.originalTranscript || (isVoice ? (originalTranscript || rawText) : undefined);
    const editedTrans = isVoice && origTrans && origTrans !== rawText ? rawText : undefined;

    // Reset review mode and inputs
    setIsReviewingTranscript(false);
    setOriginalTranscript('');
    setReviewTranscript('');
    setInputValue('');
    setErrorMessage('');
    setRecordingError('');
    stopSpeechSynthesis();
    setActiveSpeechId(null);

    if (isRecording) {
      handleStopVoice();
    }

    playChime('click');

    // 1. Language Detection & Explicit Override Analysis
    const detection = detectInputLanguage(rawText);

    // 2. Compute or retrieve speaking metrics if voice
    const metrics = voiceMeta && voiceMeta.metrics
      ? voiceMeta.metrics
      : isVoice
      ? calculateSpeakingMetrics(rawText, durationSeconds)
      : undefined;

    // 3. Construct user message, or reuse existing if retrying the last message
    const lastMsg = messages[messages.length - 1];
    const isRetryOfLastUserMessage =
      lastMsg &&
      lastMsg.role === 'user' &&
      (lastMsg.originalInput === rawText || lastMsg.content === rawText);

    let updatedMessages: ChatMessage[];
    if (isRetryOfLastUserMessage) {
      updatedMessages = messages;
    } else {
      const userMsg: ChatMessage = {
        id: 'msg_user_' + Date.now(),
        role: 'user',
        content: rawText, // What goes to the AI
        originalInput: origTrans || rawText, // Preserved raw original text
        originalTranscript: origTrans,
        editedTranscript: editedTrans,
        detectedLanguage: detection.detectedLanguage,
        effectiveResponseLanguage: detection.effectiveResponseLanguage,
        isVoiceInput: isVoice,
        speakingDurationSeconds: isVoice ? durationSeconds : undefined,
        speakingMetrics: metrics,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
    }
    setIsLoading(true);
    setSpeechUiState('AI is thinking...');

    // Progress Tracking Integration (Requirement 13)
    if (isVoice && metrics) {
      try {
        const wordsSpoken = metrics.wordCount;
        const minutesSpoken = Math.max(1, Math.round(durationSeconds / 60));
        const newWpm = metrics.wordsPerMinute;
        const currentAvgWpm = user.averageWpm || newWpm;
        const updatedAvgWpm = Math.round((currentAvgWpm + newWpm) / 2);

        const updatedUser: UserProfile = {
          ...user,
          wordsSpokenCount: (user.wordsSpokenCount || 0) + wordsSpoken,
          speakingMinutes: (user.speakingMinutes || 0) + minutesSpoken,
          speakingSessionsCount: (user.speakingSessionsCount || 0) + 1,
          averageWpm: updatedAvgWpm,
          practiceMinutes: (user.practiceMinutes || 0) + minutesSpoken,
        };
        saveUser(updatedUser);
        onUpdateUserXp(15);
      } catch (err) {
        console.warn('Could not record speaking progress to user profile', err);
      }
    }

    try {
      setSpeechUiState('AI is thinking...');

      // Call server endpoint with full metadata
      const data = await GeminiService.sendChatMessage({
        messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        scenario: selectedScenario.title,
        difficulty,
        targetGoal: user.primaryGoal,
        accent: settings.accentPreference,
        detectedLanguage: detection.detectedLanguage,
        effectiveResponseLanguage: detection.effectiveResponseLanguage,
        hasExplicitOverride: detection.hasExplicitOverride,
        overrideTarget: detection.overrideTarget,
        isVoiceInput: isVoice,
        speakingMetrics: metrics,
      });

      const replyContent = data.reply || (data as any).message || '';
      if (!replyContent || !replyContent.trim()) {
        throw new Error('AI returned an empty response. Please try again.');
      }

      // Calculate speaking scores for this turn if voice (Requirement 4 & 7)
      let turnSpeakingScores = undefined;
      let turnSpeakingFeedback = undefined;
      if (isVoice && metrics) {
        if (data.speakingFeedback) {
          turnSpeakingScores = {
            pronunciationScore: data.speakingFeedback.clarity || data.speakingFeedback.pronunciation || 85,
            grammarScore: data.speakingFeedback.grammar,
            fluencyScore: data.speakingFeedback.fluency,
            vocabularyScore: data.speakingFeedback.vocabulary,
            clarityScore: data.speakingFeedback.clarity || data.speakingFeedback.pronunciation || 85,
            overallScore: data.speakingFeedback.overall,
            pronunciationDisclaimer: 'Speaking scores are estimates based on your transcript and language patterns, not laboratory-grade pronunciation analysis.',
          };
          turnSpeakingFeedback = {
            fluency: data.speakingFeedback.fluency,
            grammar: data.speakingFeedback.grammar,
            vocabulary: data.speakingFeedback.vocabulary,
            clarity: data.speakingFeedback.clarity || data.speakingFeedback.pronunciation || 85,
            overall: data.speakingFeedback.overall,
            fluencyTip: data.speakingFeedback.fluencyTip || generateFluencyFeedback(metrics),
          };
        } else {
          turnSpeakingScores = estimateSpeakingScores(
            metrics,
            data.corrections?.length || 0,
            data.confidenceScore || 85
          );
          turnSpeakingFeedback = {
            fluency: turnSpeakingScores.fluencyScore,
            grammar: turnSpeakingScores.grammarScore,
            vocabulary: turnSpeakingScores.vocabularyScore,
            clarity: turnSpeakingScores.clarityScore,
            overall: turnSpeakingScores.overallScore,
            fluencyTip: generateFluencyFeedback(metrics),
          };
        }
      }

      // 4. Construct AI response message (AI correction and reply are separate from user input)
      const aiMsg: ChatMessage = {
        id: 'msg_ai_' + Date.now(),
        role: 'assistant',
        content: replyContent,
        detectedLanguage: (data.effectiveResponseLanguage as DetectedLanguage) || detection.effectiveResponseLanguage,
        effectiveResponseLanguage: (data.effectiveResponseLanguage as DetectedLanguage) || detection.effectiveResponseLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        corrections: data.corrections || [],
        pronunciationTips: data.pronunciationTips || [],
        vocabularyOpportunities: data.vocabularyOpportunities || [],
        speakingScores: turnSpeakingScores,
        speakingFeedback: turnSpeakingFeedback,
        suggestedResponses: data.suggestedResponses || [],
        confidenceScore: data.confidenceScore,
        followUpQuestion: data.followUpQuestion || undefined,
        learningTip: data.learningTip || undefined,
        detectedIntent: data.detectedIntent || undefined,
        primaryCorrection: data.correction || undefined,
        recurringWeaknessIdentified: data.recurringWeaknessIdentified || undefined,
      };

      const finalMessages = [...updatedMessages, aiMsg];
      setMessages(finalMessages);
      saveScenarioChat(selectedScenario.id, finalMessages);
      onUpdateUserXp(15);
      playChime('xp');

      // Auto-play voice if enabled
      if (settings.autoPlayVoice) {
        setSpeechUiState('AI is speaking...');
        playAudio(aiMsg.id, aiMsg.content);
      } else {
        setSpeechUiState('Ready');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const friendlyError = err.message || AI_UNAVAILABLE_MESSAGE;
      const formattedError = friendlyError.startsWith("AI response couldn't be generated")
        ? friendlyError
        : `AI response couldn't be generated. ${friendlyError}`;
      setErrorMessage(formattedError);
      playChime('error');
    } finally {
      setIsLoading(false);
      setSpeechUiState('Ready');
      isSendingRef.current = false;
    }
  };

  /**
   * Play or Pause Text to Speech for an AI Message
   */
  const playAudio = (id: string, text: string) => {
    if (activeSpeechId === id) {
      stopSpeechSynthesis();
      setActiveSpeechId(null);
      setSpeechUiState('Microphone ready');
    } else {
      setActiveSpeechId(id);
      setSpeechUiState('Speaking response...');
      playTextToSpeech(text, {
        accent: settings.accentPreference,
        rate: settings.speechRate,
        onEnd: () => {
          setActiveSpeechId(null);
          setSpeechUiState('Microphone ready');
        },
      });
    }
  };

  /**
   * Reset the current scenario chat
   */
  const handleResetChat = () => {
    stopSpeechSynthesis();
    const initialMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content: selectedScenario.initialPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedResponses: [
        'Hello! I am excited to practice my English speaking with you today.',
        'Could you please guide me through this topic step by step?',
        'Let me share my thoughts on this situation.',
      ],
    };
    setMessages([initialMsg]);
    saveScenarioChat(selectedScenario.id, [initialMsg]);
    setErrorMessage('');
    setRecordingError('');
    setIsReviewingTranscript(false);
    setReviewTranscript('');
    setSpeechUiState('Microphone ready');
    setFeedbackResult(null);
    playChime('click');
  };

  /**
   * Request Comprehensive AI Session Feedback
   */
  const handleGetFeedback = async () => {
    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) {
      setErrorMessage('Please send at least one response before requesting full AI session feedback.');
      return;
    }

    setFeedbackModalOpen(true);
    setIsLoadingFeedback(true);
    setFeedbackError('');

    try {
      const data = await GeminiService.getConversationFeedback({
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        scenario: selectedScenario.title,
        difficulty,
      });
      setFeedbackResult(data);
      onUpdateUserXp(25);
      playChime('success');
    } catch (err: any) {
      console.error('Feedback error:', err);
      setFeedbackError(err.message || AI_UNAVAILABLE_MESSAGE);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  // Find latest user message & latest assistant message for feedback panel
  const latestAiMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header & Scenario + Difficulty Selector */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Scenario dropdown */}
        <div className="relative">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Speaking Topic & Scenario:
          </label>
          <button
            id="scenario-picker-btn"
            onClick={() => setScenarioDropdownOpen(!scenarioDropdownOpen)}
            className="flex items-center space-x-3 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-left hover:border-indigo-400 dark:hover:border-indigo-500 transition-all cursor-pointer w-full sm:w-80 justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {selectedScenario.title}
              </p>
              <div className="flex items-center space-x-2 text-[11px] text-indigo-600 dark:text-indigo-400 mt-0.5">
                <span className="font-semibold">{selectedScenario.category}</span>
                <span>•</span>
                <span>Role: {selectedScenario.aiRole}</span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {scenarioDropdownOpen && (
            <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-50 animate-in fade-in duration-150">
              <span className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1 block">
                Select Conversation Topic
              </span>
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => {
                      setSelectedScenario(sc);
                      setScenarioDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start space-x-2.5 cursor-pointer ${
                      selectedScenario.id === sc.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">
                      {sc.title.charAt(0)}
                    </div>
                    <div className="flex-1 truncate">
                      <p className="text-xs font-bold truncate">{sc.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {sc.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Difficulty Selector & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Difficulty:
            </label>
            <div className="flex items-center space-x-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setDifficulty(lvl)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    difficulty === lvl
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2 self-end sm:self-auto pt-4 sm:pt-0">
            {spokenTurnsCount > 0 && (
              <button
                id="speaking-summary-btn"
                type="button"
                onClick={() => setSpeakingSummaryModalOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 transition-all cursor-pointer shadow-2xs"
                title="View your Speaking Practice Session Summary"
              >
                <Award className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Summary ({spokenTurnsCount})</span>
              </button>
            )}

            <button
              onClick={handleGetFeedback}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
              title="Get comprehensive AI learning feedback"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Feedback</span>
            </button>

            <button
              id="reset-chat-btn"
              onClick={handleResetChat}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="Clear and restart this scenario"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <div className="flex items-center space-x-3 ml-4">
            {latestUserMessage && (
              <button
                type="button"
                onClick={() => handleSendMessage(latestUserMessage.originalInput || latestUserMessage.content)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            )}
            <button
              onClick={() => setErrorMessage('')}
              className="text-amber-700 hover:text-amber-900 dark:text-amber-300 text-xs font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Split Layout: Chat Feed (left 2/3) + Real-time Coaching Drawer (right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Chat messages, Transcript Review & Voice Input */}
        <div className="lg:col-span-2 flex flex-col h-[700px] rounded-[12px] bg-white dark:bg-[#101318] border border-slate-200/80 dark:border-white/[0.07] overflow-hidden">
          
          {/* Microphone State Status Bar */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-[#14181D] border-b border-slate-200/80 dark:border-white/[0.06] flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                {isRecording ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </>
                ) : isLoading ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6D6FF2] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#6D6FF2]"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                )}
              </span>
              <span className="font-medium text-slate-700 dark:text-[#A8B0BA] text-[11px]">
                {speechUiState}
                {isRecording && ` (${liveRecordingDuration}s)`}
              </span>
            </div>

            {/* Speech Recognition Language Selector */}
            <div className="flex items-center space-x-1">
              <span className="text-[10px] text-slate-400 dark:text-[#727B87] font-medium mr-0.5">Mic:</span>
              <button
                type="button"
                id="mic-lang-auto-btn"
                onClick={() => setMicLanguageMode('auto')}
                className={`px-2 py-0.5 rounded-[5px] text-[10px] font-medium transition-colors cursor-pointer ${
                  micLanguageMode === 'auto'
                    ? 'bg-[#6D6FF2] text-white'
                    : 'bg-slate-200/70 dark:bg-[#181D23] text-slate-600 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA]'
                }`}
                title="Auto-detect English, Roman Urdu, Urdu, or mixed speech from transcript"
              >
                Auto
              </button>
              <button
                type="button"
                id="mic-lang-en-btn"
                onClick={() => setMicLanguageMode('en')}
                className={`px-2 py-0.5 rounded-[5px] text-[10px] font-medium transition-colors cursor-pointer ${
                  micLanguageMode === 'en'
                    ? 'bg-[#6D6FF2] text-white'
                    : 'bg-slate-200/70 dark:bg-[#181D23] text-slate-600 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA]'
                }`}
                title="Transcribe spoken English accurately (en-US)"
              >
                English
              </button>
              <button
                type="button"
                id="mic-lang-ur-btn"
                onClick={() => setMicLanguageMode('ur')}
                className={`px-2 py-0.5 rounded-[5px] text-[10px] font-medium font-urdu transition-colors cursor-pointer ${
                  micLanguageMode === 'ur'
                    ? 'bg-[#6D6FF2] text-white'
                    : 'bg-slate-200/70 dark:bg-[#181D23] text-slate-600 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA]'
                }`}
                title="اردو آواز کو اردو رسم الخط میں ٹرانسکرائب کریں"
              >
                اردو
              </button>
            </div>
          </div>

          {/* Messages scroll container */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5">
            {messages.map((msg) => {
              const isAi = msg.role === 'assistant';
              const isPlaying = activeSpeechId === msg.id;
              const langStyle = msg.detectedLanguage ? getLanguageBadgeStyle(msg.detectedLanguage) : null;

              return (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-2.5 ${isAi ? '' : 'justify-end'}`}
                >
                  {isAi && (
                    <div className="w-7 h-7 rounded-[7px] bg-slate-100 dark:bg-[#181D23] border border-slate-200 dark:border-white/[0.08] text-[#6D6FF2] flex items-center justify-center shrink-0 text-[11px] font-semibold">
                      AI
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-[10px] p-3.5 text-[13px] leading-relaxed ${
                      isAi
                        ? 'bg-white dark:bg-[#14181D] border border-slate-200/80 dark:border-white/[0.07] text-slate-900 dark:text-[#F5F7FA]'
                        : 'bg-[#6D6FF2]/10 dark:bg-[#6D6FF2]/15 border border-[#6D6FF2]/20 dark:border-[#6D6FF2]/30 text-slate-900 dark:text-[#F5F7FA]'
                    }`}
                  >
                    <div className="flex items-center justify-between space-x-3 mb-1 text-[11px] text-slate-500 dark:text-[#727B87]">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-medium text-slate-700 dark:text-[#A8B0BA]">{isAi ? selectedScenario.aiRole : user.name}</span>
                        {/* Language Badge */}
                        {langStyle && (
                          <span
                            className={`text-[9px] font-medium px-1.5 py-0.2 rounded-[4px] border ${
                              isAi
                                ? `${langStyle.bg} ${langStyle.text}`
                                : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-[#A8B0BA] border-slate-300 dark:border-white/10'
                            }`}
                          >
                            {langStyle.label}
                          </span>
                        )}
                        {/* Voice badge */}
                        {!isAi && msg.isVoiceInput && (
                          <span className="text-[9px] font-medium px-1.5 py-0.2 rounded-[4px] bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-[#A8B0BA] border border-slate-300 dark:border-white/10 flex items-center space-x-0.5">
                            <Mic className="w-2.5 h-2.5" />
                            <span>
                              {msg.speakingDurationSeconds ? `${msg.speakingDurationSeconds}s` : 'Voice'}
                            </span>
                          </span>
                        )}
                      </div>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Original User Input is PRESERVED and displayed verbatim (Requirement 2) */}
                    {msg.editedTranscript && msg.editedTranscript !== msg.originalTranscript ? (
                      <div className="space-y-1">
                        <p
                          className={`whitespace-pre-wrap ${
                            msg.detectedLanguage === 'ur' ? 'font-urdu text-right text-base leading-relaxed' : ''
                          }`}
                          dir={msg.detectedLanguage === 'ur' ? 'rtl' : 'ltr'}
                        >
                          {msg.content}
                        </p>
                        <div className="text-[11px] opacity-80 pt-1 border-t border-white/20 italic">
                          <span>Original spoken: "{msg.originalTranscript}"</span>
                        </div>
                      </div>
                    ) : (
                      <p
                        className={`whitespace-pre-wrap ${
                          msg.detectedLanguage === 'ur' ? 'font-urdu text-right text-base leading-relaxed' : ''
                        }`}
                        dir={msg.detectedLanguage === 'ur' ? 'rtl' : 'ltr'}
                      >
                        {msg.originalInput || msg.content}
                      </p>
                    )}

                    {/* Audio playback button for AI answers */}
                    {isAi && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-600/60 flex items-center justify-between">
                        <button
                          onClick={() => playAudio(msg.id, msg.content)}
                          className="flex items-center space-x-1.5 text-xs font-medium text-[#6D6FF2] dark:text-[#7C7FF5] hover:text-[#5E60EC] dark:hover:text-[#8B8EF7] cursor-pointer"
                        >
                          {isPlaying ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                              <span className="text-rose-600 dark:text-rose-400">Stop Speaking</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Listen ({settings.accentPreference} accent)</span>
                            </>
                          )}
                        </button>

                        {msg.confidenceScore && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-[5px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            {msg.confidenceScore}% Confidence
                          </span>
                        )}
                      </div>
                    )}

                    {/* Compact Speaking Feedback for Spoken Turns (Requirement 4 & 7) */}
                    {isAi && msg.speakingScores && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-600 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          <span className="flex items-center space-x-1">
                            <Mic className="w-3 h-3 text-indigo-500" />
                            <span>Speaking Feedback (Estimate):</span>
                          </span>
                          <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-xs">
                            Overall {msg.speakingScores.overallScore}/100
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                          <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <span className="text-slate-400 block font-semibold">Fluency</span>
                            <span className="font-extrabold text-amber-600 dark:text-amber-400 text-xs">
                              {msg.speakingScores.fluencyScore}
                            </span>
                          </div>
                          <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <span className="text-slate-400 block font-semibold">Grammar</span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs">
                              {msg.speakingScores.grammarScore}
                            </span>
                          </div>
                          <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <span className="text-slate-400 block font-semibold">Vocab</span>
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-xs">
                              {msg.speakingScores.vocabularyScore}
                            </span>
                          </div>
                          <div className="p-1.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <span className="text-slate-400 block font-semibold">Clarity</span>
                            <span className="font-extrabold text-teal-600 dark:text-teal-400 text-xs">
                              {msg.speakingScores.clarityScore ?? msg.speakingScores.pronunciationScore}
                            </span>
                          </div>
                        </div>

                        {msg.speakingFeedback?.fluencyTip && (
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug bg-white/70 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700/60 flex items-start gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                            <span className="font-medium">{msg.speakingFeedback.fluencyTip}</span>
                          </p>
                        )}

                        <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                          * Speaking scores are estimates based on your transcript and language patterns, not laboratory-grade pronunciation analysis.
                        </p>
                      </div>
                    )}

                    {/* Inline Grammar Feedback if errors present (Requirement 5) */}
                    {isAi && msg.corrections && msg.corrections.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-600/80 space-y-1.5">
                        <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3 text-rose-500" />
                          <span>Grammar Feedback:</span>
                        </div>
                        {msg.corrections.map((corr, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-rose-200/70 dark:border-rose-900/50 text-[11px] space-y-1"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-slate-400 line-through">"{corr.original}"</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                → "{corr.suggested}"
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-[10px] leading-relaxed">
                              <span className="font-semibold text-slate-500 dark:text-slate-400">Why: </span>
                              {corr.explanation}
                            </p>
                            {corr.urduTip && (
                              <p className="text-amber-700 dark:text-amber-300 font-urdu text-[11px] pt-0.5 border-t border-slate-100 dark:border-slate-700 flex items-start gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <span>{corr.urduTip}</span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline Vocabulary Opportunities (Requirement 6) */}
                    {isAi && msg.vocabularyOpportunities && msg.vocabularyOpportunities.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-600/80 space-y-1">
                        <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>Vocabulary Boost:</span>
                        </div>
                        {msg.vocabularyOpportunities.slice(0, 2).map((voc, idx) => (
                          <div key={idx} className="text-[11px] text-slate-700 dark:text-slate-300">
                            <span className="text-slate-400">Instead of "{voc.original}":</span>{' '}
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {voc.suggested.map((s) => `"${s}"`).join(', ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* AI is thinking... indicator */}
            {isLoading && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-bold animate-pulse">
                  AI
                </div>
                <div className="rounded-2xl rounded-tl-xs p-3.5 bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-200 text-xs flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 animate-spin" />
                  <span className="font-medium">AI is thinking...</span>
                </div>
              </div>
            )}

            {/* Error indicator inside conversation feed */}
            {errorMessage && (
              <div className="flex items-start space-x-3 animate-in fade-in duration-150">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 text-xs font-bold shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-xs p-4 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-800 dark:text-amber-300">
                      Could not get AI response
                    </span>
                    <button
                      type="button"
                      onClick={() => setErrorMessage('')}
                      className="text-amber-600 hover:text-amber-900 dark:text-amber-400 p-0.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
                      aria-label="Dismiss error"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="leading-relaxed">{errorMessage}</p>
                  {latestUserMessage && (
                    <button
                      type="button"
                      onClick={() => handleSendMessage(latestUserMessage.originalInput || latestUserMessage.content)}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-xs mt-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Sending</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Quick Replies */}
          {latestAiMessage?.suggestedResponses && latestAiMessage.suggestedResponses.length > 0 && !isReviewingTranscript && (
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-700/60 overflow-x-auto flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">
                Suggested Replies:
              </span>
              {latestAiMessage.suggestedResponses.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(suggestion)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 shrink-0 transition-all cursor-pointer"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          )}

          {/* Recording alert (Requirement 15) */}
          {recordingError && (
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-xs border-t border-amber-200 dark:border-amber-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{recordingError}</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  id="try-again-mic-btn"
                  onClick={() => {
                    setRecordingError('');
                    handleStartVoice();
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs transition-all"
                >
                  Try Again
                </button>
                <button
                  onClick={() => setRecordingError('')}
                  className="text-amber-800 dark:text-amber-200 p-0.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/50 ml-1 cursor-pointer"
                  title="Dismiss error"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SECTION: TRANSCRIPTION REVIEW BEFORE SUBMISSION (Requirement 1 & 2) */}
          {/* Flow: READY -> LISTENING -> TRANSCRIBING -> REVIEW -> SEND -> AI RESPONSE */}
          {/* ========================================================================= */}
          {isReviewingTranscript ? (
            <div className="p-4 sm:p-5 bg-indigo-50/80 dark:bg-indigo-950/60 border-t border-indigo-200 dark:border-indigo-800 space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Speaking Review
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Detected Language Badge */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      getLanguageBadgeStyle(currentLanguageDetection.detectedLanguage).bg
                    } ${getLanguageBadgeStyle(currentLanguageDetection.detectedLanguage).text}`}
                  >
                    Language: {getLanguageDisplayName(currentLanguageDetection.detectedLanguage)}
                  </span>
                  {/* Spoken Duration & Words */}
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {reviewDuration}s • ~{reviewMetrics?.wordsPerMinute || 0} WPM
                  </span>
                </div>
              </div>

              {/* Your transcript container */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Your transcript:
                  </span>
                  {originalTranscript && reviewTranscript !== originalTranscript && (
                    <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-md">
                      Edited
                    </span>
                  )}
                </div>

                <textarea
                  id="transcript-review-input"
                  value={reviewTranscript}
                  onChange={(e) => {
                    const newText = e.target.value;
                    setReviewTranscript(newText);
                    setReviewMetrics(calculateSpeakingMetrics(newText, reviewDuration));
                  }}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-2xl text-sm border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                  placeholder="Your transcript..."
                  dir={currentLanguageDetection.detectedLanguage === 'ur' ? 'rtl' : 'ltr'}
                />

                {originalTranscript && reviewTranscript !== originalTranscript && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    * Original speech preserved: <span className="italic">"{originalTranscript}"</span>
                  </p>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>You can edit your transcript before sending. Your original speech is always preserved for learning.</span>
                </p>
              </div>

              {/* Review Action Buttons: [Send], [Edit], [Record Again], [Discard] */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-indigo-100 dark:border-indigo-900/60">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    id="transcript-edit-btn"
                    onClick={() => {
                      const el = document.getElementById('transcript-review-input');
                      el?.focus();
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                    title="Edit transcript before sending"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    id="transcript-record-again-btn"
                    onClick={handleReRecord}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                    title="Discard and record audio again"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                    <span>Record Again</span>
                  </button>

                  <button
                    type="button"
                    id="transcript-discard-btn"
                    onClick={handleCancelReview}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                    title="Discard spoken audio without sending"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Discard</span>
                  </button>
                </div>

                <button
                  type="button"
                  id="confirm-send-transcript-btn"
                  onClick={() =>
                    handleSendMessage(reviewTranscript, {
                      isVoice: true,
                      durationSeconds: reviewDuration,
                      metrics: reviewMetrics,
                      originalTranscript: originalTranscript || reviewTranscript,
                    })
                  }
                  disabled={!reviewTranscript.trim() || isLoading}
                  className="flex items-center space-x-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          ) : (
            /* Regular Input Box with Live Language Detection Indicator */
            <div className="p-3 sm:p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
              {/* Live Language Detection Tag above input if text is present */}
              {inputValue.trim().length > 0 && (
                <div className="mb-2 flex items-center justify-between text-[11px] animate-in fade-in duration-100">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 font-semibold">Detected Language:</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${
                        getLanguageBadgeStyle(currentLanguageDetection.detectedLanguage).bg
                      } ${getLanguageBadgeStyle(currentLanguageDetection.detectedLanguage).text}`}
                    >
                      {getLanguageDisplayName(currentLanguageDetection.detectedLanguage)}
                    </span>
                    {currentLanguageDetection.hasExplicitOverride && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-indigo-500 shrink-0" />
                        <span>Explicit request: {getLanguageDisplayName(currentLanguageDetection.effectiveResponseLanguage)}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-[10px]">
                    AI will reply in {getLanguageDisplayName(currentLanguageDetection.effectiveResponseLanguage)}
                  </span>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = inputValue.trim();
                  if (trimmed) {
                    handleSendMessage(trimmed);
                  }
                }}
                className="flex items-center space-x-2"
              >
                {/* Voice Record Toggle Button */}
                <button
                  type="button"
                  id="mic-record-btn"
                  onClick={isRecording ? handleStopVoice : handleStartVoice}
                  className={`p-2.5 rounded-[10px] transition-all cursor-pointer relative ${
                    isRecording
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-slate-100 dark:bg-[#181D23] border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA]'
                  }`}
                  title={isRecording ? 'Click to finish speaking and review transcript' : 'Click to speak via microphone'}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Text input */}
                <input
                  type="text"
                  id="chat-message-input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={
                    isRecording
                      ? 'Listening to your voice... Click mic button when done'
                      : 'Type your message or use microphone...'
                  }
                  dir={currentLanguageDetection.detectedLanguage === 'ur' ? 'rtl' : 'ltr'}
                  className="flex-1 px-3.5 py-2.5 rounded-[10px] text-sm border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#101318] text-slate-900 dark:text-[#F5F7FA] focus:outline-none focus:border-[#6D6FF2]"
                />

                {/* Send Button */}
                <button
                  type="submit"
                  id="chat-send-btn"
                  disabled={!inputValue.trim() || isLoading}
                  className="p-2.5 rounded-[10px] bg-[#6D6FF2] hover:bg-[#7C7FF5] disabled:opacity-40 disabled:hover:bg-[#6D6FF2] text-white transition-all cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Live Coaching Feedback, Speaking Metrics & Bilingual Tools */}
        <div className="space-y-4">
          <div className="p-5 rounded-[12px] bg-white dark:bg-[#14181D] border border-slate-200/80 dark:border-white/[0.07] space-y-4 h-full">
            {/* Header with Tab switcher: Coaching vs Speaking Metrics */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center space-x-1 p-0.5 bg-slate-100 dark:bg-[#181D23] rounded-[8px]">
                <button
                  type="button"
                  onClick={() => setFeedbackPanelTab('coaching')}
                  className={`px-3 py-1 text-xs font-medium rounded-[6px] transition-all cursor-pointer ${
                    feedbackPanelTab === 'coaching'
                      ? 'bg-white dark:bg-[#14181D] text-[#6D6FF2] dark:text-[#7C7FF5] shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Live Coaching
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackPanelTab('speaking')}
                  className={`px-3 py-1 text-xs font-medium rounded-[6px] transition-all cursor-pointer ${
                    feedbackPanelTab === 'speaking'
                      ? 'bg-white dark:bg-[#14181D] text-[#6D6FF2] dark:text-[#7C7FF5] shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Speaking Scores
                </button>
              </div>

              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[5px] bg-[#6D6FF2]/10 text-[#6D6FF2] dark:text-[#7C7FF5] border border-[#6D6FF2]/20">
                {difficulty}
              </span>
            </div>

            {feedbackPanelTab === 'coaching' ? (
              <div className="space-y-4">
                {/* 1. Preserved User Input & Language Context (Requirement 2) */}
                {latestUserMessage && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {latestUserMessage.isVoiceInput ? 'Your Spoken Sentence:' : 'Your Original Sentence:'}
                      </span>
                      {latestUserMessage.detectedLanguage && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                            getLanguageBadgeStyle(latestUserMessage.detectedLanguage).bg
                          } ${getLanguageBadgeStyle(latestUserMessage.detectedLanguage).text}`}
                        >
                          {getLanguageDisplayName(latestUserMessage.detectedLanguage)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 italic">
                      "{latestUserMessage.originalTranscript || latestUserMessage.originalInput || latestUserMessage.content}"
                    </p>
                    {latestUserMessage.editedTranscript && latestUserMessage.editedTranscript !== (latestUserMessage.originalTranscript || latestUserMessage.originalInput) && (
                      <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                        ↳ Edited before sending: "{latestUserMessage.editedTranscript}"
                      </p>
                    )}
                  </div>
                )}

                {/* 2. Grammar Feedback (Requirement 5) */}
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Grammar Feedback:</span>
                  </h5>

                  {latestAiMessage?.corrections && latestAiMessage.corrections.length > 0 ? (
                    <div className="space-y-2.5">
                      {latestAiMessage.corrections.map((corr, i) => (
                        <div
                          key={i}
                          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs space-y-2"
                        >
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                              Your sentence:
                            </span>
                            <p className="text-rose-600 dark:text-rose-400 font-medium line-through">
                              "{corr.original}"
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-0.5">
                              Better:
                            </span>
                            <p className="text-emerald-700 dark:text-emerald-300 font-bold">
                              "{corr.suggested}"
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                              Why:
                            </span>
                            <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                              {corr.explanation}
                            </p>
                          </div>
                          {corr.urduTip && (
                            <p className="text-amber-800 dark:text-amber-300 font-urdu text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                              • {corr.urduTip}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Natural expression! No grammar mistakes detected.</span>
                    </div>
                  )}
                </div>

                {/* 3. Vocabulary Feedback (Requirement 6) */}
                {latestAiMessage?.vocabularyOpportunities && latestAiMessage.vocabularyOpportunities.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Vocabulary Opportunities:</span>
                    </h5>
                    <div className="space-y-2">
                      {latestAiMessage.vocabularyOpportunities.slice(0, 3).map((vocab, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs space-y-1.5"
                        >
                          <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                            Instead of: <span className="font-semibold text-slate-700 dark:text-slate-200">"{vocab.original}"</span>
                          </div>
                          <div className="text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                            You could say:{' '}
                            {vocab.suggested.map((s, idx) => (
                              <span
                                key={idx}
                                className="inline-block bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 mr-1 text-[11px] font-bold"
                              >
                                "{s}"
                              </span>
                            ))}
                          </div>
                          {vocab.explanation && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                              {vocab.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Pronunciation Guide (IPA) */}
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center space-x-1">
                    <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Pronunciation Guide (IPA):</span>
                  </h5>

                  {latestAiMessage?.pronunciationTips && latestAiMessage.pronunciationTips.length > 0 ? (
                    <div className="space-y-2">
                      {latestAiMessage.pronunciationTips.map((tip, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold text-slate-900 dark:text-white">
                              {tip.word}
                            </span>
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                              {tip.phonetic}
                            </span>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                            {tip.note}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Speak or type responses to receive targeted pronunciation analysis in IPA format.
                    </p>
                  )}
                </div>

                {/* Dynamic Context-Aware Tutor Tip */}
                {latestAiMessage?.learningTip && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-1">
                    <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center space-x-1.5">
                      <Lightbulb className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Context Tutor Tip:</span>
                    </span>
                    <p className="text-xs text-indigo-950 dark:text-indigo-100 leading-relaxed">
                      {latestAiMessage.learningTip}
                    </p>
                  </div>
                )}

                {/* Recurring Weakness Tracker */}
                {latestAiMessage?.recurringWeaknessIdentified && (
                  <div className="p-3 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 flex items-center space-x-2 text-xs text-purple-900 dark:text-purple-200">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <span className="font-bold">Pattern to Master: </span>
                      <span>{latestAiMessage.recurringWeaknessIdentified}</span>
                    </div>
                  </div>
                )}

                {/* 4. Bilingual Urdu Learning Booster */}
                {settings.showUrduAssistance && (
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1.5">
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5 font-urdu">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>استاد کا مشورہ (Language Tip):</span>
                    </span>
                    <p className="text-xs text-amber-950 dark:text-amber-100 leading-relaxed font-urdu">
                      انگریزی گفتگو کے دوران اگر کوئی لفظ نہ آئے تو رکنے کے بجائے بات کو آسان متبادل الفاظ میں بیان کریں۔ روانی سب سے اہم ہے۔
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* TAB 2: Speaking Scores & Fluency Metrics */
              <div className="space-y-4">
                {latestUserMessage?.isVoiceInput && latestUserMessage.speakingMetrics ? (
                  <div className="space-y-4">
                    {/* Scores Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                          <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Speaking Performance Scores:</span>
                        </span>
                      </div>

                      {latestAiMessage?.speakingScores ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-400 block font-semibold">Pronunciation</span>
                            <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                              {latestAiMessage.speakingScores.pronunciationScore}
                              <span className="text-xs text-slate-400 font-normal">/100</span>
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-400 block font-semibold">Grammar</span>
                            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                              {latestAiMessage.speakingScores.grammarScore}
                              <span className="text-xs text-slate-400 font-normal">/100</span>
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-400 block font-semibold">Fluency</span>
                            <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                              {latestAiMessage.speakingScores.fluencyScore}
                              <span className="text-xs text-slate-400 font-normal">/100</span>
                            </span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-400 block font-semibold">Overall</span>
                            <span className="text-lg font-extrabold text-purple-600 dark:text-purple-400">
                              {latestAiMessage.speakingScores.overallScore}
                              <span className="text-xs text-slate-400 font-normal">/100</span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Scores will compute automatically on spoken turns.</p>
                      )}

                      {/* Disclaimer Requirement 8 */}
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 italic">
                        * Pronunciation rating is an AI & language-based estimation (not physical phoneme acoustic measurement).
                      </p>
                    </div>

                    {/* Fluency Metrics Breakdown */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
                      <h6 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Fluency Metrics:</span>
                      </h6>

                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>Speaking Duration:</span>
                          <span className="font-bold">{latestUserMessage.speakingMetrics.durationSeconds}s</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>Words Spoken:</span>
                          <span className="font-bold">{latestUserMessage.speakingMetrics.wordCount}</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>Pace (WPM):</span>
                          <span className="font-bold">~{latestUserMessage.speakingMetrics.wordsPerMinute} WPM</span>
                        </div>
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>Filler Words:</span>
                          <span className="font-bold">
                            {latestUserMessage.speakingMetrics.fillerWordCount > 0
                              ? latestUserMessage.speakingMetrics.fillerWords.join(', ')
                              : 'None detected (Great!)'}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300">
                        {latestUserMessage.speakingMetrics.metricsSummary}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-2">
                    <Mic className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No Voice Session Yet
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Click the microphone button to speak. Your duration, words per minute, and fluency scores will appear here.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post-Conversation AI Feedback Modal */}
      {feedbackModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    AI Conversation Feedback
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Targeted for {difficulty} English Fluency
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFeedbackModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingFeedback && (
              <div className="py-16 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Analyzing your speaking patterns...
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Reviewing grammar, vocabulary density, and common recurring mistakes.
                </p>
              </div>
            )}

            {feedbackError && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
                {feedbackError}
              </div>
            )}

            {feedbackResult && (
              <div className="space-y-4">
                {/* Score & Overall feedback */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-emerald-50 dark:from-indigo-950/40 dark:to-emerald-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block">
                      Session Fluency Rating
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 max-w-md">
                      {feedbackResult.overallFeedback}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-display">
                      {feedbackResult.overallScore}
                    </span>
                    <span className="text-xs text-slate-400 block">/100</span>
                  </div>
                </div>

                {/* Grammar Feedback */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Grammar Feedback:</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {feedbackResult.grammarFeedback}
                  </p>
                </div>

                {/* Vocabulary Feedback */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                    <span>Vocabulary Feedback:</span>
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {feedbackResult.vocabularyFeedback}
                  </p>
                </div>

                {/* Common Mistakes */}
                {feedbackResult.commonMistakes && feedbackResult.commonMistakes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Identified Mistakes & Corrections:
                    </h4>
                    <div className="space-y-2">
                      {feedbackResult.commonMistakes.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                        >
                          <div className="text-rose-600 dark:text-rose-400 font-medium line-through">
                            "{m.mistake}"
                          </div>
                          <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                            → "{m.correction}"
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                            {m.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Improvement Suggestions */}
                {feedbackResult.improvementSuggestions && feedbackResult.improvementSuggestions.length > 0 && (
                  <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                    <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      Personalized Action Steps:
                    </h4>
                    <ul className="space-y-1.5">
                      {feedbackResult.improvementSuggestions.map((tip, idx) => (
                        <li
                          key={idx}
                          className="text-xs text-slate-700 dark:text-slate-300 flex items-start space-x-2"
                        >
                          <span className="text-indigo-500 font-bold">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setFeedbackModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer"
              >
                Close Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Speaking Practice Session Summary Modal (Requirement 12) */}
      {speakingSummaryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 border border-slate-200 dark:border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Speaking Session Summary
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Based on {spokenTurnsCount} spoken {spokenTurnsCount === 1 ? 'turn' : 'turns'} in {selectedScenario.title}
                  </p>
                </div>
              </div>
              <button
                id="close-speaking-summary-btn"
                onClick={() => setSpeakingSummaryModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core Speaking Dimensions (Fluency, Grammar, Vocabulary, Clarity) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Fluency
                </span>
                <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                  {currentSpeakingSummary.fluencyStatus}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Grammar
                </span>
                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                  {currentSpeakingSummary.grammarStatus}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Vocabulary
                </span>
                <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                  {currentSpeakingSummary.vocabularyStatus}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-900/50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Clarity
                </span>
                <span className="text-base font-extrabold text-teal-600 dark:text-teal-400">
                  {currentSpeakingSummary.clarityStatus}
                </span>
              </div>
            </div>

            {/* Speaking Speed & Metrics (Words spoken, Average WPM, Filler words) */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Pace & Delivery Metrics:</span>
              </h4>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Words</span>
                  <span className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                    {currentSpeakingSummary.wordsSpoken}
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-semibold">Average Speed</span>
                  <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                    ~{currentSpeakingSummary.averageWpm} WPM
                  </span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] text-slate-400 block font-semibold">Filler Words</span>
                  <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                    {currentSpeakingSummary.fillerWordsCount}
                  </span>
                </div>
              </div>

              {currentSpeakingSummary.fillerWordsList.length > 0 && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                  Filler words noted: <span className="font-semibold text-slate-700 dark:text-slate-300">{currentSpeakingSummary.fillerWordsList.join(', ')}</span>
                </p>
              )}
            </div>

            {/* Top Improvement for Next Time */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1.5">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Top Improvement for Next Time:</span>
              </span>
              <p className="text-xs text-amber-950 dark:text-amber-100 leading-relaxed font-medium">
                {currentSpeakingSummary.topImprovement}
              </p>
            </div>

            {/* Useful Vocabulary from the Session */}
            {currentSpeakingSummary.usefulVocabulary && currentSpeakingSummary.usefulVocabulary.length > 0 && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 space-y-2">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Key Vocabulary to Practice:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {currentSpeakingSummary.usefulVocabulary.map((word, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800 shadow-2xs"
                    >
                      "{word}"
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                * Estimated from your speech rate, hesitations, and transcript context.
              </p>
              <button
                onClick={() => setSpeakingSummaryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer shadow-xs"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
