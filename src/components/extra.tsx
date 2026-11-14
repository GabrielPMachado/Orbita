import { Minus, Plus, Star } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { radius, space, useColors } from '@/theme';
import { Glass } from './Glass';
import { GrowFromBottom, useGrow } from './motion';
import { T, tap } from './ui';

export const PALETTE = ['#F2415A', '#F97316', '#F5A524', '#22C55E', '#2DD4BF', '#3B82F6', '#8B5CF6', '#EC4899', '#94A3B8'];

export function confirmDelete(title: string, message: string | undefined, onOk: () => void, label = 'Excluir') {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: label, style: 'destructive', onPress: onOk },
  ]);
}

export function Stepper({
  label,
  value,
  min = 0,
  max = 999,
  step = 1,
  onChange,
  format = (n) => String(n),
}: {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (n: number) => void;
  format?: (n: number) => string;
}) {
  const c = useColors();
  const btn = (d: number, Icon: typeof Plus) => {
    const off = value + d < min || value + d > max;
    return (
      <Pressable
        accessibilityLabel={d > 0 ? 'Aumentar' : 'Diminuir'}
        disabled={off}
        onPress={() => {
          tap();
          onChange(Math.round(Math.min(max, Math.max(min, value + d)) * 100) / 100);
        }}
        style={({ pressed }) => ({ opacity: off ? 0.35 : pressed ? 0.7 : 1 })}>
        <Glass interactive style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
          <View>
            <Icon size={18} color={c.text} />
          </View>
        </Glass>
      </Pressable>
    );
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {label ? (
        <T style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </T>
      ) : null}
      {btn(-step, Minus)}
      <T v="headline" tabular align="center" style={{ minWidth: 64 }}>
        {format(value)}
      </T>
      {btn(step, Plus)}
    </View>
  );
}

export function Stars({ value, onChange, size = 22 }: { value?: number; onChange?: (n: number | undefined) => void; size?: number }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = (value ?? 0) >= n;
        return (
          <Pressable
            key={n}
            disabled={!onChange}
            hitSlop={4}
            accessibilityLabel={`${n} estrelas`}
            onPress={() => {
              tap();
              onChange?.(value === n ? undefined : n);
            }}>
            <Star size={size} color={on ? c.warning : c.textFaint} fill={on ? c.warning : 'transparent'} strokeWidth={1.8} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {PALETTE.map((col) => (
        <Pressable
          key={col}
          accessibilityLabel={col}
          onPress={() => {
            tap();
            onChange(col);
          }}
          style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col, borderWidth: 3, borderColor: value === col ? c.text : 'transparent' }}
        />
      ))}
    </View>
  );
}

/** Bloco de número com rótulo. */
export function Stat({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <Glass style={{ flex: 1, padding: space.lg, borderRadius: radius.lg, gap: 4 }}>
      <T v="caption" tone="dim">
        {label}
      </T>
      <T v="title" tabular color={color} numberOfLines={1}>
        {value}
      </T>
      {hint ? (
        <T v="caption" tone="faint" numberOfLines={1}>
          {hint}
        </T>
      ) : null}
    </Glass>
  );
}

function useWidth() {
  const [w, setW] = useState(0);
  return [w, (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)] as const;
}

/** Barras de uma série só. */
export function Bars({
  data,
  height = 120,
  color,
  format,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const c = useColors();
  const [w, onLayout] = useWidth();
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = w / Math.max(1, data.length);
  const bw = Math.min(22, slot * 0.6);
  const col = color ?? c.accent;
  const peak = data.reduce((a, d) => (d.value > a.value ? d : a), data[0] ?? { label: '', value: 0 });
  const grow = useGrow(data.map((d) => d.value).join('|'));
  return (
    <View style={{ gap: space.sm }}>
      {format && peak?.value > 0 ? (
        <T v="caption" tone="dim">
          Pico: {format(peak.value)} · {peak.label}
        </T>
      ) : null}
      <View onLayout={onLayout} style={{ height }}>
        {w > 0 && (
          <GrowFromBottom grow={grow}>
          <Svg width={w} height={height}>
            {data.map((d, i) => {
              const h = d.value ? Math.max(3, ((height - 2) * d.value) / max) : 0;
              return (
                <React.Fragment key={i}>
                  <Rect x={slot * i + (slot - bw) / 2} y={0} width={bw} height={height} rx={Math.min(6, bw / 2)} fill={c.textFaint} opacity={0.08} />
                  <Rect x={slot * i + (slot - bw) / 2} y={height - h} width={bw} height={h} rx={Math.min(6, bw / 2)} fill={col} opacity={d.highlight ? 1 : 0.7} />
                </React.Fragment>
              );
            })}
          </Svg>
          </GrowFromBottom>
        )}
      </View>
      {/* rótulos posicionados no centro de cada barra (podem ser mais largos que a barra) */}
      <View style={{ height: 14 }}>
        {w > 0 &&
          data.map((d, i) =>
            d.label ? (
              <T
                key={i}
                v="caption"
                tone={d.highlight ? 'default' : 'faint'}
                align="center"
                numberOfLines={1}
                style={{ position: 'absolute', width: 44, left: slot * i + slot / 2 - 22, fontSize: 10 }}>
                {d.label}
              </T>
            ) : null,
          )}
      </View>
    </View>
  );
}

/** Linha suave com área preenchida. Valores ausentes (null) quebram a linha. */
export function LineChart({
  values,
  labels,
  height = 120,
  color,
  min,
  max,
}: {
  values: (number | null)[];
  labels?: string[];
  height?: number;
  color?: string;
  min?: number;
  max?: number;
}) {
  const c = useColors();
  const [w, onLayout] = useWidth();
  const nums = values.filter((v): v is number => v != null);
  const lo = min ?? (nums.length ? Math.min(...nums) : 0);
  const hi = max ?? (nums.length ? Math.max(...nums) : 1);
  const span = hi - lo || 1;
  const col = color ?? c.accent;
  const pad = 6;
  const grow = useGrow(values.join('|'));
  const x = (i: number) => (values.length <= 1 ? w / 2 : pad + ((w - pad * 2) * i) / (values.length - 1));
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - lo) / span);

  let line = '';
  let area = '';
  let open = false;
  let startX = 0;
  values.forEach((v, i) => {
    if (v == null) {
      if (open) area += `L${x(i - 1)},${height} L${startX},${height} Z `;
      open = false;
      return;
    }
    if (!open) {
      line += `M${x(i)},${y(v)} `;
      area += `M${x(i)},${height} L${x(i)},${y(v)} `;
      startX = x(i);
      open = true;
    } else {
      line += `L${x(i)},${y(v)} `;
      area += `L${x(i)},${y(v)} `;
    }
  });
  if (open) area += `L${x(values.length - 1)},${height} L${startX},${height} Z`;

  return (
    <View style={{ gap: space.sm }}>
      <View onLayout={onLayout} style={{ height }}>
        {w > 0 && nums.length > 0 && (
          <GrowFromBottom grow={grow}>
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={col} stopOpacity="0.35" />
                <Stop offset="1" stopColor={col} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#lc)" />
            <Path d={line} stroke={col} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {values.map((v, i) => (v == null ? null : <Circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4 : 2.5} fill={col} />))}
          </Svg>
          </GrowFromBottom>
        )}
        {nums.length === 0 && (
          <T v="caption" tone="faint" align="center" style={{ marginTop: height / 2 - 8 }}>
            Sem dados ainda
          </T>
        )}
      </View>
      {labels ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {labels.map((l, i) => (
            <T key={i} v="caption" tone="faint" style={{ fontSize: 10 }}>
              {l}
            </T>
          ))}
        </View>
      ) : null}
    </View>
  );
}
