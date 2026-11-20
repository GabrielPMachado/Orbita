/**
 * Peças de movimento do Órbita (Reanimated 4 + Gesture Handler 3).
 * Tudo respeita "Reduzir movimento" do iOS.
 */
import * as Haptics from 'expo-haptics';
import { CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutDown,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/store/toast';
import { radius, space, useColors } from '@/theme';
import { Glass } from './Glass';
import { T } from './ui';
import { EASE_OUT, SPRING } from '@/lib/motionTokens';

export { EASE_OUT, SMOOTH, SPRING } from '@/lib/motionTokens';

/* ---------- Pressionar com mola ---------- */
const APressable = Animated.createAnimatedComponent(Pressable);

/** Pressable que encolhe levemente ao toque (mola). */
export function PressScale({
  children,
  scaleTo = 0.96,
  style,
  ...props
}: PressableProps & { children: React.ReactNode; scaleTo?: number; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(1);
  const reduce = useReducedMotion();
  // ao tocar: encolhe pouquinho e esmaece; ao soltar, volta deslizando (sem quicar)
  const anim = useAnimatedStyle(() => {
    const t = (1 - s.value) / (1 - scaleTo || 1); // 0 solto → 1 pressionado
    return { transform: [{ scale: 1 - t * (1 - scaleTo) * 0.6 }], opacity: 1 - t * 0.22 };
  });
  return (
    <APressable
      {...props}
      onPressIn={(e) => {
        if (!reduce) s.value = withTiming(scaleTo, { duration: 110, easing: EASE_OUT });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        s.value = withTiming(1, { duration: 260, easing: EASE_OUT });
        props.onPressOut?.(e);
      }}
      style={[style, anim]}>
      {children}
    </APressable>
  );
}

/* ---------- Números que contam ---------- */
/** Anima um número de onde estava até o novo valor (ease-out). */
export function useCountUp(value: number, duration = 650) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(start + (value - start) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, duration, reduce]);
  return shown;
}

export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  render,
}: {
  value: number;
  format?: (n: number) => string;
  render?: (text: string) => React.ReactNode;
}) {
  const n = useCountUp(value);
  const text = format(n);
  return <>{render ? render(text) : text}</>;
}

/* ---------- Crescer (gráficos) ---------- */
/** Valor 0→1 que reanima quando `key` muda — use para gráficos “crescendo”. */
export function useGrow(key: unknown, duration = 700) {
  const g = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) {
      g.value = 1;
      return;
    }
    g.value = 0;
    g.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduce]);
  return g;
}

export function GrowFromBottom({ grow, children, style }: { grow: SharedValue<number>; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const a = useAnimatedStyle(() => ({ transform: [{ scaleY: grow.value }], opacity: interpolate(grow.value, [0, 0.3, 1], [0, 1, 1]) }));
  return <Animated.View style={[{ transformOrigin: 'bottom' }, style, a]}>{children}</Animated.View>;
}

/* ---------- Pulo (bounce) ---------- */
/** Dá um pulinho sempre que `trigger` muda. */
export function Bounce({
  trigger,
  children,
  style,
  amount = 1.18,
}: {
  trigger: unknown;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  amount?: number;
}) {
  const s = useSharedValue(1);
  const first = useRef(true);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    s.value = withSequence(withTiming(amount, { duration: 120, easing: EASE_OUT }), withTiming(1, { duration: 260, easing: EASE_OUT }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Pulsa devagar enquanto `active` (ex.: chama da sequência, timer rodando). */
export function Pulse({ active = true, children, style }: { active?: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useSharedValue(1);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!active || reduce) {
      s.value = withTiming(1);
      return;
    }
    s.value = withRepeat(withSequence(withTiming(1.12, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduce]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/* ---------- Confete ---------- */
const CONFETTI = 34;
function Piece({ color, delay, run }: { color: string; delay: number; run: number }) {
  const { width } = Dimensions.get('window');
  const p = useSharedValue(0);
  const spec = useMemo(
    () => ({
      x0: width / 2 + (Math.random() - 0.5) * 60,
      dx: (Math.random() - 0.5) * width * 1.1,
      peak: 180 + Math.random() * 220,
      rot: (Math.random() - 0.5) * 900,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
      round: Math.random() > 0.7,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run],
  );
  useEffect(() => {
    if (!run) return;
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  const a = useAnimatedStyle(() => {
    const t = p.value;
    // sobe e cai (parábola) enquanto se espalha
    const y = -spec.peak * 4 * t * (1 - t) + t * t * 260;
    return {
      opacity: t === 0 ? 0 : interpolate(t, [0, 0.1, 0.75, 1], [0, 1, 1, 0]),
      transform: [{ translateX: spec.x0 + spec.dx * t }, { translateY: y }, { rotate: `${spec.rot * t}deg` }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: 'absolute', top: 0, left: 0, width: spec.w, height: spec.h, borderRadius: spec.round ? spec.w : 2, backgroundColor: color },
        a,
      ]}
    />
  );
}

/** Explosão de confete. Incremente `run` para disparar. */
export function Confetti({ run, top = 260 }: { run: number; top?: number }) {
  const c = useColors();
  const reduce = useReducedMotion();
  const colors = [c.accent, '#F5A524', '#3DD6B0', '#5B9DFF', '#A78BFA', '#FFFFFF'];
  if (!run || reduce) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top }]}>
      {Array.from({ length: CONFETTI }, (_, i) => (
        <Piece key={i} color={colors[i % colors.length]} delay={(i % 6) * 25} run={run} />
      ))}
    </View>
  );
}

export function celebrate() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/* ---------- Skeleton ---------- */
export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.35);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.75, { duration: 800 }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' }, style, a]} />;
}

/* ---------- Deslizar ---------- */
export interface SwipeAction {
  icon: LucideIcon;
  label: string;
  color: string;
  onAction: () => void;
}

const SWIPE_AT = 88;

function ActionPanel({ action, side, tx }: { action: SwipeAction; side: 'left' | 'right'; tx: SharedValue<number> }) {
  // a cor só ocupa a área descoberta pelo arrasto: a linha continua de vidro
  const panel = useAnimatedStyle(() => ({ width: Math.max(0, side === 'left' ? tx.value : -tx.value) }));
  const a = useAnimatedStyle(() => {
    const d = Math.abs(tx.value);
    return {
      opacity: interpolate(d, [16, 56], [0, 1], 'clamp'),
      transform: [{ scale: interpolate(d, [16, SWIPE_AT, SWIPE_AT + 40], [0.6, 1, 1.15], 'clamp') }],
    };
  });
  const Icon = action.icon;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.actionPanel,
        side === 'left' ? { left: 0 } : { right: 0 },
        { backgroundColor: action.color, alignItems: side === 'left' ? 'flex-start' : 'flex-end' },
        panel,
      ]}>
      <Animated.View style={[{ alignItems: 'center', gap: 2, paddingHorizontal: space.xl, minWidth: 88 }, a]}>
        <Icon size={20} color="#fff" strokeWidth={2.4} />
        <T v="caption" color="#fff" style={{ fontSize: 11 }}>
          {action.label}
        </T>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Linha que desliza: para a direita dispara `left` (ex.: concluir),
 * para a esquerda dispara `right` (ex.: excluir). Passou do ponto, soltou, aconteceu.
 */
export function SwipeRow({ children, left, right }: { children: React.ReactNode; left?: SwipeAction; right?: SwipeAction }) {
  const tx = useSharedValue(0);
  const w = useRef(360);
  const crossed = useRef(false);
  const pan = usePanGesture({
    runOnJS: true,
    enabled: !!(left || right),
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      let x = e.translationX;
      // lado sem ação resiste ao arrasto
      if ((x > 0 && !left) || (x < 0 && !right)) x *= 0.15;
      tx.value = x;
      const over = Math.abs(x) > SWIPE_AT && !!(x > 0 ? left : right);
      if (over !== crossed.current) {
        crossed.current = over;
        Haptics.impactAsync(over ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    },
    onDeactivate: (e) => {
      crossed.current = false;
      const x = e.translationX;
      const act = x > SWIPE_AT ? left : x < -SWIPE_AT ? right : undefined;
      if (!act) {
        tx.value = withSpring(0, SPRING);
        return;
      }
      const leaving = act === right; // excluir sai da tela; concluir volta
      tx.value = withTiming(leaving ? -w.current : Math.min(w.current * 0.45, 180), { duration: 180 });
      setTimeout(() => {
        act.onAction();
        tx.value = leaving ? 0 : withSpring(0, SPRING);
      }, 190);
    },
  });
  const row = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  if (!left && !right) return <>{children}</>;
  return (
    <View onLayout={(e) => (w.current = e.nativeEvent.layout.width)} style={{ overflow: 'hidden' }}>
      {left && <ActionPanel action={left} side="left" tx={tx} />}
      {right && <ActionPanel action={right} side="right" tx={tx} />}
      <GestureDetector gesture={pan}>
        <Animated.View style={row}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

/* ---------- Toast ---------- */
const TOAST_ICON: Record<string, { icon: LucideIcon; tone: 'success' | 'accent' | 'danger' }> = {
  success: { icon: CircleCheck, tone: 'success' },
  info: { icon: Info, tone: 'accent' },
  danger: { icon: TriangleAlert, tone: 'danger' },
};

export function ToastHost() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const t = useToast((s) => s.current);
  const hide = useToast((s) => s.hide);
  if (!t) return null;
  const meta = TOAST_ICON[t.kind ?? 'success'];
  const Icon = meta.icon;
  const col = meta.tone === 'success' ? c.success : meta.tone === 'danger' ? c.danger : c.accent;
  return (
    <Animated.View
      key={t.id}
      entering={FadeInDown.duration(260).easing(EASE_OUT).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={[styles.toastWrap, { bottom: insets.bottom + 92 }]}>
      <Glass floating style={styles.toast}>
        <View>
          <Icon size={18} color={col} />
        </View>
        <T v="callout" style={{ flex: 1 }} numberOfLines={2}>
          {t.message}
        </T>
        {t.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              t.action?.onPress();
              hide();
            }}>
            <T v="headline" color={c.accent} style={{ fontSize: 14 }}>
              {t.action.label}
            </T>
          </Pressable>
        ) : null}
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actionPanel: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center', overflow: 'hidden' },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 50 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 14, borderRadius: radius.lg },
});
