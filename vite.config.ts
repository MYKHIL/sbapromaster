import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const getTierKeySuffix = (tierName: string): string => {
    const name = tierName.toLowerCase();
    if (name.includes('trial')) return 'TRIAL';
    if (name.includes('basic')) return 'BASIC';
    if (name.includes('standard')) return 'STANDARD';
    if (name.includes('premium')) return 'PREMIUM';
    if (name.includes('professional')) return 'PROFESSIONAL';
    if (name.includes('enterprise')) return 'ENTERPRISE';
    if (name.includes('custom')) return 'CUSTOM';
    return name.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  };

  const getTierPrice = (tierName: string): number => {
    const key = getTierKeySuffix(tierName);
    const priceString = env[`VITE_TIER_PRICE_${key}`] || '';
    const price = parseFloat(priceString.replace(/[^0-9.]/g, ''));
    return Number.isFinite(price) ? price : 0;
  };

  const getAmountInPesewas = (tierName: string, durationValue: number, durationUnit: string): number => {
    const basePrice = getTierPrice(tierName);
    const totalMonths = durationUnit === 'Year' ? durationValue * 12 : durationValue * 4;
    const secureAmount = (basePrice / 12) * totalMonths;
    return Math.round(secureAmount * 100);
  };

  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'api-mock',
        configureServer(server) {
          server.middlewares.use('/api/firebase-config', async (req, res) => {
            const pk = (env.PAYSTACK_PUBLIC_KEY || '').trim();
            console.log(`[Mock API DEBUG] Serving firebase-config. Full Public Key: "${pk}"`);
            // Dynamically detect all Firebase configurations from loadEnv 'env'
            const configs: { [key: number]: any } = {};
            let index = 1;
            while (env[`FIREBASE_${index}_API_KEY`]) {
              configs[index] = {
                apiKey: env[`FIREBASE_${index}_API_KEY`],
                authDomain: env[`FIREBASE_${index}_AUTH_DOMAIN`],
                projectId: env[`FIREBASE_${index}_PROJECT_ID`],
                storageBucket: env[`FIREBASE_${index}_STORAGE_BUCKET`],
                messagingSenderId: env[`FIREBASE_${index}_MESSAGING_SENDER_ID`],
                appId: env[`FIREBASE_${index}_APP_ID`],
                measurementId: env[`FIREBASE_${index}_MEASUREMENT_ID`],
                isReserved: env[`FIREBASE_${index}_IS_RESERVED`] === 'true',
                label: env[`FIREBASE_${index}_LABEL`] || `Database ${index}`
              };
              index++;
            }

            // Dynamically load school-to-database mapping
            let schoolDatabaseMapping: { [key: string]: number } = {};
            try {
              schoolDatabaseMapping = JSON.parse(env.SCHOOL_DATABASE_MAPPING || '{}');
            } catch (e) {
              console.warn('[Mock API] Failed to parse SCHOOL_DATABASE_MAPPING:', e);
            }
            // Expose subscription prices dynamically from loadEnv 'env' at runtime
            let subscriptionPrices = {
              TRIAL: env.VITE_TIER_PRICE_TRIAL || 'Free',
              BASIC: env.VITE_TIER_PRICE_BASIC || 'GHS 105',
              STANDARD: env.VITE_TIER_PRICE_STANDARD || 'GHS 207',
              PREMIUM: env.VITE_TIER_PRICE_PREMIUM || 'GHS 360',
              PROFESSIONAL: env.VITE_TIER_PRICE_PROFESSIONAL || 'GHS 620',
              ENTERPRISE: env.VITE_TIER_PRICE_ENTERPRISE || 'GHS 920',
              CUSTOM: env.VITE_TIER_PRICE_CUSTOM || 'Quote'
            };

            // Attempt to fetch live subscription prices directly from Vercel
            try {
              console.log('[Mock API] Fetching live config/prices from Vercel...');
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 4000);
              const vercelRes = await fetch('https://sbapromaster.vercel.app/api/firebase-config', { signal: controller.signal });
              clearTimeout(timeoutId);
              
              if (vercelRes.ok) {
                const vercelData = await vercelRes.json();
                if (vercelData.subscriptionPrices) {
                  subscriptionPrices = vercelData.subscriptionPrices;
                  console.log('[Mock API] Successfully fetched live subscription prices from Vercel.');
                }
              }
            } catch (fetchErr) {
              console.warn('[Mock API] Failed to fetch live prices from Vercel. Falling back to local env:', fetchErr);
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              success: true, 
              configs, 
              schoolDatabaseMapping,
              subscriptionPrices,
              paystackPublicKey: env.PAYSTACK_PUBLIC_KEY,
              activationHash: env.PASSWORD_HASH
            }));
          });

          // Mock Payment Initialization
          server.middlewares.use('/api/initialize-payment', async (req, res) => {
            console.log('[Mock API] Initializing payment request...');
            res.setHeader('Content-Type', 'application/json');

            const secretKey = (env.PAYSTACK_SECRET_KEY || '').trim();
            const shouldForwardToVercel = !secretKey && env.VITE_USE_EMULATOR !== 'true';

            if (shouldForwardToVercel) {
              try {
                console.log('[Mock API] Forwarding initialize-payment to Vercel...');
                const chunks: any[] = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                const body = Buffer.concat(chunks).toString();

                const vercelRes = await fetch('https://sbapromaster.vercel.app/api/initialize-payment', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body
                });

                const vercelData = await vercelRes.json();
                res.statusCode = vercelRes.status;
                return res.end(JSON.stringify(vercelData));
              } catch (err: any) {
                console.error('[Mock API] Failed to forward initialize-payment to Vercel:', err);
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, error: err.message }));
              }
            }

            if (secretKey) {
              try {
                const chunks: any[] = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                const rawBody = Buffer.concat(chunks).toString();
                let body: any = {};
                try {
                  body = rawBody ? JSON.parse(rawBody) : {};
                } catch (parseErr: any) {
                  console.error('[Mock API] Invalid JSON body for initialize-payment:', rawBody, parseErr);
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, error: 'Invalid JSON body', message: parseErr.message }));
                }

                const {
                  email,
                  amount,
                  tierName,
                  durationValue,
                  durationUnit,
                  metadata
                } = body;

                if (!email) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ success: false, error: 'Missing email in initialize-payment request' }));
                }

                let paymentAmount = amount;
                if (paymentAmount == null) {
                  if (!tierName || durationValue == null || !durationUnit) {
                    res.statusCode = 400;
                    return res.end(JSON.stringify({
                      success: false,
                      error: 'Missing payment parameters in initialize-payment request',
                      required: ['tierName', 'durationValue', 'durationUnit']
                    }));
                  }
                  paymentAmount = getAmountInPesewas(tierName, Number(durationValue), durationUnit);
                  if (paymentAmount <= 0) {
                    res.statusCode = 400;
                    return res.end(JSON.stringify({
                      success: false,
                      error: 'Unable to determine payment amount from tier and duration'
                    }));
                  }
                }

                const MIN_PAYSTACK_AMOUNT = 100;
                if (paymentAmount > 0 && paymentAmount < MIN_PAYSTACK_AMOUNT) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({
                    success: false,
                    error: 'Paystack requires a minimum amount',
                    message: `Paystack transactions must be at least GH₵ ${(MIN_PAYSTACK_AMOUNT / 100).toFixed(2)}.`
                  }));
                }

                console.log(`[Mock API DEBUG] Real Paystack init for ${email}. Full Secret Key: "${secretKey}"`);
                
                const response = await fetch('https://api.paystack.co/transaction/initialize', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    email,
                    amount: Math.round(Number(paymentAmount)),
                    currency: 'GHS',
                    metadata: metadata || {}
                  }),
                });

                const data = await response.json();
                if (response.ok) {
                  console.log('[Mock API] Real Paystack initialization SUCCESS');
                  res.statusCode = 200;
                  return res.end(JSON.stringify({
                    success: true,
                    authorizationUrl: data.data.authorization_url,
                    accessCode: data.data.access_code,
                    reference: data.data.reference,
                  }));
                }

                console.error('[Mock API] Real Paystack initialization FAILED:', data);
                res.statusCode = response.status;
                return res.end(JSON.stringify({
                  success: false,
                  error: data.message || 'Paystack initialization failed',
                  details: data.data?.message || data.message || 'Unknown error'
                }));
              } catch (err: any) {
                console.error('[Mock API] Error during real Paystack init:', err);
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, error: err.message || 'Paystack initialization error' }));
              }
            }

            console.warn('[Mock API] Falling back to MOCK reference (PAYSTACK_SECRET_KEY missing)');
            res.end(JSON.stringify({
              success: true,
              authorizationUrl: 'https://checkout.paystack.com/mock',
              accessCode: 'mock_code',
              reference: 'MOCK_' + Date.now()
            }));
          });

          // Mock Payment Verification
          server.middlewares.use('/api/verify-payment', async (req, res) => {
            res.setHeader('Content-Type', 'application/json');

            const secretKey = (env.PAYSTACK_SECRET_KEY || '').trim();
            const shouldForwardToVercel = !secretKey && env.VITE_USE_EMULATOR !== 'true';

            if (shouldForwardToVercel) {
              try {
                const url = new URL(req.url || '', `http://${req.headers.host}`);
                const reference = url.searchParams.get('reference') || '';
                console.log(`[Mock API] Forwarding verify-payment to Vercel for reference: ${reference}...`);

                const vercelRes = await fetch(`https://sbapromaster.vercel.app/api/verify-payment?reference=${reference}`);
                const vercelData = await vercelRes.json();
                res.statusCode = vercelRes.status;
                return res.end(JSON.stringify(vercelData));
              } catch (err: any) {
                console.error('[Mock API] Failed to forward verify-payment to Vercel:', err);
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, error: err.message }));
              }
            }

            if (!secretKey) {
              return res.end(JSON.stringify({
                success: true,
                status: 'success',
                message: 'Verification successful',
                dbActivated: true,
                data: { status: 'success' }
              }));
            }

            try {
              const url = new URL(req.url || '', `http://${req.headers.host}`);
              const reference = url.searchParams.get('reference') || '';
              const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${secretKey}`,
                  'Content-Type': 'application/json'
                }
              });

              const data = await response.json();
              if (!response.ok) {
                console.error('[Mock API] Paystack verification failed:', data);
                res.statusCode = response.status;
                return res.end(JSON.stringify({ success: false, error: data.message || 'Verification failed', details: data }));
              }

              return res.end(JSON.stringify({
                success: true,
                status: data.data.status,
                amount: data.data.amount / 100,
                currency: data.data.currency,
                reference: data.data.reference,
                metadata: data.data.metadata,
                customer: {
                  email: data.data.customer?.email || ''
                }
              }));
            } catch (err: any) {
              console.error('[Mock API] Error during Paystack verification:', err);
              res.statusCode = 500;
              return res.end(JSON.stringify({ success: false, error: err.message || 'Verification error' }));
            }
          });

          // Mock Subscription Activation
          server.middlewares.use('/api/activate-subscription', async (req, res) => {
            res.setHeader('Content-Type', 'application/json');

            if (env.VITE_USE_EMULATOR !== 'true') {
              try {
                console.log('[Mock API] Forwarding activate-subscription to Vercel...');
                const chunks: any[] = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                const body = Buffer.concat(chunks).toString();

                const vercelRes = await fetch('https://sbapromaster.vercel.app/api/activate-subscription', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body
                });

                const vercelData = await vercelRes.json();
                res.statusCode = vercelRes.status;
                return res.end(JSON.stringify(vercelData));
              } catch (err: any) {
                console.error('[Mock API] Failed to forward activate-subscription to Vercel:', err);
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, error: err.message }));
              }
            }

            res.end(JSON.stringify({ success: true, message: 'Mock activation successful' }));
          });

          // Mock Trial Activation
          server.middlewares.use('/api/activate-trial', async (req, res) => {
            res.setHeader('Content-Type', 'application/json');

            if (env.VITE_USE_EMULATOR !== 'true') {
              try {
                console.log('[Mock API] Forwarding activate-trial to Vercel...');
                const chunks: any[] = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                const body = Buffer.concat(chunks).toString();

                const vercelRes = await fetch('https://sbapromaster.vercel.app/api/activate-trial', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body
                });

                const vercelData = await vercelRes.json();
                res.statusCode = vercelRes.status;
                return res.end(JSON.stringify(vercelData));
              } catch (err: any) {
                console.error('[Mock API] Failed to forward activate-trial to Vercel:', err);
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, error: err.message }));
              }
            }

            res.end(JSON.stringify({ success: true, message: 'Mock trial activation successful' }));
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks: {
            // 'vendor-pdf': ['jspdf', 'html2canvas'], // Keep this off for now, let auto-splitting work
          }
        }
      }
    },
  };
});
