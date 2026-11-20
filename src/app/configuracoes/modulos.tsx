import { Switch, View } from 'react-native';
import { Badge, IconTile, List, Row, Screen, Section } from '@/components/ui';
import { MODULES, SECTIONS } from '@/modules';
import { useSettings } from '@/store/settings';
import { space, useColors } from '@/theme';

export default function Modulos() {
  const c = useColors();
  const disabled = useSettings((s) => s.disabled);
  const toggleModule = useSettings((s) => s.toggleModule);
  return (
    <Screen back title="Módulos" subtitle="Escolha o que aparece no app">
      {SECTIONS.map((section) => (
        <Section key={section} title={section}>
          <List>
            {MODULES.filter((m) => m.section === section).map((m) => (
              <Row
                key={m.id}
                leading={<IconTile icon={m.icon} color={disabled.includes(m.id) ? c.textFaint : c.accent} />}
                title={m.name}
                subtitle={m.description}
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    {!m.ready && <Badge label="Em breve" />}
                    <Switch
                      value={!disabled.includes(m.id)}
                      onValueChange={() => toggleModule(m.id)}
                      trackColor={{ true: c.accent, false: c.surface3 }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor={c.surface3}
                    />
                  </View>
                }
              />
            ))}
          </List>
        </Section>
      ))}
    </Screen>
  );
}
