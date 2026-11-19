/**
 * Ícone do app na tela inicial: estilo × cor (expo-alternate-app-icons).
 * O padrão (grafite + carmim) é o ícone principal; o resto são ícones alternativos.
 * Só existe no app instalado; no Expo Go e na web nada acontece.
 */
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
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
  { key: 'Ciano', hex: '#06B6D4' },
  { key: 'Indigo', hex: '#6366F1' },
  { key: 'Roxo', hex: '#8B5CF6' },
  { key: 'Rosa', hex: '#EC4899' },
  { key: 'Laranja', hex: '#F97316' },
] as const;
export type IconColor = (typeof ICON_COLORS)[number]['key'];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const iconName = (look: IconLook, color: IconColor) => (look === 'mono' ? 'Mono' : `${cap(look)}${color}`);
export const iconThumb = (look: IconLook, color: IconColor) => ICON_THUMBS[iconName(look, color)];
const nativeName = (look: IconLook, color: IconColor) => {
  const n = iconName(look, color);
  return n === 'GrafiteCarmim' ? null : n;
};

/** cor pronta mais próxima de um hex qualquer, pelo matiz (para o ícone seguir a cor do app) */
export function nearestIconColor(hex: string): IconColor {
  const hsl = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let hue = 0;
    if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (hue * 60 + 360) % 360, s, l };
  };
  const t = hsl(/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#F2415A');
  let best: IconColor = 'Carmim';
  let dist = Infinity;
  for (const c of ICON_COLORS) {
    const o = hsl(c.hex);
    const dh = Math.min(Math.abs(t.h - o.h), 360 - Math.abs(t.h - o.h));
    const d = dh * dh + (t.l - o.l) * (t.l - o.l) * 400;
    if (d < dist) {
      dist = d;
      best = c.key;
    }
  }
  return best;
}

type Mod = {
  supportsAlternateIcons: boolean;
  setAlternateAppIcon: (n: string | null) => Promise<string | null>;
  getAppIconName: () => string | null;
};
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
  if (last === undefined) last = m.getAppIconName?.() ?? null;
  if (n === last) return;
  await m.setAlternateAppIcon(n);
  last = n; // só depois de dar certo: se falhar, tenta de novo na próxima vez
}

/** O ícone que combina com a cor atual do app. */
export function followIcon() {
  const st = useSettings.getState();
  return { look: (st.appIconLook ?? 'grafite') as IconLook, color: nearestIconColor(resolveAccent(st.accent)) };
}

/**
 * Montado na raiz: com "Acompanhar a cor do app" ligado, o ícone segue a cor — ao trocar a cor,
 * ao ligar a opção, ao mudar o estilo e ao abrir o app (o iOS só troca com o app em primeiro plano).
 */
export function useAppIconFollowsAccent() {
  useEffect(() => {
    if (!appIconsAvailable()) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const apply = (delay: number) => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!useSettings.getState().appIconFollows || AppState.currentState !== 'active') return;
        const { look, color } = followIcon();
        setAppIcon(look, color).catch(() => {});
      }, delay);
    };
    const unsub = useSettings.subscribe((n, p) => {
      if (!n.appIconFollows) return;
      if (n.accent !== p.accent || n.appIconFollows !== p.appIconFollows || n.appIconLook !== p.appIconLook) apply(1500);
    });
    const sub = AppState.addEventListener('change', (a) => a === 'active' && apply(800));
    const h = useSettings.persist.onFinishHydration(() => apply(1500));
    if (useSettings.persist.hasHydrated()) apply(1500);
    return () => {
      clearTimeout(t);
      unsub();
      sub.remove();
      h();
    };
  }, []);
}
