// Comprehensive Live System & Functional Test Suite
import { isSpeechRecognitionSupported, isMediaRecorderSupported, stopMediaStreamTracks, stopMediaRecorder } from '../src/utils/speech';
import { detectInputLanguage, getLanguageLockInstruction } from '../src/utils/languageDetector';

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

async function runLiveTests() {
  console.log('=================================================================');
  console.log('  RUNNING ACTUAL LIVE RUNTIME & FUNCTIONAL TEST SUITE');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      if (detail) console.log(`         -> ${detail}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      if (detail) console.error(`         -> ${detail}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // SUITE 1: SPEECH RECOGNITION & MEDIARECORDER UTILITIES
  // -------------------------------------------------------------
  console.log('--- Suite 1: Speech Recognition & MediaRecorder Architectural Functions ---');
  
  assert(typeof isSpeechRecognitionSupported === 'function', 'isSpeechRecognitionSupported exists');
  assert(typeof isMediaRecorderSupported === 'function', 'isMediaRecorderSupported exists');
  assert(typeof stopMediaStreamTracks === 'function', 'stopMediaStreamTracks exists');
  assert(typeof stopMediaRecorder === 'function', 'stopMediaRecorder exists');

  // Verify safe execution of stopMediaStreamTracks with null/mock
  try {
    stopMediaStreamTracks(null);
    let trackStopped: boolean = false;
    const mockTrack = { stop: () => { trackStopped = true; } };
    const mockStream = { getTracks: () => [mockTrack] } as any;
    stopMediaStreamTracks(mockStream);
    assert(Boolean(trackStopped), 'stopMediaStreamTracks iterates and stops all tracks on MediaStream');
  } catch (e: any) {
    assert(false, 'stopMediaStreamTracks failed', e.message);
  }

  // Verify safe execution of stopMediaRecorder
  try {
    let recorderStopped: boolean = false;
    let streamTrackStopped: boolean = false;
    const mockRecorder = {
      state: 'recording',
      stop: () => { recorderStopped = true; },
    } as any;
    const mockStream = {
      getTracks: () => [{ stop: () => { streamTrackStopped = true; } }],
    } as any;
    stopMediaRecorder(mockRecorder, mockStream);
    assert(Boolean(recorderStopped && streamTrackStopped), 'stopMediaRecorder halts recorder AND stops all stream tracks');
  } catch (e: any) {
    assert(false, 'stopMediaRecorder failed', e.message);
  }

  // -------------------------------------------------------------
  // SUITE 2: LANGUAGE DETECTION & LOCK LOGIC
  // -------------------------------------------------------------
  console.log('\n--- Suite 2: Language Detection & Deterministic Lock ---');
  
  const urduScriptTest = detectInputLanguage('میں روزانہ انگریزی سیکھنا چاہتا ہوں');
  assert(urduScriptTest.detectedLanguage === 'ur', 'Accurately detects Urdu script (ur)');
  assert(urduScriptTest.effectiveResponseLanguage === 'ur', 'Sets effective response language to Urdu (ur)');

  const romanUrduTest = detectInputLanguage('mujhe office mein presentation dene mein masla hota hai');
  assert(romanUrduTest.detectedLanguage === 'roman_ur', 'Accurately detects Roman Urdu (roman_ur)');
  assert(romanUrduTest.effectiveResponseLanguage === 'roman_ur', 'Sets effective response language to Roman Urdu (roman_ur)');

  const englishTest = detectInputLanguage('I want to practice preparing for an interview as a software engineer');
  assert(englishTest.detectedLanguage === 'en', 'Accurately detects English (en)');
  assert(englishTest.effectiveResponseLanguage === 'en', 'Sets effective response language to English (en)');

  const instructionUrdu = getLanguageLockInstruction('ur');
  assert(instructionUrdu.toLowerCase().includes('urdu script'), 'Provides Urdu script lock directive', instructionUrdu);

  const instructionRomanUrdu = getLanguageLockInstruction('roman_ur');
  assert(instructionRomanUrdu.toLowerCase().includes('roman urdu'), 'Provides Roman Urdu lock directive', instructionRomanUrdu);

  // -------------------------------------------------------------
  // SUITE 3: SERVER HEALTH & GEMINI STATUS
  // -------------------------------------------------------------
  console.log('\n--- Suite 3: Server & Gemini AI Live Health Check ---');
  
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  assert(healthRes.status === 200 && healthData.status === 'ok', 'Server /api/health returned 200 OK', JSON.stringify(healthData));
  assert(healthData.hasApiKey === true, 'Gemini API Key is configured and ready');

  // -------------------------------------------------------------
  // SUITE 4: LIVE GEMINI CONVERSATION TUTOR (CHAT ENDPOINT)
  // -------------------------------------------------------------
  console.log('\n--- Suite 4: Live Gemini Chat / Conversation Tutor ---');
  
  // 4.1 English Conversation
  console.log('  Testing English Conversation Turn...');
  const chatEn = await post('/api/gemini/chat', {
    scenario: 'Job Interview',
    difficulty: 'Intermediate',
    messages: [
      { role: 'user', content: 'Good morning, I am applying for the full-stack developer position.' },
    ],
  });
  assert(chatEn.status === 200, 'English chat returned HTTP 200');
  assert(typeof chatEn.data.reply === 'string' && chatEn.data.reply.length > 20, 'Returned authentic AI tutor reply', chatEn.data.reply.slice(0, 80) + '...');
  assert(Array.isArray(chatEn.data.suggestedResponses) && chatEn.data.suggestedResponses.length > 0, 'Returned suggested responses for student');

  // 4.2 Roman Urdu Conversation
  console.log('  Testing Roman Urdu Conversation Turn...');
  const chatRoman = await post('/api/gemini/chat', {
    scenario: 'Daily Conversation',
    difficulty: 'Beginner',
    messages: [
      { role: 'user', content: 'main english seekhna chahta hoon magar bolte waqt alfaz bhool jata hoon' },
    ],
  });
  assert(chatRoman.status === 200, 'Roman Urdu chat returned HTTP 200');
  assert(typeof chatRoman.data.reply === 'string' && chatRoman.data.reply.length > 20, 'Returned conversational reply in Roman Urdu/Bilingual', chatRoman.data.reply.slice(0, 80) + '...');
  assert(chatRoman.data.effectiveResponseLanguage === 'roman_ur', 'Identified and responded matching Roman Urdu');

  // -------------------------------------------------------------
  // SUITE 5: LIVE GEMINI GRAMMAR DOCTOR
  // -------------------------------------------------------------
  console.log('\n--- Suite 5: Live Grammar Doctor ---');
  
  const grammarRes = await post('/api/gemini/grammar', {
    text: 'Yesterday she buyed two book from the market.',
    level: 'Beginner',
  });
  assert(grammarRes.status === 200, 'Grammar checker returned HTTP 200');
  assert(
    grammarRes.data.correctedText?.toLowerCase().includes('bought') &&
    grammarRes.data.correctedText?.toLowerCase().includes('books'),
    'Corrected "buyed" to "bought" and "two book" to "two books"',
    `Corrected: "${grammarRes.data.correctedText}"`
  );
  assert(Array.isArray(grammarRes.data.errors) && grammarRes.data.errors.length > 0, 'Identified specific grammar errors');
  assert(typeof grammarRes.data.overallScore === 'number', `Awarded score: ${grammarRes.data.overallScore}/100`);

  // -------------------------------------------------------------
  // SUITE 6: LIVE VOCABULARY GENERATOR
  // -------------------------------------------------------------
  console.log('\n--- Suite 6: Live Vocabulary Generator ---');
  
  const vocabRes = await post('/api/gemini/vocabulary', {
    level: 'Intermediate',
    topic: 'Workplace & Career',
  });
  assert(vocabRes.status === 200, 'Vocabulary generator returned HTTP 200');
  assert(!!vocabRes.data.word && !!vocabRes.data.phonetic, `Generated word: "${vocabRes.data.word}" (${vocabRes.data.phonetic})`);
  assert(!!vocabRes.data.urduMeaning, `Urdu meaning: ${vocabRes.data.urduMeaning}`);
  assert(vocabRes.data.quizQuestion && vocabRes.data.quizQuestion.options?.length >= 4, 'Includes 4-option interactive quiz');

  // -------------------------------------------------------------
  // SUITE 7: LIVE CONTEXTUAL TRANSLATOR
  // -------------------------------------------------------------
  console.log('\n--- Suite 7: Live Contextual Translator ---');
  
  const transRes = await post('/api/gemini/translate', {
    text: 'محنت کامیابی کی کنجی ہے',
    mode: 'ur_to_en',
    formality: 'Natural',
  });
  assert(transRes.status === 200, 'Translator returned HTTP 200');
  assert(
    typeof transRes.data.translation === 'string' &&
    transRes.data.translation.toLowerCase().includes('success'),
    'Translated Urdu proverb to natural English',
    `Translation: "${transRes.data.translation}"`
  );
  assert(!!transRes.data.romanUrdu, `Roman Urdu: "${transRes.data.romanUrdu}"`);

  // -------------------------------------------------------------
  // SUITE 8: LIVE DAILY CHALLENGE GENERATOR & EVALUATOR
  // -------------------------------------------------------------
  console.log('\n--- Suite 8: Live Daily Challenge Flow ---');
  
  // 8.1 Generate
  const chalGen = await post('/api/gemini/challenge/generate', {
    type: 'sentence_correction',
    level: 'Beginner',
  });
  assert(chalGen.status === 200, 'Challenge generated HTTP 200');
  assert(!!chalGen.data.title && !!chalGen.data.prompt, `Challenge Title: "${chalGen.data.title}"`);

  // 8.2 Evaluate Correct Submission
  console.log('  Testing Evaluation of Correct Submission...');
  const chalEvalCorrect = await post('/api/gemini/challenge/evaluate', {
    challengeTitle: 'Present Simple Correction',
    type: 'sentence_correction',
    prompt: 'Fix the error in this sentence: "She go to school every day by bus."',
    userSubmission: 'She goes to school every day by bus.',
    difficulty: 'Beginner',
  });
  assert(chalEvalCorrect.status === 200, 'Challenge evaluated HTTP 200');
  assert(chalEvalCorrect.data.score >= 70 && chalEvalCorrect.data.passed === true, `Evaluation passed with score ${chalEvalCorrect.data.score}/100`, chalEvalCorrect.data.feedback);

  // 8.3 Evaluate Incorrect Submission
  console.log('  Testing Evaluation of Erroneous Submission...');
  const chalEvalIncorrect = await post('/api/gemini/challenge/evaluate', {
    challengeTitle: 'Present Simple Correction',
    type: 'sentence_correction',
    prompt: 'Fix the error in this sentence: "She go to school every day by bus."',
    userSubmission: 'She is go to school every day by bus.',
    difficulty: 'Beginner',
  });
  assert(chalEvalIncorrect.status === 200, 'Incorrect challenge evaluated HTTP 200');
  assert(chalEvalIncorrect.data.score < 70, `Accurately identified mistake with lower score: ${chalEvalIncorrect.data.score}/100`);
  assert(!!chalEvalIncorrect.data.urduTip, 'Provided Urdu coaching tip for learner');

  // -------------------------------------------------------------
  // SUITE 9: LIVE AI WRITING COACH
  // -------------------------------------------------------------
  console.log('\n--- Suite 9: Live AI Writing Coach ---');
  
  const writingRes = await post('/api/gemini/writing', {
    text: 'I am write this email to apply for the project manager role in your company.',
    mode: 'Job Application',
    instructionLanguage: 'en',
  });
  assert(writingRes.status === 200, 'Writing coach returned HTTP 200');
  assert(
    writingRes.data.correctedText?.toLowerCase().includes('writing') ||
    writingRes.data.correctedText?.toLowerCase().includes('am writing'),
    'Corrected "I am write" to "I am writing"',
    `Corrected: "${writingRes.data.correctedText}"`
  );
  assert(Array.isArray(writingRes.data.strengths) && writingRes.data.strengths.length > 0, 'Identified writing strengths');
  assert(Array.isArray(writingRes.data.improvementTips) && writingRes.data.improvementTips.length > 0, 'Provided improvement tips');

  console.log('\n=================================================================');
  console.log(`  ACTUAL LIVE TESTING COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runLiveTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
