import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          pdfGenerator: path.resolve(__dirname, 'services/pdfGenerator.ts')
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
