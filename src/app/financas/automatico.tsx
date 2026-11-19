import { CircleCheck, CircleDashed, RefreshCw, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { TxRow } from '@/components/finance';
import { Button, Card, Empty, IconTile, List, Row, Screen, Section, T } from '@/components/ui';
import { autoCaptureAvailable, checkPendingPurchases } from '@/lib/autoCapture';
import { toast } from '@/store/toast';
import { useFinance } from '@/store/finance';
import { space, useColors } from '@/theme';

const STEPS = [
  { title: 'Abra o app Atalhos', body: 'Vá em Automação e toque em + (Nova Automação).' },
  { title: 'Escolha “Transação”', body: 'É o gatilho da Carteira. Marque os cartões que quer acompanhar (ou todos).' },
  { title: 'Deixe escondido', body: 'Selecione “Executar Imediatamente” e desligue “Notificar ao Executar”.' },
  { title: 'Adicione a ação do Órbita', body: 'Nova Automação em Branco → Adicionar Ação → busque “Órbita” → “Registrar compra”.' },
  {
    title: 'Ligue as variáveis',
    body: 'Valor → “Valor”; Estabelecimento → “Comerciante”; Cartão → “Cartão ou Passe”. Deixe Categoria em “Perguntar Sempre”.',
  },
  { title: 'Pronto', body: 'Ao pagar com o iPhone, o iOS pergunta só a categoria. O resto é salvo sozinho, sem abrir o app.' },
];

export default function Automatico() {
  const c = useColors();
  const txs = useFinance((s) => s.txs);
  const recent = txs.filter((t) => t.source === 'applepay').slice(0, 10);
  const cards = useFinance((s) => s.cards);
  const log = useFinance((s) => s.intentLog ?? []);
  const [checking, setChecking] = useState(false);
  const check = async () => {
    setChecking(true);
    try {
      const r = await checkPendingPurchases();
      toast({
        message: r.pending
          ? `${r.added} compra${r.added === 1 ? '' : 's'} importada${r.added === 1 ? '' : 's'}`
          : 'Nenhuma compra na fila. A automação não chegou a rodar.',
        kind: r.pending ? 'success' : 'info',
      });
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Não foi possível ler a fila', kind: 'danger' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen back title="Automático" subtitle="Compras do Apple Pay entram sozinhas">
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconTile icon={autoCaptureAvailable ? CircleCheck : CircleDashed} color={autoCaptureAvailable ? c.success : c.warning} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <T v="headline">{autoCaptureAvailable ? 'Pronto para receber compras' : 'Disponível no app instalado'}</T>
          <T v="caption" tone="dim">
            {autoCaptureAvailable
              ? 'Configure a automação uma vez no Atalhos e esqueça.'
              : 'A ação “Registrar compra” só existe no .ipa instalado pelo Sideloadly, não no Expo Go.'}
          </T>
        </View>
      </Card>

      <Section title="Configurar uma vez">
        <List>
          {STEPS.map((s, i) => (
            <View key={s.title} style={{ flexDirection: 'row', gap: space.md, padding: space.lg }}>
              <View
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <T v="caption" tone="accent" tabular>
                  {i + 1}
                </T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="headline">{s.title}</T>
                <T v="callout" tone="dim">
                  {s.body}
                </T>
              </View>
            </View>
          ))}
        </List>
        <T v="caption" tone="faint">
          Dica: dê aos seus cartões no Órbita o mesmo nome que aparece na Carteira (ex.: “Nubank”). Assim a compra já cai na fatura certa.
          {cards.length ? '' : ' Você ainda não cadastrou cartões.'}
        </T>
      </Section>

      <Section title="Últimas compras automáticas">
        {recent.length ? (
          <List>
            {recent.map((t) => (
              <TxRow key={t.id} tx={t} showDate />
            ))}
          </List>
        ) : (
          <Empty icon={Smartphone} title="Nenhuma ainda" hint="Assim que você pagar com o iPhone, a compra aparece aqui." />
        )}
      </Section>

      <Section title="Diagnóstico">
        <Button
          label={checking ? 'Verificando…' : 'Verificar compras pendentes'}
          icon={RefreshCw}
          variant="secondary"
          disabled={checking || !autoCaptureAvailable}
          onPress={check}
        />
        {log.length ? (
          <List>
            {log.map((e) => (
              <Row
                key={e.at}
                title={`${e.valor || '(sem valor)'} · ${e.categoria || 'sem categoria'}`}
                subtitle={`${new Date(e.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${e.estabelecimento || 'sem estabelecimento'} · ${e.cartao || 'sem cartão'}`}
                subtitleTone={e.ok ? 'dim' : 'warning'}
              />
            ))}
          </List>
        ) : (
          <T v="caption" tone="faint">
            Nenhuma compra recebida do Atalhos ainda. Depois de uma compra por aproximação, se nada aparecer aqui, a automação não rodou.
          </T>
        )}
      </Section>

      <Card style={{ gap: space.xs }}>
        <T v="headline">Para onde vai a compra</T>
        <T v="callout" tone="dim">
          O Órbita não grava lançamentos: a compra do Apple Pay vai para o Financy com a categoria escolhida. Quando o banco traz a mesma compra
          (mesmo valor, até 2 dias depois), o Financy aplica essa categoria nela.
        </T>
      </Card>
    </Screen>
  );
}
