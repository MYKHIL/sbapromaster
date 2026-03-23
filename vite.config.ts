import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

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
          server.middlewares.use('/api/firebase-config', (req, res) => {
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
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              success: true, 
              configs, 
              schoolDatabaseMapping,
              paystackPublicKey: env.PAYSTACK_PUBLIC_KEY,
              activationHash: env.PASSWORD_HASH
            }));
          });

          // Mock Payment Initialization
          server.middlewares.use('/api/initialize-payment', async (req, res) => {
            console.log('[Mock API] Initializing payment request...');
            res.setHeader('Content-Type', 'application/json');

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

            // Fallback to mock reference (will 400 in real SDK, but survives the API call)
            console.warn('[Mock API] Falling back to MOCK reference (PAYSTACK_SECRET_KEY missing or failed)');
            res.end(JSON.stringify({
              success: true,
              authorization_url: 'https://checkout.paystack.com/mock',
              access_code: 'mock_code',
              reference: 'MOCK_' + Date.now()
            }));
          });

          // Mock Payment Verification
          server.middlewares.use('/api/verify-payment', (req, res) => {
            0 && console.log('[Mock API] Verifying payment...');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              status: 'success',
              message: 'Verification successful',
              data: { status: 'success' }
            }));
          });

          // Mock Subscription Activation
          server.middlewares.use('/api/activate-subscription', (req, res) => {
            0 && console.log('[Mock API] Activating subscription...');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Mock activation successful' }));
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
