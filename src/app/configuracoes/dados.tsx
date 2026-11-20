import { BackupSection } from '@/components/BackupSection';
import { Screen } from '@/components/ui';

export default function Dados() {
  return (
    <Screen back title="Backup e dados" subtitle="Cópia na nuvem e arquivo para guardar">
      <BackupSection />
    </Screen>
  );
}
