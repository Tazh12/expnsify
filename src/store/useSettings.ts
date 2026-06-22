import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaletteId, AccentId, FontId } from '../theme';

export type { FontId };

export interface Settings {
  palette: PaletteId;
  accent: AccentId;
  fontId: FontId;
  showRecap: boolean;
  autoCategories: boolean;
  receiptOcr: boolean;
}

const DEFAULTS: Settings = {
  palette: 'midnight',
  accent: 'sage',
  fontId: 'default',
  showRecap: true,
  autoCategories: true,
  receiptOcr: true,
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
    try {
      const current = get();
      const toSave: Settings = {
        palette: current.palette,
        accent: current.accent,
        fontId: current.fontId,
        showRecap: current.showRecap,
        autoCategories: current.autoCategories,
        receiptOcr: current.receiptOcr,
        [key]: value,
      };
      await AsyncStorage.setItem(KEY, JSON.stringify(toSave));
    } catch {}
  },
}));
