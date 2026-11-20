import { CalendarCheck, ChevronLeft, ChevronRight, Dumbbell, Repeat2, Timer, Wallet } from 'lucide-react-native';
import { View } from 'react-native';
import { useState } from 'react';
import { Stars, Stat } from '@/components/extra';
import { Card, Field, GlassButton, IconTile, List, Row, Screen, Section, T } from '@/components/ui';
import { addDays, brl, fromKey, toKey, today, weekStart, WEEKDAYS_SHORT } from '@/lib/date';
import { MOODS } from '@/lib/icons';
import { useFinance } from '@/store/finance';
import { isScheduled, useHabits } from '@/store/habits';
import { useMood } from '@/store/misc';
import { useFocusSessions, useReviews, useSessions } from '@/store/modules';
import { useTasks } from '@/store/tasks';
import { space, useColors } from '@/theme';

export default function Revisao() {
  const c = useColors();
  const [offset, setOffset] = useState(0);
  const start = weekStart(addDays(new Date(), offset * 7));
  const days = Array.from({ length: 7 }, (_, i) => toKey(addDays(fromKey(start), i)));
  const end = days[6];
  const inWeek = (k?: string) => !!k && k >= start && k <= end;

  const tasks = useTasks((s) => s.tasks);
  const habits = useHabits((s) => s.habits);
  const moods = useMood((s) => s.moods);
  const txs = useFinance((s) => s.txs);
  const focus = useFocusSessions((s) => s.items);
  const workouts = useSessions((s) => s.items);
  const entry = useReviews((s) => s.entries[start]);
  const save = useReviews((s) => s.save);

  const doneTasks = tasks.filter((t) => t.doneAt && inWeek(toKey(new Date(t.doneAt))));
  let sched = 0;
  let hit = 0;
  habits
    .filter((h) => !h.archived)
    .forEach((h) =>
      days.forEach((d) => {
        if (d > today() || !isScheduled(h, d)) return;
        sched++;
        if (h.log[d]) hit++;
      }),
    );
  const moodVals = days.map((d) => moods[d]).filter((v): v is number => v != null);
  const moodAvg = moodVals.length ? moodVals.reduce((a, b) => a + b, 0) / moodVals.length : undefined;
  const spent = txs.filter((t) => t.type === 'out' && inWeek(t.date)).reduce((a, t) => a + t.amount, 0);
  const earned = txs.filter((t) => t.type === 'in' && inWeek(t.date)).reduce((a, t) => a + t.amount, 0);
  const focusMin = focus.filter((s) => inWeek(s.date)).reduce((a, s) => a + s.minutes, 0);
  const gym = workouts.filter((s) => inWeek(s.date)).length;

  const label =
    offset === 0
      ? 'Esta semana'
      : offset === -1
        ? 'Semana passada'
        : `${fromKey(start).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${fromKey(end).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`;

  return (
    <Screen back title="Revisão" subtitle="Olhe para trás, ajuste o rumo">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton icon={ChevronLeft} accessibilityLabel="Semana anterior" onPress={() => setOffset(offset - 1)} />
        <T v="headline">{label}</T>
        <GlassButton
          icon={ChevronRight}
          accessibilityLabel="Próxima semana"
          onPress={() => offset < 0 && setOffset(offset + 1)}
          color={offset < 0 ? undefined : c.textFaint}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat label="Tarefas feitas" value={String(doneTasks.length)} />
        <Stat label="Hábitos" value={sched ? `${Math.round((hit / sched) * 100)}%` : '—'} hint={`${hit} de ${sched}`} />
      </View>

      <Section title="Humor">
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {days.map((d) => {
            const m = moods[d];
            const Mood = m ? MOODS[m - 1].icon : null;
            return (
              <View key={d} style={{ alignItems: 'center', gap: 6, flex: 1 }}>
                <View style={{ height: 26, justifyContent: 'center' }}>
                  {Mood ? <Mood size={22} color={m! >= 4 ? c.accent : m! <= 2 ? c.info : c.textDim} /> : <T tone="faint">·</T>}
                </View>
                <T v="caption" tone={d === today() ? 'default' : 'faint'} style={{ fontSize: 11 }}>
                  {WEEKDAYS_SHORT[fromKey(d).getDay()]}
                </T>
              </View>
            );
          })}
        </Card>
        {moodAvg != null && (
          <T v="caption" tone="dim">
            Média da semana: {MOODS[Math.round(moodAvg) - 1].label.toLowerCase()} ({moodAvg.toFixed(1).replace('.', ',')})
          </T>
        )}
      </Section>

      <List>
        <Row
          leading={<IconTile icon={CalendarCheck} />}
          title="Tarefas concluídas"
          trailing={
            <T v="headline" tabular>
              {doneTasks.length}
            </T>
          }
        />
        <Row
          leading={<IconTile icon={Repeat2} />}
          title="Check-ins de hábitos"
          trailing={
            <T v="headline" tabular>
              {hit}
            </T>
          }
        />
        <Row
          leading={<IconTile icon={Timer} color="#F2415A" />}
          title="Tempo de foco"
          trailing={
            <T v="headline" tabular>
              {focusMin >= 60 ? `${(focusMin / 60).toFixed(1).replace('.', ',')} h` : `${focusMin} min`}
            </T>
          }
        />
        <Row
          leading={<IconTile icon={Dumbbell} color="#2DD4BF" />}
          title="Treinos"
          trailing={
            <T v="headline" tabular>
              {gym}
            </T>
          }
        />
        <Row
          leading={<IconTile icon={Wallet} color={c.success} />}
          title="Entradas / saídas"
          subtitle={`saldo ${brl(earned - spent)}`}
          trailing={
            <T v="callout" tabular tone="dim">
              {brl(earned)} / {brl(spent)}
            </T>
          }
        />
      </List>

      <Section title="Reflexão">
        <Field
          label="O que deu certo?"
          value={entry?.good ?? ''}
          onChangeText={(good) => save(start, { good })}
          placeholder="Conquistas, boas decisões…"
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />
        <Field
          label="O que dá para melhorar?"
          value={entry?.improve ?? ''}
          onChangeText={(improve) => save(start, { improve })}
          placeholder="O que travou, o que evitar…"
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />
        <Field
          label="Foco da próxima semana"
          value={entry?.focus ?? ''}
          onChangeText={(focus) => save(start, { focus })}
          placeholder="1 a 3 prioridades"
          multiline
          style={{ minHeight: 72, textAlignVertical: 'top' }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="callout" tone="dim">
            Nota da semana
          </T>
          <Stars value={entry?.rating} onChange={(rating) => save(start, { rating })} size={26} />
        </View>
      </Section>
    </Screen>
  );
}
