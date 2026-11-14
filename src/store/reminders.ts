import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, uid } from '@/lib/storage';
import { cancel, schedule, type Repeat } from '@/lib/notifications';

export interface Reminder {
  id: string;
  title: string;
  at: number; // timestamp
  repeat: Repeat;
  done: boolean;
  notificationId?: string;
}

interface RemindersState {
  reminders: Reminder[];
  add: (title: string, at: Date, repeat: Repeat) => Promise<boolean>;
  toggleDone: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useReminders = create<RemindersState>()(
  persist(
    (set, get) => ({
      reminders: [],
      add: async (title, at, repeat) => {
        const notificationId = await schedule(title, at, repeat).catch(() => undefined);
        set((s) => ({
          reminders: [...s.reminders, { id: uid(), title, at: at.getTime(), repeat, done: false, notificationId }].sort(
            (a, b) => a.at - b.at,
          ),
        }));
        return !!notificationId;
      },
      toggleDone: async (id) => {
        const r = get().reminders.find((x) => x.id === id);
        if (!r) return;
        let notificationId = r.notificationId;
        if (!r.done) {
          await cancel(r.notificationId);
          notificationId = undefined;
        } else {
          notificationId = await schedule(r.title, new Date(r.at), r.repeat).catch(() => undefined);
        }
        set((s) => ({
          reminders: s.reminders.map((x) => (x.id === id ? { ...x, done: !x.done, notificationId } : x)),
        }));
      },
      remove: async (id) => {
        await cancel(get().reminders.find((x) => x.id === id)?.notificationId);
        set((s) => ({ reminders: s.reminders.filter((x) => x.id !== id) }));
      },
    }),
    { name: 'reminders', storage },
  ),
);
