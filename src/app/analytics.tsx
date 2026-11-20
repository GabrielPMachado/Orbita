import { View } from 'react-native';
import { useState } from 'react';
import { Bars, LineChart, Stat } from '@/components/extra';
import { Card, Progress, Screen, Section, Segmented, T } from '@/components/ui';
import { brl, fromKey, lastNDays, toKey, WEEKDAYS_SHORT } from '@/lib/date';
import { category } from '@/lib/finance';
import { habitIcon, MOODS } from '@/lib/icons';
import { useFinance } from '@/store/finance';
import { isScheduled, useHabits } from '@/store/habits';
import { useMood } from '@/store/misc';
import { useFocusSessions } from '@/store/modules';
import { useTasks } from '@/store/tasks';
import { space, useColors } from '@/theme';

type Period = '7' | '30' | '90';

export default function Analytics() {
  const c = useColors();
  const [period, setPeriod] = useState<Period>('30');
  const n = Number(period);
  const days = lastNDays(n);
  const set = new Set(days);

  const tasks = useTasks((s) => s.tasks);
  const habits = useHabits((s) => s.habits);
  const moods = useMood((s) => s.moods);
  const txs = useFinance((s) => s.txs);
  const focus = useFocusSessions((s) => s.items);

  // agrupa em baldes para períodos longos (90 dias → semanas)
  const bucket = n > 30 ? 7 : 1;
  const buckets: string[][] = [];
  for (let i = 0; i < days.length; i += bucket) buckets.push(days.slice(i, i + bucket));
  const labelOf = (b: string[], i: number) => {
    const d = fromKey(b[0]);
    if (n === 7) return WEEKDAYS_SHORT[d.getDay()];
    if (n === 30) return i % 5 === 0 ? String(d.getDate()) : '';
    return i % 2 === 0 ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
  };

  const doneByDay: Record<string, number> = {};
  tasks.forEach((t) => {
    if (!t.doneAt) return;
    const k = toKey(new Date(t.doneAt));
    if (set.has(k)) doneByDay[k] = (doneByDay[k] ?? 0) + 1;
  });
  const focusByDay: Record<string, number> = {};
  focus.forEach((s) => set.has(s.date) && (focusByDay[s.date] = (focusByDay[s.date] ?? 0) + s.minutes));

  const totalDone = Object.values(doneByDay).reduce((a, b) => a + b, 0);
  const totalFocus = Object.values(focusByDay).reduce((a, b) => a + b, 0);
  const moodVals = days.map((d) => moods[d] ?? null);
  const moodNums = moodVals.filter((v): v is number => v != null);
  const moodAvg = moodNums.length ? moodNums.reduce((a, b) => a + b, 0) / moodNums.length : undefined;

  const spentMap: Record<string, number> = {};
  txs.filter((t) => t.type === 'out' && set.has(t.date)).forEach((t) => (spentMap[t.category] = (spentMap[t.category] ?? 0) + t.amount));
  const spentTotal = Object.values(spentMap).reduce((a, b) => a + b, 0);
  const spentList = Object.entries(spentMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const habitRates = habits
    .filter((h) => !h.archived)
    .map((h) => {
      const sched = days.filter((d) => isScheduled(h, d) && fromKey(d).getTime() >= h.createdAt - 86_400_000);
      const hit = sched.filter((d) => h.log[d]).length;
      return { h, rate: sched.length ? hit / sched.length : 0, hit, total: sched.length };
    })
    .sort((a, b) => b.rate - a.rate);

  return (
    <Screen back title="Analytics" subtitle="Seus padrões em números">
      <Segmented<Period>
        value={period}
        onChange={setPeriod}
        options={[
          { value: '7', label: '7 dias' },
          { value: '30', label: '30 dias' },
          { value: '90', label: '90 dias' },
        ]}
      />

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat label="Tarefas feitas" value={String(totalDone)} hint={`${(totalDone / n).toFixed(1).replace('.', ',')} por dia`} />
        <Stat label="Foco" value={totalFocus >= 60 ? `${(totalFocus / 60).toFixed(1).replace('.', ',')} h` : `${totalFocus} min`} hint="no timer" />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat
          label="Humor médio"
          value={moodAvg ? MOODS[Math.round(moodAvg) - 1].label : '—'}
          hint={moodAvg ? `${moodAvg.toFixed(1).replace('.', ',')} de 5 · ${moodNums.length} check-ins` : 'sem check-ins'}
        />
        <Stat label="Gastos" value={brl(spentTotal)} hint={`${brl(spentTotal / n)} por dia`} />
      </View>

      <Section title="Tarefas concluídas">
        <Card>
          <Bars
            data={buckets.map((b, i) => ({
              label: labelOf(b, i),
              value: b.reduce((a, d) => a + (doneByDay[d] ?? 0), 0),
              highlight: i === buckets.length - 1,
            }))}
            format={(v) => `${v} tarefas`}
          />
        </Card>
      </Section>

      <Section title="Humor">
        <Card>
          <LineChart
            values={moodVals}
            min={1}
            max={5}
            labels={[fromKey(days[0]).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), 'hoje']}
          />
        </Card>
      </Section>

      <Section title="Tempo de foco">
        <Card>
          <Bars
            data={buckets.map((b, i) => ({
              label: labelOf(b, i),
              value: b.reduce((a, d) => a + (focusByDay[d] ?? 0), 0),
              highlight: i === buckets.length - 1,
            }))}
            color="#F2415A"
            format={(v) => `${v} min`}
          />
        </Card>
      </Section>

      {habitRates.length > 0 && (
        <Section title="Constância dos hábitos">
          <Card style={{ gap: space.lg }}>
            {habitRates.map(({ h, rate, hit, total }) => {
              const Icon = habitIcon(h.icon);
              return (
                <View key={h.id} style={{ gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Icon size={16} color={c.accent} />
                    <T v="callout" style={{ flex: 1 }} numberOfLines={1}>
                      {h.name}
                    </T>
                    <T v="caption" tone="faint" tabular>
                      {hit}/{total}
                    </T>
                    <T v="headline" tabular style={{ minWidth: 44, textAlign: 'right' }}>
                      {Math.round(rate * 100)}%
                    </T>
                  </View>
                  <Progress value={rate} height={4} color={rate >= 0.8 ? c.success : rate >= 0.5 ? c.accent : c.warning} />
                </View>
              );
            })}
          </Card>
        </Section>
      )}

      {spentList.length > 0 && (
        <Section title="Para onde foi o dinheiro">
          <Card style={{ gap: space.lg }}>
            {spentList.map(([name, v]) => {
              const cat = category(name, 'out');
              return (
                <View key={name} style={{ gap: space.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <cat.icon size={16} color={cat.color} />
                    <T v="callout" style={{ flex: 1 }}>
                      {name}
                    </T>
                    <T v="caption" tone="faint" tabular>
                      {Math.round((v / spentTotal) * 100)}%
                    </T>
                    <T v="callout" tabular style={{ minWidth: 96, textAlign: 'right' }}>
                      {brl(v)}
                    </T>
                  </View>
                  <Progress value={v / spentTotal} color={cat.color} height={4} />
                </View>
              );
            })}
          </Card>
        </Section>
      )}
    </Screen>
  );
}
