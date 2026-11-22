import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { CreditCard, ExternalLink, KeyRound, Landmark, LockKeyhole, Unplug } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Advanced } from '@/components/Advanced';
import { confirmDelete } from '@/components/extra';
import { Badge, Button, Card, Checkbox, Field, IconTile, List, Row, Screen, Section, Sheet, T, tap } from '@/components/ui';
import { brl } from '@/lib/date';
import { connectPluggy, forgetPluggy, syncPluggy } from '@/lib/pluggySync';
import { useFinance } from '@/store/finance';
import { usePluggy, type LinkedAccount } from '@/store/pluggy';
import { toast } from '@/store/toast';
import { radius, space, useColors } from '@/theme';

const STEPS = [
  'Em meu.pluggy.ai, conecte seus bancos e cartões (Open Finance, direto no app do banco).',
  'No Pluggy Dashboard, crie uma aplicação e, em Demo → Connect Account, escolha “MeuPluggy”.',
  'Copie o Client ID, o Client Secret e o Item ID de cada conexão.',
  'Cole tudo aqui embaixo. O resto o Órbita faz sozinho.',
];

export default function PluggySetup() {
  const c = useColors();
  const p = usePluggy();
  const { accounts: localAccounts, cards, base } = useFinance();
  /** com o Financy como base não há contas no Órbita: as contas do banco conferem por valor e data */
  const fy = base === 'financy';
  const [editing, setEditing] = useState(!p.configured);
  const [clientId, setClientId] = useState('');
  const [secret, setSecret] = useState('');
  const [items, setItems] = useState(p.itemIds.join('\n'));
  const [busy, setBusy] = useState<'connect' | 'sync' | null>(null);
  const [error, setError] = useState<string>();
  const [linking, setLinking] = useState<LinkedAccount | null>(null);

  const open = (url: string) => WebBrowser.openBrowserAsync(url, { controlsColor: c.accent }).catch(() => {});

  const connect = async () => {
    const ids = items.split(/[\s,;]+/).filter(Boolean);
    if (!clientId.trim() || !secret.trim() || !ids.length) {
      setError('Preencha o Client ID, o Client Secret e pelo menos um Item ID.');
      return;
    }
    setBusy('connect');
    setError(undefined);
    try {
      const n = await connectPluggy(clientId, secret, ids);
      setSecret('');
      setClientId('');
      setEditing(false);
      toast({ message: `Conectado · ${n} conta${n === 1 ? '' : 's'} encontrada${n === 1 ? '' : 's'}` });
      syncPluggy().catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível conectar.');
    } finally {
      setBusy(null);
    }
  };

  const linkName = (a: LinkedAccount) => {
    if (!a.enabled) return 'Fora da conferência';
    const local = a.kind === 'CREDIT' ? cards.find((x) => x.id === a.localCardId)?.name : localAccounts.find((x) => x.id === a.localAccountId)?.name;
    if (local) return `Vinculada a ${local}`;
    if (a.kind !== 'CREDIT' && (fy || !localAccounts.length)) return 'Conferida por valor e data';
    return 'Sem vínculo — toque para escolher';
  };

  const options = linking
    ? linking.kind === 'CREDIT'
      ? cards.map((x) => ({ id: x.id, name: x.name, color: x.color }))
      : localAccounts.map((x) => ({ id: x.id, name: x.name, color: x.color }))
    : [];
  const chosen = linking ? (linking.kind === 'CREDIT' ? linking.localCardId : linking.localAccountId) : undefined;
  const choose = (id?: string) => {
    if (!linking) return;
    tap();
    p.linkAccount(linking.id, linking.kind === 'CREDIT' ? { localCardId: id } : { localAccountId: id });
    setLinking(null);
  };

  return (
    <Screen back title="Meu Pluggy" subtitle="Conferência com o banco via Open Finance">
      {!p.configured && (
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconTile icon={Landmark} color={c.info} />
            <View style={{ flex: 1 }}>
              <T v="headline">Como funciona</T>
              <T v="caption" tone="dim">
                Uso pessoal é gratuito, até 5 conexões
              </T>
            </View>
          </View>
          {STEPS.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: space.md }}>
              <View style={[styles.num, { backgroundColor: c.accent + '26' }]}>
                <T v="caption" color={c.accent}>
                  {i + 1}
                </T>
              </View>
              <T v="callout" tone="dim" style={{ flex: 1 }}>
                {s}
              </T>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Meu Pluggy" icon={ExternalLink} variant="secondary" onPress={() => open('https://meu.pluggy.ai')} style={{ flex: 1 }} />
            <Button
              label="Dashboard"
              icon={ExternalLink}
              variant="secondary"
              onPress={() => open('https://dashboard.pluggy.ai')}
              style={{ flex: 1 }}
            />
          </View>
        </Card>
      )}

      {p.configured && !editing ? (
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconTile icon={LockKeyhole} color={c.success} />
            <View style={{ flex: 1 }}>
              <T v="headline">Conectado</T>
              <T v="caption" tone="dim">
                Credenciais guardadas no Keychain do iPhone
              </T>
            </View>
            <Badge label={`${p.itemIds.length} conexão${p.itemIds.length === 1 ? '' : 'ões'}`} color={c.success} />
          </View>
          {p.lastError ? (
            <T v="caption" color={c.danger}>
              {p.lastError}
            </T>
          ) : null}
          <T v="caption" tone="faint">
            Sincroniza sozinho ao abrir o app. Para atualizar na hora, puxe a tela da Conferência para baixo.
          </T>
        </Card>
      ) : (
        <Section title="Credenciais">
          <View style={{ gap: space.sm }}>
            <Field
              label="Client ID"
              value={clientId}
              onChangeText={setClientId}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="xxxxxxxx-xxxx-…"
            />
            <Field
              label="Client Secret"
              value={secret}
              onChangeText={setSecret}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder="••••••••"
            />
            <Field
              label="Item IDs (um por linha)"
              value={items}
              onChangeText={setItems}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              placeholder="ex.: 7d1c…-nubank"
              style={{ minHeight: 72 }}
            />
            {error ? (
              <Animated.View entering={FadeIn} exiting={FadeOut}>
                <T v="caption" color={c.danger}>
                  {error}
                </T>
              </Animated.View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {p.configured && <Button label="Cancelar" variant="secondary" onPress={() => setEditing(false)} style={{ flex: 1 }} />}
              <Button label={busy === 'connect' ? 'Conectando…' : 'Conectar'} disabled={!!busy} onPress={connect} style={{ flex: 1 }} />
            </View>
            {busy === 'connect' && <ActivityIndicator color={c.accent} />}
            <T v="caption" tone="faint">
              O Client Secret fica só no Keychain deste iPhone. O Órbita nunca vê a senha do seu banco.
            </T>
          </View>
        </Section>
      )}

      {p.accounts.length > 0 && (
        <Section title="Contas do banco">
          <List>
            {p.accounts.map((a) => (
              <Row
                key={a.id}
                leading={<IconTile icon={a.kind === 'CREDIT' ? CreditCard : Landmark} color={a.color ?? c.info} />}
                title={`${a.bank} · ${a.name}`}
                subtitle={linkName(a)}
                subtitleTone={
                  !a.enabled ? 'faint' : (a.kind === 'CREDIT' ? a.localCardId : a.localAccountId || fy || !localAccounts.length) ? 'dim' : 'warning'
                }
                trailing={
                  <T v="callout" tabular tone={a.enabled ? 'default' : 'faint'}>
                    {brl(a.balance)}
                  </T>
                }
                onPress={() => setLinking(a)}
              />
            ))}
          </List>
          <T v="caption" tone="faint">
            Vincular diz ao Órbita qual conta ou cartão daqui corresponde a cada conta do banco. Isso deixa a conferência mais precisa.
          </T>
        </Section>
      )}

      {p.configured && (
        <Section title="Preferências">
          <List>
            <Row
              title="Sincronizar sozinho"
              subtitle="Ao abrir o app, no máximo a cada 6 horas"
              trailing={<Checkbox checked={p.autoSync} onPress={() => p.setAutoSync(!p.autoSync)} />}
              onPress={() => p.setAutoSync(!p.autoSync)}
            />
            <Row title="Abrir a conferência" onPress={() => router.push('/financas/conferencia')} chevron />
          </List>
          <Advanced>
            <Button label="Trocar chaves" icon={KeyRound} variant="secondary" onPress={() => setEditing(true)} />
            <Button
              label="Desconectar"
              icon={Unplug}
              variant="danger"
              onPress={() =>
                confirmDelete(
                  'Desconectar o Meu Pluggy?',
                  'As chaves saem do Keychain. Lançamentos já conferidos continuam com o selo.',
                  () => {
                    forgetPluggy();
                    setEditing(true);
                  },
                  'Desconectar',
                )
              }
            />
          </Advanced>
        </Section>
      )}

      <Sheet visible={!!linking} onClose={() => setLinking(null)} title={linking ? `${linking.bank} · ${linking.name}` : ''}>
        <View style={{ gap: space.sm }}>
          <T v="callout" tone="dim">
            {linking?.kind === 'CREDIT' ? 'Qual cartão do Órbita é este?' : 'Qual conta do Órbita é esta?'}
          </T>
          <List>
            {options.map((o) => (
              <Row
                key={o.id}
                leading={<View style={[styles.dot, { backgroundColor: o.color }]} />}
                title={o.name}
                trailing={<Checkbox checked={chosen === o.id} onPress={() => choose(o.id)} />}
                onPress={() => choose(o.id)}
              />
            ))}
            <Row
              title="Nenhuma"
              subtitle="Confere só por valor e data"
              trailing={<Checkbox checked={!chosen} onPress={() => choose(undefined)} />}
              onPress={() => choose(undefined)}
            />
          </List>
          {!options.length && (
            <T v="caption" tone="faint">
              {linking?.kind === 'CREDIT'
                ? fy
                  ? 'Os cartões vêm do Financy: cadastre lá, em Ajustes › Cartões de crédito.'
                  : 'Cadastre seus cartões em Finanças → Cartões.'
                : fy
                  ? 'Com o Financy como base, as contas vêm dele e esta conta é conferida por valor e data. Não precisa vincular.'
                  : 'Cadastre suas contas em Finanças → Contas.'}
            </T>
          )}
          <Pressable
            onPress={() => {
              if (!linking) return;
              p.linkAccount(linking.id, { enabled: !linking.enabled });
              setLinking(null);
            }}
            style={{ paddingVertical: space.md, alignItems: 'center' }}>
            <T v="callout" color={linking?.enabled ? c.danger : c.accent}>
              {linking?.enabled ? 'Tirar esta conta da conferência' : 'Voltar a conferir esta conta'}
            </T>
          </Pressable>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = {
  num: { width: 22, height: 22, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
} as const;
