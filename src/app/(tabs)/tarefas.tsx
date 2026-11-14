import { ArrowRight, Check, Inbox, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { toast } from '@/store/toast';
import { TaskRow } from '@/components/TaskRow';
import { TaskSheet } from '@/components/TaskSheet';
import { Chip, Empty, List, Screen, Segmented, tap } from '@/components/ui';
import { sortTasks, useTasks, type TaskStatus } from '@/store/tasks';
import { useUI } from '@/store/ui';
import { space, useColors } from '@/theme';

const COLS = [
  { value: 'todo', label: 'A fazer', next: 'doing', icon: ArrowRight, hint: 'Mover para Fazendo' },
  { value: 'doing', label: 'Fazendo', next: 'done', icon: Check, hint: 'Concluir' },
  { value: 'done', label: 'Feito', next: 'todo', icon: RotateCcw, hint: 'Reabrir' },
] as const;

const EMPTY: Record<TaskStatus, { title: string; hint: string }> = {
  todo: { title: 'Nenhuma tarefa pendente', hint: 'Crie uma no botão + — dá pra escrever “relatório sexta 14h #trabalho”.' },
  doing: { title: 'Nada em andamento', hint: 'Use a seta numa tarefa de “A fazer” para começar.' },
  done: { title: 'Nada concluído ainda', hint: 'As tarefas concluídas aparecem aqui.' },
};

export default function Tarefas() {
  const c = useColors();
  const tasks = useTasks((s) => s.tasks);
  const setStatus = useTasks((s) => s.setStatus);
  const setCapture = useUI((s) => s.setCapture);
  const [col, setCol] = useState<TaskStatus>('todo');
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const tags = [...new Set(tasks.flatMap((t) => t.tags))].sort();
  const filtered = tasks.filter((t) => !tag || t.tags.includes(tag));
  const count = (s: TaskStatus) => filtered.filter((t) => t.status === s).length;
  const list = filtered
    .filter((t) => t.status === col)
    .sort(col === 'done' ? (a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0) : sortTasks);
  const current = COLS.find((x) => x.value === col)!;
  const NextIcon = current.icon;

  return (
    <>
      <Screen tab title="Tarefas" subtitle={`${count('todo')} pendentes · ${count('doing')} em andamento`}>
        <Segmented value={col} onChange={setCol} options={COLS.map((x) => ({ value: x.value, label: x.label, count: count(x.value) }))} />

        {tags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
            <Chip label="Todas" active={!tag} onPress={() => setTag(null)} />
            {tags.map((t) => (
              <Chip key={t} label={'#' + t} active={tag === t} onPress={() => setTag(tag === t ? null : t)} />
            ))}
          </ScrollView>
        )}

        {list.length === 0 ? (
          <Empty
            icon={Inbox}
            title={EMPTY[col].title}
            hint={EMPTY[col].hint}
            action={col === 'todo' ? 'Nova tarefa' : undefined}
            onAction={col === 'todo' ? () => setCapture(true) : undefined}
          />
        ) : (
          <List>
            {list.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onPress={() => setEditing(t.id)}
                trailing={
                  <Pressable
                    accessibilityLabel={current.hint}
                    hitSlop={8}
                    onPress={() => {
                      tap();
                      setStatus(t.id, current.next);
                      toast({
                        message: current.next === 'done' ? 'Tarefa concluída' : current.next === 'doing' ? 'Movida para Fazendo' : 'Tarefa reaberta',
                        kind: current.next === 'done' ? 'success' : 'info',
                        action: { label: 'Desfazer', onPress: () => setStatus(t.id, current.value) },
                      });
                    }}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                    <Glass interactive style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                      <View>
                        <NextIcon size={16} color={c.textDim} strokeWidth={2.2} />
                      </View>
                    </Glass>
                  </Pressable>
                }
              />
            ))}
          </List>
        )}
        <View />
      </Screen>
      <TaskSheet taskId={editing} onClose={() => setEditing(null)} />
    </>
  );
}
