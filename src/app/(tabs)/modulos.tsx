import { router, type Href } from 'expo-router';
import { ChevronRight, Settings } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { PressScale } from '@/components/motion';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Badge, IconTile, List, Row, Screen, Section, T, tap } from '@/components/ui';
import { MODULES, moduleHref, SECTIONS } from '@/modules';
import { useSettings } from '@/store/settings';
import { radius, space, useColors } from '@/theme';

export default function Modulos() {
  const c = useColors();
  const disabled = useSettings((s) => s.disabled);
  const active = MODULES.filter((m) => !disabled.includes(m.id));

  return (
    <Screen tab title="Módulos" subtitle={`${active.filter((m) => m.ready).length} ativos · ${active.filter((m) => !m.ready).length} chegando`}>
      {SECTIONS.map((section) => {
        const mods = active.filter((m) => m.section === section);
        if (!mods.length) return null;
        return (
          <Section key={section} title={section}>
            <View style={styles.grid}>
              {mods.map((m, i) => (
                <Animated.View key={m.id} entering={FadeInDown.delay(i * 40).springify().damping(18)} style={styles.tileWrap}>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel={m.name}
                  scaleTo={0.95}
                  onPress={() => {
                    tap();
                    router.push(moduleHref(m) as Href);
                  }}
                  style={{ flex: 1, opacity: m.ready ? 1 : 0.62 }}>
                  <Glass interactive style={styles.tile}>
                  <View style={styles.tileTop}>
                    <IconTile icon={m.icon} color={m.ready ? c.accent : c.textDim} />
                    {m.ready ? <ChevronRight size={16} color={c.textFaint} /> : <Badge label="Em breve" />}
                  </View>
                  <View style={{ gap: 2 }}>
                    <T v="headline" numberOfLines={1}>
                      {m.name}
                    </T>
                    <T v="caption" tone="dim" numberOfLines={2}>
                      {m.description}
                    </T>
                  </View>
                  </Glass>
                </PressScale>
                </Animated.View>
              ))}
            </View>
          </Section>
        );
      })}

      <List>
        <Row leading={<IconTile icon={Settings} color={c.textDim} />} title="Configurações" subtitle="Perfil, cor de destaque e módulos" chevron onPress={() => router.push('/configuracoes')} />
      </List>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tileWrap: { width: '47%', flexGrow: 1 },
  tile: {
    flex: 1,
    minHeight: 132,
    borderRadius: radius.lg,
    padding: space.lg,
    justifyContent: 'space-between',
    gap: space.md,
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
});
