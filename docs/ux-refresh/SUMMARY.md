# UX refresh summary

Branch: `feat/ux-refresh`, from local `main` at `e42d006`. Not merged or pushed.

## What moved

| Before | After |
|---|---|
| Phone tabs: Budget, Activity, Reports, Settings, center + | Today, Plan, Scan, Activity, Insights. Settings opens from the header avatar |
| Wide sidebar: same four items and “Add transaction” | Same four tabs plus “Scan / Add” |
| Month arrows only on Budget | One shared month (`useViewMonth`) on Today, Plan, Activity, and Insights |
| Home ring, “On track”, and “Left to budget” card | Today: left to spend and a progress bar. Plan: Income − Assigned = left to assign |
| Add menu popover | One Add at the bottom of each Plan section. The section stays locked |
| `HomeScreen` | `PlanScreen` |
| `ReportsScreen` and its own month switcher | `InsightsScreen`, using the shared month |
| Recap modal | Week / Month comparison, sparkline, and Generate insights on Insights. Income is excluded and amounts are converted |
| Unpaid bills on Reports | Today, as “Mark paid” |
| Activity title “Transactions”, all-time list, category filters, time on each row | Title “Activity”, view month by default, All time chip, budget-line filters, no time |
| Settings as a tab. Categories manager. Export-all alert. Auto-categorize and Receipt OCR toggles | Settings modal. Lines & Groups and Appearance are screens inside that modal. Export all writes a CSV. Those two toggles are hidden; the stored keys remain |
| Scan title “Log money”. Camera after you pick a method | “Scan or add an expense”. On a phone the camera opens immediately. Review is amount, merchant, line, save. Date, notes, items, and the storage note are under More details |
| Hard-coded Groceries/Coffee/… chips | Suggested line, then up to eight lines you have used in the last 60 days, then More and New line |
| Each sheet drew its own chrome | Shared `BottomSheet` for the line editor, filters, transaction detail, notifications, edit name, Goes to, more lines, new line, payment confirmation, currency, and the date sheet |

## Fixes

1. **Lines & Groups crashed on open** (`97b6dc0`). `useBudget(s => s.forMonth(month))` returned a new array every time, so React hit its update limit. The screen now subscribes to the line list and filters it.
2. **Stop repeating deleted the current month** (`cdb77f9`). It now drops the line from later months and marks this month as not repeating, so the next month is not copied forward. “Remove from this month too” appears only when this month’s line is unpaid and has no expenses.
3. **Lines & Groups was a second full-screen modal** (`be18e55`). It now renders inside Settings, same as Appearance. On the simulator the second modal did mount, then crashed for the reason above.
4. **Notifications followed the month on screen** (`06afbd0`). Reminders use the calendar month. From the 25th onward, next month’s lines are included too.
5. **“Save purchase location” wrapped into a broken column** (`a3b9942`). The row detail is On/Off, and the label can use two lines.

## What was tested

**iOS Simulator, iPhone 17 Pro (iOS 26.3), signed in as the existing account.** `npx expo run:ios` installed and opened the app.

Seen without a crash, after dismissing the dev warning banner (SafeAreaView and expo-av deprecation):

- Today: left to spend CHF 581.15, “CHF 1,799.92 to assign”, tab bar.
- Plan: equation, Upcoming (Gym, Internet, Retirement, Car insurance), Income rows, Add.
- Activity: Activity title, All time / Needs a line / Expenses / Income, search. October had no transactions.
- Insights: Week and Month, “You spent CHF 0.00, 100% less than September.”, sparkline, Generate insights, Expected in / Assigned / Spent.
- Settings: profile, Delete account (not confirmed), base currency CHF, rate freshness, Lines & Groups row, Notifications sheet, location toggle, AI actions, Appearance, Export all data, About v1.0.0.

**Web, headless Chrome, not signed in.** `npx expo start --web` on port 8081.

- 390×844: sign-in screen renders. “Create account” and “Forgot password” are clipped at the right edge.
- 1100×800: the same screen fits, including both of those labels.

`npx tsc --noEmit` passed after every commit on this branch.

## Not verified

- The camera. Scan now calls `launchCameraAsync` as soon as the sheet opens. That needs a real iPhone. The simulator does not have a working camera.
- Signed-in web at phone width and at 900px or wider. The headless browser had no session, so the sidebar and the signed-in pages were not clicked there.
- Creating a line, logging an expense, stopping repeat, and opening next month. That would write to the signed-in account. The code path is the one above; it was not clicked through.
- Assign line, Mark paid, Adjust, carry-income Add / Skip / Don’t add, swipe, Ask Tally, Generate insights, CSV, and PDF. Ask Tally and Generate insights spend an AI action. Delete account was not confirmed.
- Share intent, drag-and-drop of a real file, voice capture, and payment confirmation.

## Not done, on purpose

- No proxy, schema, or dependency changes. Firestore `categories` documents are still subscribed and still written as `category_id = line.templateKey`.
- No test runner. `src/services/receiptUri.test.ts` still fails under `node --experimental-strip-types --test` because the import has no `.ts` extension.
- Recap’s quarter, year, all-time, and custom ranges were not copied onto Insights. Week and Month remain.
- The scan sheet itself is still its own animated sheet. The pickers it opens use `BottomSheet`. Date picker popovers stay centered. Upgrade is still a centered dialog.
- Rename and “move this group” inside Lines & Groups are still small dialogs, not the shared sheet.

## Follow-ups

- Let a receipt’s line items be assigned to more than one budget line. They are display and search only.
- Add a test runner that can import `receiptUri.test.ts` without a new production dependency, or give that import a `.ts` extension if Node is the runner.
- Sign in on web and check the sidebar at 900px, and the phone-width auth row so “Create account” and “Forgot password” are not clipped.
- Plan section headers add raw `expected` and then format that number as the preferred currency. The equation uses `convert`. On this account the income header and the equation did not show the same total.
- Confirm stop-repeating against a real next month once you are willing to write that data.
