import { EASE_OUT } from '@/lib/motionTokens';
/**
 * Check-in do dia: aparece na primeira abertura de cada dia (lib/checkin.ts).
 * Humor → sono → energia e intenção → o que ficou de ontem. Tudo pulável.
 */
import { router } from 'expo-router';
import { BedDouble, ChevronLeft, Minus, Plus, Receipt, X, Zap } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ambient, Glass } from '@/components/Glass';
import { Bounce, PressScale } from '@/components/motion';
import { Button, Checkbox, Chip, Field, GlassButton, IconTile, List, Row, T, tap } from '@/components/ui';
import { addDays, brl, greeting, toKey, today } from '@/lib/date';
import { habitIcon, MOODS } from '@/lib/icons';
import { useCheckin } from '@/store/checkin';
import { useFinance } from '@/store/finance';
import { isScheduled, useHabits } from '@/store/habits';
import { useMood } from '@/store/misc';
import { useHealth } from '@/store/modules';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { FONTS, radius, space, useColors } from '@/theme';

const STEPS = ['humor', 'sono', 'energia', 'ontem'] as const;
const ENERGY = ['Esgotado', 'Baixa', 'Ok', 'Boa', 'A mil'];
const SLEEP_CHIPS = [5, 6, 7, 8, 9];
const fmtSleep = (h: number) => `${Math.floor(h)}h${h % 1 ? '30' : ''}`;

export default function Checkin() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const day = today();
  const yesterday = toKey(addDays(new Date(), -1));
  const name = useSettings((s) => s.name);

  const mood = useMood((s) => s.moods[day]);
  const setMood = useMood((s) => s.set);
  const sleepMap = useHealth((s) => s.sleep);
  const setSleep = useHealth((s) => s.setSleep);
  const entry = useCheckin((s) => s.entries[day]);
  const save = useCheckin((s) => s.save);
  const habitsAll = useHabits((s) => s.habits);
  const toggleHabit = useHabits((s) => s.toggle);
  const txs = useFinance((s) => s.txs);

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [sleep, setSleepLocal] = useState(sleepMap[day] ?? sleepMap[yesterday] ?? 7.5);
  const [energy, setEnergy] = useState(entry?.energy ?? 0);
  const [intention, setIntention] = useState(entry?.intention ?? '');
  const [addExpense, setAddExpense] = useState(false);

  const missed = habitsAll.filter((h) => !h.archived && isScheduled(h, yesterday));
  const yTx = useMemo(() => txs.filter((t) => t.date === yesterday && t.type === 'out'), [txs, yesterday]);
  const ySpent = yTx.reduce((a, t) => a + t.amount, 0);

  const go = (n: number) => {
    tap();
    setDir(n > step ? 1 : -1);
    setStep(n);
  };
  const next = () => (step < STEPS.length - 1 ? go(step + 1) : finish());

  const finish = () => {
    setSleep(day, sleep);
    save(day, { energy: energy || undefined, intention: intention.trim() || undefined, done: true });
    router.back();
    toast({ message: intention.trim() ? `${greeting()}! Foco: ${intention.trim()}` : `Check-in salvo. ${greeting()}!` });
    if (addExpense) setTimeout(() => router.push({ pathname: '/financas/novo', params: { date: 'ontem' } }), 450);
  };

  const enter = dir === 1 ? SlideInRight.duration(260).easing(EASE_OUT) : SlideInLeft.duration(260).easing(EASE_OUT);
  const exit = dir === 1 ? SlideOutLeft.duration(180) : SlideOutRight.duration(180);
  const first = name ? name.split(' ')[0] : '';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Ambient />
      {/* topo: voltar · progresso · pular */}
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        {step > 0 ? (
          <GlassButton icon={ChevronLeft} accessibilityLabel="Voltar" onPress={() => go(step - 1)} />
        ) : (
          <GlassButton icon={X} accessibilityLabel="Fechar" onPress={() => router.back()} />
        )}
        <View style={styles.dots}>
          {STEPS.map((s, i) => (
            <View key={s} style={[styles.dot, { width: i === step ? 22 : 7, backgroundColor: i <= step ? c.accent : c.surface3 }]} />
          ))}
        </View>
        <Pressable accessibilityRole="button" onPress={next} hitSlop={12} style={{ minWidth: 44, alignItems: 'flex-end' }}>
          <T v="callout" tone="dim">
            Pular
          </T>
        </Pressable>
      </View>

      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Animated.View key={step} entering={enter} exiting={exit} style={[styles.page, { paddingBottom: insets.bottom + 110 }]}>
          {STEPS[step] === 'humor' && (
            <>
              <Head overline={greeting().toUpperCase() + (first ? `, ${first.toUpperCase()}` : '')} title="Como você está hoje?" />
              <View style={styles.moodGrid}>
                {MOODS.map((m, i) => {
                  const active = mood === i + 1;
                  const Icon = m.icon;
                  return (
                    <PressScale
                      key={m.label}
                      accessibilityRole="button"
                      accessibilityLabel={m.label}
                      onPress={() => {
                        setMood(day, i + 1);
                        setTimeout(() => go(1), 260);
                      }}
                      style={{ flex: 1 }}>
                      <Glass interactive tint={active ? c.accent + '33' : undefined} style={[styles.moodBtn, active && { borderColor: c.accent }]}>
                        <Bounce trigger={active ? mood : null} amount={1.3}>
                          <Icon size={30} color={active ? c.accent : c.textDim} />
                        </Bounce>
                        <T v="caption" color={active ? c.text : c.textDim}>
                          {m.label}
                        </T>
                      </Glass>
                    </PressScale>
                  );
                })}
              </View>
            </>
          )}

          {STEPS[step] === 'sono' && (
            <>
              <Head overline="SONO" title="Quanto você dormiu?" />
              <View style={styles.sleepRow}>
                <RoundStep icon={Minus} label="Menos" onPress={() => setSleepLocal((v) => Math.max(0, v - 0.5))} />
                <View style={{ alignItems: 'center', minWidth: 150 }}>
                  <BedDouble size={22} color={c.info} />
                  <T tabular style={[styles.big, { color: c.text }]}>
                    {fmtSleep(sleep)}
                  </T>
                  <T v="caption" tone={sleep < 6 ? 'warning' : 'dim'}>
                    {sleep < 6 ? 'Pouco. Pega leve hoje.' : sleep >= 7 ? 'Boa noite de sono' : 'Quase lá'}
                  </T>
                </View>
                <RoundStep icon={Plus} label="Mais" onPress={() => setSleepLocal((v) => Math.min(14, v + 0.5))} />
              </View>
              <View style={styles.chips}>
                {SLEEP_CHIPS.map((h) => (
                  <Chip key={h} label={`${h}h`} active={sleep === h} onPress={() => setSleepLocal(h)} />
                ))}
              </View>
            </>
          )}

          {STEPS[step] === 'energia' && (
            <>
              <Head overline="ENERGIA" title="Como está sua energia?" />
              <View style={styles.energyRow}>
                {ENERGY.map((label, i) => {
                  const lvl = i + 1;
                  const on = energy >= lvl;
                  return (
                    <PressScale
                      key={label}
                      accessibilityRole="button"
                      accessibilityLabel={label}
                      onPress={() => setEnergy(lvl)}
                      style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <View style={[styles.bar, { height: 26 + i * 14, backgroundColor: on ? c.warning : c.surface3 }]} />
                      <Zap size={14} color={on ? c.warning : c.textFaint} fill={energy === lvl ? c.warning : 'transparent'} />
                    </PressScale>
                  );
                })}
              </View>
              <T v="headline" align="center" color={energy ? c.text : c.textFaint}>
                {energy ? ENERGY[energy - 1] : 'Toque numa barra'}
              </T>
              <View style={{ gap: space.sm, marginTop: space.lg }}>
                <Field
                  label="Intenção do dia"
                  value={intention}
                  onChangeText={setIntention}
                  placeholder="Ex.: terminar o relatório sem pressa"
                  returnKeyType="next"
                  onSubmitEditing={next}
                  maxLength={80}
                />
                <T v="caption" tone="faint">
                  Uma frase curta. Ela fica no topo da tela Hoje.
                </T>
              </View>
            </>
          )}

          {STEPS[step] === 'ontem' && (
            <>
              <Head overline="ONTEM" title="Ficou algo para trás?" />
              {missed.length > 0 && (
                <Animated.View entering={FadeInDown.delay(80)} style={{ gap: space.sm }}>
                  <T v="overline" tone="dim">
                    Hábitos de ontem
                  </T>
                  <List>
                    {missed.map((h) => {
                      const done = !!h.log[yesterday];
                      return (
                        <Row
                          key={h.id}
                          leading={<IconTile icon={habitIcon(h.icon)} color={done ? c.success : c.textDim} />}
                          title={h.name}
                          subtitle={done ? 'Feito' : 'Não marcado'}
                          subtitleTone={done ? 'dim' : 'warning'}
                          trailing={<Checkbox checked={done} onPress={() => toggleHabit(h.id, yesterday)} color={c.success} />}
                          onPress={() => toggleHabit(h.id, yesterday)}
                        />
                      );
                    })}
                  </List>
                </Animated.View>
              )}
              <Animated.View entering={FadeInDown.delay(160)} style={{ gap: space.sm }}>
                <T v="overline" tone="dim">
                  Gastos de ontem
                </T>
                <Glass style={styles.spentCard}>
                  <IconTile icon={Receipt} color={c.danger} />
                  <View style={{ flex: 1 }}>
                    <T v="headline" tabular>
                      {yTx.length ? brl(ySpent) : 'Nada registrado'}
                    </T>
                    <T v="caption" tone="dim">
                      {yTx.length ? `${yTx.length} lançamento${yTx.length > 1 ? 's' : ''}` : 'Nem Apple Pay, nem manual'}
                    </T>
                  </View>
                </Glass>
                <Pressable
                  onPress={() => setAddExpense(!addExpense)}
                  style={styles.toggleRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: addExpense }}>
                  <View style={{ flex: 1 }}>
                    <T v="body">Gastei algo fora do Apple Pay</T>
                    <T v="caption" tone="dim">
                      Dinheiro, Pix, cartão físico — abre o lançamento já com a data de ontem
                    </T>
                  </View>
                  <Checkbox checked={addExpense} onPress={() => setAddExpense(!addExpense)} />
                </Pressable>
              </Animated.View>
            </>
          )}
        </Animated.View>
      </View>

      <Animated.View entering={FadeIn.delay(200)} style={[styles.bottom, { paddingBottom: insets.bottom + space.md }]}>
        <Button label={step === STEPS.length - 1 ? 'Começar o dia' : 'Continuar'} onPress={next} />
      </Animated.View>
    </View>
  );
}

function Head({ overline, title }: { overline: string; title: string }) {
  return (
    <View style={{ gap: 6, marginBottom: space.xl }}>
      <T v="overline" tone="dim">
        {overline}
      </T>
      <T v="largeTitle">{title}</T>
    </View>
  );
}

function RoundStep({ icon: Icon, onPress, label }: { icon: typeof Plus; onPress: () => void; label: string }) {
  const c = useColors();
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} scaleTo={0.88}>
      <Glass interactive style={styles.round}>
        <View>
          <Icon size={22} color={c.text} />
        </View>
      </Glass>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, zIndex: 2 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 7, borderRadius: 4 },
  page: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.xxl, gap: space.lg },
  moodGrid: { flexDirection: 'row', gap: space.sm },
  moodBtn: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sleepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.lg },
  big: { fontFamily: FONTS.display, fontSize: 56, lineHeight: 64, letterSpacing: -1 },
  round: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chips: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' },
  energyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, height: 140, paddingHorizontal: space.md },
  bar: { width: '100%', borderRadius: 8 },
  spentCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg },
});
