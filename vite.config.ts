import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import { invokeLocalApi } from './vite-api-dev';

dotenv.config();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
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

          // Payment Initialization (local API handler when not in emulator mode)
          server.middlewares.use('/api/initialize-payment', async (req, res) => {
            console.log('[Dev API] Initializing payment request...');
            res.setHeader('Content-Type', 'application/json');

            if (env.VITE_USE_EMULATOR !== 'true') {
              try {
                await invokeLocalApi('initialize-payment', req, res);
                return;
              } catch (err: any) {
                console.error('[Dev API] initialize-payment failed:', err);
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, error: err.message, message: err.message }));
              }
            }

            const secretKey = (env.PAYSTACK_SECRET_KEY || '').trim();
            // If we have a secret key locally, try to get a real reference
            if (secretKey) {
              try {
                // Buffer the request body
                const chunks: any[] = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                const body = JSON.parse(Buffer.concat(chunks).toString());
                const { email, amount, metadata } = body;

                console.log(`[Mock API DEBUG] Real Paystack init for ${email}. Full Secret Key: "${secretKey}"`);
                
                const response = await fetch('https://api.paystack.co/transaction/initialize', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    email,
                    amount: Math.round(amount * 100),
                    currency: 'GHS',
                    metadata: metadata || {}
                  }),
                });

                const data = await response.json();
                if (response.ok) {
                  console.log('[Mock API] Real Paystack initialization SUCCESS');
                  return res.end(JSON.stringify({
                    success: true,
                    authorizationUrl: data.data.authorization_url,
                    accessCode: data.data.access_code,
                    reference: data.data.reference,
                  }));
                }
                console.error('[Mock API] Real Paystack initialization FAILED:', data);
              } catch (err) {
                console.error('[Mock API] Error during real Paystack init:', err);
              }
            }

            // Fallback to mock reference
            console.warn('[Mock API] Falling back to MOCK reference (PAYSTACK_SECRET_KEY missing or failed)');
            res.end(JSON.stringify({
              success: true,
              authorizationUrl: 'https://checkout.paystack.com/mock',
              accessCode: 'mock_code',
              reference: 'MOCK_' + Date.now()
            }));
          });

          // Payment Verification (local API handler when not in emulator mode)
          server.middlewares.use('/api/verify-payment', async (req, res) => {
            res.setHeader('Content-Type', 'application/json');

            if (env.VITE_USE_EMULATOR !== 'true') {
              try {
                await invokeLocalApi('verify-payment', req, res);
                return;
              } catch (err: any) {
                console.error('[Dev API] verify-payment failed:', err);
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, error: err.message, message: err.message }));
              }
            }

            res.end(JSON.stringify({
              success: true,
              status: 'success',
              message: 'Verification successful',
              dbActivated: true,
              data: { status: 'success' }
            }));
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

          // Trial activation (local API handler when not in emulator mode)
          server.middlewares.use('/api/activate-trial', async (req, res) => {
            res.setHeader('Content-Type', 'application/json');

            if (env.VITE_USE_EMULATOR !== 'true') {
              try {
                console.log('[Dev API] Running activate-trial locally...');
                await invokeLocalApi('activate-trial', req, res);
                return;
              } catch (err: any) {
                console.error('[Dev API] activate-trial failed:', err);
                res.statusCode = 500;
                return res.end(JSON.stringify({ success: false, error: err.message, message: err.message }));
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
