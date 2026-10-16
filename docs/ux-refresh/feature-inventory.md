# UX refresh feature inventory

Regression checklist for `feat/ux-refresh`. Baseline is local `main` at `e42d006` ("checkpoint before checking out feat/multi-currency"), which is `feat/multi-currency` (`5fdf7ca`) plus that one commit. Every row below is behavior that exists today and must still work when the refresh is done.

Status starts unchecked. Mark a row done only after the behavior has been exercised on the new screens.

Letters match the brief: A shell, B capture, C plan, D activity, E reports, F settings, G categories and groups, M features that exist only because of `e42d006`. Extra rows use an `X` id.

## A. Shell

| ID | Feature | Where | Status |
|---|---|---|---|
| A1 | Phone tab bar: Budget, Activity, Reports, Settings, with a center "+" that opens the add sheet | `TabBar` in `src/components/TabBar.tsx`. `TabId` is `'home' \| 'txns' \| 'reports' \| 'settings'` | [ ] |
| A2 | Wide layout (900px+) sidebar with the same four entries plus an "Add transaction" button | `AppShell` in `src/components/AppShell.tsx`. Breakpoint is `useLayout` in `src/hooks/useLayout.ts` | [ ] |
| A3 | Header: logo and "expnsify". Month arrows render only on the Budget tab | `AppHeader` in `src/components/AppHeader.tsx`, mounted from `App.tsx` on phone. Wide Budget has its own month arrows inside `HomeScreen` | [ ] |
| A4 | Add popover on Budget (wide and phone) with "add a budget line" and "add income" | `AddMenu` in `src/components/AddMenu.tsx`, used by `HomeScreen` | [ ] |
| A5 | Signed-out gate: email login, register, forgot password, Google sign-in (web and iOS) | `AuthScreen`, `WebGoogleSignIn`, `IosGoogleSignIn`, `useAuth` | [ ] |
| A6 | Theme from palette, accent, and font, applied around the whole app | `buildTheme` / `ThemeContext` in `src/theme/index.ts`, `App.tsx` | [ ] |
| A7 | Fonts load with a timeout fallback so the app still opens if a font stalls | `App.tsx` | [ ] |
| A8 | Firestore subscriptions for categories, expenses, budget lines, and budget groups, torn down on sign-out | `App.tsx` plus `useCategories`, `useExpenses`, `useBudget`, `useBudgetGroups` | [ ] |

## B. Capture (Add sheet)

| ID | Feature | Where | Status |
|---|---|---|---|
| B1 | Sheet title "Log money" and five capture methods: photo, library, PDF/email, voice, manual. Photo is hidden on web | `PickPhase` in `src/flows/AddSheet.tsx` | [ ] |
| B2 | Camera and library use `mediaTypes: ['images']`, resize to 1024px, JPEG compress, then base64 | `AddSheet` (`launchCameraAsync` / `launchImageLibraryAsync` + `expo-image-manipulator`) | [ ] |
| B3 | PDF and text/email ingest, including HTML email flattened to plain text | `AddSheet` (`readTextFile`, `emailToPlain`, `scanPdf`, `scanText`) | [ ] |
| B4 | Voice: coach step, record, transcribe, then the same review | `VoiceCoach` in `AddSheet`, `transcribeAudio` in `src/services/groq.ts` | [ ] |
| B5 | Manual entry skips scanning and opens review | `AddSheet` method `'manual'` | [ ] |
| B6 | Storage note at the top of the capture options when `RECEIPT_STORAGE_ENABLED` is false: the file is read, not stored | `PickPhase` in `AddSheet`. Flag lives in `src/services/receiptUri.ts` | [ ] |
| B7 | Reading state while a scan or transcription is in flight | `ScanPhase` in `AddSheet` | [ ] |
| B8 | Review: amount with currency picker, converted-amount line, merchant, date, notes, budget-line chips, receipt thumbnail | `ReviewPhase` in `AddSheet` | [ ] |
| B9 | Unbudgeted and overspend warning before save | `ReviewPhase` in `AddSheet` | [ ] |
| B10 | Save labels: "Save to budget", "Save unbudgeted", "Update" | `ReviewPhase` in `AddSheet` | [ ] |
| B11 | Payment-confirmation shortcut: if the scan matches an unpaid bill, `CompletePaymentSheet` can mark it paid (`paid`, `paidAt`, `paidSource`) instead of creating a new expense | `CompletePaymentSheet` in `src/flows/CompletePaymentSheet.tsx`, opened from `AddSheet` | [ ] |
| B12 | Line chips are the hard-coded general variable ids (Groceries, Coffee, Dining, Transport, Travel, Home, Software, Health) when those lines exist, plus "+ More" | `GENERAL_VARIABLE_IDS` and `BudgetLinePicker` in `AddSheet` | [ ] |
| B13 | Edit mode reuses review. Opened from an Activity row swipe | `AddSheet` `editExpense` prop; `ActivityScreen` sets `editTarget` | [ ] |
| B14 | Saving writes `line_id` and `category_id = line.templateKey`. No line means `unbudgeted: true` | `handleSave` in `AddSheet` | [ ] |
| B15 | iOS share intent opens the add sheet with the shared file. Missing native module is ignored | `useIncomingShare` in `App.tsx` | [ ] |
| B16 | Web drag-and-drop anywhere on the window, and on the pick phase itself, opens the sheet with that file | `App.tsx` window listeners and `PickPhase` drop props | [ ] |
| B17 | Per-expense currency picker and the "converted" hint | `CurrencyPickerSheet` used inside `ReviewPhase` | [ ] |
| B18 | AI limit during scan or transcribe sets the global upgrade modal (`takeAiLimit` / `AiLimitError`) | `src/services/groq.ts`, `UpgradeModal` | [ ] |

## C. Plan (current Budget / Home)

| ID | Feature | Where | Status |
|---|---|---|---|
| C1 | Spent-vs-assigned ring | `BudgetRing` in `src/components/BudgetRing.tsx`, rendered by `HomeScreen` | [ ] |
| C2 | Headline: "No budget yet", "On track", or "Overspent", with the spent-of-planned sentence | `HomeScreen` | [ ] |
| C3 | Same add popover as A4 | `AddMenu` in `HomeScreen` | [ ] |
| C4 | "Left to budget" card. Copy changes at zero and when negative | `HomeScreen`, values from `summarizeMonth` in `src/services/budget.ts` | [ ] |
| C5 | Carry-income prompt with Add, Skip (this visit), and Don't add (persisted per user and month) | `CarryIncomeCard` in `src/components/CarryIncome.tsx`. Persistence is `readDeclinedCarry` / `rememberDeclinedCarry` in `HomeScreen`, backed by AsyncStorage | [ ] |
| C6 | Upcoming payments strip. Tapping a row opens the line editor | `UpcomingPayments` in `src/components/UpcomingPayments.tsx` | [ ] |
| C7 | Sections render only when they have lines. Order comes from built-in sections plus custom groups | `HomeScreen` maps `useBudgetGroups.all`. Built-ins are in `SECTIONS` in `src/store/budgetTypes.ts` | [ ] |
| C8 | Line rows: name, expected, actual, remaining, paid checkbox | `BudgetRow` in `src/components/BudgetRow.tsx`, inside `BudgetSection` | [ ] |
| C9 | Wide table layout for the same rows | `BudgetRow` `wide` prop, turned on by `HomeScreen` when `isWide` | [ ] |
| C10 | Section collapse toggle. State is in memory only and resets when the section unmounts | `BudgetSection` | [ ] |
| C11 | Line editor: name, amount, group ("Goes to"), due date, repeat, frequency, auto-pay, income actual, note, delete | `LineEditor` in `src/flows/LineEditor.tsx`. Group picker is `GoesToPicker` | [ ] |
| C12 | Name-based group guess (`inferDestination` and `findLineByName`) can change the section while typing | `LineEditor` | [ ] |
| C13 | Inline "+ Add" at the bottom of a section opens the editor for that section | `BudgetSection` `onAddLine` | [ ] |
| C14 | Saving a repeating line updates unpaid siblings in the same month that share `templateKey`. New repeating lines expand into the month's occurrence days | `saveLine` in `HomeScreen` | [ ] |
| C15 | Notification sync runs from a `HomeScreen` effect whenever lines or notification settings change | `syncNotifications` in `src/services/notifications.ts` | [ ] |
| C16 | Opening a month copies the previous plan forward and collapses duplicate repeats | `ensureMonth` and `dedupeRepeats` in `src/store/useBudget.ts` | [ ] |
| C17 | Paid checkbox writes `paid`, `paidAt`, and `paidSource: 'manual'` (or clears them) | `togglePaid` in `HomeScreen` | [ ] |
| C18 | Separate income sources stay distinct when a second paycheck is added | `uniqueTemplateKey` in `src/services/month.ts`, used by `saveLine` | [ ] |

## D. Activity

| ID | Feature | Where | Status |
|---|---|---|---|
| D1 | Title "Transactions" and tagline "everything, in order". List is all time, grouped by day, with a converted day total | `ActivityScreen` in `src/screens/ActivityScreen.tsx` | [ ] |
| D2 | Search matches merchant, notes, and line-item names | `matchesQuery` in `ActivityScreen` | [ ] |
| D3 | "Ask Tally" when a search matches nothing. Uses one AI action and then filters to the returned ids | `ask` in `ActivityScreen`, `askTally` in `src/services/groq.ts` | [ ] |
| D4 | Filter sheet: date range (all, today, last 7 days, this month), categories, merchants (first 30). Custom range is implemented in the filter function and hidden in the UI (`k !== 'custom'`) | `FilterSheet` in `ActivityScreen` | [ ] |
| D5 | Active-filter chips with a clear-all. The remove mark on a chip is a small tap target | `Chip` in `ActivityScreen` | [ ] |
| D6 | Row shows merchant, category or line, converted amount, and a time | `TxnRow` in `src/components/TxnRow.tsx`. Time comes from `fmtTime` in `src/services/format.ts` | [ ] |
| D7 | Tap opens transaction detail. Swipe reveals edit and delete | `TxnRow`, `TxnDetailModal` | [ ] |
| D8 | Unbudgeted and overspent markers on a row | `ActivityScreen` passes `unbudgeted` and `overspend` into `TxnRow` | [ ] |
| D9 | Delete confirms, then `useExpenses.remove` | `ActivityScreen` | [ ] |

## E. Reports

| ID | Feature | Where | Status |
|---|---|---|---|
| E1 | Own month switcher, independent of the Budget month | `ReportsScreen` `useState(defaultBudgetMonth)` | [ ] |
| E2 | Stats for the selected month (expected, assigned, spent, left to budget) | `ReportsScreen`, `summarizeMonth` | [ ] |
| E3 | Spend-by-section bars | `ReportsScreen` | [ ] |
| E4 | Unpaid bills list | `ReportsScreen` | [ ] |
| E5 | Overspent lines list | `ReportsScreen` | [ ] |
| E6 | "This week" row opens the recap modal | `ReportsScreen` `onOpenRecap`, `RecapModal` mounted in `App.tsx` | [ ] |
| E7 | Export this month as CSV (share sheet) | `exportCsv` in `ReportsScreen` | [ ] |
| E8 | Export this month as PDF, including line items | `exportMonthPdf` in `src/services/export.ts` | [ ] |

## F. Settings

| ID | Feature | Where | Status |
|---|---|---|---|
| F1 | Profile, display name edit, sign out | `SettingsScreen` | [ ] |
| F2 | Appearance inline: palette, accent, font | `SettingsScreen` | [ ] |
| F3 | Base currency row and rate freshness | `SettingsScreen`, `CurrencyPickerSheet`, `useRates` | [ ] |
| F4 | Categories row opens the full-screen categories manager. Detail is the count of non-archived categories | `SettingsScreen` → `CategoriesScreen` | [ ] |
| F5 | Notifications sheet: monthly budget reminder (with day) and upcoming payment pings | `NotifySheet` in `SettingsScreen` | [ ] |
| F6 | "Save purchase location" toggle | `SettingsScreen`, `captureLocation` on `useSettings` | [ ] |
| F7 | "AI actions: X of Y left" row | `SettingsScreen`, `useAiUsage` | [ ] |
| F8 | "Auto-categorize" and "Receipt OCR" toggles. They only write settings; nothing else reads them | `SettingsScreen` | [ ] |
| F9 | "Export all data" shows an alert telling the user to use Reports. It does not export | `SettingsScreen` | [ ] |
| F10 | Delete account: confirms, deletes expenses, categories, budget lines, budget groups, then the auth user. Storage cleanup is best-effort | `deleteAccount` in `src/services/account.ts` | [ ] |

## G. Categories and groups

| ID | Feature | Where | Status |
|---|---|---|---|
| G1 | Categories screen: add, rename, recolor, archive, delete. Seed categories cannot be deleted. Delete moves expenses to "Other". Counts are this calendar month, unconverted | `CategoriesScreen`, `CategoryEditor` | [ ] |
| G2 | Custom budget groups can be created from the line editor's "Goes to" picker. Creating writes `users/{uid}/budgetGroups` | `GoesToPicker`, `useBudgetGroups.add` | [ ] |
| G3 | Gap, not a current feature: there is no UI to rename or delete a custom group. `useBudgetGroups.remove` exists and has no caller. There is no rename method | `src/store/useBudgetGroups.ts` | n/a |

## M. Present because of `e42d006`

| ID | Feature | Where | Status |
|---|---|---|---|
| M1 | Receipt line items `{ name, amount }[]` parsed from the scan and shown in review and in transaction detail | `lineItemsOf` in `src/services/groq.ts`, `ReviewPhase` in `AddSheet`, items block in `TxnDetailModal` | [ ] |
| M2 | Search includes line-item names | `matchesQuery` in `ActivityScreen` | [ ] |
| M3 | Ask Tally | `ActivityScreen`, `askTally` in `src/services/groq.ts` | [ ] |
| M4 | AI quota: global `UpgradeModal`, settings row, usage refresh on sign-in, proxy `429` becomes `AiLimitError` | `useAiUsage`, `src/services/aiUsageBridge.ts`, `UpgradeModal`, `App.tsx`, `SettingsScreen` | [ ] |
| M5 | Optional purchase location. Toggle in settings. Detail shows "Near {address}" when an address was stored | `capturePurchaseLocation` in `src/services/location.ts`, `maybeLocation` in `AddSheet`, `TxnDetailModal` | [ ] |
| M6 | PDF export of one month | `exportMonthPdf` in `src/services/export.ts`, Reports | [ ] |
| M7 | Recap modal ("Weekly comparison" entry is the Reports "This week" row). Week / month / quarter / year / all / custom period math, sparkline, "Most spent on" by category, "Generate insights" | `RecapModal`. Insights call is `fetchInsights` in `src/services/groq.ts`. Totals are raw `amount` sums and include income | [ ] |
| M8 | Working delete account | `src/services/account.ts`, Settings | [ ] |
| M9 | Firestore rules and proxy rate limiting. Do not change either | `firestore.rules`, `proxy/` | [ ] |

## X. Other behavior that must keep working

| ID | Feature | Where | Status |
|---|---|---|---|
| X1 | Amounts on Budget, Activity, and Reports display in the preferred currency via `useRates.convert` | `useRates`, `fmt` in `src/services/format.ts` | [ ] |
| X2 | Rates load from cache on boot and refresh when stale, including when the app returns to foreground | `App.tsx`, `useRates` | [ ] |
| X3 | Expense dates are local calendar dates. Activity must not shift a date by a timezone day | `parseLocalDate` / `toLocalDateISO` in `src/services/format.ts`, `expenseMonthKey` in `src/services/month.ts` | [ ] |
| X4 | An expense with no `line_id` still matches a line whose `templateKey` equals `category_id` | `expenseMatchesLine` in `src/services/budget.ts` | [ ] |
| X5 | Transaction detail: converted amount, original currency when different, note, line items, location, receipt image or the "not stored" note. Attach-from-library only runs when `RECEIPT_STORAGE_ENABLED` is true | `TxnDetailModal` | [ ] |
| X6 | Detail currently appends a time ("12:00 AM") because dates have no time | `fmtFull` in `TxnDetailModal` | [ ] |
| X7 | `showRecap`, `autoCategories`, `receiptOcr`, and `currencyPrompted` round-trip through AsyncStorage. `currencyPrompted` has no UI. `showRecap` is unused | `useSettings` | [ ] |
| X8 | Swipe-to-reveal on a transaction row (threshold and velocity snap) | `TxnRow` | [ ] |
| X9 | Empty `DEMO_TXNS` export. Nothing imports it. `src/store/db.ts` was removed in `e42d006` | `src/store/defaults.ts` | [ ] |

## Notes for later steps

- Recap's "Most spent on" groups by `category_id` and category name, not by budget line.
- Reports CSV is built inline in `ReportsScreen`, not in `src/services/export.ts`. PDF is the shared builder.
- There is no test script in `package.json`. The only test is `src/services/receiptUri.test.ts` (`node:test`). `node --experimental-strip-types --test src/services/receiptUri.test.ts` fails because the import has no `.ts` extension (`ERR_MODULE_NOT_FOUND`). No runner was added.
- `useBudgetGroups` has no rename. Adding one must update the existing `label` field, not reshape the collection.
