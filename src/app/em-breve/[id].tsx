import { useLocalSearchParams } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { View } from 'react-native';
import { Glass } from '@/components/Glass';
import { Badge, Screen, T } from '@/components/ui';
import { getModule } from '@/modules';
import { radius, space, useColors } from '@/theme';

export default function EmBreve() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mod = getModule(id);
  const Icon = mod?.icon ?? Sparkles;
  return (
    <Screen back scroll={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingBottom: 96 }}>
        <Glass
          interactive
          tint={c.accent + '26'}
          style={{ width: 96, height: 96, borderRadius: radius.lg + 8, alignItems: 'center', justifyContent: 'center' }}>
          <View>
            <Icon size={44} color={c.accent} strokeWidth={1.6} />
          </View>
        </Glass>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Badge label="Em construção" color={c.accent} />
          <T v="largeTitle" align="center">
            {mod?.name ?? 'Módulo'}
          </T>
          <T v="body" tone="dim" align="center" style={{ maxWidth: 300 }}>
            {mod?.description} Este módulo chega numa próxima versão.
          </T>
        </View>
      </View>
    </Screen>
  );
}
