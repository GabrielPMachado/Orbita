import { KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { StatusBadge, useConnections, type Conn } from '@/components/connections';
import { Button, Field, IconTile, List, Row, Screen, Section, T } from '@/components/ui';
import { saveTmdbKey } from '@/lib/tmdb';
import { useEstacio } from '@/store/estacio';
import { toast } from '@/store/toast';
import { space, useColors } from '@/theme';

export default function Conexoes() {
  const c = useColors();
  const conns = useConnections();
  const auto = useEstacio((s) => s.auto);
  const setEst = useEstacio((s) => s.set);
  const [tmdbOpen, setTmdbOpen] = useState(false);
  const [tmdbKey, setTmdbKey] = useState('');
  const [saving, setSaving] = useState(false);

  const groups = [...new Set(conns.map((x) => x.group))];
  const salvarTmdb = async () => {
    setSaving(true);
    try {
      await saveTmdbKey(tmdbKey);
      setTmdbKey('');
      setTmdbOpen(false);
      toast({ message: 'TMDB conectado' });
    } catch (e) {
      toast({ message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };
  const row = (x: Conn) => (
    <Row
      key={x.id}
      leading={<IconTile icon={x.icon} color={x.status === 'off' ? c.textFaint : x.color} />}
      title={x.name}
      subtitle={x.detail}
      subtitleTone={x.status === 'warn' ? 'warning' : 'dim'}
      trailing={<StatusBadge status={x.status} />}
      onPress={x.id === 'tmdb' && x.status === 'off' ? () => setTmdbOpen((o) => !o) : x.onPress}
    />
  );

  return (
    <Screen back title="Contas e conexões" subtitle="Logins, chaves e permissões do app">
      {groups.map((g) => (
        <Section key={g} title={g}>
          <List>
            {conns.filter((x) => x.group === g).map(row)}
            {g === 'Faculdade' ? (
              <Row
                title="Ler pelo app também"
                subtitle="Uma vez por dia, com o app aberto, se a nuvem não tiver lido"
                trailing={<Switch value={auto} onValueChange={(v) => setEst({ auto: v })} trackColor={{ true: c.accent, false: c.surface3 }} />}
              />
            ) : null}
          </List>
          {g === 'Filmes e séries' && tmdbOpen ? (
            <View style={{ gap: space.sm }}>
              <Field
                label="Chave do TMDB"
                value={tmdbKey}
                onChangeText={setTmdbKey}
                placeholder="Token de leitura ou chave da API"
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              <Button
                label={saving ? 'Testando…' : 'Salvar chave'}
                icon={KeyRound}
                onPress={salvarTmdb}
                disabled={saving || tmdbKey.trim().length < 20}
              />
              <T v="caption" tone="faint">
                Em themoviedb.org › Configurações › API, copie o "Token de leitura da API".
              </T>
            </View>
          ) : null}
        </Section>
      ))}

      <T v="caption" tone="faint">
        Senhas e chaves ficam no Keychain do iPhone. O Órbita nunca pede a senha do banco: as finanças vêm do Financy e do Open Finance.
      </T>
    </Screen>
  );
}
