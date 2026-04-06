
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// import { setFirebaseConfigs } from './constants'; // Removed duplicate
import axios from 'axios';

const rootElement = document.getElementById('root');

// Global error handler — only show banner for genuine fatal errors.
// We intentionally ignore a class of non-fatal browser-privacy errors:
//   • Firefox Enhanced Tracking Protection blocks Firebase's IndexedDB
//     persistence, emitting generic NS_ERROR_FAILURE errors with no useful
//     source/line info ("Unknown error", "Unknown source:0").
//   • Chrome storage quota / cross-origin storage denials are also non-fatal.
// These are handled gracefully by the Firebase SDK's try/catch fallback
// and by our own useLocalStorage hook — no user-visible action needed.
window.onerror = function (message, source, lineno, colno, error) {
  const msgStr = String(message || '');
  const srcStr = String(source || '');

  // --- Ignore list: non-fatal browser / privacy / extension errors ---
  const isNonFatal =
    // Firefox ETP blocks IndexedDB → Firebase SDK emits generic error
    (msgStr.toLowerCase().includes('unknown error') && (!srcStr || srcStr === 'Unknown source')) ||
    // Firefox / Safari storage access denied
    msgStr.includes('NS_ERROR_FAILURE') ||
    msgStr.includes('NS_ERROR_DOM') ||
    msgStr.includes('SecurityError') ||
    // IndexedDB blocked in private/strict mode
    msgStr.includes('IndexedDB') ||
    msgStr.includes('IDBDatabase') ||
    // Chrome extension injected errors
    (srcStr.startsWith('chrome-extension://') || srcStr.startsWith('moz-extension://')) ||
    // Firebase internal persistence fallback noise
    msgStr.includes('Failed to open indexedDB') ||
    msgStr.includes('FIRESTORE') ||
    // ResizeObserver loop — cosmetic, browser-internal
    msgStr.includes('ResizeObserver loop') ||
    // Script load errors from third-party (e.g. blocked analytics)
    (msgStr === 'Script error.' && !srcStr);

  if (isNonFatal) {
    // Log to console for developer visibility without alarming the user
    console.warn('[App] Non-fatal browser/privacy error suppressed:', message, source, lineno);
    return true; // Returning true prevents the default browser error modal too
  }

  // Show banner only for genuine fatal application errors
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;background:#c0392b;color:#fff;padding:16px 20px;z-index:9999;font-family:sans-serif;font-size:14px;';
  errorDiv.innerHTML = `
    <strong>Application Error</strong>
    <p style="margin:4px 0"><b>Message:</b> ${message}</p>
    <p style="margin:4px 0"><b>Source:</b> ${source}:${lineno}:${colno}</p>
    <pre style="white-space:pre-wrap;font-size:12px;opacity:.85">${error?.stack || 'No stack trace'}</pre>
  `;
  document.body.appendChild(errorDiv);
};

if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { setFirebaseConfigs, setSchoolDatabaseMapping, setActivationHash, setPaystackPublicKey, API_BASE_URL, FIREBASE_CONFIGS, ENABLE_ERUDA_CONSOLE } from './constants';

const loadFirebaseConfig = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/firebase-config`);
    if (!response.ok) throw new Error('Failed to load config');
    const data = await response.json();
    // Handle different response structures (e.g. { configs: ... } or just configs)
    const configs = data.configs || data;
    setFirebaseConfigs(configs);

    // Load Paystack Public Key from API
    if (data.paystackPublicKey) {
      setPaystackPublicKey(data.paystackPublicKey);
      0 && console.log('[App] Paystack Public Key loaded from API');
    }

    // Load school-to-database mapping from API
    if (data.schoolDatabaseMapping) {
      setSchoolDatabaseMapping(data.schoolDatabaseMapping);
      0 && console.log('[App] School database mapping loaded from API');
    }

    // Capture Activation Hash for security rules
    if (data.activationHash) {
      setActivationHash(data.activationHash);
      0 && console.log('[App] Activation security hash loaded');
    }

    0 && console.log('[App] Firebase configuration loaded from API');
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
    // 0. Inject Eruda Mobile Console if enabled
    if (ENABLE_ERUDA_CONSOLE) {
      0 && console.log('[Bootstrap] Eruda console enabled. Injecting script...');
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/eruda";
      script.onload = () => {
        // @ts-ignore
        if (window.eruda) window.eruda.init();
      };
      document.head.appendChild(script);
    }

    // 1. Fetch Configuration
    0 && console.log('[Bootstrap] Environment:', {
      isGitHubPages: window.location.hostname.includes('github.io'),
      hostname: window.location.hostname,
      API_BASE_URL
    });
    0 && console.log('[Bootstrap] Fetching configuration...');
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
    0 && console.log('[Bootstrap] Configuration loaded.');

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
