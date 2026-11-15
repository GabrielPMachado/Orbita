/**
 * Roda de intensidade (0–11): botão giratório com marcações em volta e uma estrela no
 * fim. A cor escolhida pinta o anel, o ponto e o fundo do cartão, que vai esquentando
 * conforme a roda sobe; no 11 tudo acende. Gire com o dedo ou toque numa marcação.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useId, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export const KNOB_MAX = 11;
const STEP = 22; // graus entre marcações; o 5 fica no topo
const angleOf = (v: number) => (v - 5) * STEP;

/* ---------- cor ---------- */
const hex = (h: string) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb: number[]) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** mistura a → b (t = 0 → a, 1 → b) */
export const mix = (a: string, b: string, t: number) => {
  const A = hex(a);
  const B = hex(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
};

const BASE = '#2D2A2B';

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function starPath(cx: number, cy: number, R: number) {
  const r = R * 0.45;
  let d = '';
  for (let i = 0; i < 10; i++) {
    const p = polar(cx, cy, i % 2 ? r : R, i * 36);
    d += `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }
  return d + 'Z';
}

/** seta apontando para fora: ponta perto da borda, haste em direção ao centro */
function arrowPath(R: number) {
  const tip = R - R * 0.8;
  const base = R - R * 0.5;
  const stemEnd = R - R * 0.2;
  const hw = R * 0.15; // meia largura da ponta
  const sw = R * 0.055; // meia largura da haste
  return `M${R},${tip} L${R + hw},${base} L${R + sw},${base} L${R + sw},${stemEnd} Q${R},${stemEnd + sw * 1.4} ${R - sw},${stemEnd} L${R - sw},${base} L${R - hw},${base} Z`;
}

export function Knob({ value, onChange, color, size = 200 }: { value: number; onChange: (v: number) => void; color: string; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const v = Math.max(0, Math.min(KNOB_MAX, Math.round(value)));
  const k = v / KNOB_MAX;
  const max = v === KNOB_MAX;

  const W = size;
  const H = size * 0.95;
  const cx = W / 2;
  const cy = H * 0.47;
  const R = size * 0.235; // raio do botão
  const tickIn = R + size * 0.075;
  const tickOut = R + size * 0.125;

  // fundo do cartão: esquenta com a cor conforme sobe
  const bg = mix(BASE, mix(color, '#140C0D', 0.58), Math.min(1, k * 1.05));
  const ring = max ? color : mix('#4A3436', color, 0.35 + 0.6 * k);
  const dot = color;

  /* ---------- rotação suave ---------- */
  const rot = useSharedValue(angleOf(v));
  useEffect(() => {
    rot.value = withSpring(angleOf(v), { damping: 18, stiffness: 220, mass: 0.6 });
  }, [v, rot]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  /* ---------- gesto: girar ou tocar ---------- */
  const last = useRef(v);
  last.current = v;
  const pick = (x: number, y: number) => {
    const deg = (Math.atan2(x - cx, -(y - cy)) * 180) / Math.PI; // 0 = topo, horário +
    if (Math.abs(deg) > 160) return; // zona morta embaixo: não pula do 0 pro 11
    const next = Math.max(0, Math.min(KNOB_MAX, Math.round(deg / STEP + 5)));
    if (next !== last.current) {
      last.current = next;
      if (next === KNOB_MAX) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else Haptics.selectionAsync().catch(() => {});
      onChange(next);
    }
  };
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => pick(e.x, e.y),
    onUpdate: (e) => pick(e.x, e.y),
  });

  /* ---------- partes fixas ---------- */
  const knurl = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => {
        const a = polar(R, R, R * 0.97, i * 5);
        const b = polar(R, R, R * 0.86, i * 5);
        return { ...a, x2: b.x, y2: b.y, i };
      }),
    [R],
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Intensidade da cor"
        accessibilityValue={{ min: 0, max: KNOB_MAX, now: v }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.max(0, Math.min(KNOB_MAX, v + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
        style={[styles.card, { width: W, height: H, backgroundColor: bg, borderRadius: size * 0.09 }]}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`hot${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={mix(mix(color, '#B07A4E', 0.45), '#1A1012', 0.35)} />
              <Stop offset="1" stopColor={mix(color, '#1A0A0C', 0.3)} />
            </LinearGradient>
            <RadialGradient id={`glow${id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0.6" stopColor={color} stopOpacity={max ? 0.55 : 0.18 * k} />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* no 11 o cartão inteiro acende */}
          {max ? <Rect x="0" y="0" width={W} height={H} fill={`url(#hot${id})`} /> : null}

          {/* marcações */}
          {Array.from({ length: KNOB_MAX }, (_, i) => {
            const deg = angleOf(i);
            const top = i === 5;
            const a = polar(cx, cy, tickIn, deg);
            const b = polar(cx, cy, top ? tickOut + size * 0.02 : tickOut, deg);
            const lit = i <= v && v > 0 ? true : i === 0;
            const zeroOnly = v === 0 && i === 0;
            return (
              <G key={i}>
                {max ? <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={size * 0.034} strokeLinecap="round" /> : null}
                <Line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={zeroOnly ? mix('#FFFFFF', color, 0.45) : lit ? '#FFFFFF' : '#FFFFFF'}
                  strokeOpacity={lit ? (zeroOnly ? 0.85 : 0.95) : 0.22}
                  strokeWidth={size * (max ? 0.016 : 0.012)}
                  strokeLinecap="round"
                />
              </G>
            );
          })}

          {/* estrela no fim (11) */}
          {(() => {
            const p = polar(cx, cy, (tickIn + tickOut) / 2, angleOf(KNOB_MAX));
            return (
              <G>
                {max ? <Circle cx={p.x} cy={p.y} r={size * 0.045} fill={color} /> : null}
                <Path d={starPath(p.x, p.y, size * 0.032)} fill={max ? '#FFFFFF' : '#FFFFFF'} fillOpacity={max ? 1 : 0.25} />
              </G>
            );
          })()}

          {/* brilho e anel colorido em volta do botão */}
          <Circle cx={cx} cy={cy} r={R + size * 0.05} fill={`url(#glow${id})`} />
          <Circle cx={cx} cy={cy} r={R + size * 0.022} fill="none" stroke={ring} strokeWidth={size * 0.016} />
          <Circle cx={cx} cy={cy} r={R + size * 0.008} fill="#151516" />
        </Svg>

        {/* corpo do botão: gira com o valor (serrilhado + ponto) */}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: cx - R, top: cy - R, width: R * 2, height: R * 2 }, spin]}>
          <Svg width={R * 2} height={R * 2}>
            <Defs>
              <RadialGradient id={`body${id}`} cx="35%" cy="30%" r="80%">
                <Stop offset="0" stopColor="#5C5C5E" />
                <Stop offset="0.55" stopColor="#333335" />
                <Stop offset="1" stopColor="#1B1B1C" />
              </RadialGradient>
            </Defs>
            <Circle cx={R} cy={R} r={R} fill={`url(#body${id})`} />
            {knurl.map((l) => (
              <Line key={l.i} x1={l.x} y1={l.y} x2={l.x2} y2={l.y2} stroke={l.i % 2 ? '#0E0E0F' : '#6A6A6C'} strokeOpacity={0.55} strokeWidth={1} />
            ))}
            <Circle cx={R} cy={R} r={R * 0.84} fill={`url(#body${id})`} />
            <Circle cx={R} cy={R} r={R * 0.84} fill="none" stroke="#000" strokeOpacity={0.35} strokeWidth={1} />
            {/* seta indicadora na cor escolhida */}
            <Path d={arrowPath(R)} fill={dot} fillOpacity={0.28} stroke={dot} strokeOpacity={0.28} strokeWidth={R * 0.09} strokeLinejoin="round" />
            <Path d={arrowPath(R)} fill={dot} />
            <Path d={`M${R},${R - R * 0.74} L${R - R * 0.05},${R - R * 0.58}`} stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={R * 0.035} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
});
