import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';
import type { AccentName } from '@/theme';

interface SettingsState {
  name: string;
  /** foto de perfil (nome em lib/media) */
  avatar?: string;
  accent: AccentName;
  /** módulos desligados (por padrão todos ligados) */
  disabled: string[];
  /** esconde os valores no widget da tela de bloqueio */
  widgetHidden: boolean;
  setWidgetHidden: (v: boolean) => void;
  setName: (name: string) => void;
  setAvatar: (avatar?: string) => void;
  setAccent: (a: AccentName) => void;
  toggleModule: (id: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      name: '',
      accent: 'carmim',
      disabled: [],
      widgetHidden: false,
      setWidgetHidden: (widgetHidden) => set({ widgetHidden }),
      setName: (name) => set({ name }),
      setAvatar: (avatar) => set({ avatar }),
      setAccent: (accent) => set({ accent }),
      toggleModule: (id) =>
        set((s) => ({
          disabled: s.disabled.includes(id) ? s.disabled.filter((x) => x !== id) : [...s.disabled, id],
        })),
    }),
    { name: 'settings', storage },
  ),
);
