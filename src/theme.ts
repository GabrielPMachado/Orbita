/**
 * Direção: "organizador pessoal para quem trabalha e estuda com tecnologia —
 * calmo, preciso, noturno. Grafite profundo, um único acento, vidro só no que flutua."
 */
import type { TextStyle } from 'react-native';
import { useSettings } from '@/store/settings';

/* ---------- Cor ---------- */
export const ACCENTS = {
  carmim: { color: '#F2415A', label: 'Carmim' },
  ambar: { color: '#F5A524', label: 'Âmbar' },
  azul: { color: '#4C8DFF', label: 'Azul' },
  menta: { color: '#3DD6B0', label: 'Menta' },
  lima: { color: '#A3E635', label: 'Lima' },
  verde: { color: '#10B981', label: 'Verde' },
} as const;
export type AccentName = keyof typeof ACCENTS;

/** Estilos dos ícones em quadradinho (IconTile) */
export const ICON_STYLES = {
  suave: 'Suave',
  solido: 'Sólido',
  contorno: 'Contorno',
  vidro: 'Vidro',
  gradiente: 'Gradiente',
  simples: 'Só ícone',
} as const;
export type IconStyle = keyof typeof ICON_STYLES;
export const ICON_TONES = { colorido: 'Coloridos', destaque: 'Destaque', neutro: 'Neutros' } as const;
export type IconTone = keyof typeof ICON_TONES;

/** Cor de uma escolha (nome pronto ou hex próprio). */
export const resolveAccent = (a: string | undefined) =>
  a && /^#[0-9a-f]{6}$/i.test(a) ? a.toUpperCase() : (ACCENTS[(a ?? 'carmim') as AccentName] ?? ACCENTS.carmim).color;

/** Texto legível por cima da cor (preto em cores claras). */
export function readableOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#08090B' : '#FFFFFF';
}

const neutral = {
  bg: '#08090B',
  surface: '#111317',
  surface2: '#181B21',
  surface3: '#21252C',
  border: '#262A32',
  separator: '#1E2228',
  text: '#ECEEF1',
  textDim: '#9399A3',
  textFaint: '#5B616B',
};

const semantic = { success: '#34C77B', warning: '#F5B53D', danger: '#F26464', info: '#5B9DFF' };

export type Colors = typeof neutral &
  typeof semantic & { accent: string; accentSoft: string; accentLine: string; onAccent: string; intensity: number };

export function useColors(): Colors {
  const name = useSettings((s) => s.accent);
  const intensity = useSettings((s) => s.intensity ?? 4);
  const accent = resolveAccent(name);
  return { ...neutral, ...semantic, accent, accentSoft: accent + '1F', accentLine: accent + '59', onAccent: readableOn(accent), intensity };
}

/* ---------- Espaço e forma (escala 4/8) ---------- */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 12, lg: 20, pill: 999 } as const;

/* ---------- Tipografia ---------- */
export const FONTS = {
  display: 'Sora_700Bold',
  displaySemi: 'Sora_600SemiBold',
  regular: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
} as const;

export const type = {
  largeTitle: { fontFamily: FONTS.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: FONTS.displaySemi, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  headline: { fontFamily: FONTS.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: FONTS.regular, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: FONTS.semibold, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: FONTS.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;
export type TypeVariant = keyof typeof type;

export const PRIORITY = {
  alta: { color: '#F26464', label: 'Alta' },
  media: { color: '#F5B53D', label: 'Média' },
  baixa: { color: '#5B9DFF', label: 'Baixa' },
} as const;
