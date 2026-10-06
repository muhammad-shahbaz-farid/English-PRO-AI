import React, { useState } from 'react';
import {
  PenTool,
  Sparkles,
  RotateCcw,
  Trash2,
  Copy,
  Check,
  Volume2,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Award,
  BookOpen,
  Briefcase,
  GraduationCap,
  Mail,
  UserCheck,
  MessageCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import {
  WritingAnalysisResult,
  WritingStyleMode,
  AppSettings,
  UserProfile,
} from '../types';
import { GeminiService, AI_UNAVAILABLE_MESSAGE } from '../services/geminiService';
import { playTextToSpeech, playChime } from '../utils/speech';
import { detectInputLanguage } from '../utils/languageDetector';
import { recordGrammarMistakesContext } from '../utils/learningEngine';
import { recordWritingSession, recordGrammarMistakes } from '../utils/learningMemory';

interface WritingViewProps {
  user: UserProfile;
  settings: AppSettings;
  onUpdateUserXp: (xpToAdd: number) => void;
  onWritingChecked?: () => void;
}

interface ExamplePrompt {
  label: string;
  mode: WritingStyleMode;
  text: string;
  description: string;
}

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    label: 'Job Application',
    mode: 'Job Application',
    text: 'Dear Hiring Manager, I am writing to apply for Software Engineer position. I have 2 years experience in React and I am software engineering student. I goes to office daily and did not missed any deadline. I am very good at problem solving and want to contribute to your team.',
    description: 'Cover letter with missing articles, subject-verb and tense errors.',
  },
  {
    label: 'Subject-Verb Agreement',
    mode: 'General English',
    text: 'I goes to university every day and I enjoys studying computer science with my friends.',
    description: 'Classic subject-verb agreement issue with I goes / enjoys.',
  },
  {
    label: 'Email to Manager',
    mode: 'Email',
    text: 'Dear Sir, I am writing this email for request leave tomorrow because I was having fever and doctor tell me to take rest. Please approve my leave for one day.',
    description: 'Workplace sick leave request with preposition and tense errors.',
  },
  {
    label: 'Interview Answer',
    mode: 'Interview Answer',
    text: 'My greatest strength is that I works very hard. In my previous project, I lead a team of three person and we successfully delivered website before time. It was very challenging task.',
    description: 'Behavioral response with plural and tense errors.',
  },
  {
    label: 'Academic Essay',
    mode: 'Academic',
    text: 'In this essay, it discuss about impact of artificial intelligence in modern education. Many student thinks that AI is helpful, but teacher is worry about cheating and critical thinking.',
    description: 'Academic passage with agreement, singular/plural, and preposition issues.',
  },
  {
    label: 'Casual Social',
    mode: 'Casual',
    text: 'Yesterday I went to market with friends and we was having a great time. Food was very good and we enjoyed a lot.',
    description: 'Conversational reflection with agreement and vocabulary opportunity.',
  },
  {
    label: 'Clean Sample (High Score)',
    mode: 'General English',
    text: 'I am studying software engineering and I enjoy web development. Building responsive user interfaces brings me immense satisfaction.',
    description: 'Already well-structured English to verify minimal corrections.',
  },
];

const STYLE_MODES: { mode: WritingStyleMode; label: string; icon: React.ElementType; hint: string }[] = [
  { mode: 'General English', label: 'General English', icon: BookOpen, hint: 'Everyday clarity & natural flow' },
  { mode: 'Professional', label: 'Professional', icon: Briefcase, hint: 'Workplace & business communication' },
  { mode: 'Job Application', label: 'Job Application', icon: Award, hint: 'Cover letters, resumes & career pitch' },
  { mode: 'Academic', label: 'Academic', icon: GraduationCap, hint: 'Essays, research & formal papers' },
  { mode: 'Email', label: 'Email', icon: Mail, hint: 'Effective greetings, body & closings' },
  { mode: 'Interview Answer', label: 'Interview Answer', icon: UserCheck, hint: 'STAR method & confident delivery' },
  { mode: 'Casual', label: 'Casual', icon: MessageCircle, hint: 'Conversational, friendly & relaxed' },
];

export const WritingView: React.FC<WritingViewProps> = ({
  user,
  settings,
  onUpdateUserXp,
  onWritingChecked,
}) => {
  const [inputText, setInputText] = useState(
    'I goes to university every day because I am software engineering student. Yesterday I did not went to class because of fever.'
  );
  const [selectedMode, setSelectedMode] = useState<WritingStyleMode>('General English');
  const [explanationLangMode, setExplanationLangMode] = useState<'auto' | 'en' | 'roman_ur' | 'ur'>('auto');
  const [customInstruction, setCustomInstruction] = useState('');
  const [showInstructionInput, setShowInstructionInput] = useState(false);
  const [showExamplesModal, setShowExamplesModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [result, setResult] = useState<WritingAnalysisResult | null>(null);

  // Active version tab for the 3 versions
  const [activeVersionTab, setActiveVersionTab] = useState<'corrected' | 'natural' | 'original'>('corrected');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // Interactive Practice Quiz state
  const [selectedPracticeOption, setSelectedPracticeOption] = useState<number | null>(null);
  const [hasSubmittedPractice, setHasSubmittedPractice] = useState(false);
  const [practiceXpClaimed, setPracticeXpClaimed] = useState(false);

  // Character and Word counters
  const charCount = inputText.length;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const MAX_CHARS = 15000;
  const isNearLimit = charCount > MAX_CHARS * 0.9;
  const isOverLimit = charCount > MAX_CHARS;

  // Handle Copy text
  const handleCopy = (text: string, tabId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabId);
    playChime('click');
    setTimeout(() => setCopiedTab(null), 2000);
  };

  // Handle Text-to-Speech
  const handleTTS = (text: string) => {
    playTextToSpeech(text, { accent: settings.accentPreference || 'American' });
  };

  // Analyze Writing
  const handleAnalyze = async (textOverride?: string) => {
    const textToSubmit = (textOverride !== undefined ? textOverride : inputText).trim();
    if (!textToSubmit || isLoading || isOverLimit) return;

    setIsLoading(true);
    setErrorMessage('');
    playChime('click');

    // Reset practice state for new analysis
    setSelectedPracticeOption(null);
    setHasSubmittedPractice(false);
    setPracticeXpClaimed(false);

    try {
      const data = await GeminiService.checkWriting({
        text: textToSubmit,
        mode: selectedMode,
        instructionLanguage: explanationLangMode,
        explicitInstruction: customInstruction.trim() || undefined,
      });

      setResult(data);
      setActiveVersionTab('corrected');
      onUpdateUserXp(25);
      if (onWritingChecked) {
        onWritingChecked();
      }
      if (data.mistakes && data.mistakes.length > 0) {
        const errorCategories = data.mistakes.map((m) => m.category || m.explanation).filter(Boolean);
        recordGrammarMistakesContext(user.uid || user.id, errorCategories);
        recordGrammarMistakes(
          user.uid || user.id || 'guest_user',
          data.mistakes.map((m) => ({
            category: m.category,
            original: m.original,
            correction: m.correction,
            explanation: m.explanation,
          }))
        );
      }

      recordWritingSession(user.uid || user.id || 'guest_user', {
        mode: selectedMode,
        wordCount,
        overallScore: data.overallScore || 80,
        grammarScore: data.grammarScore || 80,
        vocabularyScore: data.vocabularyScore || 80,
        sentenceStructureScore: data.sentenceStructureScore || 80,
        naturalnessScore: data.naturalnessScore || 80,
      });

      playChime('success');
    } catch (err: any) {
      console.error('Writing check error:', err);
      const friendlyMsg = err.message || AI_UNAVAILABLE_MESSAGE;
      setErrorMessage(friendlyMsg);
      // IMPORTANT: Preserve inputText on error so user never loses their writing!
    } finally {
      setIsLoading(false);
    }
  };

  // Clear text handler
  const handleClear = () => {
    if (inputText.length > 50) {
      if (!window.confirm('Clear all writing in the editor?')) return;
    }
    setInputText('');
    setResult(null);
    setErrorMessage('');
    playChime('click');
  };

  // Load example prompt
  const handleLoadExample = (example: ExamplePrompt) => {
    setInputText(example.text);
    setSelectedMode(example.mode);
    setShowExamplesModal(false);
    playChime('click');
  };

  // Handle Practice Option Click
  const handleSelectPracticeOption = (index: number) => {
    if (hasSubmittedPractice) return;
    setSelectedPracticeOption(index);
    setHasSubmittedPractice(true);

    if (result?.practiceExercise && index === result.practiceExercise.correctIndex) {
      playChime('xp');
      if (!practiceXpClaimed) {
        onUpdateUserXp(10);
        setPracticeXpClaimed(true);
      }
    } else {
      playChime('click');
    }
  };

  // Color helper for scores
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
    if (score >= 70) return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800';
    if (score >= 55) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <PenTool className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-display">
                AI Writing Coach
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Pro
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl mt-1 leading-relaxed">
              Write naturally. Get intelligent three-tier rewrites, vocabulary upgrades, and personalized feedback across 7 communication styles.
            </p>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center space-x-2 text-xs bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
            <span className="text-slate-400 block text-[10px] font-medium">Checks Done</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
              {user.writingChecksCount || 0}
            </span>
          </div>
          <div className="px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
            <span className="text-indigo-400 block text-[10px] font-medium">Total XP</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400 text-xs">
              {user.totalXp} XP
            </span>
          </div>
        </div>
      </div>

      {/* Writing Style Modes Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Writing Style & Goal
          </label>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            {STYLE_MODES.find((m) => m.mode === selectedMode)?.hint}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {STYLE_MODES.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedMode === item.mode;
            return (
              <button
                key={item.mode}
                type="button"
                onClick={() => {
                  setSelectedMode(item.mode);
                  playChime('click');
                }}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 font-medium'
                }`}
              >
                <Icon className={`w-4 h-4 mb-1.5 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
                <span className="text-xs leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Writing Editor Card */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Editor Toolbar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-700 dark:text-slate-300">Explanation Language:</span>
            <div className="flex items-center space-x-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setExplanationLangMode('auto')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  explanationLangMode === 'auto'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Detects instruction language automatically"
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setExplanationLangMode('en')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  explanationLangMode === 'en'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setExplanationLangMode('roman_ur')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  explanationLangMode === 'roman_ur'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Roman Urdu
              </button>
              <button
                type="button"
                onClick={() => setExplanationLangMode('ur')}
                className={`px-2.5 py-1 rounded-lg font-bold font-urdu transition-all cursor-pointer ${
                  explanationLangMode === 'ur'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                اردو
              </button>
            </div>
          </div>

          {/* Quick Prompts / Examples & Custom Instruction Toggle */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowExamplesModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold transition-all cursor-pointer"
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Examples & Prompts</span>
            </button>
            <button
              type="button"
              onClick={() => setShowInstructionInput(!showInstructionInput)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition-all cursor-pointer"
            >
              <span>Custom Focus</span>
              {showInstructionInput ? (
                <ChevronUp className="w-3 h-3 ml-0.5" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-0.5" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Custom Instruction Field */}
        {showInstructionInput && (
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
              Instruction / Question:
            </span>
            <input
              type="text"
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="e.g. 'Explain every mistake', 'meri writing check karo aur mistakes samjhao', or 'Make it suitable for a senior job'"
              className="flex-1 w-full bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Textarea */}
        <div className="p-4 sm:p-6">
          <textarea
            id="writing-coach-textarea"
            rows={8}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            placeholder={`Type or paste your English text here...\n\nExamples: an email, cover letter paragraph, interview response, essay, or everyday sentences.`}
            className={`w-full bg-transparent resize-y min-h-[180px] focus:outline-none text-slate-800 dark:text-slate-100 text-base leading-relaxed placeholder-slate-400 dark:placeholder-slate-500 font-sans ${
              isOverLimit ? 'text-rose-600' : ''
            }`}
          />
        </div>

        {/* Bottom Action Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
          {/* Counters and limits */}
          <div className="flex items-center space-x-3 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              <strong className="text-slate-800 dark:text-slate-200">{wordCount}</strong> {wordCount === 1 ? 'word' : 'words'}
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span
              className={`font-semibold ${
                isOverLimit
                  ? 'text-rose-600 font-bold'
                  : isNearLimit
                  ? 'text-amber-600'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
            </span>
            {isOverLimit && (
              <span className="text-rose-600 font-bold">
                (Exceeds limit by {(charCount - MAX_CHARS).toLocaleString()} chars)
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={isLoading || !inputText}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
              title="Clear text"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <button
              type="button"
              id="check-writing-btn"
              onClick={() => handleAnalyze()}
              disabled={isLoading || !inputText.trim() || isOverLimit}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Analyzing your writing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Check My Writing</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error State Banner with Retry */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm flex items-start justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-800 dark:text-amber-300">Analysis Error</p>
              <p className="text-xs leading-relaxed">{errorMessage}</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Your writing was preserved above. Click Retry to try again.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleAnalyze()}
            disabled={isLoading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton Indicator */}
      {isLoading && !result && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-center space-y-4 animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center mx-auto text-indigo-600">
            <Sparkles className="w-6 h-6 animate-spin" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              Analyzing your writing...
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Evaluating grammar, phrasing, {selectedMode.toLowerCase()} style alignment, and vocabulary nuances...
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ANALYSIS RESULTS SECTION */}
      {/* ========================================================= */}
      {result && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* SECTION 1: Three Versions (Corrected, Natural, Original) */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {/* Version Tabs Header */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-1.5 bg-slate-200/80 dark:bg-slate-800 p-1 rounded-2xl">
                <button
                  type="button"
                  id="version-tab-corrected"
                  onClick={() => {
                    setActiveVersionTab('corrected');
                    playChime('click');
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeVersionTab === 'corrected'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Corrected Version</span>
                </button>
                <button
                  type="button"
                  id="version-tab-natural"
                  onClick={() => {
                    setActiveVersionTab('natural');
                    playChime('click');
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeVersionTab === 'natural'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Natural Version</span>
                </button>
                <button
                  type="button"
                  id="version-tab-original"
                  onClick={() => {
                    setActiveVersionTab('original');
                    playChime('click');
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeVersionTab === 'original'
                      ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <span>Original Writing</span>
                </button>
              </div>

              {/* Version Utilities: Copy & Read Aloud */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const textToRead =
                      activeVersionTab === 'corrected'
                        ? result.correctedText
                        : activeVersionTab === 'natural'
                        ? result.naturalVersion
                        : result.originalText;
                    handleTTS(textToRead);
                  }}
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium transition-all cursor-pointer"
                  title="Listen to pronunciation"
                >
                  <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Listen</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const textToCopy =
                      activeVersionTab === 'corrected'
                        ? result.correctedText
                        : activeVersionTab === 'natural'
                        ? result.naturalVersion
                        : result.originalText;
                    handleCopy(textToCopy, activeVersionTab);
                  }}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all cursor-pointer border border-indigo-200 dark:border-indigo-800"
                  title="Copy text to clipboard"
                >
                  {copiedTab === activeVersionTab ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Version Content Display */}
            <div className="p-6">
              {activeVersionTab === 'corrected' && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Grammatically Corrected (Preserving Your Meaning & Tone)</span>
                  </div>
                  <p className="text-base sm:text-lg text-slate-900 dark:text-white leading-relaxed font-sans select-all whitespace-pre-wrap">
                    {result.correctedText}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    Fixes genuine grammatical, tense, and agreement errors while leaving correct sentences undisturbed.
                  </p>
                </div>
              )}

              {activeVersionTab === 'natural' && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                    <span>Natural & Native Phrasing ({selectedMode} Style)</span>
                  </div>
                  <p className="text-base sm:text-lg text-slate-900 dark:text-white leading-relaxed font-sans select-all whitespace-pre-wrap">
                    {result.naturalVersion}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    Polishes sentence rhythm, transitions, and natural expressions tailored for {selectedMode.toLowerCase()}.
                  </p>
                </div>
              )}

              {activeVersionTab === 'original' && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                    <span>Your Original Submission</span>
                  </div>
                  <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap opacity-90">
                    {result.originalText}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 2: Writing Score Breakdown & Calibration */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  <span>Writing Proficiency Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  AI diagnostic estimates based on grammar accuracy, structure, and lexical variety.
                </p>
              </div>

              {/* Overall Score Badge */}
              <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-2xl border border-slate-100 dark:border-slate-700 shrink-0">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Overall Score:</span>
                <span className={`text-2xl font-black px-3 py-1 rounded-xl border ${getScoreColor(result.overallScore)} font-display`}>
                  {result.overallScore}
                  <span className="text-xs font-normal opacity-70 ml-0.5">/100</span>
                </span>
              </div>
            </div>

            {/* Sub-Score Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Grammar</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{result.grammarScore}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${result.grammarScore}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Vocabulary</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{result.vocabularyScore}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${result.vocabularyScore}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Structure</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{result.sentenceStructureScore}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${result.sentenceStructureScore}%` }}
                  />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
                  <span>Naturalness</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{result.naturalnessScore}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${result.naturalnessScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Score Rationale & Calibration Note */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-start space-x-2.5 text-xs">
              <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-indigo-900 dark:text-indigo-300">
                  Score Calibration:
                </span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {result.scoreReason}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: Identified Mistakes & Explanations */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Identified Corrections ({result.mistakes.length})
                </h3>
              </div>
              {result.mistakes.length === 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Flawless Grammar
                </span>
              )}
            </div>

            {result.mistakes.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  No grammatical errors detected!
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Your writing is grammatically sound. Check out the Natural Version above and vocabulary suggestions below for stylistic enhancements.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {result.mistakes.map((mistake, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700 space-y-2.5 transition-all"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {mistake.category}
                      </span>
                    </div>

                    {/* Diff Representation: Original -> Correction */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="line-through decoration-rose-500 decoration-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded font-mono text-xs">
                        "{mistake.original}"
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded font-mono text-xs">
                        "{mistake.correction}"
                      </span>
                    </div>

                    {/* Explanation in required language */}
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      {mistake.explanation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 4: Vocabulary Coach & Suggestions */}
          {result.vocabularySuggestions.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  <span>Vocabulary Upgrades ({result.vocabularySuggestions.length})</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Targeted word choices to elevate your writing in the {selectedMode} tone.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {result.vocabularySuggestions.map((vocab, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Original Word
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        "{vocab.original}"
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-1">
                        Better Alternatives
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {vocab.suggested.map((sug, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300 shadow-xs"
                          >
                            {sug}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40">
                      {vocab.explanation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECTION 5: Strengths & Actionable Improvement Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Writing Strengths (What You Did Well)</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                {result.strengths.map((str, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Improvement Tips */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 flex items-center space-x-1.5">
                <Lightbulb className="w-4 h-4 text-indigo-500" />
                <span>Next-Level Improvement Tips</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                {result.improvementTips.map((tip, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* SECTION 6: Interactive Practice Quiz (1 Question based on mistakes) */}
          {result.practiceExercise && (
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-md space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                    <Award className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                      Quick Practice Exercise
                    </span>
                    <h4 className="text-sm sm:text-base font-bold text-white">
                      Practice What You Just Learned
                    </h4>
                  </div>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200">
                  +10 XP
                </span>
              </div>

              {/* Question */}
              <p className="text-sm sm:text-base font-medium text-slate-200 leading-relaxed">
                {result.practiceExercise.question}
              </p>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.practiceExercise.options.map((opt, idx) => {
                  const isSelected = selectedPracticeOption === idx;
                  const isCorrect = idx === result.practiceExercise?.correctIndex;

                  let btnStyle = 'bg-white/10 hover:bg-white/20 border-white/20 text-white';
                  if (hasSubmittedPractice) {
                    if (isCorrect) {
                      btnStyle = 'bg-emerald-600/90 border-emerald-400 text-white font-bold ring-2 ring-emerald-400';
                    } else if (isSelected) {
                      btnStyle = 'bg-rose-600/90 border-rose-400 text-white line-through';
                    } else {
                      btnStyle = 'bg-white/5 border-white/10 text-white/50 opacity-60';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPracticeOption(idx)}
                      disabled={hasSubmittedPractice}
                      className={`p-4 rounded-2xl border text-left text-sm transition-all cursor-pointer flex items-center justify-between ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {hasSubmittedPractice && isCorrect && (
                        <Check className="w-4 h-4 text-emerald-300 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation after submission */}
              {hasSubmittedPractice && (
                <div className="p-3.5 rounded-xl bg-white/10 border border-white/20 text-xs text-slate-200 space-y-1 animate-in fade-in duration-200">
                  <div className="font-bold flex items-center space-x-1.5">
                    {selectedPracticeOption === result.practiceExercise.correctIndex ? (
                      <span className="text-emerald-400">Correct! Well done.</span>
                    ) : (
                      <span className="text-rose-300">Review the correct option above:</span>
                    )}
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {result.practiceExercise.explanation}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* EXAMPLES / PROMPTS MODAL */}
      {/* ========================================================= */}
      {showExamplesModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Sample Prompts & Practice Texts
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExamplesModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select any sample text to load into the Writing Coach editor:
              </p>
              {EXAMPLE_PROMPTS.map((ex, idx) => (
                <div
                  key={idx}
                  onClick={() => handleLoadExample(ex)}
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-all cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {ex.label}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {ex.mode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 italic">
                    "{ex.text}"
                  </p>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block font-medium">
                    {ex.description}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-right">
              <button
                type="button"
                onClick={() => setShowExamplesModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
