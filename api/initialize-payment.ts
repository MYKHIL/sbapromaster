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
        const isLive = secretKey.startsWith('sk_live');
        
        // Log initialization attempt (Safe)
        console.log(`[Paystack API] Initializing payment for ${email} (Server Key Mode: ${isLive ? 'LIVE' : 'TEST'})`);

        // Check for potential mismatch (if we can infer from metadata or similar)
        // But for now, just ensure the user knows which one we found.

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
            let errorDetails = data.message || 'Unknown error'; // Default details to message

            if (response.status === 401) {
                const serverMode = secretKey.startsWith('sk_live') ? 'LIVE' : 'TEST';
                errorMessage = `Paystack API Rejected the Secret Key (Server is in ${serverMode} Mode). Please ensure your Vercel PAYSTACK_SECRET_KEY matches the public key and that both are LIVE keys for a live transaction.`;
                errorDetails = errorMessage;
            } else if (data.data && data.data.message) {
                // Sometimes Paystack returns errors with a nested 'data.message'
                errorDetails = data.data.message;
            }
            
            // The instruction provided a line that seems to be for a different error object structure (e.g., axios error)
            // const errMsg = error.response?.data?.details || error.response?.data?.message || error.message || "Payment initialization failed.";
            // Applying the spirit of the instruction to use 'details' for more specific info if available.

            return res.status(response.status).json({
                error: 'Payment initialization failed',
                message: errorMessage,
                details: errorDetails, // Frontend can check this for more specific info
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
