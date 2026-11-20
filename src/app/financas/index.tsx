import { Barcode } from 'lucide-react-native';
import { useBoletos } from '@/store/boletos';
import { addDays as addDaysBoleto, toKey as toKeyBoleto } from '@/lib/date';
import { router, type Href } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  ExternalLink,
  Calculator,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BarChart } from '@/components/BarChart';
import { AnimatedNumber } from '@/components/motion';
import { Glass } from '@/components/Glass';
import { MonthSwitcher, TxRow } from '@/components/finance';
import { Badge, Card, Empty, GlassButton, IconTile, List, Progress, Row, Screen, Section, Segmented, T, tap } from '@/components/ui';
import { brl, friendlyDate, today } from '@/lib/date';
import {
  addMonthKey,
  byCategory,
  cardUsed,
  category,
  balanceFor,
  cashMonth,
  invoice,
  monthName,
  monthTotals,
  projectedBalance,
  invoiceMonth,
  thisMonth,
} from '@/lib/finance';
import { openFinancy } from '@/lib/financy';
import { pullFinancy } from '@/lib/financyData';
import { review } from '@/lib/pluggySync';
import { useFinance, type Tx } from '@/store/finance';
import { usePluggy } from '@/store/pluggy';
import { useFinancyLink } from '@/store/financyLink';
import { radius, space, useColors } from '@/theme';

type Filter = 'all' | 'in' | 'out';

export default function Financas() {
  const boletos = useBoletos((st) => st.items);
  const boletosAbertos = boletos.filter((x) => !x.pago).length;
  const boletosVencendo = boletos.filter((x) => !x.pago && x.vencimento && x.vencimento <= toKeyBoleto(addDaysBoleto(new Date(), 3))).length;
  const c = useColors();
  const { txs, accounts, cards, budgets } = useFinance();
  const [month, setMonth] = useState(thisMonth());
  const [filter, setFilter] = useState<Filter>('all');
  const pluggy = usePluggy();
  const financy = useFinancyLink();
  const pending = useMemo(() => {
    if (!pluggy.configured) return 0;
    const r = review(txs, pluggy);
    return r.bankOnly.length + r.localOnly.length;
  }, [txs, pluggy]);

  const totals = monthTotals(txs, month);
  const base = useFinance((s) => s.base);
  const fySaldo = financy.summary?.saldo;
  const balance = balanceFor(base, accounts, txs, fySaldo);
  // com o Financy como base: saldo dele + o que ainda vai entrar/sair até o fim do mês escolhido
  const projected =
    base === 'financy' && fySaldo !== undefined
      ? fySaldo +
        txs.filter((t) => t.date > today() && cashMonth(t, cards) <= month).reduce((a, t) => a + (t.type === 'in' ? t.amount : -t.amount), 0)
      : projectedBalance(accounts, txs, cards, month);
  const cats = byCategory(txs, month);

  const chart = useMemo(
    () =>
      [-5, -4, -3, -2, -1, 0].map((d) => {
        const k = addMonthKey(month, d);
        const t = monthTotals(txs, k);
        return { label: monthName(k, true), income: t.income, expense: t.expense, highlight: d === 0 };
      }),
    [txs, month],
  );

  const list = totals.list
    .filter((t) => filter === 'all' || t.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const byDay = list.reduce<Record<string, Tx[]>>((acc, t) => ((acc[t.date] ??= []).push(t), acc), {});

  const shortcuts: { label: string; icon: LucideIcon; href: string; hint: string }[] = [
    { label: 'Contas', icon: Landmark, href: '/financas/contas', hint: `${accounts.length}` },
    { label: 'Cartões', icon: CreditCard, href: '/financas/cartoes', hint: `${cards.length}` },
    { label: 'Orçamentos', icon: PiggyBank, href: '/financas/orcamentos', hint: `${Object.keys(budgets).length}` },
    { label: 'Simulador', icon: Calculator, href: '/financas/simulador', hint: 'Freela' },
  ];

  return (
    <Screen
      back
      title="Finanças"
      subtitle={financy.connected ? 'Lido do Financy' : 'Conecte o Financy para ver suas finanças'}
      onRefresh={financy.connected ? () => pullFinancy(true).catch(() => {}) : undefined}
      actions={<GlassButton icon={Plus} label="Lançar" onPress={() => openFinancy({ action: 'novo' })} />}>
      {!financy.connected ? (
        <Card onPress={() => router.push('/financas/financy')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconTile icon={Wallet} color="#10B981" />
          <View style={{ flex: 1 }}>
            <T v="headline">Conectar com o Financy</T>
            <T v="caption" tone="dim">
              O Órbita mostra saldo, lançamentos e cartões do Financy. Lançar e editar continua lá.
            </T>
          </View>
        </Card>
      ) : null}
      {/* Saldo */}
      <Card style={{ padding: space.xl, gap: space.lg }}>
        <View style={{ gap: 2 }}>
          <T v="caption" tone="dim">
            Saldo atual
          </T>
          <T v="largeTitle" tabular color={balance < 0 ? c.danger : c.text}>
            <AnimatedNumber value={balance} format={brl} />
          </T>
          {accounts.length === 0 && (
            <T v="caption" tone="accent" onPress={() => router.push('/financas/contas')}>
              Cadastre suas contas para o saldo partir do valor real
            </T>
          )}
        </View>
        <View style={[styles.projection, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
          <T v="callout" tone="dim" style={{ flex: 1 }}>
            Previsto no fim de {monthName(month).split(' ')[0].toLowerCase()}
          </T>
          <T v="headline" tabular color={projected < 0 ? c.danger : c.text}>
            <AnimatedNumber value={projected} format={brl} />
          </T>
        </View>
      </Card>

      {/* Financy: o app de finanças completo */}
      <Card onPress={() => openFinancy()} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconTile icon={Wallet} color="#10B981" />
        <View style={{ flex: 1 }}>
          <T v="headline">Ver completo no Financy</T>
          <T v="caption" tone="dim" tabular numberOfLines={1}>
            {financy.connected && financy.summary
              ? `Saldo ${brl(financy.summary.saldo)} · gastos do mês ${brl(financy.summary.gastosMes)}`
              : 'Abre o app do Financy'}
          </T>
        </View>
        <ExternalLink size={16} color={c.textFaint} />
      </Card>

      <MonthSwitcher month={month} onChange={setMonth} />

      {/* Resumo do mês */}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Kpi icon={ArrowDownLeft} color={c.success} label="Entradas" value={totals.income} />
        <Kpi icon={ArrowUpRight} color={c.danger} label="Saídas" value={totals.expense} />
      </View>
      {totals.pending > 0 && (
        <Card style={[styles.pending, { borderColor: c.warning + '40' }]}>
          <T v="callout" style={{ flex: 1 }}>
            Contas a pagar neste mês
          </T>
          <T v="headline" tabular color={c.warning}>
            {brl(totals.pending)}
          </T>
        </Card>
      )}

      {/* Atalhos */}
      <View style={styles.shortcuts}>
        {shortcuts.map((s) => (
          <Pressable
            key={s.label}
            accessibilityRole="button"
            onPress={() => {
              tap();
              router.push(s.href as Href);
            }}
            style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
            <Glass interactive style={styles.shortcut}>
              <View>
                <s.icon size={22} color={c.accent} strokeWidth={1.9} />
              </View>
              <T v="caption" style={{ fontSize: 12 }}>
                {s.label}
              </T>
            </Glass>
          </Pressable>
        ))}
      </View>

      <List>
        <Row
          leading={<IconTile icon={Barcode} color={boletosVencendo ? c.warning : c.accent} />}
          title="Boletos"
          subtitle={
            boletosAbertos
              ? `${boletosAbertos} em aberto${boletosVencendo ? ` · ${boletosVencendo} vencendo` : ''}`
              : 'Contas a pagar com aviso na véspera'
          }
          onPress={() => router.push('/boletos')}
          chevron
        />
        <Row
          leading={<IconTile icon={Smartphone} color={c.accent} />}
          title="Lançamentos automáticos"
          subtitle="Compras do Apple Pay vão para o Financy com a categoria"
          onPress={() => router.push('/financas/automatico')}
          chevron
        />
        {base !== 'financy' && (
          <Row
            leading={<IconTile icon={BadgeCheck} color={c.success} />}
            title="Conferência com o banco"
            subtitle={pluggy.configured ? `Meu Pluggy · ${pending ? `${pending} para revisar` : 'tudo em dia'}` : 'Conectar o Meu Pluggy'}
            subtitleTone={pending ? 'warning' : 'dim'}
            trailing={pending ? <Badge label={String(pending)} color={c.warning} /> : undefined}
            onPress={() => router.push(pluggy.configured ? '/financas/conferencia' : '/financas/pluggy')}
            chevron
          />
        )}
      </List>

      {/* Gráfico */}
      <Section title="Últimos 6 meses">
        <Card>
          <BarChart data={chart} />
        </Card>
      </Section>

      {/* Cartões */}
      {cards.length > 0 && (
        <Section title="Faturas" action="Cartões" onAction={() => router.push('/financas/cartoes')}>
          <List>
            {cards.map((card) => {
              const open = invoiceMonth(today(), card);
              const inv = invoice(txs, card, open);
              const used = cardUsed(txs, card);
              return (
                <Pressable
                  key={card.id}
                  onPress={() => router.push('/financas/cartoes')}
                  style={({ pressed }) => [{ padding: space.lg, gap: space.sm }, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <IconTile icon={CreditCard} color={card.color} />
                    <View style={{ flex: 1 }}>
                      <T v="headline">{card.name}</T>
                      <T v="caption" tone="dim">
                        Fatura aberta · vence {String(card.dueDay).padStart(2, '0')}/{open.slice(5)} · {inv.items.length}{' '}
                        {inv.items.length === 1 ? 'compra' : 'compras'}
                      </T>
                    </View>
                    <T v="headline" tabular>
                      {brl(inv.total)}
                    </T>
                  </View>
                  {card.limit > 0 && (
                    <View style={{ gap: 4 }}>
                      <Progress value={used / card.limit} color={card.color} height={4} />
                      <T v="caption" tone="faint" tabular>
                        Disponível {brl(Math.max(0, card.limit - used))} de {brl(card.limit)}
                      </T>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </List>
        </Section>
      )}

      {/* Categorias */}
      {cats.length > 0 && (
        <Section title="Gastos por categoria" action="Orçamentos" onAction={() => router.push('/financas/orcamentos')}>
          <Card style={{ gap: space.lg }}>
            {cats.map(([name, v]) => {
              const cat = category(name, 'out');
              const budget = budgets[name];
              const over = budget && v > budget;
              return (
                <View key={name} style={{ gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <cat.icon size={16} color={cat.color} />
                    <T v="callout" style={{ flex: 1 }}>
                      {name}
                    </T>
                    <T v="callout" tabular color={over ? c.danger : c.text}>
                      {brl(v)}
                    </T>
                    {budget ? (
                      <T v="caption" tone="faint" tabular>
                        / {brl(budget)}
                      </T>
                    ) : null}
                  </View>
                  <Progress value={budget ? v / budget : v / totals.expense} color={over ? c.danger : cat.color} height={4} />
                </View>
              );
            })}
          </Card>
        </Section>
      )}

      {/* Lançamentos */}
      <Section title="Lançamentos">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'in', label: 'Entradas' },
            { value: 'out', label: 'Saídas' },
          ]}
        />
      </Section>
      {list.length === 0 ? (
        <Empty
          icon={Wallet}
          title={`Nada em ${monthName(month).split(' ')[0].toLowerCase()}`}
          hint="Os lançamentos aparecem aqui assim que entram no Financy."
          action="Lançar no Financy"
          onAction={() => openFinancy({ action: 'novo' })}
        />
      ) : (
        Object.entries(byDay).map(([day, items]) => {
          const net = items.reduce((a, t) => a + (t.type === 'in' ? t.amount : -t.amount), 0);
          return (
            <View key={day} style={{ gap: space.sm, marginTop: -space.sm }}>
              <View style={styles.dayHead}>
                <T v="overline" tone="dim">
                  {friendlyDate(day)}
                </T>
                <T v="caption" tone="faint" tabular>
                  {net >= 0 ? '+' : '−'} {brl(Math.abs(net))}
                </T>
              </View>
              <List>
                {items.map((t) => (
                  <TxRow key={t.id} tx={t} />
                ))}
              </List>
            </View>
          );
        })
      )}
    </Screen>
  );
}

function Kpi({ icon: Icon, color, label, value }: { icon: LucideIcon; color: string; label: string; value: number }) {
  return (
    <Glass style={styles.kpi}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color + '1F', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={13} color={color} strokeWidth={2.5} />
        </View>
        <T v="caption" tone="dim">
          {label}
        </T>
      </View>
      <T v="headline" tabular style={{ fontSize: 18 }}>
        <AnimatedNumber value={value} format={brl} />
      </T>
    </Glass>
  );
}

const styles = StyleSheet.create({
  projection: { flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: radius.sm },
  kpi: { flex: 1, gap: space.sm, padding: space.lg, borderRadius: radius.lg },
  pending: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md },
  shortcuts: { flexDirection: 'row', gap: space.sm },
  shortcut: { height: 76, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: 6 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.xs },
});
