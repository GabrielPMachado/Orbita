/**
 * Leitura de boletos: linha digitável (47 ou 48 dígitos), código de barras (44), Pix copia e cola,
 * e texto solto (PDF, foto, e-mail) — tira valor, vencimento, banco e beneficiário quando dá.
 *
 * Regras da Febraban:
 *  - boleto bancário: barras = banco(3) moeda(1) DV(1) fator(4) valor(10) campo livre(25);
 *    a linha digitável reorganiza isso em 5 campos com DVs módulo 10;
 *  - arrecadação/convênio (começa com 8: luz, água, impostos): 4 blocos de 11 + DV;
 *  - o fator de vencimento chegou a 9999 em 21/02/2025 e recomeçou em 1000 em 22/02/2025.
 */

export interface BoletoInfo {
  tipo: 'bancario' | 'arrecadacao' | 'pix';
  /** código de barras (44) — vazio no Pix */
  barras?: string;
  /** linha digitável formatada */
  linha?: string;
  /** Pix copia e cola */
  pix?: string;
  valor?: number;
  vencimento?: string; // AAAA-MM-DD
  banco?: string;
  beneficiario?: string;
  /** os dígitos verificadores batem */
  valido: boolean;
}

const BANCOS: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '041': 'Banrisul',
  '077': 'Inter',
  '104': 'Caixa',
  '133': 'Cresol',
  '136': 'Unicred',
  '208': 'BTG Pactual',
  '212': 'Original',
  '237': 'Bradesco',
  '260': 'Nubank',
  '290': 'PagBank',
  '323': 'Mercado Pago',
  '336': 'C6 Bank',
  '341': 'Itaú',
  '380': 'PicPay',
  '389': 'Mercantil',
  '422': 'Safra',
  '655': 'Votorantim',
  '707': 'Daycoval',
  '745': 'Citibank',
  '748': 'Sicredi',
  '756': 'Sicoob',
};
const SEGMENTOS: Record<string, string> = {
  '1': 'Prefeitura',
  '2': 'Saneamento',
  '3': 'Energia e gás',
  '4': 'Telecomunicações',
  '5': 'Órgão público',
  '6': 'Convênio',
  '7': 'Multa de trânsito',
  '9': 'Uso exclusivo do banco',
};

/* ---------- dígitos verificadores ---------- */

export function mod10(n: string) {
  let sum = 0;
  let w = 2;
  for (let i = n.length - 1; i >= 0; i--) {
    let p = Number(n[i]) * w;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    sum += p;
    w = w === 2 ? 1 : 2;
  }
  const r = sum % 10;
  return r === 0 ? 0 : 10 - r;
}
/** módulo 11 do boleto bancário (pesos 2–9; resultado 0, 10 ou 11 vira 1) */
export function mod11Banco(n: string) {
  let sum = 0;
  let w = 2;
  for (let i = n.length - 1; i >= 0; i--) {
    sum += Number(n[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const d = 11 - (sum % 11);
  return d === 0 || d === 10 || d === 11 ? 1 : d;
}
/** módulo 11 da arrecadação (0 ou 1 de resto → 0; 10 → 1 em alguns convênios: trata como 0) */
function mod11Arrec(n: string) {
  let sum = 0;
  let w = 2;
  for (let i = n.length - 1; i >= 0; i--) {
    sum += Number(n[i]) * w;
    w = w === 9 ? 2 : w + 1;
  }
  const r = sum % 11;
  return r === 0 || r === 1 ? 0 : r === 10 ? 1 : 11 - r;
}

/* ---------- datas ---------- */

const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
/** fator → data; escolhe o ciclo (antigo ou novo) mais perto de hoje */
export function fatorParaData(fator: number, hoje = Date.now()): string | undefined {
  if (!fator) return undefined;
  const antigo = Date.UTC(1997, 9, 7) + fator * DAY;
  const novo = Date.UTC(2025, 1, 22) + (fator - 1000) * DAY;
  if (fator < 1000) return iso(antigo);
  return Math.abs(novo - hoje) < Math.abs(antigo - hoje) ? iso(novo) : iso(antigo);
}

/* ---------- conversões ---------- */

const digits = (s: string) => s.replace(/\D/g, '');

function linhaBancariaParaBarras(l: string) {
  return l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31);
}
function barrasBancariaParaLinha(b: string) {
  const c1 = b.slice(0, 4) + b.slice(19, 24);
  const c2 = b.slice(24, 34);
  const c3 = b.slice(34, 44);
  return `${c1}${mod10(c1)}${c2}${mod10(c2)}${c3}${mod10(c3)}${b[4]}${b.slice(5, 19)}`;
}
function formatLinhaBancaria(l: string) {
  return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`;
}
function formatLinhaArrec(l: string) {
  return [0, 12, 24, 36].map((i) => `${l.slice(i, i + 11)}-${l[i + 11]}`).join(' ');
}

function bancario(barras: string, hoje?: number): BoletoInfo {
  const dv = mod11Banco(barras.slice(0, 4) + barras.slice(5));
  const fator = Number(barras.slice(5, 9));
  const valor = Number(barras.slice(9, 19)) / 100;
  const linha = barrasBancariaParaLinha(barras);
  return {
    tipo: 'bancario',
    barras,
    linha: formatLinhaBancaria(linha),
    valor: valor || undefined,
    vencimento: fatorParaData(fator, hoje),
    banco: BANCOS[barras.slice(0, 3)] ?? `Banco ${barras.slice(0, 3)}`,
    valido: dv === Number(barras[4]),
  };
}

function arrecadacao(barras: string): BoletoInfo {
  const ref = barras[2];
  const dvFn = ref === '6' || ref === '7' ? mod10 : mod11Arrec;
  const dv = dvFn(barras.slice(0, 3) + barras.slice(4));
  const reais = ref === '6' || ref === '8';
  const valor = reais ? Number(barras.slice(4, 15)) / 100 : undefined;
  const blocos = [0, 11, 22, 33].map((i) => barras.slice(i, i + 11));
  const linha = blocos.map((b) => b + dvFn(b)).join('');
  // muitos convênios põem a data AAAAMMDD logo no começo do campo livre
  const livre = barras.slice(19);
  const m = /^(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/.exec(livre);
  return {
    tipo: 'arrecadacao',
    barras,
    linha: formatLinhaArrec(linha),
    valor: valor || undefined,
    vencimento: m ? `${m[1]}-${m[2]}-${m[3]}` : undefined,
    banco: SEGMENTOS[barras[1]],
    valido: dv === Number(barras[3]),
  };
}

/** Lê um código já isolado: linha digitável, código de barras ou Pix copia e cola. */
export function lerCodigo(raw: string, hoje?: number): BoletoInfo | null {
  const t = raw.trim();
  if (/^000201/.test(t)) return lerPix(t);
  const d = digits(t);
  if (d.length === 44) return d[0] === '8' ? arrecadacao(d) : bancario(d, hoje);
  if (d.length === 47 && d[0] !== '8') {
    const info = bancario(linhaBancariaParaBarras(d), hoje);
    const camposOk = [d.slice(0, 9), d.slice(10, 20), d.slice(21, 31)].every((c, i) => mod10(c) === Number(d[[9, 20, 31][i]]));
    return { ...info, valido: info.valido && camposOk };
  }
  if (d.length === 48 && d[0] === '8') {
    const barras = [0, 12, 24, 36].map((i) => d.slice(i, i + 11)).join('');
    return arrecadacao(barras);
  }
  return null;
}

/* ---------- Pix (BR Code / EMV) ---------- */

function tlv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= s.length) {
    const id = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!Number.isFinite(len)) break;
    out[id] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}
export function lerPix(code: string): BoletoInfo | null {
  const f = tlv(code.trim());
  if (f['00'] !== '01') return null;
  const valor = f['54'] ? Number(f['54']) : undefined;
  return { tipo: 'pix', pix: code.trim(), valor: valor || undefined, beneficiario: f['59'] || undefined, valido: true };
}

/* ---------- texto solto (PDF, foto, e-mail) ---------- */

const RE_LINHA_BANC = /\b(\d{5})[.\s]?(\d{5})\s*(\d{5})[.\s]?(\d{6})\s*(\d{5})[.\s]?(\d{6})\s*(\d)\s*(\d{14})\b/g;
const RE_LINHA_ARREC = /\b(8\d{10})[-\s]?(\d)\s*(\d{11})[-\s]?(\d)\s*(\d{11})[-\s]?(\d)\s*(\d{11})[-\s]?(\d)\b/g;
const RE_PIX = /000201[0-9A-Za-z.@:/\-_*+ ]{30,}?6304[0-9A-F]{4}/g;

/** Procura boletos num texto qualquer e completa com vencimento/valor/beneficiário escritos no documento. */
export function lerTexto(text: string, codigos: string[] = [], hoje?: number): BoletoInfo[] {
  const found: BoletoInfo[] = [];
  const seen = new Set<string>();
  const push = (b: BoletoInfo | null) => {
    if (!b) return;
    const k = b.barras ?? b.pix ?? '';
    if (!k || seen.has(k)) return;
    seen.add(k);
    found.push(b);
  };
  // códigos lidos da imagem (barras/QR) primeiro: são os mais confiáveis
  for (const c of codigos) push(lerCodigo(c, hoje));
  const flat = text.replace(/ /g, ' ');
  for (const m of flat.matchAll(RE_LINHA_BANC)) push(lerCodigo(m.slice(1).join(''), hoje));
  for (const m of flat.matchAll(RE_LINHA_ARREC)) push(lerCodigo(m.slice(1).join(''), hoje));
  for (const m of flat.replace(/\s+/g, '').matchAll(RE_PIX)) push(lerPix(m[0]));

  // dados escritos no documento ajudam quando o código não traz (arrecadação, Pix)
  const venc = /vencimento[^\d]{0,30}(\d{2})\/(\d{2})\/(\d{4})/i.exec(flat);
  const valorTxt = /(?:valor\s+(?:do\s+)?(?:documento|cobrado|a\s+pagar|total)|total\s+a\s+pagar)[^\d]{0,30}(\d{1,3}(?:\.\d{3})*,\d{2})/i.exec(flat);
  const benef = /(?:benefici[aá]rio|cedente)\s*:?\s*\n?\s*([A-ZÀ-Ú0-9][^\n\r]{3,60})/i.exec(flat);
  const vencIso = venc ? `${venc[3]}-${venc[2]}-${venc[1]}` : undefined;
  const valorNum = valorTxt ? Number(valorTxt[1].replace(/\./g, '').replace(',', '.')) : undefined;
  const nome = benef?.[1]
    .replace(/\s{2,}.*/, '')
    .replace(/\s*(CNPJ|CPF).*/i, '')
    .trim();
  return found.map((b) => ({
    ...b,
    vencimento: b.vencimento ?? vencIso,
    valor: b.valor ?? valorNum,
    beneficiario: b.beneficiario ?? (nome || undefined),
  }));
}
