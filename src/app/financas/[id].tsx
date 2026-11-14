import { router, useLocalSearchParams } from 'expo-router';
import { BadgeCheck, CalendarDays, CreditCard, Landmark, Layers, Repeat, Smartphone, Trash } from 'lucide-react-native';
import { Alert, Switch, View } from 'react-native';
import { PhotoStrip } from '@/components/Photos';
import { Card, Field, GlassButton, IconTile, List, Row, Screen, Section, T } from '@/components/ui';
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
  const { updateTx, removeTx } = useFinance.getState();

  if (!tx) return null;
  const cat = category(tx.category, tx.type);

  const remove = () => {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [{ text: 'Cancelar', style: 'cancel' }];
    if (tx.group && groupCount > 1) {
      buttons.push({ text: 'Só este', onPress: () => (removeTx(tx.id, 'one'), router.back()) });
      buttons.push({ text: `Este e os próximos (${groupCount})`, style: 'destructive', onPress: () => (removeTx(tx.id, 'next'), router.back()) });
    } else {
      buttons.push({ text: 'Excluir', style: 'destructive', onPress: () => (removeTx(tx.id), router.back()) });
    }
    Alert.alert('Excluir lançamento?', tx.description || tx.category, buttons);
  };

  return (
    <Screen back actions={<GlassButton icon={Trash} color={c.danger} accessibilityLabel="Excluir" onPress={remove} />}>
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
        <Row leading={<IconTile icon={CalendarDays} color={c.textDim} />} title={friendlyDate(tx.date)} subtitle={tx.date.split('-').reverse().join('/')} />
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
        {tx.source === 'applepay' && <Row leading={<IconTile icon={Smartphone} color={c.accent} />} title="Registrado pelo Apple Pay" subtitle="Automação do Atalhos" />}
        {tx.verified && <Row leading={<IconTile icon={BadgeCheck} color={c.success} />} title="Conferido com o banco" subtitle="Open Finance" />}
        {tx.fixed && <Row leading={<IconTile icon={Repeat} color={c.textDim} />} title="Lançamento fixo mensal" subtitle={`${groupCount} a partir deste`} />}
      </List>

      {tx.cardId ? (
        <Card style={{ gap: 2 }}>
          <T v="headline">Compra no cartão</T>
          <T v="caption" tone="dim">
            Sai do saldo quando a fatura vence, não na data da compra.
          </T>
        </Card>
      ) : (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1 }}>
          <T v="headline">{tx.type === 'in' ? 'Recebido' : 'Pago'}</T>
          <T v="caption" tone="dim">
            {tx.paid ? 'Já entrou no saldo atual' : 'Ainda pendente — não entra no saldo atual'}
          </T>
        </View>
        <Switch
          value={tx.paid}
          onValueChange={(paid) => updateTx(tx.id, { paid })}
          trackColor={{ true: c.success, false: c.surface3 }}
          thumbColor="#FFFFFF"
          ios_backgroundColor={c.surface3}
        />
      </Card>
      )}

      <Section title="Comprovantes e fotos">
        <PhotoStrip photos={tx.attachments} onChange={(attachments) => updateTx(tx.id, { attachments })} addLabel="Anexar" />
      </Section>

      <Section title="Observações">
        <Field
          value={tx.notes ?? ''}
          onChangeText={(notes) => updateTx(tx.id, { notes })}
          placeholder="Adicionar observação"
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />
      </Section>
    </Screen>
  );
}
