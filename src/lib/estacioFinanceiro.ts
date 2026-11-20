/**
 * Financeiro da Estácio (SIA → Informações Financeiras), mapeado em nov/2026.
 *
 * Cada cobrança é uma linha `.linha-base-financeiro`:
 *   Competência 12/2026 · R$ 376,10 · Dt. venc: 21/12/2026 (aberta) ou Dt. pgto: 07/11/2026 (paga)
 *   N.Número 2026949664698 · Valor · Valor Pago · Nome do Débito DBMENS
 * As abertas têm um botão "Pagar" com `data-ficha` (JSON) que já traz a linha digitável e o código
 * de barras — basta ler o atributo, sem tocar em nada.
 */

export const SIA_FINANCEIRO = 'https://sia.estacio.br/sianet/Aluno/InformacoesFinanceiras/Financeiro';

/** Injetado na página do financeiro: devolve cada linha (texto + ficha, se houver). */
export const FIN_JS = `
(function(){
  try {
    var rows = [].slice.call(document.querySelectorAll('.linha-base-financeiro')).map(function(r){
      var b = r.querySelector('[data-ficha]');
      var f = null;
      try { f = b ? JSON.parse(b.getAttribute('data-ficha')) : null; } catch(e) {}
      var ficha = f ? {
        Competencia: f.Competencia, NomeSituacao: f.NomeSituacao, SiglaIndTipoDebito: f.SiglaIndTipoDebito, DescricaoCarne: f.DescricaoCarne,
        DtVencimento: f.DtVencimento, ValorAPagar: f.ValorAPagar, ValorTitulo: f.ValorTitulo, NossoNumero: f.NossoNumero,
        NumLinhaDigitavel: f.NumLinhaDigitavel, CodigoBarra: f.CodigoBarra, CodigoBanco: f.CodigoBanco
      } : null;
      return { text: r.innerText, ficha: ficha };
    });
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'sia-fin', rows: rows, url: location.href }));
    return rows;
  } catch (e) { return []; }
})();
`;

export type FinRow = {
  text: string;
  ficha?: {
    Competencia?: string;
    NomeSituacao?: string;
    SiglaIndTipoDebito?: string;
    DescricaoCarne?: string;
    DtVencimento?: string;
    ValorAPagar?: number;
    ValorTitulo?: number;
    NossoNumero?: string;
    NumLinhaDigitavel?: string;
    CodigoBarra?: string;
    CodigoBanco?: string;
  } | null;
};

export interface Cobranca {
  /** nosso número (ou nº da negociação): chave para não duplicar */
  ref: string;
  competencia: string; // MM/AAAA
  tipo: string; // Mensalidade, Negociação, Renovação…
  valor?: number;
  vencimento?: string; // AAAA-MM-DD
  pagoEm?: string;
  valorPago?: number;
  situacao: 'aberta' | 'vencida' | 'paga' | 'sem-cobranca';
  linha?: string;
  barras?: string;
}

const TIPOS: Record<string, string> = { DBMENS: 'Mensalidade', DBCANEG: 'Negociação', DBRENOV: 'Renovação', DBNEG: 'Negociação', DBTAXA: 'Taxa' };
const money = (s?: string) => (s && /R\$/.test(s) ? Number(s.replace(/[^\d,]/g, '').replace(',', '.')) : undefined);
const iso = (d?: string) => (d && /^\d{2}\/\d{2}\/\d{4}$/.test(d) ? `${d.slice(6)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : undefined);

export function lerFinanceiro(rows: FinRow[], hoje = new Date().toISOString().slice(0, 10)): Cobranca[] {
  const out = new Map<string, Cobranca>();
  for (const r of rows) {
    const ls = r.text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const after = (label: string) => {
      const i = ls.findIndex((l) => l === label);
      return i >= 0 ? ls[i + 1] : undefined;
    };
    const competencia = r.ficha?.Competencia ?? after('Competência') ?? '';
    const ref = (r.ficha?.NossoNumero ?? after('N.Número, N.Cheque N.Negociação') ?? '').trim();
    if (!competencia || !ref) continue;
    const venc = /Dt\. venc:\s*(\d{2}\/\d{2}\/\d{4})/.exec(r.text)?.[1];
    const pgto = /Dt\. pgto:\s*(\d{2}\/\d{2}\/\d{4})/.exec(r.text)?.[1];
    const sigla = r.ficha?.SiglaIndTipoDebito ?? after('Nome do Débito') ?? '';
    const valor = r.ficha?.ValorAPagar ?? r.ficha?.ValorTitulo ?? money(after('Valor'));
    const valorPago = money(after('Valor Pago'));
    const vencimento = r.ficha?.DtVencimento?.slice(0, 10) ?? iso(venc);
    const pagoEm = iso(pgto);
    // "Dt. pgto" sem valor pago = cobrança renegociada/cancelada (entrou noutra), não é dívida
    const situacao: Cobranca['situacao'] = pagoEm ? (valorPago ? 'paga' : 'sem-cobranca') : vencimento && vencimento < hoje ? 'vencida' : 'aberta';
    out.set(ref, {
      ref,
      competencia,
      tipo:
        TIPOS[sigla] ??
        (r.ficha?.DescricaoCarne ? r.ficha.DescricaoCarne.charAt(0) + r.ficha.DescricaoCarne.slice(1).toLowerCase() : sigla || 'Cobrança'),
      valor,
      vencimento,
      pagoEm,
      valorPago,
      situacao,
      linha: r.ficha?.NumLinhaDigitavel || undefined,
      barras: r.ficha?.CodigoBarra || undefined,
    });
  }
  return [...out.values()].sort((a, b) => (b.vencimento ?? b.pagoEm ?? '').localeCompare(a.vencimento ?? a.pagoEm ?? ''));
}
