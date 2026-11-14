import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, BellRing, CalendarCheck, Flame, GlassWater, Repeat2, Timer } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { AnimatedNumber, Bounce, celebrate, Confetti, Pulse } from '@/components/motion';
import { toast } from '@/store/toast';
import { TaskRow } from '@/components/TaskRow';
import { TaskSheet } from '@/components/TaskSheet';
import { Card, Checkbox, IconTile, List, ProgressRing, Row, Screen, Section, T, tap } from '@/components/ui';
import { brl, greeting, longToday, today } from '@/lib/date';
import { habitIcon, MOODS } from '@/lib/icons';
import { isScheduled, streak, useHabits } from '@/store/habits';
import { useMood } from '@/store/misc';
import { useFinance } from '@/store/finance';
import { currentBalance, monthTotals, thisMonth } from '@/lib/finance';
import { mediaUri } from '@/lib/media';
import { Image } from 'expo-image';
import { useReminders } from '@/store/reminders';
import { useSettings } from '@/store/settings';
import { sortTasks, useTasks } from '@/store/tasks';
import { useUI } from '@/store/ui';
import { useFocusSessions, useHealth } from '@/store/modules';
import { FONTS, radius, space, useColors } from '@/theme';

export default function Hoje() {
  const c = useColors();
  const [editing, setEditing] = useState<string | null>(null);
  const setCapture = useUI((s) => s.setCapture);

  const name = useSettings((s) => s.name);
  const disabled = useSettings((s) => s.disabled);
  const on = (id: string) => !disabled.includes(id);

  const day = today();
  const tasks = useTasks((s) => s.tasks);
  const agenda = tasks
    .filter((t) => t.due && t.due <= day && (t.status !== 'done' || t.due === day))
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || sortTasks(a, b));
  const tasksDone = agenda.filter((t) => t.status === 'done').length;
  const inbox = tasks.filter((t) => !t.due && t.status !== 'done').sort(sortTasks).slice(0, 4);

  const habits = useHabits((s) => s.habits).filter((h) => !h.archived && isScheduled(h, day));
  const toggleHabit = useHabits((s) => s.toggle);
  const habitsDone = habits.filter((h) => h.log[day]).length;

  const total = agenda.length + (on('habitos') ? habits.length : 0);
  const done = tasksDone + (on('habitos') ? habitsDone : 0);
  const pct = total ? done / total : 0;

  const mood = useMood((s) => s.moods[day]);
  const setMood = useMood((s) => s.set);

  const reminders = useReminders((s) => s.reminders)
    .filter((r) => !r.done && (r.repeat !== 'none' || r.at > Date.now()))
    .slice(0, 3);

  const { txs: allTxs, accounts } = useFinance();
  const { income, expense, list: txs } = monthTotals(allTxs, thisMonth());
  const balance = currentBalance(accounts, allTxs);
  const avatar = useSettings((s) => s.avatar);

  const water = useHealth((s) => s.water[day] ?? 0);
  const waterGoal = useHealth((s) => s.waterGoal);
  const addWater = useHealth((s) => s.addWater);
  const focusSessions = useFocusSessions((s) => s.items);
  const focusToday = focusSessions.filter((f) => f.date === day).reduce((a, f) => a + f.minutes, 0);

  const initial = (name.trim()[0] ?? 'O').toUpperCase();

  // confete quando o dia fecha 100% (só na virada, não ao abrir o app já completo)
  const [burst, setBurst] = useState(0);
  const prevPct = useRef(pct);
  useEffect(() => {
    if (prevPct.current < 1 && pct === 1 && total > 0) {
      setBurst((b) => b + 1);
      celebrate();
      toast({ message: 'Dia completo! Tudo feito por hoje.' });
    }
    prevPct.current = pct;
  }, [pct, total]);

  const checkHabit = (id: string) => {
    const before = useHabits.getState().habits.find((x) => x.id === id);
    const wasDone = !!before?.log[day];
    toggleHabit(id, day);
    const after = useHabits.getState().habits.find((x) => x.id === id);
    if (!wasDone && after) {
      const st = streak(after);
      if ([7, 14, 21, 30, 50, 100, 365].includes(st)) {
        setBurst((b) => b + 1);
        celebrate();
        toast({ message: `${st} dias seguidos de “${after.name}”!` });
      }
    }
  };

  return (
    <>
      <Screen
        tab
        overline={longToday()}
        title={name ? `${greeting()}, ${name.split(' ')[0]}` : greeting()}
        actions={
          <Pressable accessibilityLabel="Configurações" onPress={() => router.push('/configuracoes')} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            {avatar ? (
              <Image source={{ uri: mediaUri(avatar) }} style={[styles.avatar, { borderWidth: 1, borderColor: c.border }]} contentFit="cover" />
            ) : (
              <Glass interactive floating style={styles.avatar}>
                <T v="headline" color={c.text}>
                  {initial}
                </T>
              </Glass>
            )}
          </Pressable>
        }>
        {/* Resumo */}
        <Card style={styles.summary}>
          <ProgressRing value={pct} size={92} stroke={9}>
            <T v="title" tabular style={{ fontSize: 22 }}>
              <AnimatedNumber value={pct * 100} />
              <T v="caption" tone="dim">
                %
              </T>
            </T>
          </ProgressRing>
          <View style={{ flex: 1, gap: space.sm }}>
            <T v="headline">{total === 0 ? 'Dia livre' : pct === 1 ? 'Tudo concluído' : 'Progresso do dia'}</T>
            <View style={{ gap: 4 }}>
              <View style={styles.stat}>
                <CalendarCheck size={14} color={c.textDim} />
                <T v="callout" tone="dim" tabular>
                  {tasksDone} de {agenda.length} tarefas
                </T>
              </View>
              {on('habitos') && (
                <View style={styles.stat}>
                  <Repeat2 size={14} color={c.textDim} />
                  <T v="callout" tone="dim" tabular>
                    {habitsDone} de {habits.length} hábitos
                  </T>
                </View>
              )}
            </View>
          </View>
        </Card>

        {/* Humor */}
        <Section title="Como está seu dia">
          <View style={styles.moodRow}>
            {MOODS.map((m, i) => {
              const active = mood === i + 1;
              const Icon = m.icon;
              return (
                <Pressable
                  key={m.label}
                  accessibilityLabel={m.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    tap();
                    setMood(day, i + 1);
                  }}
                  style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.75 : 1 })}>
                  <Glass interactive tint={active ? c.accent + '33' : undefined} style={styles.mood}>
                    <Bounce trigger={active ? mood : null} amount={1.35}>
                      <Icon size={22} color={active ? c.accent : c.textDim} strokeWidth={active ? 2.2 : 1.8} />
                    </Bounce>
                    <T v="caption" color={active ? c.text : c.textFaint} style={{ fontSize: 11, fontFamily: active ? FONTS.bold : FONTS.semibold }}>
                      {m.label}
                    </T>
                  </Glass>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {/* Atalhos rápidos */}
        {(on('saude') || on('produtividade')) && (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {on('saude') && (
              <Pressable
                accessibilityLabel="Beber 250 ml"
                onPress={() => {
                  tap();
                  addWater(day, 250);
                }}
                onLongPress={() => router.push('/saude')}
                style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
                <Glass interactive style={styles.quick}>
                  <View>
                    <GlassWater size={20} color="#3B9DFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="headline" tabular>
                      {(water / 1000).toFixed(1).replace('.', ',')} L
                    </T>
                    <T v="caption" tone="dim">
                      água · +250 ml
                    </T>
                  </View>
                  <ProgressRing value={water / waterGoal} size={28} stroke={4} color="#3B9DFF" />
                </Glass>
              </Pressable>
            )}
            {on('produtividade') && (
              <Pressable onPress={() => router.push('/foco')} onLongPress={() => router.push('/produtividade')} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
                <Glass interactive style={styles.quick}>
                  <View>
                    <Timer size={20} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="headline" tabular>
                      {focusToday} min
                    </T>
                    <T v="caption" tone="dim">
                      foco hoje · modo foco
                    </T>
                  </View>
                </Glass>
              </Pressable>
            )}
          </View>
        )}

        {/* Agenda */}
        <Section title="Agenda de hoje" action="Ver tarefas" onAction={() => router.push('/tarefas')}>
          {agenda.length === 0 ? (
            <Card onPress={() => setCapture(true)}>
              <T v="headline">Nada marcado para hoje</T>
              <T v="callout" tone="dim">
                Toque em + e escreva algo como “academia hoje 18h”.
              </T>
            </Card>
          ) : (
            <List>
              {agenda.map((t) => (
                <TaskRow key={t.id} task={t} showDate={false} onPress={() => setEditing(t.id)} />
              ))}
            </List>
          )}
        </Section>

        {/* Hábitos */}
        {on('habitos') && (
          <Section title="Hábitos" action="Gerenciar" onAction={() => router.push('/habitos')}>
            {habits.length === 0 ? (
              <Card onPress={() => router.push('/habitos')}>
                <T v="headline">Crie seu primeiro hábito</T>
                <T v="callout" tone="dim">
                  Pequenas ações diárias, com sequência e histórico.
                </T>
              </Card>
            ) : (
              <List>
                {habits.map((h) => {
                  const s = streak(h);
                  return (
                    <Row
                      key={h.id}
                      leading={<IconTile icon={habitIcon(h.icon)} />}
                      title={h.name}
                      subtitle={s > 0 ? `${s} ${s === 1 ? 'dia' : 'dias'} seguidos` : 'Comece hoje'}
                      onPress={() => checkHabit(h.id)}
                      trailing={
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                          {s >= 3 && (
                            <Pulse active={!h.log[day]}>
                              <Flame size={16} color={c.warning} />
                            </Pulse>
                          )}
                          <Checkbox checked={!!h.log[day]} onPress={() => checkHabit(h.id)} />
                        </View>
                      }
                    />
                  );
                })}
              </List>
            )}
          </Section>
        )}

        {/* Sem data */}
        {inbox.length > 0 && (
          <Section title="Caixa de entrada">
            <List>
              {inbox.map((t) => (
                <TaskRow key={t.id} task={t} onPress={() => setEditing(t.id)} />
              ))}
            </List>
          </Section>
        )}

        {/* Lembretes */}
        {on('lembretes') && reminders.length > 0 && (
          <Section title="Próximos lembretes" action="Todos" onAction={() => router.push('/lembretes')}>
            <List>
              {reminders.map((r) => (
                <Row
                  key={r.id}
                  leading={<IconTile icon={BellRing} color={c.info} />}
                  title={r.title}
                  trailing={
                    <T v="callout" tone="dim" tabular>
                      {new Date(r.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </T>
                  }
                />
              ))}
            </List>
          </Section>
        )}

        {/* Finanças */}
        {on('financas') && (txs.length > 0 || accounts.length > 0) && (
          <Section title="Finanças do mês" action="Abrir" onAction={() => router.push('/financas')}>
            <Card onPress={() => router.push('/financas')} style={{ gap: space.md }}>
              <View>
                <T v="caption" tone="dim">
                  Saldo atual
                </T>
                <T v="largeTitle" tabular color={balance >= 0 ? c.text : c.danger} style={{ fontSize: 28 }}>
                  <AnimatedNumber value={balance} format={brl} />
                </T>
              </View>
              <View style={{ flexDirection: 'row', gap: space.xl }}>
                <View style={styles.stat}>
                  <ArrowDownLeft size={16} color={c.success} />
                  <T v="callout" tabular>
                    <AnimatedNumber value={income} format={brl} />
                  </T>
                </View>
                <View style={styles.stat}>
                  <ArrowUpRight size={16} color={c.danger} />
                  <T v="callout" tabular>
                    <AnimatedNumber value={expense} format={brl} />
                  </T>
                </View>
              </View>
            </Card>
          </Section>
        )}
      </Screen>

      <TaskSheet taskId={editing} onClose={() => setEditing(null)} />
      <Confetti run={burst} />
    </>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.xl, padding: space.xl },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, minHeight: 72 },
  moodRow: { flexDirection: 'row', gap: space.sm },
  mood: {
    height: 72,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
