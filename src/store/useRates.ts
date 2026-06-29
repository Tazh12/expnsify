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
