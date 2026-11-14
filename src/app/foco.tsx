/**
 * Modo foco — tela cheia, sem distrações. A tela não apaga enquanto está aberta (keep-awake),
 * o anel anda sozinho e, com o app fechado, a contagem continua na tela de bloqueio e na
 * Dynamic Island pela Live Activity.
 */
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Brain, Coffee, Pause, Play, Repeat, SkipForward, Sofa, Square, X } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Glass } from '@/components/Glass';
import { Confetti, PressScale } from '@/components/motion';
import { GlassButton, impact, T, tap } from '@/components/ui';
import { useFreshBursts, clock, currentMode, focusPause, focusSkip, focusStart, focusStop, MODE_META, remainingSecs, totalSecs, useNow } from '@/lib/focus';
import { useFocus, useFocusSessions, useSubjects, type FocusMode } from '@/store/modules';
import { today } from '@/lib/date';
import { FONTS, radius, space, useColors } from '@/theme';

const ICONS = { foco: Brain, pausa: Coffee, longa: Sofa };
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 300;
const STROKE = 10;

function Dial({ progress, color, running, endsInMs }: { progress: number; color: string; running: boolean; endsInMs: number }) {
  const reduce = useReducedMotion();
  const r = (SIZE - STROKE) / 2 - 14;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(progress);

  // enquanto roda, o anel anda sozinho até o fim (linear); pausado, fica parado
  useEffect(() => {
    cancelAnimation(p);
    p.value = progress;
    if (running && !reduce) p.value = withTiming(1, { duration: Math.max(0, endsInMs), easing: Easing.linear });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, color, Math.round(progress * 100), reduce]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));
  const ticks = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const big = i % 5 === 0;
        const r1 = SIZE / 2 - 2;
        const r2 = r1 - (big ? 9 : 5);
        return { x1: SIZE / 2 + r1 * Math.cos(a), y1: SIZE / 2 + r1 * Math.sin(a), x2: SIZE / 2 + r2 * Math.cos(a), y2: SIZE / 2 + r2 * Math.sin(a), big, i };
      }),
    [],
  );
  const lit = Math.floor(progress * 60);
  return (
    <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
      {ticks.map((t) => (
        <Line
          key={t.i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.i < lit ? color : '#FFFFFF'}
          strokeOpacity={t.i < lit ? 0.9 : t.big ? 0.28 : 0.12}
          strokeWidth={t.big ? 2 : 1.4}
          strokeLinecap="round"
        />
      ))}
      <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke="#FFFFFF" strokeOpacity={0.07} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={r}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circ} ${circ}`}
        animatedProps={arc}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
      />
    </Svg>
  );
}

/** brilho de fundo que "respira" (4 s inspira, 4 s expira) */
function Breath({ color, active }: { color: string; active: boolean }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(0);
  useEffect(() => {
    if (!active || reduce) {
      s.value = withTiming(0.4, { duration: 600 });
      return;
    }
    s.value = withRepeat(
      withSequence(withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.sin) })),
      -1,
    );
    return () => cancelAnimation(s);
  }, [active, reduce, s]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + s.value * 0.5, transform: [{ scale: 0.85 + s.value * 0.25 }] }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={620} height={620}>
        <Defs>
          <RadialGradient id="breath" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.42} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={620} height={620} fill="url(#breath)" />
      </Svg>
    </Animated.View>
  );
}

function RoundButton({ icon: Icon, onPress, big, color, label }: { icon: typeof Play; onPress: () => void; big?: boolean; color?: string; label: string }) {
  const d = big ? 84 : 58;
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={label} scaleTo={0.88} onPress={onPress}>
      <Glass interactive tint={color} style={{ width: d, height: d, borderRadius: d / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <View>
          <Icon size={big ? 32 : 22} color={big ? '#0B0C0F' : '#F4F5F7'} strokeWidth={2.2} fill={big ? '#0B0C0F' : 'transparent'} />
        </View>
      </Glass>
    </PressScale>
  );
}

export default function FocoScreen() {
  useKeepAwake();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const f = useFocus();
  const subjects = useSubjects((s) => s.items);
  const sessions = useFocusSessions((s) => s.items);
  const now = useNow(!!f.running);
  const fresh = useFreshBursts();

  const mode: FocusMode = currentMode(f);
  const meta = MODE_META[mode];
  const Icon = ICONS[mode];
  const total = totalSecs(mode, f);
  const rem = remainingSecs(f, now);
  const progress = Math.max(0, Math.min(1, 1 - rem / total));
  const busy = !!f.running || !!f.paused;
  const active = (f.running ?? f.paused) as { label?: string; subjectId?: string } | undefined;
  const subject = subjects.find((s) => s.id === (active?.subjectId ?? f.subjectId));
  const day = today();
  const todayMin = sessions.filter((s) => s.date === day).reduce((a, s) => a + s.minutes, 0);
  const doneDots = mode === 'foco' ? f.cycles : mode === 'longa' ? 4 : Math.max(1, f.cycles);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/produtividade'));

  return (
    <View style={{ flex: 1, backgroundColor: '#050506' }}>
      <Breath color={meta.color} active={!!f.running} />

      {/* topo */}
      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <GlassButton icon={X} accessibilityLabel="Fechar modo foco" onPress={close} />
        <PressScale
          accessibilityRole="switch"
          accessibilityState={{ checked: f.autoNext }}
          onPress={() => {
            tap();
            f.setAutoNext(!f.autoNext);
          }}>
          <Glass interactive tint={f.autoNext ? meta.color + '40' : undefined} style={styles.pill}>
            <View>
              <Repeat size={15} color={f.autoNext ? meta.color : c.textDim} />
            </View>
            <T v="caption" color={f.autoNext ? c.text : c.textDim}>
              {f.autoNext ? 'Ciclos emendados' : 'Emendar ciclos'}
            </T>
          </Glass>
        </PressScale>
      </View>

      {/* centro */}
      <View style={styles.center}>
        <Animated.View key={mode} entering={FadeInDown.duration(380)} style={{ alignItems: 'center', gap: 6, marginBottom: space.xl }}>
          <View style={[styles.phase, { backgroundColor: meta.color + '22' }]}>
            <Icon size={15} color={meta.color} />
            <T v="overline" color={meta.color}>
              {meta.label.toUpperCase()}
            </T>
          </View>
          <T v="title" align="center" numberOfLines={2} style={{ maxWidth: 300 }}>
            {mode === 'foco' ? (active?.label ?? (f.label.trim() || subject?.name || 'Tempo de foco')) : mode === 'longa' ? 'Levanta, alonga, bebe água' : 'Respira com o círculo'}
          </T>
        </Animated.View>

        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          <Dial progress={progress} color={meta.color} running={!!f.running} endsInMs={rem * 1000} />
          <T tabular style={[styles.time, { opacity: f.paused ? 0.55 : 1 }]}>
            {clock(rem)}
          </T>
          <View style={styles.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i < doneDots ? meta.color : '#FFFFFF22' }]} />
            ))}
          </View>
          {f.paused ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={{ position: 'absolute', bottom: 64 }}>
              <T v="caption" tone="dim">
                Pausado
              </T>
            </Animated.View>
          ) : null}
        </View>

        {!busy && mode === 'foco' ? (
          <Animated.View entering={FadeIn.delay(120)} exiting={FadeOut} style={{ width: 300, marginTop: space.xl }}>
            <Glass style={styles.input}>
              <TextInput
                value={f.label}
                onChangeText={(label) => f.setDraft({ label })}
                placeholder="No que você vai focar?"
                placeholderTextColor={c.textFaint}
                style={{ color: c.text, fontFamily: FONTS.regular, fontSize: 16, textAlign: 'center', paddingVertical: 12 }}
                returnKeyType="go"
                onSubmitEditing={() => focusStart('foco')}
              />
            </Glass>
          </Animated.View>
        ) : null}
      </View>

      {/* controles */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + space.xl }]}>
        <RoundButton
          icon={Square}
          label="Parar"
          onPress={() => {
            impact();
            focusStop();
          }}
        />
        <RoundButton icon={f.running ? Pause : Play} big color={meta.color} label={f.running ? 'Pausar' : 'Iniciar'} onPress={() => (f.running ? focusPause() : focusStart(mode))} />
        <RoundButton
          icon={SkipForward}
          label="Pular fase"
          onPress={() => {
            impact();
            focusSkip();
          }}
        />
      </View>
      <View style={{ position: 'absolute', bottom: insets.bottom + 4, width: '100%', alignItems: 'center' }}>
        <T v="caption" tone="faint" tabular>
          {todayMin} de {f.dailyGoal} min hoje
        </T>
      </View>
      <Confetti run={fresh} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, zIndex: 2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 40, borderRadius: radius.pill, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  phase: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  time: { fontFamily: FONTS.display, fontSize: 68, lineHeight: 76, color: '#F4F5F7', letterSpacing: -1 },
  dots: { flexDirection: 'row', gap: 8, position: 'absolute', bottom: 88 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  input: { borderRadius: radius.lg, overflow: 'hidden' },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xl },
});
