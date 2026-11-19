/**
 * Estácio sem API: o portal abre dentro do Órbita (WebView), você entra com seu login e o app lê
 * o que a própria página mostra/recebe. A senha não passa pelo Órbita nem fica salva — quem guarda
 * a sessão é o cookie do portal, como no Safari.
 *
 * Como o portal muda, a leitura é por padrões: listas de disciplinas e notas nas respostas JSON da
 * página e em tabelas; boletos pela linha digitável (lib/boleto).
 */
import { lerTexto, type BoletoInfo } from './boleto';
import { lerPortal, type MensalidadeAviso } from './estacioApi';

export const ESTACIO_URLS = [
  { label: 'Minha Estácio', url: 'https://estudante.estacio.br/' },
  { label: 'SIA', url: 'https://sia.estacio.br/' },
];

/* ---------- scripts injetados na página ---------- */

/** Antes da página carregar: copia as respostas JSON que ela recebe (fetch e XHR). */
export const HOOK_JS = `
(function(){
  if (window.__orbita) return; window.__orbita = true;
  var send = function(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} };
  var keep = function(url, text){
    if (!text || text.length < 2 || text.length > 400000) return;
    var c = text.trim()[0]; if (c !== '{' && c !== '[') return;
    var disc = (location.pathname.match(/avaliacoes\/([A-Z]{2,4}\d{3,5})/) || [])[1];
    try { disc = disc || new URLSearchParams(location.search).get('discipline') || sessionStorage.getItem('DisciplineId') || undefined; } catch(e){}
    send({ type: 'json', url: String(url).slice(0, 300), page: location.href.slice(0, 300), disc: disc, body: text });
  };
  var f = window.fetch;
  if (f) window.fetch = function(){ var a = arguments; return f.apply(this, a).then(function(r){ try { r.clone().text().then(function(t){ keep(r.url || a[0], t); }); } catch(e){} return r; }); };
  var o = XMLHttpRequest.prototype.open, s = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, u){ this.__u = u; return o.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(){ var x = this; x.addEventListener('load', function(){ try { if (!x.responseType || x.responseType === 'text') keep(x.__u, x.responseText); else if (x.responseType === 'json') keep(x.__u, JSON.stringify(x.response)); } catch(e){} }); return s.apply(this, arguments); };
  true;
})();
`;

/** Depois de carregar (e a cada 3 s, para páginas que montam o conteúdo aos poucos): texto e tabelas. */
export const PAGE_JS = `
(function(){
  var send = function(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} };
  var grab = function(){
    var tables = [].slice.call(document.querySelectorAll('table')).slice(0, 30).map(function(t){
      return [].slice.call(t.rows).slice(0, 200).map(function(r){ return [].slice.call(r.cells).map(function(c){ return (c.innerText || '').trim().slice(0, 200); }); });
    });
    var pw = [].slice.call(document.querySelectorAll('input[type=password]')).some(function(i){ var r = i.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
    send({ type: 'page', url: location.href, title: document.title, text: (document.body && document.body.innerText || '').slice(0, 200000), tables: tables, login: pw });
  };
  grab();
  if (!window.__orbitaTick) window.__orbitaTick = setInterval(grab, 3000);
  true;
})();
`;

/** Links do menu que levam a notas, provas, agendamento, calendário, financeiro… */
export const LINKS_JS = `
(function(){
  var re = /nota|boletim|avalia|prova|agend|calend|disciplina|matr[ií]cula|financeiro|boleto|mensalidade|hor[aá]rio|aula|cronograma|prazo|atividade|frequ[eê]ncia|falta|desempenho|plano de ensino/i;
  var no = /sair|logout|senha|ajuda|chat|whats|ouvidoria|termos|privacidade|instagram|facebook|youtube|linkedin/i;
  var out = [];
  [].slice.call(document.querySelectorAll('a[href]')).forEach(function(a){
    var t = (a.innerText || a.getAttribute('aria-label') || a.title || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    var h = a.href;
    if (!h || h.indexOf('javascript:') === 0 || h.indexOf('mailto:') === 0) return;
    if (!/estacio\.br|yduqs/i.test(h)) return;
    if (re.test(t + ' ' + h) && !no.test(t + ' ' + h)) out.push({ text: t, href: h.split('#')[0] + (h.indexOf('#/') > 0 ? h.slice(h.indexOf('#')) : '') });
  });
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'links', items: out.slice(0, 40) }));
  true;
})();
`;

/** Baixa um PDF com a sessão do portal e devolve em base64 (boleto em PDF). */
export const pdfJs = (url: string) => `
(function(){
  fetch(${JSON.stringify(url)}, { credentials: 'include' }).then(function(r){ return r.blob(); }).then(function(b){
    if (b.size > 6000000) return;
    var fr = new FileReader();
    fr.onload = function(){ window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pdf', url: ${JSON.stringify(url)}, b64: String(fr.result).split(',')[1] })); };
    fr.readAsDataURL(b);
  }).catch(function(){});
  true;
})();
`;

/* ---------- leitura ---------- */

export interface Disciplina {
  nome: string;
  codigo?: string;
  professor?: string;
  notas: Record<string, number>;
  faltas?: number;
  horario?: string;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const KEY_NOME =
  /^(nome_?disciplina|disciplina_?nome|disciplina|nomedisciplina|desc(ricao)?_?disciplina|nm_?disciplina|componente|nome_?componente)$/;
const KEY_COD = /^(cod(igo)?_?disciplina|disciplina_?cod(igo)?|cd_?disciplina|codigo)$/;
const KEY_PROF = /^(nome_?)?(professor|docente)(_?nome)?$/;
const KEY_NOTA = /^(av[1-3]|avs|ava|nota_?av[1-3]|nota[1-3]?|media(_?final)?|mf|nota_?final|grau|n[1-3])$/;
const KEY_FALTA = /^(faltas?|qtd_?faltas|total_?faltas|ausencias)$/;
const KEY_HORA = /^(horario|hora_?inicio|dia_?semana|turno)$/;

const toNum = (v: unknown) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^\s*\d{1,2}([.,]\d{1,2})?\s*$/.test(v)) return Number(v.replace(',', '.'));
  return undefined;
};

/** Varre um JSON qualquer atrás de objetos que parecem disciplinas. */
function fromJson(node: unknown, out: Map<string, Disciplina>, depth = 0) {
  if (depth > 8 || !node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.slice(0, 500).forEach((n) => fromJson(n, out, depth + 1));
    return;
  }
  const o = node as Record<string, unknown>;
  let nome: string | undefined;
  let codigo: string | undefined;
  let professor: string | undefined;
  let faltas: number | undefined;
  let horario: string | undefined;
  const notas: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const nk = norm(k).replace(/[^a-z0-9_]/g, '');
    if (typeof v === 'string' && KEY_NOME.test(nk) && v.trim().length > 2) nome = v.trim();
    else if ((typeof v === 'string' || typeof v === 'number') && KEY_COD.test(nk)) codigo = String(v);
    else if (typeof v === 'string' && KEY_PROF.test(nk)) professor = v.trim();
    else if (KEY_FALTA.test(nk) && toNum(v) !== undefined) faltas = toNum(v);
    else if (KEY_HORA.test(nk) && typeof v === 'string') horario = [horario, v.trim()].filter(Boolean).join(' ');
    else if (KEY_NOTA.test(nk) && toNum(v) !== undefined && toNum(v)! <= 10) notas[k.toUpperCase().replace(/^NOTA_?/, '')] = toNum(v)!;
    else if (v && typeof v === 'object') fromJson(v, out, depth + 1);
  }
  if (nome && !/^\d+$/.test(nome)) {
    const key = norm(nome);
    const prev = out.get(key);
    out.set(key, {
      nome: prev?.nome ?? titleCase(nome),
      codigo: prev?.codigo ?? codigo,
      professor: prev?.professor ?? (professor ? titleCase(professor) : undefined),
      notas: { ...prev?.notas, ...notas },
      faltas: faltas ?? prev?.faltas,
      horario: prev?.horario ?? horario,
    });
  }
}

/** Tabelas com cabeçalho "Disciplina" (e colunas de nota/falta). */
function fromTables(tables: string[][][], out: Map<string, Disciplina>) {
  for (const t of tables) {
    const hi = t.findIndex((r) => r.some((c) => /disciplina|componente/i.test(c)));
    if (hi < 0) continue;
    const head = t[hi].map((h) => norm(h).replace(/[^a-z0-9]/g, ''));
    const iNome = head.findIndex((h) => /disciplina|componente/.test(h));
    for (const r of t.slice(hi + 1)) {
      const nome = r[iNome]?.replace(/^[A-Z]{2,4}\d{3,5}\s*[-–]\s*/, '').trim();
      if (!nome || nome.length < 3) continue;
      const notas: Record<string, number> = {};
      let faltas: number | undefined;
      let professor: string | undefined;
      let horario: string | undefined;
      head.forEach((h, i) => {
        if (i === iNome) return;
        const v = r[i];
        if (KEY_NOTA.test(h) && toNum(v) !== undefined) notas[t[hi][i].toUpperCase()] = toNum(v)!;
        else if (KEY_FALTA.test(h) && toNum(v) !== undefined) faltas = toNum(v);
        else if (KEY_PROF.test(h) && v) professor = v;
        else if (/horario|dia/.test(h) && v) horario = v;
      });
      const key = norm(nome);
      const prev = out.get(key);
      out.set(key, {
        nome: prev?.nome ?? titleCase(nome),
        codigo: prev?.codigo ?? /^([A-Z]{2,4}\d{3,5})/.exec(r[iNome] ?? '')?.[1],
        professor: prev?.professor ?? professor,
        notas: { ...prev?.notas, ...notas },
        faltas: faltas ?? prev?.faltas,
        horario: prev?.horario ?? horario,
      });
    }
  }
}

function titleCase(s: string) {
  if (s !== s.toUpperCase()) return s;
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'para', 'com']);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : /^(i|ii|iii|iv|v|vi)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export interface Captura {
  json: { url: string; body: string; page?: string; disc?: string; ordem?: number }[];
  pages: Map<string, { url: string; title: string; text: string; tables: string[][][] }>;
  /** a última página pedia senha (sessão expirada ou ainda não entrou) */
  login?: boolean;
  pdfs: { url: string; b64: string }[];
}
export const novaCaptura = (): Captura => ({ json: [], pages: new Map(), pdfs: [] });

/* ---------- provas, janelas de agendamento e prazos ---------- */

export type TipoEvento = 'prova' | 'agendamento' | 'entrega' | 'prazo';
export interface Evento {
  titulo: string;
  tipo: TipoEvento;
  data: string; // AAAA-MM-DD (início, ou o dia)
  ate?: string; // fim da janela (agendamento, entrega)
  disciplina?: string;
  /** código da disciplina na Estácio (ex.: ARA3555) */
  codigo?: string;
  /** nota já lançada (prova feita) */
  nota?: number;
  /** só se precisar (ex.: AVS) */
  opcional?: boolean;
}

const RE_DATA = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b|\b(20\d{2})-(\d{2})-(\d{2})/;
function iso(v: unknown, ano = new Date().getFullYear()): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = RE_DATA.exec(v);
  if (!m) return undefined;
  if (m[4]) return `${m[4]}-${m[5]}-${m[6]}`;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return undefined;
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : ano;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function tipoDe(t: string): TipoEvento | null {
  const n = norm(t);
  if (/venc|boleto|mensalidade|pagamento|fatura/.test(n)) return null; // isso é boleto
  if (/agend|marca(c|ç)ao|marcar/.test(n)) return 'agendamento';
  if (/\bav[1-3s]?\b|\bavs\b|prova|avalia|exame|simulado|\bap[1-3]\b/.test(n)) return 'prova';
  if (/trabalho|entrega|atividade|tarefa|forum|portfolio|projeto|aps\b/.test(n)) return 'entrega';
  if (/prazo|limite|ate o dia|encerra|termino|fim d/.test(n)) return 'prazo';
  return null;
}
const KEY_DATA_INI = /^(data|dt)_?(inicio|ini|abertura|prova|avaliacao|realizacao|evento|agendamento)?$|^(inicio|data_?inicial|datainicio|dtinicio)$/;
const KEY_DATA_FIM = /^(data|dt)_?(fim|final|termino|encerramento|limite|prazo|entrega)$|^(fim|prazo|limite|datafim|dtfim|data_?final)$/;
const KEY_TITULO = /^(titulo|nome|descricao|desc|tipo|tipo_?avaliacao|avaliacao|nome_?avaliacao|evento|atividade)$/;

function eventosJson(node: unknown, out: Evento[], disc?: string, depth = 0) {
  if (depth > 8 || !node || typeof node !== 'object') return;
  if (Array.isArray(node)) return void node.slice(0, 500).forEach((n) => eventosJson(n, out, disc, depth + 1));
  const o = node as Record<string, unknown>;
  let titulo: string | undefined;
  let ini: string | undefined;
  let fim: string | undefined;
  let d = disc;
  for (const [k, v] of Object.entries(o)) {
    const nk = norm(k).replace(/[^a-z0-9_]/g, '');
    if (typeof v === 'string' && KEY_NOME.test(nk) && v.trim().length > 2) d = titleCase(v.trim());
    else if (typeof v === 'string' && KEY_TITULO.test(nk) && !titulo) titulo = v.trim();
    else if (/^(data|dt)|data|^(inicio|fim|prazo|limite)/.test(nk) && !/venc|pagamento|nascimento|cadastro|atualiza|criacao|inclusao/.test(nk)) {
      const dv = iso(v);
      if (!dv) continue;
      if (KEY_DATA_FIM.test(nk) || /fim|final|termino|encerr|limite|prazo/.test(nk)) fim = fim ?? dv;
      else if (KEY_DATA_INI.test(nk) || /inicio|abertura|ini\b/.test(nk) || !ini) ini = ini ?? dv;
    }
  }
  for (const v of Object.values(o)) if (v && typeof v === 'object') eventosJson(v, out, d, depth + 1);
  const quando = ini ?? fim;
  if (!quando) return;
  const t = titulo ?? Object.keys(o).join(' ');
  const tipo = tipoDe(`${t} ${Object.keys(o).join(' ')}`);
  if (!tipo) return;
  out.push({
    titulo: titulo ?? (tipo === 'agendamento' ? 'Agendamento de prova' : 'Prazo'),
    tipo,
    data: quando,
    ate: fim && fim !== quando ? fim : undefined,
    disciplina: d,
  });
}

/** Linhas tipo "Agendamento da AV2: 10/11 a 20/11" ou "AV1 — 12/11/2026". */
function eventosTexto(texto: string, out: Evento[]) {
  const linhas = texto
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 6 && l.length < 220);
  linhas.forEach((l, i) => {
    const tipo = tipoDe(l);
    if (!tipo) return;
    // a data pode estar na mesma linha ou na próxima (tabelas viram linhas)
    const alvo = RE_DATA.test(l) ? l : linhas[i + 1] && RE_DATA.test(linhas[i + 1]) && !tipoDe(linhas[i + 1]) ? `${l} ${linhas[i + 1]}` : '';
    if (!alvo) return;
    const datas = [...alvo.matchAll(new RegExp(RE_DATA.source, 'g'))].map((m) => iso(m[0])).filter((x): x is string => !!x);
    if (!datas.length) return;
    const titulo = l
      .replace(new RegExp(RE_DATA.source, 'g'), '')
      .replace(/\b(de|a|até|ate|às|as|das|dos)\s*$/i, '')
      .replace(/[\s:–—-]+$/, '')
      .trim()
      .slice(0, 80);
    out.push({
      titulo: titulo || (tipo === 'agendamento' ? 'Agendamento de prova' : 'Prazo'),
      tipo,
      data: datas[0],
      ate: datas[1] && datas[1] !== datas[0] ? datas[1] : undefined,
    });
  });
}

function dedupEventos(l: Evento[]) {
  const seen = new Map<string, Evento>();
  for (const e of l) {
    if (e.data < '2020-01-01' || e.data > '2035-12-31') continue;
    const k = `${norm(e.titulo)}|${e.data}|${e.tipo}`;
    const prev = seen.get(k);
    seen.set(k, { ...prev, ...e, disciplina: e.disciplina ?? prev?.disciplina, ate: e.ate ?? prev?.ate });
  }
  return [...seen.values()].sort((a, b) => a.data.localeCompare(b.data));
}

export function analisar(
  c: Captura,
  extraTexto: string[] = [],
): { disciplinas: Disciplina[]; boletos: BoletoInfo[]; eventos: Evento[]; mensalidades: MensalidadeAviso[]; renovacao: boolean } {
  const map = new Map<string, Disciplina>();
  for (const j of c.json) {
    try {
      fromJson(JSON.parse(j.body), map);
    } catch {}
  }
  for (const p of c.pages.values()) fromTables(p.tables, map);
  const texto = [...[...c.pages.values()].map((p) => p.text), ...c.json.map((j) => j.body), ...extraTexto].join('\n');
  const boletos = lerTexto(texto);
  // nomes muito genéricos (menus) não são disciplina
  const disciplinas = [...map.values()].filter((d) => d.nome.length <= 90 && !/^(disciplinas?|todas|selecione)/i.test(d.nome));
  const ev: Evento[] = [];
  for (const j of c.json) {
    try {
      eventosJson(JSON.parse(j.body), ev);
    } catch {}
  }
  for (const p of c.pages.values()) eventosTexto(p.text, ev);
  // leitura sob medida do portal atual (mais confiável): vence a genérica
  const portal = lerPortal(c);
  const porNome = new Map(disciplinas.map((d) => [norm(d.nome), d]));
  for (const d of portal.disciplinas) {
    const prev = porNome.get(norm(d.nome));
    porNome.set(norm(d.nome), { ...prev, ...d, notas: { ...prev?.notas, ...d.notas }, professor: d.professor ?? prev?.professor });
  }
  const todas = [...porNome.values()];
  const comPortal = portal.eventos.length || portal.disciplinas.length;
  return {
    disciplinas: todas,
    boletos,
    // com o portal lido direito, a leitura genérica de texto só atrapalha (pega datas soltas)
    eventos: dedupEventos(comPortal ? [...portal.eventos, ...ev.filter((e) => e.tipo === 'entrega')] : ev),
    mensalidades: portal.mensalidades,
    renovacao: portal.renovacao,
  };
}

/** Só a forma dos dados (chaves e tipos, sem valores) — para ajustar a leitura sem expor nada seu. */
export function formato(c: Captura) {
  const shape = (v: unknown, d = 0): unknown => {
    if (d > 5) return '…';
    if (Array.isArray(v)) return v.length ? [shape(v[0], d + 1)] : [];
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v as object)
          .slice(0, 40)
          .map(([k, x]) => [k, shape(x, d + 1)]),
      );
    return typeof v;
  };
  const urls = c.json.map((j) => {
    let s: unknown = '?';
    try {
      s = shape(JSON.parse(j.body));
    } catch {}
    return { url: j.url.replace(/\?.*/, '').replace(/\d{5,}/g, '#'), forma: s };
  });
  const tabelas = [...c.pages.values()].flatMap((p) =>
    p.tables.map((t) => ({ pagina: p.url.replace(/\?.*/, ''), cabecalho: t[0] ?? [], linhas: t.length })),
  );
  return JSON.stringify({ respostas: urls.slice(0, 60), tabelas: tabelas.slice(0, 30) }, null, 1);
}
