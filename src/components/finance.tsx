import { router } from 'expo-router';
import { BadgeCheck, ChevronLeft, ChevronRight, CreditCard, Paperclip, Smartphone } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { brl, friendlyDate } from '@/lib/date';
import { addMonthKey, category, monthName, txLabel, type MonthKey } from '@/lib/finance';
import { useFinance, type Tx } from '@/store/finance';
import { useColors } from '@/theme';
import { Badge, GlassButton, IconTile, Row, T } from './ui';

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

const styles = StyleSheet.create({ monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } });
