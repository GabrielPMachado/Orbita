/**
 * Ícone do app na tela inicial: estilo × cor (expo-alternate-app-icons).
 * O padrão (grafite + carmim) é o ícone principal; o resto são ícones alternativos.
 * Só existe no app instalado; no Expo Go e na web nada acontece.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useSettings } from '@/store/settings';
import { resolveAccent } from '@/theme';
import { ICON_THUMBS } from './appIconThumbs';

export type IconLook = 'grafite' | 'cor' | 'claro' | 'contorno' | 'mono';
export const ICON_LOOKS: { key: IconLook; label: string }[] = [
  { key: 'grafite', label: 'Grafite' },
  { key: 'cor', label: 'Cor' },
  { key: 'claro', label: 'Claro' },
  { key: 'contorno', label: 'Contorno' },
  { key: 'mono', label: 'Mono' },
];
export const ICON_COLORS = [
  { key: 'Carmim', hex: '#F2415A' },
  { key: 'Ambar', hex: '#F5A524' },
  { key: 'Azul', hex: '#4C8DFF' },
  { key: 'Menta', hex: '#3DD6B0' },
  { key: 'Lima', hex: '#A3E635' },
  { key: 'Verde', hex: '#10B981' },
] as const;
export type IconColor = (typeof ICON_COLORS)[number]['key'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const iconName = (look: IconLook, color: IconColor) => (look === 'mono' ? 'Mono' : `${cap(look)}${color}`);
export const iconThumb = (look: IconLook, color: IconColor) => ICON_THUMBS[iconName(look, color)];
const nativeName = (look: IconLook, color: IconColor) => {
  const n = iconName(look, color);
  return n === 'GrafiteCarmim' ? null : n;
};

/** cor pronta mais próxima de um hex qualquer (para o ícone seguir a cor do app) */
export function nearestIconColor(hex: string): IconColor {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(hex);
  let best: IconColor = 'Carmim';
  let dist = Infinity;
  for (const c of ICON_COLORS) {
    const [R, G, B] = rgb(c.hex);
    const d = (r - R) ** 2 * 2 + (g - G) ** 2 * 4 + (b - B) ** 2 * 3;
    if (d < dist) {
      dist = d;
      best = c.key;
    }
  }
  return best;
}

type Mod = { supportsAlternateIcons: boolean; setAlternateAppIcon: (n: string | null) => Promise<string | null>; getAppIconName: () => string | null };
let mod: Mod | null | undefined;
function load(): Mod | null {
  if (mod !== undefined) return mod;
  if (Platform.OS !== 'ios') return (mod = null);
  try {
    mod = require('expo-alternate-app-icons') as Mod;
  } catch {
    mod = null;
  }
  return mod;
}

export const appIconsAvailable = () => !!load()?.supportsAlternateIcons;

export function currentAppIcon(): { look: IconLook; color: IconColor } {
  const n = load()?.getAppIconName?.() ?? null;
  if (!n) return { look: 'grafite', color: 'Carmim' };
  if (n === 'Mono') return { look: 'mono', color: 'Carmim' };
  const look = ICON_LOOKS.find((l) => n.startsWith(cap(l.key)))?.key ?? 'grafite';
  const color = (ICON_COLORS.find((c) => n.endsWith(c.key))?.key ?? 'Carmim') as IconColor;
  return { look, color };
}

let last: string | null | undefined;
export async function setAppIcon(look: IconLook, color: IconColor) {
  const m = load();
  if (!m?.supportsAlternateIcons) throw new Error('A troca de ícone só funciona no app instalado.');
  const n = nativeName(look, color);
  if (n === last) return;
  last = n;
  await m.setAlternateAppIcon(n);
}

/** Montado na raiz: quando "Acompanhar a cor do app" está ligado, troca o ícone junto com a cor. */
export function useAppIconFollowsAccent() {
  useEffect(() => {
    if (!appIconsAvailable()) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    return useSettings.subscribe((n, p) => {
      if (!n.appIconFollows || n.accent === p.accent) return;
      clearTimeout(t);
      // espera você parar de escolher para não trocar o ícone a cada toque
      t = setTimeout(() => setAppIcon(n.appIconLook ?? 'grafite', nearestIconColor(resolveAccent(n.accent))).catch(() => {}), 1500);
    });
  }, []);
}
