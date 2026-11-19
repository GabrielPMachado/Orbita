import { Compass, House, ListTodo, Repeat2, type LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { FONTS, space, useColors } from '@/theme';
import { Glass } from './Glass';
import { Bounce } from './motion';
import { SPRING } from '@/lib/motionTokens';
import { T, tap } from './ui';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'Hoje', icon: House },
  tarefas: { label: 'Tarefas', icon: ListTodo },
  habitos: { label: 'Hábitos', icon: Repeat2 },
  modulos: { label: 'Módulos', icon: Compass },
};

const ACTIVE_GROW = 1.25;

/**
 * Menu inferior no mesmo desenho do Financy: uma pílula de vidro única, ícone e nome
 * lado a lado, e a aba ativa cresce dentro de uma pílula mais clara. O + (captura
 * rápida) fica no topo das telas, como o "nova transação" do Financy.
 */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, space.md) }]} pointerEvents="box-none">
      <Glass interactive floating style={styles.bar}>
        <View style={styles.inner}>
          {state.routes.map((route, i) => {
            const meta = TABS[route.name];
            if (!meta) return null;
            return (
              <Tab
                key={route.key}
                label={meta.label}
                icon={meta.icon}
                active={state.index === i}
                onPress={() => {
                  if (state.index !== i) {
                    tap();
                    navigateToTab(route.key);
                  }
                }}
              />
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

function Tab({ label, icon: Icon, active, onPress }: { label: string; icon: LucideIcon; active: boolean; onPress: () => void }) {
  const c = useColors();
  const p = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(active ? 1 : 0, SPRING);
  }, [active, p]);

  const grow = useAnimatedStyle(() => ({ flexGrow: interpolate(p.value, [0, 1], [1, ACTIVE_GROW]) }));
  const pill = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: interpolate(p.value, [0, 1], [0.85, 1]) }] }));

  return (
    <Animated.View style={[styles.slot, grow]}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={onPress} style={styles.tab}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pill, pill]} />
        <Bounce trigger={active ? label : null} amount={1.18}>
          <Icon size={18} color={active ? c.text : c.textDim} strokeWidth={active ? 2.3 : 2} />
        </Bounce>
        <T v="caption" numberOfLines={1} color={active ? c.text : c.textDim} style={{ fontSize: 11, fontFamily: FONTS.semibold, flexShrink: 1 }}>
          {label}
        </T>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  bar: { width: '100%', maxWidth: 448, borderRadius: 999, padding: 6, overflow: 'hidden' },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  slot: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
  tab: { height: 44, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2 },
  pill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
});
