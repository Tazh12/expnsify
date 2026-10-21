import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONT_IDS, migratePalette, type PaletteId, type FontId } from '../theme';
import { useRates } from './useRates';

export type { FontId };

export interface Settings {
  palette: PaletteId;
  fontId: FontId;
  showRecap: boolean;
  autoCategories: boolean;
  receiptOcr: boolean;
  preferredCurrency: string;
  currencyPrompted: boolean;
  notifyBudget: boolean;
  budgetReminderDay: number;
  notifyDueDates: boolean;
  captureLocation: boolean;
}

const DEFAULTS: Settings = {
  palette: 'forest',
  fontId: 'default',
  showRecap: true,
  autoCategories: true,
  receiptOcr: true,
  preferredCurrency: 'USD',
  currencyPrompted: false,
  notifyBudget: true,
  budgetReminderDay: 1,
  notifyDueDates: true,
  captureLocation: false,
};

const KEY = '@tally:settings';

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

function snapshot(current: SettingsState): Settings {
  return {
    palette: current.palette,
    fontId: current.fontId,
    showRecap: current.showRecap,
    autoCategories: current.autoCategories,
    receiptOcr: current.receiptOcr,
    preferredCurrency: current.preferredCurrency,
    currencyPrompted: current.currencyPrompted,
    notifyBudget: current.notifyBudget,
    budgetReminderDay: current.budgetReminderDay,
    notifyDueDates: current.notifyDueDates,
    captureLocation: current.captureLocation,
  };
}

export const useSettings = create<SettingsState>((setState, get) => ({
  ...DEFAULTS,
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<Settings> & { accent?: unknown; palette?: unknown };
        const fontId = FONT_IDS.includes(saved.fontId as FontId)
          ? (saved.fontId as FontId)
          : DEFAULTS.fontId;
        const palette = migratePalette(saved.palette);
        const next: Settings = {
          ...DEFAULTS,
          ...saved,
          palette,
          fontId,
        };
        delete (next as { accent?: unknown }).accent;
        setState({ ...next, loaded: true });
        if (saved.palette !== palette || Object.prototype.hasOwnProperty.call(saved, 'accent')) {
          await AsyncStorage.setItem(KEY, JSON.stringify(next));
        }
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
      const toSave = { ...snapshot(get()), [key]: value };
      await AsyncStorage.setItem(KEY, JSON.stringify(toSave));
    } catch {}
  },
}));
