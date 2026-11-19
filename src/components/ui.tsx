import { EASE_OUT, SMOOTH } from '@/lib/motionTokens';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardInset, useScrollToFocused, type ScrollRef } from '@/lib/keyboard';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  LinearTransition,
  SlideInDown,
  useAnimatedProps,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from 'react-native-svg';
import { FONTS, radius, readableOn, space, type, useColors, type TypeVariant } from '@/theme';
import { useSettings } from '@/store/settings';
import { Ambient, Glass } from './Glass';
import { PressScale } from './motion';
import { SPRING } from '@/lib/motionTokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const LIST_LAYOUT = LinearTransition.duration(260).easing(EASE_OUT);

export const tap = () => Haptics.selectionAsync().catch(() => {});
export const impact = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/** Altura reservada para a tab bar flutuante (sem o safe area). */
export const TAB_BAR_SPACE = 96;

/* =========================================================
 * Texto
 * ========================================================= */
type Tone = 'default' | 'dim' | 'faint' | 'accent' | 'success' | 'danger' | 'warning';
type TProps = {
  children?: React.ReactNode;
  v?: TypeVariant;
  tone?: Tone;
  color?: string;
  align?: TextStyle['textAlign'];
  tabular?: boolean;
  strike?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
};
export function T({ children, v = 'body', tone = 'default', color, align, tabular, strike, numberOfLines, style, onPress }: TProps) {
  const c = useColors();
  const toneColor = {
    default: c.text,
    dim: c.textDim,
    faint: c.textFaint,
    accent: c.accent,
    success: c.success,
    danger: c.danger,
    warning: c.warning,
  }[tone];
  return (
    <Text
      onPress={onPress}
      selectable={false}
      suppressHighlighting
      numberOfLines={numberOfLines}
      style={[
        type[v],
        { color: color ?? toneColor, textAlign: align },
        tabular && { fontVariant: ['tabular-nums'] },
        strike && { textDecorationLine: 'line-through' },
        style,
      ]}>
      {children}
    </Text>
  );
}

/* =========================================================
 * Botões de vidro
 * ========================================================= */
export function GlassButton({
  icon: Icon,
  onPress,
  color,
  label,
  accessibilityLabel,
}: {
  icon: LucideIcon;
  onPress: () => void;
  color?: string;
  label?: string;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={6}
      scaleTo={0.9}
      onPress={() => {
        tap();
        onPress();
      }}>
      <Glass interactive floating style={label ? styles.glassPill : styles.glassBtn}>
        <View>
          <Icon color={color ?? c.text} size={20} strokeWidth={2} />
        </View>
        {label ? (
          <T v="caption" color={color ?? c.text} style={{ fontSize: 14 }}>
            {label}
          </T>
        ) : null}
      </Glass>
    </PressScale>
  );
}

/* =========================================================
 * Tela
 * ========================================================= */
export function Screen({
  title,
  subtitle,
  overline,
  back,
  actions,
  children,
  scroll = true,
  tab,
  onRefresh,
}: {
  title?: string;
  subtitle?: string;
  overline?: string;
  back?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  /** tela dentro das abas (reserva espaço para a tab bar) */
  tab?: boolean;
  /** puxar para atualizar */
  onRefresh?: () => Promise<unknown> | void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom + (tab ? TAB_BAR_SPACE : space.xxl);
  const y = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    y.value = e.contentOffset.y;
  });

  // título grande some enquanto a barra compacta de vidro aparece
  const titleFade = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 70], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(y.value, [-120, 0], [24, 0], Extrapolation.CLAMP) },
      { scale: interpolate(y.value, [-120, 0, 70], [1.08, 1, 0.96], Extrapolation.CLAMP) },
    ],
  }));
  const compact = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [56, 96], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(y.value, [56, 96], [-8, 0], Extrapolation.CLAMP) }],
  }));
  const ambient = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(y.value, [-200, 0, 800], [40, 0, -160], Extrapolation.CLAMP) }] }));

  const titleBlock = (title || overline || subtitle) && (
    <Animated.View style={[{ gap: space.xs, flex: 1, transformOrigin: 'left' }, scroll && titleFade]}>
      {overline ? (
        <T v="overline" tone="dim">
          {overline}
        </T>
      ) : null}
      {title ? <T v="largeTitle">{title}</T> : null}
      {subtitle ? (
        <T v="callout" tone="dim">
          {subtitle}
        </T>
      ) : null}
    </Animated.View>
  );

  // Telas com voltar: barra de navegação acima do título grande.
  // Telas de aba: ações alinhadas à direita do título.
  const header = back ? (
    <View style={{ gap: space.lg, marginBottom: space.sm }}>
      <View style={styles.navRow}>
        <GlassButton icon={ChevronLeft} onPress={() => router.back()} accessibilityLabel="Voltar" />
        <View style={{ flexDirection: 'row', gap: space.sm }}>{actions}</View>
      </View>
      {titleBlock}
    </View>
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: space.sm, minHeight: 44 }}>
      {titleBlock || <View style={{ flex: 1 }} />}
      {actions ? <View style={{ flexDirection: 'row', gap: space.sm }}>{actions}</View> : null}
    </View>
  );

  // cada bloco da tela entra em cascata
  const blocks = React.Children.toArray(children)
    .filter(Boolean)
    .map((child, i) => (
      <Animated.View
        key={(child as React.ReactElement).key ?? i}
        entering={FadeInDown.delay(Math.min(i, 8) * 45)
          .duration(260)
          .easing(EASE_OUT)}>
        {child}
      </Animated.View>
    ));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + space.sm }}>
      {/* o fundo sobe um pouco ao rolar (parallax): sobra por cima e por baixo para nunca aparecer o preto */}
      <Animated.View pointerEvents="none" style={[styles.ambientLayer, scroll && ambient]}>
        <Ambient />
      </Animated.View>
      {scroll ? (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: bottom, gap: space.xl }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                tintColor={c.accent}
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  impact();
                  try {
                    await onRefresh();
                  } finally {
                    setRefreshing(false);
                  }
                }}
              />
            ) : undefined
          }>
          {header}
          {blocks}
        </Animated.ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: space.lg, paddingBottom: insets.bottom, gap: space.lg }}>
          {header}
          {children}
        </View>
      )}

      {/* barra compacta de vidro que aparece ao rolar */}
      {scroll && title ? (
        <Animated.View pointerEvents="box-none" style={[styles.compactWrap, { height: insets.top + 52 }, compact]}>
          <Glass floating style={[StyleSheet.absoluteFill, { borderRadius: 0, borderWidth: 0 }]} />
          <View pointerEvents="box-none" style={[styles.compactRow, { paddingTop: insets.top }]}>
            {back ? (
              <Pressable accessibilityLabel="Voltar" hitSlop={10} onPress={() => router.back()} style={styles.compactBack}>
                <ChevronLeft size={22} color={c.text} />
              </Pressable>
            ) : null}
            <T v="headline" numberOfLines={1} align="center" style={{ flex: 1, marginHorizontal: 56 }}>
              {title}
            </T>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/* =========================================================
 * Blocos
 * ========================================================= */
export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const base = [styles.card, padded && { padding: space.lg }, style];
  if (!onPress) return <Glass style={base}>{children}</Glass>;
  return (
    <PressScale
      scaleTo={0.975}
      onPress={() => {
        tap();
        onPress();
      }}>
      <Glass interactive style={base}>
        {children}
      </Glass>
    </PressScale>
  );
}

/** Lista agrupada (estilo iOS) com separadores finos. */
export function List({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const items = React.Children.toArray(children).filter(Boolean);
  // linhas entram, saem e se reorganizam com mola
  return (
    <Animated.View layout={LIST_LAYOUT}>
      <Card padded={false} style={[{ overflow: 'hidden' }, style]}>
        {items.map((child, i) => (
          <Animated.View
            key={(child as React.ReactElement).key ?? i}
            layout={LIST_LAYOUT}
            entering={FadeIn.duration(260)}
            exiting={FadeOut.duration(160)}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 64 }} />}
            {child}
          </Animated.View>
        ))}
      </Card>
    </Animated.View>
  );
}

export function Row({
  leading,
  title,
  subtitle,
  subtitleTone = 'dim',
  trailing,
  onPress,
  onLongPress,
  chevron,
  strike,
  meta,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** linha extra embaixo (selos de prioridade, origem, prazo…) */
  meta?: React.ReactNode;
  subtitleTone?: Tone;
  trailing?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  strike?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
      {leading ? <View style={styles.rowLeading}>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={2} tone={strike ? 'faint' : 'default'} strike={strike}>
          {title}
        </T>
        {subtitle ? (
          <T v="caption" tone={subtitleTone} numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
        {meta}
      </View>
      {trailing}
      {chevron && <ChevronRight size={18} color={c.textFaint} />}
    </Pressable>
  );
}

export function IconTile({ icon: Icon, color, size = 36 }: { icon: LucideIcon; color?: string; size?: number }) {
  const c = useColors();
  const style = useSettings((st) => st.iconStyle ?? 'suave');
  const tone = useSettings((st) => st.iconTone ?? 'colorido');
  const col = tone === 'neutro' ? c.textDim : tone === 'destaque' ? c.accent : (color ?? c.accent);
  const box = { width: size, height: size, borderRadius: size * 0.32, alignItems: 'center', justifyContent: 'center' } as const;
  if (style === 'solido') {
    const bg = tone === 'neutro' ? c.surface3 : col;
    return (
      <View style={[box, { backgroundColor: bg }]}>
        <Icon size={size * 0.5} color={tone === 'neutro' ? c.text : readableOn(bg)} strokeWidth={2.2} />
      </View>
    );
  }
  if (style === 'contorno') {
    return (
      <View style={[box, { borderWidth: 1.5, borderColor: col + '8C' }]}>
        <Icon size={size * 0.5} color={col} strokeWidth={2} />
      </View>
    );
  }
  if (style === 'vidro') {
    return (
      <View
        style={[
          box,
          {
            backgroundColor: 'rgba(255,255,255,0.07)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.14)',
            borderTopColor: 'rgba(255,255,255,0.24)',
          },
        ]}>
        <Icon size={size * 0.5} color={col} strokeWidth={2} />
      </View>
    );
  }
  if (style === 'gradiente') {
    const base = tone === 'neutro' ? '#5B616B' : col;
    return (
      <View style={[box, { overflow: 'hidden' }]}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgLinearGradient id={`tile${base.slice(1)}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={base} />
              <Stop offset="1" stopColor={base} stopOpacity={0.55} />
            </SvgLinearGradient>
          </Defs>
          <Rect width={size} height={size} fill="#000" />
          <Rect width={size} height={size} fill={`url(#tile${base.slice(1)})`} />
        </Svg>
        <Icon size={size * 0.5} color={readableOn(base)} strokeWidth={2.2} />
      </View>
    );
  }
  if (style === 'simples') {
    return (
      <View style={box}>
        <Icon size={size * 0.62} color={col} strokeWidth={1.9} />
      </View>
    );
  }
  return (
    <View style={[box, { backgroundColor: col + '1F' }]}>
      <Icon size={size * 0.5} color={col} strokeWidth={2} />
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <T v="overline" tone="dim">
        {title}
      </T>
      {action ? (
        <T v="caption" tone="accent" onPress={onAction} style={{ fontSize: 14 }}>
          {action}
        </T>
      ) : null}
    </View>
  );
}

export function Section({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <SectionHeader title={title} action={action} onAction={onAction} />
      {children}
    </View>
  );
}

export function Empty({
  icon: Icon,
  title,
  hint,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: string;
  onAction?: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxxl, gap: space.sm }}>
      <Glass style={styles.emptyIcon}>
        <View>
          <Icon color={c.textDim} size={26} strokeWidth={1.75} />
        </View>
      </Glass>
      <T v="headline">{title}</T>
      {hint ? (
        <T v="callout" tone="dim" align="center" style={{ maxWidth: 280 }}>
          {hint}
        </T>
      ) : null}
      {action && onAction ? (
        <Button label={action} onPress={onAction} variant="secondary" style={{ marginTop: space.sm, alignSelf: 'center' }} />
      ) : null}
    </View>
  );
}

export function Badge({ label, color }: { label: string; color?: string }) {
  const c = useColors();
  const col = color ?? c.textDim;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: col + '1F' }}>
      <T v="caption" color={col} style={{ fontSize: 11 }}>
        {label}
      </T>
    </View>
  );
}

/* =========================================================
 * Controles
 * ========================================================= */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon: Icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: LucideIcon;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  // primário = vidro tingido com o acento; secundário = vidro neutro; perigo = vidro avermelhado
  const tint = disabled ? undefined : variant === 'primary' ? c.accent : variant === 'danger' ? c.danger + '33' : undefined;
  const fg = disabled ? c.textFaint : variant === 'primary' ? c.onAccent : variant === 'danger' ? c.danger : c.text;
  return (
    <PressScale
      accessibilityRole="button"
      disabled={disabled}
      scaleTo={0.96}
      onPress={() => {
        impact();
        onPress();
      }}
      style={style}>
      <Glass interactive={!disabled} tint={tint} style={styles.btn}>
        {Icon ? (
          <View>
            <Icon size={18} color={fg} strokeWidth={2.2} />
          </View>
        ) : null}
        <T v="headline" color={fg}>
          {label}
        </T>
      </Glass>
    </PressScale>
  );
}

export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: space.sm, flex: (props.style as ViewStyle)?.flex }}>
      {label ? (
        <T v="overline" tone="dim">
          {label}
        </T>
      ) : null}
      <Glass style={styles.inputGlass}>
        <TextInput
          placeholderTextColor={c.textFaint}
          selectionColor={c.accent}
          keyboardAppearance="dark"
          {...props}
          style={[styles.input, type.body, { color: c.text }, props.style, { flex: undefined }]}
        />
      </Glass>
    </View>
  );
}

export function Chip({
  label,
  icon: Icon,
  active,
  onPress,
  color,
}: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const c = useColors();
  const col = color ?? c.accent;
  const fg = active ? col : c.textDim;
  return (
    <PressScale
      disabled={!onPress}
      scaleTo={0.92}
      onPress={() => {
        tap();
        onPress?.();
      }}>
      <Glass interactive={!!onPress} tint={active ? col + '33' : undefined} style={styles.chip}>
        {Icon ? (
          <View>
            <Icon size={14} color={fg} strokeWidth={2.2} />
          </View>
        ) : null}
        <T v="caption" color={fg} style={{ fontSize: 13 }}>
          {label}
        </T>
      </Glass>
    </PressScale>
  );
}

export function Checkbox({ checked, onPress, color }: { checked: boolean; onPress: () => void; color?: string }) {
  const c = useColors();
  const col = color ?? c.accent;
  const sc = useSharedValue(1);
  const fill = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(checked ? 1 : 0, { duration: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);
  const box = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const bg = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ scale: interpolate(fill.value, [0, 1], [0.4, 1]) }] }));
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={12}
      onPress={() => {
        impact();
        sc.value = withSequence(withTiming(0.86, { duration: 100, easing: EASE_OUT }), withTiming(1, { duration: 240, easing: EASE_OUT }));
        onPress();
      }}>
      <Animated.View style={[styles.check, { borderColor: checked ? col : c.textFaint }, box]}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: col }, bg]} />
        {checked && (
          <Animated.View entering={ZoomIn.duration(260).easing(EASE_OUT)}>
            <Check size={14} color={c.bg} strokeWidth={3.2} />
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function Progress({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const c = useColors();
  const reduce = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    const target = Math.min(100, Math.max(0, value * 100));
    v.value = reduce ? target : withTiming(target, SMOOTH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  const bar = useAnimatedStyle(() => ({ width: `${v.value}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.surface3, overflow: 'hidden' }}>
      <Animated.View style={[{ height, backgroundColor: color ?? c.accent, borderRadius: height }, bar]} />
    </View>
  );
}

export function ProgressRing({
  value,
  size = 88,
  stroke = 8,
  color,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const c = useColors();
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = reduce ? v : withTiming(v, SMOOTH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v, reduce]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.surface3} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={arc}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string; count?: number }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const [w, setW] = useState(0);
  const idx = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const seg = w > 0 ? (w - 8) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = w ? withSpring(idx * seg, SPRING) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, seg]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Glass style={styles.segment}>
      <View style={{ flexDirection: 'row', flex: 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width + 8)}>
        {seg > 0 && <Animated.View pointerEvents="none" style={[styles.segPill, { width: seg }, pill]} />}
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                tap();
                onChange(o.value);
              }}
              style={styles.segItem}>
              <T v="caption" tone={active ? 'default' : 'dim'} style={{ fontSize: 14, fontFamily: active ? FONTS.bold : FONTS.semibold }}>
                {o.label}
              </T>
              {o.count !== undefined ? (
                <T v="caption" tone={active ? 'accent' : 'faint'} tabular>
                  {o.count}
                </T>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

/* =========================================================
 * Sheet flutuante de vidro
 * ========================================================= */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const dy = useSharedValue(0);
  useEffect(() => {
    if (visible) dy.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  // arrastar a alça/título para baixo fecha
  const drag = usePanGesture({
    runOnJS: true,
    activeOffsetY: 8,
    failOffsetX: [-24, 24],
    onUpdate: (e) => {
      dy.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      if (e.translationY > 110 || e.velocityY > 900) {
        dy.value = withTiming(700, { duration: 200 });
        setTimeout(onClose, 170);
      } else {
        dy.value = withSpring(0, SPRING);
      }
    },
  });
  const kb = useKeyboardInset();
  const scrollRef = useRef<ScrollRef>(null);
  useScrollToFocused(scrollRef, kb.height);
  const { height: winH } = useWindowDimensions();
  const baseBottom = Math.max(insets.bottom, space.sm);
  // com o teclado aberto a folha fica logo acima dele e encolhe para caber na tela
  const panel = useAnimatedStyle(() => ({
    transform: [{ translateY: dy.value }],
    paddingBottom: kb.inset.value > 0 ? Math.max(baseBottom, kb.inset.value + space.sm) : baseBottom,
  }));
  const maxH = Math.min(640, winH - insets.top - space.md - (kb.height ? kb.height + space.sm : baseBottom));
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(dy.value, [0, 400], [1, 0], Extrapolation.CLAMP) }));
  return (
    // sem fade no Modal: o Liquid Glass da folha não aparece se ela nasce transparente
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View
          entering={FadeIn.duration(180)}
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }, backdrop]}
        />
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar" />
        <Animated.View entering={SlideInDown.duration(260).easing(EASE_OUT)} style={[{ paddingHorizontal: space.sm }, panel]}>
          <Glass floating style={[styles.sheet, { maxHeight: maxH }]}>
            <GestureDetector gesture={drag}>
              <View style={{ paddingTop: space.md }}>
                <View style={[styles.grabber, { backgroundColor: c.textFaint }]} />
                {title ? (
                  <T v="title" style={{ marginBottom: space.lg }}>
                    {title}
                  </T>
                ) : null}
              </View>
            </GestureDetector>
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ gap: space.lg, paddingBottom: space.xs }}
              bounces={false}
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </Glass>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ambientLayer: { position: 'absolute', left: 0, right: 0, top: -48, bottom: -180 },
  glassBtn: { height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  glassPill: { height: 44, borderRadius: 22, paddingLeft: 14, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  compactRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  compactBack: { position: 'absolute', left: space.lg, bottom: 10, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  card: { borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 56 },
  rowLeading: { width: 36, alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  btn: {
    height: 52,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    gap: space.sm,
  },
  inputGlass: { borderRadius: radius.sm },
  input: { paddingHorizontal: space.lg, minHeight: 52, paddingVertical: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, height: 34, borderRadius: radius.pill },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.75, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: radius.sm, padding: 4 },
  segPill: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.13)' },
  segItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: 9 },
  sheet: { borderRadius: 32, padding: space.xl, paddingTop: 0, maxHeight: 640 },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: space.lg, opacity: 0.6 },
});
