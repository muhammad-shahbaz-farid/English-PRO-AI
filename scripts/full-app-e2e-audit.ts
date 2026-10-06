// Complete EnglishPro AI Full Application End-to-End Audit & Verification Suite
import { detectInputLanguage, getLanguageLockInstruction, validateResponseLanguage } from '../src/utils/languageDetector';
import { isSpeechRecognitionSupported, isMediaRecorderSupported, stopMediaStreamTracks, stopMediaRecorder } from '../src/utils/speech';
import { AuthService } from '../src/services/authService';
import { recordPracticeSession, loadPracticeSessions, loadUser, saveUser, loadVocabulary, saveVocabulary, loadDailyChallenges, saveDailyChallenges, resetAllData } from '../src/utils/storage';
import { AppView } from '../src/types';

// Mock localStorage for node environment
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

async function runAudit() {
  console.log('========================================================================');
  console.log('  ENGLISHPRO AI: COMPREHENSIVE END-TO-END APPLICATION AUDIT');
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

  // --------------------------------------------------------------------
  // SECTION 1: ROUTING & VIEW NAVIGATION MAPPINGS
  // --------------------------------------------------------------------
  console.log('--- SECTION 1: App Routing & View Mapping Symmetry ---');
  const viewToPath = (view: AppView): string => {
    if (view === 'landing') return '/';
    if (view === 'challenges') return '/challenge';
    return `/${view}`;
  };

  const pathToView = (path: string): AppView => {
    const cleanPath = path.toLowerCase().replace(/\/$/, '') || '/';
    switch (cleanPath) {
      case '/dashboard': return 'dashboard';
      case '/conversation': return 'conversation';
      case '/speaking': return 'speaking';
      case '/writing': return 'writing';
      case '/grammar': return 'grammar';
      case '/vocabulary': return 'vocabulary';
      case '/translator': return 'translator';
      case '/challenge':
      case '/challenges': return 'challenges';
      case '/progress': return 'progress';
      case '/profile': return 'profile';
      case '/settings': return 'settings';
      default: return 'landing';
    }
  };

  const allViews: AppView[] = [
    'landing', 'dashboard', 'conversation', 'speaking', 'writing',
    'grammar', 'vocabulary', 'translator', 'challenges', 'progress', 'profile', 'settings'
  ];

  for (const v of allViews) {
    const path = viewToPath(v);
    const resolvedView = pathToView(path);
    assert(resolvedView === v, `Route mapping bidirectional for view: "${v}" -> "${path}"`);
  }

  // --------------------------------------------------------------------
  // SECTION 2: STORAGE, AUTHENTICATION & MULTI-USER ISOLATION
  // --------------------------------------------------------------------
  console.log('\n--- SECTION 2: Storage & Multi-User Data Isolation ---');
  
  // 2.1 User A Signup
  const userARes = await AuthService.signupWithEmail({
    name: 'Zainab Qureshi',
    email: 'zainab@example.com',
    password: 'Password123!',
    englishLevel: 'B2',
    learningGoal: 'Workplace & Career',
    dailyPracticeGoal: 20,
  });
  assert(userARes.success && !!userARes.user, 'Registered User A (Zainab)');
  
  // Record session for User A
  recordPracticeSession({
    type: 'conversation',
    title: 'Workplace Standup',
    durationMinutes: 10,
    xpEarned: 50,
    summary: 'Practiced sprint updates',
  });
  const sessionsUserA = loadPracticeSessions();
  assert(sessionsUserA.length === 1, 'User A has 1 recorded practice session');

  // Master vocabulary for User A
  saveVocabulary([{
    id: 'v_1',
    word: 'articulate',
    phonetic: '/ɑːˈtɪk.jə.lət/',
    partOfSpeech: 'adjective',
    cefrLevel: 'C1',
    definition: 'fluent and clear in speech',
    urduMeaning: 'صاف اور پر اثر بولنے والا',
    urduExplanation: 'جو اپنے خیالات کو آسانی سے بیان کر سکے',
    examples: [{ en: 'She is an articulate speaker.', ur: 'وہ ایک پر اثر بولنے والی مقرر ہے۔' }],
    synonyms: ['fluent', 'eloquent'],
    antonyms: ['hesitant', 'unclear'],
    collocations: ['articulate speaker'],
    mnemonic: 'Article + late',
    isMastered: true,
  }]);
  const vocabUserA = loadVocabulary();
  assert(vocabUserA.filter(w => w.isMastered).length === 1, 'User A mastered word: "articulate"');

  // 2.2 User B Signup
  const userBRes = await AuthService.signupWithEmail({
    name: 'Hamza Tariq',
    email: 'hamza@example.com',
    password: 'Password456!',
    englishLevel: 'A2',
    learningGoal: 'Everyday Fluency',
    dailyPracticeGoal: 15,
  });
  assert(userBRes.success && !!userBRes.user, 'Registered User B (Hamza)');

  // Verify Data Isolation
  const sessionsUserB = loadPracticeSessions();
  assert(sessionsUserB.length === 0, 'User B has 0 practice sessions (User A sessions isolated)');
  const vocabUserB = loadVocabulary();
  assert(vocabUserB.filter(w => w.isMastered).length === 0, 'User B has 0 mastered words (User A vocab isolated)');

  // --------------------------------------------------------------------
  // SECTION 3: DETERMINISTIC LANGUAGE ENGINE
  // --------------------------------------------------------------------
  console.log('\n--- SECTION 3: Language Detection, Locking & Validation ---');

  const testPhrases = [
    { text: 'میں ہر روز آدھا گھنٹہ انگریزی بولنے کی پریکٹس کرتا ہوں', expected: 'ur' },
    { text: 'mujhe job interview mein introduction dete waqt nervousness hoti hai', expected: 'roman_ur' },
    { text: 'Yesterday I presented the quarterly growth metrics to our executive leadership team.', expected: 'en' },
    { text: 'mera main issue yeh hai ke sentence formation slow hoti hai', expected: 'roman_ur' },
  ];

  for (const item of testPhrases) {
    const detected = detectInputLanguage(item.text);
    assert(detected.effectiveResponseLanguage === item.expected, `Detected "${item.text.slice(0, 35)}..." as ${item.expected}`);
  }

  // Response validation tests
  const validUrduResp = validateResponseLanguage('یہ بالکل ممکن ہے، بس روزانہ مشق جاری رکھیں۔', 'ur');
  assert(validUrduResp.isValid, 'validateResponseLanguage correctly approves authentic Urdu script');

  const invalidUrduResp = validateResponseLanguage('This is purely in English without any Urdu script.', 'ur');
  assert(!invalidUrduResp.isValid, 'validateResponseLanguage rejects English when Urdu was locked');

  // --------------------------------------------------------------------
  // SECTION 4: WEB SPEECH API & MEDIARECORDER HARDWARE RELEASE
  // --------------------------------------------------------------------
  console.log('\n--- SECTION 4: Audio Hardware Release & Lifecycle ---');

  let trackStopCalls = 0;
  const mockTrack1 = { stop: () => { trackStopCalls++; } };
  const mockTrack2 = { stop: () => { trackStopCalls++; } };
  const mockStream = { getTracks: () => [mockTrack1, mockTrack2] } as any;

  stopMediaStreamTracks(mockStream);
  assert(trackStopCalls === 2, 'stopMediaStreamTracks released all microphone tracks');

  let recorderState = 'recording';
  const mockRecorder = {
    state: recorderState,
    stop: () => { recorderState = 'inactive'; },
  } as any;

  let stream2TracksStopped = 0;
  const mockStream2 = {
    getTracks: () => [{ stop: () => { stream2TracksStopped++; } }],
  } as any;

  stopMediaRecorder(mockRecorder, mockStream2);
  assert(recorderState === 'inactive' && stream2TracksStopped === 1, 'stopMediaRecorder halted recorder and released tracks');

  // --------------------------------------------------------------------
  // SECTION 5: LIVE AI BACKEND ENDPOINTS (REAL LLM CALLS)
  // --------------------------------------------------------------------
  console.log('\n--- SECTION 5: Live Gemini AI Endpoints Verification ---');

  // 5.1 Health & Status
  const statusRes = await fetch(`${BASE_URL}/api/gemini/status`);
  const statusData = await statusRes.json();
  assert(statusRes.status === 200 && statusData.available === true, 'GET /api/gemini/status reports available: true');

  // 5.2 Chat: Daily Conversation
  console.log('  Testing Live Chat (Conversation View)...');
  const chatRes = await post('/api/gemini/chat', {
    scenario: 'Daily Conversation',
    difficulty: 'Intermediate',
    messages: [
      { role: 'user', content: 'What is the most effective way to expand my conversational vocabulary?' }
    ],
  });
  assert(chatRes.status === 200, 'POST /api/gemini/chat returned 200');
  assert(typeof chatRes.data.reply === 'string' && chatRes.data.reply.length > 25, 'Received substantive AI tutor reply');
  assert(Array.isArray(chatRes.data.suggestedResponses) && chatRes.data.suggestedResponses.length >= 2, 'Received suggested conversational responses');

  // 5.3 Post-Conversation Feedback
  console.log('  Testing Live Post-Conversation Session Assessment...');
  const feedbackRes = await post('/api/gemini/conversation-feedback', {
    scenario: 'Daily Conversation',
    difficulty: 'Intermediate',
    messages: [
      { role: 'user', content: 'Hello! I want to practice English.' },
      { role: 'assistant', content: 'Hello! I would love to help you practice. What topic would you like to discuss today?' },
      { role: 'user', content: 'I like reading books and watching documentary.' },
    ],
  });
  assert(feedbackRes.status === 200, 'POST /api/gemini/conversation-feedback returned 200');
  assert(typeof feedbackRes.data.overallFeedback === 'string' && feedbackRes.data.overallScore > 0, `Received overall feedback with score ${feedbackRes.data.overallScore}/100`);
  assert(Array.isArray(feedbackRes.data.improvementSuggestions) && feedbackRes.data.improvementSuggestions.length > 0, 'Received improvement suggestions');

  // 5.4 Grammar Doctor
  console.log('  Testing Live Grammar Doctor...');
  const grammarRes = await post('/api/gemini/grammar', {
    text: 'He don\'t knows how to wrote an email.',
    level: 'Beginner',
  });
  assert(grammarRes.status === 200, 'POST /api/gemini/grammar returned 200');
  assert(
    grammarRes.data.correctedText?.toLowerCase().includes("doesn't") &&
    grammarRes.data.correctedText?.toLowerCase().includes("write"),
    'Grammar corrected "don\'t knows" -> "doesn\'t know" and "wrote" -> "write"',
    grammarRes.data.correctedText
  );
  assert(Array.isArray(grammarRes.data.errors) && grammarRes.data.errors.length > 0, 'Identified specific grammar errors with explanations');

  // 5.5 Vocabulary Generator
  console.log('  Testing Live Vocabulary Generator...');
  const vocabRes = await post('/api/gemini/vocabulary', {
    topic: 'Technology & Digital',
    level: 'Intermediate',
  });
  assert(vocabRes.status === 200, 'POST /api/gemini/vocabulary returned 200');
  assert(!!vocabRes.data.word && !!vocabRes.data.urduMeaning, `Generated word: "${vocabRes.data.word}" -> "${vocabRes.data.urduMeaning}"`);
  assert(vocabRes.data.quizQuestion && vocabRes.data.quizQuestion.options?.length === 4, 'Quiz question contains 4 options');

  // 5.6 Contextual Translator
  console.log('  Testing Live Translator...');
  const transRes = await post('/api/gemini/translate', {
    text: 'Confidence comes from daily practice, not from perfection.',
    mode: 'en_to_ur',
    formality: 'Natural',
  });
  assert(transRes.status === 200, 'POST /api/gemini/translate returned 200');
  assert(typeof transRes.data.translation === 'string' && transRes.data.translation.length > 5, 'Returned Urdu translation', transRes.data.translation);
  assert(!!transRes.data.romanUrdu, 'Returned Roman Urdu transliteration');

  // 5.7 Daily Challenge Generator & Evaluator
  console.log('  Testing Live Daily Challenge Generator & Evaluator...');
  const genChalRes = await post('/api/gemini/challenge/generate', {
    type: 'sentence_correction',
    level: 'Intermediate',
  });
  assert(genChalRes.status === 200, 'POST /api/gemini/challenge/generate returned 200');
  assert(!!genChalRes.data.title && !!genChalRes.data.prompt, `Challenge generated: "${genChalRes.data.title}"`);

  const evalChalRes = await post('/api/gemini/challenge/evaluate', {
    challengeTitle: 'Sentence Correction Mission',
    type: 'sentence_correction',
    prompt: 'Correct this sentence: "Every student must submit their assignment on time."',
    userSubmission: 'Every student must submit their assignment on time.',
    difficulty: 'Intermediate',
  });
  assert(evalChalRes.status === 200, 'POST /api/gemini/challenge/evaluate returned 200');
  assert(evalChalRes.data.score >= 70 && evalChalRes.data.passed === true, `Evaluation passed with score: ${evalChalRes.data.score}/100`);

  // 5.8 AI Writing Coach
  console.log('  Testing Live AI Writing Coach...');
  const writingRes = await post('/api/gemini/writing', {
    text: 'I am excited to submit my resume for the Senior Frontend Engineer role. Over the last four years, I have architected web applications using React and TypeScript.',
    mode: 'Job Application',
    instructionLanguage: 'en',
  });
  assert(writingRes.status === 200, 'POST /api/gemini/writing returned 200');
  assert(typeof writingRes.data.correctedText === 'string' && writingRes.data.correctedText.length > 20, 'Returned corrected version');
  assert(typeof writingRes.data.naturalVersion === 'string' && writingRes.data.naturalVersion.length > 20, 'Returned natural elevated version');
  assert(writingRes.data.scores?.overall >= 70, `Realistic score awarded: ${writingRes.data.scores?.overall}/100`);

  // --------------------------------------------------------------------
  // SECTION 6: ERROR & MALFORMED INPUT RESILIENCE
  // --------------------------------------------------------------------
  console.log('\n--- SECTION 6: Resilience & Graceful Error Handling ---');

  // 6.1 Empty body in chat
  const emptyChatRes = await post('/api/gemini/chat', {});
  assert(emptyChatRes.status === 400, 'POST /api/gemini/chat rejects empty body with 400');

  // 6.2 Empty text in grammar
  const emptyGrammarRes = await post('/api/gemini/grammar', { text: '   ' });
  assert(emptyGrammarRes.status === 400, 'POST /api/gemini/grammar rejects empty text with 400');

  // 6.3 Empty text in writing
  const emptyWritingRes = await post('/api/gemini/writing', { text: '' });
  assert(emptyWritingRes.status === 400, 'POST /api/gemini/writing rejects empty text with 400');

  // 6.4 Text exceeding 15k characters in writing
  const hugeText = 'a '.repeat(16000);
  const hugeWritingRes = await post('/api/gemini/writing', { text: hugeText });
  assert(hugeWritingRes.status === 400, 'POST /api/gemini/writing rejects text > 15,000 chars with 400');

  console.log('\n========================================================================');
  console.log(`  AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  if (issues.length > 0) {
    console.log('  ISSUES DETECTED:');
    issues.forEach((iss, i) => console.log(`   ${i + 1}. ${iss}`));
  } else {
    console.log('  STATUS: ZERO BUGS FOUND across all audited layers.');
  }
  console.log('========================================================================\n');

  if (failed > 0) process.exit(1);
}

runAudit().catch((err) => {
  console.error('Audit failed with runtime exception:', err);
  process.exit(1);
});
