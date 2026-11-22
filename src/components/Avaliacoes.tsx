/**
 * Avaliações em Estudos: separadas por situação (a fazer · agendadas · feitas) ou por matéria,
 * com filtro por tipo (provas, simulados, trabalhos). Cada avaliação é um cartão com o tipo em
 * destaque, a matéria, o prazo (e quanto da janela já passou) ou a nota.
 */
import { CalendarClock, CheckCircle2, Clock, MapPin, Monitor, XCircle } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Badge, Card, Chip, Segmented, T } from '@/components/ui';
import { fromKey, today } from '@/lib/date';
import type { Exam, Subject } from '@/store/modules';
import { radius, space, useColors, type Colors } from '@/theme';

export type Situacao = 'fazer' | 'agendada' | 'feita' | 'perdida';
export type Tipo = 'prova' | 'simulado' | 'trabalho';

const dias = (k: string) => Math.round((fromKey(k).getTime() - fromKey(today()).getTime()) / 86_400_000);
const br = (k?: string) => (k ? `${k.slice(8, 10)}/${k.slice(5, 7)}` : '');
const num = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

export function tipoDe(e: Exam): Tipo {
  const code = e.estacio?.code ?? '';
  if (/^SM/.test(code) || /simulad/i.test(e.title)) return 'simulado';
  if (e.kind === 'trabalho' || e.kind === 'entrega') return 'trabalho';
  return 'prova';
}

export function situacaoDe(e: Exam): Situacao {
  const s = e.estacio?.status;
  if (s === 'feita') return 'feita';
  if (s === 'agendada') return 'agendada';
  if (s === 'fechada') return 'perdida';
  if (s === 'pendente') return 'fazer';
  // avaliação manual: com nota ou com a data no passado já foi; senão está marcada
  if (e.grade != null || e.date < today()) return 'feita';
  return 'agendada';
}

/** Rótulo curto do tipo: "AV", "AVS", "Simulado 1", "Trabalho" */
function rotulo(e: Exam) {
  const code = e.estacio?.code;
  if (code === 'SM1' || code === 'SM2') return `Simulado ${code.slice(2)}`;
  if (code) return code;
  return { prova: 'Prova', simulado: 'Simulado', trabalho: e.kind === 'entrega' ? 'Entrega' : 'Trabalho' }[tipoDe(e)];
}

function corTipo(t: Tipo, c: Colors) {
  return t === 'simulado' ? c.info : t === 'trabalho' ? c.warning : c.accent;
}

/** Prazo da avaliação: até quando agendar/fazer, ou a data marcada. */
const prazo = (e: Exam) => e.estacio?.ate ?? e.date;

function Contagem({ k, c }: { k: string; c: Colors }) {
  const d = dias(k);
  if (d < 0) return <Badge label="Vencida" color={c.danger} />;
  return <Badge label={d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : `${d} dias`} color={d <= 3 ? c.danger : d <= 7 ? c.warning : c.textDim} />;
}

/** Barra fina: quanto da janela para agendar/fazer já passou, ou a nota sobre o máximo. */
function Barra({ valor, cor }: { valor: number; cor: string }) {
  const c = useColors();
  return (
    <View style={{ height: 4, borderRadius: 2, backgroundColor: c.surface3, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(4, Math.min(100, valor * 100))}%`, height: 4, borderRadius: 2, backgroundColor: cor }} />
    </View>
  );
}

function ExamCard({ e, subject, onPress }: { e: Exam; subject?: Subject; onPress: () => void }) {
  const c = useColors();
  const sit = situacaoDe(e);
  const tipo = tipoDe(e);
  const x = e.estacio;
  const max = x?.max ?? 10;
  const titulo = e.title && !/^(Prova )?(AVS?|SM\d)$/i.test(e.title.trim()) && e.title !== rotulo(e) ? e.title : undefined;

  let linha: string;
  let progresso: { valor: number; cor: string } | undefined;
  if (sit === 'feita') {
    linha = e.grade != null ? `Feita ${br(e.date)}` : `Feita ${br(e.date)} · sem nota ainda`;
    if (e.grade != null) progresso = { valor: e.grade / max, cor: e.grade / max >= 0.6 ? c.success : c.danger };
  } else if (sit === 'agendada') {
    linha = `${dias(e.date) === 0 ? 'Hoje' : `${br(e.date)}`}${x?.hora ? ` às ${x.hora}` : ''}`;
  } else if (sit === 'perdida') {
    linha = `Prazo encerrado em ${br(prazo(e))}`;
  } else {
    linha = `${x?.modo === 'polo' ? 'Agendar' : 'Fazer'} até ${br(prazo(e))}`;
    if (x?.de && x?.ate) {
      const total = Math.max(1, dias(x.ate) - dias(x.de));
      const passou = Math.min(total, Math.max(0, -dias(x.de)));
      const d = dias(x.ate);
      progresso = { valor: passou / total, cor: d <= 3 ? c.danger : d <= 7 ? c.warning : c.accent };
    }
  }
  const local = x?.local?.split(' · ')[0];

  return (
    <Card onPress={onPress} padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: subject?.color ?? c.textFaint }} />
        <View style={{ flex: 1, padding: space.md, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Badge label={rotulo(e)} color={corTipo(tipo, c)} />
            <T v="caption" tone="dim" numberOfLines={1} style={{ flex: 1 }}>
              {subject?.name ?? 'Sem matéria'}
            </T>
            {sit === 'feita' && e.grade != null ? (
              <T v="headline" tabular color={e.grade / max >= 0.6 ? c.success : c.danger}>
                {num(e.grade)}
                <T v="caption" tone="dim">{`/${num(max)}`}</T>
              </T>
            ) : sit === 'fazer' || sit === 'agendada' ? (
              <Contagem k={sit === 'agendada' ? e.date : prazo(e)} c={c} />
            ) : sit === 'perdida' ? (
              <XCircle size={18} color={c.textFaint} />
            ) : (
              <CheckCircle2 size={18} color={c.success} />
            )}
          </View>
          {titulo ? (
            <T v="callout" numberOfLines={2}>
              {titulo}
            </T>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {sit === 'agendada' ? <CalendarClock size={13} color={c.textDim} /> : sit === 'fazer' ? <Clock size={13} color={c.textDim} /> : null}
            <T v="caption" tone={sit === 'perdida' ? 'faint' : 'dim'}>
              {linha}
            </T>
            {local ? (
              <>
                {x?.modo === 'online' ? <Monitor size={13} color={c.textFaint} /> : <MapPin size={13} color={c.textFaint} />}
                <T v="caption" tone="faint" numberOfLines={1} style={{ flexShrink: 1 }}>
                  {local}
                </T>
              </>
            ) : null}
          </View>
          {progresso ? <Barra valor={progresso.valor} cor={progresso.cor} /> : null}
        </View>
      </View>
    </Card>
  );
}

/** Uma matéria e todas as avaliações dela, em pílulas: "AV 7,5", "AVS até 03/12", "Simulado 1 ✓". */
function MateriaCard({ s, exams, onOpen }: { s: Subject; exams: Exam[]; onOpen: (e: Exam) => void }) {
  const c = useColors();
  const ordem = (e: Exam) => ['AV', 'AVS', 'SM1', 'SM2'].indexOf(e.estacio?.code ?? '') + 1 || 9;
  const lista = [...exams].sort((a, b) => ordem(a) - ordem(b) || a.date.localeCompare(b.date));
  return (
    <Card style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
        <T v="headline" numberOfLines={1} style={{ flex: 1 }}>
          {s.name}
        </T>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {lista.map((e) => {
          const sit = situacaoDe(e);
          const max = e.estacio?.max ?? 10;
          const cor =
            sit === 'feita'
              ? e.grade != null
                ? e.grade / max >= 0.6
                  ? c.success
                  : c.danger
                : c.success
              : sit === 'perdida'
                ? c.textFaint
                : dias(sit === 'agendada' ? e.date : prazo(e)) <= 7
                  ? c.warning
                  : corTipo(tipoDe(e), c);
          const info =
            sit === 'feita'
              ? e.grade != null
                ? num(e.grade)
                : '✓'
              : sit === 'agendada'
                ? br(e.date)
                : sit === 'perdida'
                  ? 'perdida'
                  : `até ${br(prazo(e))}`;
          return (
            <Pressable
              key={e.id}
              onPress={() => onOpen(e)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: radius.pill,
                backgroundColor: cor + '1F',
                opacity: pressed ? 0.7 : 1,
              })}>
              <T v="caption" color={cor} style={{ fontWeight: '700' }} numberOfLines={1}>
                {e.estacio?.code || !e.title ? rotulo(e) : e.title.slice(0, 18)}
              </T>
              <T v="caption" color={cor}>
                {info}
              </T>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

type Vista = 'fazer' | 'agendada' | 'feita' | 'materia';

export function Avaliacoes({ exams, subjects, onOpen }: { exams: Exam[]; subjects: Subject[]; onOpen: (e: Exam) => void }) {
  const c = useColors();
  const [tipo, setTipo] = useState<Tipo | 'todos'>('todos');
  const filtradas = useMemo(() => (tipo === 'todos' ? exams : exams.filter((e) => tipoDe(e) === tipo)), [exams, tipo]);
  const grupos = useMemo(() => {
    const g: Record<Situacao, Exam[]> = { fazer: [], agendada: [], feita: [], perdida: [] };
    for (const e of filtradas) g[situacaoDe(e)].push(e);
    g.fazer.sort((a, b) => prazo(a).localeCompare(prazo(b)));
    g.agendada.sort((a, b) => a.date.localeCompare(b.date));
    g.feita.sort((a, b) => b.date.localeCompare(a.date));
    g.perdida.sort((a, b) => b.date.localeCompare(a.date));
    return g;
  }, [filtradas]);
  const [vista, setVista] = useState<Vista>(() => {
    const todas = exams.map(situacaoDe);
    return todas.includes('fazer') ? 'fazer' : todas.includes('agendada') ? 'agendada' : 'feita';
  });

  const tem = (t: Tipo) => exams.some((e) => tipoDe(e) === t);
  const sub = (id: string) => subjects.find((s) => s.id === id);
  const media = grupos.feita.filter((e) => e.grade != null);
  const mediaTxt = media.length ? num((media.reduce((a, e) => a + (e.grade ?? 0) / (e.estacio?.max ?? 10), 0) / media.length) * 10) : undefined;

  const vazio = (txt: string) => (
    <T v="callout" tone="dim" style={{ textAlign: 'center', paddingVertical: space.lg }}>
      {txt}
    </T>
  );

  let corpo: React.ReactNode;
  if (vista === 'materia') {
    const ids = [...new Set(filtradas.map((e) => e.subjectId))];
    const mats = ids
      .map((id) => sub(id))
      .filter((s): s is Subject => !!s)
      .sort((a, b) => a.name.localeCompare(b.name));
    corpo = mats.length
      ? mats.map((s) => <MateriaCard key={s.id} s={s} exams={filtradas.filter((e) => e.subjectId === s.id)} onOpen={onOpen} />)
      : vazio('Nenhuma avaliação com matéria.');
  } else if (vista === 'feita') {
    corpo = (
      <>
        {mediaTxt ? (
          <T v="caption" tone="dim">
            {media.length} com nota · média {mediaTxt} de 10
          </T>
        ) : null}
        {grupos.feita.length
          ? grupos.feita.map((e) => <ExamCard key={e.id} e={e} subject={sub(e.subjectId)} onPress={() => onOpen(e)} />)
          : vazio('Nenhuma feita ainda.')}
        {grupos.perdida.length ? (
          <>
            <T v="caption" tone="faint" style={{ marginTop: space.sm }}>
              Prazo encerrado sem fazer
            </T>
            {grupos.perdida.map((e) => (
              <ExamCard key={e.id} e={e} subject={sub(e.subjectId)} onPress={() => onOpen(e)} />
            ))}
          </>
        ) : null}
      </>
    );
  } else {
    const lista = grupos[vista];
    corpo = lista.length
      ? lista.map((e) => <ExamCard key={e.id} e={e} subject={sub(e.subjectId)} onPress={() => onOpen(e)} />)
      : vazio(vista === 'fazer' ? 'Nada para agendar ou fazer agora.' : 'Nenhuma avaliação marcada.');
  }

  return (
    <View style={{ gap: space.sm }}>
      <Segmented<Vista>
        options={[
          { value: 'fazer', label: 'A fazer', count: grupos.fazer.length },
          { value: 'agendada', label: 'Marcadas', count: grupos.agendada.length },
          { value: 'feita', label: 'Feitas', count: grupos.feita.length },
          { value: 'materia', label: 'Matérias' },
        ]}
        value={vista}
        onChange={setVista}
      />
      {tem('simulado') || tem('trabalho') ? (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Chip label="Todas" active={tipo === 'todos'} onPress={() => setTipo('todos')} />
          <Chip label="Provas" active={tipo === 'prova'} onPress={() => setTipo('prova')} color={c.accent} />
          {tem('simulado') ? <Chip label="Simulados" active={tipo === 'simulado'} onPress={() => setTipo('simulado')} color={c.info} /> : null}
          {tem('trabalho') ? <Chip label="Trabalhos" active={tipo === 'trabalho'} onPress={() => setTipo('trabalho')} color={c.warning} /> : null}
        </View>
      ) : null}
      {corpo}
    </View>
  );
}
