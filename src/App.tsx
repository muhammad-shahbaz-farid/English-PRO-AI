import React, { useState, useEffect, useCallback } from 'react';
import { AppView, UserProfile, AppSettings, DailyChallenge, VocabularyWord, PracticeSessionRecord } from './types';
import {
  loadUserProfile,
  saveUserProfile,
  loadSettings,
  saveSettings,
  loadVocabulary,
  saveVocabulary,
  loadChallenges,
  saveChallenges,
  clearAllData,
  recordPracticeSession,
} from './utils/storage';
import { AuthService } from './services/authService';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { simplifiedToCefrLevel } from './utils/learningEngine';
import { SimplifiedLevel, LearningGoal } from './types';
import { LandingView } from './views/LandingView';
import { DashboardView } from './views/DashboardView';
import { ConversationView } from './views/ConversationView';
import { SpeakingCoachView } from './views/SpeakingCoachView';
import { WritingView } from './views/WritingView';
import { GrammarView } from './views/GrammarView';
import { VocabularyView } from './views/VocabularyView';
import { TranslatorView } from './views/TranslatorView';
import { ChallengesView } from './views/ChallengesView';
import { ProgressView } from './views/ProgressView';
import { ProfileView } from './views/ProfileView';
import { SettingsView } from './views/SettingsView';

const viewToPath = (view: AppView): string => {
  if (view === 'landing') return '/';
  if (view === 'challenges') return '/challenge';
  return `/${view}`;
};

const pathToView = (path: string): AppView => {
  const cleanPath = path.toLowerCase().replace(/\/$/, '') || '/';
  switch (cleanPath) {
    case '/dashboard':
      return 'dashboard';
    case '/conversation':
      return 'conversation';
    case '/speaking':
      return 'speaking';
    case '/writing':
      return 'writing';
    case '/grammar':
      return 'grammar';
    case '/vocabulary':
      return 'vocabulary';
    case '/translator':
      return 'translator';
    case '/challenge':
    case '/challenges':
      return 'challenges';
    case '/progress':
      return 'progress';
    case '/profile':
      return 'profile';
    case '/settings':
      return 'settings';
    default:
      return 'landing';
  }
};

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(() => pathToView(window.location.pathname));
  const [user, setUser] = useState<UserProfile>(() => loadUserProfile());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [vocabulary, setVocabulary] = useState<VocabularyWord[]>(() => loadVocabulary());
  const [challenges, setChallenges] = useState<DailyChallenge[]>(() => loadChallenges());

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Synchronize browser history and popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(pathToView(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Listen to AuthService auth state transitions
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged((updatedUser) => {
      setUser(updatedUser);
      setVocabulary(loadVocabulary());
      setChallenges(loadChallenges());
    });
    return () => unsubscribe();
  }, []);

  // Synchronize dark/light theme with HTML class
  useEffect(() => {
    const isDark = settings.darkMode || settings.theme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode, settings.theme]);

  // Persist user changes
  useEffect(() => {
    saveUserProfile(user);
  }, [user]);

  // Persist settings changes
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Persist vocabulary
  useEffect(() => {
    saveVocabulary(vocabulary);
  }, [vocabulary]);

  // Persist challenges
  useEffect(() => {
    saveChallenges(challenges);
  }, [challenges]);

  const handleNavigate = useCallback((view: AppView) => {
    setCurrentView(view);
    const targetPath = viewToPath(view);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleToggleTheme = () => {
    const isDark = settings.darkMode || settings.theme === 'dark';
    setSettings({
      ...settings,
      darkMode: !isDark,
      theme: !isDark ? 'dark' : 'light',
    });
  };

  const handleLogin = (newUser: UserProfile) => {
    setUser({ ...newUser, isLoggedIn: true, isGuest: false });
    setVocabulary(loadVocabulary());
    setChallenges(loadChallenges());
    setIsAuthModalOpen(false);
    if (newUser.hasCompletedOnboarding === false) {
      setIsOnboardingOpen(true);
    }
    handleNavigate('dashboard');
  };

  const handleCompleteOnboarding = (data: {
    level: SimplifiedLevel;
    goal: LearningGoal;
    dailyPracticeGoal: number;
  }) => {
    const targetCefr = simplifiedToCefrLevel(data.level);
    setUser((prev) => {
      const updated: UserProfile = {
        ...prev,
        simplifiedLevel: data.level,
        englishLevel: targetCefr,
        targetLevel: targetCefr,
        learningGoal: data.goal,
        primaryGoal: data.goal,
        dailyPracticeGoal: data.dailyPracticeGoal,
        dailyGoalMinutes: data.dailyPracticeGoal,
        hasCompletedOnboarding: true,
      };
      saveUserProfile(updated);
      AuthService.updateUserProfile(updated);
      return updated;
    });
    setIsOnboardingOpen(false);
  };

  const handleLogout = async () => {
    await AuthService.logout();
    const guestUser = loadUserProfile();
    setUser(guestUser);
    setVocabulary(loadVocabulary());
    setChallenges(loadChallenges());
    handleNavigate('landing');
  };

  const handleUpdateUserXp = (xpToAdd: number) => {
    setUser((prev) => {
      const updated = {
        ...prev,
        totalXp: (prev.totalXp || 0) + xpToAdd,
        streakDays: prev.streakDays === 0 ? 1 : prev.streakDays,
      };
      saveUserProfile(updated);
      return updated;
    });
  };

  const handleRecordSession = (session: {
    type: 'conversation' | 'grammar' | 'vocabulary' | 'challenge' | 'translation';
    title: string;
    durationMinutes: number;
    xpEarned: number;
    summary: string;
  }) => {
    recordPracticeSession(session);
    setUser((prev) => {
      const updated: UserProfile = {
        ...prev,
        practiceMinutes: (prev.practiceMinutes || 0) + session.durationMinutes,
        conversationsCount:
          session.type === 'conversation' ? (prev.conversationsCount || 0) + 1 : prev.conversationsCount,
        grammarChecksCount:
          session.type === 'grammar' ? (prev.grammarChecksCount || 0) + 1 : prev.grammarChecksCount,
        challengesCompletedCount:
          session.type === 'challenge' ? (prev.challengesCompletedCount || 0) + 1 : prev.challengesCompletedCount,
        translationsCount:
          session.type === 'translation' ? (prev.translationsCount || 0) + 1 : prev.translationsCount,
        streakDays: prev.streakDays === 0 ? 1 : prev.streakDays,
      };
      saveUserProfile(updated);
      return updated;
    });
  };

  const handleResetAll = () => {
    clearAllData();
    setUser(loadUserProfile());
    setSettings(loadSettings());
    setVocabulary(loadVocabulary());
    setChallenges(loadChallenges());
    handleNavigate('dashboard');
  };

  const isLanding = currentView === 'landing';

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0B0D10] text-[#111827] dark:text-[#F5F7FA] font-sans transition-colors duration-150 flex flex-col">
      {isLanding ? (
        <>
          <Navbar
            currentView={currentView}
            setCurrentView={handleNavigate}
            user={user}
            onOpenLogin={() => {
              setAuthMode('login');
              setIsAuthModalOpen(true);
            }}
            onOpenSignup={() => {
              setAuthMode('signup');
              setIsAuthModalOpen(true);
            }}
            onLogout={handleLogout}
            theme={settings.darkMode || settings.theme === 'dark' ? 'dark' : 'light'}
            onToggleTheme={handleToggleTheme}
          />

          <main className="flex-1 w-full" id="main-content">
            <LandingView
              user={user}
              onGetStarted={() => {
                if (user.isLoggedIn && !user.isGuest) {
                  handleNavigate('dashboard');
                } else {
                  setAuthMode('signup');
                  setIsAuthModalOpen(true);
                }
              }}
              onOpenLogin={() => {
                setAuthMode('login');
                setIsAuthModalOpen(true);
              }}
              onOpenSignup={() => {
                setAuthMode('signup');
                setIsAuthModalOpen(true);
              }}
              setCurrentView={handleNavigate}
            />
          </main>

          <Footer currentView={currentView} setCurrentView={handleNavigate} />
        </>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
          <Sidebar
            currentView={currentView}
            setCurrentView={handleNavigate}
            user={user}
            theme={settings.darkMode || settings.theme === 'dark' ? 'dark' : 'light'}
            onToggleTheme={handleToggleTheme}
            onOpenLogin={() => {
              setAuthMode('login');
              setIsAuthModalOpen(true);
            }}
            onOpenSignup={() => {
              setAuthMode('signup');
              setIsAuthModalOpen(true);
            }}
            onLogout={handleLogout}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />

          <div className="flex-1 flex flex-col min-w-0">
            <Navbar
              currentView={currentView}
              setCurrentView={handleNavigate}
              user={user}
              theme={settings.darkMode || settings.theme === 'dark' ? 'dark' : 'light'}
              onToggleTheme={handleToggleTheme}
              onToggleMobileMenu={() => setMobileMenuOpen(true)}
              onOpenLogin={() => {
                setAuthMode('login');
                setIsAuthModalOpen(true);
              }}
              onOpenSignup={() => {
                setAuthMode('signup');
                setIsAuthModalOpen(true);
              }}
              onLogout={handleLogout}
            />

            <main className="flex-1 min-w-0 w-full overflow-y-auto" id="main-content">
              {currentView === 'dashboard' && (
                <DashboardView
                  user={user}
                  challenges={challenges}
                  setCurrentView={handleNavigate}
                  settings={settings}
                  onOpenOnboarding={() => setIsOnboardingOpen(true)}
                  onOpenLogin={() => {
                    setAuthMode('login');
                    setIsAuthModalOpen(true);
                  }}
                  onOpenSignup={() => {
                    setAuthMode('signup');
                    setIsAuthModalOpen(true);
                  }}
                />
              )}

              {currentView === 'conversation' && (
                <ConversationView
                  user={user}
                  settings={settings}
                  onUpdateUserXp={(xp) => {
                    handleUpdateUserXp(xp);
                    handleRecordSession({
                      type: 'conversation',
                      title: 'AI English Conversation',
                      durationMinutes: 5,
                      xpEarned: xp,
                      summary: 'Real-time conversational roleplay session',
                    });
                  }}
                />
              )}

              {currentView === 'speaking' && (
                <SpeakingCoachView
                  user={user}
                  settings={settings}
                  onUpdateUserXp={(xp) => {
                    handleUpdateUserXp(xp);
                  }}
                  onRecordSession={(session) => {
                    handleRecordSession(session);
                  }}
                />
              )}

              {currentView === 'writing' && (
                <WritingView
                  user={user}
                  settings={settings}
                  onUpdateUserXp={(xp) => {
                    handleUpdateUserXp(xp);
                    handleRecordSession({
                      type: 'grammar',
                      title: 'AI Writing Coach Analysis',
                      durationMinutes: 4,
                      xpEarned: xp,
                      summary: 'Structured writing analysis and personalized correction',
                    });
                  }}
                  onWritingChecked={() => {
                    setUser((prev) => ({
                      ...prev,
                      writingChecksCount: (prev.writingChecksCount || 0) + 1,
                    }));
                  }}
                />
              )}

              {currentView === 'grammar' && (
                <GrammarView
                  user={user}
                  settings={settings}
                  onUpdateUserXp={(xp) => {
                    handleUpdateUserXp(xp);
                    handleRecordSession({
                      type: 'grammar',
                      title: 'Grammar Doctor Diagnosis',
                      durationMinutes: 3,
                      xpEarned: xp,
                      summary: 'Linguistic grammar check and tone rewrite',
                    });
                  }}
                />
              )}

              {currentView === 'vocabulary' && (
                <VocabularyView
                  vocabulary={vocabulary}
                  setVocabulary={(updated) => {
                    setVocabulary(updated);
                    const mastered = updated.filter((w) => w.isMastered).length;
                    setUser((prev) => ({ ...prev, wordsMasteredCount: mastered }));
                  }}
                  settings={settings}
                  user={user}
                  onUpdateUserXp={(xp) => {
                    handleUpdateUserXp(xp);
                    handleRecordSession({
                      type: 'vocabulary',
                      title: 'Vocab Vault Flashcards',
                      durationMinutes: 2,
                      xpEarned: xp,
                      summary: 'CEFR vocabulary retention & quiz drill',
                    });
                  }}
                />
              )}

              {currentView === 'translator' && (
                <TranslatorView
                  settings={settings}
                  onUpdateUserXp={(xp) => {
                    handleUpdateUserXp(xp);
                    handleRecordSession({
                      type: 'translation',
                      title: 'Urdu ↔ English Translation',
                      durationMinutes: 2,
                      xpEarned: xp,
                      summary: 'Contextual sentence translation with syntax breakdown',
                    });
                  }}
                />
              )}

              {currentView === 'challenges' && (
                <ChallengesView
                  challenges={challenges}
                  setChallenges={setChallenges}
                  user={user}
                  settings={settings}
                  onUpdateUserXp={(xp) => {
                    handleUpdateUserXp(xp);
                    handleRecordSession({
                      type: 'challenge',
                      title: 'Daily English Challenge',
                      durationMinutes: 4,
                      xpEarned: xp,
                      summary: 'Completed daily speaking mission',
                    });
                  }}
                />
              )}

              {currentView === 'progress' && (
                <ProgressView
                  user={user}
                  challenges={challenges}
                  vocabulary={vocabulary}
                  setCurrentView={handleNavigate}
                />
              )}

              {currentView === 'profile' && (
                <ProfileView
                  user={user}
                  setUser={setUser}
                  onOpenAuth={() => {
                    setAuthMode('login');
                    setIsAuthModalOpen(true);
                  }}
                />
              )}

              {currentView === 'settings' && (
                <SettingsView
                  settings={settings}
                  setSettings={setSettings}
                  onResetAllData={handleResetAll}
                />
              )}
            </main>
          </div>
        </div>
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
        onLoginSuccess={handleLogin}
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        userName={user.name || 'Learner'}
        onComplete={handleCompleteOnboarding}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </div>
  );
}
