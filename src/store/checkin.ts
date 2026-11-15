import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DateKey } from '@/lib/date';
import { storage } from '@/lib/storage';

export interface CheckinEntry {
  /** 1–5 */
  energy?: number;
  intention?: string;
  done?: boolean;
}

interface CheckinState {
  enabled: boolean;
  /** último dia em que o check-in foi oferecido (feito ou pulado) */
  lastPrompt?: DateKey;
  entries: Record<DateKey, CheckinEntry>;
  setEnabled: (v: boolean) => void;
  markPrompted: (day: DateKey) => void;
  save: (day: DateKey, e: Partial<CheckinEntry>) => void;
}

export const useCheckin = create<CheckinState>()(
  persist(
    (set) => ({
      enabled: true,
      entries: {},
      setEnabled: (enabled) => set({ enabled }),
      markPrompted: (lastPrompt) => set({ lastPrompt }),
      save: (day, e) => set((s) => ({ entries: { ...s.entries, [day]: { ...s.entries[day], ...e } } })),
    }),
    { name: 'checkin', storage },
  ),
);
