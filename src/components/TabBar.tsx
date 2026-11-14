import { Compass, House, ListTodo, Plus, Repeat2, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useUI } from '@/store/ui';
import { FONTS, space, useColors } from '@/theme';
import { Glass, GlassGroup } from './Glass';
import { Bounce, PressScale, SPRING } from './motion';
import { impact, T, tap } from './ui';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Hoje', icon: House },
  tarefas: { label: 'Tarefas', icon: ListTodo },
  habitos: { label: 'Hábitos', icon: Repeat2 },
  modulos: { label: 'Módulos', icon: Compass },
};

/** Tab bar flutuante em vidro + botão de criação separado (padrão iOS 26). */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const setCapture = useUI((s) => s.setCapture);
  const [w, setW] = useState(0);
  const count = state.routes.filter((r) => TABS[r.name]).length;
  const slot = w / Math.max(1, count);
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = w ? withSpring(state.index * slot, SPRING) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, slot]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <GlassGroup spacing={12} style={[styles.wrap, { bottom: Math.max(insets.bottom - 8, space.md) }]}>
      <Glass interactive floating style={styles.bar}>
        <View style={styles.inner} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {/* indicador que desliza até a aba ativa */}
        {slot > 0 && <Animated.View pointerEvents="none" style={[styles.pill, { width: slot }, pill]} />}
        {state.routes.map((route, i) => {
          const meta = TABS[route.name];
          if (!meta) return null;
          const active = state.index === i;
          const Icon = meta.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={meta.label}
              onPress={() => {
                if (!active) {
                  tap();
                  navigateToTab(route.key);
                }
              }}
              style={styles.tab}>
              <Bounce trigger={active ? route.key : null} amount={1.22}>
                <Icon size={22} color={active ? c.accent : c.textDim} strokeWidth={active ? 2.3 : 1.9} />
              </Bounce>
              <T v="caption" color={active ? c.text : c.textDim} style={{ fontSize: 10, fontFamily: active ? FONTS.bold : FONTS.semibold }}>
                {meta.label}
              </T>
            </Pressable>
          );
        })}
        </View>
      </Glass>

      <PressScale
        accessibilityRole="button"
        accessibilityLabel="Nova tarefa"
        scaleTo={0.86}
        onPress={() => {
          impact();
          setCapture(true);
        }}>
        <Glass interactive floating tint={c.accent} style={styles.plus}>
          <View>
            <Plus size={26} color={c.onAccent} strokeWidth={2.6} />
          </View>
        </Glass>
      </PressScale>
    </GlassGroup>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bar: { flex: 1, height: 64, borderRadius: 32, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  inner: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 52 },
  pill: { position: 'absolute', top: 0, left: 0, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.10)' },
  tab: { flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', gap: 2 },
  plus: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
