import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI } from '@google/generative-ai';

type Data = { enhanced?: string; error?: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });
  }

  try {
    const { text, field } = req.body as { text?: string; field?: string };
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `You are an ATS resume writing assistant. Improve the following ${field ?? 'content'} for clarity, concision, and impact using active voice and quantifiable outcomes when possible. Keep it suitable for a fresher/B.Tech student resume. Return only the improved text without extra commentary.\n\nText:\n${text}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const enhanced = response.text().trim();
    return res.status(200).json({ enhanced });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to enhance text' });
  }
}
