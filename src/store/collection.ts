import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, uid } from '@/lib/storage';

/** Item mínimo de uma coleção. */
export interface Item {
  id: string;
  createdAt: number;
}

export interface CollectionState<T extends Item> {
  items: T[];
  add: (data: Omit<T, 'id' | 'createdAt'>) => string;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
  /** substitui tudo (usado por migrações e importação) */
  replace: (items: T[]) => void;
}

/**
 * Fábrica de stores persistidas para listas simples (clientes, filmes, matérias…).
 * Cada coleção vira uma chave própria no armazenamento do aparelho.
 */
export function createCollection<T extends Item>(name: string) {
  return create<CollectionState<T>>()(
    persist(
      (set) => ({
        items: [],
        add: (data) => {
          const id = uid();
          set((s) => ({ items: [{ ...(data as object), id, createdAt: Date.now() } as T, ...s.items] }));
          return id;
        },
        update: (id, patch) => set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
        remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
        replace: (items) => set({ items }),
      }),
      { name, storage },
    ),
  );
}
