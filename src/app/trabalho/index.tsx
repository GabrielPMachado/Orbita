import { router } from 'expo-router';
import { Briefcase, CornerDownRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { ProjectSheet } from '@/components/ProjectSheet';
import { Card, Empty, GlassButton, IconTile, Progress, Screen, Section, T } from '@/components/ui';
import { useClients, useProjects, type Project } from '@/store/modules';
import { useTasks } from '@/store/tasks';
import { space, useColors } from '@/theme';

export default function Trabalho() {
  const c = useColors();
  const projects = useProjects((s) => s.items);
  const clients = useClients((s) => s.items);
  const tasks = useTasks((s) => s.tasks);
  const [editing, setEditing] = useState<Project | 'new' | null>(null);

  const active = projects.filter((p) => !p.archived);
  const roots = active.filter((p) => !p.parentId || !active.some((x) => x.id === p.parentId));
  const stats = (id: string) => {
    const ids = [id, ...active.filter((p) => p.parentId === id).map((p) => p.id)];
    const list = tasks.filter((t) => t.projectId && ids.includes(t.projectId));
    const done = list.filter((t) => t.status === 'done').length;
    return { total: list.length, done, open: list.length - done };
  };
  const totalOpen = tasks.filter((t) => t.projectId && t.status !== 'done' && active.some((p) => p.id === t.projectId)).length;

  const card = (p: Project, sub = false) => {
    const s = stats(p.id);
    const client = clients.find((x) => x.id === p.clientId);
    return (
      <Card key={p.id} onPress={() => router.push(`/trabalho/${p.id}`)} style={{ gap: space.md, marginLeft: sub ? space.xl : 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          {sub ? <CornerDownRight size={16} color={c.textFaint} /> : null}
          <IconTile icon={Briefcase} color={p.color} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="headline" numberOfLines={1}>
              {p.name}
            </T>
            <T v="caption" tone="dim" numberOfLines={1}>
              {[client?.name, s.total ? `${s.open} abertas · ${s.done} feitas` : 'Sem tarefas'].filter(Boolean).join('  ·  ')}
            </T>
          </View>
          {s.total > 0 && (
            <T v="headline" tabular color={p.color}>
              {Math.round((s.done / s.total) * 100)}%
            </T>
          )}
        </View>
        {s.total > 0 && <Progress value={s.done / s.total} color={p.color} height={4} />}
      </Card>
    );
  };

  return (
    <>
      <Screen
        back
        title="Trabalho"
        subtitle={active.length ? `${active.length} projetos · ${totalOpen} tarefas abertas` : 'Projetos, subprojetos e tarefas'}
        actions={<GlassButton icon={Plus} label="Projeto" onPress={() => setEditing('new')} />}>
        {active.length === 0 ? (
          <Empty
            icon={Briefcase}
            title="Nenhum projeto"
            hint="Organize freelas, faculdade ou o trabalho em projetos. As tarefas aparecem também no Kanban."
            action="Criar projeto"
            onAction={() => setEditing('new')}
          />
        ) : (
          <Section title="Projetos">
            {roots.map((p) => (
              <View key={p.id} style={{ gap: space.sm }}>
                {card(p)}
                {active.filter((x) => x.parentId === p.id).map((x) => card(x, true))}
              </View>
            ))}
          </Section>
        )}
        {projects.some((p) => p.archived) && (
          <T v="caption" tone="faint" align="center" onPress={() => router.push('/arquivos')}>
            {projects.filter((p) => p.archived).length} arquivados — ver em Arquivos
          </T>
        )}
      </Screen>
      <ProjectSheet editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}
