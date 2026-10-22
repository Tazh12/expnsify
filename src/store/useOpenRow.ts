import { create } from 'zustand';

/**
 * Which swipe row is open. Only one is open at a time, and any touch outside it closes it.
 * A row marks `touchedId` on touch start; the screen's own touch start then sees whether the
 * touch landed inside the open row (both handlers run in the same event, child first).
 */
interface OpenRowState {
  openId: string | null;
  touchedId: string | null;
  setOpen: (id: string | null) => void;
  markTouch: (id: string) => void;
  closeIfOutside: () => void;
}

export const useOpenRow = create<OpenRowState>((set, get) => ({
  openId: null,
  touchedId: null,
  setOpen: (id) => set({ openId: id }),
  markTouch: (id) => set({ touchedId: id }),
  closeIfOutside: () => {
    const { openId, touchedId } = get();
    if (openId && touchedId !== openId) set({ openId: null, touchedId: null });
    else if (touchedId) set({ touchedId: null });
  },
}));
