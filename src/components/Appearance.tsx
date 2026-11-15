/**
 * Aparência (Configurações): cor do app (prontas + suas), a roda de intensidade
 * e o estilo/cor dos ícones.
 */
import { Bell, Check, Dumbbell, Plus, Wallet, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSettings } from '@/store/settings';
import { ACCENTS, FONTS, ICON_STYLES, ICON_TONES, radius, readableOn, resolveAccent, space, useColors, type AccentName, type IconStyle, type IconTone } from '@/theme';
import { Knob } from './Knob';
import { Button, IconTile, Section, Segmented, Sheet, T, tap } from './ui';

const MORE = [
  '#FF3B30', '#FF6B6B', '#F97316', '#FB923C', '#F5A524', '#FACC15',
  '#A3E635', '#22C55E', '#10B981', '#2DD4BF', '#22D3EE', '#38BDF8',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#B45309', '#78716C', '#94A3B8', '#E5E7EB', '#C9A227',
];

function Swatch({ color, active, onPress, onLongPress, label }: { color: string; active: boolean; onPress: () => void; onLongPress?: () => void; label: string }) {
  return (
    <Pressable accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} onLongPress={onLongPress} hitSlop={4}>
      <View style={[styles.swatchRing, { borderColor: active ? color : 'transparent' }]}>
        <View style={[styles.swatch, { backgroundColor: color }]}>
          {active ? (
            <Animated.View entering={ZoomIn.springify()}>
              <Check size={16} color={readableOn(color)} strokeWidth={3} />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function Appearance() {
  const c = useColors();
  const { accent, customColors = [], intensity = 4, iconStyle = 'suave', iconTone = 'colorido', setAccent, addColor, removeColor, setIntensity, setIconStyle, setIconTone } =
    useSettings();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('#F2415A');
  const [hexText, setHexText] = useState('');
  const current = resolveAccent(accent);
  const valid = /^#[0-9A-F]{6}$/i.test(draft);

  const [knobOpen, setKnobOpen] = useState(false);
  // tocar numa cor escolhe e abre a roda já nessa cor
  const pick = (a: string) => {
    tap();
    setAccent(a);
    setKnobOpen(true);
  };

  return (
    <>
      <Section title="Aparência">
        {/* cores */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={styles.swatches}>
          {(Object.keys(ACCENTS) as AccentName[]).map((a) => (
            <Swatch key={a} label={ACCENTS[a].label} color={ACCENTS[a].color} active={accent === a} onPress={() => pick(a)} />
          ))}
          {customColors.map((h) => (
            <Swatch
              key={h}
              label={`Cor ${h}`}
              color={h}
              active={accent === h}
              onPress={() => pick(h)}
              onLongPress={() =>
                Alert.alert('Remover esta cor?', h, [
                  { text: 'Cancelar', style: 'cancel' },
                  { text: 'Remover', style: 'destructive', onPress: () => removeColor(h) },
                ])
              }
            />
          ))}
          <Pressable accessibilityLabel="Adicionar cor" onPress={() => setAdding(true)} hitSlop={4}>
            <View style={[styles.swatchRing, { borderColor: 'transparent' }]}>
              <View style={[styles.swatch, { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed' }]}>
                <Plus size={18} color={c.textDim} />
              </View>
            </View>
          </Pressable>
        </ScrollView>

        <T v="caption" tone="faint">
          Toque numa cor para ajustar a intensidade na roda. Segure uma cor sua para remover.
        </T>
      </Section>

      {/* roda de intensidade, por cima de tudo */}
      <Modal visible={knobOpen} transparent animationType="none" statusBarTranslucent onRequestClose={() => setKnobOpen(false)}>
        {knobOpen ? (
          <GestureHandlerRootView style={styles.modalWrap}>
            <Animated.View entering={FadeIn.duration(160)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <Pressable style={{ flex: 1 }} accessibilityLabel="Fechar" onPress={() => setKnobOpen(false)} />
            </Animated.View>
            <Animated.View entering={ZoomIn.springify().damping(18)} style={{ alignItems: 'center', gap: space.md }}>
              <View style={styles.knobSwatches}>
                {[...(Object.keys(ACCENTS) as AccentName[]).map((a) => ({ key: a, color: ACCENTS[a].color })), ...customColors.map((h) => ({ key: h, color: h }))].map((o) => (
                  <Swatch key={o.key} label={o.key} color={o.color} active={accent === o.key} onPress={() => (tap(), setAccent(o.key))} />
                ))}
              </View>
              <Knob value={intensity} onChange={setIntensity} color={current} size={230} />
              <Pressable onPress={() => setKnobOpen(false)} hitSlop={10} style={styles.done}>
                <T v="headline" color="#fff">
                  Pronto
                </T>
              </Pressable>
            </Animated.View>
          </GestureHandlerRootView>
        ) : null}
      </Modal>

      <Section title="Ícones">
        <View style={styles.preview}>
          {[Wallet, Dumbbell, Bell, Zap].map((Icon, i) => (
            <Animated.View key={`${iconStyle}-${iconTone}-${i}`} entering={FadeIn.delay(i * 40)}>
              <IconTile icon={Icon} color={['#10B981', '#F5A524', '#5B9DFF', '#8B5CF6'][i]} size={46} />
            </Animated.View>
          ))}
        </View>
        <Segmented<IconStyle> value={iconStyle} onChange={setIconStyle} options={(Object.keys(ICON_STYLES) as IconStyle[]).map((k) => ({ value: k, label: ICON_STYLES[k] }))} />
        <Segmented<IconTone> value={iconTone} onChange={setIconTone} options={(Object.keys(ICON_TONES) as IconTone[]).map((k) => ({ value: k, label: ICON_TONES[k] }))} />
      </Section>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Nova cor">
        <View style={{ gap: space.md }}>
          <View style={styles.grid}>
            {MORE.map((h) => (
              <Pressable key={h} accessibilityLabel={`Cor ${h}`} onPress={() => (setDraft(h), setHexText(''))} hitSlop={3}>
                <View style={[styles.gridSwatch, { backgroundColor: h, borderColor: draft === h ? c.text : 'transparent' }]} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={[styles.bigSwatch, { backgroundColor: valid ? draft : c.surface3 }]} />
            <TextInput
              value={hexText}
              onChangeText={(t) => {
                const v = ('#' + t.replace(/[^0-9a-f]/gi, '')).slice(0, 7).toUpperCase();
                setHexText(v);
                if (v.length === 7) setDraft(v);
              }}
              placeholder={draft}
              placeholderTextColor={c.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              style={[styles.hex, { color: c.text, backgroundColor: c.surface2, fontFamily: FONTS.semibold }]}
            />
          </View>
          <Button
            label="Usar esta cor"
            disabled={!valid}
            onPress={() => {
              addColor(draft.toUpperCase());
              setAdding(false);
            }}
          />
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  swatches: { paddingHorizontal: space.lg, gap: space.sm, alignItems: 'center' },
  modalWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  knobSwatches: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, maxWidth: 340, backgroundColor: 'rgba(17,19,23,0.92)', borderRadius: 32, padding: 6 },
  done: { paddingHorizontal: space.xl, paddingVertical: space.sm, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  swatchRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  gridSwatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 3 },
  bigSwatch: { width: 48, height: 48, borderRadius: radius.sm },
  hex: { flex: 1, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 16, letterSpacing: 1 },
});
