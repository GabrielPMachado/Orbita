import { router, useLocalSearchParams } from 'expo-router';
import { Check, Pencil, Play, Plus, Square, Trash } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Stepper, confirmDelete } from '@/components/extra';
import { Button, Card, Checkbox, Field, GlassButton, List, Row, Screen, Sheet, T, impact } from '@/components/ui';
import { today } from '@/lib/date';
import { uid } from '@/lib/storage';
import { usePlans, useSessions, type Exercise } from '@/store/modules';
import { space, useColors } from '@/theme';

const kg = (v: number) => (v ? `${String(v).replace('.', ',')} kg` : 'Peso corporal');

export default function Ficha() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const plan = usePlans((s) => s.items.find((p) => p.id === id));
  const { update, remove } = usePlans.getState();
  const addSession = useSessions((s) => s.add);
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [rename, setRename] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  if (!plan) return null;
  const setExercises = (exercises: Exercise[]) => update(plan.id, { exercises });
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const mmss = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  const finish = () => {
    const minutes = Math.max(1, Math.round(elapsed / 60));
    const volume = plan.exercises
      .filter((e) => done.includes(e.id))
      .reduce((a, e) => a + e.weight * e.sets * (parseInt(e.reps, 10) || 0), 0);
    addSession({ planId: plan.id, date: today(), minutes, done, volume });
    setStartedAt(null);
    setDone([]);
    Alert.alert('Treino salvo', `${minutes} min · ${done.length} de ${plan.exercises.length} exercícios`);
  };

  return (
    <>
      <Screen
        back
        title={plan.name}
        subtitle={plan.focus}
        actions={!startedAt && <GlassButton icon={Pencil} accessibilityLabel="Renomear ficha" onPress={() => setRename(true)} />}>
        {startedAt ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.xl }}>
            <View style={{ flex: 1 }}>
              <T v="caption" tone="dim">
                Treino em andamento
              </T>
              <T v="largeTitle" tabular>
                {mmss}
              </T>
              <T v="caption" tone="dim">
                {done.length} de {plan.exercises.length} exercícios
              </T>
            </View>
            <Button label="Finalizar" icon={Square} onPress={finish} />
          </Card>
        ) : (
          <Button
            label="Iniciar treino"
            icon={Play}
            onPress={() => {
              impact();
              setStartedAt(Date.now());
              setNow(Date.now());
            }}
            disabled={!plan.exercises.length}
          />
        )}

        <List>
          {plan.exercises.map((e) => (
            <Row
              key={e.id}
              leading={
                startedAt ? (
                  <Checkbox checked={done.includes(e.id)} onPress={() => setDone(done.includes(e.id) ? done.filter((x) => x !== e.id) : [...done, e.id])} />
                ) : undefined
              }
              title={e.name}
              subtitle={`${e.sets} × ${e.reps}  ·  ${kg(e.weight)}`}
              strike={!!startedAt && done.includes(e.id)}
              onPress={() => setEditing(e)}
              chevron={!startedAt}
            />
          ))}
          <Pressable onPress={() => setEditing('new')} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }, pressed && { opacity: 0.6 }]}>
            <Plus size={18} color={c.accent} />
            <T tone="accent">Adicionar exercício</T>
          </Pressable>
        </List>

        {!startedAt && (
          <Button
            label="Excluir ficha"
            icon={Trash}
            variant="danger"
            onPress={() =>
              confirmDelete('Excluir ficha?', plan.name, () => {
                remove(plan.id);
                router.back();
              })
            }
          />
        )}
      </Screen>

      <ExerciseSheet
        editing={editing}
        onClose={() => setEditing(null)}
        onSave={(ex) => {
          const exists = plan.exercises.some((x) => x.id === ex.id);
          setExercises(exists ? plan.exercises.map((x) => (x.id === ex.id ? ex : x)) : [...plan.exercises, ex]);
        }}
        onDelete={(exId) => setExercises(plan.exercises.filter((x) => x.id !== exId))}
      />

      <RenameSheet
        open={rename}
        name={plan.name}
        focus={plan.focus ?? ''}
        onClose={() => setRename(false)}
        onSave={(name, focus) => update(plan.id, { name, focus: focus || undefined })}
      />
    </>
  );
}

function ExerciseSheet({
  editing,
  onClose,
  onSave,
  onDelete,
}: {
  editing: Exercise | 'new' | null;
  onClose: () => void;
  onSave: (e: Exercise) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState('10-12');
  const [weight, setWeight] = useState(0);
  const [key, setKey] = useState<string | null>(null);

  const k = editing === 'new' ? 'new' : editing?.id ?? null;
  if (k !== key) {
    setKey(k);
    const e = editing && editing !== 'new' ? editing : undefined;
    setName(e?.name ?? '');
    setSets(e?.sets ?? 3);
    setReps(e?.reps ?? '10-12');
    setWeight(e?.weight ?? 0);
  }

  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing === 'new' ? 'Novo exercício' : 'Exercício'}>
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Supino reto" />
      <Card style={{ gap: space.md }}>
        <Stepper label="Séries" value={sets} min={1} max={10} onChange={setSets} />
        <Stepper label="Carga" value={weight} min={0} max={500} step={2.5} onChange={setWeight} format={(v) => (v ? `${String(v).replace('.', ',')} kg` : '—')} />
      </Card>
      <Field label="Repetições" value={reps} onChangeText={setReps} placeholder="10-12" />
      <Button
        label="Salvar"
        icon={Check}
        disabled={!name.trim()}
        onPress={() => {
          onSave({ id: editing && editing !== 'new' ? editing.id : uid(), name: name.trim(), sets, reps: reps.trim() || '10', weight });
          onClose();
        }}
      />
      {editing && editing !== 'new' && (
        <Button
          label="Remover da ficha"
          icon={Trash}
          variant="danger"
          onPress={() => {
            onDelete(editing.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function RenameSheet({ open, name, focus, onClose, onSave }: { open: boolean; name: string; focus: string; onClose: () => void; onSave: (n: string, f: string) => void }) {
  const [n, setN] = useState(name);
  const [f, setF] = useState(focus);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setN(name);
      setF(focus);
    }
  }
  return (
    <Sheet visible={open} onClose={onClose} title="Editar ficha">
      <Field label="Nome" value={n} onChangeText={setN} />
      <Field label="Foco" value={f} onChangeText={setF} placeholder="Ex.: Pernas" />
      <Button
        label="Salvar"
        disabled={!n.trim()}
        onPress={() => {
          onSave(n.trim(), f.trim());
          onClose();
        }}
      />
    </Sheet>
  );
}
