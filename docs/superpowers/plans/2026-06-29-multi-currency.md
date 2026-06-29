# Multi-Currency Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users log expenses in any currency; app converts to a preferred currency for all totals, charts, and reports using ECB rates from `frankfurter.app`, cached on-device and refreshed twice daily.

**Architecture:** `useRates` Zustand store fetches `https://api.frankfurter.app/latest?from={base}` and caches in AsyncStorage. All aggregates (`byCategory`, `byWeek`, `total`) call `useRates.getState().convert()` per expense. No schema changes — `Expense.amount` stays as original amount in `Expense.currency`. Preferred currency lives in `useSettings`.

**Tech Stack:** Expo SDK 54 · React Native · Zustand 5 · Firebase Firestore · AsyncStorage · expo-localization · `frankfurter.app` (free, no key) · `Intl.NumberFormat`

## Global Constraints

- No API key required — frankfurter.app is free and keyless
- `Expense.amount` = original amount in original `Expense.currency` — never overwrite these
- `convert(amount, fromCurrency)` returns `amount` unchanged when `fromCurrency === base` or when rate is missing (graceful offline fallback)
- All `fmt()` callers must pass `preferredCurrency` — never hardcode `'USD'`
- Stale = rates older than 6 hours (STALE_MS = `6 * 60 * 60 * 1000`)
- Only currencies in `FRANKFURTER_CURRENCIES` are supported (hardcoded list of 31)
- This project has no test runner — verification steps are manual via `npx expo start`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| **Create** | `src/store/useRates.ts` | Fetch, cache, expose `convert()` |
| **Create** | `src/components/CurrencyPicker.tsx` | Reusable currency picker bottom sheet |
| **Modify** | `src/services/format.ts` | `fmt(n, currency?)` + `currencySymbol(code)` |
| **Modify** | `src/store/useSettings.ts` | Add `preferredCurrency`, `currencyPrompted` |
| **Modify** | `src/store/useExpenses.ts` | `byCategory`, `byWeek`, `total` use `convert()` |
| **Modify** | `App.tsx` | Init rates, AppState listener, first-launch modal |
| **Modify** | `src/screens/SettingsScreen.tsx` | Real currency picker + freshness indicator |
| **Modify** | `src/flows/AddSheet.tsx` | Per-expense currency picker + conversion hint |
| **Modify** | `src/screens/HomeScreen.tsx` | Hero total + donut use converted amounts |
| **Modify** | `src/screens/TxnDetailModal.tsx` | Show original + converted amounts |
| **Modify** | `src/screens/ActivityScreen.tsx` | Day totals in preferred currency |
| **Modify** | `src/screens/ReportsScreen.tsx` | All aggregates + `fmt()` use preferred currency |

---

## Task 1: `useRates` store, `fmt()` update, `CurrencyPicker` component

**Files:**
- Create: `src/store/useRates.ts`
- Create: `src/components/CurrencyPicker.tsx`
- Modify: `src/services/format.ts`
- Modify: `src/components/index.ts`

**Interfaces Produced:**
- `useRates` — `{ base: string; rates: Record<string,number>; fetchedAt: number|null; fetch(base): Promise<void>; convert(amount, fromCurrency): number; isStale(): boolean; loadCache(): Promise<void> }`
- `FRANKFURTER_CURRENCIES` — `readonly string[]` of 31 codes
- `fmt(n: number, currency?: string): string` — replaces existing, backward-compatible (defaults to `'USD'`)
- `currencySymbol(code: string): string` — returns `'$'` for `'USD'`, `'€'` for `'EUR'`, `'CHF'` for `'CHF'`, etc.
- `CurrencyPickerSheet` — `{ visible: boolean; current: string; onSelect(code): void; onClose(): void }`

- [ ] **Step 1: Install expo-localization**

```bash
npx expo install expo-localization
```

Expected: package added to `node_modules` and `package.json`.

- [ ] **Step 2: Create `src/store/useRates.ts`**

```typescript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@tally:rates';
const STALE_MS = 6 * 60 * 60 * 1000;

export const FRANKFURTER_CURRENCIES = [
  'AUD','BGN','BRL','CAD','CHF','CNY','CZK','DKK',
  'EUR','GBP','HKD','HUF','IDR','ILS','INR','ISK',
  'JPY','KRW','MXN','MYR','NOK','NZD','PHP','PLN',
  'RON','SEK','SGD','THB','TRY','USD','ZAR',
] as const;

export type CurrencyCode = (typeof FRANKFURTER_CURRENCIES)[number];

interface RatesState {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number | null;
  loadCache: () => Promise<void>;
  fetch: (base: string) => Promise<void>;
  convert: (amount: number, fromCurrency: string) => number;
  isStale: () => boolean;
}

export const useRates = create<RatesState>((set, get) => ({
  base: 'USD',
  rates: {},
  fetchedAt: null,

  loadCache: async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const { base, rates, fetchedAt } = JSON.parse(raw) as RatesState;
      set({ base, rates, fetchedAt });
    } catch {}
  },

  fetch: async (base: string) => {
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${base}`);
      if (!res.ok) return;
      const json = await res.json() as { base: string; rates: Record<string, number> };
      const fetchedAt = Date.now();
      set({ base: json.base, rates: json.rates, fetchedAt });
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ base: json.base, rates: json.rates, fetchedAt }));
    } catch {}
  },

  convert: (amount, fromCurrency) => {
    const { base, rates } = get();
    if (!fromCurrency || fromCurrency === base) return amount;
    const rate = rates[fromCurrency];
    if (!rate) return amount;
    return amount / rate;
  },

  isStale: () => {
    const { fetchedAt } = get();
    return !fetchedAt || Date.now() - fetchedAt > STALE_MS;
  },
}));
```

- [ ] **Step 3: Replace `src/services/format.ts`**

```typescript
export function fmt(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function currencySymbol(code: string): string {
  return (
    new Intl.NumberFormat('en-US', { style: 'currency', currency: code, minimumFractionDigits: 0 })
      .formatToParts(0)
      .find(p => p.type === 'currency')?.value ?? code
  );
}

export function dayLabel(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
```

- [ ] **Step 4: Create `src/components/CurrencyPicker.tsx`**

```typescript
import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';
import { Icon, Tap } from './index';
import { FRANKFURTER_CURRENCIES } from '../store/useRates';

const CURRENCY_NAMES: Record<string, string> = {
  AUD: 'Australian Dollar', BGN: 'Bulgarian Lev',   BRL: 'Brazilian Real',
  CAD: 'Canadian Dollar',   CHF: 'Swiss Franc',      CNY: 'Chinese Yuan',
  CZK: 'Czech Koruna',      DKK: 'Danish Krone',     EUR: 'Euro',
  GBP: 'British Pound',     HKD: 'Hong Kong Dollar', HUF: 'Hungarian Forint',
  IDR: 'Indonesian Rupiah', ILS: 'Israeli Shekel',   INR: 'Indian Rupee',
  ISK: 'Icelandic Krona',   JPY: 'Japanese Yen',     KRW: 'South Korean Won',
  MXN: 'Mexican Peso',      MYR: 'Malaysian Ringgit',NOK: 'Norwegian Krone',
  NZD: 'New Zealand Dollar',PHP: 'Philippine Peso',  PLN: 'Polish Zloty',
  RON: 'Romanian Leu',      SEK: 'Swedish Krona',    SGD: 'Singapore Dollar',
  THB: 'Thai Baht',         TRY: 'Turkish Lira',     USD: 'US Dollar',
  ZAR: 'South African Rand',
};

interface Props {
  visible: boolean;
  current: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export function CurrencyPickerSheet({ visible, current, onSelect, onClose }: Props) {
  const C = useTheme();
  const [q, setQ] = useState('');

  const filtered = FRANKFURTER_CURRENCIES.filter(
    code => q === '' ||
      code.toLowerCase().includes(q.toLowerCase()) ||
      CURRENCY_NAMES[code]?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint={C.isLight ? 'light' : 'dark'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}/>
        <View style={{
          backgroundColor: C.bgElev,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 0.5, borderColor: C.hairStrong,
          paddingTop: 12, maxHeight: '80%' as any,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.subtle, alignSelf: 'center', marginBottom: 16 }}/>

          {/* Header */}
          <View style={{ paddingHorizontal: 22, marginBottom: 12 }}>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream, marginBottom: 14 }}>
              Currency
            </Text>
            {/* Search */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
              borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
            }}>
              <Icon name="search" size={16} stroke={C.muted}/>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search currencies"
                placeholderTextColor={C.subtle}
                style={{ flex: 1, fontSize: 14, color: C.cream, fontFamily: C.fonts.regular }}
                autoCapitalize="characters"
              />
              {q.length > 0 && (
                <Tap onPress={() => setQ('')}>
                  <Icon name="x" size={14} stroke={C.muted}/>
                </Tap>
              )}
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}
          >
            {filtered.map((code, i) => {
              const on = code === current;
              return (
                <Tap
                  key={code}
                  onPress={() => { onSelect(code); onClose(); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingVertical: 14,
                    borderBottomWidth: i === filtered.length - 1 ? 0 : 0.5,
                    borderBottomColor: C.hair,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: on ? C.sage : C.cream, fontWeight: on ? '600' : '400' }}>
                      {code}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {CURRENCY_NAMES[code] ?? code}
                    </Text>
                  </View>
                  {on && <Icon name="check" size={16} stroke={C.sage} sw={2.2}/>}
                </Tap>
              );
            })}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
}
```

- [ ] **Step 5: Export from `src/components/index.ts`**

Add to the existing exports:
```typescript
export { CurrencyPickerSheet } from './CurrencyPicker';
```

- [ ] **Step 6: Verify manually**

Run `npx expo start`. The app should launch with no errors. No visual change yet.

- [ ] **Step 7: Commit**

```bash
git add src/store/useRates.ts src/components/CurrencyPicker.tsx src/services/format.ts src/components/index.ts
git commit -m "feat: add useRates store, CurrencyPickerSheet, update fmt() for multi-currency"
```

---

## Task 2: Extend `useSettings` with `preferredCurrency` + `currencyPrompted`

**Files:**
- Modify: `src/store/useSettings.ts`

**Interfaces:**
- Consumes: `useRates` from Task 1 — `useRates.getState().fetch(base)`
- Produces: `Settings.preferredCurrency: string`, `Settings.currencyPrompted: boolean`

- [ ] **Step 1: Update `src/store/useSettings.ts`**

Replace the full file:

```typescript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaletteId, AccentId, FontId } from '../theme';
import { useRates } from './useRates';

export type { FontId };

export interface Settings {
  palette: PaletteId;
  accent: AccentId;
  fontId: FontId;
  showRecap: boolean;
  autoCategories: boolean;
  receiptOcr: boolean;
  preferredCurrency: string;
  currencyPrompted: boolean;
}

const DEFAULTS: Settings = {
  palette: 'midnight',
  accent: 'sage',
  fontId: 'default',
  showRecap: true,
  autoCategories: true,
  receiptOcr: true,
  preferredCurrency: 'USD',
  currencyPrompted: false,
};

const KEY = '@tally:settings';

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

export const useSettings = create<SettingsState>((setState, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Settings>;
        setState({ ...DEFAULTS, ...saved, loaded: true });
      } else {
        setState({ loaded: true });
      }
    } catch {
      setState({ loaded: true });
    }
  },

  set: async (key, value) => {
    setState({ [key]: value } as Partial<SettingsState>);
    if (key === 'preferredCurrency') {
      useRates.getState().fetch(value as string);
    }
    try {
      const current = get();
      const toSave: Settings = {
        palette: current.palette,
        accent: current.accent,
        fontId: current.fontId,
        showRecap: current.showRecap,
        autoCategories: current.autoCategories,
        receiptOcr: current.receiptOcr,
        preferredCurrency: current.preferredCurrency,
        currencyPrompted: current.currencyPrompted,
        [key]: value,
      };
      await AsyncStorage.setItem(KEY, JSON.stringify(toSave));
    } catch {}
  },
}));
```

- [ ] **Step 2: Verify**

Run `npx expo start`. The app should still work identically. `settings.preferredCurrency` will be `'USD'` by default.

- [ ] **Step 3: Commit**

```bash
git add src/store/useSettings.ts
git commit -m "feat: add preferredCurrency and currencyPrompted to settings"
```

---

## Task 3: Wire conversion into `useExpenses` aggregates

**Files:**
- Modify: `src/store/useExpenses.ts`

**Interfaces:**
- Consumes: `useRates.getState().convert(amount, fromCurrency)` from Task 1
- Produces: `byCategory`, `byWeek`, `total` now return amounts in preferred currency

- [ ] **Step 1: Update `src/store/useExpenses.ts`**

Add the import at the top:
```typescript
import { useRates } from './useRates';
```

Replace the three aggregate functions:

```typescript
  byCategory: (expenses) => {
    const { convert } = useRates.getState();
    const totals: Record<string, number> = {};
    for (const t of (expenses ?? get().expenses)) {
      totals[t.category_id] = (totals[t.category_id] ?? 0) + convert(t.amount, t.currency);
    }
    return totals;
  },

  byWeek: (expenses) => {
    const { convert } = useRates.getState();
    const txns = expenses ?? get().expenses;
    const weeks: Record<number, number> = {};
    for (const t of txns) {
      const d = new Date(t.date);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const n = parseInt(key.replace(/-/g, ''), 10);
      weeks[n] = (weeks[n] ?? 0) + convert(t.amount, t.currency);
    }
    const sorted = Object.entries(weeks).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    return sorted.map(([, amount], i) => ({ label: `W${i + 1}`, amount }));
  },

  total: (expenses) => {
    const { convert } = useRates.getState();
    return (expenses ?? get().expenses).reduce((s, t) => s + convert(t.amount, t.currency), 0);
  },
```

- [ ] **Step 2: Verify**

Run `npx expo start`. Home screen totals, donut, and charts will now use conversion. With no rates fetched yet (first launch, fresh cache) they will show 1:1 (original amounts), which is correct fallback behavior.

- [ ] **Step 3: Commit**

```bash
git add src/store/useExpenses.ts
git commit -m "feat: useExpenses aggregates now convert amounts to preferred currency"
```

---

## Task 4: App.tsx — boot sequence, AppState listener, first-launch currency modal

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `useRates.loadCache()`, `useRates.fetch()`, `useRates.isStale()` from Task 1
- Consumes: `useSettings.preferredCurrency`, `useSettings.currencyPrompted`, `useSettings.loaded` from Task 2
- Consumes: `Localization.getLocales()` from `expo-localization`
- Consumes: `FRANKFURTER_CURRENCIES` from Task 1
- Consumes: `CurrencyPickerSheet` is NOT used here — the first-launch prompt is a simple Alert-style modal, not the picker sheet

- [ ] **Step 1: Update `App.tsx`**

Replace the full file:

```typescript
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StatusBar, Modal, SafeAreaView, ActivityIndicator,
  Image, AppState, TouchableOpacity,
} from 'react-native';
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import * as Localization from 'expo-localization';
import { BlurView } from 'expo-blur';
import { ThemeContext, buildTheme } from './src/theme';
import { useSettings } from './src/store/useSettings';
import { useRates, FRANKFURTER_CURRENCIES } from './src/store/useRates';
import { useCategories } from './src/store/useCategories';
import { useExpenses } from './src/store/useExpenses';
import { useAuth, onAuthStateChanged, firebaseAuth } from './src/store/useAuth';
import { Tap } from './src/components';

import { TabBar, type TabId } from './src/components/TabBar';
import { HomeScreen } from './src/screens/HomeScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import AuthScreen from './src/screens/AuthScreen';
import { AddSheet } from './src/flows/AddSheet';
import { RecapModal } from './src/flows/RecapModal';

export default function App() {
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  const settings = useSettings();
  const rates = useRates();
  const { setUser, setInitializing, initializing, user } = useAuth();
  const { subscribe: subCats, reset: resetCats } = useCategories();
  const { subscribe: subExp, reset: resetExp } = useExpenses();

  const unsubCats = useRef<(() => void) | null>(null);
  const unsubExp = useRef<(() => void) | null>(null);

  const [tab, setTab] = useState<TabId>('home');
  const [addOpen, setAddOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [localeCurrency, setLocaleCurrency] = useState<string | null>(null);

  // Boot: load settings → hydrate rate cache → fetch if stale
  useEffect(() => {
    (async () => {
      await settings.load();
      const { preferredCurrency } = useSettings.getState();
      await useRates.getState().loadCache();
      if (useRates.getState().isStale()) {
        useRates.getState().fetch(preferredCurrency);
      }
    })();
  }, []);

  // AppState: re-fetch rates when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useRates.getState().isStale()) {
        useRates.getState().fetch(useSettings.getState().preferredCurrency);
      }
    });
    return () => sub.remove();
  }, []);

  // First-launch currency detection
  useEffect(() => {
    if (!settings.loaded || settings.currencyPrompted || !user) return;
    try {
      const locales = Localization.getLocales();
      const code = locales[0]?.currencyCode;
      if (code && code !== 'USD' && (FRANKFURTER_CURRENCIES as readonly string[]).includes(code)) {
        setLocaleCurrency(code);
      } else {
        settings.set('currencyPrompted', true);
      }
    } catch {
      settings.set('currencyPrompted', true);
    }
  }, [settings.loaded, user]);

  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);

      if (firebaseUser) {
        unsubCats.current = subCats(firebaseUser.uid);
        unsubExp.current = subExp(firebaseUser.uid);
      } else {
        unsubCats.current?.();
        unsubExp.current?.();
        unsubCats.current = null;
        unsubExp.current = null;
        resetCats();
        resetExp();
      }
    });
    return unsub;
  }, []);

  const theme = buildTheme(settings.palette, settings.accent, settings.fontId);
  const isLight = settings.palette === 'cream';

  if (!fontsLoaded || initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E0E0C', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#B8D4B0" />
      </View>
    );
  }

  if (!user) {
    return (
      <ThemeContext.Provider value={theme}>
        <StatusBar barStyle="light-content" backgroundColor="#0E0E0C" />
        <AuthScreen />
      </ThemeContext.Provider>
    );
  }

  const onChangeMonth = (delta: number) => {
    const m = new Date(month);
    m.setMonth(m.getMonth() + delta);
    setMonth(m);
  };

  const screen = (() => {
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            month={month}
            onChangeMonth={onChangeMonth}
            onOpenAdd={() => setAddOpen(true)}
            onOpenRecap={() => setRecapOpen(true)}
            onSeeAll={() => setTab('txns')}
          />
        );
      case 'txns':
        return <ActivityScreen />;
      case 'reports':
        return <ReportsScreen onOpenRecap={() => setRecapOpen(true)} />;
      case 'settings':
        return <SettingsScreen onOpenCategories={() => setCatsOpen(true)} />;
    }
  })();

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={theme.bg} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <SafeAreaView style={{ backgroundColor: theme.bg }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingVertical: 8,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={require('./assets/app-icon-transparent.png')}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.cream, letterSpacing: 0.02 }}>
                expnsify
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>
              ✦ AI · on
            </Text>
          </View>
        </SafeAreaView>

        <View style={{ flex: 1 }}>
          {screen}
        </View>

        <TabBar tab={tab} onTab={setTab} onAdd={() => setAddOpen(true)} />

        <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
        <RecapModal open={recapOpen} onClose={() => setRecapOpen(false)} />

        <Modal visible={catsOpen} animationType="slide" presentationStyle="fullScreen">
          <ThemeContext.Provider value={theme}>
            <CategoriesScreen onClose={() => setCatsOpen(false)} />
          </ThemeContext.Provider>
        </Modal>

        {/* First-launch currency prompt */}
        <Modal visible={!!localeCurrency} transparent animationType="fade">
          <BlurView intensity={60} tint={isLight ? 'light' : 'dark'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{
              backgroundColor: theme.bgElev,
              borderRadius: 24, padding: 24, width: '100%',
              borderWidth: 0.5, borderColor: theme.hairStrong,
              gap: 12,
            }}>
              <Text style={{ fontFamily: theme.fonts.serif, fontSize: 26, color: theme.cream, lineHeight: 30 }}>
                Welcome to{' '}
                <Text style={{ fontStyle: 'italic' }}>expnsify</Text>
              </Text>
              <Text style={{ fontSize: 14, color: theme.muted, lineHeight: 20 }}>
                Your device is set to{' '}
                <Text style={{ color: theme.cream }}>{localeCurrency}</Text>.
                {' '}Use it as your preferred currency?
              </Text>
              <Tap
                haptic
                onPress={() => {
                  settings.set('preferredCurrency', localeCurrency!);
                  settings.set('currencyPrompted', true);
                  setLocaleCurrency(null);
                }}
                style={{
                  backgroundColor: theme.sage, borderRadius: 14,
                  paddingVertical: 14, alignItems: 'center', marginTop: 4,
                }}
              >
                <Text style={{ color: '#0E0E0C', fontWeight: '600', fontSize: 15 }}>
                  Yes, use {localeCurrency}
                </Text>
              </Tap>
              <TouchableOpacity
                onPress={() => {
                  settings.set('currencyPrompted', true);
                  setLocaleCurrency(null);
                }}
                style={{ paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: theme.muted, fontSize: 14 }}>Not now, keep USD</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Modal>
      </View>
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 2: Verify**

Run `npx expo start`. The app should:
- Load without errors
- On a device with non-USD locale (or simulator with region changed), show the currency prompt on first login
- Rates should fetch in background (verify by checking the network tab in Expo Dev Tools or adding a temporary `console.log` in `useRates.fetch`)

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat: init exchange rates on boot, AppState refresh, first-launch currency prompt"
```

---

## Task 5: Settings screen — real currency picker + freshness indicator

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `useSettings.preferredCurrency`, `useSettings.set('preferredCurrency', ...)` from Task 2
- Consumes: `useRates.fetchedAt` from Task 1
- Consumes: `CurrencyPickerSheet` from Task 1

- [ ] **Step 1: Update `src/screens/SettingsScreen.tsx`**

Add imports at the top (after existing imports):
```typescript
import { useRates } from '../store/useRates';
import { CurrencyPickerSheet } from '../components/CurrencyPicker';
```

Add state for the picker inside `SettingsScreen`:
```typescript
const rates = useRates();
const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
```

Replace the "Base currency" `SettingsRow` stub (currently line 299: `onPress={() => Alert.alert('Coming in v1.1')}`):
```tsx
<SettingsRow
  icon={<Icon name="wallet" size={18} stroke={C.cream}/>}
  label="Base currency"
  detail={settings.preferredCurrency}
  onPress={() => setCurrencyPickerOpen(true)}
/>
```

Add the freshness text after that row, inside the `Card`, before Categories:
```tsx
{rates.fetchedAt && (
  <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
    <Text style={{ fontSize: 11, color: C.subtle }}>
      Rates updated {ratesAge(rates.fetchedAt)}
    </Text>
  </View>
)}
```

Add the helper function `ratesAge` inside the file (before the component or as a module-level function):
```typescript
function ratesAge(fetchedAt: number): string {
  const mins = Math.round((Date.now() - fetchedAt) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}
```

Add the `CurrencyPickerSheet` just before the closing `</>` of the component return:
```tsx
<CurrencyPickerSheet
  visible={currencyPickerOpen}
  current={settings.preferredCurrency}
  onSelect={(code) => settings.set('preferredCurrency', code)}
  onClose={() => setCurrencyPickerOpen(false)}
/>
```

- [ ] **Step 2: Verify**

Run `npx expo start`. Go to Settings → tap "Base currency" → currency list appears with search → selecting a currency updates the row label and triggers a rate re-fetch.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: settings currency picker with rate freshness indicator"
```

---

## Task 6: AddSheet — per-expense currency picker + conversion hint

**Files:**
- Modify: `src/flows/AddSheet.tsx`

**Interfaces:**
- Consumes: `useSettings.preferredCurrency` from Task 2
- Consumes: `useRates.getState().convert()` from Task 1
- Consumes: `FRANKFURTER_CURRENCIES` from Task 1
- Consumes: `fmt(n, currency)` from Task 1
- Consumes: `CurrencyPickerSheet` from Task 1
- Produces: `Expense.currency` is set to user's chosen currency on save (not hardcoded `'USD'`)

- [ ] **Step 1: Update imports in `src/flows/AddSheet.tsx`**

Add to existing imports:
```typescript
import { useSettings } from '../store/useSettings';
import { useRates, FRANKFURTER_CURRENCIES } from '../store/useRates';
import { fmt, currencySymbol } from '../services/format';
import { CurrencyPickerSheet } from '../components/CurrencyPicker';
```

(Remove `uid` from the format import if it was there separately — it stays in `format.ts`.)

- [ ] **Step 2: Update `ReviewPhase` state + initialization**

In `ReviewPhase`, add after existing state declarations:
```typescript
const { preferredCurrency } = useSettings.getState();
const { convert } = useRates.getState();

const [currencyCode, setCurrencyCode] = useState(() => {
  const scannedCurrency = scanned?.currency;
  if (scannedCurrency && (FRANKFURTER_CURRENCIES as readonly string[]).includes(scannedCurrency)) {
    return scannedCurrency;
  }
  return editExpense?.currency ?? preferredCurrency;
});
const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
```

- [ ] **Step 3: Update the amount card in `ReviewPhase`**

Find the amount `Card` block (lines ~484–498 in original). Replace it with:

```tsx
{/* Amount */}
<Card style={{ padding: 20, marginBottom: 12 }}>
  <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Amount</Text>
  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 20 }}>
    <Text style={{ fontSize: 16, color: C.muted, lineHeight: 64 }}>
      {currencySymbol(currencyCode)}
    </Text>
    <TextInput
      value={amount}
      onChangeText={setAmount}
      keyboardType="decimal-pad"
      style={{ fontFamily: C.fonts.serif, fontSize: 52, lineHeight: 64, color: C.cream, flex: 1 }}
      placeholderTextColor={C.muted}
      placeholder="0.00"
    />
    <Tap onPress={() => setCurrencyPickerOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 }}>
      <Text style={{ fontSize: 13, color: C.muted }}>{currencyCode}</Text>
      <Icon name="chev-r" size={11} stroke={C.muted}/>
    </Tap>
  </View>
  {/* Conversion hint */}
  {currencyCode !== preferredCurrency && !!amount && parseFloat(amount) > 0 && (
    <Text style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
      ≈ {fmt(convert(parseFloat(amount) || 0, currencyCode), preferredCurrency)}
    </Text>
  )}
</Card>
```

- [ ] **Step 4: Update `handleSave` to use `currencyCode`**

In `handleSave`, find the `addExpense` call and update:
```typescript
// Change: currency: scanned?.currency ?? 'USD',
// To:
currency: currencyCode,
```

For `updateExpense`, add `currency: currencyCode` to the patch object:
```typescript
await updateExpense(editExpense.id, {
  merchant: merchant || 'Unknown',
  category_id: selectedCatId ?? 'other',
  amount: parseFloat(amount) || 0,
  currency: currencyCode,
  date: dateISO,
  note: note || null,
});
```

- [ ] **Step 5: Add `CurrencyPickerSheet` at the bottom of the `ReviewPhase` return**

Just before the closing `</KeyboardAvoidingView>`:
```tsx
<CurrencyPickerSheet
  visible={currencyPickerOpen}
  current={currencyCode}
  onSelect={setCurrencyCode}
  onClose={() => setCurrencyPickerOpen(false)}
/>
```

- [ ] **Step 6: Verify**

Run `npx expo start`. Open the add sheet → Enter manually → In the amount card, tap the currency badge → picker opens → select CHF → see `≈ $X.XX USD` hint below the amount as you type.

- [ ] **Step 7: Commit**

```bash
git add src/flows/AddSheet.tsx
git commit -m "feat: per-expense currency picker with live conversion hint in AddSheet"
```

---

## Task 7: Display layer — HomeScreen, TxnRow, TxnDetailModal, ActivityScreen, ReportsScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/screens/TxnDetailModal.tsx`
- Modify: `src/screens/ActivityScreen.tsx`
- Modify: `src/screens/ReportsScreen.tsx`

**Interfaces:**
- Consumes: `useRates.getState().convert()` from Task 1
- Consumes: `useSettings.getState().preferredCurrency` from Task 2
- Consumes: `fmt(n, currency)`, `currencySymbol(code)` from Task 1

### HomeScreen

- [ ] **Step 1: Update imports in `src/screens/HomeScreen.tsx`**

Add:
```typescript
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { currencySymbol } from '../services/format';
```

- [ ] **Step 2: Update computed values in `HomeScreen`**

Replace:
```typescript
const total = txns.reduce((s, t) => s + t.amount, 0);
```
With:
```typescript
const { convert } = useRates();
const { preferredCurrency } = useSettings();
const total = txns.reduce((s, t) => s + convert(t.amount, t.currency), 0);
```

- [ ] **Step 3: Update hero currency symbol in `HomeScreen`**

Find the hardcoded `$` in the hero section (the `<Text>` with `fontSize: 18, color: C.muted, lineHeight: 72`):
```tsx
// Replace:
<Text style={{ fontFamily: C.fonts.serif, fontSize: 18, color: C.muted, lineHeight: 72 }}>$</Text>
// With:
<Text style={{ fontFamily: C.fonts.serif, fontSize: 18, color: C.muted, lineHeight: 72 }}>
  {currencySymbol(preferredCurrency)}
</Text>
```

- [ ] **Step 4: Update `DonutCard` center label**

In `DonutCard`, the center shows `fmt(focus ? focus.value : top?.value ?? 0)`. The `slices` values come from `byCategory` which is already converted (Task 3). Update the `fmt` call:
```tsx
// Replace:
{fmt(focus ? focus.value : top?.value ?? 0)}
// With:
{fmt(focus ? focus.value : top?.value ?? 0, preferredCurrency)}
```

Pass `preferredCurrency` as a prop to `DonutCard`:
```tsx
// DonutCard signature:
function DonutCard({ slices, total, preferredCurrency }: {
  slices: { id: string; value: number; color: string; name: string }[];
  total: number;
  preferredCurrency: string;
})

// Call site (in HomeScreen):
{slices.length > 0 && <DonutCard slices={slices} total={total} preferredCurrency={preferredCurrency}/>}
```

- [ ] **Step 5: Update `TxnRow` to show converted amount + original currency hint**

`TxnRow` is defined in `HomeScreen.tsx`. Add store reads at the top of the function body:
```typescript
const { convert } = useRates.getState();
const { preferredCurrency } = useSettings.getState();
const convertedAmount = convert(t.amount, t.currency ?? 'USD');
const showOriginal = !!t.currency && t.currency !== preferredCurrency;
```

Replace the amount display block (currently `{fmt(t.amount)}`):
```tsx
<View style={{ alignItems: 'flex-end' }}>
  <Text style={{ fontSize: 15, color: C.cream, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
    {fmt(convertedAmount, preferredCurrency)}
  </Text>
  {showOriginal && (
    <Text style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
      {t.currency} {t.amount.toFixed(2)}
    </Text>
  )}
  <Text style={{ fontSize: 11, color: C.muted, marginTop: showOriginal ? 0 : 2 }}>{fmtTime(t.date)}</Text>
</View>
```

### TxnDetailModal

- [ ] **Step 6: Update `src/screens/TxnDetailModal.tsx`**

Add imports:
```typescript
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
```

In `TxnDetailModal`, before the return, add:
```typescript
const { convert } = useRates.getState();
const { preferredCurrency } = useSettings.getState();
const convertedAmount = convert(t.amount, t.currency ?? 'USD');
const showOriginal = !!t.currency && t.currency !== preferredCurrency;
```

Replace the merchant + amount block (currently lines ~87–96):
```tsx
<Text
  style={{ fontFamily: C.fonts.serif, fontSize: 30, color: C.cream, lineHeight: 34, letterSpacing: -0.4 }}
  numberOfLines={2}
>
  {t.merchant}
</Text>
<Text style={{ fontFamily: C.fonts.serif, fontSize: 40, color: C.cream, marginTop: 6, letterSpacing: -1 }}>
  {fmt(convertedAmount, preferredCurrency)}
  <Text style={{ fontSize: 18, color: C.muted }}> {preferredCurrency}</Text>
</Text>
{showOriginal && (
  <Text style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
    Originally {t.currency} {t.amount.toFixed(2)}
  </Text>
)}
```

### ActivityScreen

- [ ] **Step 7: Update day totals in `src/screens/ActivityScreen.tsx`**

Add imports:
```typescript
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
```

At the **component level** (after the existing store reads near the top of `ActivityScreen`), add:
```typescript
const { convert } = useRates();           // subscribe so screen re-renders when rates update
const { preferredCurrency } = useSettings();
```

Inside the grouped render (the `.map(([day, items]) => {` block), replace:
```typescript
// Replace:
const dayTotal = items.reduce((a, b) => a + b.amount, 0);
// With:
const dayTotal = items.reduce((a, b) => a + convert(b.amount, b.currency ?? 'USD'), 0);
```

Update `fmt(dayTotal)` to `fmt(dayTotal, preferredCurrency)`.

### ReportsScreen

- [ ] **Step 8: Update `src/screens/ReportsScreen.tsx`**

Add imports:
```typescript
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
```

**Update `sumInRange`** — add conversion:
```typescript
function sumInRange(
  expenses: ReturnType<typeof useExpenses.getState>['expenses'],
  start: Date,
  end: Date,
  cats: string[],
): number {
  const { convert } = useRates.getState();
  return expenses
    .filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end && (cats.length === 0 || cats.includes(t.category_id));
    })
    .reduce((s, t) => s + convert(t.amount, t.currency), 0);
}
```

**Inside `ReportsScreen` component**, add after existing store reads:
```typescript
const { convert } = useRates();
const { preferredCurrency } = useSettings();
```

**Update `catTotals` useMemo**:
```typescript
const catTotals = useMemo(() =>
  filtered.reduce<Record<string, number>>((acc, t) => {
    acc[t.category_id] = (acc[t.category_id] ?? 0) + convert(t.amount, t.currency); return acc;
  }, {}),
  [filtered, convert],
);
```

**Update `topCatIds` useMemo**:
```typescript
const topCatIds = useMemo(() =>
  Object.entries(
    dateFiltered.reduce<Record<string, number>>((acc, t) => {
      acc[t.category_id] = (acc[t.category_id] ?? 0) + convert(t.amount, t.currency); return acc;
    }, {}),
  )
  .sort((a, b) => b[1] - a[1])
  .slice(0, 3)
  .map(([id]) => id),
  [dateFiltered, convert],
);
```

**Update `total`**:
```typescript
const total = filtered.reduce((s, t) => s + convert(t.amount, t.currency), 0);
```

**Update `catTotalsAll` in the `CategorySheet` call** (line ~510):
```tsx
catTotalsAll={dateFiltered.reduce<Record<string, number>>((acc, t) => {
  acc[t.category_id] = (acc[t.category_id] ?? 0) + convert(t.amount, t.currency); return acc;
}, {})}
```

**Update all `fmt()` calls** in `ReportsScreen`:
- `fmt(total)` → `fmt(total, preferredCurrency)` (line ~358)
- `fmt(val)` → `fmt(val, preferredCurrency)` (line ~472, in "By category" section)
- `fmt(amt)` → `fmt(amt, preferredCurrency)` (line ~731, in `CategorySheet`)
- Bar chart label (line ~424): `fmt(bar.amount)` → `fmt(bar.amount, preferredCurrency)` (also remove the `.replace('$', '$')` since Intl handles formatting now)

- [ ] **Step 9: Full manual verification**

Run `npx expo start` and verify:

1. **Home screen:** Hero total shows correct symbol for preferred currency. Expense rows show converted amount + original currency hint for foreign expenses.
2. **Add sheet:** Enter a CHF amount while preferred is USD → see `≈ $X.XX USD` hint → save → row shows USD equivalent with `CHF XX.XX` below it.
3. **Settings → Base currency:** Change from USD to EUR → all amounts on Home screen update immediately.
4. **First launch (fresh install / cleared AsyncStorage):** On a non-USD device locale, currency prompt appears. Accepting it sets preferred currency and the prompt never appears again.
5. **Transaction detail:** Tap a foreign-currency expense → see both converted and original amounts.
6. **Reports:** All totals and bar chart amounts reflect preferred currency.

- [ ] **Step 10: Commit**

```bash
git add src/screens/HomeScreen.tsx src/screens/TxnDetailModal.tsx src/screens/ActivityScreen.tsx src/screens/ReportsScreen.tsx
git commit -m "feat: all display layers show converted amounts in preferred currency"
```
