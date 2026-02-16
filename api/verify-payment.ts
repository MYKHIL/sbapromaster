import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Paystack Payment Verification Endpoint
 * 
 * Verifies a Paystack payment transaction
 * GET /api/verify-payment?reference=xxx
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { reference } = req.query;

        if (!reference || typeof reference !== 'string') {
            return res.status(400).json({
                error: 'Missing or invalid payment reference'
            });
        }

        // Verify payment with Paystack
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Paystack verification error:', data);
            return res.status(response.status).json({
                error: 'Payment verification failed',
                details: data.message || 'Unknown error',
            });
        }

        // Return payment details
        return res.status(200).json({
            success: true,
            status: data.data.status,
            amount: data.data.amount / 100, // Convert from pesewas
            currency: data.data.currency,
            reference: data.data.reference,
            paidAt: data.data.paid_at,
            metadata: data.data.metadata,
            customer: {
                email: data.data.customer.email,
            },
        });

    } catch (error: any) {
        console.error('Verify payment error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
}
