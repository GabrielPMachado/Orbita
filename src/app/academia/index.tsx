import { router } from 'expo-router';
import { Dumbbell, Flame, Plus, Timer } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Bars, Stat } from '@/components/extra';
import { Button, Card, Empty, Field, GlassButton, IconTile, List, Row, Screen, Section, Sheet, T } from '@/components/ui';
import { friendlyDate, fromKey, lastNDays, WEEKDAYS_SHORT } from '@/lib/date';
import { uid } from '@/lib/storage';
import { usePlans, useSessions } from '@/store/modules';
import { space, useColors } from '@/theme';

const TEMPLATES: { name: string; focus: string; exercises: string[] }[] = [
  { name: 'Treino A', focus: 'Peito, ombro e tríceps', exercises: ['Supino reto', 'Supino inclinado com halteres', 'Desenvolvimento', 'Elevação lateral', 'Tríceps corda'] },
  { name: 'Treino B', focus: 'Costas e bíceps', exercises: ['Puxada frontal', 'Remada curvada', 'Remada baixa', 'Rosca direta', 'Rosca martelo'] },
  { name: 'Treino C', focus: 'Pernas', exercises: ['Agachamento livre', 'Leg press', 'Cadeira extensora', 'Mesa flexora', 'Panturrilha em pé'] },
];

export default function Academia() {
  const c = useColors();
  const plans = usePlans((s) => s.items);
  const sessions = useSessions((s) => s.items);
  const addPlan = usePlans((s) => s.add);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [focus, setFocus] = useState('');

  const active = plans.filter((p) => !p.archived);
  const week = lastNDays(7);
  const month = lastNDays(30);
  const weekCount = sessions.filter((s) => week.includes(s.date)).length;
  const monthMinutes = sessions.filter((s) => month.includes(s.date)).reduce((a, s) => a + s.minutes, 0);
  // sequência de semanas com pelo menos 1 treino
  const streakDays = (() => {
    const days = new Set(sessions.map((s) => s.date));
    let n = 0;
    for (const k of [...lastNDays(60)].reverse()) {
      if (days.has(k)) n++;
      else if (n > 0) break;
    }
    return n;
  })();

  const create = (tpl?: (typeof TEMPLATES)[number]) => {
    const id = addPlan({
      name: tpl?.name ?? (name.trim() || `Treino ${String.fromCharCode(65 + active.length)}`),
      focus: tpl?.focus ?? (focus.trim() || undefined),
      exercises: (tpl?.exercises ?? []).map((n) => ({ id: uid(), name: n, sets: 3, reps: '10-12', weight: 0 })),
    });
    setOpen(false);
    setName('');
    setFocus('');
    router.push(`/academia/${id}`);
  };

  return (
    <>
      <Screen back title="Academia" subtitle="Fichas, cargas e histórico" actions={<GlassButton icon={Plus} label="Ficha" onPress={() => setOpen(true)} />}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Nesta semana" value={`${weekCount} treino${weekCount === 1 ? '' : 's'}`} />
          <Stat label="Últimos 30 dias" value={`${Math.round(monthMinutes / 60)} h`} hint={`${monthMinutes} min`} />
        </View>

        <Card>
          <Bars
            data={week.map((k) => ({
              label: WEEKDAYS_SHORT[fromKey(k).getDay()],
              value: sessions.filter((s) => s.date === k).reduce((a, s) => a + s.minutes, 0),
              highlight: k === week[week.length - 1],
            }))}
            height={80}
            format={(v) => `${v} min`}
          />
        </Card>

        {active.length === 0 ? (
          <>
            <Empty icon={Dumbbell} title="Nenhuma ficha" hint="Crie suas fichas (A, B, C…) com exercícios, séries e cargas." />
            <Section title="Começar com um modelo">
              <List>
                {TEMPLATES.map((t) => (
                  <Row key={t.name} leading={<IconTile icon={Dumbbell} />} title={t.name} subtitle={t.focus} onPress={() => create(t)} chevron />
                ))}
              </List>
            </Section>
          </>
        ) : (
          <Section title="Fichas">
            <List>
              {active.map((p) => {
                const last = sessions.filter((s) => s.planId === p.id).sort((a, b) => b.date.localeCompare(a.date))[0];
                return (
                  <Row
                    key={p.id}
                    leading={<IconTile icon={Dumbbell} />}
                    title={p.name}
                    subtitle={[p.focus, `${p.exercises.length} exercícios`, last ? `último ${friendlyDate(last.date).toLowerCase()}` : null].filter(Boolean).join('  ·  ')}
                    onPress={() => router.push(`/academia/${p.id}`)}
                    chevron
                  />
                );
              })}
            </List>
          </Section>
        )}

        {sessions.length > 0 && (
          <Section title="Histórico">
            {streakDays > 1 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Flame size={14} color={c.warning} />
                <T v="caption" tone="warning">
                  {streakDays} dias seguidos treinando
                </T>
              </View>
            )}
            <List>
              {[...sessions]
                .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
                .slice(0, 12)
                .map((s) => {
                  const p = plans.find((x) => x.id === s.planId);
                  return (
                    <Row
                      key={s.id}
                      leading={<IconTile icon={Timer} color={c.textDim} />}
                      title={p?.name ?? 'Treino'}
                      subtitle={`${friendlyDate(s.date)} · ${s.done.length} exercícios${s.volume ? ` · ${Math.round(s.volume).toLocaleString('pt-BR')} kg de volume` : ''}`}
                      trailing={
                        <T v="callout" tone="dim" tabular>
                          {s.minutes} min
                        </T>
                      }
                    />
                  );
                })}
            </List>
          </Section>
        )}
      </Screen>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Nova ficha">
        <Field label="Nome" value={name} onChangeText={setName} placeholder={`Treino ${String.fromCharCode(65 + active.length)}`} />
        <Field label="Foco" value={focus} onChangeText={setFocus} placeholder="Ex.: Peito e tríceps" />
        <Button label="Criar em branco" onPress={() => create()} />
        <T v="overline" tone="dim">
          Ou use um modelo
        </T>
        <List>
          {TEMPLATES.map((t) => (
            <Row key={t.name} title={t.name} subtitle={t.focus} onPress={() => create(t)} chevron />
          ))}
        </List>
      </Sheet>
    </>
  );
}
