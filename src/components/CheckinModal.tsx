/**
 * Check-in do dia: um modal simples, de uma tela só, na primeira abertura de cada dia
 * (lib/checkin.ts). Humor, sono, energia, foco do dia e o que ficou de ontem. Tudo opcional.
 */
import { router } from 'expo-router';
import { Modal } from 'react-native';
import { BedDouble, Minus, Plus, X } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useKeyboardInset, useScrollToFocused, type ScrollRef } from '@/lib/keyboard';
import Animated, { FadeIn, SlideInDown, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glass } from '@/components/Glass';
import { Bounce, PressScale } from '@/components/motion';
import { Button, Checkbox, Chip, GlassButton, T, tap } from '@/components/ui';
import { addDays, brl, greeting, toKey, today } from '@/lib/date';
import { MOODS } from '@/lib/icons';
import { useCheckin } from '@/store/checkin';
import { useFinance } from '@/store/finance';
import { isScheduled, useHabits } from '@/store/habits';
import { useMood } from '@/store/misc';
import { useHealth } from '@/store/modules';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';
import { FONTS, radius, space, useColors } from '@/theme';

const ENERGY = ['Esgotado', 'Baixa', 'Ok', 'Boa', 'A mil'];
const fmtSleep = (h: number) => `${Math.floor(h)}h${h % 1 ? '30' : ''}`;

export function CheckinModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {visible ? <CheckinSheet onClose={onClose} /> : null}
    </Modal>
  );
}

function CheckinSheet({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const kb = useKeyboardInset();
  const lift = useAnimatedStyle(() => ({ paddingBottom: kb.inset.value }));
  const scrollRef = useRef<ScrollRef>(null);
  useScrollToFocused(scrollRef, kb.height);
  const day = today();
  const yesterday = toKey(addDays(new Date(), -1));
  const name = useSettings((s) => s.name);

  const savedMood = useMood((s) => s.moods[day]);
  const setMoodStore = useMood((s) => s.set);
  const sleepMap = useHealth((s) => s.sleep);
  const setSleep = useHealth((s) => s.setSleep);
  const entry = useCheckin((s) => s.entries[day]);
  const save = useCheckin((s) => s.save);
  const habitsAll = useHabits((s) => s.habits);
  const toggleHabit = useHabits((s) => s.toggle);
  const txs = useFinance((s) => s.txs);

  const [mood, setMood] = useState(savedMood ?? 0);
  const [sleep, setSleepLocal] = useState(sleepMap[day] ?? sleepMap[yesterday] ?? 7.5);
  const [energy, setEnergy] = useState(entry?.energy ?? 0);
  const [intention, setIntention] = useState(entry?.intention ?? '');
  const [addExpense, setAddExpense] = useState(false);

  const missed = habitsAll.filter((h) => !h.archived && isScheduled(h, yesterday));
  const ySpent = useMemo(() => txs.filter((t) => t.date === yesterday && t.type === 'out').reduce((a, t) => a + t.amount, 0), [txs, yesterday]);

  const close = onClose;
  const finish = () => {
    if (mood) setMoodStore(day, mood);
    setSleep(day, sleep);
    save(day, { energy: energy || undefined, intention: intention.trim() || undefined, done: true });
    close();
    toast({ message: intention.trim() ? `${greeting()}! Foco: ${intention.trim()}` : `Check-in salvo. ${greeting()}!` });
    if (addExpense) setTimeout(() => router.push({ pathname: '/financas/novo', params: { date: 'ontem' } }), 450);
  };

  return (
    <View style={{ flex: 1 }}>
      <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Fechar" />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, lift]} pointerEvents="box-none">
        <Animated.View entering={SlideInDown.springify().damping(22)} style={{ width: '100%' }}>
          <Glass
            floating
            style={[
              styles.sheet,
              {
                // com o teclado aberto: fica em cima dele e encolhe para caber
                maxHeight: kb.height ? height - kb.height - insets.top - space.md : height * 0.9,
                paddingBottom: kb.height ? space.md : insets.bottom + space.md,
                backgroundColor: c.surface + 'F2',
              },
            ]}>
            <ScrollView
              ref={scrollRef}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 1 }}
              contentContainerStyle={{ gap: space.lg }}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <T v="overline" tone="dim">
                    Check-in do dia
                  </T>
                  <T v="title">{name ? `${greeting()}, ${name.split(' ')[0]}` : greeting()}</T>
                </View>
                <GlassButton icon={X} accessibilityLabel="Agora não" onPress={close} />
              </View>

              <View style={styles.block}>
                <T v="caption" tone="dim">
                  Como você está?
                </T>
                <View style={styles.row}>
                  {MOODS.map((m, i) => {
                    const on = mood === i + 1;
                    const Icon = m.icon;
                    return (
                      <PressScale
                        key={m.label}
                        accessibilityRole="button"
                        accessibilityLabel={m.label}
                        onPress={() => {
                          tap();
                          setMood(i + 1);
                        }}
                        style={{ flex: 1 }}>
                        <View style={[styles.mood, { backgroundColor: on ? c.accent + '2E' : c.surface2, borderColor: on ? c.accent : 'transparent' }]}>
                          <Bounce trigger={on ? mood : null} amount={1.3}>
                            <Icon size={22} color={on ? c.accent : c.textDim} />
                          </Bounce>
                          <T v="caption" color={on ? c.text : c.textDim} style={{ fontSize: 11 }}>
                            {m.label}
                          </T>
                        </View>
                      </PressScale>
                    );
                  })}
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.box, { backgroundColor: c.surface2 }]}>
                  <View style={styles.boxHead}>
                    <BedDouble size={14} color={c.info} />
                    <T v="caption" tone="dim">
                      Sono
                    </T>
                  </View>
                  <View style={styles.stepper}>
                    <Pressable hitSlop={10} accessibilityLabel="Menos sono" onPress={() => setSleepLocal((v) => Math.max(0, v - 0.5))}>
                      <Minus size={18} color={c.textDim} />
                    </Pressable>
                    <T tabular style={[styles.num, { color: sleep < 6 ? c.warning : c.text }]}>
                      {fmtSleep(sleep)}
                    </T>
                    <Pressable hitSlop={10} accessibilityLabel="Mais sono" onPress={() => setSleepLocal((v) => Math.min(14, v + 0.5))}>
                      <Plus size={18} color={c.textDim} />
                    </Pressable>
                  </View>
                </View>
                <View style={[styles.box, { backgroundColor: c.surface2 }]}>
                  <View style={styles.boxHead}>
                    <T v="caption" tone="dim">
                      Energia
                    </T>
                    <T v="caption" color={energy ? c.warning : c.textFaint}>
                      {energy ? ENERGY[energy - 1] : '—'}
                    </T>
                  </View>
                  <View style={styles.bars}>
                    {ENERGY.map((label, i) => (
                      <Pressable key={label} accessibilityLabel={label} hitSlop={6} onPress={() => setEnergy(i + 1)} style={{ flex: 1, justifyContent: 'flex-end', height: 30 }}>
                        <View style={{ height: 8 + i * 5, borderRadius: 3, backgroundColor: energy > i ? c.warning : c.surface3 }} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.block}>
                <T v="caption" tone="dim">
                  Foco de hoje
                </T>
                <TextInput
                  value={intention}
                  onChangeText={setIntention}
                  placeholder="Uma frase curta (opcional)"
                  placeholderTextColor={c.textFaint}
                  maxLength={80}
                  returnKeyType="done"
                  style={[styles.input, { color: c.text, backgroundColor: c.surface2, fontFamily: FONTS.regular }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
                />
              </View>

              <View style={styles.block}>
                <T v="caption" tone="dim">
                  Ontem{ySpent ? ` · gastos registrados ${brl(ySpent)}` : ''}
                </T>
                {missed.length > 0 && (
                  <View style={styles.chips}>
                    {missed.map((h) => (
                      <Chip key={h.id} label={h.name} active={!!h.log[yesterday]} color={c.success} onPress={() => toggleHabit(h.id, yesterday)} />
                    ))}
                  </View>
                )}
                <Pressable onPress={() => setAddExpense(!addExpense)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: addExpense }}>
                  <Checkbox checked={addExpense} onPress={() => setAddExpense(!addExpense)} />
                  <T v="callout" style={{ flex: 1 }}>
                    Gastei algo fora do Apple Pay
                  </T>
                </Pressable>
              </View>

              <View style={styles.row}>
                <Button label="Agora não" variant="secondary" onPress={close} style={{ flex: 1 }} />
                <Button label="Salvar" onPress={finish} style={{ flex: 1.4 }} />
              </View>
            </ScrollView>
          </Glass>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  block: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  mood: { alignItems: 'center', gap: 4, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1 },
  box: { flex: 1, borderRadius: radius.sm, padding: space.md, gap: space.sm },
  boxHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  num: { fontFamily: FONTS.display, fontSize: 22 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  input: { borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
});
