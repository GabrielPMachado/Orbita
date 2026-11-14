import { router, useLocalSearchParams } from 'expo-router';
import { Briefcase, CornerDownRight, Pencil, Plus, Send } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ProjectSheet } from '@/components/ProjectSheet';
import { TaskRow } from '@/components/TaskRow';
import { TaskSheet } from '@/components/TaskSheet';
import { Card, Field, GlassButton, IconTile, List, Progress, Row, Screen, Section, T, impact } from '@/components/ui';
import { parseInput } from '@/lib/parse';
import { useClients, useProjects } from '@/store/modules';
import { sortTasks, useTasks } from '@/store/tasks';
import { space, useColors } from '@/theme';

export default function Projeto() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projects = useProjects((s) => s.items);
  const project = projects.find((p) => p.id === id);
  const client = useClients((s) => s.items.find((x) => x.id === project?.clientId));
  const tasks = useTasks((s) => s.tasks);
  const addTask = useTasks((s) => s.add);
  const [text, setText] = useState('');
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editing, setEditing] = useState<typeof project | 'new' | null>(null);
  const [newSub, setNewSub] = useState(false);

  const mine = useMemo(() => tasks.filter((t) => t.projectId === id), [tasks, id]);
  if (!project) return null;

  const subs = projects.filter((p) => p.parentId === id && !p.archived);
  const todo = mine.filter((t) => t.status === 'todo').sort(sortTasks);
  const doing = mine.filter((t) => t.status === 'doing').sort(sortTasks);
  const done = mine.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  const pct = mine.length ? done.length / mine.length : 0;

  const add = () => {
    const p = parseInput(text);
    if (!p.title) return;
    impact();
    addTask({ title: p.title, due: p.due, time: p.time, tags: p.tags, priority: p.priority, projectId: id });
    setText('');
  };

  const group = (label: string, list: typeof mine) =>
    list.length > 0 && (
      <Section title={`${label} · ${list.length}`}>
        <List>
          {list.map((t) => (
            <TaskRow key={t.id} task={t} onPress={() => setEditingTask(t.id)} />
          ))}
        </List>
      </Section>
    );

  return (
    <>
      <Screen
        back
        title={project.name}
        subtitle={[client?.name, project.description].filter(Boolean).join(' · ') || undefined}
        actions={<GlassButton icon={Pencil} accessibilityLabel="Editar projeto" onPress={() => setEditing(project)} />}>
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconTile icon={Briefcase} color={project.color} size={44} />
            <View style={{ flex: 1 }}>
              <T v="headline">{mine.length ? `${done.length} de ${mine.length} concluídas` : 'Nenhuma tarefa ainda'}</T>
              <T v="caption" tone="dim">
                {doing.length} em andamento
              </T>
            </View>
            <T v="title" tabular color={project.color}>
              {Math.round(pct * 100)}%
            </T>
          </View>
          <Progress value={pct} color={project.color} />
        </Card>

        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
          <Field
            value={text}
            onChangeText={setText}
            placeholder="Nova tarefa — ex.: deploy sexta 14h !alta"
            returnKeyType="done"
            onSubmitEditing={add}
            style={{ flex: 1 }}
          />
          <View style={{ marginBottom: 4 }}>
            <GlassButton icon={Send} accessibilityLabel="Adicionar tarefa" onPress={add} color={text.trim() ? c.accent : c.textFaint} />
          </View>
        </View>

        {group('Fazendo', doing)}
        {group('A fazer', todo)}

        <Section title="Subprojetos" action="Adicionar" onAction={() => setNewSub(true)}>
          {subs.length ? (
            <List>
              {subs.map((s) => {
                const st = tasks.filter((t) => t.projectId === s.id);
                const d = st.filter((t) => t.status === 'done').length;
                return (
                  <Row
                    key={s.id}
                    leading={<CornerDownRight size={18} color={s.color} />}
                    title={s.name}
                    subtitle={st.length ? `${d}/${st.length} feitas` : 'Sem tarefas'}
                    onPress={() => router.push(`/trabalho/${s.id}`)}
                    chevron
                  />
                );
              })}
            </List>
          ) : (
            <Card onPress={() => setNewSub(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Plus size={16} color={c.textDim} />
              <T v="callout" tone="dim">
                Dividir em subprojetos (front, back, design…)
              </T>
            </Card>
          )}
        </Section>

        {group('Feito', done)}
      </Screen>
      <TaskSheet taskId={editingTask} onClose={() => setEditingTask(null)} />
      <ProjectSheet editing={editing ?? null} onClose={() => setEditing(null)} />
      <ProjectSheet editing={newSub ? 'new' : null} defaultParent={id} onClose={() => setNewSub(false)} />
    </>
  );
}
