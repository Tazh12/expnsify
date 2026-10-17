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
- Date picker popovers stay centered. Upgrade is still a centered dialog.
- Rename and “move this group” inside Lines & Groups are still small dialogs, not the shared sheet.

## Follow-ups

- Let a receipt’s line items be assigned to more than one budget line. They are display and search only.
- Add a test runner that can import `receiptUri.test.ts` without a new production dependency, or give that import a `.ts` extension if Node is the runner.
- Sign in on web and check the sidebar at 900px. The phone-width auth row is fixed in `402fa34`; headless Chrome at 360px now shows Create account on its own row.
- Confirm stop-repeating against a real next month once you are willing to write that data.

## Round 3

Fixes on `feat/ux-refresh`. `npx tsc --noEmit` passed after each commit. Nothing was merged or pushed.

| Fix | Commit | What changed |
|---|---|---|
| Later months with spending stay when a line stops repeating | `7ac8346` | Empty unpaid later lines are deleted. A later line that is paid or has an expense is kept and set to not repeating. |
| Plan totals convert currency | `c843971` | Section headers, rows, Needs attention, Upcoming, overspent, and the review warning use `convert`. CSV and PDF include the original amount and currency plus the converted amount. |
| Sign-in fits at 360px | `ec793aa`, `c84c0f8`, `a43d7c5`, `402fa34` | Sign in and Create account stack. The form is inset with margin so Forgot password stays inside the window. |
| Insights copy when nothing is logged | `17f89a1` | A $0 period says “Nothing logged yet this month” (or this week) and skips the percentage. The percentage is also skipped when the previous period was $0. |
| Scan options | `6391d4b`, `5e6b631` | The scan sheet uses the shared opaque sheet. Title is one line, the close control sits inside the padding, and the other methods are equal tiles. |
| Empty lists | `6fe426b` | Activity distinguishes no history, an empty month, and no filter matches. Today, Insights, and custom groups use the same empty state. |
| Activity filters and titles | `6fe426b`, `63776fa` | Chips sit on one scrolling row under search. The selected chip is filled sage. Page titles are 32pt. Placeholder text uses the muted color, darkened so cream and carbon clear 4.5:1. |
| Month in the header | `6ab7aca` | Phones show the icon only. Below 430px the label is “Oct 2026”. |

Screenshots in `docs/ux-refresh/screenshots/`:

- Before: `before-scan-options.png`, `before-activity-chips.png`, `before-header-month.png`, `before-activity-empty.png`, `before-today-header.png`
- After, iPhone 17 Pro simulator, Cream, Default: `after-scan-options.png`, `after-activity.png`, `after-activity-filters.png`, `after-today-header.png`
- Web, not signed in, Midnight: `web-360.png`, `web-430.png`, `web-1100.png`

The after shots are one theme and one font. Cycling Midnight, Cream, and Carbon across Default, Sans, Mono, and Comic would rewrite this account’s appearance settings, so that matrix was not clicked through. Placeholder contrast was checked against the theme colors: cream muted `#6B655C` on `#FAF8F2` is 5.43:1, midnight muted `#8F8A80` on `#1B1A17` is 5.07:1, carbon muted `#8E8E9A` on `#121215` is 5.78:1.

## End-to-end flows

Not run. The simulator is signed into the existing account, and these flows write expenses and budget lines. They need a test account first.

| # | Flow | iOS | Web 390 | Web 1100 |
|---|---|---|---|---|
| 1 | Empty month and starter lines | not run | not run | not run |
| 2 | Add income and one line in each spend section | not run | not run | not run |
| 3 | Weekly repeating line and sibling edit | not run | — | — |
| 4 | Groceries stays in Bills, then the move suggestion | not run | — | — |
| 5 | Mark a bill paid, then unmark it | not run | — | — |
| 6 | Next month carry-forward and the income prompt | not run | — | — |
| 7 | Manual entry on a line | not run | not run | not run |
| 8 | Manual entry with no line, then Assign line | not run | not run | not run |
| 9 | New line from review | not run | not run | not run |
| 10 | Photo library upload | not run | — | — |
| 11 | PDF or email, including web drop | not run | not run | not run |
| 12 | Payment confirmation marks the bill paid | not run | — | — |
| 13 | Receipt dated in another month | not run | — | — |
| 14 | Foreign currency uses the converted amount | not run | — | — |
| 15 | Needs attention actions | not run | not run | not run |
| 16 | Activity detail, edit, delete, filters, search | not run | not run | not run |
| 17 | Ask Tally and Generate insights | not run | — | — |
| 18 | Insights week/month, bars, CSV, PDF | not run | not run | not run |
| 19 | Lines and groups rename, delete, stop repeating | not run | not run | not run |
| 20 | Export all data | not run | not run | not run |

The camera on a real iPhone is still yours to test. On the simulator, opening Scan shows “Camera unavailable” and then the options sheet.

## Round 4

### Scanning in production

Not deployed. `GROQ_API_KEY` is not in this environment, so the model list was not fetched. The worker now reads `SCAN_MODEL`, `TEXT_MODEL`, and `AUDIO_MODEL` from Wrangler vars (`6bac3af`). Until those are set from the key’s model list, the code still defaults to `qwen/qwen3.6-27b`, which Groq rejects. Qwen reasoning flags are sent only when the model id contains `qwen`. `parseModelJson` already accepts fenced JSON and a trailing object.

The KV ids in `proxy/wrangler.toml` are still placeholders. Deploying this worker as-is would fail closed and block AI calls. Wrangler login, `kv namespace create`, `secret list`, and `deploy` were not run.

The app (`a7a622e`) now treats a non-OK scan, a timeout, or a network error as “Scanning isn't available right now” with a Type it button, 401/403 as “Please sign in again”, and a response with no amount as “Could not read that receipt”. The status and response body are logged. The image and token are not.

### Scan tiles

`docs/ux-refresh/screenshots/after-scan-tiles.png` (iPhone 17 Pro, Cream, Mono, after the tap change): the title, close button, and “Scan a receipt” button are inside the sheet. The four labels are readable (Photo library, PDF or email, Say it, Type it) and the two columns are the same width. The second row still sits on the bottom edge of the sheet. The page color shows in the gap under that edge, and the tile fill continues a short way past the sheet background. This is not closed.

`Tap` is now one pressable, so flex and the background are the same view (`2e466fd` plus the follow-up). That did not by itself pull the second row fully inside the sheet.

### Account check

Settings on this simulator is `gutierrezlabarrera@gmail.com`. That address does not contain `+test`, so the 20 flows were not run and nothing was written. Appearance was left as it was found: Cream, sage, Mono.

### Theme and font matrix

Not taken. The tile screenshot above is the only new one, and it does not match the brief.
