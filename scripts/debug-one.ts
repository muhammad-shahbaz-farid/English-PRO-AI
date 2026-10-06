async function testOne() {
  const res = await fetch('http://localhost:3000/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scenario: 'Job Interview',
      difficulty: 'Intermediate',
      messages: [{ role: 'user', content: 'Hello, I have 5 years experience.' }],
    }),
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Data:', JSON.stringify(data, null, 2));
}
testOne().catch(console.error);
