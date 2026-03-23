import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Paystack Payment Initialization Endpoint
 * 
 * Initializes a Paystack payment transaction
 * POST /api/initialize-payment
 * Body: { email: string, amount: number, metadata: object }
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
        const { email, amount, metadata } = req.body;
        
        const secretKey = (process.env.PAYSTACK_SECRET_KEY || '').trim();
        
        // Log initialization attempt (Safe)
        console.log(`[Paystack API] Initializing payment for ${email} (Mode: ${secretKey.startsWith('sk_live') ? 'LIVE' : 'TEST'})`);

        // Validate inputs
        if (!email || !amount) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['email', 'amount']
            });
        }

        if (!secretKey) {
            console.error('[Paystack API] Error: PAYSTACK_SECRET_KEY is missing');
            return res.status(500).json({ error: 'Paystack Secret Key not configured on server' });
        }

        // Initialize payment with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                amount: Math.round(amount * 100), // Convert to pesewas (smallest unit)
                currency: 'GHS',
                metadata: metadata || {},
                callback_url: metadata?.callbackUrl || undefined,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Paystack initialization error:', data);
            let errorMessage = data.message || 'Unknown error';
            
            if (response.status === 401) {
                errorMessage = 'Paystack API Rejected the Secret Key. Please check your Vercel Environment Variables and ensure PAYSTACK_SECRET_KEY matches the public key and mode (Live/Test).';
            }

            return res.status(response.status).json({
                error: 'Payment initialization failed',
                details: errorMessage,
            });
        }

        // Return authorization URL and reference
        return res.status(200).json({
            success: true,
            authorizationUrl: data.data.authorization_url,
            accessCode: data.data.access_code,
            reference: data.data.reference,
        });

    } catch (error: any) {
        console.error('Initialize payment error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
}

export default allowCors(handler);
