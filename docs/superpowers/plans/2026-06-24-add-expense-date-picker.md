# Add Expense: Calendar Date Picker + Amount Field Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text "Date" field in the manual add-expense review screen with a custom calendar month-grid picker styled to match the app's existing dark/cream theme, and fix the "AMOUNT" label visually overlapping the large amount input.

**Architecture:** One new self-contained component, `src/components/DatePicker.tsx`, following the exact visual pattern already used by `src/components/CategoryEditor.tsx` (a `Modal` bottom sheet with drag handle, `bgElev` background, rounded top corners). `src/flows/AddSheet.tsx` wires it in by giving `ReviewRow` an `onPress` escape hatch and swapping the Date row's text-edit behavior for opening the picker. The amount-card fix is a one-line spacing change in the same file.

**Tech Stack:** React Native, existing theme tokens from `src/theme/index.ts` (`useTheme()`), existing `Icon`, `Tap`, `Card` components. No new dependencies.

## Global Constraints

- No third-party date-picker library — use native `Date` only (per spec, "Out of scope").
- No test framework exists in this repo (`package.json` has no test script, no jest config). Verification for every task is: TypeScript compiles cleanly (`npx tsc --noEmit`) and manual check in the iOS Simulator. Do not introduce a test framework as part of this plan.
- Visual style must match `CategoryEditor.tsx`: `C.bgElev` sheet background, 28px top corner radius, `C.hairStrong` border, drag-handle bar, `C.fonts.serif` titles, `C.muted` uppercase section labels.
- Selected-day highlight uses `C.sage` fill with `#0E0E0C` text (matches the "Save expense" button's text-on-sage contrast already used in `AddSheet.tsx:437`).

---

### Task 1: Create the `DatePicker` component

**Files:**
- Create: `src/components/DatePicker.tsx`

**Interfaces:**
- Produces: `DatePicker` component with props `{ visible: boolean; value: Date; onSelect: (date: Date) => void; onClose: () => void }`. `AddSheet.tsx` (Task 2) imports this as `import { DatePicker } from '../components/DatePicker';`.
- Consumes: `useTheme()` from `../theme`, `Icon` and `Tap` from `./` (this directory's barrel — confirm `src/components/index.ts` exports `Icon` and `Tap`; if it doesn't, import directly from `./Icon` and `./Tap`).

- [ ] **Step 1: Check how `Icon` and `Tap` are exported from this directory**

Run: `cat src/components/index.ts`

If it exports `Icon` and `Tap`, use `import { Icon, Tap } from './';` in Step 2. If there's no barrel file, use `import { Icon } from './Icon'; import { Tap } from './Tap';` instead.

- [ ] **Step 2: Write `src/components/DatePicker.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Tap } from './Tap';

interface DatePickerProps {
  visible: boolean;
  value: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildGrid(viewMonth: Date): (number | null)[][] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function DatePicker({ visible, value, onSelect, onClose }: DatePickerProps) {
  const C = useTheme();
  const [viewMonth, setViewMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  useEffect(() => {
    if (visible) setViewMonth(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [visible]);

  const today = new Date();
  const rows = buildGrid(viewMonth);

  const goMonth = (delta: number) => {
    setViewMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const pickDay = (day: number) => {
    onSelect(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
    onClose();
  };

  const jumpToday = () => {
    setViewMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelect(today);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{
          backgroundColor: C.bgElev,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 0.5, borderColor: C.hairStrong,
          padding: 24, paddingBottom: 40,
        }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.hairStrong, alignSelf: 'center', marginBottom: 20 }} />

          {/* Month header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Tap onPress={() => goMonth(-1)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chev-l" size={16} stroke={C.muted} />
            </Tap>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 20, color: C.cream }}>
              {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <Tap onPress={() => goMonth(1)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chev-r" size={16} stroke={C.muted} />
            </Tap>
          </View>

          {/* Weekday labels */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>
                {w}
              </Text>
            ))}
          </View>

          {/* Day grid */}
          {rows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', marginBottom: 4 }}>
              {row.map((day, ci) => {
                if (day === null) return <View key={ci} style={{ flex: 1, aspectRatio: 1 }} />;
                const cellDate = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
                const selected = isSameDay(cellDate, value);
                const isToday = isSameDay(cellDate, today);
                return (
                  <View key={ci} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Tap onPress={() => pickDay(day)} style={{
                      width: 36, height: 36, borderRadius: 18,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: selected ? C.sage : 'transparent',
                      borderWidth: isToday && !selected ? 1 : 0,
                      borderColor: C.hairStrong,
                    }}>
                      <Text style={{ fontSize: 14, color: selected ? '#0E0E0C' : C.cream }}>{day}</Text>
                    </Tap>
                  </View>
                );
              })}
            </View>
          ))}

          {/* Today shortcut */}
          <Tap onPress={jumpToday} style={{ marginTop: 12, alignSelf: 'center' }}>
            <Text style={{ fontSize: 13, color: C.sage }}>Jump to today</Text>
          </Tap>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `DatePicker.tsx`. (Pre-existing unrelated errors elsewhere in the repo, if any, are not this task's concern — confirm by checking the error output doesn't mention `src/components/DatePicker.tsx`.)

- [ ] **Step 4: Commit**

```bash
git add src/components/DatePicker.tsx
git commit -m "Add custom calendar DatePicker component matching app theme"
```

---

### Task 2: Wire `DatePicker` into the Add Expense review screen, fix amount overlap

**Files:**
- Modify: `src/flows/AddSheet.tsx:377-381` (Date row), `src/flows/AddSheet.tsx:358-372` (Amount card), `src/flows/AddSheet.tsx:452-476` (`ReviewRow` component), `src/flows/AddSheet.tsx` imports and `ReviewPhase` state/JSX (add `DatePicker` usage)

**Interfaces:**
- Consumes: `DatePicker` from Task 1 — `{ visible: boolean; value: Date; onSelect: (date: Date) => void; onClose: () => void }`.

- [ ] **Step 1: Add the `DatePicker` import**

In `src/flows/AddSheet.tsx`, near the other component imports (around line 13-14):

```tsx
import { CategoryEditor } from '../components/CategoryEditor';
import { DatePicker } from '../components/DatePicker';
```

- [ ] **Step 2: Give `ReviewRow` an `onPress` escape hatch**

Replace the `ReviewRow` function (currently at the bottom of the file, `src/flows/AddSheet.tsx:452-476`):

```tsx
function ReviewRow({ label, value, onEdit, onPress, muted, last }: { label: string; value: string; onEdit?: (v: string) => void; onPress?: () => void; muted?: boolean; last?: boolean }) {
  const C = useTheme();
  const [editing, setEditing] = useState(false);

  return (
    <TouchableOpacity onPress={() => (onPress ? onPress() : setEditing(true))} style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 14, paddingHorizontal: 16,
      borderBottomWidth: last ? 0 : 0.5, borderBottomColor: C.hair,
    }}>
      <Text style={{ fontSize: 13, color: C.muted }}>{label}</Text>
      {editing && onEdit && !onPress ? (
        <TextInput
          value={value}
          onChangeText={onEdit}
          onBlur={() => setEditing(false)}
          autoFocus
          style={{ fontSize: 14, color: C.cream, textAlign: 'right', minWidth: 120 }}
        />
      ) : (
        <Text style={{ fontSize: 14, color: muted ? C.muted : C.cream }}>{value || '—'}</Text>
      )}
    </TouchableOpacity>
  );
}
```

This is additive: existing callers (`Merchant`, `Notes` rows) pass `onEdit` and no `onPress`, so their text-editing behavior is unchanged.

- [ ] **Step 3: Add `datePickerVisible` state in `ReviewPhase`**

In `ReviewPhase`, near the other `useState` declarations (around line 279-282, after the `dateDisplay` state):

```tsx
const [datePickerVisible, setDatePickerVisible] = useState(false);
```

- [ ] **Step 4: Replace the Date row to open the picker instead of text-editing**

Replace this block (`src/flows/AddSheet.tsx:377-381`):

```tsx
          <ReviewRow label="Date" value={dateDisplay} onEdit={(v) => {
            setDateDisplay(v);
            const d = new Date(v);
            if (!isNaN(d.getTime())) setDateISO(d.toISOString());
          }}/>
```

with:

```tsx
          <ReviewRow label="Date" value={dateDisplay} onPress={() => setDatePickerVisible(true)}/>
```

- [ ] **Step 5: Render `DatePicker` alongside `CategoryEditor`**

In `ReviewPhase`'s JSX, right after the `<CategoryEditor .../>` block (around line 442-447):

```tsx
      <CategoryEditor
        visible={editorVisible}
        initial={editorInitial}
        onSave={handleEditorSave}
        onCancel={() => setEditorVisible(false)}
      />

      <DatePicker
        visible={datePickerVisible}
        value={new Date(dateISO)}
        onSelect={(d) => {
          setDateISO(d.toISOString());
          setDateDisplay(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
        }}
        onClose={() => setDatePickerVisible(false)}
      />
```

- [ ] **Step 6: Fix the amount label/input overlap**

In the "Amount" `Card` (`src/flows/AddSheet.tsx:358-372`), change the row's `marginTop` from `4` to `14`:

```tsx
        <Card style={{ padding: 20, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Amount</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 14 }}>
            <Text style={{ fontSize: 16, color: C.muted, lineHeight: 52 }}>$</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={{ fontFamily: C.fonts.serif, fontSize: 52, lineHeight: 52, color: C.cream, flex: 1 }}
              placeholderTextColor={C.muted}
              placeholder="0.00"
            />
            <Text style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>USD</Text>
          </View>
        </Card>
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors referencing `src/flows/AddSheet.tsx`.

- [ ] **Step 8: Manual verification in the iOS Simulator**

Reload the app (full quit + relaunch, or Metro `/reload` if a clean reload — see prior session notes on `auth/already-initialized` if using fast-refresh on this file's module scope; a plain Fast Refresh is fine here since no Firebase module-level code changed).

1. Open Add Expense → "Enter manually" → reach the review screen.
2. Confirm the "AMOUNT" label and the big amount number no longer overlap — there should be a clear gap.
3. Tap the "Date" row. Confirm a bottom sheet opens showing a month calendar grid styled like the rest of the app (dark `bgElev` background, serif month/year header, sage-filled selected day, rounded drag handle).
4. Tap the left/right chevrons and confirm the month label updates and the grid reflows correctly (correct day-of-week alignment, correct number of days for that month).
5. Tap a day. Confirm the sheet closes and the "Date" row's value updates to that day in `MMM D, YYYY` format.
6. Reopen the date picker and tap "Jump to today". Confirm it closes and the Date row shows today's date.
7. Complete the save flow (tap "Save expense") and confirm the expense saves with the selected date (check it appears in the right place in Activity/Home, since dates affect sorting/grouping).

- [ ] **Step 9: Commit**

```bash
git add src/flows/AddSheet.tsx
git commit -m "Wire calendar DatePicker into add-expense review screen, fix amount field overlap"
```
