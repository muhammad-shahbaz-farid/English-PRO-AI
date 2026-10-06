import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function testOtherModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });
  
  const testModels = [
    'gemini-3.6-flash',
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro',
    'gemini-3-flash-preview',
  ];

  for (const m of testModels) {
    try {
      console.log(`Trying model: ${m}...`);
      const res = await ai.models.generateContent({
        model: m,
        contents: 'Say hello in JSON: {"reply": "..."}',
        config: { responseMimeType: 'application/json' },
      });
      console.log(`>>> SUCCESS with ${m}! Output:`, res.text);
    } catch (e: any) {
      console.log(`Failed with ${m}:`, e.message || e.status);
    }
  }
}

testOtherModels().catch(console.error);
