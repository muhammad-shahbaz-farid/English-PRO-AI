import React, { useState } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Volume2,
  CheckCircle2,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  Check,
  BrainCircuit,
  Bookmark,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { VocabularyWord, AppSettings, UserProfile } from '../types';
import { playTextToSpeech, playChime } from '../utils/speech';
import { GeminiService, AI_UNAVAILABLE_MESSAGE } from '../services/geminiService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageHeader } from '../components/ui/PageHeader';
import { Select } from '../components/ui/Select';
import { EmptyState } from '../components/ui/EmptyState';

interface VocabularyViewProps {
  vocabulary: VocabularyWord[];
  setVocabulary: (words: VocabularyWord[]) => void;
  settings: AppSettings;
  user: UserProfile;
  onUpdateUserXp: (xpToAdd: number) => void;
}

const TOPICS = [
  'Daily Life & Routine',
  'Workplace & Career',
  'Technology & Digital',
  'Travel & Exploration',
  'University & Academic',
  'Social & Friends',
  'Food & Dining',
  'Healthcare & Wellness',
];

export const VocabularyView: React.FC<VocabularyViewProps> = ({
  vocabulary,
  setVocabulary,
  settings,
  user,
  onUpdateUserXp,
}) => {
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[0]);
  const [selectedLevel, setSelectedLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'flashcard' | 'list'>('flashcard');
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const currentWord: VocabularyWord | undefined = vocabulary[activeWordIndex] || vocabulary[0];

  const handleNextWord = () => {
    setIsFlipped(false);
    setSelectedQuizAnswer(null);
    setQuizSubmitted(false);
    setActiveWordIndex((prev) => (prev + 1) % vocabulary.length);
  };

  const handlePrevWord = () => {
    setIsFlipped(false);
    setSelectedQuizAnswer(null);
    setQuizSubmitted(false);
    setActiveWordIndex((prev) => (prev - 1 + vocabulary.length) % vocabulary.length);
  };

  const handleToggleMastered = (wordId: string) => {
    playChime('success');
    const updated = vocabulary.map((w) =>
      w.id === wordId ? { ...w, isMastered: !w.isMastered } : w
    );
    setVocabulary(updated);
    onUpdateUserXp(15);
  };

  // Generate fresh vocabulary based on Topic + Level
  const handleGenerateVocabulary = async (customWord?: string) => {
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage('');
    playChime('click');

    const existingNames = vocabulary.map((v) => v.word.toLowerCase());

    try {
      const newWord = await GeminiService.generateVocabulary({
        word: customWord?.trim(),
        topic: selectedTopic,
        level: selectedLevel,
        existingWords: existingNames,
      });

      const existingIdx = vocabulary.findIndex(
        (v) => v.word.toLowerCase() === newWord.word.toLowerCase()
      );

      if (existingIdx !== -1) {
        setActiveWordIndex(existingIdx);
      } else {
        const updated = [newWord, ...vocabulary];
        setVocabulary(updated);
        setActiveWordIndex(0);
      }

      setIsFlipped(false);
      setSelectedQuizAnswer(null);
      setQuizSubmitted(false);
      setSearchQuery('');
      onUpdateUserXp(25);
      playChime('xp');
    } catch (err: any) {
      console.error('Vocabulary generation error:', err);
      setErrorMessage(err.message || AI_UNAVAILABLE_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizSubmit = (optIndex: number) => {
    if (quizSubmitted || !currentWord) return;
    setSelectedQuizAnswer(optIndex);
    setQuizSubmitted(true);
    const isCorrect = currentWord.quizQuestion?.correctIndex === optIndex;
    if (isCorrect) {
      playChime('success');
      onUpdateUserXp(20);
    } else {
      playChime('click');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <PageHeader
        icon={BookOpen}
        title="Vocabulary Vault & Flashcards"
        description="Expand conversational and workplace English with CEFR-graded words, bilingual Urdu translations, phonetics, and recall quizzes."
        badge="Lexicon"
        actions={
          <div className="flex items-center space-x-2">
            <Badge variant="primary" size="md">
              {vocabulary.length} Words in Bank
            </Badge>
          </div>
        }
      />

      {/* Generation Bar: Level + Topic + Action */}
      <Card>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Level Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Proficiency Level:
              </label>
              <div className="flex items-center space-x-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      selectedLevel === lvl
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic Selector */}
            <div className="flex-1 max-w-sm">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Contextual Domain / Topic:
              </label>
              <Select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
              >
                {TOPICS.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </Select>
            </div>

            {/* Generate Button */}
            <div className="self-end md:self-auto pt-2 md:pt-5">
              <Button
                onClick={() => handleGenerateVocabulary()}
                disabled={isLoading}
                isLoading={isLoading}
                variant="primary"
                size="md"
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Generate Word
              </Button>
            </div>
          </div>

          {/* Custom term search / generate */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    e.preventDefault();
                    handleGenerateVocabulary(searchQuery);
                  }
                }}
                placeholder="Or enter any specific English word to explore (e.g. 'Nuance', 'Persevere')..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleGenerateVocabulary(searchQuery)}
              disabled={!searchQuery.trim() || isLoading}
            >
              Explore Word
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
              onClick={() => handleGenerateVocabulary(searchQuery || undefined)}
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

      {/* View Mode Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('flashcard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'flashcard'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Interactive Flashcard
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Vault List ({vocabulary.length})
          </button>
        </div>

        {activeTab === 'flashcard' && vocabulary.length > 0 && (
          <div className="text-xs font-semibold text-slate-400">
            Card {activeWordIndex + 1} of {vocabulary.length}
          </div>
        )}
      </div>

      {/* Main Flashcard View */}
      {activeTab === 'flashcard' && currentWord ? (
        <div className="space-y-6">
          <Card
            hoverEffect
            onClick={() => setIsFlipped(!isFlipped)}
            className="min-h-[360px] p-6 sm:p-8 cursor-pointer flex flex-col justify-between"
          >
            {/* Card Header Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Badge variant="primary" size="sm">
                  {currentWord.cefrLevel}
                </Badge>
                <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                  {currentWord.partOfSpeech}
                </span>
              </div>

              <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() =>
                    playTextToSpeech(currentWord.word, {
                      accent: settings.accentPreference,
                      rate: settings.speechRate,
                    })
                  }
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Listen to pronunciation"
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleToggleMastered(currentWord.id)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    currentWord.isMastered
                      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title={currentWord.isMastered ? 'Mark as Unmastered' : 'Mark as Mastered'}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Middle Content */}
            {!isFlipped ? (
              /* Front of card */
              <div className="text-center py-6 space-y-2.5">
                <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">
                  {currentWord.word}
                </h3>
                <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                  {currentWord.phonetic}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed pt-1">
                  {currentWord.definition}
                </p>
                <span className="text-[11px] text-slate-400 inline-block pt-3">
                  (Tap card to reveal Urdu meaning & sentence examples)
                </span>
              </div>
            ) : (
              /* Back of card */
              <div className="py-2 space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-center space-y-1 font-urdu">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 block">
                    اردو مفہوم:
                  </span>
                  <h4 className="text-xl font-extrabold text-amber-950 dark:text-amber-100">
                    {currentWord.urduMeaning}
                  </h4>
                  {currentWord.urduExplanation && (
                    <p className="text-xs text-amber-900 dark:text-amber-200 pt-0.5 leading-relaxed">
                      {currentWord.urduExplanation}
                    </p>
                  )}
                </div>

                {/* Example sentences */}
                {currentWord.examples && currentWord.examples.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Sentence Usage:
                    </span>
                    {currentWord.examples.map((ex, i) => (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-0.5"
                      >
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          • "{ex.en}"
                        </p>
                        {ex.ur && (
                          <p className="text-slate-500 dark:text-slate-400 font-urdu text-[11px]">
                            {ex.ur}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Card Footer: Synonyms & Collocations */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Synonyms:</span>
                <span>{currentWord.synonyms.slice(0, 3).join(', ') || 'N/A'}</span>
              </div>
              <div className="flex items-center space-x-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
                <RotateCw className="w-3.5 h-3.5" />
                <span>Click to Flip</span>
              </div>
            </div>
          </Card>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between">
            <Button
              onClick={handlePrevWord}
              variant="secondary"
              size="sm"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Previous Word
            </Button>

            <Button
              onClick={handleNextWord}
              variant="primary"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Next Word
            </Button>
          </div>

          {/* Quick Quiz Card */}
          {currentWord.quizQuestion && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center space-x-2">
                  <BrainCircuit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <CardTitle className="text-sm">Quick Retention Quiz</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {currentWord.quizQuestion.question}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentWord.quizQuestion.options.map((opt, optIdx) => {
                    const isSelected = selectedQuizAnswer === optIdx;
                    const isCorrect = currentWord.quizQuestion?.correctIndex === optIdx;

                    let btnStyle =
                      'p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-indigo-400';

                    if (quizSubmitted) {
                      if (isCorrect) {
                        btnStyle =
                          'p-2.5 rounded-xl border text-xs font-bold text-left bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-200';
                      } else if (isSelected) {
                        btnStyle =
                          'p-2.5 rounded-xl border text-xs font-bold text-left bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-200';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        disabled={quizSubmitted}
                        onClick={() => handleQuizSubmit(optIdx)}
                        className={btnStyle}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {quizSubmitted && (
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between pt-1">
                    <span>
                      {selectedQuizAnswer === currentWord.quizQuestion.correctIndex
                        ? 'Correct! +20 XP awarded'
                        : 'Review the definition above and try again on next flip.'}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedQuizAnswer(null);
                        setQuizSubmitted(false);
                      }}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Reset Quiz
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* List Mode */
        <div className="space-y-2.5">
          {vocabulary.map((w, idx) => (
            <Card
              key={w.id}
              hoverEffect
              onClick={() => {
                setActiveWordIndex(idx);
                setActiveTab('flashcard');
              }}
              className="p-4 cursor-pointer flex items-center justify-between"
            >
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {w.word}
                  </span>
                  <Badge variant="primary" size="sm">
                    {w.cefrLevel}
                  </Badge>
                  <span className="text-xs font-mono text-slate-400">{w.phonetic}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                  {w.definition}
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0 ml-4">
                <span className="font-urdu text-sm font-bold text-amber-800 dark:text-amber-300">
                  {w.urduMeaning}
                </span>
                {w.isMastered && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
