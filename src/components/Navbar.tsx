import React from 'react';
import {
  Sun,
  Moon,
  Flame,
  Menu,
} from 'lucide-react';
import { AppView, UserProfile } from '../types';

interface NavbarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  user: UserProfile;
  darkMode?: boolean;
  setDarkMode?: (dark: boolean) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenAuth?: () => void;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
  isAuthenticated?: boolean;
  onLogout: () => void;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  setCurrentView,
  user,
  darkMode = false,
  setDarkMode,
  theme,
  onToggleTheme,
  onOpenAuth,
  onOpenLogin,
  onOpenSignup,
  isAuthenticated = !!user.isLoggedIn && !user.isGuest,
  onToggleMobileMenu,
}) => {
  const isDark = theme ? theme === 'dark' : darkMode;
  const toggleDark = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else if (setDarkMode) {
      setDarkMode(!isDark);
    }
  };

  const isLanding = currentView === 'landing';

  if (!isLanding) {
    // In-app mobile top-bar (Desktop uses persistent Sidebar)
    return (
      <header className="lg:hidden sticky top-0 z-30 h-14 w-full bg-[#F1F3F5] dark:bg-[#0D1014] border-b border-slate-200 dark:border-white/[0.07] px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 -ml-1 rounded-[7px] text-slate-600 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA] hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex items-center space-x-1 cursor-pointer text-left focus-visible:outline-none"
          >
            <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-[#F5F7FA]">
              EnglishPro<span className="text-[#6D6FF2] font-semibold text-[10px] ml-1 px-1 py-0.2 rounded bg-[#6D6FF2]/10 border border-[#6D6FF2]/20">AI</span>
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {!isAuthenticated && (
            <button
              onClick={onOpenLogin || onOpenAuth}
              className="px-2.5 py-1 text-xs font-medium rounded-[6px] bg-[#6D6FF2] text-white hover:bg-[#7C7FF5] transition-colors cursor-pointer"
            >
              Sign In
            </button>
          )}

          {user.streakDays > 0 && (
            <div className="flex items-center space-x-1 text-xs font-medium text-amber-600 dark:text-amber-400 px-2 py-1 rounded-[6px] bg-amber-500/10 border border-amber-500/20">
              <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>{user.streakDays}d</span>
            </div>
          )}

          <button
            onClick={toggleDark}
            className="p-1.5 rounded-[7px] text-slate-500 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA] hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>
    );
  }

  // Public Landing Page Header
  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-[#0B0D10]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.07] transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Wordmark */}
        <button
          onClick={() => setCurrentView('landing')}
          className="flex items-center space-x-1.5 cursor-pointer text-left focus-visible:outline-none"
          aria-label="EnglishPro AI Home"
        >
          <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-[#F5F7FA]">
            EnglishPro<span className="text-[#6D6FF2] font-semibold text-[11px] ml-1 px-1.5 py-0.5 rounded-[4px] bg-[#6D6FF2]/10 border border-[#6D6FF2]/20">AI</span>
          </span>
        </button>

        {/* Right CTA cluster */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={toggleDark}
            className="p-1.5 rounded-[7px] text-slate-500 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {isAuthenticated ? (
            <button
              onClick={() => setCurrentView('dashboard')}
              className="px-3 py-1.5 rounded-[8px] text-xs font-medium bg-[#6D6FF2] hover:bg-[#7C7FF5] text-white transition-colors cursor-pointer"
            >
              Open Dashboard
            </button>
          ) : (
            <>
              <button
                onClick={onOpenLogin || onOpenAuth}
                className="px-3 py-1.5 rounded-[8px] text-xs font-medium text-slate-700 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA] transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={onOpenSignup || onOpenAuth}
                className="px-3.5 py-1.5 rounded-[8px] text-xs font-medium bg-[#6D6FF2] hover:bg-[#7C7FF5] text-white transition-colors cursor-pointer shadow-xs"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
