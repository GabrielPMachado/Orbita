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

export interface LeituraEstacio {
  disciplinas: Disciplina[];
  eventos: Evento[];
  mensalidades: MensalidadeAviso[];
  renovacao: boolean;
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
  const nomes = new Map<string, string>(); // código → nome
  const eventos: Evento[] = [];
  const mensalidades: MensalidadeAviso[] = [];
  let renovacao = false;

  for (const j of c.json) {
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
      const cod = /\/avaliacoes\/([A-Z]{2,4}\d{3,5})/.exec(j.page ?? '')?.[1];
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
      if (!d?.code) continue;
      const disc = cod ? (nomes.get(cod) ?? cod) : undefined;
      const prova = d.code === 'AVS' ? 'AVS' : d.code === 'AV' ? 'AV' : d.code;
      const agendada = (d.evaluations ?? []).length > 0;
      if (agendada) {
        // data marcada: qualquer campo de data dentro da avaliação agendada
        for (const ev of d.evaluations ?? []) {
          const datas = Object.entries(ev)
            .filter(([k, v]) => typeof v === 'string' && /date|data|start|inicio/i.test(k) && /\d{4}-\d{2}-\d{2}/.test(v as string))
            .map(([, v]) => v as string);
          const quando = day(datas[0]);
          if (quando) eventos.push({ titulo: `Prova ${prova}`, tipo: 'prova', data: quando, disciplina: disc });
        }
      } else if (d.isScheduleAvailable && d.scheduleEndDate) {
        eventos.push({
          titulo: `Agendamento da ${prova}`,
          tipo: 'agendamento',
          data: day(d.scheduleStartDate) ?? day(d.scheduleEndDate)!,
          ate: day(d.scheduleEndDate),
          disciplina: disc,
          // a AVS só é necessária se a nota não bastar
          opcional: prova === 'AVS',
        });
      }
      if (d.startDate && d.endDate && !agendada) {
        eventos.push({ titulo: `Período da Prova ${prova}`, tipo: 'prazo', data: day(d.startDate)!, ate: day(d.endDate), disciplina: disc });
      }
    }
  }

  // notas (texto da página "Minhas notas" de cada disciplina)
  for (const p of c.pages.values()) {
    const cod = /\/avaliacoes\/([A-Z]{2,4}\d{3,5})/.exec(p.url)?.[1];
    if (!cod || !/Minhas notas/.test(p.text)) continue;
    const n = notasDoTexto(p.text);
    if (!Object.keys(n).length) continue;
    const base = discs.get(cod) ?? { nome: nomes.get(cod) ?? cod, codigo: cod, notas: {} };
    discs.set(cod, { ...base, notas: { ...base.notas, ...n } });
  }

  return { disciplinas: [...discs.values()], eventos, mensalidades, renovacao };
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
  /** dentro da disciplina: toca numa aba (só leitura: Prova AV, Prova AVS, Minhas notas) */
  aba: (nome: string) =>
    `(function(){ var vs = [].slice.call(document.querySelectorAll('div,span,a')).filter(function(e){ return /voltar/i.test(e.innerText||'') && e.innerText.trim().length < 10; }); var b = [].slice.call(document.querySelectorAll('button')).find(function(b){ return (b.innerText||'').trim() === ${JSON.stringify(nome)}; }); if (!b && vs[0]) { vs[0].click(); setTimeout(function(){ var b2 = [].slice.call(document.querySelectorAll('button')).find(function(b){ return (b.innerText||'').trim() === ${JSON.stringify(nome)}; }); if (b2) b2.click(); }, 1200); } else if (b) b.click(); true; })();`,
};
