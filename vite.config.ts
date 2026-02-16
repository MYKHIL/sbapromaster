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
            // Mock the Vercel API response using local .env vars
            const configs = {
              1: {
                apiKey: process.env.FIREBASE_1_API_KEY,
                authDomain: process.env.FIREBASE_1_AUTH_DOMAIN,
                projectId: process.env.FIREBASE_1_PROJECT_ID,
                storageBucket: process.env.FIREBASE_1_STORAGE_BUCKET,
                messagingSenderId: process.env.FIREBASE_1_MESSAGING_SENDER_ID,
                appId: process.env.FIREBASE_1_APP_ID,
                measurementId: process.env.FIREBASE_1_MEASUREMENT_ID,
              },
              2: {
                apiKey: process.env.FIREBASE_2_API_KEY,
                authDomain: process.env.FIREBASE_2_AUTH_DOMAIN,
                projectId: process.env.FIREBASE_2_PROJECT_ID,
                storageBucket: process.env.FIREBASE_2_STORAGE_BUCKET,
                messagingSenderId: process.env.FIREBASE_2_MESSAGING_SENDER_ID,
                appId: process.env.FIREBASE_2_APP_ID,
                measurementId: process.env.FIREBASE_2_MEASUREMENT_ID,
                isReserved: true,
              },
              3: {
                apiKey: process.env.FIREBASE_3_API_KEY,
                authDomain: process.env.FIREBASE_3_AUTH_DOMAIN,
                projectId: process.env.FIREBASE_3_PROJECT_ID,
                storageBucket: process.env.FIREBASE_3_STORAGE_BUCKET,
                messagingSenderId: process.env.FIREBASE_3_MESSAGING_SENDER_ID,
                appId: process.env.FIREBASE_3_APP_ID,
                measurementId: process.env.FIREBASE_3_MEASUREMENT_ID,
              }
            };
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, configs, schoolDatabaseMapping: { 'ayirebida': 2 } }));
          });

          // Mock Payment Initialization
          server.middlewares.use('/api/initialize-payment', (req, res) => {
            console.log('[Mock API] Initializing payment...');
            res.setHeader('Content-Type', 'application/json');
            // Return a mock reference. NOTE: Using this in Paystack popup will likely fail validation.
            res.end(JSON.stringify({
              authorization_url: 'https://checkout.paystack.com/mock',
              access_code: 'mock_code',
              reference: 'MOCK_' + Date.now()
            }));
          });

          // Mock Payment Verification
          server.middlewares.use('/api/verify-payment', (req, res) => {
            console.log('[Mock API] Verifying payment...');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              status: 'success',
              message: 'Verification successful',
              data: { status: 'success' }
            }));
          });

          // Mock Subscription Activation
          server.middlewares.use('/api/activate-subscription', (req, res) => {
            console.log('[Mock API] Activating subscription...');
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
