import { Minus, Pencil, Plus, Target, Trash, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { AnimatedNumber, celebrate, Confetti } from '@/components/motion';
import { toast } from '@/store/toast';
import { Button, Card, Empty, Field, GlassButton, IconTile, Progress, Screen, Sheet, T, tap } from '@/components/ui';
import { friendlyDate } from '@/lib/date';
import { parseInput } from '@/lib/parse';
import { useGoals, type Goal } from '@/store/misc';
import { space, useColors } from '@/theme';

const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
/** "1.234,5" → 1234.5; vazio ou inválido → NaN */
const parseNum = (t: string) =>
  Number(
    t
      .trim()
      .replace(/\s/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.'),
  );
/** valor automático dos botões: 1, ou 5% do alvo quando ele é grande */
const autoStep = (target: number) => (target >= 100 ? Math.round(target / 20) : 1);
const stepOf = (g: Goal) => (g.step && g.step > 0 ? g.step : autoStep(g.target));

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
  const [stepTxt, setStepTxt] = useState('');
  const [ajuste, setAjuste] = useState<Goal | null>(null);

  const [burst, setBurst] = useState(0);
  const n = parseNum(target);
  const stepN = parseNum(stepTxt);
  const save = () => {
    if (!title.trim() || !n) return;
    const due = deadline.trim() ? parseInput('x ' + deadline).due : undefined;
    add({ title: title.trim(), target: n, unit: unit.trim(), deadline: due, ...(stepN > 0 ? { step: stepN } : {}) });
    setTitle('');
    setTarget('');
    setUnit('');
    setDeadline('');
    setStepTxt('');
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
          const step = stepOf(g);
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
                <Pressable
                  accessibilityLabel="Lançar um valor"
                  onPress={() => setAjuste(g)}
                  style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.7 : 1 })}>
                  <Glass interactive style={styles.stepBtn}>
                    <Pencil size={16} color={c.textDim} strokeWidth={2.3} />
                    <T v="caption" tone="dim">
                      Valor
                    </T>
                  </Glass>
                </Pressable>
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
        <Field
          label="Valor dos botões + e − (opcional)"
          value={stepTxt}
          onChangeText={setStepTxt}
          placeholder={n ? `automático: ${num(autoStep(n))}` : 'automático'}
          keyboardType="decimal-pad"
        />
        <Button label="Criar meta" onPress={save} disabled={!title.trim() || !n} />
      </Sheet>

      <AjusteSheet goal={ajuste} onClose={() => setAjuste(null)} onReached={() => setBurst((b) => b + 1)} />
    </>
  );
}

/** Lançar um valor qualquer (somar, tirar ou definir o total) e escolher o valor dos botões. */
function AjusteSheet({ goal, onClose, onReached }: { goal: Goal | null; onClose: () => void; onReached: () => void }) {
  const c = useColors();
  const [valor, setValor] = useState('');
  const [passo, setPasso] = useState('');
  const g = useGoals((s) => s.goals.find((x) => x.id === goal?.id)) ?? goal;
  const v = parseNum(valor);
  const ok = Number.isFinite(v) && v > 0;
  const passoN = parseNum(passo);

  const fechar = () => {
    setValor('');
    setPasso('');
    onClose();
  };
  const aplicar = (novo: number) => {
    if (!g) return;
    const antes = g.current;
    const depois = Math.max(0, Math.round(novo * 100) / 100);
    useGoals.getState().update(g.id, { current: depois });
    tap();
    if (antes < g.target && depois >= g.target) {
      onReached();
      celebrate();
      toast({ message: `Meta alcançada: ${g.title}` });
    }
    fechar();
  };
  const salvarPasso = () => {
    if (!g) return;
    useGoals.getState().update(g.id, { step: passoN > 0 ? passoN : undefined });
    toast({ message: passoN > 0 ? `Botões agora somam ${num(passoN)}` : 'Botões no valor automático' });
    setPasso('');
  };

  return (
    <Sheet visible={!!goal} onClose={fechar} title={g?.title ?? 'Meta'}>
      {g ? (
        <>
          <T v="callout" tone="dim">
            Agora: {num(g.current)} de {num(g.target)} {g.unit}
          </T>
          <Field label="Valor" value={valor} onChangeText={setValor} placeholder="Ex.: 250" keyboardType="decimal-pad" />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Somar" icon={Plus} onPress={() => aplicar(g.current + v)} disabled={!ok} style={{ flex: 1 }} />
            <Button label="Tirar" icon={Minus} variant="secondary" onPress={() => aplicar(g.current - v)} disabled={!ok} style={{ flex: 1 }} />
          </View>
          <Button
            label="Definir como total"
            variant="secondary"
            onPress={() => aplicar(v)}
            disabled={!Number.isFinite(v) || v < 0 || !valor.trim()}
          />

          <View style={{ height: 1, backgroundColor: c.separator, marginVertical: space.sm }} />
          <Field
            label="Valor dos botões + e −"
            value={passo}
            onChangeText={setPasso}
            placeholder={g.step ? `hoje: ${num(g.step)}` : `automático: ${num(autoStep(g.target))}`}
            keyboardType="decimal-pad"
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Salvar valor" variant="secondary" onPress={salvarPasso} disabled={!(passoN > 0)} style={{ flex: 1 }} />
            {g.step ? (
              <Button
                label="Automático"
                variant="secondary"
                onPress={() => {
                  useGoals.getState().update(g.id, { step: undefined });
                  toast({ message: 'Botões no valor automático' });
                }}
                style={{ flex: 1 }}
              />
            ) : null}
          </View>
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  values: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  stepBtn: { height: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
