import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@tally:onboardingSeen';

interface OnboardingState {
  loaded: boolean;
  seen: boolean;
  load: () => Promise<void>;
  markSeen: () => void;
}

export const useOnboarding = create<OnboardingState>((set, get) => ({
  loaded: false,
  seen: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      set({ seen: raw === '1', loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  markSeen: () => {
    if (get().seen) return;
    set({ seen: true });
    AsyncStorage.setItem(KEY, '1').catch(() => {});
  },
}));
