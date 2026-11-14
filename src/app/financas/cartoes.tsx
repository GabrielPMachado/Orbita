import { CreditCard, Pencil, Plus, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { MonthSwitcher, TxRow } from '@/components/finance';
import { Button, Empty, Field, GlassButton, List, Progress, Screen, Sheet, T, tap } from '@/components/ui';
import { brl } from '@/lib/date';
import { ACCOUNT_COLORS, cardUsed, invoice, invoiceMonth, monthName, parseMoney, thisMonth } from '@/lib/finance';
import { today } from '@/lib/date';
import { useFinance, type Card } from '@/store/finance';
import { radius, space, useColors } from '@/theme';

export default function Cartoes() {
  const c = useColors();
  const { cards, txs, addCard, updateCard, removeCard } = useFinance();
  // abre direto na fatura em aberto (a próxima a vencer)
  const [month, setMonth] = useState(() => (cards[0] ? invoiceMonth(today(), cards[0]) : thisMonth()));
  const [editing, setEditing] = useState<Card | 'new' | null>(null);
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [closing, setClosing] = useState('');
  const [due, setDue] = useState('');
  const [color, setColor] = useState(ACCOUNT_COLORS[0]);

  const open = (k: Card | 'new') => {
    setEditing(k);
    if (k === 'new') {
      setName('');
      setLimit('');
      setClosing('');
      setDue('');
      setColor(ACCOUNT_COLORS[(cards.length + 1) % ACCOUNT_COLORS.length]);
    } else {
      setName(k.name);
      setLimit(String(k.limit).replace('.', ','));
      setClosing(String(k.closingDay));
      setDue(String(k.dueDay));
      setColor(k.color);
    }
  };

  const day = (s: string) => Math.min(31, Math.max(1, Number(s) || 1));
  const valid = name.trim() && Number(closing) >= 1 && Number(due) >= 1;
  const save = () => {
    if (!valid) return;
    const data = { name: name.trim(), limit: parseMoney(limit), closingDay: day(closing), dueDay: day(due), color };
    if (editing === 'new') addCard(data);
    else if (editing) updateCard(editing.id, data);
    setEditing(null);
  };

  return (
    <>
      <Screen back title="Cartões" subtitle="Faturas por mês de vencimento" actions={<GlassButton icon={Plus} label="Novo" onPress={() => open('new')} />}>
        {cards.length === 0 ? (
          <Empty
            icon={CreditCard}
            title="Nenhum cartão"
            hint="Cadastre com o dia de fechamento e de vencimento: as compras caem na fatura certa e dá pra parcelar."
            action="Adicionar cartão"
            onAction={() => open('new')}
          />
        ) : (
          <>
            <MonthSwitcher month={month} onChange={setMonth} />
            {cards.map((k) => {
              const inv = invoice(txs, k, month);
              const used = cardUsed(txs, k);
              return (
                <View key={k.id} style={{ gap: space.md }}>
                  <Pressable onPress={() => open(k)} style={({ pressed }) => [styles.card, { backgroundColor: k.color, opacity: pressed ? 0.9 : 1 }]}>
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: radius.lg }]} />
                    <View style={styles.cardTop}>
                      <T v="headline" color="#fff">
                        {k.name}
                      </T>
                      <Pencil size={16} color="rgba(255,255,255,0.8)" />
                    </View>
                    <View style={{ gap: 2 }}>
                      <T v="caption" color="rgba(255,255,255,0.75)">
                        {month === invoiceMonth(today(), k) ? 'Fatura aberta' : month < invoiceMonth(today(), k) ? 'Fatura fechada' : 'Fatura futura'} · vence{' '}
                        {String(k.dueDay).padStart(2, '0')}/{month.slice(5)}
                      </T>
                      <T v="largeTitle" tabular color="#fff" style={{ fontSize: 30 }}>
                        {brl(inv.total)}
                      </T>
                    </View>
                    <View style={styles.cardBottom}>
                      <T v="caption" color="rgba(255,255,255,0.75)">
                        Fecha dia {k.closingDay} · vence dia {k.dueDay}
                      </T>
                      <CreditCard size={22} color="rgba(255,255,255,0.85)" />
                    </View>
                  </Pressable>
                  {k.limit > 0 && (
                    <View style={{ gap: 6, paddingHorizontal: space.xs }}>
                      <Progress value={used / k.limit} color={used > k.limit ? c.danger : k.color} height={5} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <T v="caption" tone="dim" tabular>
                          Usado {brl(used)}
                        </T>
                        <T v="caption" tone="dim" tabular>
                          Disponível {brl(Math.max(0, k.limit - used))}
                        </T>
                      </View>
                    </View>
                  )}
                  {inv.items.length > 0 ? (
                    <List>
                      {inv.items.map((t) => (
                        <TxRow key={t.id} tx={t} showDate />
                      ))}
                    </List>
                  ) : (
                    <T v="callout" tone="faint" align="center">
                      Nenhuma compra nesta fatura.
                    </T>
                  )}
                </View>
              );
            })}
          </>
        )}
      </Screen>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Novo cartão' : 'Editar cartão'}>
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Nubank Roxinho" autoFocus={editing === 'new'} />
        <Field label="Limite (R$)" value={limit} onChangeText={setLimit} placeholder="0,00" keyboardType="decimal-pad" />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Field label="Fecha dia" value={closing} onChangeText={setClosing} placeholder="3" keyboardType="number-pad" maxLength={2} style={{ flex: 1 }} />
          <Field label="Vence dia" value={due} onChangeText={setDue} placeholder="10" keyboardType="number-pad" maxLength={2} style={{ flex: 1 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {ACCOUNT_COLORS.map((col) => (
            <Pressable
              key={col}
              accessibilityLabel={col}
              onPress={() => {
                tap();
                setColor(col);
              }}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: col, borderWidth: 3, borderColor: color === col ? c.text : 'transparent' }}
            />
          ))}
        </View>
        <Button label="Salvar" onPress={save} disabled={!valid} />
        {editing && editing !== 'new' && (
          <Button
            label="Excluir cartão"
            icon={Trash}
            variant="danger"
            onPress={() =>
              Alert.alert('Excluir cartão?', 'As compras continuam salvas, só ficam sem cartão.', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir',
                  style: 'destructive',
                  onPress: () => {
                    removeCard(editing.id);
                    setEditing(null);
                  },
                },
              ])
            }
          />
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: space.xl, gap: space.lg, minHeight: 180, overflow: 'hidden', justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
