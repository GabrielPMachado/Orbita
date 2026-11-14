import { CalendarDays, Clock3, Flag, Hash, Trash } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { friendlyDate } from '@/lib/date';
import type { Priority } from '@/lib/parse';
import { useTasks, type TaskStatus } from '@/store/tasks';
import { PRIORITY, space, useColors } from '@/theme';
import { Button, Chip, Field, Segmented, Sheet, T } from './ui';

/** Editar / excluir uma tarefa existente. */
export function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const c = useColors();
  const task = useTasks((s) => s.tasks.find((t) => t.id === taskId));
  const { update, remove, setStatus } = useTasks.getState();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!task) return null;

  const close = () => {
    if (title.trim()) update(task.id, { title: title.trim(), notes: notes.trim() || undefined });
    onClose();
  };

  return (
    <Sheet visible={!!taskId} onClose={close} title="Detalhes">
      <Field value={title} onChangeText={setTitle} placeholder="Título" />
      <Field value={notes} onChangeText={setNotes} placeholder="Adicionar notas" multiline style={{ minHeight: 96, textAlignVertical: 'top' }} />

      {(task.due || task.time || task.tags.length > 0) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {task.due && <Chip icon={CalendarDays} label={friendlyDate(task.due)} />}
          {task.time && <Chip icon={Clock3} label={task.time} />}
          {task.tags.map((t) => (
            <Chip key={t} icon={Hash} label={t} />
          ))}
        </View>
      )}

      <View style={{ gap: space.sm }}>
        <T v="overline" tone="dim">
          Status
        </T>
        <Segmented<TaskStatus>
          value={task.status}
          onChange={(s) => setStatus(task.id, s)}
          options={[
            { value: 'todo', label: 'A fazer' },
            { value: 'doing', label: 'Fazendo' },
            { value: 'done', label: 'Feito' },
          ]}
        />
      </View>

      <View style={{ gap: space.sm }}>
        <T v="overline" tone="dim">
          Prioridade
        </T>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {(Object.keys(PRIORITY) as Priority[]).map((p) => (
            <Chip
              key={p}
              icon={Flag}
              label={PRIORITY[p].label}
              color={PRIORITY[p].color}
              active={task.priority === p}
              onPress={() => update(task.id, { priority: task.priority === p ? undefined : p })}
            />
          ))}
        </View>
      </View>

      <Button
        label="Excluir tarefa"
        icon={Trash}
        variant="danger"
        onPress={() => {
          remove(task.id);
          onClose();
        }}
      />
      <T v="caption" tone="faint" align="center" style={{ color: c.textFaint }}>
        Alterações são salvas ao fechar
      </T>
    </Sheet>
  );
}
