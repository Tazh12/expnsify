# Multi-Currency Support — Design Spec
**Date:** 2026-06-29  
**Status:** Approved

---

## Overview

Users can log expenses in any currency. The app converts them to a preferred currency for all totals, charts, and reports. Exchange rates come from `frankfurter.app` (free, ECB-sourced, ~30 currencies), fetched twice a day and cached on-device. All conversion is on-the-fly — no Firestore writes when rates or preferred currency change.

---

## 1. Data & Rates Layer

### No schema changes
`Expense` already has `amount: number` (original amount) and `currency: string` (original currency). These remain the source of truth. We stop hardcoding `'USD'` and start using them.

### New store: `src/store/useRates.ts`

```
State:
  base: string          — matches useSettings.preferredCurrency
  rates: Record<string, number>  — 1 base = X foreign (from frankfurter)
  fetchedAt: number | null

Actions:
  fetch(base: string) → Promise<void>
  convert(amount: number, fromCurrency: string) → number
  isStale() → boolean    — true if fetchedAt is null or > 6h ago
```

**API call:** `GET https://api.frankfurter.app/latest?from={base}`  
Returns: `{ base: "USD", rates: { CHF: 0.9, EUR: 0.92, ... } }`

**convert logic:**
- If `fromCurrency === base`: return `amount` as-is
- Otherwise: `amount / rates[fromCurrency]`

**Cache:** AsyncStorage key `@tally:rates` — stored as `{ base, rates, fetchedAt }`. On load, hydrate from cache before fetching if stale.

**Fetch triggers:**
1. App cold start (in `App.tsx` alongside `settings.load()`)
2. App foreground resume (`AppState` change listener) — fires silently in background, never blocks UI
3. When `preferredCurrency` changes in Settings

**Offline behaviour:** If the fetch fails (network unavailable), silently fall back to whatever is in the AsyncStorage cache — even stale rates. Never throw or show an error to the user. If cache is also empty, `convert()` returns the original amount unchanged (treats all currencies as 1:1).

### `useExpenses` calculation functions
`byCategory`, `byWeek`, and `total` call `useRates.getState().convert(t.amount, t.currency)` per expense. All aggregates automatically reflect the preferred currency.

---

## 2. Settings & First-launch Flow

### `useSettings` additions
Two new fields:
- `preferredCurrency: string` — default `'USD'`
- `currencyPrompted: boolean` — default `false`

When `preferredCurrency` changes: immediately call `useRates.fetch(newCurrency)`.

### First-launch currency detection
Uses `expo-localization` (`Localization.getLocales()[0].currencyCode`) — reads device locale, no location permission needed.

**Flow:**
1. On app load, after settings are loaded: check `!currencyPrompted`
2. If locale currency ≠ `'USD'`, show a one-time modal overlay on the home screen:
   > *"Looks like your device is set to CHF. Use Swiss Franc as your preferred currency?"*  
   > **Yes** → sets `preferredCurrency` to locale currency  
   > **Not now** → keeps `'USD'`
3. Either tap sets `currencyPrompted: true` — modal never appears again

### Settings screen
The existing "Base currency" stub row (currently alerts "Coming in v1.1") becomes a tappable row that opens a bottom sheet:
- Full list of ~30 frankfurter currencies (code + full name)
- Searchable text input at top
- Current preferred currency shown with a checkmark
- On select: updates `preferredCurrency`, triggers rate re-fetch
- All past expenses re-convert automatically — zero Firestore writes

---

## 3. AddSheet — Currency Picker

Changes to `ReviewPhase` in `src/flows/AddSheet.tsx`:

**Amount card:**
- Hardcoded `$` → dynamic symbol via `Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions()`
- Hardcoded `USD` label → tappable currency badge (e.g. `USD ▾`)
- Tapping badge opens a bottom sheet with the ~30 frankfurter currencies
- Default selection: `preferredCurrency` (zero extra taps for home-currency expenses)

**Conversion hint:**
- When selected currency ≠ preferred currency, show a muted line below the amount input: `≈ $12.50 USD`
- Updates live as the user types, using cached rates

**AI scan wiring:**
- `ScannedExpense.currency` (already returned by groq service) pre-selects the currency picker
- If scanned currency not in frankfurter list, falls back to preferred currency

**On save:**
- `amount` = original amount as entered
- `currency` = selected currency (original)
- No `converted_amount` stored — conversion is always on-the-fly

---

## 4. Display & Conversion

### `src/services/format.ts`
`fmt(n)` → `fmt(n, currency = 'USD')` using `Intl.NumberFormat` with `style: 'currency'`. Handles symbols (`$`, `CHF`, `¥`, `€`) automatically. All callers updated to pass preferred currency.

### HomeScreen
- Hero total: sum of all monthly expenses converted to preferred currency
- Hardcoded `$` → preferred currency symbol

### Transaction list & detail
- Row primary amount: converted to preferred currency
- If original currency ≠ preferred currency: muted secondary line shows original (`CHF 45.00`)
- `TxnDetailModal`: both amounts shown clearly, with a label ("Originally" / "In [preferred]")

### Charts & Reports
- `byCategory` and `byWeek` aggregates run through `convert()` — donut chart and bar chart always show preferred-currency totals

### Rate freshness indicator
- In Settings, near the currency row: muted text `Rates updated 2h ago`
- Formatted as relative time from `fetchedAt`

---

## Currencies Supported

Frankfurter's ~30 currencies (stable list, hardcoded in the app):

`AUD BGN BRL CAD CHF CNY CZK DKK EUR GBP HKD HUF IDR ILS INR ISK JPY KRW MXN MYR NOK NZD PHP PLN RON SEK SGD THB TRY USD ZAR`

---

## What This Does NOT Include (YAGNI)

- Historical rates for past expenses (rates at time of entry vs. now)
- Per-expense rate override
- Multi-currency totals (e.g. "show me CHF subtotal")
- Currency conversion calculator screen
- Crypto currencies
