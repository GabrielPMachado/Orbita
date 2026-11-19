import { useLocalSearchParams } from 'expo-router';
import { BadgeCheck, CalendarDays, CreditCard, ExternalLink, Landmark, Layers, Repeat, Smartphone } from 'lucide-react-native';
import { openFinancy } from '@/lib/financy';
import { View } from 'react-native';
import { Card, GlassButton, IconTile, List, Row, Screen, Section, T } from '@/components/ui';
import { brl, friendlyDate } from '@/lib/date';
import { category, invoiceMonth, monthName } from '@/lib/finance';
import { useFinance } from '@/store/finance';
import { space, useColors } from '@/theme';

export default function Lancamento() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tx = useFinance((s) => s.txs.find((t) => t.id === id));
  const account = useFinance((s) => s.accounts.find((a) => a.id === tx?.accountId));
  const card = useFinance((s) => s.cards.find((k) => k.id === tx?.cardId));
  const groupCount = useFinance((s) => (tx?.group ? s.txs.filter((t) => t.group === tx.group && t.date >= tx.date).length : 0));

  if (!tx) return null;
  const cat = category(tx.category, tx.type);

  return (
    <Screen back actions={<GlassButton icon={ExternalLink} label="Financy" onPress={() => openFinancy()} />}>
      <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
        <IconTile icon={cat.icon} color={cat.color} size={64} />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <T v="callout" tone="dim">
            {tx.description || tx.category}
            {tx.installment ? ` · parcela ${tx.installment.n}/${tx.installment.total}` : ''}
          </T>
          <T v="largeTitle" tabular color={tx.type === 'in' ? c.success : c.text} style={{ fontSize: 40, lineHeight: 48 }}>
            {tx.type === 'in' ? '+ ' : '− '}
            {brl(tx.amount)}
          </T>
        </View>
      </View>

      <List>
        <Row leading={<IconTile icon={cat.icon} color={cat.color} />} title={tx.category} subtitle="Categoria" />
        <Row
          leading={<IconTile icon={CalendarDays} color={c.textDim} />}
          title={friendlyDate(tx.date)}
          subtitle={tx.date.split('-').reverse().join('/')}
        />
        {account && <Row leading={<IconTile icon={Landmark} color={account.color} />} title={account.name} subtitle="Conta" />}
        {card && (
          <Row
            leading={<IconTile icon={CreditCard} color={card.color} />}
            title={card.name}
            subtitle={`Fatura de ${monthName(invoiceMonth(tx.date, card)).toLowerCase()}`}
          />
        )}
        {tx.installment && (
          <Row
            leading={<IconTile icon={Layers} color={c.textDim} />}
            title={`Parcela ${tx.installment.n} de ${tx.installment.total}`}
            subtitle={`Total da compra ${brl(tx.amount * tx.installment.total)}`}
          />
        )}
        {tx.source === 'applepay' && (
          <Row leading={<IconTile icon={Smartphone} color={c.accent} />} title="Registrado pelo Apple Pay" subtitle="Automação do Atalhos" />
        )}
        {tx.verified && <Row leading={<IconTile icon={BadgeCheck} color={c.success} />} title="Conferido com o banco" subtitle="Open Finance" />}
        {tx.fixed && (
          <Row leading={<IconTile icon={Repeat} color={c.textDim} />} title="Lançamento fixo mensal" subtitle={`${groupCount} a partir deste`} />
        )}
      </List>

      {tx.cardId ? (
        <Card style={{ gap: 2 }}>
          <T v="headline">Compra no cartão</T>
          <T v="caption" tone="dim">
            Sai do saldo quando a fatura vence, não na data da compra.
          </T>
        </Card>
      ) : (
        <Card style={{ gap: 2 }}>
          <T v="headline">{tx.paid ? (tx.type === 'in' ? 'Recebido' : 'Pago') : tx.type === 'in' ? 'A receber' : 'A pagar'}</T>
          <T v="caption" tone="dim">
            {tx.paid ? 'Já entrou no saldo atual' : 'Ainda pendente — não entra no saldo atual'}
          </T>
        </Card>
      )}

      {tx.notes ? (
        <Section title="Observações">
          <T v="callout" tone="dim">
            {tx.notes}
          </T>
        </Section>
      ) : null}

      <Card onPress={() => openFinancy()} style={{ gap: 2 }}>
        <T v="headline">Editar no Financy</T>
        <T v="caption" tone="dim">
          As finanças vêm do Financy; mudanças feitas lá aparecem aqui sozinhas.
        </T>
      </Card>
    </Screen>
  );
}
