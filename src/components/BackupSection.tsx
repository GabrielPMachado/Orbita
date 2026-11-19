import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloudDownload, CloudUpload, FileDown, FileUp } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { cloudBackup, cloudInfo, cloudRestore, exportFile, importFile } from '@/lib/backup';
import { useFinancyLink } from '@/store/financyLink';
import { toast } from '@/store/toast';
import { useColors } from '@/theme';
import { Advanced } from './Advanced';
import { IconTile, List, Row, Section } from './ui';

const quando = (t?: number) => (t ? new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null);
const erro = (e: unknown) => Alert.alert('Não deu', e instanceof Error ? e.message : 'Tente de novo.');

/** Configurações › Seus dados: backup na conta do Financy e em arquivo. */
export function BackupSection() {
  const c = useColors();
  const connected = useFinancyLink((s) => s.connected);
  const [cloudAt, setCloudAt] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!connected) return;
    cloudInfo()
      .then((i) => setCloudAt(i?.at))
      .catch(() => {
        AsyncStorage.getItem('orbita-backup-meta').then((v) => v && setCloudAt(JSON.parse(v).cloudAt));
      });
  }, [connected]);

  return (
    <Section title="Seus dados">
      <List>
        <Row
          leading={<IconTile icon={CloudUpload} color={connected ? c.success : c.textDim} />}
          title={connected ? 'Backup automático ligado' : 'Backup automático desligado'}
          subtitle={
            connected
              ? busy
                ? 'Salvando…'
                : cloudAt
                  ? `Último: ${quando(cloudAt)} · toque para salvar agora`
                  : 'Toque para salvar agora'
              : 'Conecte o Financy: o backup fica na sua conta e volta sozinho numa reinstalação'
          }
          onPress={async () => {
            if (!connected) return;
            setBusy(true);
            try {
              await cloudBackup(true);
              setCloudAt(Date.now());
              toast({ message: 'Backup salvo na sua conta' });
            } catch (e) {
              erro(e);
            } finally {
              setBusy(false);
            }
          }}
        />
        <Row
          leading={<IconTile icon={FileDown} color={c.accent} />}
          title="Exportar backup"
          subtitle="Arquivo .json para guardar onde quiser"
          onPress={() => exportFile().catch(erro)}
          chevron
        />
      </List>
      <Advanced label="Restaurar">
        <List>
          {connected ? (
            <Row
              leading={<IconTile icon={CloudDownload} color={c.warning} />}
              title="Restaurar da conta"
              subtitle={cloudAt ? `Backup de ${quando(cloudAt)}` : 'Usa o último backup salvo'}
              onPress={() =>
                Alert.alert('Restaurar da conta?', 'Os dados atuais do Órbita serão substituídos pelo backup.', [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Restaurar', style: 'destructive', onPress: () => cloudRestore().catch(erro) },
                ])
              }
            />
          ) : null}
          <Row
            leading={<IconTile icon={FileUp} color={c.warning} />}
            title="Importar arquivo"
            subtitle="Um backup .json exportado antes"
            onPress={() => importFile().catch(erro)}
          />
        </List>
      </Advanced>
    </Section>
  );
}
