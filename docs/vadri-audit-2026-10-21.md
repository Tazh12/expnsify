# Vadri audit against the 10 product decisions

Audited 2026-10-22 on `feat/ux-refresh` at `ff215b8` (after `git pull`: already up to date). Read-only: no code was changed. Nothing was built for a device, deployed, or run against Firebase, Cloudflare, Groq or an EAS build, so every "works" below means "the code says so".

Checks that were run:

- `npx tsc --noEmit` passes (no output).
- `node --experimental-strip-types --test src/services/receiptUri.test.ts src/theme/palettes.test.ts` **fails both files** with `ERR_MODULE_NOT_FOUND` (imports have no `.ts` extension). `package.json` has no `test` script. See D.

`docs/strategy/*` is local only (gitignored by `ff215b8`), so it is cited as "strategy doc B, local, not in repo".

Status words: **Done / Partial / Missing / Conflicts**.

**Updated 2026-10-22 with your answers** to the six open questions (recorded under "Decisions recorded" at the end). Still no code changes. Budgets and tabs are frozen: nothing in the plan touches the budget model, the tab bar, or the tab list.

---

## A) Decision table

| # | Decision | Status | Evidence | What's left |
|---|---|---|---|---|
| 1 | Free AI: 5 scans, 2–3 voice, 2–3 insights, 2–3 questions per month; Pro ~300; enforced in the Worker | **Partial** | Worker enforces, but with **one pooled counter**, free = 10, paid = 300: `proxy/src/index.ts:46-47`, `gate` `:126`, `bump` `:148`. Counter key `u:{uid}:{month}` `:113,151`. Route table `:194-199`. Pro is a manual KV flag `plan:{uid}`: `:101-105`. Client mirrors the 10: `src/store/useAiUsage.ts:14`, `src/services/groq.ts:52,78,275`, README `:67`, Settings row `src/screens/SettingsScreen.tsx:394-399` | Per-feature counters, fixed at **5 scans / 3 voice / 2 insights / 2 ask** per month (voice = 1 action), Pro ~300 pooled. Voice currently costs **2** actions (see D). Remove hardcoded 10s. Pro status from RevenueCat (#10). Plan steps 2 and 4. |
| 2 | AI mainly for capture; Ask hidden from main UI; no AI for anonymous | **Partial** | Ask is not a tab or button on a main screen. It appears only after a search finds nothing: `src/screens/ActivityScreen.tsx:307-314` ("Ask Vadri", "Uses one AI action"). "Generate insights" is a visible button on the Insights tab: `src/screens/InsightsScreen.tsx:236-259`. No anonymous users exist today (auth wall `App.tsx:194`; no `signInAnonymously` anywhere); Worker rejects calls without a valid Firebase token: `proxy/src/index.ts:80-99,184-185`. | Decided: keep Ask on empty search only; after a free user's 2 questions, replace the button with an upgrade prompt (step 6). When anonymous auth is added (#10), the Worker must reject anonymous tokens, or this half breaks silently (step 3). |
| 3 | Budget model: describe only | **Done** (describe only) | See B. | Nothing. You said keep it exactly as is, so no steps in C. |
| 4 | Opt-in location on expenses | **Done** | Setting defaults off: `src/store/useSettings.ts:33` (`captureLocation: false`). Toggle: `SettingsScreen.tsx:388-393`. Capture, only if on: `src/flows/AddSheet.tsx:45-51,450,811`, `src/services/location.ts`. Stored on the expense: `src/store/useExpenses.ts:39,88,143`. Shown as "Near …": `src/screens/TxnDetailModal.tsx:181`, `src/components/TxnRow.tsx:167`. Permission strings say "only if you turn that on": `app.config.ts:25,57`, `ios/Tally/Info.plist:56`. | Nothing in code. Privacy policy and App Store privacy labels must list it (see #9). Not in CSV/PDF export (`src/services/export.ts`), probably fine. |
| 5 | "Vadri" everywhere users can see it | **Partial** | In-app copy is clean: no "Tally", "Expnsify" or "Expensify" string remains in `src/` or `App.tsx`. `app.config.ts:5-6` name/slug are Vadri; `ios/Tally/Info.plist:10` display name Vadri; permission strings Vadri in both `app.config.ts` and `Info.plist`; README title Vadri. Wordmark: `src/components/VadriLogo.tsx`. Kept on purpose: `@tally:*` keys, `askTally` (`groq.ts:303`), `tally-proxy` (`proxy/wrangler.toml:1`), bundle id, `ios/Tally`. | **Not verifiable from the repo, needs you:** (a) Firebase `authDomain` `expense-tracker-da669.firebaseapp.com` (`src/services/firebase.ts:9`) likely shows in the Google sign-in popup on web; (b) Firebase password-reset email template and public-facing project name; (c) Google OAuth consent screen app name/logo; (d) App Store listing name "Vadri" must be reserved in App Store Connect. README `:11` still says `qwen3.6`. |
| 6 | Tabs: list; where Settings and Insights live | **Done** (describe only) | See B. | Nothing. You said keep it exactly as is. |
| 7 | Forest default + Plum selectable; Saffron/Alpine/Olive locked "Pro"; no Accent section; Font Style kept; Light/Dark/System | **Partial** | Palettes: `src/theme/palettes.ts:21-80` (`locked: true` on saffron, alpine, olive). Default `forest`: `useSettings.ts:23`. Locked tiles show a lock + "Pro" and a toast "Coming soon with Vadri Pro": `SettingsScreen.tsx:60-64,275-311`. No accent picker (retired; stored `accent` key is deleted on load: `useSettings.ts:81`). Fonts: Vadri, Instrument Serif, Sans, Mono, Comic: `SettingsScreen.tsx:323-329`, `src/theme/index.ts:23-24`. | **Light/Dark/System does not exist.** Light vs dark is decided only by which palette is picked (Forest is light, Plum is dark: `buildTheme` `theme/index.ts:133-140`). The only `useColorScheme` use is the splash (`App.tsx:41,175`). Decided: a setting where Light = Forest, Dark = Plum night, System follows the iPhone; Pro themes stay locked (step 12). Pro unlock also needs `usePro()` (referenced in a comment `palettes.ts:1`, does not exist) and changes to `migratePalette`, which currently forces saffron/alpine/olive to forest (`palettes.ts:103-108`, asserted in `palettes.test.ts`). Locked palettes have **no contrast test** (only forest and plum are tested). |
| 8 | AI insight: one AI sentence in a monthly Review | **Conflicts** | Worker asks for "3 or 4 short sentences": `proxy/src/index.ts:515`; keeps up to 4 `:530`. Client renders every line, on a Week or Month toggle, from a manual button: `InsightsScreen.tsx:173-195,236-259`. There is **no monthly Review surface**. (AddSheet's `'review'` phase, `AddSheet.tsx:88`, is the scan-confirm step, unrelated.) | One sentence from the Worker; a monthly Review card; cache per month so reopening does not spend another use. Decided: a card at the top of Insights at the start of each month, one AI sentence (step 5). |
| 9 | Launch: TestFlight beta (30–50) then App Store ~5 weeks later: crash reporting, feedback path, privacy policy, store metadata | **Missing** | No Sentry/Crashlytics/analytics dependency in `package.json`. No feedback or support link, no privacy/terms URL anywhere in `src/` or Settings (`SettingsScreen.tsx:416-419` About shows name and version only). `eas.json:21-23` `submit.production` is empty (no `ascAppId`). Build profiles exist: `eas.json:4-19`. `ios/Tally/PrivacyInfo.xcprivacy:45` lists no collected data types. `ITSAppUsesNonExemptEncryption` is absent from `ios/Tally/Info.plist`. **`EXPO_PUBLIC_PROXY_URL` will not reach an EAS build:** it comes from the gitignored `.env` (`.gitignore:5`, `.env` exists locally), and `eas.json` has no `env` block. The app reads it at `groq.ts:8` and `app.config.ts:82`; if empty, every AI call goes to a relative URL and fails. I did not run an EAS build, so confirm with one. | See C steps 1, 7, 13. External testers with a public link are confirmed (step 7). |
| 10 | Pre-launch must-haves: Sign in with Apple, try before account, RevenueCat + StoreKit pricing, restore, Worker reads Pro from RevenueCat. Later: Spanish, household | **Missing** (all five) | Auth is email/password + Google only: `src/store/useAuth.ts`, `AuthScreen.tsx`, `IosGoogleSignIn.tsx`, `WebGoogleSignIn.tsx`. `ios/Tally/Tally.entitlements` is empty (no `applesignin`). No `expo-apple-authentication`, `react-native-purchases`, or anonymous auth. No paywall: the only upgrade UI is `UpgradeModal.tsx:20` ("Paid plans are not available yet."). No restore. Worker plan = manual KV key `proxy/src/index.ts:101-105`. No localization or sharing code. | See C steps 5, 6, 8–10 and Later. |

---

## B) What exists today for #3 and #6

### #3 Budget model

It is **neither (a) nor (b) exactly**. It is closest to (b): a lines-based, zero-based monthly plan. It has no rollover and no sinking funds.

- **Unit of budgeting is a "line"** (`BudgetLine`, `src/store/budgetTypes.ts:25-45`): name, `expected` amount, currency, due day, repeat (monthly / 2 weeks / weekly), paid flag, optional automation and reminder days. Lines are per month (`month: 'YYYY-MM'`).
- **Groups, not categories.** Five built-in groups: **Income, Bills, Variable, Debt, Investments** (`budgetTypes.ts:55-61`), plus user-made custom groups (`useBudgetGroups.ts`). That is not the 4 groups of (b) (Income, Bills, Spending, Savings).
- **Zero-based math** (`src/services/budget.ts:42-62`, shown at `PlanScreen.tsx:155`): `Income − Assigned = left to assign`. Assigned is the sum of planned amounts on non-income lines. Spent is actuals matched to each line by `line_id`, or by category key within the month.
- **Next month** (`useBudget.ts` `ensureMonth`): copies last month's **recurring non-income** lines with `paid` reset. Income is not copied automatically. `CarryIncomeCard` offers it, with Add / Skip / Don't add (`PlanScreen.tsx`, `budget.ts:196`).
- **"Presets":** a single "Start with common lines" button seeds 8 lines (Groceries, Coffee, Dining, Transport, Travel, Home, Software, Health) at $0 in the Variable group (`PlanScreen.tsx` empty state). No per-category preset templates beyond that, and no onboarding flow.
- **Not present:** rollover of unspent money, sinking funds / goals, per-category monthly caps that differ from the line amount, a Savings group. Name-based group guessing exists (`budget.ts:81-117`, e.g. "retirement" → Investments).

### #6 Tabs

- **Bottom bar on phones** (`src/components/TabBar.tsx:10-15,53-70`): **Today, Plan, [centre Scan button], Activity, Insights**. Four tabs plus a centre camera button that opens the Add/Scan sheet (`AddSheet`).
- **Wide/web layout** (`src/components/AppShell.tsx:47-72`): a left sidebar with the same four tabs and a "Scan / Add" button.
- **Settings is not a tab.** It is a full-screen modal opened from the round initial-letter avatar at the right of the header on every tab (`src/components/AppHeader.tsx:77-86`, wired at `App.tsx:220,254`). Inside it: profile, Delete account, Base currency, **Lines & Groups** (a sub-screen), Notifications, Save purchase location, AI actions, **Theme and font** (a sub-panel), Export all data, About.
- **Insights is the fourth tab** (`App.tsx:212`, `InsightsScreen.tsx`): Week/Month toggle, spend headline, sparkline, "Optional AI notes" card with Generate insights, Expected/Assigned/Spent, by-section bars, Overspent, CSV and PDF export.

---

## C) Build plan (launch blockers first)

Sizes: S = under half a day, M = 1–3 days, L = more than 3 days. "Needs you" means an account, a console, a key, or a decision only you can do.

### Phase 0: unblock the build path

**Step 0. Decide the native path (S, needs you).** `ios/` is committed, so `app.config.ts` plugins and native fields (Sign in with Apple, RevenueCat, Sentry, entitlements) are **not applied** unless you run `expo prebuild` or edit `ios/` by hand. Choose one: (a) regenerate with `npx expo prebuild --clean` and gitignore `ios/` (the rename checklist, local, recommends this), or (b) hand-edit both copies. Files: `app.config.ts`, `ios/Tally/Info.plist`, `ios/Tally/Tally.entitlements`, `ios/Podfile`, `.gitignore`. Needs you: the call, plus a check that `AppDelegate.swift` has no hand edits you want to keep.

**Step 1. Make an EAS build actually work (S–M, needs you).**
- Put `EXPO_PUBLIC_PROXY_URL` in `eas.json` per-profile `env` or in EAS environment variables.
- Set `ITSAppUsesNonExemptEncryption = false` (`Info.plist` or `app.config.ts` `ios.config`), otherwise every upload stops at the export-compliance prompt.
- Fill `submit.production.ios.ascAppId`.
- Files: `eas.json`, `app.config.ts`, `ios/Tally/Info.plist`.
- Needs you: `eas login`, Apple Developer team, create the app record in App Store Connect, a first TestFlight upload.

### Phase 1: before 30–50 testers (cost control and a working build)

**Step 2. Per-feature limits in the Worker (M).** Replace the pooled counter with per-feature counters, e.g. `u:{uid}:{month}:{feature}` with features `scan | voice | insights | ask`. Constants table (your answer): free `{scan: 5, voice: 3, insights: 2, ask: 2}`, each counted separately; Pro is one pooled counter at 300 (fair use) with no per-feature caps. Email/PDF/text parses go through `/scan`, so they keep counting as scans (you did not say otherwise). Add `/voice`, one route that transcribes **and** extracts, counted once as one `voice` action. The alternative, a flag that makes the second call skip the bump, can be abused by a client, so prefer the single route. Return a per-feature `/usage`. Return a distinct `limit_reached` per feature. Files: `proxy/src/index.ts` (`:46-48,101-155,177-209`). Consider a Durable Object for atomic counts (M extra, see D); KV is acceptable for a 50-person beta. Needs you: `wrangler deploy` and KV.

**Step 3. Worker rejects anonymous tokens (S–M).** Do this together with step 9. Either read `firebase.sign_in_provider` from a locally verified ID token (JWKS check against project `expense-tracker-da669`; also removes one network hop per request), or check the `accounts:lookup` response for provider info. Files: `proxy/src/index.ts:80-99`. Test with a real anonymous token.

**Step 4. Client follows per-feature limits (M).** Update `useAiUsage` (per-feature state, no hardcoded 10), `groq.ts` parsing and the voice flow (one call), the Settings AI row, `UpgradeModal` copy per feature, `InsightsScreen`/`ActivityScreen` copy ("2 free a month"). Settings should show what is left per feature (e.g. scans 3 of 5, voice 3 of 3), not one pooled number. Files: `src/store/useAiUsage.ts:14`, `src/services/groq.ts:52,78,275`, `src/services/aiUsageBridge.ts`, `src/flows/UpgradeModal.tsx`, `SettingsScreen.tsx:394-399`, `AddSheet.tsx:387-430`, README `:67`.

**Step 5. One-sentence monthly Review (M).** Your answer: a card at the top of the Insights tab at the start of each month, with one AI-written sentence, and the Worker prompt changed to one sentence.
- Worker: `/insights` prompt becomes "one short sentence" and returns `{ insight: string }`, with a low `max_tokens` and server-side truncation to the first sentence (`proxy/src/index.ts:496-536`). It counts as one `insights` action.
- Client: a Review card pinned above the headline on `InsightsScreen`, about the previous month's spending. Cache the sentence per month key (Firestore under `users/{uid}`, or AsyncStorage) so reopening never spends another use. Remove the multi-line "Optional AI notes" card and the week-span generate button (`InsightsScreen.tsx:173-259`). The Week/Month comparison itself stays (it is computed on the device, no AI).
- Assumptions I made (change them if wrong): (1) the sentence is generated when the person taps a button on the card, not automatically, so a free user's 2 monthly insights are never spent without them asking (the second use covers a regenerate); (2) the card shows from the 1st of the month until dismissed, and only when the previous month has expenses; (3) Pro and free see the same card.
- Files: `proxy/src/index.ts`, `src/screens/InsightsScreen.tsx`, `src/services/groq.ts` (`fetchInsights`), a small cache helper. This adds content to an existing tab and does not change the tab list.

**Step 6. Ask placement and the upgrade prompt (S).** Your answer: Ask Vadri stays only on the empty-search state. After a free user's 2 questions, the button is hidden and an upgrade prompt shows in its place.
- The client needs the per-feature remaining count from `/usage` (steps 2 and 4) to decide, and also handles a `limit_reached` for `ask` from the Worker as the real enforcement.
- Until step 10 builds the paywall, the prompt reuses the reworded `UpgradeModal` ("Pro is coming"); after step 10 it opens the paywall. Pro users see the button and share the pooled 300.
- Files: `ActivityScreen.tsx:142-156,307-314`, `UpgradeModal.tsx`. Nothing else on that screen changes.

### Phase 2: before external TestFlight (Beta App Review)

**Step 7. Crash reporting, feedback path, legal URLs, external TestFlight (M, needs you).** Your answer: external testers (30–50) with a public link. External groups need Beta App Review for the first build, plus Beta App Information: description, feedback email, contact details and a privacy policy URL. A public link lets anyone who has it join, so set a tester limit on the link (about 50) and do not post it until step 2 is deployed, because per-feature limits are what cap Groq cost from strangers. Link testers have no invite list, so give them a way in without a login: step 9 (try before account) removes that need; until it ships, put a demo account in the review notes. TestFlight builds expire after 90 days. In-app purchases in TestFlight use the sandbox, so testers are never charged.
- Add Sentry (`@sentry/react-native` plus its config plugin, which needs step 0) or Crashlytics. Needs you: a Sentry project and DSN.
- Feedback: TestFlight's built-in screenshot feedback may be enough for the beta. For the App Store add a "Contact support" mailto and a "Send feedback" row in Settings → About.
- Privacy policy and terms pages at public URLs, linked from Settings and later the paywall. Needs you: write or approve them and host them. They must say that receipts, voice, and spend summaries are sent to Groq via your Worker, that location is optional, and how deletion works.
- Update `PrivacyInfo.xcprivacy:45` collected data types to match reality (email, user ID, purchase/spend data, optional location).
- A demo account (email/password) for App Review, since the app has an auth wall today (it goes away with step 9).
- Files: `package.json`, `app.config.ts`, `App.tsx`, `SettingsScreen.tsx:416`, `ios/Tally/PrivacyInfo.xcprivacy`. Verify which Beta App Review test-information fields are required for your group.

**Step 8. Sign in with Apple (M, needs you).** Guideline 4.8 requires a privacy-preserving login option next to Google sign-in, and Sign in with Apple is the usual choice (verify the current wording). `expo-apple-authentication` plus a Firebase `OAuthProvider('apple.com')` credential with a nonce (`expo-crypto` is already installed). Add the capability (`com.apple.developer.applesignin`) to `Tally.entitlements`, enable the Apple provider in Firebase, and add a button to `AuthScreen.tsx` (and web, if web stays). On Delete account, Apple requires revoking the token: extend `src/services/account.ts` and configure Firebase's Apple provider with an Apple `.p8` key (check the current Firebase flow). Needs you: Apple Developer portal (capability, key), Firebase Console.

**Step 9. Try before creating an account (M).** `signInAnonymously` on first launch instead of the auth wall (`App.tsx:194`), then link via `linkWithCredential` when the person signs in with Apple, Google or email so the **uid, and therefore all Firestore data under `users/{uid}`, is kept**. Add an "Create account to keep your data" prompt in Settings. AI stays blocked until linked (step 3). Add a "sign in" path for returning users who started anonymous. Files: `App.tsx`, `src/store/useAuth.ts`, `AuthScreen.tsx`, `SettingsScreen.tsx`, `src/services/account.ts`. Needs you: enable Anonymous in Firebase Console. Decide what the anonymous data limit/expiry is.

### Phase 3: before the App Store (the long pole)

**Step 10. RevenueCat + StoreKit (L, needs you).** `react-native-purchases` (native module, needs a dev/EAS build, not Expo Go). Use the Firebase uid as the RevenueCat app user id. One entitlement, e.g. `pro`. Products: $4.99/month and $34.99/year, each with a 7-day free trial, and nothing else: **no lifetime option** (your latest message). Both products sit in one subscription group, and the 7-day free trial is an introductory offer on **both** plans (confirmed). Check that RevenueCat treats the trial as once per Apple ID per subscription group, so a person cannot restart it by switching plans. Build a real paywall (replace `UpgradeModal`), a `usePro()` store, **Restore purchases** in Settings, and Terms/Privacy links on the paywall (verify against guideline 3.1.2). Files: new `src/store/usePro.ts`, new paywall in `src/flows/`, `UpgradeModal.tsx`, `SettingsScreen.tsx`, `App.tsx`.
Needs you: Paid Applications agreement plus banking and tax info in App Store Connect (products do not load without them), subscription group and products, RevenueCat project and iOS public SDK key, App Store Connect API / In-App Purchase key for RevenueCat, and Small Business Program enrollment (15% instead of 30%). Test with sandbox accounts in a TestFlight build.

**Step 11. Worker reads Pro from RevenueCat (M, needs you).** Replace the manual `plan:{uid}` flag. Two parts: (a) a `/rc-webhook` route that checks a shared-secret header and writes `plan:{uid}` with an expiry; (b) a fallback that calls RevenueCat's REST subscriber endpoint with the secret key when a user has no fresh KV plan (webhooks can lag right after purchase), then caches the result. Handle lapse and refund. Files: `proxy/src/index.ts:101-109`, `proxy/wrangler.toml` (secrets). Needs you: RevenueCat webhook URL and secret, `wrangler secret put`.

**Step 12. Appearance setting, then Pro themes (S–M).**
- **Appearance (does not depend on Pro, so it can ship in the beta):** a Light / Dark / System setting. Light = Forest, Dark = Plum night, System follows the iPhone. Add `appearance: 'light' | 'dark' | 'system'` to `useSettings` and derive the palette from it. Use `useColorScheme()` in `App.tsx` (it already reads it for the splash) so System updates live. Files: `src/store/useSettings.ts`, `src/theme/index.ts`, `App.tsx:171`, `SettingsScreen.tsx:262-312`.
- Assumptions to confirm: (1) the default is **Light**, so Forest stays the default as in decision 7 (a System default would give Plum at night); (2) existing users who saved `palette: 'plum'` migrate to Dark; (3) the Forest and Plum tiles in the Theme picker are replaced by this control, and the Saffron, Alpine and Olive tiles stay as locked "Pro" tiles; (4) so native alerts and the keyboard match when the choice differs from the phone setting, call React Native's `Appearance.setColorScheme`.
- **Pro themes:** they stay locked, as today. Once step 10 exists, `usePro()` unlocks them for subscribers only (confirm that is what you want) and falls back to Forest if Pro lapses. That touches `palettes.ts:103-108` (`migratePalette` forces them to Forest), `theme/index.ts:134`, `SettingsScreen.tsx:275-311`, and `palettes.test.ts` (asserts the Forest mapping). Add a contrast test for the three locked palettes before unlocking.

**Step 13. App Store metadata and review (M, needs you).** Name "Vadri" reserved, subtitle, keywords, description, six screenshots, support URL, privacy URL, age rating, App Privacy labels (consistent with step 7), and the in-app purchase review notes and screenshots. Files: none in the repo today (consider `store/` or `docs/`). Needs you: all of it, in App Store Connect.

### Small cleanups (S each)

- README: AI cap line `:67`, model names `:11`, the share-to-app claim `:54` (the extension is not installed), TestFlight steps `:46`.
- `firestore.rules` `usage`/`plans` blocks are unused (the Worker uses KV): remove or keep deliberately.
- Rename external surfaces from #5 (Firebase email template and public name, OAuth consent screen).
- Add a `test` script and fix the two failing test files.

### Later (not scheduled here)

- **Spanish (Phase 2): L.** No i18n layer exists. Every string is inline. Needs a library, string extraction, locale-aware currency/date, Worker prompt language, and App Store localisation.
- **Household sharing (Phase 3): L.** Data is keyed `users/{uid}/…` with rules that allow only the owner (`firestore.rules:4-6`). Sharing needs a household model and new rules. Do not start before billing works.

---

## D) Risky or surprising

1. **Voice costs 2 AI actions today.** `transcribeAudio` calls `/transcribe` (`groq.ts:~246`), then `scanText` calls `/scan` (`AddSheet.tsx:413-417`). Each success runs `bump` (`proxy/src/index.ts:208`). With the pooled 10, one voice entry is 2 of 10.
2. **Hardcoded 10s and 300:** Worker `:46-47`; client `useAiUsage.ts:14`, `groq.ts:52,78,275`; README `:67`; Settings copy.
3. **The KV counter is a read-then-write** (`index.ts:111-115,148-155`), not atomic, and KV is eventually consistent. Parallel requests can overrun the cap. The per-minute limiter has the same flaw (`:135-140`). Fine for a small beta; use a Durable Object when the cap protects revenue.
4. **EAS builds will probably ship with an empty proxy URL** (see #9). Also `ITSAppUsesNonExemptEncryption` is absent.
5. **Anonymous auth will bypass the "no AI for anonymous" rule** unless the Worker is changed in the same release. The Worker only checks that the Firebase token is valid (`index.ts:80-99`).
6. **`ios/` is committed**, so config-plugin changes do nothing without prebuild (step 0).
7. **Both test files fail to run** (`ERR_MODULE_NOT_FOUND`) and there is no test script, so the contrast checks and `receiptUri` tests are not running anywhere. `tsc` passes.
8. **Model names disagree.** `proxy/wrangler.toml:13-14` sets `SCAN_MODEL = qwen/qwen3.8-27b` and `TEXT_MODEL = openai/gpt-oss-20b`; code defaults (`index.ts:13-14`) and README say `qwen3.6-27b`. I could not check which ids Groq serves today. Confirm the deployed models are live before the beta.
9. **Privacy manifest and disclosures.** `PrivacyInfo.xcprivacy:45` declares no collected data, yet email, user id, spend data and optional location are stored, and receipt images, audio and spend summaries go to Groq through the Worker. Check Apple's current guideline 5.1.2 on disclosing and getting permission before sharing personal data with third-party AI. There is no consent screen for that today.
10. **User-visible "paid plans are not available yet"** (`UpgradeModal.tsx:20`) and "Coming soon with Vadri Pro" (`SettingsScreen.tsx:61`) will be wrong or confusing once Pro exists.
11. **README claims share-to-complete**, but `expo-share-intent` is not installed. `App.tsx` falls back silently (`useIncomingShare`).
12. **The Worker returns raw Groq error text to the client** (`index.ts:338,489,521,564`). It has no request-size cap on base64 bodies. CORS is `*` (`:51`).
13. **Delete account** (`account.ts`) deletes Firestore and Storage data and the Firebase user but does not touch Worker KV usage keys, and will need Apple token revocation after step 8.
14. **Bundle id `com.expensify.ExpenseTracker`** (`app.config.ts:18`, `Info.plist:30`, `project.pbxproj:372,404`) contains another company's name, and it is permanent once the App Store record exists. It also contradicts the rename checklist in doc C (local, not in repo), which says to change it before the first upload. You said it stays on purpose; this is only a flag, and the decision has to be final **before step 1** creates the App Store Connect record. `GoogleService-Info.plist` and the Google sign-in client are tied to it.
15. **Leftover "Tally" in non-visible places** (intended): `askTally`, `@tally:*` keys, `package.json` name `tally`, `tally-proxy` Worker, `ios/Tally`. `.env.example:2` and `README.md:27` show the `tally-proxy` URL.

---

## Decisions recorded (your answers, 2026-10-22)

1. **Free limits per month:** 5 receipt scans, 3 voice entries, 2 AI insights, 2 AI questions, counted separately; voice = 1 action. Pro: ~300 total, fair use. Steps 2 and 4.
2. **Ask Vadri:** only on the empty search, as now. After a free user's 2 questions it is hidden and an upgrade prompt shows. Step 6.
3. **Light/Dark/System:** a setting. Light = Forest, Dark = Plum night, System follows the iPhone. Pro themes stay locked. Step 12.
4. **Monthly Review:** a card at the top of Insights at the start of each month, one AI sentence; Worker prompt changed to one sentence. Step 5.
5. **Pricing:** monthly $4.99 and yearly $34.99, both with a 7-day trial. **No lifetime option** (this replaces the earlier $99.99 / $79.99 answer). Step 10.
6. **TestFlight:** external testers (30–50) via a public link. Step 7.
7. **Budgets and tabs:** keep exactly as they are. No plan step touches them.

### Confirmed assumptions (2026-10-22)

- The Review sentence is generated on tap and cached for the month (step 5).
- The default appearance is Light, so Forest stays the default (step 12).
- Pro themes unlock for Pro subscribers once Pro exists (step 12).
- Email/PDF/text parses count as receipt scans (step 2).
- The 7-day trial applies to both the monthly and yearly plans (step 10).

### Still my default, not explicitly confirmed

- The Review card shows from the 1st of the month until dismissed, and only when the previous month has expenses (step 5).
