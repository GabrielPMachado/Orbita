import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { space, useColors } from '@/theme';
import { GrowFromBottom, useGrow } from './motion';
import { T } from './ui';

export interface BarDatum {
  label: string;
  income: number;
  expense: number;
  highlight?: boolean;
}

/** Barras agrupadas (entradas × saídas) desenhadas em SVG. */
export function BarChart({ data, height = 140 }: { data: BarDatum[]; height?: number }) {
  const c = useColors();
  const [w, setW] = useState(0);
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const slot = w / Math.max(1, data.length);
  const bar = Math.min(14, slot / 3.2);
  const gap = 4;
  const grow = useGrow(data.map((d) => `${d.income}:${d.expense}`).join('|'));

  return (
    <View style={{ gap: space.sm }}>
      <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height }}>
        {w > 0 && (
          <GrowFromBottom grow={grow}>
            <Svg width={w} height={height}>
              {[0.5, 1].map((f) => (
                <Line
                  key={f}
                  x1={0}
                  x2={w}
                  y1={height - (height - 4) * f}
                  y2={height - (height - 4) * f}
                  stroke={c.separator}
                  strokeWidth={1}
                  strokeDasharray="3 5"
                />
              ))}
              {data.map((d, i) => {
                const cx = slot * i + slot / 2;
                const hi = Math.max(d.income ? 3 : 0, ((height - 4) * d.income) / max);
                const o = d.highlight ? 1 : 0.45;
                return (
                  <Rect
                    key={'i' + i}
                    x={cx - bar - gap / 2}
                    y={height - hi}
                    width={bar}
                    height={hi}
                    rx={Math.min(4, bar / 2)}
                    fill={c.success}
                    opacity={o}
                  />
                );
              })}
              {data.map((d, i) => {
                const cx = slot * i + slot / 2;
                const he = Math.max(d.expense ? 3 : 0, ((height - 4) * d.expense) / max);
                const o = d.highlight ? 1 : 0.45;
                return (
                  <Rect
                    key={'e' + i}
                    x={cx + gap / 2}
                    y={height - he}
                    width={bar}
                    height={he}
                    rx={Math.min(4, bar / 2)}
                    fill={c.danger}
                    opacity={o}
                  />
                );
              })}
            </Svg>
          </GrowFromBottom>
        )}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {data.map((d) => (
          <T key={d.label} v="caption" tone={d.highlight ? 'default' : 'faint'} align="center" style={{ flex: 1, fontSize: 11 }}>
            {d.label}
          </T>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.lg, justifyContent: 'center' }}>
        <Legend color={c.success} label="Entradas" />
        <Legend color={c.danger} label="Saídas" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
      <T v="caption" tone="dim">
        {label}
      </T>
    </View>
  );
}
