import { CalendarDays, Clock3, Flag, Hash, Sparkles } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { friendlyDate } from '@/lib/date';
import { parseInput } from '@/lib/parse';
import { useTasks } from '@/store/tasks';
import { PRIORITY, space, useColors } from '@/theme';
import { Button, Chip, Field, Sheet, T } from './ui';

const EXAMPLES = ['Pagar boleto amanhã 15h #casa !alta', 'Reunião sexta 10:30 #trabalho', 'Prova dia 05/12 #faculdade'];

/** Captura rápida: linguagem natural com data, hora, #tags e !prioridade. */
export function QuickCapture({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = useColors();
  const add = useTasks((s) => s.add);
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseInput(text), [text]);

  const save = () => {
    if (!parsed.title) return;
    add({ title: parsed.title, due: parsed.due, time: parsed.time, tags: parsed.tags, priority: parsed.priority });
    setText('');
    onClose();
  };

  const hasMeta = parsed.due || parsed.time || parsed.priority || parsed.tags.length > 0;

  return (
    <Sheet visible={visible} onClose={onClose} title="Nova tarefa">
      <Field
        autoFocus
        value={text}
        onChangeText={setText}
        placeholder="O que precisa ser feito?"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {text.trim() && hasMeta ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {/* cada pedaço entendido "pula" para dentro enquanto você digita */}
          {parsed.due && (
            <Animated.View key={'d' + parsed.due} entering={ZoomIn.springify().damping(12)} exiting={ZoomOut.duration(120)}>
              <Chip icon={CalendarDays} label={friendlyDate(parsed.due)} active />
            </Animated.View>
          )}
          {parsed.time && (
            <Animated.View key={'t' + parsed.time} entering={ZoomIn.springify().damping(12)} exiting={ZoomOut.duration(120)}>
              <Chip icon={Clock3} label={parsed.time} active />
            </Animated.View>
          )}
          {parsed.priority && (
            <Animated.View key={'p' + parsed.priority} entering={ZoomIn.springify().damping(12)} exiting={ZoomOut.duration(120)}>
              <Chip icon={Flag} label={PRIORITY[parsed.priority].label} active color={PRIORITY[parsed.priority].color} />
            </Animated.View>
          )}
          {parsed.tags.map((t) => (
            <Animated.View key={'#' + t} entering={ZoomIn.springify().damping(12)} exiting={ZoomOut.duration(120)}>
              <Chip icon={Hash} label={t} active color={c.textDim} />
            </Animated.View>
          ))}
        </View>
      ) : null}
      {!text.trim() && (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Sparkles size={14} color={c.textDim} />
            <T v="caption" tone="dim">
              Escreva do seu jeito: o Órbita entende data, hora, #tag e !prioridade
            </T>
          </View>
          {EXAMPLES.map((e) => (
            <Pressable key={e} onPress={() => setText(e)} style={({ pressed }) => [{ paddingVertical: 4 }, pressed && { opacity: 0.6 }]}>
              <T v="callout" tone="faint">
                {e}
              </T>
            </Pressable>
          ))}
        </View>
      )}
      <Button label="Adicionar tarefa" onPress={save} disabled={!parsed.title} />
    </Sheet>
  );
}
