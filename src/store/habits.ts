import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, uid } from '@/lib/storage';
import { addDays, fromKey, toKey, type DateKey } from '@/lib/date';

export interface Habit {
  id: string;
  name: string;
  /** chave de HABIT_ICONS */
  icon: string;
  /** dias da semana (0 = domingo). Vazio = todos os dias */
  days: number[];
  log: Record<DateKey, true>;
  createdAt: number;
  archived?: boolean;
}

interface HabitsState {
  habits: Habit[];
  add: (h: Pick<Habit, 'name' | 'icon' | 'days'>) => void;
  toggle: (id: string, day: DateKey) => void;
  update: (id: string, patch: Partial<Habit>) => void;
  remove: (id: string) => void;
}

export const useHabits = create<HabitsState>()(
  persist(
    (set) => ({
      habits: [],
      add: (h) => set((s) => ({ habits: [...s.habits, { ...h, id: uid(), log: {}, createdAt: Date.now() }] })),
      toggle: (id, day) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h;
            const log = { ...h.log };
            if (log[day]) delete log[day];
            else log[day] = true;
            return { ...h, log };
          }),
        })),
      update: (id, patch) => set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
      remove: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),
    }),
    { name: 'habits', storage },
  ),
);

export const isScheduled = (h: Habit, day: DateKey) => h.days.length === 0 || h.days.includes(fromKey(day).getDay());

/** Sequência de dias agendados cumpridos (hoje conta se já foi feito; senão começa de ontem). */
export function streak(h: Habit): number {
  let d = new Date();
  let n = 0;
  if (!h.log[toKey(d)]) d = addDays(d, -1);
  for (let i = 0; i < 400; i++) {
    const k = toKey(d);
    if (isScheduled(h, k)) {
      if (h.log[k]) n++;
      else break;
    }
    d = addDays(d, -1);
  }
  return n;
}
