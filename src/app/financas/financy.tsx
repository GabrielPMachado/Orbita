import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste, ExternalLink, Link2, Plus, Unplug, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { confirmDelete } from '@/components/extra';
import { AnimatedNumber } from '@/components/motion';
import { Button, Card, Checkbox, Field, IconTile, List, Row, Screen, Section, T } from '@/components/ui';
import { brl } from '@/lib/date';
import { connectFinancy, disconnectFinancy, openFinancy, refreshFinancy, requestFinancyLink } from '@/lib/financy';
import { Advanced } from '@/components/Advanced';
import { pullFinancy, uploadLocalBackup } from '@/lib/financyData';
import { useFinance } from '@/store/finance';
import { useFinancyLink } from '@/store/financyLink';
import { toast } from '@/store/toast';
import { space, useColors } from '@/theme';

const FINANCY = '#10B981';

function ago(iso?: string) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

export default function FinancyScreen() {
  const c = useColors();
  const f = useFinancyLink();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const paste = async () => {
    const v = await Clipboard.getStringAsync().catch(() => '');
    if (v) setKey(v.trim());
  };

  const connect = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await connectFinancy(key);
      setKey('');
      toast({ message: 'Financy conectado' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível conectar.');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    try {
      await Promise.all([refreshFinancy(true), pullFinancy(true)]);
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Falha ao atualizar', kind: 'danger' });
    }
  };

  const s = f.summary;
  const base = useFinance((st) => st.base);
  const backupCount = useFinance((st) => st.localBackup?.txs.length ?? 0);
  const toggleBase = () => {
    const next = base === 'financy' ? 'orbita' : 'financy';
    useFinance.getState().setBase(next);
    f.setBaseOptOut(next === 'orbita');
    if (next === 'financy') pullFinancy(true).catch(() => {});
  };

  return (
    <Screen back title="Financy" subtitle="Seu app de finanças completo" onRefresh={f.connected ? refresh : undefined}>
      {f.connected && s ? (
        <Card onPress={() => openFinancy({ action: 'resumo' })} style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconTile icon={Wallet} color={FINANCY} />
            <View style={{ flex: 1 }}>
              <T v="caption" tone="dim">
                Saldo no Financy
              </T>
              <AnimatedNumber value={s.saldo} format={brl} render={(t) => <T v="title" tabular color={s.saldo < 0 ? c.danger : c.text}>{t}</T>} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: space.lg }}>
            <View style={{ flex: 1 }}>
              <T v="caption" tone="dim">
                Entradas do mês
              </T>
              <T v="headline" tabular color={c.success}>
                {brl(s.entradasMes)}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T v="caption" tone="dim">
                Gastos do mês
              </T>
              <T v="headline" tabular>
                {brl(s.gastosMes)}
              </T>
            </View>
          </View>
          <T v="caption" tone="faint">
            {s.atualizadoEm ? `Atualizado no Financy ${ago(s.atualizadoEm)}` : 'Atualizado agora'}
            {f.lastError ? ` · ${f.lastError}` : ''}
          </T>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Abrir" icon={ExternalLink} onPress={() => openFinancy()} style={{ flex: 1 }} />
        <Button label="Lançar" icon={Plus} variant="secondary" onPress={() => openFinancy({ action: 'novo', tipo: 'expense' })} style={{ flex: 1 }} />
      </View>

      {!f.connected ? (
        <Section title="Conectar">
          <View style={{ gap: space.sm }}>
            <T v="callout" tone="dim">
              Um toque abre o Financy, que devolve a conexão para cá sozinho. Depois disso o Órbita mostra seu saldo do Financy, manda a categoria de cada
              compra do Apple Pay e os dois ficam com a mesma aparência.
            </T>
            <Button label="Conectar com o Financy" icon={Link2} onPress={() => requestFinancyLink()} />
            <Advanced>
              <Field
                label="Chave do Financy"
                value={key}
                onChangeText={setKey}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                placeholder="Cole a chave aqui"
              />
              {error ? (
                <Animated.View entering={FadeIn} exiting={FadeOut}>
                  <T v="caption" color={c.danger}>
                    {error}
                  </T>
                </Animated.View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="Colar" icon={ClipboardPaste} variant="secondary" onPress={paste} style={{ flex: 1 }} />
                <Button label={busy ? 'Conectando…' : 'Conectar'} disabled={busy || !key.trim()} onPress={connect} style={{ flex: 1 }} />
              </View>
            </Advanced>
          </View>
        </Section>
      ) : (
        <>
          <Section title="Interligação">
            <List>
              <Row
                title="Financy como base das Finanças"
                subtitle="Finanças do Órbita mostra e edita os lançamentos do Financy"
                trailing={<Checkbox checked={base === 'financy'} onPress={toggleBase} />}
                onPress={toggleBase}
              />
              <Row
                title="Enviar categorias do Apple Pay"
                subtitle="O Financy aplica a categoria quando a compra chega do banco, sem duplicar"
                trailing={<Checkbox checked={f.forwardApplePay} onPress={() => f.setForward(!f.forwardApplePay)} />}
                onPress={() => f.setForward(!f.forwardApplePay)}
              />
              <Row
                title="Widget com o saldo do Financy"
                subtitle="A tela de bloqueio mostra o saldo do Financy em vez do Órbita"
                trailing={<Checkbox checked={f.widgetFromFinancy} onPress={() => f.setWidgetFromFinancy(!f.widgetFromFinancy)} />}
                onPress={() => f.setWidgetFromFinancy(!f.widgetFromFinancy)}
              />
              {f.pendingHints.length > 0 && (
                <Row title={`${f.pendingHints.length} compra${f.pendingHints.length > 1 ? 's' : ''} aguardando envio`} subtitle="Vão sozinhas quando houver internet" subtitleTone="warning" />
              )}
            </List>
          </Section>
          <Advanced>
            {backupCount > 0 && base === 'financy' ? (
              <Button
                label={`Enviar ${backupCount} lançamento${backupCount > 1 ? 's' : ''} antigo${backupCount > 1 ? 's' : ''} do Órbita`}
                variant="secondary"
                onPress={() => {
                  const n = uploadLocalBackup();
                  toast({ message: `${n} lançamento${n === 1 ? '' : 's'} enviado${n === 1 ? '' : 's'} ao Financy` });
                }}
              />
            ) : null}
            <Button
              label="Desconectar"
              icon={Unplug}
              variant="danger"
              onPress={() =>
                confirmDelete('Desconectar o Financy?', 'A chave sai do Keychain. Nada é apagado no Financy.', () => disconnectFinancy(), 'Desconectar')
              }
            />
          </Advanced>
        </>
      )}
    </Screen>
  );
}
