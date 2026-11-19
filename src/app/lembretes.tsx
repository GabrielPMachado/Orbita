import { BellRing, CalendarDays, Check, Plus, Repeat, RotateCcw, Trash } from 'lucide-react-native';
import { SwipeRow } from '@/components/motion';
import { toast } from '@/store/toast';
import { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Button, Checkbox, Chip, Empty, Field, GlassButton, List, Row, Screen, Section, Segmented, Sheet, T } from '@/components/ui';
import { friendlyDate, fromKey, toKey, WEEKDAYS } from '@/lib/date';
import type { Repeat as RepeatMode } from '@/lib/notifications';
import { parseInput } from '@/lib/parse';
import { useReminders, type Reminder } from '@/store/reminders';
import { space, useColors } from '@/theme';

function whenLabel(at: number, repeat: RepeatMode) {
  const d = new Date(at);
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (repeat === 'daily') return `Todo dia às ${hm}`;
  if (repeat === 'weekly') return `Toda ${WEEKDAYS[d.getDay()]} às ${hm}`;
  return `${friendlyDate(toKey(d))} às ${hm}`;
}

export default function Lembretes() {
  const c = useColors();
  const reminders = useReminders((s) => s.reminders);
  const { add, toggleDone, remove } = useReminders.getState();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [repeat, setRepeat] = useState<RepeatMode>('none');

  const parsed = useMemo(() => parseInput(text), [text]);
  const at = useMemo(() => {
    const base = parsed.due ? fromKey(parsed.due) : new Date();
    const [h, m] = (parsed.time ?? '09:00').split(':').map(Number);
    base.setHours(h, m, 0, 0);
    return base;
  }, [parsed]);

  const save = async () => {
    if (!parsed.title) return;
    const ok = await add(parsed.title, at, repeat);
    setText('');
    setRepeat('none');
    setOpen(false);
    if (!ok)
      Alert.alert('Salvo sem notificação', 'Permita notificações para o app nos Ajustes do iPhone ou escolha um horário no futuro.');
  };

  const active = reminders.filter((r) => !r.done && (r.repeat !== 'none' || r.at > Date.now()));
  const past = reminders.filter((r) => !active.includes(r));

  const row = (r: Reminder) => (
    <SwipeRow
      key={r.id}
      left={{ icon: r.done ? RotateCcw : Check, label: r.done ? 'Reativar' : 'Feito', color: r.done ? '#5B9DFF' : c.success, onAction: () => toggleDone(r.id) }}
      right={{
        icon: Trash,
        label: 'Excluir',
        color: c.danger,
        onAction: () => {
          remove(r.id);
          toast({ message: `Lembrete “${r.title}” excluído`, kind: 'danger' });
        },
      }}>
    <Row
      leading={<Checkbox checked={r.done} onPress={() => toggleDone(r.id)} color={c.info} />}
      title={r.title}
      subtitle={whenLabel(r.at, r.repeat)}
      strike={r.done}
      trailing={
        <Pressable accessibilityLabel="Excluir lembrete" hitSlop={10} onPress={() => remove(r.id)}>
          <Trash size={18} color={c.textFaint} />
        </Pressable>
      }
    />
    </SwipeRow>
  );

  return (
    <>
      <Screen back title="Lembretes" subtitle="Notificações no horário certo" actions={<GlassButton icon={Plus} label="Novo" onPress={() => setOpen(true)} />}>
        {reminders.length === 0 && (
          <Empty icon={BellRing} title="Nenhum lembrete" hint="Escreva “tomar remédio amanhã 8h” e escolha se repete." action="Criar lembrete" onAction={() => setOpen(true)} />
        )}
        {active.length > 0 && (
          <Section title="Ativos">
            <List>{active.map(row)}</List>
          </Section>
        )}
        {past.length > 0 && (
          <Section title="Concluídos e passados">
            <List>{past.map(row)}</List>
          </Section>
        )}
      </Screen>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Novo lembrete">
        <Field value={text} onChangeText={setText} placeholder="Ex.: Tomar remédio amanhã 8h" />
        <Segmented<RepeatMode>
          value={repeat}
          onChange={setRepeat}
          options={[
            { value: 'none', label: 'Uma vez' },
            { value: 'daily', label: 'Diário' },
            { value: 'weekly', label: 'Semanal' },
          ]}
        />
        {parsed.title ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <Chip icon={repeat === 'none' ? CalendarDays : Repeat} label={whenLabel(at.getTime(), repeat)} active />
          </View>
        ) : (
          <T v="caption" tone="dim">
            Sem horário, o padrão é 09:00.
          </T>
        )}
        <Button label="Salvar lembrete" onPress={save} disabled={!parsed.title} />
      </Sheet>
    </>
  );
}
