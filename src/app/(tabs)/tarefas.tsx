import { ArrowRight, Check, Inbox, Plus, RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { toast } from '@/store/toast';
import { TaskRow, taskOrigin } from '@/components/TaskRow';
import { TaskSheet } from '@/components/TaskSheet';
import { Chip, Empty, GlassButton, List, Screen, Segmented, T, tap } from '@/components/ui';
import { addDays, toKey, today } from '@/lib/date';
import { useProjects, type Project } from '@/store/modules';
import { sortTasks, useTasks, type Task, type TaskStatus } from '@/store/tasks';
import { useUI } from '@/store/ui';
import { PRIORITY, space, useColors } from '@/theme';

const COLS = [
  { value: 'todo', label: 'A fazer', next: 'doing', icon: ArrowRight, hint: 'Mover para Fazendo' },
  { value: 'doing', label: 'Fazendo', next: 'done', icon: Check, hint: 'Concluir' },
  { value: 'done', label: 'Feito', next: 'todo', icon: RotateCcw, hint: 'Reabrir' },
] as const;

type Group = 'prazo' | 'origem' | 'prioridade';
const GROUPS: { value: Group; label: string }[] = [
  { value: 'prazo', label: 'Prazo' },
  { value: 'origem', label: 'Origem' },
  { value: 'prioridade', label: 'Prioridade' },
];
type Bucket = { key: string; title: string; items: Task[]; color?: string; tone?: 'danger' };

/** Separa as tarefas em blocos para não ficar tudo misturado. */
function groupTasks(list: Task[], by: Group, projects: Project[]): Bucket[] {
  const out = new Map<string, Bucket>();
  const put = (key: string, title: string, t: Task, extra: Partial<Bucket> = {}) => {
    if (!out.has(key)) out.set(key, { key, title, items: [], ...extra });
    out.get(key)!.items.push(t);
  };
  const hoje = today();
  const amanha = toKey(addDays(new Date(), 1));
  const semana = toKey(addDays(new Date(), 7));
  for (const t of list) {
    if (by === 'prazo') {
      if (!t.due) put('5', 'Sem data', t);
      else if (t.due < hoje) put('0', 'Atrasadas', t, { tone: 'danger' });
      else if (t.due === hoje) put('1', 'Hoje', t);
      else if (t.due === amanha) put('2', 'Amanhã', t);
      else if (t.due <= semana) put('3', 'Próximos 7 dias', t);
      else put('4', 'Mais para frente', t);
    } else if (by === 'prioridade') {
      const p = t.priority;
      put(
        p === 'alta' ? '0' : p === 'media' ? '1' : p === 'baixa' ? '2' : '3',
        p ? `Prioridade ${PRIORITY[p].label.toLowerCase()}` : 'Sem prioridade',
        t,
        { color: p ? PRIORITY[p].color : undefined },
      );
    } else {
      const o = taskOrigin(t, projects);
      put(o.project ? `1${o.label}` : `0${o.label}`, o.label, t, { color: o.color });
    }
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}

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
  const list = filtered.filter((t) => t.status === col).sort(col === 'done' ? (a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0) : sortTasks);
  const current = COLS.find((x) => x.value === col)!;
  const NextIcon = current.icon;
  const [group, setGroup] = useState<Group>('prazo');
  const projects = useProjects((s) => s.items);
  const groups = col === 'done' ? [{ key: 'all', title: '', items: list }] : groupTasks(list, group, projects);

  return (
    <>
      <Screen
        tab
        title="Tarefas"
        actions={<GlassButton icon={Plus} label="Nova" onPress={() => setCapture(true)} />}
        subtitle={`${count('todo')} pendentes · ${count('doing')} em andamento`}>
        <Segmented value={col} onChange={setCol} options={COLS.map((x) => ({ value: x.value, label: x.label, count: count(x.value) }))} />

        {tags.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -space.lg }}
            contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
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
          <>
            {col !== 'done' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <T v="caption" tone="dim">
                  Agrupar
                </T>
                {GROUPS.map((g) => (
                  <Chip key={g.value} label={g.label} active={group === g.value} onPress={() => setGroup(g.value)} />
                ))}
              </View>
            ) : null}
            {groups.map((g) => (
              <View key={g.key} style={{ gap: space.sm }}>
                {g.title ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs }}>
                    {g.color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.color }} /> : null}
                    <T v="overline" tone="dim" color={g.tone === 'danger' ? c.danger : undefined}>
                      {g.title}
                    </T>
                    <T v="caption" tone="faint">
                      {g.items.length}
                    </T>
                  </View>
                ) : null}
                <List>
                  {g.items.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      rich
                      showOrigin={group !== 'origem' || col === 'done'}
                      onPress={() => setEditing(t.id)}
                      trailing={
                        <Pressable
                          accessibilityLabel={current.hint}
                          hitSlop={8}
                          onPress={() => {
                            tap();
                            setStatus(t.id, current.next);
                            toast({
                              message:
                                current.next === 'done' ? 'Tarefa concluída' : current.next === 'doing' ? 'Movida para Fazendo' : 'Tarefa reaberta',
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
              </View>
            ))}
          </>
        )}
        <View />
      </Screen>
      <TaskSheet taskId={editing} onClose={() => setEditing(null)} />
    </>
  );
}
