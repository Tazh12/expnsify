# UX refresh feature inventory

Regression checklist for `feat/ux-refresh`. Baseline is local `main` at `e42d006` ("checkpoint before checking out feat/multi-currency"), which is `feat/multi-currency` (`5fdf7ca`) plus that one commit. Every row below is behavior that exists today and must still work when the refresh is done.

Status is the outcome on `feat/ux-refresh`. A check means the behavior still exists, or it was removed because the brief said so. Limits on what was clicked are in `SUMMARY.md`.

Letters match the brief: A shell, B capture, C plan, D activity, E reports, F settings, G categories and groups, M features that exist only because of `e42d006`. Extra rows use an `X` id.

## A. Shell

| ID | Feature | Where | Status |
|---|---|---|---|
| A1 | Phone tab bar: Budget, Activity, Reports, Settings, with a center "+" that opens the add sheet | `TabBar` in `src/components/TabBar.tsx`. `TabId` is `'home' \| 'txns' \| 'reports' \| 'settings'` | [x] Tabs are Today, Plan, Scan, Activity, Insights in `TabBar`. Settings is not a tab. |
| A2 | Wide layout (900px+) sidebar with the same four entries plus an "Add transaction" button | `AppShell` in `src/components/AppShell.tsx`. Breakpoint is `useLayout` in `src/hooks/useLayout.ts` | [x] Sidebar uses the same tabs plus Scan / Add in `AppShell`. Signed-in wide layout was not opened. |
| A3 | Header: logo and "expnsify". Month arrows render only on the Budget tab | `AppHeader` in `src/components/AppHeader.tsx`, mounted from `App.tsx` on phone. Wide Budget has its own month arrows inside `HomeScreen` | [x] `AppHeader` shows the shared month on every tab, plus an avatar that opens Settings. |
| A4 | Add popover on Budget (wide and phone) with "add a budget line" and "add income" | `AddMenu` in `src/components/AddMenu.tsx`, used by `HomeScreen` | [x] Removed by design. Adding is the Add row inside each Plan section. |
| A5 | Signed-out gate: email login, register, forgot password, Google sign-in (web and iOS) | `AuthScreen`, `WebGoogleSignIn`, `IosGoogleSignIn`, `useAuth` | [x] Auth screen rendered on web. iOS session was already signed in. Google sign-in was not completed. |
| A6 | Theme from palette, accent, and font, applied around the whole app | `buildTheme` / `ThemeContext` in `src/theme/index.ts`, `App.tsx` | [x] Theme still wraps the app. Palette, accent, and font open from Settings, Appearance. |
| A7 | Fonts load with a timeout fallback so the app still opens if a font stalls | `App.tsx` | [x] Unchanged. The app launched on the simulator. |
| A8 | Firestore subscriptions for categories, expenses, budget lines, and budget groups, torn down on sign-out | `App.tsx` plus `useCategories`, `useExpenses`, `useBudget`, `useBudgetGroups` | [x] Unchanged. Categories are still subscribed; the UI no longer edits that collection. |

## B. Capture (Add sheet)

| ID | Feature | Where | Status |
|---|---|---|---|
| B1 | Sheet title "Log money" and five capture methods: photo, library, PDF/email, voice, manual. Photo is hidden on web | `PickPhase` in `src/flows/AddSheet.tsx` | [x] Title is Scan or add an expense. Native: Take photo, then Library, File, Voice, Type. Web: drop zone, then Upload, File, Type. Camera starts immediately on native and was not tested on a device. |
| B2 | Camera and library use `mediaTypes: ['images']`, resize to 1024px, JPEG compress, then base64 | `AddSheet` (`launchCameraAsync` / `launchImageLibraryAsync` + `expo-image-manipulator`) | [x] Same camera and library pipeline in `startScan`. |
| B3 | PDF and text/email ingest, including HTML email flattened to plain text | `AddSheet` (`readTextFile`, `emailToPlain`, `scanPdf`, `scanText`) | [x] PDF and email ingest unchanged. |
| B4 | Voice: coach step, record, transcribe, then the same review | `VoiceCoach` in `AddSheet`, `transcribeAudio` in `src/services/groq.ts` | [x] Voice coach unchanged. Not recorded on device. |
| B5 | Manual entry skips scanning and opens review | `AddSheet` method `'manual'` | [x] Type still opens review with no scan. |
| B6 | Storage note at the top of the capture options when `RECEIPT_STORAGE_ENABLED` is false: the file is read, not stored | `PickPhase` in `AddSheet`. Flag lives in `src/services/receiptUri.ts` | [x] Storage note moved under More details in review. |
| B7 | Reading state while a scan or transcription is in flight | `ScanPhase` in `AddSheet` | [x] `ScanPhase` unchanged. |
| B8 | Review: amount with currency picker, converted-amount line, merchant, date, notes, budget-line chips, receipt thumbnail | `ReviewPhase` in `AddSheet` | [x] Review order is amount, merchant, chips, save. Date, notes, items, and the thumbnail are under More details. |
| B9 | Unbudgeted and overspend warning before save | `ReviewPhase` in `AddSheet` | [x] The warning sits under the chips. |
| B10 | Save labels: "Save to budget", "Save unbudgeted", "Update" | `ReviewPhase` in `AddSheet` | [x] Save labels unchanged. |
| B11 | Payment-confirmation shortcut: if the scan matches an unpaid bill, `CompletePaymentSheet` can mark it paid (`paid`, `paidAt`, `paidSource`) instead of creating a new expense | `CompletePaymentSheet` in `src/flows/CompletePaymentSheet.tsx`, opened from `AddSheet` | [x] `CompletePaymentSheet` still says percent match and now uses `BottomSheet`. Not exercised. |
| B12 | Line chips are the hard-coded general variable ids (Groceries, Coffee, Dining, Transport, Travel, Home, Software, Health) when those lines exist, plus "+ More" | `GENERAL_VARIABLE_IDS` and `BudgetLinePicker` in `AddSheet` | [x] Replaced. Chips are the suggested line, then up to eight recently used lines, then New line and More. |
| B13 | Edit mode reuses review. Opened from an Activity row swipe | `AddSheet` `editExpense` prop; `ActivityScreen` sets `editTarget` | [x] Edit still reuses review, from swipe or the detail Edit button. |
| B14 | Saving writes `line_id` and `category_id = line.templateKey`. No line means `unbudgeted: true` | `handleSave` in `AddSheet` | [x] `handleSave` still writes `line_id` and `category_id = templateKey`. |
| B15 | iOS share intent opens the add sheet with the shared file. Missing native module is ignored | `useIncomingShare` in `App.tsx` | [x] Share intent unchanged. Not exercised. |
| B16 | Web drag-and-drop anywhere on the window, and on the pick phase itself, opens the sheet with that file | `App.tsx` window listeners and `PickPhase` drop props | [x] Window drop and the pick-phase drop zone remain. Not exercised while signed in. |
| B17 | Per-expense currency picker and the "converted" hint | `CurrencyPickerSheet` used inside `ReviewPhase` | [x] Currency picker remains in review and uses `BottomSheet`. |
| B18 | AI limit during scan or transcribe sets the global upgrade modal (`takeAiLimit` / `AiLimitError`) | `src/services/groq.ts`, `UpgradeModal` | [x] Upgrade modal path unchanged. Not exercised. |

## C. Plan (current Budget / Home)

| ID | Feature | Where | Status |
|---|---|---|---|
| C1 | Spent-vs-assigned ring | `BudgetRing` in `src/components/BudgetRing.tsx`, rendered by `HomeScreen` | [x] Removed by design. Today shows left to spend and a bar. |
| C2 | Headline: "No budget yet", "On track", or "Overspent", with the spent-of-planned sentence | `HomeScreen` | [x] Removed by design. Replaced by the Today hero. |
| C3 | Same add popover as A4 | `AddMenu` in `HomeScreen` | [x] Removed with the add menu. |
| C4 | "Left to budget" card. Copy changes at zero and when negative | `HomeScreen`, values from `summarizeMonth` in `src/services/budget.ts` | [x] Plan shows the equation. Today pill links to Plan. |
| C5 | Carry-income prompt with Add, Skip (this visit), and Don't add (persisted per user and month) | `CarryIncomeCard` in `src/components/CarryIncome.tsx`. Persistence is `readDeclinedCarry` / `rememberDeclinedCarry` in `HomeScreen`, backed by AsyncStorage | [x] Still `CarryIncomeCard` on Plan. The three actions were not tapped on the live account. |
| C6 | Upcoming payments strip. Tapping a row opens the line editor | `UpcomingPayments` in `src/components/UpcomingPayments.tsx` | [x] Still `UpcomingPayments` on Plan. Seen on the simulator. |
| C7 | Sections render only when they have lines. Order comes from built-in sections plus custom groups | `HomeScreen` maps `useBudgetGroups.all`. Built-ins are in `SECTIONS` in `src/store/budgetTypes.ts` | [x] Built-in sections always render. Custom groups follow. |
| C8 | Line rows: name, expected, actual, remaining, paid checkbox | `BudgetRow` in `src/components/BudgetRow.tsx`, inside `BudgetSection` | [x] Still `BudgetRow`. Income rows were visible. |
| C9 | Wide table layout for the same rows | `BudgetRow` `wide` prop, turned on by `HomeScreen` when `isWide` | [x] Wide table code unchanged. Not viewed at 900px while signed in. |
| C10 | Section collapse toggle. State is in memory only and resets when the section unmounts | `BudgetSection` | [x] Collapse is stored on the device in AsyncStorage. |
| C11 | Line editor: name, amount, group ("Goes to"), due date, repeat, frequency, auto-pay, income actual, note, delete | `LineEditor` in `src/flows/LineEditor.tsx`. Group picker is `GoesToPicker` | [x] Basics and Schedule in `LineEditor`, on `BottomSheet`. |
| C12 | Name-based group guess (`inferDestination` and `findLineByName`) can change the section while typing | `LineEditor` | [x] The guess is a tappable suggestion and does not change the section by itself. |
| C13 | Inline "+ Add" at the bottom of a section opens the editor for that section | `BudgetSection` `onAddLine` | [x] One Add at the bottom of each section. That section stays locked. |
| C14 | Saving a repeating line updates unpaid siblings in the same month that share `templateKey`. New repeating lines expand into the month's occurrence days | `saveLine` in `HomeScreen` | [x] Sibling sync lives in `useSaveBudgetLine`. |
| C15 | Notification sync runs from a `HomeScreen` effect whenever lines or notification settings change | `syncNotifications` in `src/services/notifications.ts` | [x] `useNotificationSync` in `App.tsx` uses the calendar month, and next month from the 25th. |
| C16 | Opening a month copies the previous plan forward and collapses duplicate repeats | `ensureMonth` and `dedupeRepeats` in `src/store/useBudget.ts` | [x] `ensureMonth` and `dedupeRepeats` unchanged. |
| C17 | Paid checkbox writes `paid`, `paidAt`, and `paidSource: 'manual'` (or clears them) | `togglePaid` in `HomeScreen` | [x] Plan checkbox and Today Mark paid write paid, paidAt, and paidSource manual. |
| C18 | Separate income sources stay distinct when a second paycheck is added | `uniqueTemplateKey` in `src/services/month.ts`, used by `saveLine` | [x] `uniqueTemplateKey` still used when saving a new line. |

## D. Activity

| ID | Feature | Where | Status |
|---|---|---|---|
| D1 | Title "Transactions" and tagline "everything, in order". List is all time, grouped by day, with a converted day total | `ActivityScreen` in `src/screens/ActivityScreen.tsx` | [x] Title is Activity, no tagline. The list defaults to the view month, with an All time chip. |
| D2 | Search matches merchant, notes, and line-item names | `matchesQuery` in `ActivityScreen` | [x] `matchesQuery` still checks merchant, notes, and line items. |
| D3 | "Ask Tally" when a search matches nothing. Uses one AI action and then filters to the returned ids | `ask` in `ActivityScreen`, `askTally` in `src/services/groq.ts` | [x] Ask Tally remains. It was not run. |
| D4 | Filter sheet: date range (all, today, last 7 days, this month), categories, merchants (first 30). Custom range is implemented in the filter function and hidden in the UI (`k !== 'custom'`) | `FilterSheet` in `ActivityScreen` | [x] Custom range is visible. Categories are budget lines grouped by group. The sheet uses `BottomSheet`. |
| D5 | Active-filter chips with a clear-all. The remove mark on a chip is a small tap target | `Chip` in `ActivityScreen` | [x] The chip remove control is 44pt. |
| D6 | Row shows merchant, category or line, converted amount, and a time | `TxnRow` in `src/components/TxnRow.tsx`. Time comes from `fmtTime` in `src/services/format.ts` | [x] Time removed from `TxnRow`. |
| D7 | Tap opens transaction detail. Swipe reveals edit and delete | `TxnRow`, `TxnDetailModal` | [x] A tap opens detail. Swipe still reveals edit and delete. Swipe was not used on device. |
| D8 | Unbudgeted and overspent markers on a row | `ActivityScreen` passes `unbudgeted` and `overspend` into `TxnRow` | [x] Unbudgeted and overspent markers unchanged. |
| D9 | Delete confirms, then `useExpenses.remove` | `ActivityScreen` | [x] Delete still confirms, including a Delete button on the detail sheet. |

## E. Reports

| ID | Feature | Where | Status |
|---|---|---|---|
| E1 | Own month switcher, independent of the Budget month | `ReportsScreen` `useState(defaultBudgetMonth)` | [x] Removed by design. Insights uses `useViewMonth`. |
| E2 | Stats for the selected month (expected, assigned, spent, left to budget) | `ReportsScreen`, `summarizeMonth` | [x] Expected in, Assigned, and Spent remain. The left-to-budget card was removed. |
| E3 | Spend-by-section bars | `ReportsScreen` | [x] Section bars remain on Insights. |
| E4 | Unpaid bills list | `ReportsScreen` | [x] Removed by design. Unpaid bills are on Today. |
| E5 | Overspent lines list | `ReportsScreen` | [x] Overspent list remains on Insights. |
| E6 | "This week" row opens the recap modal | `ReportsScreen` `onOpenRecap`, `RecapModal` mounted in `App.tsx` | [x] Recap modal removed. Insights has Week / Month, a sparkline, and Generate insights. Quarter, year, all, and custom ranges were not carried over. |
| E7 | Export this month as CSV (share sheet) | `exportCsv` in `ReportsScreen` | [x] CSV is `expensesToCsv` in `src/services/export.ts`. Not shared from the device. |
| E8 | Export this month as PDF, including line items | `exportMonthPdf` in `src/services/export.ts` | [x] PDF is still `exportMonthPdf`. Not shared from the device. |

## F. Settings

| ID | Feature | Where | Status |
|---|---|---|---|
| F1 | Profile, display name edit, sign out | `SettingsScreen` | [x] Profile, name, and sign out seen. Did not sign out. |
| F2 | Appearance inline: palette, accent, font | `SettingsScreen` | [x] Appearance is a screen inside Settings. |
| F3 | Base currency row and rate freshness | `SettingsScreen`, `CurrencyPickerSheet`, `useRates` | [x] Base currency and rate age seen. |
| F4 | Categories row opens the full-screen categories manager. Detail is the count of non-archived categories | `SettingsScreen` → `CategoriesScreen` | [x] Replaced by Lines and Groups inside Settings. `CategoriesScreen` deleted. Category documents stay in Firestore. |
| F5 | Notifications sheet: monthly budget reminder (with day) and upcoming payment pings | `NotifySheet` in `SettingsScreen` | [x] Notifications opened on the simulator and uses `BottomSheet`. |
| F6 | "Save purchase location" toggle | `SettingsScreen`, `captureLocation` on `useSettings` | [x] Toggle remains. Detail is On or Off. |
| F7 | "AI actions: X of Y left" row | `SettingsScreen`, `useAiUsage` | [x] AI actions row seen. |
| F8 | "Auto-categorize" and "Receipt OCR" toggles. They only write settings; nothing else reads them | `SettingsScreen` | [x] Removed from the UI by design. `autoCategories` and `receiptOcr` are still stored. |
| F9 | "Export all data" shows an alert telling the user to use Reports. It does not export | `SettingsScreen` | [x] Export all data writes every month through `expensesToCsv`. Not shared from the device. |
| F10 | Delete account: confirms, deletes expenses, categories, budget lines, budget groups, then the auth user. Storage cleanup is best-effort | `deleteAccount` in `src/services/account.ts` | [x] Delete account still confirms via `deleteAccount`. Not confirmed. |

## G. Categories and groups

| ID | Feature | Where | Status |
|---|---|---|---|
| G1 | Categories screen: add, rename, recolor, archive, delete. Seed categories cannot be deleted. Delete moves expenses to "Other". Counts are this calendar month, unconverted | `CategoriesScreen`, `CategoryEditor` | [x] Removed from the UI by design. The categories collection is untouched. |
| G2 | Custom budget groups can be created from the line editor's "Goes to" picker. Creating writes `users/{uid}/budgetGroups` | `GoesToPicker`, `useBudgetGroups.add` | [x] `GoesToPicker` still creates groups and uses `BottomSheet`. |
| G3 | Gap, not a current feature: there is no UI to rename or delete a custom group. `useBudgetGroups.remove` exists and has no caller. There is no rename method | `src/store/useBudgetGroups.ts` | n/a |

## M. Present because of `e42d006`

| ID | Feature | Where | Status |
|---|---|---|---|
| M1 | Receipt line items `{ name, amount }[]` parsed from the scan and shown in review and in transaction detail | `lineItemsOf` in `src/services/groq.ts`, `ReviewPhase` in `AddSheet`, items block in `TxnDetailModal` | [x] Line items are under More details in review and still in transaction detail. |
| M2 | Search includes line-item names | `matchesQuery` in `ActivityScreen` | [x] Search still includes line-item names. |
| M3 | Ask Tally | `ActivityScreen`, `askTally` in `src/services/groq.ts` | [x] Ask Tally unchanged. Not run. |
| M4 | AI quota: global `UpgradeModal`, settings row, usage refresh on sign-in, proxy `429` becomes `AiLimitError` | `useAiUsage`, `src/services/aiUsageBridge.ts`, `UpgradeModal`, `App.tsx`, `SettingsScreen` | [x] `UpgradeModal` and the settings row remain. |
| M5 | Optional purchase location. Toggle in settings. Detail shows "Near {address}" when an address was stored | `capturePurchaseLocation` in `src/services/location.ts`, `maybeLocation` in `AddSheet`, `TxnDetailModal` | [x] Location toggle remains. The Near row in detail is unchanged. Not exercised. |
| M6 | PDF export of one month | `exportMonthPdf` in `src/services/export.ts`, Reports | [x] PDF export is on Insights. |
| M7 | Recap modal ("Weekly comparison" entry is the Reports "This week" row). Week / month / quarter / year / all / custom period math, sparkline, "Most spent on" by category, "Generate insights" | `RecapModal`. Insights call is `fetchInsights` in `src/services/groq.ts`. Totals are raw `amount` sums and include income | [x] Folded into Insights. Totals are converted and exclude income. Most spent on is a line. Week and Month only. |
| M8 | Working delete account | `src/services/account.ts`, Settings | [x] Same `deleteAccount`. Not confirmed. |
| M9 | Firestore rules and proxy rate limiting. Do not change either | `firestore.rules`, `proxy/` | [x] `firestore.rules` and `proxy/` were not changed. |

## X. Other behavior that must keep working

| ID | Feature | Where | Status |
|---|---|---|---|
| X1 | Amounts on Budget, Activity, and Reports display in the preferred currency via `useRates.convert` | `useRates`, `fmt` in `src/services/format.ts` | [x] Today, Plan, and Insights showed CHF via `convert`. |
| X2 | Rates load from cache on boot and refresh when stale, including when the app returns to foreground | `App.tsx`, `useRates` | [x] Settings showed a fresh rate age after launch. |
| X3 | Expense dates are local calendar dates. Activity must not shift a date by a timezone day | `parseLocalDate` / `toLocalDateISO` in `src/services/format.ts`, `expenseMonthKey` in `src/services/month.ts` | [x] Date helpers unchanged. Not retested across timezones. |
| X4 | An expense with no `line_id` still matches a line whose `templateKey` equals `category_id` | `expenseMatchesLine` in `src/services/budget.ts` | [x] `expenseMatchesLine` still used by filters and Today. |
| X5 | Transaction detail: converted amount, original currency when different, note, line items, location, receipt image or the "not stored" note. Attach-from-library only runs when `RECEIPT_STORAGE_ENABLED` is true | `TxnDetailModal` | [x] Detail still shows amount, note, items, location, and the receipt note. |
| X6 | Detail currently appends a time ("12:00 AM") because dates have no time | `fmtFull` in `TxnDetailModal` | [x] Time removed by design from detail and from rows. |
| X7 | `showRecap`, `autoCategories`, `receiptOcr`, and `currencyPrompted` round-trip through AsyncStorage. `currencyPrompted` has no UI. `showRecap` is unused | `useSettings` | [x] Those keys still round-trip. The two toggles are not shown. |
| X8 | Swipe-to-reveal on a transaction row (threshold and velocity snap) | `TxnRow` | [x] Swipe math unchanged. Not used on device. |
| X9 | Empty `DEMO_TXNS` export. Nothing imports it. `src/store/db.ts` was removed in `e42d006` | `src/store/defaults.ts` | [x] `DEMO_TXNS` deleted. Nothing imported it. |

## Notes

- Insights compares the view month with the previous month, or this week with last week. Older recap ranges were not copied.
- CSV for one month and for all data is `expensesToCsv` in `src/services/export.ts`.
- There is still no test script. The receipt URI test fails on its extensionless import. No runner was added.
- `useBudgetGroups.rename` updates the existing `label` field.
