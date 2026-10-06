// Automated End-to-End AI test runner

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

async function runAITests() {
  console.log('=== STARTING END-TO-END LIVE GEMINI AI FUNCTIONAL QA ===\n');
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

  // 1. Health Status
  console.log('--- 1. Gemini Server API Health ---');
  const healthRes = await fetch(`${BASE_URL}/api/gemini/status`);
  const health = await healthRes.json();
  assert(healthRes.status === 200 && health.available === true, 'Gemini status endpoint returns available: true');

  // 2. AI Conversation Scenarios & Difficulties
  console.log('\n--- 2. AI Conversation Scenarios & Levels ---');
  const scenarios = [
    { title: 'Daily Conversation', level: 'Beginner', userMsg: 'Hello! What should I eat for breakfast today?' },
    { title: 'Job Interview', level: 'Intermediate', userMsg: 'I have five years of experience in product design.' },
    { title: 'Travel', level: 'Beginner', userMsg: 'Excuse me, where is the departure gate for flight PK-302?' },
    { title: 'University', level: 'Intermediate', userMsg: 'Could you give me an extension on the literature assignment?' },
    { title: 'Workplace', level: 'Advanced', userMsg: 'Let us optimize our cross-departmental delivery roadmap for Q4.' },
    { title: 'Technology', level: 'Intermediate', userMsg: 'How does cloud computing improve database scalability?' },
    { title: 'Free Conversation', level: 'Advanced', userMsg: 'What do you think is the philosophical difference between knowledge and wisdom?' },
  ];

  for (const sc of scenarios) {
    console.log(`  Testing Scenario: ${sc.title} (${sc.level})`);
    const chatRes = await post('/api/gemini/chat', {
      scenario: sc.title,
      difficulty: sc.level,
      messages: [{ role: 'user', content: sc.userMsg }],
    });
    assert(chatRes.status === 200, `${sc.title} returned HTTP 200`);
    assert(typeof chatRes.data.reply === 'string' && chatRes.data.reply.length > 10, `${sc.title} returned real Gemini tutor reply`);
    assert(Array.isArray(chatRes.data.suggestedResponses) && chatRes.data.suggestedResponses.length > 0, `${sc.title} returned suggested conversational responses`);
  }

  // 3. Grammar Doctor
  console.log('\n--- 3. Grammar Doctor Diagnosis ---');
  
  // 3.1 Incorrect sentence
  console.log('  Testing Incorrect Sentence...');
  const gramBad = await post('/api/gemini/grammar', {
    text: 'He go to school yesterday and do not ate nothing.',
    level: 'Beginner',
  });
  assert(gramBad.status === 200, 'Grammar check returned HTTP 200 for incorrect sentence');
  assert(gramBad.data.correctedText?.toLowerCase().includes('went'), 'Corrected "go" to past tense "went"');
  assert(gramBad.data.errors?.length > 0, 'Identified specific grammar errors');
  assert(!!gramBad.data.explanation, 'Provided learner-friendly explanation');
  assert(!!gramBad.data.errors?.[0]?.urduTip || !!gramBad.data.summary, 'Provided Urdu coaching tip or summary');
  assert(!!gramBad.data.naturalAlternative, 'Provided natural native alternative');
  assert(Array.isArray(gramBad.data.alternativeVersions) && gramBad.data.alternativeVersions.length > 0, 'Provided tone variations (Formal & Casual)');

  // 3.2 Correct sentence
  console.log('  Testing Correct Sentence...');
  const gramGood = await post('/api/gemini/grammar', {
    text: 'Although the weather was unfavorable, our team successfully delivered the final presentation.',
    level: 'Advanced',
  });
  assert(gramGood.status === 200, 'Grammar check returned HTTP 200 for correct sentence');
  assert(gramGood.data.overallScore >= 90, `High score awarded for flawless sentence (${gramGood.data.overallScore}/100)`);

  // 3.3 Empty input
  console.log('  Testing Empty Input Handling...');
  const gramEmpty = await post('/api/gemini/grammar', { text: '   ' });
  assert(gramEmpty.status === 400 && gramEmpty.data.error, 'Rejects empty text with HTTP 400 and clear error message');

  // 3.4 Long input
  console.log('  Testing Long Paragraph Input...');
  const longText = 'English communication is essential for global business opportunities. When professionals speak with clear pronunciation and grammatically coherent sentence structures, their ideas are received with greater credibility. Furthermore, regular practice in diverse simulated environments accelerates confidence.';
  const gramLong = await post('/api/gemini/grammar', { text: longText, level: 'Intermediate' });
  assert(gramLong.status === 200 && gramLong.data.summary, 'Successfully processed long paragraph with comprehensive summary');

  // 4. Vocabulary Generator
  console.log('\n--- 4. Vocabulary Generator & Flashcards ---');
  const vocabTests = [
    { level: 'Beginner', topic: 'Daily Life' },
    { level: 'Intermediate', topic: 'Workplace' },
    { level: 'Advanced', topic: 'Technology' },
  ];

  for (const vt of vocabTests) {
    console.log(`  Generating Vocab: Level ${vt.level}, Topic "${vt.topic}"...`);
    const vRes = await post('/api/gemini/vocabulary', {
      level: vt.level,
      topic: vt.topic,
    });
    assert(vRes.status === 200, `Vocabulary generated for ${vt.level} ${vt.topic}`);
    assert(!!vRes.data.word && !!vRes.data.phonetic, `Word ("${vRes.data.word}") has IPA phonetic transcription`);
    assert(!!vRes.data.definition && !!vRes.data.urduMeaning, 'Contains English definition and authentic Urdu meaning');
    assert(Array.isArray(vRes.data.examples) && vRes.data.examples.length > 0 && !!vRes.data.examples[0].ur, 'Contains example sentence and Urdu translation');
    assert(!!vRes.data.mnemonic, 'Contains mnemonic memory hook');
    assert(vRes.data.quizQuestion && vRes.data.quizQuestion.options?.length >= 3, 'Contains interactive 4-option retention quiz');
  }

  // 5. Urdu ↔ English Translator
  console.log('\n--- 5. Urdu ↔ English Translator ---');
  
  // 5.1 English to Urdu (Short)
  console.log('  Translating English to Urdu (Short)...');
  const tr1 = await post('/api/gemini/translate', {
    text: 'Could you please explain this concept again?',
    mode: 'en_to_ur',
  });
  assert(tr1.status === 200, 'English to Urdu returned HTTP 200');
  assert(typeof tr1.data.translation === 'string' && tr1.data.translation.length > 5, 'Returned authentic Urdu translation');
  assert(!!tr1.data.romanUrdu, 'Returned Roman Urdu phonetic transcription');
  assert(Array.isArray(tr1.data.breakdown) && tr1.data.breakdown.length > 0, 'Returned word-by-word anatomical breakdown');

  // 5.2 Urdu to English (Long)
  console.log('  Translating Urdu to English (Long)...');
  const tr2 = await post('/api/gemini/translate', {
    text: 'اگر آپ روزانہ آدھا گھنٹہ انگریزی بولنے کی مشق کریں گے تو آپ کی جھجھک چند ہفتوں میں ختم ہو جائے گی۔',
    mode: 'ur_to_en',
  });
  assert(tr2.status === 200, 'Urdu to English returned HTTP 200');
  assert(typeof tr2.data.translation === 'string' && tr2.data.translation.length > 15, 'Returned natural idiomatic English phrasing');
  assert(Array.isArray(tr2.data.alternatives) && tr2.data.alternatives.length > 0, 'Returned alternative natural phrasings');

  // 6. Daily Challenges: Generation & Evaluation
  console.log('\n--- 6. Daily Fluency Challenges ---');
  const chTypes = ['grammar', 'vocabulary', 'sentence_correction'];

  for (const ct of chTypes) {
    console.log(`  Generating challenge type: ${ct}...`);
    const genRes = await post('/api/gemini/challenge/generate', {
      type: ct,
      level: 'Intermediate',
    });
    assert(genRes.status === 200, `Challenge (${ct}) generated successfully`);
    assert(!!genRes.data.title && !!genRes.data.prompt, `Challenge has title ("${genRes.data.title}") and prompt`);
    assert(!!genRes.data.urduHint, 'Challenge includes Urdu hint');
  }

  // 6.1 Evaluate Correct Answer
  console.log('  Evaluating Correct Submission...');
  const evalCorrect = await post('/api/gemini/challenge/evaluate', {
    challengeTitle: 'Past Tense Correction',
    type: 'sentence_correction',
    prompt: 'Fix: She do not likes coffee.',
    userSubmission: 'She does not like coffee.',
    difficulty: 'Beginner',
  });
  assert(evalCorrect.status === 200, 'Evaluation returned HTTP 200');
  assert(evalCorrect.data.score >= 70 && evalCorrect.data.passed === true, `High score awarded for correct answer (${evalCorrect.data.score}/100)`);
  assert(evalCorrect.data.xpAwarded > 0, `XP awarded for success (${evalCorrect.data.xpAwarded} XP)`);

  // 6.2 Evaluate Incorrect Answer
  console.log('  Evaluating Incorrect Submission...');
  const evalWrong = await post('/api/gemini/challenge/evaluate', {
    challengeTitle: 'Past Tense Correction',
    type: 'sentence_correction',
    prompt: 'Fix: She do not likes coffee.',
    userSubmission: 'She do not like coffee.',
    difficulty: 'Beginner',
  });
  assert(evalWrong.status === 200, 'Incorrect submission evaluated by Gemini');
  assert(evalWrong.data.score < 80, `Lower score accurately assigned for error (${evalWrong.data.score}/100)`);
  assert(evalWrong.data.feedback?.length > 10, 'Helpful constructive feedback provided');
  assert(!!evalWrong.data.urduTip, 'Urdu coaching tip provided');

  console.log(`\n=== END-TO-END AI FUNCTIONAL QA FINISHED: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runAITests().catch((err) => {
  console.error(err);
  process.exit(1);
});
