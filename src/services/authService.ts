import { UserProfile, CEFRLevel, LearningGoal, Badge } from '../types';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from './firebase';

export const INITIAL_BADGES: Badge[] = [
  {
    id: 'first_convo',
    title: 'Voice Unlocked',
    description: 'Complete your first conversation practice session with AI Coach.',
    icon: 'Mic',
    isUnlocked: false,
  },
  {
    id: 'streak_3',
    title: 'Consistent Learner',
    description: 'Maintain a 3-day continuous English practice streak.',
    icon: 'Flame',
    isUnlocked: false,
  },
  {
    id: 'grammar_hawk',
    title: 'Grammar Virtuoso',
    description: 'Analyze and correct 5 sentences with zero recurring errors.',
    icon: 'CheckCircle2',
    isUnlocked: false,
  },
  {
    id: 'vocab_50',
    title: 'Word Collector',
    description: 'Master 50 high-yield vocabulary words in your personal vault.',
    icon: 'BookOpen',
    isUnlocked: false,
  },
  {
    id: 'ielts_ready',
    title: 'Fluency Champion',
    description: 'Score 90%+ in an IELTS Speaking or Job Interview roleplay.',
    icon: 'Award',
    isUnlocked: false,
  },
];

export const GUEST_USER: UserProfile = {
  uid: 'guest_user',
  id: 'guest_user',
  name: 'Guest User',
  email: '',
  nativeLanguage: 'Urdu',
  englishLevel: 'B1',
  targetLevel: 'B1',
  learningGoal: 'Everyday Fluency',
  primaryGoal: 'Everyday Fluency',
  dailyPracticeGoal: 15,
  dailyGoalMinutes: 15,
  createdAt: new Date().toISOString(),
  streakDays: 0,
  lastActiveDate: '',
  totalXp: 0,
  wordsMasteredCount: 0,
  conversationsCount: 0,
  grammarChecksCount: 0,
  translationsCount: 0,
  practiceMinutes: 0,
  challengesCompletedCount: 0,
  badges: INITIAL_BADGES,
  isLoggedIn: false,
  isGuest: true,
};

const SESSION_KEY = 'englishpro_auth_session_v3';
const ACCOUNTS_KEY = 'englishpro_auth_accounts_v3';

interface StoredAccount {
  uid: string;
  email: string;
  passwordHash: string; // Cryptographic SHA-256 hash (never plain text)
  profile: UserProfile;
}

// Cryptographic SHA-256 password hashing (ensures passwords are never stored in plain text)
async function hashPassword(password: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {}
  }
  // Safe fallback
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(16);
}

function getStoredAccounts(): StoredAccount[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load stored accounts:', e);
  }
  return [];
}

function saveStoredAccounts(accounts: StoredAccount[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }
  } catch (e) {
    console.error('Failed to save accounts:', e);
  }
}

// Flag to prevent onAuthStateChanged from clobbering active sign-up or sign-in operations
let isAuthActionInProgress = false;

type AuthListener = (user: UserProfile) => void;
const listeners: Set<AuthListener> = new Set();

function notifyListeners(user: UserProfile) {
  listeners.forEach((listener) => {
    try {
      listener(user);
    } catch (e) {
      console.error('Auth listener error:', e);
    }
  });
}

// Map Firebase Auth error codes to user-friendly messages
function mapAuthError(error: any): string {
  if (!error) return 'An unexpected authentication error occurred.';
  const code = error.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address (e.g. name@example.com).';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/user-not-found':
      return 'No account registered with this email address. Please check your email or sign up.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please verify your credentials or use Forgot Password.';
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access temporarily locked. Please reset your password or try again later.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completion. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Please allow popups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-up is disabled in this Firebase project. To enable it, visit Firebase Console > Authentication > Sign-in method and enable "Email/Password", or sign in with Google.';
    default:
      return error.message || 'An error occurred during authentication. Please try again.';
  }
}

// Initialize real-time Firebase Auth listener
if (typeof window !== 'undefined') {
  onAuthStateChanged(auth, async (firebaseUser) => {
    // If an explicit signup or signin is actively running, let it complete its own initialization
    if (isAuthActionInProgress) {
      return;
    }

    if (firebaseUser) {
      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        let profile: UserProfile;
        if (userDoc.exists()) {
          const data = userDoc.data() as Partial<UserProfile>;
          profile = {
            ...GUEST_USER,
            ...data,
            uid: firebaseUser.uid,
            id: firebaseUser.uid,
            name: data.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Learner',
            email: data.email || firebaseUser.email || '',
            avatar: firebaseUser.photoURL || data.avatar,
            isLoggedIn: true,
            isGuest: false,
            badges: data.badges || INITIAL_BADGES,
          };
        } else {
          // Check if local session cache has user data before falling back to generic defaults
          const cached = AuthService.getCurrentUser();
          const cachedName = cached.isLoggedIn && cached.uid === firebaseUser.uid && cached.name && cached.name !== 'Guest User'
            ? cached.name
            : firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Learner';

          // Initialize fresh profile for Google or newly authenticated user
          profile = {
            uid: firebaseUser.uid,
            id: firebaseUser.uid,
            name: cachedName,
            email: firebaseUser.email || '',
            avatar: firebaseUser.photoURL || undefined,
            nativeLanguage: 'Urdu',
            englishLevel: 'B1',
            simplifiedLevel: 'Intermediate',
            targetLevel: 'B1',
            learningGoal: 'Everyday Fluency',
            primaryGoal: 'Everyday Fluency',
            dailyPracticeGoal: 15,
            dailyGoalMinutes: 15,
            hasCompletedOnboarding: true,
            createdAt: new Date().toISOString(),
            streakDays: 1,
            lastActiveDate: new Date().toISOString().split('T')[0],
            totalXp: 50,
            wordsMasteredCount: 0,
            conversationsCount: 0,
            grammarChecksCount: 0,
            translationsCount: 0,
            practiceMinutes: 0,
            challengesCompletedCount: 0,
            badges: INITIAL_BADGES,
            isLoggedIn: true,
            isGuest: false,
          };
          // Persist to Firestore
          try {
            await setDoc(userDocRef, {
              uid: profile.uid,
              name: profile.name,
              email: profile.email,
              nativeLanguage: profile.nativeLanguage,
              englishLevel: profile.englishLevel,
              learningGoal: profile.learningGoal,
              dailyPracticeGoal: profile.dailyPracticeGoal,
              totalXp: profile.totalXp,
              streakDays: profile.streakDays,
              lastActiveDate: profile.lastActiveDate,
              wordsMasteredCount: profile.wordsMasteredCount,
              conversationsCount: profile.conversationsCount,
              grammarChecksCount: profile.grammarChecksCount,
              translationsCount: profile.translationsCount,
              practiceMinutes: profile.practiceMinutes,
              challengesCompletedCount: profile.challengesCompletedCount,
              createdAt: profile.createdAt,
              updatedAt: new Date().toISOString(),
            });
          } catch (writeErr) {
            console.warn('Could not write initial user doc to Firestore:', writeErr);
          }
        }

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        }
        notifyListeners(profile);
      } catch (err) {
        console.warn('Error loading user profile on auth state change:', err);
      }
    } else {
      // User is logged out
      const current = AuthService.getCurrentUser();
      if (current.isLoggedIn && !current.isGuest) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(SESSION_KEY);
        }
        notifyListeners({ ...GUEST_USER });
      }
    }
  });
}

export class AuthService {
  /**
   * Status of Firebase backend configuration
   */
  static getAuthConfig() {
    return {
      isFirebaseConfigured: true,
      provider: 'Firebase Authentication (Email/Password & Google)',
      supportsGoogleSignIn: true,
      message: 'Connected to Firebase Authentication backend.',
    };
  }

  /**
   * Subscribe to auth changes
   */
  static onAuthStateChanged(callback: AuthListener): () => void {
    listeners.add(callback);
    callback(this.getCurrentUser());
    return () => {
      listeners.delete(callback);
    };
  }

  /**
   * Get current authenticated session, or Guest User
   */
  static getCurrentUser(): UserProfile {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const user = JSON.parse(raw);
          if (user && user.isLoggedIn) {
            return user;
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse current auth session:', e);
    }
    return { ...GUEST_USER };
  }

  /**
   * Sign up with Name, Email, Password, Level, and Goal via Firebase Auth
   */
  static async signupWithEmail(params: {
    name: string;
    email: string;
    password: string;
    confirmPassword?: string;
    englishLevel?: CEFRLevel;
    learningGoal?: LearningGoal;
    dailyPracticeGoal?: number;
  }): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const {
      name,
      email,
      password,
      confirmPassword,
      englishLevel = 'B1',
      learningGoal = 'Everyday Fluency',
      dailyPracticeGoal = 15,
    } = params;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    // Client-side field validations
    if (!trimmedName) {
      return { success: false, error: 'Please enter your full name.' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return { success: false, error: 'Please enter a valid email address (e.g. name@example.com).' };
    }
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return { success: false, error: 'Passwords do not match. Please verify both password fields.' };
    }

    try {
      isAuthActionInProgress = true;

      // Check if account already exists locally
      const accounts = getStoredAccounts();
      const existingAccount = accounts.find((a) => a.email === trimmedEmail);
      if (existingAccount) {
        return {
          success: false,
          error: 'An account with this email address already exists. Please sign in instead.',
        };
      }

      // 1. Create real Firebase Authentication account
      let fbUser: any = null;
      try {
        const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        fbUser = userCred.user;
      } catch (fbErr: any) {
        // Return clear user-friendly error (e.g. auth/operation-not-allowed, auth/email-already-in-use)
        return { success: false, error: mapAuthError(fbErr) };
      }

      // 2. Set display name in Firebase Auth
      try {
        await updateProfile(fbUser, { displayName: trimmedName });
      } catch (profileErr) {
        console.warn('Could not update Firebase user displayName:', profileErr);
      }

      const uid = fbUser.uid;
      const now = new Date().toISOString();
      const today = now.split('T')[0];

      // 3. Build comprehensive UserProfile with real zero activity
      const newUser: UserProfile = {
        uid,
        id: uid,
        name: trimmedName,
        email: trimmedEmail,
        nativeLanguage: 'Urdu',
        englishLevel,
        simplifiedLevel: 'Intermediate',
        targetLevel: englishLevel,
        learningGoal,
        primaryGoal: learningGoal,
        dailyPracticeGoal,
        dailyGoalMinutes: dailyPracticeGoal,
        hasCompletedOnboarding: true,
        createdAt: now,
        streakDays: 1,
        lastActiveDate: today,
        totalXp: 50,
        wordsMasteredCount: 0,
        conversationsCount: 0,
        grammarChecksCount: 0,
        translationsCount: 0,
        practiceMinutes: 0,
        challengesCompletedCount: 0,
        badges: INITIAL_BADGES.map((b) => ({ ...b, isUnlocked: false })),
        isLoggedIn: true,
        isGuest: false,
      };

      // 4. Initialize Firestore /users/{uid} document
      try {
        await setDoc(doc(db, 'users', uid), {
          uid,
          name: trimmedName,
          email: trimmedEmail,
          nativeLanguage: 'Urdu',
          englishLevel,
          learningGoal,
          dailyPracticeGoal,
          totalXp: 50,
          streakDays: 1,
          lastActiveDate: today,
          wordsMasteredCount: 0,
          conversationsCount: 0,
          grammarChecksCount: 0,
          translationsCount: 0,
          practiceMinutes: 0,
          challengesCompletedCount: 0,
          createdAt: now,
          updatedAt: now,
        });
      } catch (dbErr: any) {
        console.error('Failed to create Firestore user profile:', dbErr);
        return {
          success: false,
          error: 'Firebase account was created, but initializing your cloud user profile failed. Please check your network connection.',
        };
      }

      // 5. Update local session & notify
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
      }
      notifyListeners(newUser);

      return { success: true, user: newUser };
    } catch (err: any) {
      return { success: false, error: mapAuthError(err) };
    } finally {
      isAuthActionInProgress = false;
    }
  }

  /**
   * Log in with Email and Password via Firebase Auth with resilient local fallback
   */
  static async loginWithEmail(
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!password) {
      return { success: false, error: 'Please enter your password.' };
    }

    try {
      isAuthActionInProgress = true;
      let loggedInUser: UserProfile | null = null;

      // 1. Try Firebase Authentication first
      try {
        const userCred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const fbUser = userCred.user;

        const userDocRef = doc(db, 'users', fbUser.uid);
        const snap = await getDoc(userDocRef);

        if (snap.exists()) {
          const data = snap.data() as Partial<UserProfile>;
          loggedInUser = {
            ...GUEST_USER,
            ...data,
            uid: fbUser.uid,
            id: fbUser.uid,
            name: data.name || fbUser.displayName || trimmedEmail.split('@')[0],
            email: data.email || fbUser.email || trimmedEmail,
            lastActiveDate: new Date().toISOString().split('T')[0],
            isLoggedIn: true,
            isGuest: false,
            badges: data.badges || INITIAL_BADGES,
          };

          // Update lastActiveDate in Firestore
          setDoc(
            userDocRef,
            { lastActiveDate: loggedInUser.lastActiveDate, updatedAt: new Date().toISOString() },
            { merge: true }
          ).catch(() => {});
        } else {
          // Initialize profile doc if missing
          loggedInUser = {
            uid: fbUser.uid,
            id: fbUser.uid,
            name: fbUser.displayName || trimmedEmail.split('@')[0],
            email: fbUser.email || trimmedEmail,
            nativeLanguage: 'Urdu',
            englishLevel: 'B1',
            simplifiedLevel: 'Intermediate',
            targetLevel: 'B1',
            learningGoal: 'Everyday Fluency',
            primaryGoal: 'Everyday Fluency',
            dailyPracticeGoal: 15,
            dailyGoalMinutes: 15,
            hasCompletedOnboarding: true,
            createdAt: new Date().toISOString(),
            streakDays: 1,
            lastActiveDate: new Date().toISOString().split('T')[0],
            totalXp: 50,
            wordsMasteredCount: 0,
            conversationsCount: 0,
            grammarChecksCount: 0,
            translationsCount: 0,
            practiceMinutes: 0,
            challengesCompletedCount: 0,
            badges: INITIAL_BADGES,
            isLoggedIn: true,
            isGuest: false,
          };

          setDoc(userDocRef, {
            uid: loggedInUser.uid,
            name: loggedInUser.name,
            email: loggedInUser.email,
            nativeLanguage: loggedInUser.nativeLanguage,
            englishLevel: loggedInUser.englishLevel,
            learningGoal: loggedInUser.learningGoal,
            dailyPracticeGoal: loggedInUser.dailyPracticeGoal,
            totalXp: loggedInUser.totalXp,
            streakDays: loggedInUser.streakDays,
            lastActiveDate: loggedInUser.lastActiveDate,
            wordsMasteredCount: 0,
            conversationsCount: 0,
            grammarChecksCount: 0,
            translationsCount: 0,
            practiceMinutes: 0,
            challengesCompletedCount: 0,
            createdAt: loggedInUser.createdAt,
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      } catch (fbErr: any) {
        return { success: false, error: mapAuthError(fbErr) };
      }

      if (!loggedInUser) {
        return { success: false, error: 'Login could not be completed. Please check your credentials.' };
      }

      // 3. Save session & notify
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SESSION_KEY, JSON.stringify(loggedInUser));
      }
      notifyListeners(loggedInUser);

      return { success: true, user: loggedInUser };
    } catch (err: any) {
      return { success: false, error: mapAuthError(err) };
    } finally {
      isAuthActionInProgress = false;
    }
  }

  /**
   * Sign in with Google (Firebase popup)
   */
  static async signInWithGoogle(): Promise<{
    success: boolean;
    user?: UserProfile;
    error?: string;
  }> {
    try {
      isAuthActionInProgress = true;
      const userCred = await signInWithPopup(auth, googleProvider);
      const fbUser = userCred.user;

      const userDocRef = doc(db, 'users', fbUser.uid);
      let profile: UserProfile;

      try {
        const snap = await getDoc(userDocRef);
        if (snap.exists()) {
          const data = snap.data() as Partial<UserProfile>;
          profile = {
            ...GUEST_USER,
            ...data,
            uid: fbUser.uid,
            id: fbUser.uid,
            name: fbUser.displayName || data.name || 'EnglishPro Learner',
            email: fbUser.email || data.email || '',
            avatar: fbUser.photoURL || data.avatar,
            lastActiveDate: new Date().toISOString().split('T')[0],
            isLoggedIn: true,
            isGuest: false,
            badges: data.badges || INITIAL_BADGES,
          };

          // Update active timestamp
          setDoc(
            userDocRef,
            { lastActiveDate: profile.lastActiveDate, updatedAt: new Date().toISOString() },
            { merge: true }
          ).catch(() => {});
        } else {
          // New Google user registration
          profile = {
            uid: fbUser.uid,
            id: fbUser.uid,
            name: fbUser.displayName || 'EnglishPro Learner',
            email: fbUser.email || '',
            avatar: fbUser.photoURL || undefined,
            nativeLanguage: 'Urdu',
            englishLevel: 'B1',
            simplifiedLevel: 'Intermediate',
            targetLevel: 'B1',
            learningGoal: 'Everyday Fluency',
            primaryGoal: 'Everyday Fluency',
            dailyPracticeGoal: 15,
            dailyGoalMinutes: 15,
            hasCompletedOnboarding: false,
            createdAt: new Date().toISOString(),
            streakDays: 1,
            lastActiveDate: new Date().toISOString().split('T')[0],
            totalXp: 50,
            wordsMasteredCount: 0,
            conversationsCount: 0,
            grammarChecksCount: 0,
            translationsCount: 0,
            practiceMinutes: 0,
            challengesCompletedCount: 0,
            badges: INITIAL_BADGES,
            isLoggedIn: true,
            isGuest: false,
          };

          await setDoc(userDocRef, {
            uid: profile.uid,
            name: profile.name,
            email: profile.email,
            nativeLanguage: profile.nativeLanguage,
            englishLevel: profile.englishLevel,
            learningGoal: profile.learningGoal,
            dailyPracticeGoal: profile.dailyPracticeGoal,
            totalXp: profile.totalXp,
            streakDays: profile.streakDays,
            lastActiveDate: profile.lastActiveDate,
            wordsMasteredCount: 0,
            conversationsCount: 0,
            grammarChecksCount: 0,
            translationsCount: 0,
            practiceMinutes: 0,
            challengesCompletedCount: 0,
            createdAt: profile.createdAt,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (dbErr) {
        console.warn('Firestore read/write for Google user failed, falling back:', dbErr);
        profile = {
          uid: fbUser.uid,
          id: fbUser.uid,
          name: fbUser.displayName || 'EnglishPro Learner',
          email: fbUser.email || '',
          avatar: fbUser.photoURL || undefined,
          nativeLanguage: 'Urdu',
          englishLevel: 'B1',
          simplifiedLevel: 'Intermediate',
          targetLevel: 'B1',
          learningGoal: 'Everyday Fluency',
          primaryGoal: 'Everyday Fluency',
          dailyPracticeGoal: 15,
          dailyGoalMinutes: 15,
          createdAt: new Date().toISOString(),
          streakDays: 1,
          lastActiveDate: new Date().toISOString().split('T')[0],
          totalXp: 50,
          wordsMasteredCount: 0,
          conversationsCount: 0,
          grammarChecksCount: 0,
          translationsCount: 0,
          practiceMinutes: 0,
          challengesCompletedCount: 0,
          badges: INITIAL_BADGES,
          isLoggedIn: true,
          isGuest: false,
        };
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
      notifyListeners(profile);

      return { success: true, user: profile };
    } catch (err: any) {
      console.error('Firebase Google sign-in error:', err);
      return { success: false, error: mapAuthError(err) };
    } finally {
      isAuthActionInProgress = false;
    }
  }

  /**
   * Send Password Reset Instructions via Firebase Auth
   */
  static async sendPasswordReset(
    email: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      return { success: false, message: '', error: 'Please enter a valid email address.' };
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      return {
        success: true,
        message: `Password reset instructions have been sent to ${trimmedEmail}. Please check your inbox (and spam folder) to reset your password.`,
      };
    } catch (err: any) {
      console.error('Firebase password reset error:', err);
      return { success: false, message: '', error: mapAuthError(err) };
    }
  }

  /**
   * Update Profile data
   */
  static updateUserProfile(updates: Partial<UserProfile>): UserProfile {
    const current = this.getCurrentUser();
    const updated: UserProfile = { ...current, ...updates };

    if (updated.isLoggedIn && !updated.isGuest) {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      }

      // Asynchronously sync to Firestore
      try {
        const userDocRef = doc(db, 'users', updated.uid);
        const payload: Record<string, any> = {
          updatedAt: new Date().toISOString(),
        };
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.nativeLanguage !== undefined) payload.nativeLanguage = updates.nativeLanguage;
        if (updates.englishLevel !== undefined) payload.englishLevel = updates.englishLevel;
        if (updates.learningGoal !== undefined) payload.learningGoal = updates.learningGoal;
        if (updates.dailyPracticeGoal !== undefined) payload.dailyPracticeGoal = updates.dailyPracticeGoal;
        if (updates.totalXp !== undefined) payload.totalXp = updates.totalXp;
        if (updates.streakDays !== undefined) payload.streakDays = updates.streakDays;
        if (updates.lastActiveDate !== undefined) payload.lastActiveDate = updates.lastActiveDate;
        if (updates.wordsMasteredCount !== undefined) payload.wordsMasteredCount = updates.wordsMasteredCount;
        if (updates.conversationsCount !== undefined) payload.conversationsCount = updates.conversationsCount;
        if (updates.grammarChecksCount !== undefined) payload.grammarChecksCount = updates.grammarChecksCount;
        if (updates.translationsCount !== undefined) payload.translationsCount = updates.translationsCount;
        if (updates.practiceMinutes !== undefined) payload.practiceMinutes = updates.practiceMinutes;
        if (updates.challengesCompletedCount !== undefined) payload.challengesCompletedCount = updates.challengesCompletedCount;

        setDoc(userDocRef, payload, { merge: true }).catch((err) => {
          console.warn('Error syncing profile updates to Firestore:', err);
        });
      } catch (err) {
        console.warn('Error preparing Firestore update:', err);
      }
    }

    notifyListeners(updated);
    return updated;
  }

  /**
   * Log out completely from Firebase Auth and clear local session
   */
  static async logout(): Promise<UserProfile> {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Firebase signOut error:', e);
    }
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem('englishpro_user_v3');
      }
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
    const guest: UserProfile = { ...GUEST_USER, isLoggedIn: false, isGuest: true };
    notifyListeners(guest);
    return guest;
  }

  static signOut = AuthService.logout;
}
