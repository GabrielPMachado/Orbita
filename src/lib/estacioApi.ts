/**
 * Leitura feita sob medida para o portal atual da Estácio (mapeado em nov/2026):
 *
 *  estudante.estacio.br  → apis.estudante.estacio.br/rest/…
 *    turmas/estacio_<id>       disciplina { nome, codigo }, educadorResponsavel, programacao, situacao
 *    v3/avaliacoes             [{ id: 'ARA3555', nome }]  (disciplinas com avaliações)
 *    calendarios/eventos       [{ nome, importante, dataInicio, dataFim }]
 *    me/mural-avisos           { avisos: [{ categoria, templateKey, vencimento: '21/12', params: { mes } }] }
 *
 *  estacio.saladeavaliacoes.com.br/avaliacoes/<código>/  → api-sirius…/sirius-student-api/…
 *    evaluation-card?evaluationType=AV|AVS
 *      { code, startDate, endDate, scheduleStartDate, scheduleEndDate, isScheduleAvailable, hasEvaluation, evaluations[] }
 *    página "Minhas notas": Progresso / Simulado 1 / Simulado 2 / Prova AV / Prova AVS / Nota Parcial
 */
import type { Captura, Disciplina, Evento } from './estacio';

const day = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  // datas do portal vêm em UTC; o dia que importa é o do Brasil
  const br = new Date(d.getTime() - 3 * 3600 * 1000);
  return br.toISOString().slice(0, 10);
};
const parse = (s: string) => {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return undefined;
  }
};
const titleCase = (s: string) =>
  s === s.toUpperCase() || s === s.toLowerCase()
    ? s
        .toLowerCase()
        .split(/\s+/)
        .map((w, i) => (i > 0 && /^(de|da|do|das|dos|e|em|a|o|à|para|com)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ')
    : s;
const num = (s?: string) => (s && /^\d{1,2},\d$/.test(s.trim()) ? Number(s.trim().replace(',', '.')) : undefined);

export interface MensalidadeAviso {
  mes?: string;
  vencimento: string; // AAAA-MM-DD
}

/** Uma avaliação da Sala de Avaliações (Prova AV/AVS, Simulado 1/2), como aparece no portal. */
export interface AvalEstacio {
  codigoDisciplina: string;
  disciplina: string;
  code: string; // AV, AVS, SM1, SM2
  titulo: string; // "Prova AV", "Simulado 1"
  nota?: number;
  max?: number;
  modo?: 'polo' | 'online';
  status: 'feita' | 'agendada' | 'pendente' | 'fechada';
  data?: string; // feita/agendada: o dia
  hora?: string;
  de?: string; // janela para agendar/fazer
  ate?: string;
  local?: string;
}

export interface LeituraEstacio {
  disciplinas: Disciplina[];
  eventos: Evento[];
  avaliacoes: AvalEstacio[];
  mensalidades: MensalidadeAviso[];
  renovacao: boolean;
}

const TITULO_CODE: Record<string, string> = { 'Prova AV': 'AV', 'Prova AVS': 'AVS', 'Simulado 1': 'SM1', 'Simulado 2': 'SM2' };
const CODE_TITULO: Record<string, string> = { AV: 'Prova AV', AVS: 'Prova AVS', SM1: 'Simulado 1', SM2: 'Simulado 2' };
/** "POLO CENTRO - PORTO ALEGRE - RS (LABORATÓRIO 1 (térreo))" → "Polo Centro, Porto Alegre/RS · Laboratório 1 (térreo)" */
function fmtLocal(raw: string) {
  const cap = (w: string) =>
    /^[A-Z]{2}$/.test(w) ? w : /^(de|da|do|das|dos|e)$/i.test(w) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const m = /^(.*?)\s*\((.*)\)\s*$/.exec(raw.trim());
  const base = (m ? m[1] : raw).split(/\s+-\s+/).map((p) => p.split(/\s+/).map(cap).join(' '));
  const uf = base.length > 1 && /^[A-Z]{2}$/.test(base[base.length - 1]) ? base.pop() : undefined;
  const lugar = uf ? `${base.slice(0, -1).join(', ')}${base.length > 1 ? ', ' : ''}${base[base.length - 1]}/${uf}` : base.join(', ');
  const sala = m ? m[2].replace(/^([^(]+)/, (x) => x.trim().split(/\s+/).map(cap).join(' ') + (/\s$/.test(x) ? ' ' : '')) : '';
  return sala ? `${lugar} · ${sala}` : lugar;
}
const isoBR = (d: string) => `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}`;

/**
 * Cartões da tela de uma avaliação, como o portal escreve:
 *   Prova AV · Nota: 3,2 / 8,0 · No Polo · Realizada em 09/11/2026 · 09/11/2026 às 17:00 · POLO CENTRO - … · Acessar gabarito
 *   Prova AVS · Nota: -- / 8,0 · No Polo · Não agendada · 24/09/2026 (00:00) até 03/12/2026 (23:59) · POLO … · Agendar
 *   Simulado 1 · Nota: 1,0 / 1,0 · Online · Realizada em 19/11/2026 · 15/09/2026 (00:00) até 19/11/2026 (23:59)
 */
export function cartoesDoTexto(text: string): Omit<AvalEstacio, 'codigoDisciplina' | 'disciplina'>[] {
  const ls = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Omit<AvalEstacio, 'codigoDisciplina' | 'disciplina'>[] = [];
  for (let i = 0; i < ls.length; i++) {
    const code = TITULO_CODE[ls[i]];
    if (!code || ls[i + 1] !== 'Nota:') continue;
    // o cartão vai até o próximo título de avaliação
    let j = i + 2;
    while (j < ls.length && !(TITULO_CODE[ls[j]] && ls[j + 1] === 'Nota:')) j++;
    const bloco = ls.slice(i + 2, j);
    const nota = num(bloco[0]);
    const max = /^\/\s*(\d{1,2}),(\d)/.exec(bloco[1] ?? '');
    const corpo = bloco.join('\n');
    const feita = /Realizada em (\d{2}\/\d{2}\/\d{4})/.exec(corpo);
    const marcada = /(\d{2}\/\d{2}\/\d{4}) às (\d{2}:\d{2})/.exec(corpo);
    const janela = /(\d{2}\/\d{2}\/\d{4}) \(\d{2}:\d{2}\) até (\d{2}\/\d{2}\/\d{4})/.exec(corpo);
    const local = bloco.find((l) => /^POLO\b|\bPOLO\b.* - [A-Z]{2}\b/i.test(l));
    const naoAgendada = /Não agendada/i.test(corpo);
    const encerrada = /Não realizada|Expirad|Encerrad|Perdid/i.test(corpo);
    const status: AvalEstacio['status'] = feita ? 'feita' : marcada && !naoAgendada ? 'agendada' : encerrada ? 'fechada' : 'pendente';
    out.push({
      code,
      titulo: ls[i],
      nota,
      max: max ? Number(`${max[1]}.${max[2]}`) : undefined,
      modo: /No Polo/i.test(corpo) ? 'polo' : /Online/i.test(corpo) ? 'online' : undefined,
      status,
      data: feita ? isoBR(feita[1]) : marcada ? isoBR(marcada[1]) : undefined,
      hora: marcada?.[2],
      de: janela ? isoBR(janela[1]) : undefined,
      ate: janela ? isoBR(janela[2]) : undefined,
      local: local ? fmtLocal(local) : undefined,
    });
    i = j - 1;
  }
  return out;
}

/** Notas da página "Minhas notas" (texto da tela). */
function notasDoTexto(text: string): Record<string, number> {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: Record<string, number> = {};
  const labels: Record<string, string> = { Progresso: 'Progresso', 'Simulado 1': 'Sim1', 'Simulado 2': 'Sim2', 'Prova AV': 'AV', 'Prova AVS': 'AVS' };
  lines.forEach((l, i) => {
    const k = labels[l];
    if (!k) return;
    const v = num(lines[i + 1]);
    if (v !== undefined && /^\/\d/.test(lines[i + 2] ?? '')) out[k] = v;
  });
  const parcial = /Nota Parcial[\s\S]*?=\s*\n?\s*(\d{1,2},\d)\s*\n?\s*\/10,0/.exec(text);
  if (parcial) out['Parcial'] = Number(parcial[1].replace(',', '.'));
  return out;
}

export function lerPortal(c: Captura): LeituraEstacio {
  const discs = new Map<string, Disciplina>(); // por código
  const ordem: string[] = []; // códigos na ordem da tela "Avaliações"
  const nomes = new Map<string, string>(); // código → nome
  const eventos: Evento[] = [];
  const mensalidades: MensalidadeAviso[] = [];
  const avals = new Map<string, AvalEstacio>(); // `${disciplina}|${code}`
  let renovacao = false;

  // primeiro as listas (nomes e ordem das disciplinas), depois o resto
  const lista = [...c.json].sort(
    (a, b) => Number(/v3\/avaliacoes|turmas\/estacio_/.test(b.url)) - Number(/v3\/avaliacoes|turmas\/estacio_/.test(a.url)),
  );
  for (const j of lista) {
    const u = j.url;
    const body = parse(j.body);
    if (!body) continue;

    // disciplinas (turma)
    if (/\/rest\/turmas\/estacio_/.test(u)) {
      const t = body as {
        disciplina?: { nome?: string; codigo?: string };
        educadorResponsavel?: { nome?: string };
        programacao?: { diaSemana?: string; horaInicio?: string; horaFim?: string }[];
        situacao?: string;
      };
      const cod = t.disciplina?.codigo;
      const nome = t.disciplina?.nome;
      if (!cod || !nome) continue;
      const h = (t.programacao ?? []).filter((p) => p.diaSemana).map((p) => `${p.diaSemana} ${p.horaInicio}–${p.horaFim}`);
      nomes.set(cod, titleCase(nome));
      discs.set(cod, {
        ...discs.get(cod),
        nome: titleCase(nome),
        codigo: cod,
        professor: t.educadorResponsavel?.nome ? titleCase(t.educadorResponsavel.nome) : undefined,
        horario: h.length ? h.join(', ') : undefined,
        notas: discs.get(cod)?.notas ?? {},
      });
    }

    // lista das disciplinas com avaliação
    if (/\/rest\/v3\/avaliacoes/.test(u) && Array.isArray(body)) {
      for (const a of body as { id?: string; nome?: string }[]) {
        if (!a.id || !a.nome) continue;
        if (!ordem.includes(a.id)) ordem.push(a.id);
        nomes.set(a.id, nomes.get(a.id) ?? titleCase(a.nome));
        if (!discs.has(a.id)) discs.set(a.id, { nome: titleCase(a.nome), codigo: a.id, notas: {} });
      }
    }

    // calendário acadêmico
    if (/\/rest\/calendarios\/eventos/.test(u) && Array.isArray(body)) {
      for (const e of body as { nome?: string; importante?: boolean; dataInicio?: string; dataFim?: string }[]) {
        const ini = e.dataInicio?.slice(0, 10);
        const fim = e.dataFim?.slice(0, 10);
        if (!e.nome || !ini) continue;
        if (/^semestre letivo$/i.test(e.nome.trim()) && !e.importante) continue;
        const n = titleCase(e.nome);
        eventos.push({
          titulo: n,
          tipo: /prova|av\b|avs/i.test(n) ? 'prova' : /agend/i.test(n) ? 'agendamento' : 'prazo',
          data: ini,
          ate: fim && fim !== ini ? fim : undefined,
        });
      }
    }

    // mural: mensalidade a vencer, renovação
    if (/\/rest\/me\/mural-avisos/.test(u)) {
      const avisos =
        (body as { avisos?: { categoria?: string; templateKey?: string; vencimento?: string | null; params?: { mes?: string } }[] }).avisos ?? [];
      for (const a of avisos) {
        if (/financeiro/i.test(a.categoria ?? '') && /mensalidade/.test(a.templateKey ?? '') && a.vencimento) {
          const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(a.vencimento.trim());
          if (m) {
            const now = new Date();
            let y = m[3] ? Number(m[3]) : now.getFullYear();
            // "21/01" visto em dezembro é do ano que vem
            if (!m[3] && Number(m[2]) < now.getMonth() + 1 - 6) y++;
            mensalidades.push({ mes: a.params?.mes, vencimento: `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` });
          }
        }
        if (/renova/i.test(`${a.categoria} ${a.templateKey}`)) renovacao = true;
      }
    }

    // sala de avaliações: cartão da prova (AV / AVS) — a disciplina vem da página
    if (/sirius-student-api\/evaluation-card/.test(u)) {
      const cod =
        (j.disc && /^[A-Z]{2,4}\d{3,5}$/.test(j.disc) ? j.disc : undefined) ??
        /\/avaliacoes\/([A-Z]{2,4}\d{3,5})/.exec(j.page ?? '')?.[1] ??
        /[?&]discipline=([A-Z]{2,4}\d{3,5})/.exec(j.page ?? '')?.[1] ??
        (j.ordem !== undefined ? ordem[j.ordem] : undefined);
      const d = (body as { data?: Record<string, unknown> }).data as
        | {
            code?: string;
            startDate?: string;
            endDate?: string;
            scheduleStartDate?: string;
            scheduleEndDate?: string;
            isScheduleAvailable?: boolean;
            hasEvaluation?: boolean;
            evaluations?: Record<string, unknown>[];
          }
        | undefined;
      if (!d?.code || !cod || !CODE_TITULO[d.code]) continue;
      const ev0 = (d.evaluations ?? [])[0] as { startedAt?: string; endedAt?: string; score?: number; status?: number } | undefined;
      const feita = !!ev0?.endedAt || (d.hasEvaluation && ev0?.score != null);
      const de = day(d.scheduleStartDate || d.startDate);
      const ate = day(d.scheduleEndDate || d.endDate);
      const hoje = new Date().toISOString().slice(0, 10);
      const prev = avals.get(`${cod}|${d.code}`);
      avals.set(`${cod}|${d.code}`, {
        ...prev,
        codigoDisciplina: cod,
        disciplina: nomes.get(cod) ?? cod,
        code: d.code,
        titulo: CODE_TITULO[d.code],
        nota: ev0?.score ?? prev?.nota,
        max: (d as { maxScoreEvaluation?: number }).maxScoreEvaluation ?? prev?.max,
        status: feita ? 'feita' : (d.evaluations ?? []).length ? 'agendada' : ate && ate < hoje ? 'fechada' : 'pendente',
        data: feita ? day(ev0?.endedAt ?? ev0?.startedAt) : prev?.data,
        de: de ?? prev?.de,
        ate: ate ?? prev?.ate,
        modo: (d as { isExamCampus?: boolean }).isExamCampus ? 'polo' : (prev?.modo ?? 'online'),
      });
    }
  }

  // texto de cada tela (Prova AV, Prova AVS, Simulados) completa local, hora e status
  for (const p of c.pages.values()) {
    const cod = /\/avaliacoes\/([A-Z]{2,4}\d{3,5})/.exec(p.url)?.[1] ?? /[?&]discipline=([A-Z]{2,4}\d{3,5})/.exec(p.url)?.[1];
    if (!cod) continue;
    for (const k of cartoesDoTexto(p.text)) {
      const prev = avals.get(`${cod}|${k.code}`);
      avals.set(`${cod}|${k.code}`, {
        ...prev,
        ...Object.fromEntries(Object.entries(k).filter(([, v]) => v !== undefined)),
        codigoDisciplina: cod,
        disciplina: nomes.get(cod) ?? prev?.disciplina ?? cod,
        // a tela é mais precisa que o cartão para status, data e hora
        status: k.status,
      } as AvalEstacio);
    }
  }

  // notas (texto da página "Minhas notas" de cada disciplina)
  for (const p of c.pages.values()) {
    const cod = /\/avaliacoes\/([A-Z]{2,4}\d{3,5})/.exec(p.url)?.[1] ?? /[?&]discipline=([A-Z]{2,4}\d{3,5})/.exec(p.url)?.[1];
    if (!cod || !/Minhas notas/.test(p.text)) continue;
    const n = notasDoTexto(p.text);
    if (!Object.keys(n).length) continue;
    const base = discs.get(cod) ?? { nome: nomes.get(cod) ?? cod, codigo: cod, notas: {} };
    discs.set(cod, { ...base, notas: { ...base.notas, ...n } });
  }

  // nome da disciplina pode ter chegado depois
  const avaliacoes = [...avals.values()].map((a) => ({ ...a, disciplina: nomes.get(a.codigoDisciplina) ?? a.disciplina }));
  return { disciplinas: [...discs.values()], eventos, avaliacoes, mensalidades, renovacao };
}

/** Roteiro da varredura: o que abrir e o que tocar, nessa ordem. */
export const PORTAL = {
  inicio: 'https://estudante.estacio.br/inicio',
  avaliacoes: 'https://estudante.estacio.br/avaliacoes',
  /** vai para /avaliacoes sem recarregar (o app busca a lista de disciplinas) */
  irAvaliacoes: `(function(){ try { history.pushState({}, '', '/avaliacoes'); dispatchEvent(new PopStateEvent('popstate')); } catch(e){} true; })();`,
  /** quantos botões "Acessar Avaliações" há na tela */
  contar: `(function(){ var n = [].slice.call(document.querySelectorAll('button')).filter(function(b){ return /Acessar Avalia/.test(b.innerText); }).length; window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'count', n: n })); true; })();`,
  /** abre a i-ésima disciplina na sala de avaliações */
  abrir: (i: number) =>
    `(function(){ var b = [].slice.call(document.querySelectorAll('button')).filter(function(b){ return /Acessar Avalia/.test(b.innerText); })[${i}]; if (b) b.click(); true; })();`,
  /** dentro da disciplina: toca numa aba (só leitura: Prova AV, Prova AVS, Simulados, Minhas notas) */
  aba: (nome: string) =>
    `(function(){
      var achar = function(){ return [].slice.call(document.querySelectorAll('button')).find(function(b){ return (b.innerText||'').trim().split('\\n')[0].trim() === ${JSON.stringify(nome)}; }); };
      var b = achar();
      if (b) { b.click(); return true; }
      // está dentro de outra aba: volta para a lista e toca
      var v = [].slice.call(document.querySelectorAll('button')).find(function(b){ return (b.innerText||'').trim() === 'Voltar'; });
      if (v) { v.click(); setTimeout(function(){ var b2 = achar(); if (b2) b2.click(); }, 1500); }
      true;
    })();`,
};
