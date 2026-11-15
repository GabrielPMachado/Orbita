/** Área "Avançado" fechada por padrão: chaves e ajustes técnicos ficam aqui, fora da vista. */
import { ChevronDown } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { T, tap } from './ui';
import { space, useColors } from '@/theme';

export function Advanced({ children, label = 'Avançado' }: { children: ReactNode; label?: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const rot = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg') }] }));
  return (
    <View style={{ gap: space.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          tap();
          setOpen(!open);
        }}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: space.sm }}>
        <T v="caption" tone="faint">
          {label}
        </T>
        <Animated.View style={rot}>
          <ChevronDown size={14} color={c.textFaint} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ gap: space.md }}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}
