import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

/**
 * Gemini AI Proxy Endpoint
 * 
 * Proxies requests to Google's Gemini API to keep API keys secure.
 * POST /api/gemini-proxy
 * Body: { 
 *   prompt?: string, 
 *   image?: string, // base64
 *   type: 'text' | 'image' | 'remark' 
 * }
 */
const allowCors = (fn: (req: VercelRequest, res: VercelResponse) => Promise<any>) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { prompt, image, type } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Server misconfigured: Missing AI Key' });
        }

        const genAI = new GoogleGenAI({ apiKey });

        // 1. Text Generation / Teacher Remarks
        if (type === 'remark' || type === 'text') {
            const response = await genAI.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt || 'Hello'
            });
            // Based on lint 'get accessor', text is a property not a function?
            // Or response.text() is correct for @google/generative-ai but maybe @google/genai is different?
            // Lint says: "Type 'String' has no call signatures." implying response.text IS the string.
            // But usually response has candidates. 
            // If the SDK returns the text directly?
            // Let's assume response.text is the string access.
            return res.status(200).json({ text: response.text });
        }

        // 2. Image Enhancement
        if (type === 'image' && image) {
            // Extract base64 data (remove header if present)
            const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;
            // Basic MIME type assumption or pass it in. Google GenAI inlineData needs mimeType.
            // We'll guess or assume jpeg/png.
            const mimeType = image.substring(image.indexOf(':') + 1, image.indexOf(';')) || 'image/jpeg';

            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType
                }
            };

            const response = await genAI.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                    role: 'user',
                    parts: [
                        imagePart,
                        { text: prompt || 'Enhance this image' }
                    ]
                }
            });

            // Return structure matching what client expects
            // The newer SDK response structure might differ slightly but client expects candidates
            // mapped to our service.

            return res.status(200).json({
                text: response.text,
                candidates: response.candidates
            });
        }

        return res.status(400).json({ error: 'Invalid request type or missing data' });

    } catch (error: any) {
        console.error('Gemini proxy error:', error);
        return res.status(500).json({
            error: 'AI service error',
            message: error.message,
        });
    }
}

export default allowCors(handler);
