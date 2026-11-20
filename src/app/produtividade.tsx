import { router } from 'expo-router';
import { Brain, ChevronRight, Coffee, Maximize2, Pause, Play, RotateCcw, Sofa, Square } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { Bars, Stat, Stepper } from '@/components/extra';
import { Confetti, Pulse } from '@/components/motion';
import { Button, Card, Checkbox, Chip, Field, IconTile, ProgressRing, Screen, Section, Segmented, T, Progress } from '@/components/ui';
import { fromKey, lastNDays, today, WEEKDAYS_SHORT } from '@/lib/date';
import { useFreshBursts, clock, currentMode, focusPause, focusStart, focusStop, MODE_META, remainingSecs, totalSecs, useNow } from '@/lib/focus';
import { useFocus, useFocusSessions, useSubjects, type FocusMode } from '@/store/modules';
import { space, useColors } from '@/theme';

const MODE_INFO: Record<FocusMode, { icon: typeof Brain }> = { foco: { icon: Brain }, pausa: { icon: Coffee }, longa: { icon: Sofa } };

export default function Produtividade() {
  const c = useColors();
  const f = useFocus();
  const sessions = useFocusSessions((s) => s.items);
  const subjects = useSubjects((s) => s.items).filter((s) => !s.archived);
  const now = useNow(!!f.running);
  const fresh = useFreshBursts();

  const mode = currentMode(f);
  const total = totalSecs(mode, f);
  const remaining = remainingSecs(f, now);
  const pct = 1 - remaining / total;
  const info = { ...MODE_META[mode], ...MODE_INFO[mode] };

  const day = today();
  const todayMin = sessions.filter((s) => s.date === day).reduce((a, s) => a + s.minutes, 0);
  const week = lastNDays(7);
  const streak = (() => {
    const days = new Set(sessions.map((s) => s.date));
    let n = 0;
    for (const k of [...lastNDays(120)].reverse()) {
      if (days.has(k)) n++;
      else if (k !== day) break;
    }
    return n;
  })();

  const busy = !!f.running || !!f.paused;
  const Icon = info.icon;

  return (
    <>
      <Screen back title="Produtividade" subtitle="Pomodoro e tempo de foco">
        <Segmented<FocusMode>
          value={mode}
          onChange={(m) => !busy && f.setMode(m)}
          options={[
            { value: 'foco', label: `Foco ${f.durations.foco}` },
            { value: 'pausa', label: `Pausa ${f.durations.pausa}` },
            { value: 'longa', label: `Longa ${f.durations.longa}` },
          ]}
        />

        <View style={{ alignItems: 'center', paddingVertical: space.lg }}>
          <ProgressRing value={pct} size={260} stroke={14} color={info.color}>
            <Pulse active={!!f.running}>
              <Icon size={22} color={info.color} />
            </Pulse>
            <T v="largeTitle" tabular style={{ fontSize: 56, lineHeight: 64 }}>
              {clock(remaining)}
            </T>
            <T v="callout" tone="dim">
              {f.running ? info.label : f.paused ? 'Pausado' : 'Pronto'}
              {mode === 'foco' ? ` · ciclo ${f.cycles + 1}/4` : ''}
            </T>
          </ProgressRing>
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {f.running ? (
            <Button label="Pausar" icon={Pause} onPress={focusPause} style={{ flex: 1 }} />
          ) : (
            <Button label={f.paused ? 'Retomar' : 'Iniciar'} icon={Play} onPress={() => focusStart(mode)} style={{ flex: 1 }} />
          )}
          {busy ? (
            <Button label="Parar" icon={Square} variant="secondary" onPress={focusStop} style={{ flex: 1 }} />
          ) : (
            <Button label="Zerar ciclos" icon={RotateCcw} variant="secondary" onPress={() => f.setCycles(0)} style={{ flex: 1 }} />
          )}
        </View>

        <Card onPress={() => router.push('/foco')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconTile icon={Maximize2} color={info.color} />
          <View style={{ flex: 1 }}>
            <T v="headline">Modo foco</T>
            <T v="caption" tone="dim">
              Tela cheia, sem distrações. A contagem segue na tela de bloqueio.
            </T>
          </View>
          <ChevronRight size={18} color={c.textFaint} />
        </Card>

        {mode === 'foco' && !busy && (
          <View style={{ gap: space.sm }}>
            <Field value={f.label} onChangeText={(label) => f.setDraft({ label })} placeholder="No que você vai focar?" />
            {subjects.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {subjects.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    color={s.color}
                    active={f.subjectId === s.id}
                    onPress={() => f.setDraft({ subjectId: f.subjectId === s.id ? null : s.id })}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T v="headline">Hoje</T>
            <T v="callout" tone="dim" tabular>
              {todayMin} de {f.dailyGoal} min
            </T>
          </View>
          <Progress value={todayMin / f.dailyGoal} color={info.color} />
        </Card>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Sessões hoje" value={String(sessions.filter((s) => s.date === day).length)} />
          <Stat label="Sequência" value={`${streak} dia${streak === 1 ? '' : 's'}`} hint="com algum foco" />
        </View>

        <Section title="Semana">
          <Card>
            <Bars
              data={week.map((k) => ({
                label: WEEKDAYS_SHORT[fromKey(k).getDay()],
                value: sessions.filter((s) => s.date === k).reduce((a, s) => a + s.minutes, 0),
                highlight: k === day,
              }))}
              color={MODE_META.foco.color}
              format={(v) => `${v} min`}
            />
          </Card>
        </Section>

        <Section title="Ajustes">
          <Card style={{ gap: space.md }}>
            <Stepper
              label="Foco"
              value={f.durations.foco}
              min={5}
              max={120}
              step={5}
              onChange={(v) => f.setDuration('foco', v)}
              format={(v) => `${v} min`}
            />
            <Stepper
              label="Pausa"
              value={f.durations.pausa}
              min={1}
              max={30}
              onChange={(v) => f.setDuration('pausa', v)}
              format={(v) => `${v} min`}
            />
            <Stepper
              label="Pausa longa"
              value={f.durations.longa}
              min={5}
              max={60}
              step={5}
              onChange={(v) => f.setDuration('longa', v)}
              format={(v) => `${v} min`}
            />
            <Stepper label="Meta diária" value={f.dailyGoal} min={15} max={600} step={15} onChange={f.setDailyGoal} format={(v) => `${v} min`} />
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: f.autoNext }}
              onPress={() => f.setAutoNext(!f.autoNext)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T v="body">Emendar ciclos</T>
                <T v="caption" tone="dim">
                  Foco → pausa → foco sem precisar tocar
                </T>
              </View>
              <Checkbox checked={f.autoNext} onPress={() => f.setAutoNext(!f.autoNext)} color={info.color} />
            </Pressable>
          </Card>
          <T v="caption" tone="faint">
            O timer continua contando com o app fechado, aparece na tela de bloqueio e na Dynamic Island, e avisa por notificação quando termina.
          </T>
        </Section>
      </Screen>
      <Confetti run={fresh} />
    </>
  );
}
