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
import type { AvalEstacio, MensalidadeAviso } from './estacioApi';
import type { Cobranca } from './estacioFinanceiro';
import { lerCodigo } from './boleto';
import { cancelarAvisos } from './boletoImport';
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
  avaliacoes?: AvalEstacio[];
  cobrancas?: Cobranca[];
  mensalidades?: MensalidadeAviso[];
  renovacao?: boolean;
  arquivos?: { texto: string; arquivo?: string }[];
};

/** Matéria da disciplina (pelo código ou pelo nome). Sem disciplina, não há onde salvar: undefined. */
function subjectFor(nome: string | undefined, now: number, codigo?: string): string | undefined {
  const subs = useSubjects.getState();
  if (codigo) {
    const byCode = subs.items.find((s) => s.code === codigo);
    if (byCode) return byCode.id;
  }
  if (!nome || /^[A-Z]{2,4}\d{3,5}$/.test(nome)) return undefined;
  // nome igual, ou um contém o outro ("Computação em Nuvem" × "Computacao em Nuvem I")
  const n = norm(nome);
  const ex =
    subs.items.find((s) => norm(s.name) === n) ??
    subs.items.find((s) => s.name !== 'Estácio' && (norm(s.name).includes(n) || n.includes(norm(s.name))));
  if (ex) {
    if (codigo && !ex.code) subs.update(ex.id, { code: codigo });
    return ex.id;
  }
  return subs.add({ name: nome, code: codigo, color: PALETTE[subs.items.length % PALETTE.length], source: 'estacio', syncedAt: now });
}

/**
 * Versões antigas juntavam provas sem disciplina numa matéria "Estácio". Cada prova agora vai
 * para a sua matéria; o que estava lá (e você não editou) sai, e a matéria some se ficar vazia.
 */
function limparMateriaGenerica() {
  const subs = useSubjects.getState();
  const geral = subs.items.find((s) => s.source === 'estacio' && s.name === 'Estácio');
  if (!geral) return;
  const exams = useExams.getState();
  for (const e of exams.items.filter((x) => x.subjectId === geral.id && !x.editedAt)) exams.remove(e.id);
  if (!useExams.getState().items.some((x) => x.subjectId === geral.id)) subs.remove(geral.id);
}

export function importarEstacio(r: Resultado) {
  const now = Date.now();
  limparMateriaGenerica();
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
  const temAvaliacoes = (r.avaliacoes ?? []).length > 0;
  for (let e of r.eventos) {
    if (/^Período da/i.test(e.titulo)) continue; // só informativo
    if (temAvaliacoes && /\b(AVS?|Simulado)\b/.test(e.titulo)) continue; // já tratada acima, em detalhe
    if (e.opcional) {
      const p = parcial(e.disciplina);
      if (p !== undefined && p >= 6) continue; // já passou: AVS não precisa
    }
    if (e.tipo === 'prova' || e.tipo === 'entrega') {
      const subjectId = subjectFor(e.disciplina, now, e.codigo);
      if (!subjectId) continue; // sem disciplina: não inventa matéria
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
        if (!subjectId) continue;
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
        e = { ...e, disciplina: (sid && useSubjects.getState().items.find((x) => x.id === sid)?.name) || e.disciplina };
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

  // avaliações da Sala de Avaliações: cada uma vira (ou atualiza) uma avaliação na matéria
  const hoje = new Date().toISOString().slice(0, 10);
  for (const a of r.avaliacoes ?? []) {
    const subjectId = subjectFor(a.disciplina, now, a.codigoDisciplina);
    if (!subjectId) continue;
    const materia = useSubjects.getState().items.find((x) => x.id === subjectId)?.name ?? a.disciplina;
    const exams = useExams.getState();
    const ex = exams.items.find((x) => x.subjectId === subjectId && x.estacio?.code === a.code);
    const data = a.data ?? a.ate ?? a.de ?? hoje;
    const meta = { code: a.code, status: a.status, modo: a.modo, local: a.local, hora: a.hora, de: a.de, ate: a.ate, max: a.max, syncedAt: now };
    if (ex) {
      // você mexeu: só atualiza o que é do portal (status, local, janela); o resto fica como você deixou
      exams.update(
        ex.id,
        ex.editedAt ? { estacio: meta, grade: ex.grade ?? a.nota } : { title: a.titulo, date: data, grade: a.nota ?? ex.grade, estacio: meta },
      );
    } else {
      // apaga a versão antiga (só com título) da mesma prova, se houver
      const velha = exams.items.find((x) => x.subjectId === subjectId && !x.estacio && new RegExp(`^${a.titulo}\\b`).test(x.title));
      if (velha && !velha.editedAt) exams.remove(velha.id);
      exams.add({ subjectId, title: a.titulo, kind: 'prova', date: data, grade: a.nota, estacio: meta });
      avaliacoes++;
    }

    // ainda dá para agendar/fazer: vira tarefa com prazo no fim da janela
    if (a.status === 'pendente' && a.ate && a.ate >= hoje) {
      if (a.code === 'AVS') {
        const p = parcial(a.disciplina);
        if (p !== undefined && p >= 6) continue; // já passou: substitutiva não precisa
      }
      const verbo = a.modo === 'polo' ? 'Agendar' : 'Fazer';
      const titulo = `${verbo} ${a.titulo}${a.code === 'AVS' ? ' (substitutiva)' : ''} · ${materia} · até ${br(a.ate)}`;
      const tasks = useTasks.getState();
      const chave = norm(titulo.replace(/ · até .*$/, ''));
      const ja = tasks.tasks.find((t) => t.source === 'estacio' && norm(t.title).startsWith(chave));
      if (!ja) {
        tasks.add({
          title: titulo,
          due: a.ate,
          tags: ['faculdade'],
          priority: a.code.startsWith('SM') || a.code === 'AVS' ? 'media' : 'alta',
          source: 'estacio',
        });
        prazos++;
      }
    }
    // já feita/agendada: a tarefa de agendar sai sozinha
    if (a.status === 'feita' || a.status === 'agendada') {
      const tasks = useTasks.getState();
      const chave = norm(`${a.modo === 'polo' ? 'Agendar' : 'Fazer'} ${a.titulo}`);
      for (const t of tasks.tasks) {
        if (t.source === 'estacio' && t.status !== 'done' && norm(t.title).startsWith(chave) && norm(t.title).includes(norm(materia))) {
          tasks.setStatus(t.id, 'done');
        }
      }
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
  // financeiro do SIA: abertas (com linha digitável) e pagas (histórico)
  for (const cb of r.cobrancas ?? []) {
    if (cb.situacao === 'sem-cobranca') continue;
    const descricao = `${cb.tipo} Estácio · ${cb.competencia}`;
    const info = cb.linha ? lerCodigo(cb.linha) : cb.barras ? lerCodigo(cb.barras) : null;
    const st = useBoletos.getState();
    const ex =
      st.items.find((x) => x.ref === cb.ref) ??
      // o aviso do mural (sem código) da mesma mensalidade
      st.items.find((x) => x.origem === 'estacio' && !x.ref && !x.linha && cb.vencimento && x.vencimento === cb.vencimento);
    if (cb.situacao === 'paga') {
      const data = {
        descricao,
        ref: cb.ref,
        competencia: cb.competencia,
        valor: cb.valorPago ?? cb.valor,
        vencimento: cb.vencimento ?? cb.pagoEm,
        pago: true,
        pagoEm: cb.pagoEm,
        origem: 'estacio' as const,
      };
      if (ex) {
        if (!ex.pago) {
          cancelarAvisos(ex.avisos);
          st.update(ex.id, { ...data, avisos: [] });
          nb++;
        }
      } else {
        st.add(data);
        nb++;
      }
      continue;
    }
    const data = {
      descricao,
      ref: cb.ref,
      competencia: cb.competencia,
      valor: cb.valor,
      vencimento: cb.vencimento,
      linha: info?.linha ?? ex?.linha,
      barras: info?.barras ?? ex?.barras,
      banco: info?.banco ?? ex?.banco,
      beneficiario: 'Estácio',
      origem: 'estacio' as const,
    };
    if (ex) {
      const mudou = ex.valor !== data.valor || ex.vencimento !== data.vencimento || ex.linha !== data.linha || !ex.ref;
      if (mudou) {
        st.update(ex.id, data);
        if (ex.vencimento !== data.vencimento)
          agendarAvisos({ ...data, avisos: ex.avisos })
            .then((avisos) => useBoletos.getState().update(ex.id, { avisos }))
            .catch(() => {});
        nb++;
      }
    } else {
      const id = st.add(data);
      agendarAvisos(data)
        .then((avisos) => useBoletos.getState().update(id, { avisos }))
        .catch(() => {});
      nb++;
    }
  }

  // mensalidade avisada no mural (sem código: o boleto em si sai no app/portal financeiro)
  for (const m of r.mensalidades ?? []) {
    const descricao = `Mensalidade Estácio${m.mes ? ` (${m.mes})` : ''}`;
    if (useBoletos.getState().items.some((x) => x.origem === 'estacio' && x.vencimento === m.vencimento)) continue;
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
  // nada lido do portal é diferente de "nada novo": avisa para não parecer que deu certo
  if (!r.disciplinas.length && !(r.avaliacoes ?? []).length && !(r.cobrancas ?? []).length)
    return 'Estácio: não consegui ler o portal. Tente de novo.';
  return partes.length ? `Estácio: ${partes.join(', ')}` : 'Estácio: tudo em dia, nada novo';
}
