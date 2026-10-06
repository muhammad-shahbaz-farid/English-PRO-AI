import { AuthService } from '../src/services/authService';

// Mock localStorage for Node environment testing
const storage: Record<string, string> = {};
(global as any).localStorage = {
  getItem: (key: string) => storage[key] || null,
  setItem: (key: string, val: string) => { storage[key] = val; },
  removeItem: (key: string) => { delete storage[key]; },
  clear: () => {
    for (const k in storage) delete storage[k];
  },
};

// Polyfill window and crypto if needed
if (typeof window === 'undefined') {
  (global as any).window = { location: { pathname: '/' } };
}

async function runTests() {
  console.log('=== STARTING END-TO-END AUTOMATED FUNCTIONAL QA ===\n');
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

  // TEST SUITE 1: AUTHENTICATION & VALIDATION
  console.log('--- Test Suite 1: Authentication & Validation ---');
  
  // 1.1 Empty Name Validation
  const res1 = await AuthService.signupWithEmail({
    name: '',
    email: 'test@example.com',
    password: 'password123',
  });
  assert(!res1.success && res1.error === 'Please enter your full name.', 'Rejects empty name on sign up');

  // 1.2 Invalid Email Validation
  const res2 = await AuthService.signupWithEmail({
    name: 'Sarah Khan',
    email: 'not-an-email',
    password: 'password123',
  });
  assert(!res2.success && (res2.error?.includes('valid email address') ?? false), 'Rejects invalid email format');

  // 1.3 Weak Password Validation (< 6 chars)
  const res3 = await AuthService.signupWithEmail({
    name: 'Sarah Khan',
    email: 'sarah@example.com',
    password: '123',
  });
  assert(!res3.success && (res3.error?.includes('at least 6 characters') ?? false), 'Rejects password shorter than 6 characters');

  // 1.4 Successful User Creation
  const res4 = await AuthService.signupWithEmail({
    name: 'Sarah Khan',
    email: 'sarah@example.com',
    password: 'SecurePassword123!',
    englishLevel: 'B2',
    learningGoal: 'Workplace & Career',
    dailyPracticeGoal: 20,
  });
  assert(res4.success && !!res4.user && res4.user.name === 'Sarah Khan', 'Successfully registers new user');
  assert(res4.user?.email === 'sarah@example.com', 'User has correct registered email');
  assert(res4.user?.englishLevel === 'B2', 'User has selected CEFR level (B2)');
  assert(res4.user?.learningGoal === 'Workplace & Career', 'User has selected learning goal');
  assert(res4.user?.dailyPracticeGoal === 20, 'User has selected daily practice goal (20 min)');
  assert(res4.user?.streakDays === 0, 'New user streak initialized to 0 (no fake streak)');
  assert(res4.user?.totalXp === 0, 'New user XP initialized to 0 (no fake XP)');

  // 1.5 Duplicate Email Rejection
  const res5 = await AuthService.signupWithEmail({
    name: 'Another Sarah',
    email: 'sarah@example.com',
    password: 'SecurePassword123!',
  });
  assert(!res5.success && (res5.error?.includes('already exists') ?? false), 'Rejects duplicate email signup');

  // 1.6 Password Storage Security (Plaintext password check)
  const storedAccountsRaw = localStorage.getItem('englishpro_auth_accounts_v3') || '[]';
  const storedAccounts = JSON.parse(storedAccountsRaw);
  const sarahAccount = storedAccounts.find((a: any) => a.email === 'sarah@example.com');
  assert(sarahAccount && sarahAccount.passwordHash !== 'SecurePassword123!', 'Passwords are NEVER stored in plain text');
  assert(sarahAccount?.passwordHash?.length >= 32, 'Password stored as cryptographic hash');

  // 1.7 Invalid Password Login
  const res6 = await AuthService.loginWithEmail('sarah@example.com', 'WrongPassword!');
  assert(!res6.success && (res6.error?.includes('Incorrect password') ?? false), 'Rejects wrong password with clear error message');

  // 1.8 Non-existent User Login
  const res7 = await AuthService.loginWithEmail('nobody@example.com', 'SomePass123');
  assert(!res7.success && (res7.error?.includes('No registered account') ?? false), 'Rejects unknown email with clear error message');

  // 1.9 Valid Login
  const res8 = await AuthService.loginWithEmail('sarah@example.com', 'SecurePassword123!');
  assert(res8.success && res8.user?.email === 'sarah@example.com', 'Logs in successfully with valid credentials');
  assert(res8.user?.isLoggedIn === true && !res8.user?.isGuest, 'Session is authenticated and not guest');

  // 1.10 Session Persistence
  const sessionUser = AuthService.getCurrentUser();
  assert(sessionUser.isLoggedIn === true && sessionUser.name === 'Sarah Khan', 'Session persists correctly in storage');

  // 1.11 Password Reset
  const resReset = await AuthService.sendPasswordReset('sarah@example.com');
  assert(resReset.success && resReset.message.includes('sarah@example.com'), 'Password reset instructions dispatched');
  const resResetFail = await AuthService.sendPasswordReset('random@example.com');
  assert(!resResetFail.success, 'Password reset rejects unregistered email');

  // 1.12 Logout
  const guestAfterLogout = await AuthService.logout();
  assert(!guestAfterLogout.isLoggedIn && (guestAfterLogout.isGuest ?? false) && guestAfterLogout.name === 'Guest User', 'Logout completely clears session');
  const sessionAfterLogout = AuthService.getCurrentUser();
  assert(!sessionAfterLogout.isLoggedIn, 'Storage reflects logged-out guest state');

  // 1.13 Multi-User Isolation (User A vs User B)
  console.log('\n--- Test Suite 2: Multi-User Data Isolation ---');
  const userA = await AuthService.signupWithEmail({
    name: 'Ahmed Tariq',
    email: 'ahmed@example.com',
    password: 'PasswordA123',
  });
  assert(userA.success, 'Created User A (Ahmed)');

  // Simulate User A doing work and updating profile
  AuthService.updateUserProfile({ wordsMasteredCount: 12, totalXp: 150 });
  const userAUpdated = AuthService.getCurrentUser();
  assert(userAUpdated.wordsMasteredCount === 12 && userAUpdated.totalXp === 150, 'User A has 12 mastered words and 150 XP');

  // Log out User A, Create User B
  await AuthService.logout();
  const userB = await AuthService.signupWithEmail({
    name: 'Bilal Hassan',
    email: 'bilal@example.com',
    password: 'PasswordB123',
  });
  assert(userB.success, 'Created User B (Bilal)');
  const userBCurrent = AuthService.getCurrentUser();
  assert(userBCurrent.name === 'Bilal Hassan', 'User B is currently logged in');
  assert(userBCurrent.wordsMasteredCount === 0 && userBCurrent.totalXp === 0, 'User B has 0 XP and 0 words (User A data not leaked to User B)');

  console.log(`\nLocal Auth & Data Integrity Tests Complete: ${passed} Passed, ${failed} Failed`);
}

runTests().catch(console.error);
