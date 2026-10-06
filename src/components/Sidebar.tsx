import React from 'react';
import {
  LayoutDashboard,
  MessageCircle,
  Mic,
  PenLine,
  SpellCheck2,
  BookOpen,
  Languages,
  Target,
  ChartNoAxesCombined,
  UserRound,
  Settings2,
  LogOut,
  Sun,
  Moon,
  Flame,
  X,
} from 'lucide-react';
import { AppView, UserProfile } from '../types';

interface SidebarProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  user: UserProfile;
  darkMode?: boolean;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  onOpenLogin?: () => void;
  onOpenSignup?: () => void;
  onLogout: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  user,
  darkMode = false,
  theme,
  onToggleTheme,
  onOpenLogin,
  onOpenSignup,
  onLogout,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const isDark = theme ? theme === 'dark' : darkMode;

  const handleNav = (view: AppView) => {
    setCurrentView(view);
    onCloseMobile?.();
  };

  const navSections = [
    {
      label: 'MAIN',
      items: [
        { view: 'dashboard' as AppView, label: 'Dashboard', icon: LayoutDashboard },
        { view: 'conversation' as AppView, label: 'Conversation', icon: MessageCircle },
        { view: 'speaking' as AppView, label: 'Speaking', icon: Mic },
        { view: 'writing' as AppView, label: 'Writing', icon: PenLine },
      ],
    },
    {
      label: 'LEARN',
      items: [
        { view: 'grammar' as AppView, label: 'Grammar', icon: SpellCheck2 },
        { view: 'vocabulary' as AppView, label: 'Vocabulary', icon: BookOpen },
        { view: 'translator' as AppView, label: 'Translator', icon: Languages },
        { view: 'challenges' as AppView, label: 'Challenges', icon: Target },
      ],
    },
    {
      label: 'INSIGHTS',
      items: [
        { view: 'progress' as AppView, label: 'Progress', icon: ChartNoAxesCombined },
      ],
    },
  ];

  const bottomItems = [
    { view: 'profile' as AppView, label: 'Profile', icon: UserRound },
    { view: 'settings' as AppView, label: 'Settings', icon: Settings2 },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#F1F3F5] dark:bg-[#0D1014] text-slate-800 dark:text-[#F5F7FA] border-r border-slate-200 dark:border-white/[0.07] select-none">
      {/* Brand Header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.06]">
        <button
          onClick={() => handleNav('dashboard')}
          className="flex items-center space-x-2 text-left cursor-pointer group focus-visible:outline-none"
        >
          <span className="font-semibold text-base tracking-tight text-slate-900 dark:text-[#F5F7FA]">
            EnglishPro<span className="text-[#6D6FF2] font-semibold text-[11px] ml-1 px-1.5 py-0.5 rounded-[4px] bg-[#6D6FF2]/10 border border-[#6D6FF2]/20">AI</span>
          </span>
        </button>

        {mobileOpen && (
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-[7px] text-slate-500 hover:text-slate-900 dark:text-[#A8B0BA] dark:hover:text-[#F5F7FA] cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-[#727B87] uppercase">
              {section.label}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.view)}
                  className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-[8px] text-[13px] font-medium transition-all duration-150 cursor-pointer text-left ${
                    isActive
                      ? 'bg-slate-200/80 dark:bg-white/[0.08] text-slate-900 dark:text-[#F5F7FA] shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA] hover:bg-slate-200/50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-[#6D6FF2]' : 'text-slate-400 dark:text-[#727B87]'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}

        {/* Bottom utility links (Profile & Settings) */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/[0.06] space-y-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => handleNav(item.view)}
                className={`w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-[8px] text-[13px] font-medium transition-all duration-150 cursor-pointer text-left ${
                  isActive
                    ? 'bg-slate-200/80 dark:bg-white/[0.08] text-slate-900 dark:text-[#F5F7FA] shadow-2xs font-semibold'
                    : 'text-slate-600 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA] hover:bg-slate-200/50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#6D6FF2]' : 'text-slate-400 dark:text-[#727B87]'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Profile & Actions */}
      <div className="p-3 border-t border-slate-200 dark:border-white/[0.06] space-y-2.5 bg-slate-100/50 dark:bg-black/20">
        {/* Streak & Theme Row */}
        <div className="flex items-center justify-between px-1">
          <div
            className="flex items-center space-x-1.5 text-xs font-medium text-amber-600 dark:text-amber-400"
            title={`${user.streakDays || 0} day learning streak`}
          >
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>{user.streakDays || 0}d streak</span>
          </div>

          <button
            onClick={onToggleTheme}
            className="p-1.5 rounded-[7px] text-slate-500 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA] hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* User Account / Auth Button */}
        {user.isLoggedIn && !user.isGuest ? (
          <div className="flex items-center justify-between p-2 rounded-[8px] bg-white dark:bg-[#14181D] border border-slate-200/80 dark:border-white/[0.06]">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold text-slate-900 dark:text-[#F5F7FA] truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-[#727B87] truncate">
                CEFR {user.englishLevel || user.targetLevel || 'B1'}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="p-1 rounded-[6px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenLogin}
              className="flex-1 py-1.5 text-xs font-medium text-slate-700 dark:text-[#A8B0BA] hover:text-slate-900 dark:hover:text-[#F5F7FA] text-center rounded-[8px] hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={onOpenSignup}
              className="flex-1 py-1.5 text-xs font-medium bg-[#6D6FF2] hover:bg-[#7C7FF5] text-white text-center rounded-[8px] transition-colors cursor-pointer"
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-150"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-64 z-50 lg:hidden transform transition-transform duration-200 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
