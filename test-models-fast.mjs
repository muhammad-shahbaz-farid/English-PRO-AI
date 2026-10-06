import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const candidateModels = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

for (const m of candidateModels) {
  try {
    const res = await Promise.race([
      ai.models.generateContent({ model: m, contents: 'Reply "TEST_OK" only.' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('5s timeout')), 5000))
    ]);
    console.log(`[PASS] ${m}: ${res.text?.trim()}`);
  } catch (err) {
    console.log(`[FAIL] ${m}: ${err.message?.slice(0, 80)}`);
  }
}
