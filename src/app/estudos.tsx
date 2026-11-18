import { router } from 'expo-router';
import { BookOpen, CalendarClock, GraduationCap, Plus, Timer, Trash } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { ColorPicker, PALETTE, Stat, Stepper, confirmDelete } from '@/components/extra';
import { Badge, Button, Card, Chip, Empty, Field, GlassButton, IconTile, List, Row, Screen, Section, Segmented, Sheet, T } from '@/components/ui';
import { friendlyDate, fromKey, lastNDays, today } from '@/lib/date';
import { parseInput } from '@/lib/parse';
import { useExams, useFocusSessions, useSubjects, type Exam, type Subject } from '@/store/modules';
import { space, useColors } from '@/theme';

const KIND = { prova: 'Prova', trabalho: 'Trabalho', entrega: 'Entrega' } as const;
const daysUntil = (k: string) => Math.round((fromKey(k).getTime() - fromKey(today()).getTime()) / 86_400_000);
const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);

export default function Estudos() {
  const lastSync = useSubjects((st) => st.items.reduce((a, x) => Math.max(a, x.syncedAt ?? 0), 0));
  const c = useColors();
  const subjects = useSubjects((s) => s.items);
  const exams = useExams((s) => s.items);
  const sessions = useFocusSessions((s) => s.items);
  const [subjectSheet, setSubjectSheet] = useState<Subject | 'new' | null>(null);
  const [examSheet, setExamSheet] = useState<Exam | 'new' | null>(null);
  const [logOpen, setLogOpen] = useState(false);

  const week = lastNDays(7);
  const active = subjects.filter((s) => !s.archived);
  const weekMin = sessions.filter((s) => week.includes(s.date) && s.subjectId).reduce((a, s) => a + s.minutes, 0);
  const upcoming = exams.filter((e) => e.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
  const past = exams.filter((e) => e.date < today()).sort((a, b) => b.date.localeCompare(a.date));
  const next = upcoming[0];

  const avg = (id: string) => {
    const g = exams.filter((e) => e.subjectId === id && e.grade != null);
    if (!g.length) return undefined;
    const w = g.reduce((a, e) => a + (e.weight ?? 1), 0);
    return g.reduce((a, e) => a + (e.grade ?? 0) * (e.weight ?? 1), 0) / w;
  };

  const examRow = (e: Exam) => {
    const s = subjects.find((x) => x.id === e.subjectId);
    const d = daysUntil(e.date);
    return (
      <Row
        key={e.id}
        leading={<IconTile icon={e.kind === 'prova' ? GraduationCap : BookOpen} color={s?.color} />}
        title={e.title || KIND[e.kind]}
        subtitle={`${s?.name ?? 'Sem matéria'} · ${KIND[e.kind]} · ${friendlyDate(e.date)}`}
        onPress={() => setExamSheet(e)}
        trailing={
          e.grade != null ? (
            <T v="headline" tabular color={e.grade >= 6 ? c.success : c.danger}>
              {String(e.grade).replace('.', ',')}
            </T>
          ) : d >= 0 ? (
            <Badge label={d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : `${d} dias`} color={d <= 3 ? c.danger : d <= 7 ? c.warning : c.textDim} />
          ) : null
        }
      />
    );
  };

  return (
    <>
      <Screen back title="Estudos" subtitle="Matérias, provas e tempo de estudo" actions={<GlassButton icon={Plus} label="Avaliação" onPress={() => setExamSheet('new')} />}>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Estudo na semana" value={hm(weekMin)} hint="com o timer de foco" />
          <Stat
            label="Próxima avaliação"
            value={next ? (daysUntil(next.date) === 0 ? 'Hoje' : `${daysUntil(next.date)} dias`) : '—'}
            hint={next ? subjects.find((s) => s.id === next.subjectId)?.name : 'nada marcado'}
            color={next && daysUntil(next.date) <= 3 ? c.danger : undefined}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Estudar agora" icon={Timer} onPress={() => router.push('/produtividade')} style={{ flex: 1 }} />
          <Button label="Registrar" icon={Plus} variant="secondary" onPress={() => setLogOpen(true)} style={{ flex: 1 }} />
        </View>

        <Section title="Próximas avaliações">
          {upcoming.length ? (
            <List>{upcoming.map(examRow)}</List>
          ) : (
            <Card onPress={() => setExamSheet('new')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <IconTile icon={CalendarClock} color={c.textDim} />
              <T v="callout" tone="dim" style={{ flex: 1 }}>
                Marque provas e entregas: elas aparecem aqui com contagem regressiva.
              </T>
            </Card>
          )}
        </Section>

        <Card onPress={() => router.push('/estacio')} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconTile icon={GraduationCap} color={c.accent} />
          <View style={{ flex: 1 }}>
            <T v="headline">Estácio</T>
            <T v="caption" tone="dim">
              {lastSync ? `Atualizado ${friendlySync(lastSync)} · toque para atualizar` : 'Puxar disciplinas, notas e boletos do portal'}
            </T>
          </View>
        </Card>

        <Section title="Matérias" action="Nova" onAction={() => setSubjectSheet('new')}>
          {active.length === 0 ? (
            <Empty icon={GraduationCap} title="Nenhuma matéria" hint="Cadastre as disciplinas do semestre." action="Adicionar matéria" onAction={() => setSubjectSheet('new')} />
          ) : (
            <List>
              {active.map((s) => {
                const m = sessions.filter((x) => x.subjectId === s.id && week.includes(x.date)).reduce((a, x) => a + x.minutes, 0);
                const a = avg(s.id);
                return (
                  <Row
                    key={s.id}
                    leading={<IconTile icon={BookOpen} color={s.color} />}
                    title={s.name}
                    subtitle={[
                      s.grades && Object.keys(s.grades).length
                        ? Object.entries(s.grades)
                            .map(([k, v]) => `${k} ${v.toFixed(1).replace('.', ',')}`)
                            .join(' ')
                        : null,
                      s.absences != null ? `${s.absences} falta${s.absences === 1 ? '' : 's'}` : null,
                      s.professor,
                      m ? `${hm(m)} na semana` : null,
                    ]
                      .filter(Boolean)
                      .join('  ·  ') || 'sem estudo na semana'}
                    onPress={() => setSubjectSheet(s)}
                    trailing={
                      a != null ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <T v="caption" tone="faint">
                            média
                          </T>
                          <T v="headline" tabular color={a >= 6 ? c.success : c.danger}>
                            {a.toFixed(1).replace('.', ',')}
                          </T>
                        </View>
                      ) : null
                    }
                  />
                );
              })}
            </List>
          )}
        </Section>

        {past.length > 0 && (
          <Section title="Avaliações passadas">
            <List>{past.slice(0, 10).map(examRow)}</List>
          </Section>
        )}
      </Screen>

      <SubjectSheet editing={subjectSheet} onClose={() => setSubjectSheet(null)} />
      <ExamSheet editing={examSheet} onClose={() => setExamSheet(null)} />
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}

function SubjectSheet({ editing, onClose }: { editing: Subject | 'new' | null; onClose: () => void }) {
  const { items, add, update, remove } = useSubjects();
  const [name, setName] = useState('');
  const [professor, setProfessor] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [key, setKey] = useState<string | null>(null);
  const k = editing === 'new' ? 'new' : editing?.id ?? null;
  if (k !== key) {
    setKey(k);
    const e = editing && editing !== 'new' ? editing : undefined;
    setName(e?.name ?? '');
    setProfessor(e?.professor ?? '');
    setColor(e?.color ?? PALETTE[items.length % PALETTE.length]);
  }
  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing === 'new' ? 'Nova matéria' : 'Matéria'}>
      <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Estrutura de Dados" autoFocus={editing === 'new'} />
      <Field label="Professor(a)" value={professor} onChangeText={setProfessor} placeholder="Opcional" />
      <ColorPicker value={color} onChange={setColor} />
      <Button
        label="Salvar"
        disabled={!name.trim()}
        onPress={() => {
          const data = { name: name.trim(), professor: professor.trim() || undefined, color };
          if (editing === 'new') add(data);
          else if (editing) update(editing.id, data);
          onClose();
        }}
      />
      {editing && editing !== 'new' && (
        <>
          <Button
            label="Arquivar (fim do semestre)"
            variant="secondary"
            onPress={() => {
              update(editing.id, { archived: true });
              onClose();
            }}
          />
          <Button
            label="Excluir"
            icon={Trash}
            variant="danger"
            onPress={() =>
              confirmDelete('Excluir matéria?', editing.name, () => {
                remove(editing.id);
                onClose();
              })
            }
          />
        </>
      )}
    </Sheet>
  );
}

function ExamSheet({ editing, onClose }: { editing: Exam | 'new' | null; onClose: () => void }) {
  const subjects = useSubjects((s) => s.items).filter((s) => !s.archived);
  const { add, update, remove } = useExams.getState();
  const [subjectId, setSubjectId] = useState<string>('');
  const [kind, setKind] = useState<Exam['kind']>('prova');
  const [title, setTitle] = useState('');
  const [dateText, setDateText] = useState('');
  const [date, setDate] = useState(today());
  const [grade, setGrade] = useState('');
  const [weight, setWeight] = useState(1);
  const [key, setKey] = useState<string | null>(null);
  const k = editing === 'new' ? 'new' : editing?.id ?? null;
  if (k !== key) {
    setKey(k);
    const e = editing && editing !== 'new' ? editing : undefined;
    setSubjectId(e?.subjectId ?? subjects[0]?.id ?? '');
    setKind(e?.kind ?? 'prova');
    setTitle(e?.title ?? '');
    setDate(e?.date ?? today());
    setDateText('');
    setGrade(e?.grade != null ? String(e.grade).replace('.', ',') : '');
    setWeight(e?.weight ?? 1);
  }
  const g = grade.trim() ? Number(grade.replace(',', '.')) : undefined;

  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing === 'new' ? 'Nova avaliação' : 'Avaliação'}>
      {subjects.length === 0 ? (
        <T v="callout" tone="dim">
          Cadastre uma matéria primeiro.
        </T>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {subjects.map((s) => (
            <Chip key={s.id} label={s.name} color={s.color} active={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
          ))}
        </View>
      )}
      <Segmented<Exam['kind']>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'prova', label: 'Prova' },
          { value: 'trabalho', label: 'Trabalho' },
          { value: 'entrega', label: 'Entrega' },
        ]}
      />
      <Field label="Título" value={title} onChangeText={setTitle} placeholder="Ex.: AV1, Lista 3…" />
      <Field
        label={`Data · ${friendlyDate(date)}`}
        value={dateText}
        onChangeText={(t) => {
          setDateText(t);
          const d = parseInput('x ' + t).due;
          if (d) setDate(d);
        }}
        placeholder="05/12, sexta, em 2 semanas…"
      />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Field label="Nota" value={grade} onChangeText={setGrade} placeholder="—" keyboardType="decimal-pad" style={{ flex: 1 }} />
      </View>
      <Card>
        <Stepper label="Peso na média" value={weight} min={0.5} max={10} step={0.5} onChange={setWeight} format={(v) => String(v).replace('.', ',')} />
      </Card>
      <Button
        label="Salvar"
        disabled={!subjectId}
        onPress={() => {
          const data = { subjectId, kind, title: title.trim(), date, grade: g != null && !isNaN(g) ? g : undefined, weight };
          if (editing === 'new') add(data);
          else if (editing) update(editing.id, data);
          onClose();
        }}
      />
      {editing && editing !== 'new' && (
        <Button
          label="Excluir"
          icon={Trash}
          variant="danger"
          onPress={() => {
            remove(editing.id);
            onClose();
          }}
        />
      )}
    </Sheet>
  );
}

function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const subjects = useSubjects((s) => s.items).filter((s) => !s.archived);
  const add = useFocusSessions((s) => s.add);
  const [subjectId, setSubjectId] = useState<string | undefined>();
  const [minutes, setMinutes] = useState(30);
  return (
    <Sheet visible={open} onClose={onClose} title="Registrar estudo">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {subjects.map((s) => (
          <Chip key={s.id} label={s.name} color={s.color} active={subjectId === s.id} onPress={() => setSubjectId(s.id)} />
        ))}
      </View>
      <Card>
        <Stepper label="Tempo" value={minutes} min={5} max={600} step={5} onChange={setMinutes} format={hm} />
      </Card>
      <Button
        label="Salvar"
        disabled={!subjectId}
        onPress={() => {
          add({ subjectId, date: today(), minutes, label: 'Manual' });
          onClose();
        }}
      />
    </Sheet>
  );
}

function friendlySync(t: number) {
  const d = Math.floor((Date.now() - t) / 864e5);
  return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
}
