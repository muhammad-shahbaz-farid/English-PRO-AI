import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function testDirect() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Has API key:', !!apiKey, 'Length:', apiKey?.length);
  const ai = new GoogleGenAI({ apiKey });
  
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  for (const m of models) {
    try {
      console.log(`Trying model: ${m}...`);
      const res = await ai.models.generateContent({
        model: m,
        contents: 'Say hello in JSON: {"reply": "..."}',
        config: { responseMimeType: 'application/json' },
      });
      console.log(`SUCCESS with ${m}:`, res.text);
      break;
    } catch (e: any) {
      console.log(`Failed with ${m}:`, e.message || e.status || e);
    }
  }
}

testDirect().catch(console.error);
