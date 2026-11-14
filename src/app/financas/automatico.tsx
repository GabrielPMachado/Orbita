import { BadgeCheck, CircleCheck, CircleDashed, Landmark, Smartphone, Zap } from 'lucide-react-native';
import { router } from 'expo-router';
import { View } from 'react-native';
import { TxRow } from '@/components/finance';
import { Badge, Card, Empty, IconTile, List, Screen, Section, T } from '@/components/ui';
import { autoCaptureAvailable } from '@/lib/autoCapture';
import { useFinance } from '@/store/finance';
import { usePluggy } from '@/store/pluggy';
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
  const pluggy = usePluggy((s) => s.configured);
  const txs = useFinance((s) => s.txs);
  const recent = txs.filter((t) => t.source === 'applepay').slice(0, 10);
  const cards = useFinance((s) => s.cards);

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
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
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

      <Section title="Conferência com o banco">
        <Card onPress={() => router.push(pluggy ? '/financas/conferencia' : '/financas/pluggy')} style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconTile icon={Landmark} color={c.info} />
            <View style={{ flex: 1 }}>
              <T v="headline">Meu Pluggy</T>
              <T v="caption" tone="dim">
                Open Finance · {pluggy ? 'conectado' : 'toque para conectar'}
              </T>
            </View>
            <Badge label={pluggy ? 'Ativo' : 'Configurar'} color={pluggy ? c.success : undefined} />
          </View>
          <T v="callout" tone="dim">
            O extrato oficial confere cada compra registrada pelo Apple Pay. O que bater ganha o selo de verificado; o que só existir no banco
            (cartão físico, Pix, débito automático) vira sugestão de lançamento.
          </T>
          <View style={{ flexDirection: 'row', gap: space.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Zap size={14} color={c.textDim} />
              <T v="caption" tone="dim">
                Apple Pay: na hora
              </T>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <BadgeCheck size={14} color={c.success} />
              <T v="caption" tone="dim">
                Banco: confirma depois
              </T>
            </View>
          </View>
        </Card>
      </Section>
    </Screen>
  );
}
