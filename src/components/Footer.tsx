import React from 'react';
import { AppView } from '../types';

interface FooterProps {
  currentView?: AppView;
  setCurrentView: (view: AppView) => void;
}

export const Footer: React.FC<FooterProps> = ({ currentView, setCurrentView }) => {
  // Only render full footer on landing view or at end of public page
  if (currentView !== 'landing') {
    return null;
  }

  return (
    <footer className="w-full bg-[#F8F9FA] dark:bg-[#0B0D10] border-t border-slate-200 dark:border-white/[0.07] pt-12 pb-10 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-200 dark:border-white/[0.06]">
          {/* Brand Info */}
          <div className="space-y-2.5 md:col-span-1">
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-[#F5F7FA]">
                EnglishPro<span className="text-[#6D6FF2] font-semibold text-[11px] ml-1 px-1.5 py-0.5 rounded-[4px] bg-[#6D6FF2]/10 border border-[#6D6FF2]/20">AI</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#A8B0BA] leading-relaxed">
              Practice English. Build Confidence. Speak Better. Personalized learning for English learners.
            </p>
          </div>

          {/* Tools */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#727B87] mb-3">
              Practice Modules
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-[#A8B0BA]">
              <li>
                <button onClick={() => setCurrentView('conversation')} className="hover:text-[#6D6FF2] transition-colors cursor-pointer">
                  AI Conversation
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('writing')} className="hover:text-[#6D6FF2] transition-colors cursor-pointer">
                  Writing Coach
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('grammar')} className="hover:text-[#6D6FF2] transition-colors cursor-pointer">
                  Grammar Doctor
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('vocabulary')} className="hover:text-[#6D6FF2] transition-colors cursor-pointer">
                  Vocabulary Vault
                </button>
              </li>
              <li>
                <button onClick={() => setCurrentView('translator')} className="hover:text-[#6D6FF2] transition-colors cursor-pointer">
                  Urdu ↔ English Translator
                </button>
              </li>
            </ul>
          </div>

          {/* Curriculum */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#727B87] mb-3">
              Learning Scenarios
            </h4>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-[#A8B0BA]">
              <li>Job Interviews & Standups</li>
              <li>IELTS Speaking Practice</li>
              <li>Workplace & Business Pitch</li>
              <li>Everyday Travel & Cafe</li>
              <li>Roman Urdu Transliterations</li>
            </ul>
          </div>

          {/* Bilingual Support */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-[#727B87] mb-2 font-urdu">
              اردو بولنے والوں کے لیے
            </h4>
            <p className="text-xs text-slate-600 dark:text-[#A8B0BA] leading-relaxed font-urdu">
              انگریزی بولتے وقت جھجھک ختم کریں۔ ہر لفظ کی اردو وضاحت، روزمرہ استعمال کی مثالیں اور بول چال کی مکمل مشق۔
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-[#727B87]">
          <p>© 2026 EnglishPro AI. Designed for deliberate language mastery.</p>
          <div className="flex items-center space-x-4 mt-2 sm:mt-0">
            <span className="hover:text-slate-900 dark:hover:text-[#F5F7FA] cursor-pointer">Privacy</span>
            <span>•</span>
            <span className="hover:text-slate-900 dark:hover:text-[#F5F7FA] cursor-pointer">Terms</span>
            <span>•</span>
            <button onClick={() => setCurrentView('settings')} className="hover:text-slate-900 dark:hover:text-[#F5F7FA] cursor-pointer">
              Preferences
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
