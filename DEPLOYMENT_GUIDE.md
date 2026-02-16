# SBA Pro Master Web - Vercel Deployment Guide

This project uses Vercel Serverless Functions to secure API keys and handle payments.

## Prerequisites

1.  **Vercel Account**: Sign up at [vercel.com](https://vercel.com).
2.  **GitHub Repository**: Ensure this project is pushed to a GitHub repository.
3.  **Paystack Account**: Get your Public and Secret keys from the Paystack Dashboard.
4.  **Firebase Project**: Get your Firebase configuration keys.
5.  **Gemini API Key**: Get your API key from Google AI Studio.

## Deployment Steps

1.  **Import Project to Vercel**:
    *   Go to your Vercel Dashboard.
    *   Click **"Add New..."** -> **"Project"**.
    *   Select your GitHub repository (`SBA-Pro-Master-Web`).
    *   Click **"Import"**.

2.  **Configure Build Settings**:
    *   **Framework Preset**: Vite (should be auto-detected).
    *   **Root Directory**: `./` (default).
    *   **Build Command**: `npm run build` (default).
    *   **Output Directory**: `dist` (default).

3.  **Configure Environment Variables**:
    *   Expand the **"Environment Variables"** section.
    *   Add the following keys (copy values from your secure storage or `constants.backup.ts`):
    
    | Key | Description |
    | :-- | :-- |
    | `PAYSTACK_SECRET_KEY` | Your Paystack Secret Key (`sk_live_...`) |
    | `PAYSTACK_PUBLIC_KEY` | Your Paystack Public Key (`pk_live_...`) |
    | `GEMINI_API_KEY` | Your Google Gemini API Key |
    | `FIREBASE_ADMIN_SERVICE_ACCOUNT` | JSON string of your Firebase Service Account |
    | `FIREBASE_1_API_KEY` | API Key for Primary Database |
    | `FIREBASE_1_AUTH_DOMAIN` | Auth Domain for Primary Database |
    | `FIREBASE_1_PROJECT_ID` | Project ID for Primary Database |
    | ... | (Repeat for other Firebase fields as in `.env.example`) |

    *   **Refer to `.env.example`** in the project root for the complete list of required variables.

4.  **Deploy**:
    *   Click **"Deploy"**.
    *   Wait for the build and deployment to complete.

## Verification

After deployment:
1.  Visit your Vercel URL (e.g., `https://sba-pro-master-web.vercel.app`).
2.  Open **Developer Tools (F12) -> Network**.
3.  Refresh the page.
4.  Verify a request to `/api/firebase-config` is successful (Status 200).
5.  Try to generate a Teacher Remark (requires Gemini).
6.  Try to click "Pay Now" in Subscription (requires Paystack).

## Local Development

To run locally with serverless functions:
1.  Install Vercel CLI: `npm i -g vercel`
2.  Link project: `vercel link`
3.  Pull env vars: `vercel env pull`
4.  Run local dev: `vercel dev`

This will start the frontend and API functions on `localhost:3000`.
