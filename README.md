# Tally — Expense Tracker

AI-powered expense tracker for iOS. Snap a receipt, upload an image, or speak an expense — Groq reads it and fills in the details.

## Stack

- **Expo** (managed, React Native + TypeScript)
- **expo-sqlite** — local-only storage
- **zustand** — state management
- **Cloudflare Worker** — proxy that holds your Groq API key
- **Groq** — `llama-4-scout-17b-16e-instruct` (vision/OCR) + `whisper-large-v3-turbo` (voice)

## Setup

### 1. Deploy the proxy

```bash
cd proxy
npm install
# Set your Groq API key as a secret (never shipped in the app)
wrangler secret put GROQ_API_KEY
wrangler deploy
```

Copy the deployed URL (e.g. `https://tally-proxy.your-name.workers.dev`).

### 2. Configure the app

```bash
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_PROXY_URL to your worker URL
```

### 3. Run on simulator

```bash
npm install
npx expo run:ios
```

### 4. Build for device (TestFlight)

```bash
npm install -g eas-cli
eas login
eas build --platform ios --profile preview
# Follow prompts for Apple ID / credentials
# Install via TestFlight or direct IPA
```

## Features

- **Snap a receipt** — camera → Groq vision → auto-filled expense
- **Upload image** — photo library → same AI pipeline
- **Say it out loud** — microphone → Whisper transcription → AI parse
- **Enter manually** — skip AI, fill in yourself
- **AI-suggested categories** — model matches or invents categories; you confirm, rename, or pick another
- **User-managed categories** — create, rename, recolor, reorder, archive from Settings → Categories
- **Home** — hero spend total, donut chart, weekly recap teaser
- **Activity** — searchable day-grouped transaction list
- **Reports** — date range, category filters, weekly bar chart, by-category bars, CSV export
- **Settings** — 3 themes (Midnight / Cream / Carbon), 4 accent colors, serif level, AI toggles

## Environment

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_PROXY_URL` | Your Cloudflare Worker base URL |

The Groq API key lives **only** in the Worker secret — never in the app bundle.
