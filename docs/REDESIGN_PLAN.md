# Tally Redesign Plan

**Author:** AI Agent  
**Date:** October 12, 2026  
**Purpose:** Transform Tally from "a bunch of good ideas pasted together" into one coherent, easy-to-use personal finance app.

---

## Executive Summary

**Current State:** Tally is a well-built iOS expense tracker with AI-powered receipt scanning, but it's missing the core budgeting features that make a finance app useful for everyday money management.

**Top Problems:**
1. **No budgeting system** — users can track spending but can't set limits or goals
2. **No line-item receipt data** — the app reads the total from a receipt but doesn't remember what you bought, so you can't answer "when did I buy that coffee maker?"
3. **Fragmented experience** — multiple chart views, a "recap" teaser, and reports feel like separate features rather than one cohesive story

**Solution:** Build a budget-first experience where everything connects. Add monthly budgets by category, show real-time progress, store receipt line items, and let users ask natural questions about their purchases.

**Timeline:** 4 phases over ~8-12 PRs, starting with budgets (MVP), then receipt improvements, then polish.

---

## 1. Current State Analysis

### Stack & Platform
- **Framework:** React Native + Expo (managed workflow)
- **Platform:** iOS only (iPhone, no iPad support)
- **Database:** Firebase Firestore (cloud) + Firebase Auth (email/password)
- **AI Services:** Groq (Llama 4 Scout for vision OCR, Whisper for voice) via Cloudflare Worker proxy
- **Local Storage:** AsyncStorage for app settings
- **Notable Libraries:** Zustand (state), expo-sqlite (unused old code), react-native-reanimated (animations)

### Current Features

**Good (Keep These):**
1. **Receipt Scanning** — Camera → Groq vision → auto-filled expense (merchant, amount, category)
2. **Voice Entry** — Microphone → Whisper transcription → AI parse
3. **Image Upload** — Photo library → same AI pipeline
4. **Manual Entry** — Skip AI, fill in yourself
5. **Smart Categories** — AI suggests categories; you can create/rename/recolor/archive them
6. **Home Screen** — Shows current month's total, donut chart by category, recent 5 transactions
7. **Activity Screen** — Scrollable day-grouped transaction list with swipe actions (view receipt, edit, delete)
8. **Reports Screen** — Date range filters (week/month/quarter/year/custom), category filters, comparison bar chart, by-category breakdown, CSV export
9. **Settings** — 3 themes (Midnight/Cream/Carbon), 4 accent colors, 3 font styles, profile editing, sign out
10. **Polished UI** — Beautiful, thoughtful design with blur effects, animations, serif typography

**Gaps (Missing from Target):**
1. **NO budgeting system** — no way to set a budget or see "you've spent $X of $Y"
2. **NO budget progress indicators** — no alerts when approaching limits
3. **NO location tracking** — merchant name is stored, but not GPS coordinates or address
4. **NO receipt line items** — the AI reads the total but doesn't extract "Oat latte $5.75, Croissant $4.50"
5. **NO natural language search** — can't ask "when did I buy a latte?"
6. **NO PDF export** — only CSV works (PDF placeholder in UI)
7. **Recap modal is half-baked** — teased on Home and Reports but not wired to real AI insights

**Confusing (Simplify or Cut):**
1. **Recap teaser** appears on Home and Reports but the modal just shows placeholder content
2. **Confidence score** is shown during expense review but never explained or used later
3. **Receipt URI** is stored but hard to access (only via swipe-right on Activity)
4. **Weekly comparison chart** in Reports is hard to interpret for new users

### Data Model (Current)

**Firestore collections:**
- `users/{uid}/expenses` — merchant, category_id, amount, currency, date, note, receipt_uri, confidence
- `users/{uid}/categories` — name, color, source (seed/user/ai), sort_order, archived

**Missing:**
- Budgets
- Locations
- Receipt line items

---

## 2. What to Keep, Cut, or Merge

### Keep (Core Value)
- ✅ Receipt scanning (camera, library, voice, manual)
- ✅ AI categorization
- ✅ User-managed categories (create, rename, color, archive)
- ✅ Home screen monthly view
- ✅ Activity screen transaction list
- ✅ Reports date/category filters
- ✅ CSV export
- ✅ Beautiful, polished UI
- ✅ Firebase auth & Firestore
- ✅ Cloudflare Worker proxy for Groq

### Cut (Low Value or Confusing)
- ❌ **Recap teaser/modal** — remove it from Home and Reports until we have real AI insights to show (Phase 3+)
- ❌ **Confidence score display** — still store it, but don't show it to users (it's confusing without context)
- ❌ **Weekly comparison chart** — the 3-bar "this week vs last week" chart in Reports is hard to read; replace with a simpler month-over-month or budget-vs-actual view
- ❌ **Unused SQLite code** — clean up `src/store/db.ts` (it's dead code; app uses Firestore now)

### Merge (Simplify Navigation)
- 🔀 **Combine Home + Reports** into one "Dashboard" tab that shows both current month summary AND budget progress
- 🔀 **Activity** stays as-is but add a search bar for merchant/note/line-item queries
- 🔀 **Settings** stays but add a new "Budgets" section

---

## 3. Target Information Architecture

### Screens & Navigation (Bottom Tab Bar)

**Tab 1: Dashboard** (merge of Home + key Reports metrics)
- **Hero:** Current month spend vs. budget (e.g., "$847 of $1,200" with progress bar)
- **Budget Cards:** One card per category showing spend vs. budget (visual progress bars, color-coded: green = safe, yellow = 80%+, red = over)
- **Donut Chart:** Keep the category breakdown chart (tap to drill into that category's transactions)
- **Quick Actions:** "+ Add Expense" button (same sheet as now)
- **Month Switcher:** Left/right arrows to view past months

**Tab 2: Transactions** (rename "Activity")
- **Search Bar:** "Search for purchases…" (searches merchant, note, and receipt line items)
- **Day-Grouped List:** Same as now, but add small budget impact indicator ("$8.50 → Coffee budget $45 remaining")
- **Swipe Actions:** View receipt (if available), edit, delete
- **Receipt Detail Modal:** When you tap "view," show photo + extracted line items in a table

**Tab 3: Budgets** (new)
- **Monthly Budget Setup:** List of categories with input fields for budget amounts
- **Copy Last Month:** Button to duplicate previous month's budgets
- **Presets:** "Beginner ($1,500)", "Moderate ($3,000)", "Custom" templates
- **Archive Unused Categories:** Hide categories you don't want to budget for

**Tab 4: Settings**
- **Profile:** Name, email, sign out
- **Appearance:** Theme, accent, font (keep as-is)
- **Preferences:** Base currency, notifications
- **AI:** Auto-categorize, receipt OCR toggles
- **Data:** Export (CSV, PDF), delete account

### Removed Navigation
- ❌ "Reports" as a separate tab (merged into Dashboard)
- ❌ "Categories" as a modal (move to Settings → Preferences → Categories)

---

## 4. Data Model Changes

### New Collections

**`users/{uid}/budgets`**
- `month` — string, e.g., "2026-10" (YYYY-MM)
- `category_id` — reference to category
- `amount` — number, budget limit in USD
- `created_at` — timestamp

### New Fields on Existing Collections

**`users/{uid}/expenses` (add):**
- `location` — object `{ lat: number, lng: number, address?: string }` (optional)
- `line_items` — array `[{ name: string, amount: number }]` (optional, from OCR)

**`users/{uid}/categories` (no changes needed)**

### Migration Strategy
- **Backward compatible:** Old expenses without `location` or `line_items` still work
- **Lazy migration:** No data migration script needed; new fields are optional

---

## 5. Receipt OCR & Line-Item Extraction

### Current Approach (Keep the Pipeline)
- **Groq Llama 4 Scout** (vision model) reads receipt image
- **Cloudflare Worker** proxies requests to keep API key secret
- **Returns:** merchant, amount, date, category suggestion, confidence

### Proposed Enhancement (Add Line Items)

**Update Worker Prompt:**
Modify `/proxy/src/index.ts` to ask the model for line items:

```json
{
  "merchant": "Blue Bottle Coffee",
  "amount": 6.75,
  "currency": "USD",
  "date": "2026-10-12T08:14:00",
  "category": { ... },
  "note": "oat latte",
  "confidence": 0.96,
  "line_items": [
    { "name": "Oat Latte", "amount": 5.75 },
    { "name": "Tip", "amount": 1.00 }
  ]
}
```

**Prompt Addition:**
```
If the receipt shows itemized line items, extract them as an array of { name, amount }.
If you can only read a total, return an empty array for line_items.
```

**Store in Firestore:**
When saving an expense, write `line_items` array to the expense document.

**Fallback:**
If the model returns no line items (older receipts, bank app screenshots), store `[]`.

### Display Line Items
- **Receipt Detail Modal:** Show a table: "Oat Latte — $5.75, Tip — $1.00, Total — $6.75"
- **Fallback:** If `line_items` is empty, just show the receipt photo and total

---

## 6. Natural Language Query ("When/Where Did I Buy X?")

### Requirement
User types: "when did I buy a coffee maker?" → Returns relevant expenses with line items matching "coffee maker"

### Recommended Approach

**Option A: Client-Side Search (Recommended for MVP)**
1. Fetch all expenses from Firestore to local state (already done by Zustand store)
2. Add a search input on Transactions tab
3. Filter expenses where:
   - `merchant` includes query (case-insensitive)
   - `note` includes query
   - Any `line_items[].name` includes query
4. Display results in the same day-grouped list
5. **Pros:** Simple, works offline, no extra cost
6. **Cons:** No fuzzy matching (user must type exact words)

**Option B: Firestore Full-Text Search (Future Enhancement)**
1. Index `merchant`, `note`, `line_items` fields in Firestore
2. Use Firestore's `where()` with `array-contains-any` for line items
3. **Pros:** Faster for large datasets
4. **Cons:** Firestore doesn't support true full-text search; would need to sync to Algolia or Typesense

**Option C: AI-Powered Query (Phase 4, Optional)**
1. Send user question + last 100 expenses to Groq text model
2. Model returns matching expense IDs
3. **Pros:** Natural language ("that latte last Tuesday")
4. **Cons:** Costs money per query, slower

**Recommendation for MVP:** Start with Option A (client-side search). It's instant, free, and good enough for most users. If the dataset grows huge (5,000+ expenses), upgrade to Option B or C.

---

## 7. Phased Roadmap (MVP-First)

### Phase 1: Budgets (MVP Core)
**Goal:** Ship the minimum viable budgeting experience.

**PRs:**
1. **Data model + API**
   - Add `budgets` collection to Firestore
   - Create Zustand store `useBudgets` (CRUD actions)
   - Seed a default budget on first load (e.g., $100/category)

2. **Budgets screen**
   - New tab (replace "Reports" with "Budgets")
   - List categories with input fields for budget amounts
   - "Save" button to persist budgets
   - "Copy Last Month" button

3. **Dashboard integration**
   - Update Home screen → rename to "Dashboard"
   - Add hero stat: "You've spent $847 of $1,200 this month"
   - Add budget progress bars for each category (green/yellow/red)
   - Keep donut chart below

4. **Budget alerts (polish)**
   - Show a yellow banner when a category hits 80% of budget
   - Show a red banner when over budget

**Outcome:** Users can now set budgets and see real-time progress. This is the core value prop.

**Estimated Size:** 4 PRs, ~3-5 days of dev work

---

### Phase 2: Line Items & Search
**Goal:** Make receipts smarter and let users find past purchases.

**PRs:**
5. **Line-item extraction**
   - Update Cloudflare Worker prompt to request `line_items` array
   - Update `AddSheet` to display line items in review step
   - Update Firestore `expenses` to include `line_items` field
   - Update `TxnRow` to show line-item count badge ("3 items")

6. **Receipt detail modal**
   - New modal that shows receipt photo + line-item table
   - Accessible via swipe-right "eye" action on Transactions tab
   - Fallback: if no line items, just show photo + total

7. **Search bar**
   - Add search input to Transactions tab (top of screen)
   - Filter expenses by merchant, note, or any line-item name
   - Show results in same day-grouped list
   - Add "no results" empty state

**Outcome:** Users can now see what they bought on each receipt and search for past purchases.

**Estimated Size:** 3 PRs, ~2-3 days of dev work

---

### Phase 3: Location & Enhanced Reporting
**Goal:** Add location tracking and improve export options.

**PRs:**
8. **Location capture**
   - Request location permission in `AddSheet` (optional, iOS Settings prompt)
   - Store `{ lat, lng, address }` in expense document
   - Display location in receipt detail modal and edit sheet
   - Show "near [address]" in transaction list (subtle, below merchant name)

9. **PDF export**
   - Use `react-native-html-to-pdf` to generate a styled PDF report
   - Include: date range, total spend, budget vs. actual table, category breakdown chart
   - "Export as PDF" button in Budgets screen (next to CSV export)

10. **Dashboard polish**
    - Add month-over-month comparison: "Down 12% from last month"
    - Add "Top 3 Merchants" card (e.g., "You spent $200 at Whole Foods")
    - Add "Biggest Purchase" card (e.g., "Delta Airlines — $412")

**Outcome:** App feels complete and professional. Location data helps users remember context.

**Estimated Size:** 3 PRs, ~2-3 days of dev work

---

### Phase 4: AI Insights & Polish (Optional)
**Goal:** Add intelligent insights and natural language query.

**PRs:**
11. **AI-powered insights**
    - Re-enable Recap modal (currently a placeholder)
    - Send last 30 days of expenses to Groq text model
    - Generate 3-4 insights: "You spent 40% more on dining this month," "Coffee budget almost reached," "Your average transaction is $23"
    - Display insights in Recap modal with nice formatting
    - Add "View Insights" button to Dashboard

12. **Natural language query (optional)**
    - Add AI-powered search option: "Ask Tally…" button
    - Send user question + last 100 expenses to Groq
    - Display matching expenses in a modal
    - Examples: "when did I buy a coffee maker?", "how much did I spend on gas last month?"

**Outcome:** App feels magical and helps users understand their spending patterns.

**Estimated Size:** 2 PRs, ~2-3 days of dev work

---

## 8. TestFlight & App Store Readiness

### Current State
- ✅ Bundle ID: `com.expensify.ExpenseTracker` (configured)
- ✅ iOS build: `eas build --platform ios` works
- ✅ Firebase config: `GoogleService-Info.plist` included
- ✅ App icon: Custom icon in `assets/` and `ios/Tally/Images.xcassets/`
- ✅ Privacy permissions: Camera, photo library, microphone (all configured in `app.config.ts`)

### Before TestFlight (Checklist)
1. **Update bundle ID** — Change from `com.expensify.ExpenseTracker` to something unique (e.g., `com.yourdomain.tally`) to avoid conflicts
2. **Add privacy policy URL** — Required by App Store for apps that collect user data (Firebase collects email)
3. **Test on real device** — Camera doesn't work in simulator; test receipt scanning on iPhone
4. **Add App Store screenshots** — 6.5" and 5.5" screenshots required (can use Expo's screenshot tool)
5. **Write App Store description** — Short 1-2 sentence tagline + feature list
6. **Test Firebase auth flow** — Ensure sign-up, sign-in, and password reset work
7. **Enable Firebase App Check** — Prevents abuse of Firestore API (recommended for production)
8. **Rate limiting on Worker** — Add Cloudflare rate limits to prevent Groq API abuse (currently unlimited)

### App Store Guidelines (Potential Issues)
- ✅ **4.2.1 Minimum Functionality:** App has enough features (budgets, tracking, receipts)
- ✅ **5.1.1 Data Collection:** Firebase collects email; need privacy policy
- ⚠️ **2.5.14 AI Disclosure:** Must disclose that AI reads receipts (add note in App Store description: "Uses AI to read receipts")
- ⚠️ **3.1.1 In-App Purchase:** If you add paid features later (e.g., premium exports), must use IAP (not Stripe)

### Recommended TestFlight Timeline
1. **Week 1:** Ship Phase 1 (budgets) to internal TestFlight
2. **Week 2:** Fix bugs, ship Phase 2 (line items + search)
3. **Week 3:** External TestFlight beta (invite 50-100 users)
4. **Week 4:** Ship Phase 3 (location, PDF export), gather feedback
5. **Week 5:** Submit to App Store review

---

## 9. Technical Debt & Cleanup

### Immediate (Do in Phase 1)
1. **Remove dead SQLite code** — Delete `src/store/db.ts` and `src/store/defaults.ts` (Firestore is used now)
2. **Remove unused demo data** — `DEMO_TXNS` in `src/store/useExpenses.ts` is still being seeded; move to a "Load Demo Data" button in Settings
3. **Consolidate theme files** — `src/theme/index.ts` exports both `buildTheme` and `PALETTES`; simplify

### Future (After MVP)
1. **Add TypeScript strict mode** — `tsconfig.json` has no `strict: true`; gradually enable
2. **Add error boundaries** — Crashes currently show blank screen; add Sentry or custom error UI
3. **Optimize Firestore queries** — Currently fetches all expenses on load; add pagination for Activity screen if user has 500+ expenses
4. **Internationalization** — Hardcoded USD and English; add i18n support if expanding to other markets

---

## 10. Open Questions & Decisions Needed

### Questions for Esteban (Owner)
1. **Budget frequency:** Should users set monthly budgets only, or also weekly/yearly?
   - **Recommendation:** Start with monthly only (simpler UX)

2. **Location privacy:** Some users may not want GPS tracking. Should we make it optional?
   - **Recommendation:** Yes, make it opt-in (iOS permission prompt already allows this)

3. **AI insights cost:** Groq charges per token. Each "Recap" call costs ~$0.002. At 1,000 users × 10 recaps/month = $20/month. Is this OK?
   - **Recommendation:** Start with client-side insights (no AI) and upgrade to AI in Phase 4 if users love it

4. **Subscription model:** Should this be a free app or paid? (App Store allows both)
   - **Recommendation:** Launch free, add optional "Pro" tier later (unlimited receipts, PDF export, AI insights)

5. **Shared budgets:** Should couples/families share budgets?
   - **Recommendation:** Not for MVP. Add in Phase 5+ if requested.

---

## 11. Summary & Next Steps

### What We're Building
A **budget-first personal finance app** where users:
1. Set monthly budgets by category
2. Track expenses (manually or by snapping receipts)
3. See real-time progress toward their budgets
4. Search for past purchases (including line items)
5. Export their data (CSV, PDF)

### Why This Works
- **Focus:** Budgets tie everything together (the "one coherent story")
- **Simplicity:** Fewer screens, clearer navigation
- **Delight:** AI makes data entry fast; line items make receipts useful

### First PR
Start with **Phase 1, PR 1**: Add budgets collection, Zustand store, and seed defaults. This lays the foundation for everything else.

### Owner Action Items
1. Review this plan and confirm priorities
2. Decide on bundle ID change (if needed)
3. Set up TestFlight beta tester list
4. Write privacy policy (or use a template from Termly/iubenda)

---

**End of Plan**
