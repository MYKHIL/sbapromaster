import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Paystack Payment Initialization Endpoint
 * 
 * Initializes a Paystack payment transaction
 * POST /api/initialize-payment
 * Body: { email: string, amount: number, metadata: object }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, amount, metadata } = req.body;

        // Validate inputs
        if (!email || !amount) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['email', 'amount']
            });
        }

        // Initialize payment with Paystack
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                amount: amount * 100, // Convert to pesewas (smallest unit)
                metadata: metadata || {},
                callback_url: metadata?.callbackUrl || undefined,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Paystack initialization error:', data);
            return res.status(response.status).json({
                error: 'Payment initialization failed',
                details: data.message || 'Unknown error',
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
