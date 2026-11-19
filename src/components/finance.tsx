import { router } from 'expo-router';
import { BadgeCheck, ChevronLeft, ChevronRight, CreditCard, Delete, Paperclip, Smartphone } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { brl, friendlyDate } from '@/lib/date';
import { addMonthKey, category, monthName, txLabel, type MonthKey } from '@/lib/finance';
import { useFinance, type Tx } from '@/store/finance';
import { radius, space, useColors } from '@/theme';
import { Glass } from './Glass';
import { Badge, GlassButton, IconTile, Row, T, impact } from './ui';

export function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (m: MonthKey) => void }) {
  return (
    <View style={styles.monthNav}>
      <GlassButton icon={ChevronLeft} accessibilityLabel="Mês anterior" onPress={() => onChange(addMonthKey(month, -1))} />
      <T v="headline">{monthName(month)}</T>
      <GlassButton icon={ChevronRight} accessibilityLabel="Próximo mês" onPress={() => onChange(addMonthKey(month, 1))} />
    </View>
  );
}

export function TxRow({ tx, showDate }: { tx: Tx; showDate?: boolean }) {
  const c = useColors();
  const cat = category(tx.category, tx.type);
  const account = useFinance((s) => (tx.accountId ? s.accounts.find((a) => a.id === tx.accountId) : undefined));
  const card = useFinance((s) => (tx.cardId ? s.cards.find((x) => x.id === tx.cardId) : undefined));
  const sub = [showDate ? friendlyDate(tx.date) : null, card?.name ?? account?.name ?? tx.category].filter(Boolean).join('  ·  ');

  return (
    <View>
      <Row
        leading={<IconTile icon={cat.icon} color={cat.color} />}
        title={txLabel(tx)}
        subtitle={sub}
        onPress={() => router.push(`/financas/${tx.id}`)}
        trailing={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <T v="headline" tabular color={tx.type === 'in' ? c.success : c.text}>
              {tx.type === 'in' ? '+ ' : '− '}
              {brl(tx.amount)}
            </T>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              {tx.verified && <BadgeCheck size={12} color={c.success} />}
              {tx.source === 'applepay' && <Smartphone size={12} color={c.textFaint} />}
              {tx.attachments.length > 0 && <Paperclip size={12} color={c.textFaint} />}
              {tx.cardId && <CreditCard size={12} color={c.textFaint} />}
              {!tx.paid && <Badge label={tx.type === 'in' ? 'A receber' : 'A pagar'} color={c.warning} />}
            </View>
          </View>
        }
      />
    </View>
  );
}

/** Teclado numérico estilo banco: os dígitos entram pelos centavos. */
export function MoneyKeypad({ cents, onChange }: { cents: string; onChange: (cents: string) => void }) {
  const c = useColors();
  const press = (k: string) => {
    impact();
    if (k === 'del') return onChange(cents.slice(0, -1));
    if (k === 'clear') return onChange('');
    if (cents.length >= 10) return;
    const next = (cents + k).replace(/^0+/, '');
    onChange(next);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'];
  return (
    <View style={styles.keypad}>
      {keys.map((k) => (
        <Pressable
          key={k}
          accessibilityLabel={k === 'del' ? 'Apagar' : k}
          onPress={() => press(k)}
          onLongPress={k === 'del' ? () => press('clear') : undefined}
          style={({ pressed }) => [styles.keyWrap, { opacity: pressed ? 0.7 : 1 }]}>
          <Glass interactive style={styles.key}>
            {k === 'del' ? (
              <View>
                <Delete size={22} color={c.textDim} />
              </View>
            ) : (
              <T v="title">{k}</T>
            )}
          </Glass>
        </Pressable>
      ))}
    </View>
  );
}

export const centsToNumber = (cents: string) => (Number(cents || '0') || 0) / 100;

const styles = StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  keyWrap: { width: '31.5%' },
  key: { height: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
