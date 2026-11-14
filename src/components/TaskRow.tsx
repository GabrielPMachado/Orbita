import { Check, RotateCcw, Trash } from 'lucide-react-native';
import { View } from 'react-native';
import { friendlyDate, today } from '@/lib/date';
import { useTasks, type Task } from '@/store/tasks';
import { toast } from '@/store/toast';
import { PRIORITY, useColors } from '@/theme';
import { SwipeRow } from './motion';
import { Checkbox, Row } from './ui';

export function taskMeta(task: Task, showDate = true) {
  return [showDate && task.due ? friendlyDate(task.due) : null, task.time, ...task.tags.map((t) => '#' + t)]
    .filter(Boolean)
    .join('  ·  ');
}

/** Exclui com opção de desfazer pelo aviso. */
export function deleteTaskWithUndo(task: Task) {
  useTasks.getState().remove(task.id);
  toast({
    message: `“${task.title}” excluída`,
    kind: 'danger',
    action: { label: 'Desfazer', onPress: () => useTasks.setState((s) => ({ tasks: [task, ...s.tasks] })) },
  });
}

export function TaskRow({
  task,
  onPress,
  showDate = true,
  trailing,
  swipe = true,
}: {
  task: Task;
  onPress?: () => void;
  showDate?: boolean;
  trailing?: React.ReactNode;
  /** deslizar para concluir (→) e excluir (←) */
  swipe?: boolean;
}) {
  const c = useColors();
  const toggle = useTasks((s) => s.toggleDone);
  const done = task.status === 'done';
  const late = !done && !!task.due && task.due < today();
  const meta = taskMeta(task, showDate);

  const row = (
    <View>
      <Row
        leading={<Checkbox checked={done} onPress={() => toggle(task.id)} color={task.priority ? PRIORITY[task.priority].color : c.accent} />}
        title={task.title}
        subtitle={(late ? 'Atrasada  ·  ' : '') + meta || undefined}
        subtitleTone={late ? 'danger' : 'dim'}
        strike={done}
        onPress={onPress}
        trailing={trailing}
      />
    </View>
  );

  if (!swipe) return row;
  return (
    <SwipeRow
      left={{
        icon: done ? RotateCcw : Check,
        label: done ? 'Reabrir' : 'Concluir',
        color: done ? '#5B9DFF' : c.success,
        onAction: () => {
          toggle(task.id);
          if (!done) toast({ message: 'Tarefa concluída', action: { label: 'Desfazer', onPress: () => useTasks.getState().toggleDone(task.id) } });
        },
      }}
      right={{ icon: Trash, label: 'Excluir', color: c.danger, onAction: () => deleteTaskWithUndo(task) }}>
      {row}
    </SwipeRow>
  );
}
