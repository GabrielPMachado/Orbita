/**
 * Estácio sem API: o portal abre dentro do Órbita (WebView), você entra com seu login e o app lê
 * o que a própria página mostra/recebe. A senha não passa pelo Órbita nem fica salva — quem guarda
 * a sessão é o cookie do portal, como no Safari.
 *
 * Como o portal muda, a leitura é por padrões: listas de disciplinas e notas nas respostas JSON da
 * página e em tabelas; boletos pela linha digitável (lib/boleto).
 */
import { lerTexto, type BoletoInfo } from './boleto';

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
    send({ type: 'json', url: String(url).slice(0, 300), body: text });
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
    send({ type: 'page', url: location.href, title: document.title, text: (document.body && document.body.innerText || '').slice(0, 200000), tables: tables });
  };
  grab();
  if (!window.__orbitaTick) window.__orbitaTick = setInterval(grab, 3000);
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
const KEY_NOME = /^(nome_?disciplina|disciplina_?nome|disciplina|nomedisciplina|desc(ricao)?_?disciplina|nm_?disciplina|componente|nome_?componente)$/;
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
  json: { url: string; body: string }[];
  pages: Map<string, { url: string; title: string; text: string; tables: string[][][] }>;
  pdfs: { url: string; b64: string }[];
}
export const novaCaptura = (): Captura => ({ json: [], pages: new Map(), pdfs: [] });

export function analisar(c: Captura, extraTexto: string[] = []): { disciplinas: Disciplina[]; boletos: BoletoInfo[] } {
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
  return { disciplinas, boletos };
}

/** Só a forma dos dados (chaves e tipos, sem valores) — para ajustar a leitura sem expor nada seu. */
export function formato(c: Captura) {
  const shape = (v: unknown, d = 0): unknown => {
    if (d > 5) return '…';
    if (Array.isArray(v)) return v.length ? [shape(v[0], d + 1)] : [];
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as object).slice(0, 40).map(([k, x]) => [k, shape(x, d + 1)]));
    return typeof v;
  };
  const urls = c.json.map((j) => {
    let s: unknown = '?';
    try {
      s = shape(JSON.parse(j.body));
    } catch {}
    return { url: j.url.replace(/\?.*/, '').replace(/\d{5,}/g, '#'), forma: s };
  });
  const tabelas = [...c.pages.values()].flatMap((p) => p.tables.map((t) => ({ pagina: p.url.replace(/\?.*/, ''), cabecalho: t[0] ?? [], linhas: t.length })));
  return JSON.stringify({ respostas: urls.slice(0, 60), tabelas: tabelas.slice(0, 30) }, null, 1);
}
