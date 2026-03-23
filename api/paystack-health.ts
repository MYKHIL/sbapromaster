import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Paystack Health Check Endpoint
 * 
 * Verifies if the PAYSTACK_SECRET_KEY is valid by hitting the /balance endpoint.
 * GET /api/paystack-health
 */
const allowCors = (fn: (req: VercelRequest, res: VercelResponse) => Promise<any>) => async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
};

async function handler(req: VercelRequest, res: VercelResponse) {
    const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
    
    if (!secretKey) {
        return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is missing' });
    }

    try {
        console.log(`[Paystack Health] Testing key: ${secretKey.substring(0, 8)}...`);
        
        const response = await fetch('https://api.paystack.co/balance', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
            },
        });

        const data = await response.json();

        return res.status(response.status).json({
            status: response.status,
            ok: response.ok,
            message: data.message,
            apiKeyPrefix: secretKey.substring(0, 8),
            mode: secretKey.startsWith('sk_live') ? 'LIVE' : 'TEST'
        });

    } catch (error: any) {
        return res.status(500).json({
            error: 'Health check failed',
            message: error.message
        });
    }
}

export default allowCors(handler);
