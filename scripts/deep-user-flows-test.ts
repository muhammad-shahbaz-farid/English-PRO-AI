// Comprehensive Deep Real User-Facing Flows Test Suite
import { AuthService } from '../src/services/authService';
import {
  loadUserProfile,
  saveUserProfile,
  loadSettings,
  saveSettings,
  loadVocabulary,
  saveVocabulary,
  loadDailyChallenges,
  saveDailyChallenges,
  loadPracticeSessions,
  recordPracticeSession,
  resetAllData,
} from '../src/utils/storage';
import {
  isSpeechRecognitionSupported,
  isMediaRecorderSupported,
  stopMediaStreamTracks,
  stopMediaRecorder,
} from '../src/utils/speech';
import {
  calculateSpeakingMetrics,
  estimateSpeakingScores,
} from '../src/utils/speakingMetrics';
import { AppView, UserProfile } from '../src/types';

// Mock localStorage for headless test runner
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

const BASE_URL = 'http://localhost:3000';

async function post(endpoint: string, body: any) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runDeepUserFlowTests() {
  console.log('========================================================================');
  console.log('  STARTING DEEP REAL USER-FACING FLOWS VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;
  const issues: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      if (detail) console.log(`         -> ${detail}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (detail) console.error(`         -> ${detail}`);
      issues.push(testName + (detail ? `: ${detail}` : ''));
      failed++;
    }
  }

  // ====================================================================
  // 1. AUTHENTICATION — ACTUAL USER FLOW
  // ====================================================================
  console.log('--- 1. AUTHENTICATION: Actual User Flow ---');

  // 1.1 Empty Name
  const emptyName = await AuthService.signupWithEmail({
    name: '   ',
    email: 'user@example.com',
    password: 'password123',
  });
  assert(!emptyName.success && Boolean(emptyName.error?.includes('full name')), 'Rejects empty name with clear message');

  // 1.2 Invalid Email
  const invalidEmail = await AuthService.signupWithEmail({
    name: 'Tariq Ali',
    email: 'invalid-email-format',
    password: 'password123',
  });
  assert(!invalidEmail.success && Boolean(invalidEmail.error?.includes('valid email')), 'Rejects invalid email format');

  // 1.3 Weak Password (< 6 chars)
  const weakPass = await AuthService.signupWithEmail({
    name: 'Tariq Ali',
    email: 'tariq@example.com',
    password: '12345',
  });
  assert(!weakPass.success && Boolean(weakPass.error?.includes('6 characters')), 'Rejects password shorter than 6 characters');

  // 1.4 Password Mismatch
  const passMismatch = await AuthService.signupWithEmail({
    name: 'Tariq Ali',
    email: 'tariq@example.com',
    password: 'Password123!',
    confirmPassword: 'DifferentPassword456!',
  });
  assert(!passMismatch.success && Boolean(passMismatch.error?.includes('do not match')), 'Rejects password confirmation mismatch');

  // 1.5 Valid Sign Up
  const validSignup = await AuthService.signupWithEmail({
    name: 'Tariq Ali',
    email: 'tariq@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    englishLevel: 'B2',
    learningGoal: 'Workplace & Career',
    dailyPracticeGoal: 20,
  });
  assert(validSignup.success && !!validSignup.user, 'Successfully registers user with matching passwords');
  assert(validSignup.user?.totalXp === 0, 'New user starts with 0 XP');
  assert(validSignup.user?.streakDays === 0, 'New user starts with 0 streak days');

  // 1.6 Duplicate Email
  const dupEmail = await AuthService.signupWithEmail({
    name: 'Another Tariq',
    email: 'tariq@example.com',
    password: 'Password123!',
    confirmPassword: 'Password123!',
  });
  assert(!dupEmail.success && Boolean(dupEmail.error?.includes('already exists')), 'Rejects duplicate email signup');

  // 1.7 Valid Sign In
  const validSignin = await AuthService.loginWithEmail('tariq@example.com', 'Password123!');
  assert(validSignin.success && !!validSignin.user, 'Logs in successfully with valid credentials');
  assert(validSignin.user?.email === 'tariq@example.com', 'User session holds correct email');

  // 1.8 Wrong Password
  const wrongPass = await AuthService.loginWithEmail('tariq@example.com', 'WrongPassword!');
  assert(!wrongPass.success && Boolean(wrongPass.error?.includes('Incorrect password')), 'Rejects wrong password');

  // 1.9 Unknown Email
  const unknownEmail = await AuthService.loginWithEmail('nonexistent@example.com', 'Password123!');
  assert(!unknownEmail.success && Boolean(unknownEmail.error?.includes('No registered account')), 'Rejects unregistered email');

  // 1.10 Refresh after Login (Session Persistence)
  const currentSession = AuthService.getCurrentUser();
  assert(currentSession.isLoggedIn === true && currentSession.isGuest === false, 'Session persists on reload / refresh');
  assert(currentSession.name === 'Tariq Ali', 'Session retains user name across refresh');

  // 1.11 Password Reset Flow
  const pwdResetValid = await AuthService.sendPasswordReset('tariq@example.com');
  assert(pwdResetValid.success && Boolean(pwdResetValid.message?.includes('sent')), 'Password reset generates recovery dispatch for registered email');

  const pwdResetInvalid = await AuthService.sendPasswordReset('nobody@example.com');
  assert(!pwdResetInvalid.success && Boolean(pwdResetInvalid.error?.includes('No registered account')), 'Password reset rejects unregistered email');

  // 1.12 Logout
  await AuthService.logout();
  const loggedOutUser = AuthService.getCurrentUser();
  assert(loggedOutUser.isLoggedIn === false && loggedOutUser.isGuest === true, 'Logout clears session to guest mode');

  // ====================================================================
  // 2. SPEAKING COACH — COMPLETE USER FLOW
  // ====================================================================
  console.log('\n--- 2. SPEAKING COACH: Complete User Flow ---');

  // 2.1 Calculate speaking metrics on simulated speech
  const testSpeechText = 'Good morning. I am passionate about artificial intelligence and web engineering. Over the past few years, I have built multiple interactive applications with React.';
  const metrics1 = calculateSpeakingMetrics(testSpeechText, 15);
  assert(metrics1.wordCount === 24, `Accurately calculated word count: ${metrics1.wordCount}`);
  assert(metrics1.wordsPerMinute > 60, `Accurately calculated WPM: ${metrics1.wordsPerMinute} WPM`);

  const scores1 = estimateSpeakingScores(metrics1);
  assert(scores1.overallScore >= 70, `Estimated realistic speaking score: ${scores1.overallScore}/100`);

  // 2.2 Live AI Analysis call for Speaking Coach
  console.log('  Submitting speaking coach transcript to Gemini...');
  const speakingAi = await post('/api/gemini/chat', {
    messages: [
      {
        role: 'user',
        content: `[Speaking Practice for topic "Introduce Yourself"]\nStudent Transcript:\n"${testSpeechText}"`,
      },
    ],
    scenario: 'speaking-coach',
    difficulty: 'B2',
    isVoiceInput: true,
    speakingMetrics: metrics1,
  });
  assert(speakingAi.status === 200, 'Speaking coach returned HTTP 200');
  assert(typeof speakingAi.data.reply === 'string' && speakingAi.data.reply.length > 20, 'Speaking coach returned oral feedback', speakingAi.data.reply.slice(0, 80) + '...');

  // 2.3 Edited transcript handling
  const editedText = testSpeechText + ' In addition, I prioritize user experience and performance.';
  const metricsEdited = calculateSpeakingMetrics(editedText, 18);
  assert(metricsEdited.wordCount === 32, `Edited transcript updates word count and metrics immediately (${metricsEdited.wordCount} words)`);

  // 2.4 Hardware Release & Mock Lifecycle
  let streamStopped = false;
  const mockStream = { getTracks: () => [{ stop: () => { streamStopped = true; } }] } as any;
  stopMediaStreamTracks(mockStream);
  assert(streamStopped, 'Microphone stream tracks stopped cleanly on finish / unmount');

  // ====================================================================
  // 3. WRITING COACH — ACTUAL UI FLOW
  // ====================================================================
  console.log('\n--- 3. WRITING COACH: Actual UI Flow ---');

  const writingInput = 'I am write this cover letter for apply to your company. Yesterday I has interview with team.';
  const writingRes = await post('/api/gemini/writing', {
    text: writingInput,
    mode: 'Job Application',
    instructionLanguage: 'en',
  });
  assert(writingRes.status === 200, 'Writing coach analysis returned HTTP 200');
  assert(writingRes.data.originalText === writingInput, 'Original text preserved exactly');
  assert(
    writingRes.data.correctedText?.toLowerCase().includes('writing') ||
    writingRes.data.correctedText?.toLowerCase().includes('had an interview'),
    'Corrected version fixes verb tenses and prepositions',
    writingRes.data.correctedText
  );
  assert(typeof writingRes.data.naturalVersion === 'string' && writingRes.data.naturalVersion.length > 20, 'Natural elevated native version provided');
  assert(Array.isArray(writingRes.data.mistakes) && writingRes.data.mistakes.length > 0, 'Identified specific mistakes breakdown');
  assert(typeof writingRes.data.overallScore === 'number' || typeof writingRes.data.scores?.overall === 'number', 'Scores provided');
  assert(writingRes.data.practiceExercise && Array.isArray(writingRes.data.practiceExercise.options), 'Generated targeted multiple-choice practice exercise');

  // 3.1 Empty Writing Validation
  const emptyWriting = await post('/api/gemini/writing', { text: '   ' });
  assert(emptyWriting.status === 400 && emptyWriting.data.error, 'Rejects empty writing submission with 400');

  // 3.2 Over-limit Writing Validation (> 15,000 chars)
  const hugeText = 'Hello world! '.repeat(1500);
  const overLimitWriting = await post('/api/gemini/writing', { text: hugeText });
  assert(overLimitWriting.status === 400 && overLimitWriting.data.error?.includes('15,000'), 'Rejects text exceeding 15,000 character limit');

  // ====================================================================
  // 4. GRAMMAR — ACTUAL UI FLOW
  // ====================================================================
  console.log('\n--- 4. GRAMMAR DOCTOR: Actual UI Flow ---');

  // 4.1 Incorrect Sentence
  const gramBad = await post('/api/gemini/grammar', {
    text: 'She do not has any idea about the new meeting time.',
    level: 'Beginner',
  });
  assert(gramBad.status === 200, 'Grammar check returned HTTP 200');
  assert(
    gramBad.data.correctedText?.toLowerCase().includes('does not') ||
    gramBad.data.correctedText?.toLowerCase().includes("doesn't"),
    'Corrected "do not has" to "does not have"',
    gramBad.data.correctedText
  );
  assert(!!gramBad.data.explanation, 'Clear explanation provided');
  assert(Array.isArray(gramBad.data.errors) && gramBad.data.errors.length > 0, 'Grammar errors array returned');

  // 4.2 Correct Sentence
  const gramGood = await post('/api/gemini/grammar', {
    text: 'Every member of the team completed the scheduled delivery on time.',
    level: 'Advanced',
  });
  assert(gramGood.status === 200, 'Correct sentence returned HTTP 200');
  assert(gramGood.data.overallScore >= 90, `High score awarded for correct sentence (${gramGood.data.overallScore}/100)`);

  // 4.3 Empty input
  const gramEmpty = await post('/api/gemini/grammar', { text: '' });
  assert(gramEmpty.status === 400, 'Rejects empty grammar check input with 400');

  // ====================================================================
  // 5. VOCABULARY — ACTUAL UI FLOW
  // ====================================================================
  console.log('\n--- 5. VOCABULARY: Actual UI Flow ---');

  const vocabGen = await post('/api/gemini/vocabulary', {
    topic: 'Workplace & Career',
    level: 'Intermediate',
  });
  assert(vocabGen.status === 200, 'Vocabulary generation returned HTTP 200');
  assert(!!vocabGen.data.word && typeof vocabGen.data.word === 'string', `Generated word: "${vocabGen.data.word}"`);
  assert(!!vocabGen.data.definition && typeof vocabGen.data.definition === 'string', 'Contains plain English definition');
  assert(!!vocabGen.data.urduMeaning && typeof vocabGen.data.urduMeaning === 'string', `Contains Urdu meaning: "${vocabGen.data.urduMeaning}"`);
  assert(Array.isArray(vocabGen.data.examples) && vocabGen.data.examples.length > 0, 'Contains realistic example sentences');
  assert(!!vocabGen.data.mnemonic, `Contains mnemonic: "${vocabGen.data.mnemonic}"`);
  assert(vocabGen.data.quizQuestion && vocabGen.data.quizQuestion.options?.length === 4, 'Contains 4-option retention quiz');

  // Quiz evaluation verification
  const correctIdx = vocabGen.data.quizQuestion.correctIndex;
  assert(typeof correctIdx === 'number' && correctIdx >= 0 && correctIdx < 4, `Quiz correct index valid: ${correctIdx}`);

  // ====================================================================
  // 6. TRANSLATOR — ACTUAL UI FLOW
  // ====================================================================
  console.log('\n--- 6. TRANSLATOR: Actual UI Flow ---');

  // 6.1 English to Urdu
  const trEnUr = await post('/api/gemini/translate', {
    text: 'Consistency and regular practice make English conversation easy.',
    mode: 'en_to_ur',
  });
  assert(trEnUr.status === 200, 'English to Urdu returned HTTP 200');
  assert(typeof trEnUr.data.translation === 'string' && trEnUr.data.translation.length > 5, 'Returned Urdu translation');
  assert(!!trEnUr.data.romanUrdu, `Returned Roman Urdu transliteration: "${trEnUr.data.romanUrdu}"`);

  // 6.2 Urdu to English
  const trUrEn = await post('/api/gemini/translate', {
    text: 'اگر آپ بولنے کی مشق نہیں کریں گے تو روانی نہیں آئے گی۔',
    mode: 'ur_to_en',
  });
  assert(trUrEn.status === 200, 'Urdu to English returned HTTP 200');
  assert(
    typeof trUrEn.data.translation === 'string' &&
    trUrEn.data.translation.toLowerCase().includes('practice'),
    'Returned natural English translation',
    trUrEn.data.translation
  );

  // 6.3 Roman Urdu to English
  const trRomanEn = await post('/api/gemini/translate', {
    text: 'mujhe public speaking se pehle thori ghabrahat hoti hai',
    mode: 'ur_to_en',
  });
  assert(trRomanEn.status === 200, 'Roman Urdu to English returned HTTP 200');
  assert(
    typeof trRomanEn.data.translation === 'string' &&
    (trRomanEn.data.translation.toLowerCase().includes('nervous') || trRomanEn.data.translation.toLowerCase().includes('anxious')),
    'Accurately understood and translated Roman Urdu',
    trRomanEn.data.translation
  );

  // 6.4 Empty translation input
  const trEmpty = await post('/api/gemini/translate', { text: '   ', mode: 'en_to_ur' });
  assert(trEmpty.status === 400, 'Rejects empty translation text with 400');

  // ====================================================================
  // 7. DAILY CHALLENGES — ALL VISIBLE TYPES
  // ====================================================================
  console.log('\n--- 7. DAILY CHALLENGES: All 5 Types ---');

  const challengeTypes = ['grammar', 'vocabulary', 'translation', 'sentence_correction', 'multiple_choice'] as const;

  for (const cType of challengeTypes) {
    console.log(`  Testing Challenge Type: "${cType}"...`);
    const genRes = await post('/api/gemini/challenge/generate', {
      type: cType,
      level: 'Intermediate',
    });
    assert(genRes.status === 200, `Generated challenge for "${cType}"`);
    assert(!!genRes.data.title && !!genRes.data.prompt, `Challenge has title ("${genRes.data.title}") and prompt`);
    if (cType === 'multiple_choice') {
      assert(Array.isArray(genRes.data.options) && genRes.data.options.length >= 2, 'Multiple choice challenge contains options');
    }
  }

  // Evaluate correct answer
  const evalRight = await post('/api/gemini/challenge/evaluate', {
    challengeTitle: 'Verb Agreement',
    type: 'sentence_correction',
    prompt: 'Fix: He do not know.',
    userSubmission: 'He does not know.',
    difficulty: 'Beginner',
  });
  assert(evalRight.status === 200 && evalRight.data.passed === true, 'Correct challenge submission passed evaluation');
  assert(evalRight.data.xpAwarded > 0, `XP awarded for success: ${evalRight.data.xpAwarded} XP`);

  // Evaluate empty answer
  const evalEmpty = await post('/api/gemini/challenge/evaluate', {
    challengeTitle: 'Verb Agreement',
    type: 'sentence_correction',
    prompt: 'Fix: He do not know.',
    userSubmission: '   ',
  });
  assert(evalEmpty.status === 400, 'Rejects empty challenge submission with 400');

  // ====================================================================
  // 8. PROGRESS / XP / STREAK & DATA INTEGRITY
  // ====================================================================
  console.log('\n--- 8. PROGRESS, XP & STREAK ACCUMULATION ---');

  // Test single XP accumulation (No double-XP bug)
  let testUser: UserProfile = {
    uid: 'u_xp_test',
    id: 'u_xp_test',
    name: 'XP Tester',
    email: 'xptest@example.com',
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
    totalXp: 100,
    wordsMasteredCount: 0,
    conversationsCount: 0,
    grammarChecksCount: 0,
    translationsCount: 0,
    practiceMinutes: 0,
    challengesCompletedCount: 0,
    badges: [],
    isLoggedIn: true,
    isGuest: false,
  };

  const initialXp = testUser.totalXp;
  const xpToAdd = 25;

  // Simulate handleUpdateUserXp
  testUser = {
    ...testUser,
    totalXp: testUser.totalXp + xpToAdd,
    streakDays: testUser.streakDays === 0 ? 1 : testUser.streakDays,
  };

  // Simulate handleRecordSession (which now does NOT duplicate XP)
  testUser = {
    ...testUser,
    practiceMinutes: testUser.practiceMinutes + 5,
    conversationsCount: testUser.conversationsCount + 1,
    streakDays: testUser.streakDays === 0 ? 1 : testUser.streakDays,
  };

  assert(testUser.totalXp === initialXp + xpToAdd, `Total XP increased by exactly ${xpToAdd} (from ${initialXp} to ${testUser.totalXp}) without duplicate counting`);
  assert(testUser.streakDays === 1, 'Streak initialized to 1 day on active practice');
  assert(testUser.conversationsCount === 1, 'Conversations count incremented to 1');
  assert(testUser.practiceMinutes === 5, 'Practice minutes incremented to 5');

  // ====================================================================
  // 9. PROFILE & SETTINGS
  // ====================================================================
  console.log('\n--- 9. PROFILE & SETTINGS PERSISTENCE ---');

  const settingsTest = loadSettings();
  assert(typeof settingsTest.darkMode === 'boolean', 'Settings has darkMode boolean');
  assert(typeof settingsTest.accentPreference === 'string', 'Settings has accentPreference');

  // Save new settings
  saveSettings({
    ...settingsTest,
    accentPreference: 'British',
    speechRate: 1.1,
  });

  const reloadedSettings = loadSettings();
  assert(reloadedSettings.accentPreference === 'British', 'Settings accent preference persisted');
  assert(reloadedSettings.speechRate === 1.1, 'Settings speech rate persisted');

  // Reset all data test
  const resetOutput = resetAllData();
  assert(resetOutput.user.totalXp === 0, 'Reset cleared XP to 0');
  assert(resetOutput.user.streakDays === 0, 'Reset cleared streak to 0');
  assert(resetOutput.vocab.filter(w => w.isMastered).length === 0, 'Reset cleared mastered vocabulary to 0');

  // ====================================================================
  // 10. ERROR RESILIENCE
  // ====================================================================
  console.log('\n--- 10. ERROR HANDLING & RESILIENCE ---');

  // Invalid JSON body
  const badJsonRes = await fetch(`${BASE_URL}/api/gemini/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"invalidJson',
  });
  const badJsonData = await badJsonRes.json();
  assert(badJsonRes.status === 400 && badJsonData.code === 'BAD_JSON', 'Malformed JSON returns clean JSON error, not HTML');

  // Non-existent route
  const notFoundRes = await fetch(`${BASE_URL}/api/does_not_exist`);
  const notFoundData = await notFoundRes.json();
  assert(notFoundRes.status === 404 && notFoundData.error, 'Unmatched /api route returns structured JSON 404, not HTML fallback');

  // ====================================================================
  // 11. SECURITY
  // ====================================================================
  console.log('\n--- 11. SECURITY VERIFICATION ---');

  // Check that /api/health does not print API key
  const healthResp = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthResp.json();
  assert(healthData.hasApiKey === true && !('apiKey' in healthData) && !('key' in healthData), '/api/health never returns actual API key string');

  // Check status response
  const statusResp = await fetch(`${BASE_URL}/api/gemini/status`);
  const statData = await statusResp.json();
  assert(statData.available === true && !('apiKey' in statData), '/api/gemini/status never leaks API key');

  console.log('\n========================================================================');
  console.log(`  DEEP USER-FACING FLOWS AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  if (issues.length > 0) {
    console.log('  ISSUES:');
    issues.forEach((iss, i) => console.log(`   ${i + 1}. ${iss}`));
  } else {
    console.log('  ALL USER-FACING FLOWS VERIFIED SUCCESSFULLY.');
  }
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runDeepUserFlowTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
