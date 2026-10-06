import { UserProfile, AppSettings, VocabularyWord, DailyChallenge, PracticeSessionRecord } from '../types';
import { INITIAL_USER, INITIAL_SETTINGS, PRESET_VOCABULARY, DAILY_CHALLENGES } from '../data/defaultData';
import { AuthService } from '../services/authService';
import { clearLearningMemory } from './learningMemory';

const USER_KEY = 'englishpro_user_v3';
const SETTINGS_KEY = 'englishpro_settings_v3';

function getUserStorageKey(baseKey: string): string {
  try {
    const user = AuthService.getCurrentUser();
    const uid = user && user.isLoggedIn && !user.isGuest ? user.uid : 'guest_user';
    return `${baseKey}_${uid}`;
  } catch (e) {
    return `${baseKey}_guest_user`;
  }
}

export function loadUser(): UserProfile {
  try {
    const authUser = AuthService.getCurrentUser();
    if (authUser && authUser.isLoggedIn && !authUser.isGuest) {
      return authUser;
    }

    const raw = localStorage.getItem(USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.name === 'Ali Khan' || parsed.id === 'user_ali_pro' || parsed.streakDays === 4) {
        localStorage.removeItem(USER_KEY);
        return { ...INITIAL_USER };
      }
      // If authUser is not actively logged in via AuthService, ensure user is guest / logged out
      return {
        ...parsed,
        isLoggedIn: false,
        isGuest: true,
      };
    }
  } catch (e) {
    console.error('Failed to load user from localStorage', e);
  }
  return { ...INITIAL_USER };
}

export function saveUser(user: UserProfile) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (user.isLoggedIn && !user.isGuest) {
      AuthService.updateUserProfile(user);
    }
  } catch (e) {
    console.error('Failed to save user', e);
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return INITIAL_SETTINGS;
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    if (typeof document !== 'undefined') {
      if (settings.darkMode || settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}

export function loadVocabulary(): VocabularyWord[] {
  try {
    const key = getUserStorageKey('englishpro_vocab_v3');
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load vocabulary', e);
  }
  return PRESET_VOCABULARY.map((v) => ({ ...v, isMastered: false }));
}

export function saveVocabulary(words: VocabularyWord[]) {
  try {
    const key = getUserStorageKey('englishpro_vocab_v3');
    localStorage.setItem(key, JSON.stringify(words));
  } catch (e) {
    console.error('Failed to save vocabulary', e);
  }
}

export function loadDailyChallenges(): DailyChallenge[] {
  try {
    const key = getUserStorageKey('englishpro_challenges_v3');
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load challenges', e);
  }
  return DAILY_CHALLENGES.map((c) => ({ ...c, isCompleted: false }));
}

export function saveDailyChallenges(challenges: DailyChallenge[]) {
  try {
    const key = getUserStorageKey('englishpro_challenges_v3');
    localStorage.setItem(key, JSON.stringify(challenges));
  } catch (e) {
    console.error('Failed to save challenges', e);
  }
}

export function loadPracticeSessions(): PracticeSessionRecord[] {
  try {
    const key = getUserStorageKey('englishpro_sessions_v3');
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load practice sessions', e);
  }
  return [];
}

export function recordPracticeSession(session: Omit<PracticeSessionRecord, 'id' | 'timestamp'>) {
  try {
    const key = getUserStorageKey('englishpro_sessions_v3');
    const existing = loadPracticeSessions();
    const newRecord: PracticeSessionRecord = {
      ...session,
      id: 'sess_' + Date.now(),
      timestamp: new Date().toISOString(),
    };
    const updated = [newRecord, ...existing].slice(0, 50);
    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to record practice session', e);
    return [];
  }
}

export function loadScenarioChat(scenarioId: string): any[] | null {
  try {
    const key = getUserStorageKey('englishpro_chat_v3_') + scenarioId;
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load chat history', e);
  }
  return null;
}

export function saveScenarioChat(scenarioId: string, messages: any[]) {
  try {
    const key = getUserStorageKey('englishpro_chat_v3_') + scenarioId;
    localStorage.setItem(key, JSON.stringify(messages));
  } catch (e) {
    console.error('Failed to save chat history', e);
  }
}

export function resetAllData(): { user: UserProfile; settings: AppSettings; vocab: VocabularyWord[]; challenges: DailyChallenge[] } {
  try {
    const user = AuthService.getCurrentUser();
    const uid = user && user.isLoggedIn && !user.isGuest ? user.uid : 'guest_user';
    localStorage.removeItem(`englishpro_sessions_v3_${uid}`);
    localStorage.removeItem(`englishpro_vocab_v3_${uid}`);
    localStorage.removeItem(`englishpro_challenges_v3_${uid}`);
    clearLearningMemory(uid);
  } catch (e) {
    console.error(e);
  }
  return {
    user: { ...INITIAL_USER },
    settings: { ...INITIAL_SETTINGS },
    vocab: PRESET_VOCABULARY.map((v) => ({ ...v, isMastered: false })),
    challenges: DAILY_CHALLENGES.map((c) => ({ ...c, isCompleted: false })),
  };
}

export const loadUserProfile = loadUser;
export const saveUserProfile = saveUser;
export const loadChallenges = loadDailyChallenges;
export const saveChallenges = saveDailyChallenges;
export const clearAllData = resetAllData;
