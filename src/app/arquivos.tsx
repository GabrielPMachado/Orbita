import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Archive, ArchiveRestore, BookOpen, Briefcase, CheckCheck, Images, Library, Repeat2, Target, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { confirmDelete } from '@/components/extra';
import { ImageViewer } from '@/components/Photos';
import { Button, Empty, IconTile, List, Row, Screen, Section, Segmented, T } from '@/components/ui';
import { addDays, friendlyDate, toKey } from '@/lib/date';
import { habitIcon } from '@/lib/icons';
import { mediaUri } from '@/lib/media';
import { useFinance } from '@/store/finance';
import { useHabits } from '@/store/habits';
import { useGoals, useNotes } from '@/store/misc';
import { useProjects, useSubjects, useTitles } from '@/store/modules';
import { useSettings } from '@/store/settings';
import { useTasks } from '@/store/tasks';
import { space, useColors } from '@/theme';

type Tab = 'arquivados' | 'fotos';

export default function Arquivos() {
  const c = useColors();
  const [tab, setTab] = useState<Tab>('arquivados');
  const [viewing, setViewing] = useState<string | null>(null);

  const projects = useProjects((s) => s.items);
  const subjects = useSubjects((s) => s.items);
  const notes = useNotes((s) => s.notes);
  const habits = useHabits((s) => s.habits);
  const goals = useGoals((s) => s.goals);
  const tasks = useTasks((s) => s.tasks);
  const txs = useFinance((s) => s.txs);
  const titles = useTitles((s) => s.items);
  const avatar = useSettings((s) => s.avatar);

  const archived = [
    ...projects.filter((p) => p.archived).map((p) => ({ key: 'p' + p.id, icon: Briefcase, color: p.color, title: p.name, kind: 'Projeto', restore: () => useProjects.getState().update(p.id, { archived: false }), del: () => useProjects.getState().remove(p.id) })),
    ...notes.filter((n) => n.archived).map((n) => ({ key: 'n' + n.id, icon: Library, color: c.textDim, title: n.title || 'Nota sem título', kind: 'Nota', restore: () => useNotes.getState().update(n.id, { archived: false }), del: () => useNotes.getState().remove(n.id) })),
    ...habits.filter((h) => h.archived).map((h) => ({ key: 'h' + h.id, icon: habitIcon(h.icon), color: c.accent, title: h.name, kind: 'Hábito', restore: () => useHabits.getState().update(h.id, { archived: false }), del: () => useHabits.getState().remove(h.id) })),
    ...goals.filter((g) => g.archived).map((g) => ({ key: 'g' + g.id, icon: Target, color: c.success, title: g.title, kind: 'Meta', restore: () => useGoals.getState().update(g.id, { archived: false }), del: () => useGoals.getState().remove(g.id) })),
    ...subjects.filter((s) => s.archived).map((s) => ({ key: 's' + s.id, icon: BookOpen, color: s.color, title: s.name, kind: 'Matéria', restore: () => useSubjects.getState().update(s.id, { archived: false }), del: () => useSubjects.getState().remove(s.id) })),
  ];

  const weekAgo = addDays(new Date(), -7).getTime();
  const oldDone = tasks.filter((t) => t.status === 'done' && (t.doneAt ?? 0) < weekAgo);

  const photos: { name: string; from: string; at?: string }[] = [
    ...notes.flatMap((n) => (n.images ?? []).map((name) => ({ name, from: n.title || 'Nota', at: toKey(new Date(n.updatedAt)) }))),
    ...txs.flatMap((t) => t.attachments.map((name) => ({ name, from: t.description || t.category, at: t.date }))),
    ...titles.filter((t) => t.poster).map((t) => ({ name: t.poster!, from: t.name })),
    ...(avatar ? [{ name: avatar, from: 'Foto de perfil' }] : []),
  ];

  return (
    <>
      <Screen back title="Arquivos" subtitle="Itens arquivados e todas as suas fotos">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'arquivados', label: 'Arquivados', count: archived.length },
            { value: 'fotos', label: 'Fotos', count: photos.length },
          ]}
        />

        {tab === 'arquivados' ? (
          <>
            {archived.length === 0 ? (
              <Empty icon={Archive} title="Nada arquivado" hint="Projetos, notas, hábitos, metas e matérias arquivados ficam guardados aqui, fora do caminho." />
            ) : (
              <List>
                {archived.map((a) => (
                  <Row
                    key={a.key}
                    leading={<IconTile icon={a.icon} color={a.color} />}
                    title={a.title}
                    subtitle={a.kind}
                    trailing={
                      <View style={{ flexDirection: 'row', gap: space.lg }}>
                        <Pressable accessibilityLabel="Restaurar" hitSlop={8} onPress={a.restore}>
                          <ArchiveRestore size={18} color={c.accent} />
                        </Pressable>
                        <Pressable accessibilityLabel="Excluir" hitSlop={8} onPress={() => confirmDelete(`Excluir ${a.kind.toLowerCase()}?`, a.title, a.del)}>
                          <Trash size={18} color={c.textFaint} />
                        </Pressable>
                      </View>
                    }
                  />
                ))}
              </List>
            )}

            <Section title="Tarefas concluídas antigas">
              <List>
                <Row leading={<IconTile icon={CheckCheck} color={c.success} />} title={`${oldDone.length} tarefas`} subtitle="Concluídas há mais de 7 dias" />
              </List>
              {oldDone.length > 0 && (
                <Button
                  label="Limpar concluídas antigas"
                  icon={Trash}
                  variant="secondary"
                  onPress={() =>
                    confirmDelete('Limpar tarefas?', `${oldDone.length} tarefas concluídas serão apagadas. As estatísticas de Analytics desses dias também somem.`, () =>
                      oldDone.forEach((t) => useTasks.getState().remove(t.id)),
                    )
                  }
                />
              )}
            </Section>
            <T v="caption" tone="faint" align="center" onPress={() => router.push('/habitos')}>
              Dica: segure um hábito ou use o menu de uma nota/meta para arquivar.
            </T>
          </>
        ) : photos.length === 0 ? (
          <Empty icon={Images} title="Nenhuma foto" hint="Fotos de notas, comprovantes, capas e perfil aparecem aqui." />
        ) : (
          <View style={styles.grid}>
            {photos.map((p) => (
              <Pressable key={p.name} onPress={() => setViewing(p.name)} style={styles.cell}>
                <Image source={{ uri: mediaUri(p.name) }} style={[styles.img, { backgroundColor: c.surface2 }]} contentFit="cover" transition={120} />
                <T v="caption" tone="dim" numberOfLines={1} style={{ fontSize: 11 }}>
                  {p.from}
                  {p.at ? ` · ${friendlyDate(p.at).toLowerCase()}` : ''}
                </T>
              </Pressable>
            ))}
          </View>
        )}
      </Screen>
      <ImageViewer name={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: { width: '31.8%', gap: 4 },
  img: { width: '100%', aspectRatio: 1, borderRadius: 12 },
});
