import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import React, { useId } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useColors } from '@/theme';

const LIQUID = isLiquidGlassAvailable();
export const hasLiquidGlass = LIQUID;

/**
 * Superfície de vidro usada em praticamente tudo no app.
 * - iOS 26+: Liquid Glass nativo (expo-glass-effect) em todos os níveis.
 * - Sem Liquid Glass: `floating` (tab bar, botões, sheets) usa desfoque real (expo-blur);
 *   superfícies de conteúdo (cards, campos, chips) usam um vidro translúcido leve — desfoque em
 *   dezenas de cards deixaria iPhones antigos lentos.
 */
export function Glass({
  children,
  style,
  tint,
  interactive,
  variant = 'regular',
  floating,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** cor de tingimento (botão principal, item ativo…) */
  tint?: string;
  interactive?: boolean;
  variant?: 'regular' | 'clear';
  /** elemento que flutua sobre o conteúdo */
  floating?: boolean;
}) {
  if (LIQUID) {
    return (
      <GlassView glassEffectStyle={variant} tintColor={tint} isInteractive={interactive} colorScheme="dark" style={style}>
        {children}
      </GlassView>
    );
  }

  const flat = StyleSheet.flatten(style) ?? {};
  const edge: ViewStyle = {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tint ? tint : 'rgba(255,255,255,0.10)',
  };

  if (tint) return <View style={[style, edge, { backgroundColor: tint }]}>{children}</View>;

  if (!floating || Platform.OS === 'android') {
    return (
      <View style={[style, edge, { backgroundColor: floating ? 'rgba(24,27,33,0.94)' : 'rgba(255,255,255,0.045)' }]}>
        {/* brilho na borda superior, como no vidro */}
        <View pointerEvents="none" style={[styles.sheen, { borderTopLeftRadius: flat.borderRadius, borderTopRightRadius: flat.borderRadius }]} />
        {children}
      </View>
    );
  }

  return (
    <View style={[style, edge]}>
      <BlurView pointerEvents="none" intensity={variant === 'clear' ? 30 : 60} tint="systemChromeMaterialDark" style={[StyleSheet.absoluteFill, { borderRadius: flat.borderRadius }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(17,19,23,0.62)' }]} />
      {children}
    </View>
  );
}

/** Agrupa vidros próximos para que se fundam (efeito "gota") no iOS 26. */
export function GlassGroup({ children, style, spacing = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; spacing?: number }) {
  if (LIQUID) {
    return (
      <GlassContainer spacing={spacing} style={style}>
        {children}
      </GlassContainer>
    );
  }
  return <View style={style}>{children}</View>;
}

/**
 * Fundo ambiente: manchas suaves de cor atrás do conteúdo.
 * Sem algo atrás, vidro sobre preto chapado fica invisível.
 */
export function Ambient() {
  const c = useColors();
  // a roda de intensidade (0–11) controla quanto a cor toma conta do fundo
  const k = Math.max(0, Math.min(11, c.intensity)) / 11;
  const glow = (0.06 + 0.44 * k).toFixed(3);
  const wash = (0.22 * k * k).toFixed(3);
  // ids únicos: várias telas montadas ao mesmo tempo não podem compartilhar o mesmo gradiente
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={`a${id}`} cx="85%" cy="4%" r="70%">
            <Stop offset="0" stopColor={c.accent} stopOpacity={glow} />
            <Stop offset="1" stopColor={c.accent} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={`w${id}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.accent} stopOpacity={(Number(wash) * 0.35).toFixed(3)} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={wash} />
          </LinearGradient>
          <RadialGradient id={`b${id}`} cx="0%" cy="45%" r="65%">
            <Stop offset="0" stopColor="#4C6FFF" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#4C6FFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`d${id}`} cx="100%" cy="95%" r="60%">
            <Stop offset="0" stopColor="#2DD4BF" stopOpacity="0.10" />
            <Stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {k > 0 ? <Rect x="0" y="0" width="100%" height="100%" fill={`url(#w${id})`} /> : null}
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#a${id})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#b${id})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#d${id})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
});
