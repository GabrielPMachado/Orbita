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
import type { MensalidadeAviso } from './estacioApi';
import { useBoletos } from '@/store/boletos';
import { useExams, useSubjects } from '@/store/modules';
import { useTasks } from '@/store/tasks';

const PALETTE = ['#8B5CF6', '#06B6D4', '#F59E0B', '#22C55E', '#EC4899', '#3B82F6', '#F97316', '#EF4444'];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const br = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

export type Resultado = {
  disciplinas: Disciplina[];
  boletos: BoletoInfo[];
  eventos: Evento[];
  mensalidades?: MensalidadeAviso[];
  renovacao?: boolean;
  arquivos?: { texto: string; arquivo?: string }[];
};

function subjectFor(nome: string | undefined, now: number, codigo?: string) {
  const subs = useSubjects.getState();
  if (codigo) {
    const byCode = subs.items.find((s) => s.code === codigo);
    if (byCode) return byCode.id;
  }
  if (!nome) {
    const geral = subs.items.find((s) => s.source === 'estacio' && s.name === 'Estácio');
    if (geral) return geral.id;
    return subs.add({ name: 'Estácio', color: PALETTE[0], source: 'estacio', syncedAt: now });
  }
  // nome igual, ou um contém o outro ("Computação em Nuvem" × "Computacao em Nuvem I")
  const n = norm(nome);
  const ex = subs.items.find((s) => norm(s.name) === n) ?? subs.items.find((s) => norm(s.name).includes(n) || n.includes(norm(s.name)));
  if (ex) {
    if (codigo && !ex.code) subs.update(ex.id, { code: codigo });
    return ex.id;
  }
  return subs.add({ name: nome, code: codigo, color: PALETTE[subs.items.length % PALETTE.length], source: 'estacio', syncedAt: now });
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
  const parcial = (nome?: string) => {
    if (!nome) return undefined;
    const d = r.disciplinas.find((x) => norm(x.nome) === norm(nome));
    const n = d?.notas ?? {};
    return n.Parcial ?? (n.AV !== undefined ? (n.AV ?? 0) + (n.Progresso ?? 0) + (n.Sim1 ?? 0) + (n.Sim2 ?? 0) : undefined);
  };
  for (let e of r.eventos) {
    if (/^Período da/i.test(e.titulo)) continue; // só informativo
    if (e.opcional) {
      const p = parcial(e.disciplina);
      if (p !== undefined && p >= 6) continue; // já passou: AVS não precisa
    }
    if (e.tipo === 'prova' || e.tipo === 'entrega') {
      const subjectId = subjectFor(e.disciplina, now, e.codigo);
      const exams = useExams.getState();
      const titulo = e.titulo.length > 60 ? e.titulo.slice(0, 60) : e.titulo;
      // nota da prova (AV/AVS) vinda de "Minhas notas"
      const d = r.disciplinas.find((x) => (e.codigo && x.codigo === e.codigo) || (e.disciplina && norm(x.nome) === norm(e.disciplina)));
      const sigla = /Prova (AVS|AV)\b/.exec(titulo)?.[1];
      const grade = e.nota ?? (sigla ? d?.notas[sigla] : undefined);
      // a mesma prova (já marcada, ou o aviso de agendamento dela) é atualizada, não duplicada
      const dup =
        exams.items.find((x) => x.subjectId === subjectId && x.date === e.data && norm(x.title) === norm(titulo)) ??
        (sigla
          ? exams.items.find((x) => x.subjectId === subjectId && new RegExp(`^Prova ${sigla}\\b`).test(x.title) && x.title.includes('agendar'))
          : undefined);
      if (dup) {
        exams.update(dup.id, { title: titulo, date: e.data, grade: grade ?? dup.grade, weight: sigla ? 8 : dup.weight });
        continue;
      }
      exams.add({ subjectId, title: titulo, kind: e.tipo === 'prova' ? 'prova' : 'entrega', date: e.data, grade, weight: sigla ? 8 : undefined });
      avaliacoes++;
    } else {
      // janela de agendamento de prova: aparece também na matéria, no último dia para agendar
      const sigla = /(AVS|AV)\b/.exec(e.titulo)?.[1];
      if (e.tipo === 'agendamento' && sigla && (e.disciplina || e.codigo) && (e.ate ?? e.data) >= new Date().toISOString().slice(0, 10)) {
        const subjectId = subjectFor(e.disciplina, now, e.codigo);
        const exams = useExams.getState();
        const tituloProva = `Prova ${sigla} · agendar até ${br(e.ate ?? e.data)}${e.opcional ? ' (substitutiva)' : ''}`;
        const ja = exams.items.find((x) => x.subjectId === subjectId && new RegExp(`^Prova ${sigla}\\b`).test(x.title));
        if (!ja) {
          exams.add({ subjectId, title: tituloProva, kind: 'prova', date: e.ate ?? e.data, weight: 8 });
          avaliacoes++;
        } else if (ja.title.includes('agendar')) exams.update(ja.id, { title: tituloProva, date: e.ate ?? e.data });
      }
      // agendamento/prazo vira tarefa com prazo no último dia da janela
      const fim = e.ate ?? e.data;
      if (fim < new Date().toISOString().slice(0, 10)) continue;
      const p = e.opcional ? parcial(e.disciplina) : undefined;
      // usa o nome da matéria como está no Órbita (com acento, do jeito que você escreveu)
      if (e.disciplina || e.codigo) {
        const sid = subjectFor(e.disciplina, now, e.codigo);
        e = { ...e, disciplina: useSubjects.getState().items.find((x) => x.id === sid)?.name ?? e.disciplina };
      }
      const titulo =
        e.tipo === 'agendamento'
          ? `Agendar ${e.titulo.replace(/^agendamento( d[aeo])?\s*/i, '') || 'prova'}${e.opcional ? (p !== undefined ? ` (nota ${p.toFixed(1).replace('.', ',')}/6)` : ' (se precisar)') : ''}${e.disciplina ? ` · ${e.disciplina}` : ''}${e.ate ? ` · até ${br(e.ate)}` : ''}`
          : `${e.titulo}${e.disciplina ? ` · ${e.disciplina}` : ''}`;
      const tasks = useTasks.getState();
      // mesma tarefa de antes (mesmo prazo e mesma prova) não repete, mesmo que a nota mude no título
      const chave = norm(titulo.replace(/\s*\(nota [^)]*\)/, ''));
      if (tasks.tasks.some((t) => t.source === 'estacio' && norm(t.title.replace(/\s*\(nota [^)]*\)/, '')) === chave)) continue;
      tasks.add({ title: titulo, due: fim, tags: ['faculdade'], priority: e.opcional ? 'media' : 'alta', source: 'estacio' });
      prazos++;
    }
  }

  // renovação de matrícula pendente
  if (r.renovacao) {
    const tasks = useTasks.getState();
    const titulo = 'Fazer a renovação de matrícula na Estácio';
    if (!tasks.tasks.some((t) => t.source === 'estacio' && t.title === titulo && t.status !== 'done')) {
      tasks.add({ title: titulo, tags: ['faculdade'], priority: 'alta', source: 'estacio' });
      prazos++;
    }
  }

  // boletos
  const bol = useBoletos.getState();
  let nb = 0;
  // mensalidade avisada no mural (sem código: o boleto em si sai no app/portal financeiro)
  for (const m of r.mensalidades ?? []) {
    const descricao = `Mensalidade Estácio${m.mes ? ` (${m.mes})` : ''}`;
    if (bol.items.some((x) => x.origem === 'estacio' && x.vencimento === m.vencimento)) continue;
    const data = { descricao, vencimento: m.vencimento, origem: 'estacio' as const };
    const id = bol.add(data);
    agendarAvisos(data)
      .then((avisos) => useBoletos.getState().update(id, { avisos }))
      .catch(() => {});
    nb++;
  }
  for (const b of r.boletos) {
    if (bol.items.some((x) => (b.barras && x.barras === b.barras) || (b.pix && x.pix === b.pix))) continue;
    // já havia o aviso da mensalidade (sem código) para esse vencimento: completa ele
    const aviso = bol.items.find((x) => x.origem === 'estacio' && !x.linha && !x.pix && b.vencimento && x.vencimento === b.vencimento);
    if (aviso) {
      bol.update(aviso.id, {
        valor: b.valor ?? aviso.valor,
        linha: b.linha,
        barras: b.barras,
        pix: b.pix,
        banco: b.banco,
        beneficiario: b.beneficiario,
      });
      nb++;
      continue;
    }
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
