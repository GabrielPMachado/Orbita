import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';
import type { AccentName, IconStyle, IconTone } from '@/theme';

interface SettingsState {
  name: string;
  /** foto de perfil (nome em lib/media) */
  avatar?: string;
  /** nome de uma cor pronta ou um hex (#RRGGBB) adicionado por você */
  accent: AccentName | string;
  /** cores que você adicionou */
  customColors: string[];
  /** intensidade da cor no app, 0–11 (a roda das Configurações) */
  intensity: number;
  iconStyle: IconStyle;
  /** ícone do app na tela inicial */
  appIconLook: 'grafite' | 'cor' | 'claro' | 'contorno' | 'mono';
  appIconColor: 'Carmim' | 'Ambar' | 'Azul' | 'Menta' | 'Lima' | 'Verde';
  /** o ícone do app acompanha a cor escolhida no app */
  appIconFollows: boolean;
  setAppIcon: (p: Partial<Pick<SettingsState, 'appIconLook' | 'appIconColor' | 'appIconFollows'>>) => void;
  iconTone: IconTone;
  addColor: (hex: string) => void;
  removeColor: (hex: string) => void;
  setIntensity: (n: number) => void;
  setIconStyle: (s: IconStyle) => void;
  setIconTone: (t: IconTone) => void;
  /** módulos desligados (por padrão todos ligados) */
  disabled: string[];
  /** esconde os valores no widget da tela de bloqueio */
  widgetHidden: boolean;
  setWidgetHidden: (v: boolean) => void;
  setName: (name: string) => void;
  setAvatar: (avatar?: string) => void;
  setAccent: (a: AccentName | string) => void;
  toggleModule: (id: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      name: '',
      accent: 'carmim',
      customColors: [],
      intensity: 4,
      iconStyle: 'suave',
      appIconLook: 'grafite',
      appIconColor: 'Carmim',
      appIconFollows: true,
      setAppIcon: (p) => set(p),
      iconTone: 'colorido',
      addColor: (hex) => set((s) => ({ customColors: [...s.customColors.filter((x) => x !== hex), hex].slice(-12), accent: hex })),
      removeColor: (hex) => set((s) => ({ customColors: s.customColors.filter((x) => x !== hex), accent: s.accent === hex ? 'carmim' : s.accent })),
      setIntensity: (intensity) => set({ intensity: Math.max(0, Math.min(11, Math.round(intensity))) }),
      setIconStyle: (iconStyle) => set({ iconStyle }),
      setIconTone: (iconTone) => set({ iconTone }),
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
