# Add expense: calendar date picker + amount field overlap fix

## Problem

In the manual "Add expense" review screen (`src/flows/AddSheet.tsx`):

1. The "Date" field is a free-text `ReviewRow` — tapping it opens a plain text input where the user types a date string. There's no calendar UI.
2. The "Amount" card renders the uppercase "AMOUNT" label directly above the large (52px serif) amount input with only 4px of margin between them, causing the label and the digits' ascenders to visually overlap.

## Design

### Date picker

New component: `src/components/DatePicker.tsx`.

- Rendered as a `Modal` bottom sheet, visually matching `CategoryEditor.tsx`: `bgElev` background, rounded top corners (28), `hairStrong` border, drag-handle bar, serif title (`C.fonts.serif`), backdrop tap-to-dismiss.
- Header row: month + year label (serif), with left/right chevron `Icon` buttons (`chev-l`/`chev-r`, consistent with existing icon set) to navigate months. Navigation only changes the displayed month, not the selected date.
- Below the header: a 7-column grid of weekday initials (S M T W T F S), then a grid of day-number cells for the displayed month (leading/trailing blank cells for days outside the month, consistent with a standard calendar grid).
- Selected day: filled sage-accent circle behind the number (visually consistent with `CategoryChip`'s selected state).
- Today (if not selected): a subtle outline (`C.hair` border) instead of a fill.
- A "Today" `Tap` shortcut below the grid jumps the displayed month to the current month and selects today's date, closing the sheet.
- Tapping any day cell selects that date and immediately closes the sheet (no separate confirm button — consistent with how `ReviewRow` text edits commit on blur elsewhere in this screen).

Props: `visible: boolean`, `value: Date`, `onSelect: (date: Date) => void`, `onClose: () => void`.

### Integration in AddSheet.tsx

- Replace the `ReviewRow` "Date" row's `onEdit` text-editing behavior with a tap handler that opens `DatePicker`.
- `DatePicker`'s `onSelect` updates both `dateISO` and `dateDisplay` state (same two pieces of state that already exist in `ReviewPhase`).
- The displayed value keeps using the existing `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })` format.

### Amount field overlap fix

In the "Amount" `Card` in `AddSheet.tsx`, increase the spacing between the "AMOUNT" label and the input row (the row currently has `marginTop: 4`) enough to clear the 52px serif font's rendered ascent — no other layout changes.

## Out of scope

- Date range selection, multi-month scroll, or year picker — single month grid with prev/next arrows is sufficient per user's choice.
- No third-party date library is introduced; date math uses native `Date`.
