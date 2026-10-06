import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  Volume2,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { GrammarAnalysisResult, AppSettings, UserProfile } from '../types';
import { GRAMMAR_PRESETS } from '../data/defaultData';
import { playTextToSpeech, playChime } from '../utils/speech';
import { GeminiService, AI_UNAVAILABLE_MESSAGE } from '../services/geminiService';
import { recordGrammarMistakesContext } from '../utils/learningEngine';
import { recordGrammarMistakes } from '../utils/learningMemory';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Select';

interface GrammarViewProps {
  settings: AppSettings;
  onUpdateUserXp: (xpToAdd: number) => void;
  user?: UserProfile;
}

export const GrammarView: React.FC<GrammarViewProps> = ({
  settings,
  onUpdateUserXp,
  user,
}) => {
  const [inputText, setInputText] = useState(
    'Yesterday I did not went to office because I was having fever and doctor told me to take rest.'
  );
  const [selectedTone, setSelectedTone] = useState('Professional & Natural');
  const [learnerLevel, setLearnerLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<(GrammarAnalysisResult & { explanation?: string; naturalAlternative?: string }) | null>(null);

  const handleAnalyze = async (textToUse?: string) => {
    const text = (textToUse || inputText).trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');
    playChime('click');

    try {
      const data = await GeminiService.checkGrammar({
        text,
        targetTone: selectedTone,
        level: learnerLevel,
      });

      setResult(data);
      onUpdateUserXp(20);
      if (data.errors && data.errors.length > 0) {
        const errorCategories = data.errors.map((e) => e.type || e.explanation).filter(Boolean);
        recordGrammarMistakesContext(user?.uid || user?.id || 'guest_user', errorCategories);
        recordGrammarMistakes(
          user?.uid || user?.id || 'guest_user',
          data.errors.map((e) => ({
            category: e.type,
            original: e.original,
            correction: e.suggestion,
            explanation: e.explanation,
          }))
        );
      }
      playChime('success');
    } catch (err: any) {
      console.error('Grammar check error:', err);
      setErrorMessage(err.message || AI_UNAVAILABLE_MESSAGE);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    playChime('click');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        icon={ShieldCheck}
        title="Instant Grammar Doctor"
        description="Inspect English syntax, correct common agreement errors, and examine native stylistic alternatives."
        badge="Proofreader"
      />

      {/* Input Card */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          {/* Preset chips for fast testing */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Common Bilingual / ESL Patterns
            </label>
            <div className="flex flex-wrap gap-1.5">
              {GRAMMAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputText(preset.text);
                    handleAnalyze(preset.text);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer"
                >
                  "{preset.title}"
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              id="grammar-input-textarea"
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type or paste any English sentence, paragraph, or email to check..."
              className="w-full p-3.5 rounded-xl text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed resize-none transition-all"
            />
            <div className="absolute right-3 bottom-3 text-[11px] text-slate-400 font-mono">
              {inputText.trim().split(/\s+/).filter(Boolean).length} words
            </div>
          </div>

          {/* Level, Tone and Submit Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              {/* Level selector */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Level:</span>
                <div className="flex items-center space-x-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLearnerLevel(lvl)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        learnerLevel === lvl
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone selector */}
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tone:</span>
                <select
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="Professional & Natural">Professional & Natural</option>
                  <option value="Formal & Academic">Formal & Academic</option>
                  <option value="Casual & Conversational">Casual & Conversational</option>
                  <option value="Native Idiomatic">Native Idiomatic</option>
                </select>
              </div>
            </div>

            <Button
              id="check-grammar-btn"
              onClick={() => handleAnalyze()}
              disabled={!inputText.trim() || isLoading}
              isLoading={isLoading}
              variant="primary"
              size="md"
              leftIcon={<ShieldCheck className="w-4 h-4" />}
            >
              Check & Correct Grammar
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
              onClick={() => handleAnalyze()}
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

      {/* Analysis Result Box */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Score & Summary Banner */}
          <Card>
            <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Linguistic Assessment:
                  </span>
                  <Badge variant="primary" size="sm">
                    {result.fluencyLevel}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {result.summary}
                </p>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex flex-col items-center justify-center shrink-0">
                <span className="text-xl font-extrabold font-display leading-none">{result.overallScore}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">Score</span>
              </div>
            </CardContent>
          </Card>

          {/* Original vs Corrected Text */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Original */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-slate-400 uppercase tracking-wider">
                  Original Text
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                  "{result.originalText}"
                </p>
              </CardContent>
            </Card>

            {/* Corrected */}
            <Card className="border-emerald-200/80 dark:border-emerald-900/60">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <CardTitle className="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                    Corrected Text
                  </CardTitle>
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() =>
                      playTextToSpeech(result.correctedText, {
                        accent: settings.accentPreference,
                        rate: settings.speechRate,
                      })
                    }
                    className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Listen to pronunciation"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleCopy(result.correctedText)}
                    leftIcon={copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                  "{result.correctedText}"
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Simple Explanation */}
          {result.explanation && (
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Lightbulb className="w-4 h-4" />
                  <span>{learnerLevel === 'Beginner' ? 'Key Learning Takeaway' : 'Linguistic Explanation'}:</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {result.explanation}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Natural Alternative */}
          {result.naturalAlternative && (
            <Card className="border-sky-200/80 dark:border-sky-900/60">
              <CardContent className="p-4 sm:p-5 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Natural Native Phrasing:</span>
                </div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  "{result.naturalAlternative}"
                </p>
              </CardContent>
            </Card>
          )}

          {/* Specific Errors & Mistakes Breakdown */}
          {result.errors && result.errors.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-sm">Identified Mistakes & Explanations ({result.errors.length})</CardTitle>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {result.errors.map((err, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="primary" size="sm">
                        {err.type}
                      </Badge>
                      <div className="flex items-center space-x-2">
                        <span className="text-rose-600 dark:text-rose-400 line-through font-medium">
                          "{err.original}"
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          "{err.suggestion}"
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      {err.explanation}
                    </p>

                    {settings.showUrduAssistance && err.urduTip && (
                      <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 font-urdu text-amber-950 dark:text-amber-200 text-xs leading-relaxed">
                        اردو رہنمائی: {err.urduTip}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Alternative Phrasings (Formal, Casual, Idiomatic) */}
          {result.alternativeVersions && result.alternativeVersions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Contextual Alternatives</CardTitle>
                <CardDescription className="text-xs">Phrased for different scenarios</CardDescription>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {result.alternativeVersions.map((alt, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {alt.tone}
                      </span>
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                        "{alt.text}"
                      </p>
                      <button
                        onClick={() => handleCopy(alt.text)}
                        className="text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold cursor-pointer block pt-1"
                      >
                        Copy version
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!result && !isLoading && !errorMessage && (
        <EmptyState
          icon={ShieldCheck}
          title="No grammar diagnoses yet"
          description="Enter a sentence or pick a sample preset above and click Check & Correct Grammar to receive immediate fluency insights."
        />
      )}
    </div>
  );
};
