
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// import { setFirebaseConfigs } from './constants'; // Removed duplicate
import axios from 'axios';

const rootElement = document.getElementById('root');

// Global error handler to catch and display errors on the page
window.onerror = function (message, source, lineno, colno, error) {
  const errorDiv = document.createElement('div');
  errorDiv.style.position = 'fixed';
  errorDiv.style.top = '0';
  errorDiv.style.left = '0';
  errorDiv.style.width = '100%';
  errorDiv.style.backgroundColor = 'red';
  errorDiv.style.color = 'white';
  errorDiv.style.padding = '20px';
  errorDiv.style.zIndex = '9999';
  errorDiv.innerHTML = `
    <h1>Application Error</h1>
    <p><strong>Message:</strong> ${message}</p>
    <p><strong>Source:</strong> ${source}:${lineno}:${colno}</p>
    <pre>${error?.stack || 'No stack trace'}</pre>
  `;
  document.body.appendChild(errorDiv);
};

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { setFirebaseConfigs, API_BASE_URL, FIREBASE_CONFIGS } from './constants';

const loadFirebaseConfig = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/firebase-config`);
    if (!response.ok) throw new Error('Failed to load config');
    const data = await response.json();
    // Handle different response structures (e.g. { configs: ... } or just configs)
    const configs = data.configs || data;
    setFirebaseConfigs(configs);
    console.log('[App] Firebase configuration loaded from API');
  } catch (error) {
    console.error('[App] Failed to load Firebase config:', error);
    // Fallback: If fetch fails (e.g. offline/error), try local storage or default?
    // For now, let it fail so user knows connection is bad.
    // Ideally, we should have a retry or blocking error screen.
    throw error; // Re-throw to trigger bootstrap error handling
  }
};

const bootstrap = async () => {

  try {
    // 1. Fetch Configuration
    console.log('[Bootstrap] Fetching configuration...');
    // In development (vite), we might not have the API running on localhost:5173 
    // depending on how it's proxying. Vercel dev typically runs on 3000.
    // If running with `python run_server.py`, the API endpoints might fail unless we mock them or proxy.
    // However, for Vercel deployment, this relative path is correct.
    // Fallback? If fetch fails (dev mode without API), we might break.
    // For now, assuming Vercel environment or correctly proxied dev.

    // In local dev without `vercel dev`, this will 404. 
    // We should handle that gracefully if possible, but the user asked for this architecture.
    // We will attempt fetch.

    await loadFirebaseConfig();
    console.log('[Bootstrap] Configuration loaded.');

    // 2. Dynamic Import App
    // This ensures imports within App (like firebaseService) run AFTER config is set.
    const { default: App } = await import('./App');

    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Failed to mount application:", error);
    if (rootElement) {
      rootElement.innerHTML = `
            <div style="padding: 20px; font-family: sans-serif; text-align: center;">
                <h1>Failed to load application</h1>
                <p>Could not initialize configuration. Please check your connection.</p>
                <div style="color: #666; font-size: 12px; margin-top: 20px;">${error}</div>
            </div>
        `;
    }
  }
};

bootstrap();
