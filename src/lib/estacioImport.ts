/**
 * Leva o que veio da Estácio para dentro do Órbita, sem duplicar:
 *  - disciplinas → Estudos (com notas, faltas, professor, horário);
 *  - provas e entregas → avaliações em Estudos;
 *  - janelas de agendamento e prazos → tarefas (prioridade alta, vencendo no último dia);
 *  - boletos → Boletos, com aviso na véspera.
 */
import { agendarAvisos } from './boletoImport';
import type { BoletoInfo } from './boleto';
import type { Disciplina, Evento } from './estacio';
import { useBoletos } from '@/store/boletos';
import { useExams, useSubjects } from '@/store/modules';
import { useTasks } from '@/store/tasks';

const PALETTE = ['#8B5CF6', '#06B6D4', '#F59E0B', '#22C55E', '#EC4899', '#3B82F6', '#F97316', '#EF4444'];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const br = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

export type Resultado = { disciplinas: Disciplina[]; boletos: BoletoInfo[]; eventos: Evento[]; arquivos?: { texto: string; arquivo?: string }[] };

function subjectFor(nome: string | undefined, now: number) {
  const subs = useSubjects.getState();
  if (!nome) {
    const geral = subs.items.find((s) => s.source === 'estacio' && s.name === 'Estácio');
    if (geral) return geral.id;
    return subs.add({ name: 'Estácio', color: PALETTE[0], source: 'estacio', syncedAt: now });
  }
  const ex = subs.items.find((s) => norm(s.name) === norm(nome));
  if (ex) return ex.id;
  return subs.add({ name: nome, color: PALETTE[subs.items.length % PALETTE.length], source: 'estacio', syncedAt: now });
}

export function importarEstacio(r: Resultado) {
  const now = Date.now();
  const subs = useSubjects.getState();
  let novas = 0;
  let atualizadas = 0;
  r.disciplinas.forEach((d, i) => {
    const ex = subs.items.find((s) => norm(s.name) === norm(d.nome) || (d.codigo && s.code === d.codigo));
    const patch = {
      code: d.codigo ?? ex?.code,
      professor: d.professor ?? ex?.professor,
      grades: Object.keys(d.notas).length ? d.notas : ex?.grades,
      absences: d.faltas ?? ex?.absences,
      schedule: d.horario ?? ex?.schedule,
      source: 'estacio' as const,
      syncedAt: now,
    };
    if (ex) {
      subs.update(ex.id, patch);
      atualizadas++;
    } else {
      subs.add({ name: d.nome, color: PALETTE[(subs.items.length + i) % PALETTE.length], ...patch });
      novas++;
    }
  });

  // provas e entregas
  let avaliacoes = 0;
  let prazos = 0;
  for (const e of r.eventos) {
    if (e.tipo === 'prova' || e.tipo === 'entrega') {
      const subjectId = subjectFor(e.disciplina, now);
      const exams = useExams.getState();
      const titulo = e.titulo.length > 60 ? e.titulo.slice(0, 60) : e.titulo;
      const dup = exams.items.find((x) => x.subjectId === subjectId && x.date === e.data && norm(x.title) === norm(titulo));
      if (dup) continue;
      exams.add({ subjectId, title: titulo, kind: e.tipo === 'prova' ? 'prova' : 'entrega', date: e.data });
      avaliacoes++;
    } else {
      // agendamento/prazo vira tarefa com prazo no último dia da janela
      const fim = e.ate ?? e.data;
      if (fim < new Date().toISOString().slice(0, 10)) continue;
      const titulo =
        e.tipo === 'agendamento'
          ? `Agendar ${e.titulo.replace(/^agendamento( d[aeo])?\s*/i, '') || 'prova'}${e.disciplina ? ` · ${e.disciplina}` : ''}${e.ate ? ` (${br(e.data)}–${br(e.ate)})` : ''}`
          : `${e.titulo}${e.disciplina ? ` · ${e.disciplina}` : ''}`;
      const tasks = useTasks.getState();
      if (tasks.tasks.some((t) => t.source === 'estacio' && norm(t.title) === norm(titulo))) continue;
      tasks.add({ title: titulo, due: fim, tags: ['faculdade'], priority: 'alta', source: 'estacio' });
      prazos++;
    }
  }

  // boletos
  const bol = useBoletos.getState();
  let nb = 0;
  for (const b of r.boletos) {
    if (bol.items.some((x) => (b.barras && x.barras === b.barras) || (b.pix && x.pix === b.pix))) continue;
    const dig = b.linha?.replace(/\D/g, '') ?? '';
    const arquivo = r.arquivos?.find((p) => (dig && p.texto.replace(/\D/g, '').includes(dig)) || (b.barras && p.texto.includes(b.barras)))?.arquivo;
    const data = {
      descricao: 'Mensalidade Estácio',
      valor: b.valor,
      vencimento: b.vencimento,
      linha: b.linha,
      barras: b.barras,
      pix: b.pix,
      banco: b.banco,
      beneficiario: b.beneficiario,
      origem: 'estacio' as const,
      arquivo,
    };
    const id = bol.add(data);
    agendarAvisos(data)
      .then((avisos) => useBoletos.getState().update(id, { avisos }))
      .catch(() => {});
    nb++;
  }

  const partes = [
    novas ? `${novas} disciplina${novas > 1 ? 's' : ''} nova${novas > 1 ? 's' : ''}` : null,
    atualizadas ? `${atualizadas} atualizada${atualizadas > 1 ? 's' : ''}` : null,
    avaliacoes ? `${avaliacoes} avaliaç${avaliacoes > 1 ? 'ões' : 'ão'}` : null,
    prazos ? `${prazos} prazo${prazos > 1 ? 's' : ''}` : null,
    nb ? `${nb} boleto${nb > 1 ? 's' : ''}` : null,
  ].filter(Boolean);
  return partes.length ? `Estácio: ${partes.join(', ')}` : 'Estácio: nada novo';
}
