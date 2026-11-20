import { Appearance } from '@/components/Appearance';
import { Screen } from '@/components/ui';

export default function AparenciaScreen() {
  return (
    <Screen back title="Aparência" subtitle="Cor, tema, ícones e ícone do app">
      <Appearance />
    </Screen>
  );
}
