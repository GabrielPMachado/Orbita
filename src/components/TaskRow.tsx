import { Briefcase, CalendarDays, Check, Flag, Inbox, RotateCcw, Trash } from 'lucide-react-native';
import { View } from 'react-native';
import { friendlyDate, today } from '@/lib/date';
import { useProjects, type Project } from '@/store/modules';
import { useTasks, type Task } from '@/store/tasks';
import { toast } from '@/store/toast';
import { PRIORITY, useColors } from '@/theme';
import { SwipeRow } from './motion';
import { Checkbox, Row, T } from './ui';

/** De onde a tarefa veio: projeto (com o pai, se for subprojeto) ou caixa de entrada. */
export function taskOrigin(task: Task, projects: Project[]): { label: string; color?: string; project: boolean } {
  if (task.projectId) {
    const p = projects.find((x) => x.id === task.projectId);
    if (p) {
      const parent = p.parentId ? projects.find((x) => x.id === p.parentId) : undefined;
      return { label: parent ? `${parent.name} › ${p.name}` : p.name, color: p.color, project: true };
    }
    return { label: 'Projeto arquivado', project: true };
  }
  return {
    label: task.source === 'estacio' ? 'Estácio' : task.source === 'revisao' ? 'Revisão' : task.source === 'atalho' ? 'Atalho' : 'Caixa de entrada',
    project: false,
  };
}

function Pill({ icon: Icon, label, color }: { icon: typeof Flag; label: string; color: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 99,
        backgroundColor: color + '1F',
        maxWidth: 200,
      }}>
      <Icon size={11} color={color} strokeWidth={2.4} />
      <T v="caption" color={color} numberOfLines={1} style={{ fontSize: 11.5 }}>
        {label}
      </T>
    </View>
  );
}

/** Selos: prioridade, origem, prazo (vermelho se atrasada) e tags. */
export function TaskMeta({ task, showDate = true, showOrigin = true }: { task: Task; showDate?: boolean; showOrigin?: boolean }) {
  const c = useColors();
  const projects = useProjects((s) => s.items);
  const done = task.status === 'done';
  const late = !done && !!task.due && task.due < today();
  const isToday = task.due === today();
  const o = taskOrigin(task, projects);
  const pills = [
    task.priority ? <Pill key="p" icon={Flag} label={PRIORITY[task.priority].label} color={PRIORITY[task.priority].color} /> : null,
    showOrigin ? <Pill key="o" icon={o.project ? Briefcase : Inbox} label={o.label} color={o.color ?? c.textDim} /> : null,
    showDate && task.due ? (
      <Pill
        key="d"
        icon={CalendarDays}
        label={(late ? 'Atrasada · ' : '') + friendlyDate(task.due) + (task.time ? ` ${task.time}` : '')}
        color={late ? c.danger : isToday ? c.warning : c.textDim}
      />
    ) : !task.due && task.time ? (
      <Pill key="t" icon={CalendarDays} label={task.time} color={c.textDim} />
    ) : null,
  ].filter(Boolean);
  if (!pills.length && !task.tags.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 3, opacity: done ? 0.6 : 1 }}>
      {pills}
      {task.tags.length ? (
        <T v="caption" tone="faint" numberOfLines={1} style={{ fontSize: 11.5 }}>
          {task.tags.map((t) => '#' + t).join(' ')}
        </T>
      ) : null}
    </View>
  );
}

export function taskMeta(task: Task, showDate = true) {
  return [showDate && task.due ? friendlyDate(task.due) : null, task.time, ...task.tags.map((t) => '#' + t)].filter(Boolean).join('  ·  ');
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
  rich = false,
  showOrigin = true,
}: {
  task: Task;
  onPress?: () => void;
  showDate?: boolean;
  trailing?: React.ReactNode;
  /** selos de prioridade, origem e prazo em vez da linha de texto */
  rich?: boolean;
  showOrigin?: boolean;
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
        subtitle={rich ? task.notes?.split('\n')[0] || undefined : (late ? 'Atrasada  ·  ' : '') + meta || undefined}
        subtitleTone={rich ? 'dim' : late ? 'danger' : 'dim'}
        meta={rich ? <TaskMeta task={task} showDate={showDate} showOrigin={showOrigin} /> : undefined}
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
