import React, { useState } from 'react';
import {
  Languages,
  ArrowRightLeft,
  Sparkles,
  Volume2,
  Copy,
  Check,
  CheckCircle2,
  BookOpen,
  Info,
  AlertTriangle,
  Lightbulb,
  RotateCcw,
} from 'lucide-react';
import { TranslationResult, AppSettings } from '../types';
import { TRANSLATION_PRESETS } from '../data/defaultData';
import { playTextToSpeech, playChime } from '../utils/speech';
import { GeminiService, AI_UNAVAILABLE_MESSAGE } from '../services/geminiService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Select';

interface TranslatorViewProps {
  settings: AppSettings;
  onUpdateUserXp: (xpToAdd: number) => void;
}

export const TranslatorView: React.FC<TranslatorViewProps> = ({
  settings,
  onUpdateUserXp,
}) => {
  const [direction, setDirection] = useState<'ur_to_en' | 'en_to_ur'>('ur_to_en');
  const [inputText, setInputText] = useState(
    'مجھے انگریزی بولتے وقت الفاظ کی کمی کا سامنا ہوتا ہے، لیکن میں روزانہ مشق کر رہا ہوں۔'
  );
  const [formality, setFormality] = useState('Natural');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);

  const handleSwapDirection = () => {
    playChime('click');
    const newDir = direction === 'ur_to_en' ? 'en_to_ur' : 'ur_to_en';
    setDirection(newDir);
    setErrorMessage('');
    if (result) {
      setInputText(result.translation);
      setResult(null);
    } else {
      setInputText(
        newDir === 'ur_to_en'
          ? 'میں ہر روز نئی چیزیں سیکھنے کی کوشش کرتا ہوں۔'
          : 'I try to learn new concepts every single day.'
      );
    }
  };

  const handleTranslate = async (overrideText?: string) => {
    const text = (overrideText || inputText).trim();
    if (!text || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');
    playChime('click');

    try {
      const data = await GeminiService.translateText({
        text,
        mode: direction,
        formality,
      });

      setResult(data);
      onUpdateUserXp(15);
      playChime('success');
    } catch (err: any) {
      console.error('Translation error:', err);
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
        icon={Languages}
        title="Urdu ↔ English Contextual Translator"
        description="Translate expressions naturally between Urdu and English with Roman Urdu phonetic guidance and grammatical contrast notes."
        badge="Bilingual"
      />

      {/* Direction & Options Controls */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Badge
              variant={direction === 'ur_to_en' ? 'primary' : 'default'}
              size="md"
              className="px-3 py-1 text-xs"
            >
              Urdu (اردو)
            </Badge>

            <button
              id="swap-direction-btn"
              onClick={handleSwapDirection}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="Swap translation direction"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>

            <Badge
              variant={direction === 'en_to_ur' ? 'primary' : 'default'}
              size="md"
              className="px-3 py-1 text-xs"
            >
              English (انگریزی)
            </Badge>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">Formality:</span>
            <select
              value={formality}
              onChange={(e) => setFormality(e.target.value)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="Natural">Natural & Idiomatic</option>
              <option value="Formal & Workplace">Formal & Workplace</option>
              <option value="Casual & Conversational">Casual & Friendly</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Presets */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Frequent Bilingual Expressions & Idioms
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TRANSLATION_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                const text = direction === 'ur_to_en' ? p.urdu : p.english;
                setInputText(text);
                handleTranslate(text);
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-700 transition-all cursor-pointer font-urdu"
            >
              {p.urdu.slice(0, 32)}...
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <textarea
            id="translator-input-textarea"
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              direction === 'ur_to_en'
                ? 'یہاں اردو میں جملہ لکھیں یا پیسٹ کریں...'
                : 'Type or paste English sentence to translate to natural Urdu...'
            }
            className={`w-full p-3.5 rounded-xl text-base border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all ${
              direction === 'ur_to_en' ? 'font-urdu text-right text-lg' : ''
            }`}
          />

          <div className="flex items-center justify-end">
            <Button
              id="run-translation-btn"
              onClick={() => handleTranslate()}
              disabled={!inputText.trim() || isLoading}
              isLoading={isLoading}
              variant="primary"
              size="md"
              leftIcon={<Languages className="w-4 h-4" />}
            >
              Translate
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
              onClick={() => handleTranslate()}
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

      {/* Output Results */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Main Translation Result Card */}
          <Card className="border-indigo-200/80 dark:border-indigo-900/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <CardTitle className="text-xs text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                  Idiomatic Translation ({result.formalityUsed})
                </CardTitle>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() =>
                    playTextToSpeech(result.translation, {
                      accent: settings.accentPreference,
                      rate: settings.speechRate,
                    })
                  }
                  className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  title="Listen to audio"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => handleCopy(result.translation)}
                  leftIcon={copied ? <Check className="w-3 h-3 text-indigo-600" /> : <Copy className="w-3 h-3" />}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <p
                className={`text-xl font-bold text-slate-900 dark:text-white leading-relaxed ${
                  direction === 'en_to_ur' ? 'font-urdu text-right text-2xl leading-loose' : ''
                }`}
              >
                "{result.translation}"
              </p>

              {result.romanUrdu && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center space-x-2 text-xs text-indigo-700 dark:text-indigo-300 font-mono">
                  <span className="font-semibold font-sans">Roman Urdu:</span>
                  <span>"{result.romanUrdu}"</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Natural Alternatives */}
          {result.alternatives && result.alternatives.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <CardTitle className="text-sm">Alternative Natural Phrasings</CardTitle>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.alternatives.map((alt, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-2"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {alt.label}
                      </span>
                      <p
                        className={`text-xs font-semibold text-slate-800 dark:text-slate-200 leading-relaxed ${
                          direction === 'en_to_ur' ? 'font-urdu text-right text-sm' : ''
                        }`}
                      >
                        "{alt.text}"
                      </p>
                      <button
                        onClick={() => handleCopy(alt.text)}
                        className="text-[11px] text-slate-400 hover:text-indigo-600 font-semibold cursor-pointer block"
                      >
                        Copy phrasing
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anatomical Vocabulary Breakdown */}
          {result.breakdown && result.breakdown.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <CardTitle className="text-sm">Vocabulary Breakdown & Syntactic Notes</CardTitle>
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {result.breakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.source}
                        </span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          → {item.target}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {item.note}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grammar & Structural Contrast Note */}
          {result.grammarTip && (
            <Card>
              <CardContent className="p-4 flex items-start space-x-3 text-xs text-slate-700 dark:text-slate-300">
                <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block mb-0.5">
                    Bilingual Structure Insight:
                  </span>
                  <span className="leading-relaxed">{result.grammarTip}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!result && !isLoading && !errorMessage && (
        <EmptyState
          icon={Languages}
          title="No active translation yet"
          description="Enter an Urdu or English sentence above and click Translate to see idiomatic translations, alternatives, and phonetic guides."
        />
      )}
    </div>
  );
};
