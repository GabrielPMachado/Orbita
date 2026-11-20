import { Minus, Plus, Target, Trash, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { AnimatedNumber, celebrate, Confetti } from '@/components/motion';
import { toast } from '@/store/toast';
import { Button, Card, Empty, Field, GlassButton, IconTile, Progress, Screen, Sheet, T, tap } from '@/components/ui';
import { friendlyDate } from '@/lib/date';
import { parseInput } from '@/lib/parse';
import { useGoals } from '@/store/misc';
import { space, useColors } from '@/theme';

const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function Metas() {
  const c = useColors();
  const allGoals = useGoals((s) => s.goals);
  const goals = allGoals.filter((g) => !g.archived);
  const { add, bump, remove } = useGoals.getState();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [unit, setUnit] = useState('');
  const [deadline, setDeadline] = useState('');

  const [burst, setBurst] = useState(0);
  const n = Number(target.replace(/\./g, '').replace(',', '.'));
  const save = () => {
    if (!title.trim() || !n) return;
    const due = deadline.trim() ? parseInput('x ' + deadline).due : undefined;
    add({ title: title.trim(), target: n, unit: unit.trim(), deadline: due });
    setTitle('');
    setTarget('');
    setUnit('');
    setDeadline('');
    setOpen(false);
  };

  const done = goals.filter((g) => g.current >= g.target).length;

  return (
    <>
      <Screen
        back
        title="Metas"
        subtitle={goals.length ? `${done} de ${goals.length} alcançadas` : 'Objetivos com progresso visível'}
        actions={<GlassButton icon={Plus} label="Nova" onPress={() => setOpen(true)} />}>
        {goals.length === 0 && (
          <Empty
            icon={Target}
            title="Nenhuma meta"
            hint="Ex.: ler 12 livros, juntar R$ 5.000, correr 100 km."
            action="Criar meta"
            onAction={() => setOpen(true)}
          />
        )}
        {goals.map((g) => {
          const pct = g.target ? g.current / g.target : 0;
          const complete = pct >= 1;
          const step = g.target >= 100 ? Math.round(g.target / 20) : 1;
          return (
            <Card key={g.id} style={{ gap: space.md }}>
              <View style={styles.head}>
                <IconTile icon={complete ? Trophy : Target} color={complete ? c.success : c.accent} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="headline" numberOfLines={2}>
                    {g.title}
                  </T>
                  <T v="caption" tone="dim">
                    {g.deadline ? `Até ${friendlyDate(g.deadline).toLowerCase()}` : 'Sem prazo'}
                  </T>
                </View>
                <Pressable
                  accessibilityLabel="Excluir meta"
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert(g.title, 'Arquivar guarda a meta em Arquivos. Excluir apaga.', [
                      { text: 'Arquivar', onPress: () => useGoals.getState().update(g.id, { archived: true }) },
                      { text: 'Excluir', style: 'destructive', onPress: () => remove(g.id) },
                      { text: 'Cancelar', style: 'cancel' },
                    ])
                  }>
                  <Trash size={18} color={c.textFaint} />
                </Pressable>
              </View>

              <View style={styles.values}>
                <T v="title" tabular>
                  <AnimatedNumber value={g.current} format={num} />
                  <T v="callout" tone="dim">
                    {' '}
                    / {num(g.target)} {g.unit}
                  </T>
                </T>
                <T v="headline" tabular color={complete ? c.success : c.accent}>
                  {Math.round(pct * 100)}%
                </T>
              </View>
              <Progress value={pct} color={complete ? c.success : undefined} />

              <View style={styles.actions}>
                {[
                  { icon: Minus, d: -step, label: 'Diminuir' },
                  { icon: Plus, d: step, label: 'Aumentar' },
                ].map(({ icon: Icon, d, label }) => (
                  <Pressable
                    key={label}
                    accessibilityLabel={label}
                    onPress={() => {
                      tap();
                      const before = g.current;
                      bump(g.id, d);
                      if (before < g.target && before + d >= g.target) {
                        setBurst((b) => b + 1);
                        celebrate();
                        toast({ message: `Meta alcançada: ${g.title}` });
                      }
                    }}
                    style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
                    <Glass interactive tint={d > 0 ? c.accent + '26' : undefined} style={styles.stepBtn}>
                      <View>
                        <Icon size={18} color={d > 0 ? c.accent : c.textDim} strokeWidth={2.3} />
                      </View>
                      <T v="caption" tone="dim" tabular>
                        {num(step)}
                      </T>
                    </Glass>
                  </Pressable>
                ))}
              </View>
            </Card>
          );
        })}
      </Screen>
      <Confetti run={burst} />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Nova meta">
        <Field label="Objetivo" value={title} onChangeText={setTitle} placeholder="Ex.: Ler livros em 2027" />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Field label="Alvo" value={target} onChangeText={setTarget} placeholder="12" keyboardType="decimal-pad" style={{ flex: 1 }} />
          <Field label="Unidade" value={unit} onChangeText={setUnit} placeholder="livros" style={{ flex: 1 }} />
        </View>
        <Field label="Prazo (opcional)" value={deadline} onChangeText={setDeadline} placeholder="31/12, em 3 semanas…" />
        <Button label="Criar meta" onPress={save} disabled={!title.trim() || !n} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  values: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  stepBtn: { height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
