import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, uid } from '@/lib/storage';
import type { DateKey } from '@/lib/date';
import type { Priority } from '@/lib/parse';

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  priority?: Priority;
  tags: string[];
  due?: DateKey;
  time?: string;
  /** projeto do módulo Trabalho */
  projectId?: string;
  createdAt: number;
  doneAt?: number;
}

interface TasksState {
  tasks: Task[];
  add: (t: Omit<Task, 'id' | 'createdAt' | 'status'> & { status?: TaskStatus }) => void;
  update: (id: string, patch: Partial<Task>) => void;
  setStatus: (id: string, status: TaskStatus) => void;
  toggleDone: (id: string) => void;
  remove: (id: string) => void;
}

export const useTasks = create<TasksState>()(
  persist(
    (set) => ({
      tasks: [],
      add: (t) =>
        set((s) => ({
          tasks: [{ status: 'todo', ...t, id: uid(), createdAt: Date.now() }, ...s.tasks],
        })),
      update: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      setStatus: (id, status) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, status, doneAt: status === 'done' ? Date.now() : undefined } : t,
          ),
        })),
      toggleDone: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? t.status === 'done'
                ? { ...t, status: 'todo', doneAt: undefined }
                : { ...t, status: 'done', doneAt: Date.now() }
              : t,
          ),
        })),
      remove: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
    }),
    { name: 'tasks', storage },
  ),
);

const PRIO_ORDER = { alta: 0, media: 1, baixa: 2 } as const;

export function sortTasks(a: Task, b: Task) {
  const pa = a.priority ? PRIO_ORDER[a.priority] : 3;
  const pb = b.priority ? PRIO_ORDER[b.priority] : 3;
  if (pa !== pb) return pa - pb;
  return (a.time ?? '99').localeCompare(b.time ?? '99');
}
