import { Flame, Plus, Repeat2, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { Bounce, celebrate, Confetti, Pulse } from '@/components/motion';
import { toast } from '@/store/toast';
import { Button, Card, Chip, Empty, Field, GlassButton, IconTile, Screen, Sheet, T, tap } from '@/components/ui';
import { fromKey, lastNDays, today, WEEKDAYS_SHORT } from '@/lib/date';
import { HABIT_ICONS, habitIcon } from '@/lib/icons';
import { isScheduled, streak, useHabits, type Habit } from '@/store/habits';
import { FONTS, radius, space, useColors } from '@/theme';

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function frequency(h: Habit) {
  if (h.days.length === 0 || h.days.length === 7) return 'Todos os dias';
  if (h.days.join() === '1,2,3,4,5') return 'Dias úteis';
  return h.days.map((d) => DAY_NAMES[d]).join(', ');
}

export default function Habitos() {
  const c = useColors();
  const allHabits = useHabits((s) => s.habits);
  const habits = allHabits.filter((h) => !h.archived);
  const { toggle, remove, add } = useHabits.getState();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('agua');
  const [days, setDays] = useState<number[]>([]);
  const week = lastNDays(7);
  const day = today();
  const [burst, setBurst] = useState(0);
  const tapDay = (id: string, k: string) => {
    const was = !!useHabits.getState().habits.find((x) => x.id === id)?.log[k];
    toggle(id, k);
    const after = useHabits.getState().habits.find((x) => x.id === id);
    if (!was && after && k === day) {
      const st = streak(after);
      if ([7, 14, 21, 30, 50, 100, 365].includes(st)) {
        setBurst((b) => b + 1);
        celebrate();
        toast({ message: `${st} dias seguidos de “${after.name}”!` });
      }
    }
  };
  const doneToday = habits.filter((h) => isScheduled(h, day) && h.log[day]).length;
  const dueToday = habits.filter((h) => isScheduled(h, day)).length;

  const save = () => {
    if (!name.trim()) return;
    add({ name: name.trim(), icon, days });
    setName('');
    setDays([]);
    setIcon('agua');
    setOpen(false);
  };

  return (
    <>
      <Screen
        tab
        title="Hábitos"
        subtitle={habits.length ? `${doneToday} de ${dueToday} concluídos hoje` : 'Constância vence intensidade'}
        actions={<GlassButton icon={Plus} label="Novo" onPress={() => setOpen(true)} />}>
        {habits.length === 0 && (
          <Empty
            icon={Repeat2}
            title="Nenhum hábito ainda"
            hint="Comece com algo pequeno e diário: beber água, ler 10 páginas, caminhar."
            action="Criar hábito"
            onAction={() => setOpen(true)}
          />
        )}

        {habits.map((h) => {
          const s = streak(h);
          return (
            <Card key={h.id} style={{ gap: space.lg }}>
              <View style={styles.head}>
                <IconTile icon={habitIcon(h.icon)} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="headline" numberOfLines={1}>
                    {h.name}
                  </T>
                  <T v="caption" tone="dim">
                    {frequency(h)}
                  </T>
                </View>
                <View style={[styles.streak, { backgroundColor: s ? c.warning + '1F' : c.surface2 }]}>
                  <Pulse active={s >= 3 && !h.log[day]}>
                    <Flame size={14} color={s ? c.warning : c.textFaint} strokeWidth={2.2} />
                  </Pulse>
                  <T v="caption" tabular color={s ? c.warning : c.textFaint}>
                    {s}
                  </T>
                </View>
                <Pressable
                  accessibilityLabel="Excluir hábito"
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert(h.name, 'Arquivar guarda o histórico em Arquivos. Excluir apaga tudo.', [
                      { text: 'Arquivar', onPress: () => useHabits.getState().update(h.id, { archived: true }) },
                      { text: 'Excluir', style: 'destructive', onPress: () => remove(h.id) },
                      { text: 'Cancelar', style: 'cancel' },
                    ])
                  }>
                  <Trash size={18} color={c.textFaint} />
                </Pressable>
              </View>

              <View style={styles.week}>
                {week.map((k) => {
                  const done = !!h.log[k];
                  const sched = isScheduled(h, k);
                  const isToday = k === day;
                  return (
                    <Pressable
                      key={k}
                      accessibilityLabel={`${DAY_NAMES[fromKey(k).getDay()]} ${fromKey(k).getDate()}`}
                      accessibilityState={{ checked: done }}
                      onPress={() => {
                        tap();
                        tapDay(h.id, k);
                      }}
                      style={styles.dayCol}>
                      <T v="caption" tone={isToday ? 'default' : 'faint'} style={{ fontSize: 11, fontFamily: isToday ? FONTS.bold : FONTS.semibold }}>
                        {WEEKDAYS_SHORT[fromKey(k).getDay()]}
                      </T>
                      <Bounce trigger={done}>
                        <View
                          style={[
                            styles.day,
                            {
                              backgroundColor: done ? c.accent : 'transparent',
                              borderColor: done ? c.accent : isToday ? c.accentLine : c.border,
                              opacity: sched || done ? 1 : 0.35,
                            },
                          ]}>
                          <T v="caption" tabular color={done ? c.onAccent : c.textDim}>
                            {fromKey(k).getDate()}
                          </T>
                        </View>
                      </Bounce>
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          );
        })}
      </Screen>
      <Confetti run={burst} />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Novo hábito">
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Beber 2 litros de água" />
        <View style={{ gap: space.sm }}>
          <T v="overline" tone="dim">
            Ícone
          </T>
          <View style={styles.iconGrid}>
            {Object.entries(HABIT_ICONS).map(([key, Icon]) => {
              const active = icon === key;
              return (
                <Pressable
                  key={key}
                  accessibilityLabel={key}
                  onPress={() => {
                    tap();
                    setIcon(key);
                  }}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Glass interactive tint={active ? c.accent + '33' : undefined} style={styles.iconOpt}>
                    <View>
                      <Icon size={20} color={active ? c.accent : c.textDim} strokeWidth={2} />
                    </View>
                  </Glass>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ gap: space.sm }}>
          <T v="overline" tone="dim">
            Frequência
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip label="Todo dia" active={days.length === 0} onPress={() => setDays([])} />
            {DAY_NAMES.map((d, i) => (
              <Chip
                key={i}
                label={d}
                active={days.includes(i)}
                onPress={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())}
              />
            ))}
          </View>
        </View>
        <Button label="Criar hábito" onPress={save} disabled={!name.trim()} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 28, borderRadius: radius.pill },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6 },
  day: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  iconOpt: { width: 48, height: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
