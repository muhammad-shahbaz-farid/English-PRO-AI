import { AuthService } from '../src/services/authService';
import { recordPracticeSession, loadPracticeSessions } from '../src/utils/storage';
import { UserProfile } from '../src/types';

// Mock localStorage for Node test
const storage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => storage[key] || null,
  setItem: (key: string, val: string) => { storage[key] = val; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => {
    for (const k in storage) delete storage[k];
  },
};
if (typeof window === 'undefined') {
  (global as any).window = { location: { pathname: '/' } };
}

async function testDashboardActivity() {
  console.log('=== TESTING DASHBOARD & PROGRESS STATS DYNAMICS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, name: string) {
    if (cond) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}`);
      failed++;
    }
  }

  // 1. Create a fresh new user
  const signupRes = await AuthService.signupWithEmail({
    name: 'Kashif Mehmood',
    email: 'kashif@example.com',
    password: 'Password123!',
    englishLevel: 'B1',
    learningGoal: 'Workplace & Career',
    dailyPracticeGoal: 15,
  });
  assert(signupRes.success, 'Created fresh account for Kashif');

  let user = AuthService.getCurrentUser();
  
  // Verify pristine empty state
  assert(user.conversationsCount === 0, 'Initial Practice Sessions: 0');
  assert(user.wordsMasteredCount === 0, 'Initial Vocabulary Learned: 0');
  assert(user.challengesCompletedCount === 0, 'Initial Challenges Completed: 0');
  assert(user.practiceMinutes === 0, 'Initial Practice Time: 0 minutes');
  assert(user.streakDays === 0, 'Initial Current Streak: 0 days');
  assert(user.totalXp === 0, 'Initial XP: 0');

  // Helper simulating App.tsx handleRecordSession
  function simulateRecordSession(session: {
    type: 'conversation' | 'grammar' | 'vocabulary' | 'challenge' | 'translation';
    title: string;
    durationMinutes: number;
    xpEarned: number;
    summary: string;
  }) {
    recordPracticeSession(session);
    const prev = AuthService.getCurrentUser();
    const updated: UserProfile = {
      ...prev,
      totalXp: (prev.totalXp || 0) + session.xpEarned,
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
    AuthService.updateUserProfile(updated);
    return updated;
  }

  // Action 1: User completes first conversation practice
  console.log('\n--- Action 1: Completing AI Conversation Practice ---');
  user = simulateRecordSession({
    type: 'conversation',
    title: 'Workplace Sync Roleplay',
    durationMinutes: 5,
    xpEarned: 35,
    summary: 'Roleplay about daily project standup',
  });
  assert(user.conversationsCount === 1, 'Sessions incremented from 0 to 1');
  assert(user.practiceMinutes === 5, 'Practice minutes incremented to 5 mins');
  assert(user.totalXp === 35, 'XP updated to 35 XP');
  assert(user.streakDays === 1, 'Streak activated from 0 to 1 day');

  // Action 2: User studies vocabulary and masters words
  console.log('\n--- Action 2: Mastering Vocabulary Words ---');
  AuthService.updateUserProfile({ wordsMasteredCount: 3 });
  user = simulateRecordSession({
    type: 'vocabulary',
    title: 'Vocab Flashcard Drill',
    durationMinutes: 3,
    xpEarned: 20,
    summary: 'Mastered 3 new CEFR B1 words',
  });
  assert(user.wordsMasteredCount === 3, 'Vocabulary progress updated to 3 words');
  assert(user.practiceMinutes === 8, 'Practice minutes increased to 8 mins (5 + 3)');
  assert(user.totalXp === 55, 'XP updated to 55 XP (35 + 20)');

  // Action 3: User completes a daily challenge
  console.log('\n--- Action 3: Completing Daily Challenge ---');
  user = simulateRecordSession({
    type: 'challenge',
    title: 'Present Perfect Grammar Quest',
    durationMinutes: 4,
    xpEarned: 40,
    summary: 'Solved grammar challenge successfully',
  });
  assert(user.challengesCompletedCount === 1, 'Challenges Completed incremented to 1');
  assert(user.practiceMinutes === 12, 'Practice minutes increased to 12 mins (8 + 4)');
  assert(user.totalXp === 95, 'XP updated to 95 XP (55 + 40)');

  // Action 4: Grammar Doctor Analysis
  console.log('\n--- Action 4: Grammar Doctor Diagnosis ---');
  user = simulateRecordSession({
    type: 'grammar',
    title: 'Grammar Doctor Analysis',
    durationMinutes: 2,
    xpEarned: 15,
    summary: 'Diagnosed and fixed tense consistency',
  });
  assert(user.grammarChecksCount === 1, 'Grammar analyses incremented to 1');
  assert(user.practiceMinutes === 14, 'Practice minutes increased to 14 mins');
  assert(user.totalXp === 110, 'XP updated to 110 XP');

  // Action 5: Translation practice
  console.log('\n--- Action 5: Urdu ↔ English Translation ---');
  user = simulateRecordSession({
    type: 'translation',
    title: 'Urdu to English Translation',
    durationMinutes: 2,
    xpEarned: 15,
    summary: 'Translated conversational Urdu sentence with idiom',
  });
  assert(user.translationsCount === 1, 'Translations count incremented to 1');
  assert(user.practiceMinutes === 16, 'Practice minutes increased to 16 mins');
  assert(user.totalXp === 125, 'XP updated to 125 XP');

  // Verify practice sessions record in storage
  const sessions = loadPracticeSessions();
  assert(sessions.length === 5, 'Stored exactly 5 authentic practice session records');
  assert(sessions[0].title === 'Urdu to English Translation', 'Most recent session is at top of activity feed');

  console.log(`\nDashboard Activity Tests Complete: ${passed} Passed, ${failed} Failed`);
}

testDashboardActivity().catch(console.error);
