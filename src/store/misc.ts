import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, uid } from '@/lib/storage';
import type { DateKey } from '@/lib/date';
import { deleteMedia } from '@/lib/media';

/* ---------- Humor (check-in da Home) ---------- */
interface MoodState {
  moods: Record<DateKey, number>;
  set: (day: DateKey, value: number) => void;
}
export const useMood = create<MoodState>()(
  persist((set) => ({ moods: {}, set: (day, value) => set((s) => ({ moods: { ...s.moods, [day]: value } })) }), { name: 'mood', storage }),
);

/* ---------- Metas ---------- */
export interface Goal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  deadline?: DateKey;
  createdAt: number;
  archived?: boolean;
  /** quanto os botões + e − somam (vazio: automático) */
  step?: number;
}
interface GoalsState {
  goals: Goal[];
  add: (g: Omit<Goal, 'id' | 'createdAt' | 'current'>) => void;
  bump: (id: string, delta: number) => void;
  update: (id: string, patch: Partial<Goal>) => void;
  remove: (id: string) => void;
}
export const useGoals = create<GoalsState>()(
  persist(
    (set) => ({
      goals: [],
      add: (g) => set((s) => ({ goals: [...s.goals, { ...g, current: 0, id: uid(), createdAt: Date.now() }] })),
      bump: (id, delta) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, current: Math.max(0, g.current + delta) } : g)) })),
      update: (id, patch) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      remove: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
    }),
    { name: 'goals', storage },
  ),
);

/* ---------- Notas ---------- */
export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  /** nomes das fotos (ver lib/media) */
  images?: string[];
  archived?: boolean;
  updatedAt: number;
}
interface NotesState {
  notes: Note[];
  create: () => string;
  update: (id: string, patch: Partial<Note>) => void;
  remove: (id: string) => void;
}
export const useNotes = create<NotesState>()(
  persist(
    (set) => ({
      notes: [],
      create: () => {
        const id = uid();
        set((s) => ({ notes: [{ id, title: '', body: '', pinned: false, updatedAt: Date.now() }, ...s.notes] }));
        return id;
      },
      update: (id, patch) => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)) })),
      remove: (id) =>
        set((s) => {
          s.notes.find((n) => n.id === id)?.images?.forEach(deleteMedia);
          return { notes: s.notes.filter((n) => n.id !== id) };
        }),
    }),
    { name: 'notes', storage },
  ),
);
