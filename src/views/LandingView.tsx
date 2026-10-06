import React from 'react';
import {
  Sparkles,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  BookOpen,
  Languages,
  Zap,
  CheckCircle2,
  Volume2,
  Award,
  Globe,
  Star,
  Users,
  Play,
  User as UserIcon,
} from 'lucide-react';
import { AppView, UserProfile } from '../types';
import { playTextToSpeech } from '../utils/speech';

interface LandingViewProps {
  onGetStarted: () => void;
  setCurrentView: (view: AppView) => void;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
  user?: UserProfile;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onGetStarted,
  setCurrentView,
  onOpenLogin,
  onOpenSignup,
  user,
}) => {
  const isAuthUser = user && user.isLoggedIn && !user.isGuest;

  return (
    <div className="w-full space-y-20 pb-16">
      {/* Hero Section */}
      <section className="relative pt-12 md:pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Subtle decorative background glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-3/4 max-w-3xl h-64 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 blur-3xl -z-10 rounded-full pointer-events-none" />

        <div className="text-center max-w-3xl mx-auto space-y-6">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>AI-Powered English Practice</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.1] font-display">
            Practice English.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500">
              Build Confidence.
            </span>{' '}
            Speak Better.
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            AI-powered English practice for speaking, grammar, vocabulary and everyday communication.
          </p>

          {/* Urdu Subtitle for bilingual resonance */}
          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 max-w-xl mx-auto">
            <p className="text-sm font-urdu text-amber-950 dark:text-amber-200 text-center leading-relaxed">
              انگریزی بولتے وقت جھجھک اور خوف ختم کریں۔ روزمرہ مکالمات، گرامر کی فوری درستی اور اردو رہنمائی کے ساتھ روانی حاصل کریں۔
            </p>
          </div>

          {/* CTAs */}
          {isAuthUser ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                id="hero-cta-dashboard-btn"
                onClick={() => setCurrentView('dashboard')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2.5 transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                <span>Open Your Dashboard</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                id="hero-cta-conversation-btn"
                onClick={() => setCurrentView('conversation')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-base border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 text-indigo-500" />
                <span>Resume Practice</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  id="hero-cta-signup-btn"
                  onClick={onOpenSignup || onGetStarted}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Sign Up / Create Account</span>
                  <ArrowRight className="w-5 h-5" />
                </button>

                <button
                  id="hero-cta-signin-btn"
                  onClick={onOpenLogin || onGetStarted}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-base border border-slate-200 dark:border-slate-700 shadow-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-indigo-500" />
                  <span>Sign In</span>
                </button>

                <button
                  id="hero-cta-explore-btn"
                  onClick={() => setCurrentView('conversation')}
                  className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <MessageSquare className="w-4 h-4 text-slate-400" />
                  <span>Try as Guest</span>
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Already registered?{' '}
                <button
                  onClick={onOpenLogin || onGetStarted}
                  className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Sign In
                </button>
                {' '}• Or{' '}
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="font-semibold text-slate-700 dark:text-slate-300 hover:underline cursor-pointer"
                >
                  Continue without signing in
                </button>
              </p>
            </div>
          )}

          {/* Trust points */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Voice Speech Synthesis & STT</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>A1 to C2 CEFR Alignment</span>
            </div>
          </div>
        </div>

        {/* Live Interactive Teaser Card */}
        <div className="mt-14 max-w-4xl mx-auto rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-rose-400"></span>
              <span className="w-3 h-3 rounded-full bg-amber-400"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
              <span className="ml-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                EnglishPro AI • Live Session Simulator (Job Interview)
              </span>
            </div>
            <button
              onClick={() => playTextToSpeech("Welcome to our company interview! Could you share how you resolve challenging technical obstacles?", { accent: 'American' })}
              className="flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              title="Listen to sample audio"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Play Sample Voice</span>
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* AI Speech Bubble */}
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 font-bold text-xs shadow-sm">
                AI
              </div>
              <div className="flex-1 rounded-2xl rounded-tl-xs p-4 bg-indigo-50/70 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/60 text-slate-800 dark:text-slate-200 text-sm">
                <p className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 mb-1">
                  Senior Hiring Manager • Software Tech Role
                </p>
                "Welcome to our company interview! Could you share how you resolve challenging technical obstacles in your team?"
              </div>
            </div>

            {/* User Speech Bubble with real-time feedback tag */}
            <div className="flex items-start space-x-3 justify-end">
              <div className="flex-1 max-w-lg rounded-2xl rounded-tr-xs p-4 bg-slate-900 text-white dark:bg-indigo-600 text-sm">
                <p className="text-xs text-slate-300 dark:text-indigo-200 mb-1 font-semibold">You (Learner):</p>
                "When I face a bug, I first break down problem and discuss with senior before making changes."
              </div>
              <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white flex items-center justify-center shrink-0 font-bold text-xs">
                You
              </div>
            </div>

            {/* AI Real-time Grammar Feedback box */}
            <div className="ml-12 p-3.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>AI Real-Time Polish & Grammar Advice:</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                  92% Fluency
                </span>
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-white">Polished Native Phrasing:</span> "When I encounter a bug, I first break down <span className="underline decoration-indigo-500 font-semibold">the</span> problem and consult with <span className="underline decoration-indigo-500 font-semibold">a</span> senior colleague."
              </p>
              <p className="text-slate-500 dark:text-slate-400 font-urdu text-[11px]">
                اردو رہنمائی: "break down problem" کی بجائے "break down the problem" کہیں کیونکہ اسم معرفہ (definite noun) کے ساتھ article 'the' ضروری ہے۔
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-2">
            Engineered for Total Mastery
          </h2>
          <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white font-display">
            Everything You Need to Speak English Confidently
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Five specialized AI learning engines working together to elevate your conversation, grammar, and vocabulary.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div
            onClick={() => setCurrentView('conversation')}
            className="group p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all hover:shadow-xl cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              AI Conversation Practice
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Roleplay real-world scenarios: tech job interviews, team standups, IELTS speaking exams, coffee shops, and travel customs with voice synthesis.
            </p>
            <div className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
              <span>Start Speaking</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Feature 2 */}
          <div
            onClick={() => setCurrentView('grammar')}
            className="group p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all hover:shadow-xl cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Instant Grammar Doctor
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Paste any sentence to diagnose tense mismatches, preposition errors, and common ESL slips. Explains the rule in simple English and Urdu.
            </p>
            <div className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
              <span>Fix Your Grammar</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Feature 3 */}
          <div
            onClick={() => setCurrentView('vocabulary')}
            className="group p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500 transition-all hover:shadow-xl cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Vocab Vault & Flashcards
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Curated CEFR A1-C2 vocabulary with memory mnemonics, audio pronunciation, collocations, Urdu translations, and interactive flashcard quizzes.
            </p>
            <div className="flex items-center text-xs font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform">
              <span>Expand Vocabulary</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Feature 4 */}
          <div
            onClick={() => setCurrentView('translator')}
            className="group p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500 transition-all hover:shadow-xl cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Languages className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Urdu ↔ English Tarjuma Pro
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Translates naturally while teaching you the structural differences between Urdu SOV and English SVO. Includes Roman Urdu and formality variants.
            </p>
            <div className="flex items-center text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform">
              <span>Open Translator</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Feature 5 */}
          <div
            onClick={() => setCurrentView('challenges')}
            className="group p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500 transition-all hover:shadow-xl cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Daily English Quests
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              10-minute daily bite-sized missions to keep your streak alive. Earn XP points, unlock fluency badges, and build permanent speaking habits.
            </p>
            <div className="flex items-center text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:translate-x-1 transition-transform">
              <span>View Today's Quests</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          {/* Feature 6 */}
          <div
            onClick={() => setCurrentView('progress')}
            className="group p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500 transition-all hover:shadow-xl cursor-pointer"
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Award className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              CEFR Level Tracking
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              Watch your English skills rise systematically from A1 Beginner up to C2 Native Fluency with analytics on grammar accuracy and speaking hours.
            </p>
            <div className="flex items-center text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform">
              <span>View Analytics</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>
      </section>

      {/* How it works 3-step section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white shadow-2xl">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-300">
              Your Daily 15-Minute Blueprint
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold mt-1 font-display">
              How EnglishPro AI Delivers Fluency
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/30 text-indigo-300 flex items-center justify-center font-bold text-base">
                1
              </div>
              <h4 className="text-base font-bold">Choose Real-World Scenario</h4>
              <p className="text-xs text-indigo-100/70 leading-relaxed">
                Pick a scenario that matches your immediate life needs: job interview, standup meeting, IELTS speaking, or cafe conversations.
              </p>
            </div>

            <div className="space-y-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-base">
                2
              </div>
              <h4 className="text-base font-bold">Speak or Chat Freely</h4>
              <p className="text-xs text-indigo-100/70 leading-relaxed">
                Interact with the AI tutor using your voice or keyboard. Hear the tutor respond in native American, British, or Australian accents.
              </p>
            </div>

            <div className="space-y-3 p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="w-10 h-10 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center font-bold text-base">
                3
              </div>
              <h4 className="text-base font-bold">Instant Bilingual Feedback</h4>
              <p className="text-xs text-indigo-100/70 leading-relaxed">
                Receive sentence corrections, IPA phonetics tips, and Urdu explanations to immediately fix errors before they become bad habits.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={onGetStarted}
              className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 cursor-pointer"
            >
              Start Your First 15-Minute Session
            </button>
          </div>
        </div>
      </section>

      {/* Learner Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white font-display">
            Loved by Students, Engineers, & IELTS Aspirants
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real stories from bilingual learners who transformed their English fluency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center space-x-1 text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
              "As a software engineer in Lahore interviewing for US remote jobs, I was terrified of speaking English on Zoom. Practicing the 'Tech Standup' and 'Job Interview' scenarios for two weeks gave me the confidence to pass my technical interviews!"
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                AK
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Ahmed Kamal</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Full-Stack Developer</p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center space-x-1 text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
              "The IELTS Speaking simulator is brilliant. It asked the exact cue card questions I ended up receiving in my real exam. Scored an 8.0 on speaking! The Urdu grammar hints clarify things no textbook could."
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                AN
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Ayesha Noman</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">IELTS Band 8.0 Candidate</p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex items-center space-x-1 text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
              "The Urdu ↔ English translator with Roman Urdu and grammatical breakdowns taught me why my sentences sounded awkward. Now my emails and presentations sound completely natural."
            </p>
            <div className="flex items-center space-x-3 pt-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                MR
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">Muhammad Rizwan</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Business Manager</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="p-8 sm:p-12 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-4">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-display">
            Start Speaking Better English Today
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto">
            Join thousands of learners building permanent speaking confidence. 100% free web app with full AI coaching features.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenSignup || onGetStarted}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg shadow-indigo-500/25 inline-flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenLogin || onGetStarted}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-base border border-slate-200 dark:border-slate-700 shadow-xs inline-flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <UserIcon className="w-4 h-4 text-indigo-500" />
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
