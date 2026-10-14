# Expnsify — Zero-based budget

Give every dollar a job. iPhone and web, same account. Snap a receipt, share a PDF, or say the spend — Groq matches it to this month’s plan.

## Stack

- **Expo** (React Native + TypeScript, iOS + web)
- **Firebase Auth + Firestore** — sign-in and sync (cached on device)
- **Firebase Storage** — receipt / PDF attachments
- **Cloudflare Worker** — proxy that holds your Groq API key
- **Groq** — `qwen/qwen3.6-27b` (vision/OCR) + `whisper-large-v3-turbo` (voice)

## Setup

### 1. Deploy the proxy

```bash
cd proxy
npm install
# Set your Groq API key as a secret (never shipped in the app)
wrangler secret put GROQ_API_KEY
npx wrangler kv namespace create USAGE
# Put the printed id into proxy/wrangler.toml (binding USAGE). Until that id is real, AI routes refuse requests.
wrangler deploy
```

Copy the deployed URL (e.g. `https://tally-proxy.your-name.workers.dev`).

### 2. Configure the app

```bash
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_PROXY_URL to your worker URL
```

Receipt photos need **Firebase Storage** (Blaze billing). Until that is on, the app reads photos to fill the expense and does not store the file. In [Firebase Console → Storage](https://console.firebase.google.com/project/expense-tracker-da669/storage) click **Get started**, then paste the rules from `storage.rules` (signed-in users can only read/write their own `users/{uid}/…` files). Then set `RECEIPT_STORAGE_ENABLED` to `true` in `src/services/receiptUri.ts`.

### 3. Run

```bash
npm install
npx expo run:ios          # iPhone / simulator
npx expo start --web      # browser
```

### 4. Build for device (TestFlight)

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile preview
```

Share-to-app (Mail / Files → Expnsify) needs this native build. In-app PDF upload works without it.

## Features

- **Monthly budget** — income (expected vs actual), bills, variable, debt, investments
- **Left to budget** — zero-based; leftover or over-assigned is obvious
- **Automations calendar** — due dates and auto-pay on any line; upcoming strip on Home
- **Track** — camera, library, voice (with a coach), keyboard, or PDF
- **Share to complete** — drop a confirmation email/PDF; AI matches the unpaid line and marks it paid
- **Red states** — unbudgeted spend, or over the line
- **Reminders** — monthly “time to budget” and upcoming due dates (on this device)
- **Web** — sidebar + ledger table from 900px wide; tab bar on phones
- **Line items** — a receipt scan can keep the items under the total
- **AI cap** — scan, voice, insights, and Ask Tally need a signed-in Firebase token. Free accounts get 10 actions a month. The count lives in the worker, not in the app. Paid is reserved for later and cannot be turned on from the phone.
- **Location** — off until you enable “Save purchase location” in Settings
- **Export** — the month’s CSV and PDF live on Reports
