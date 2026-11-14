/**
 * Conferência com o extrato do banco (preparado para o Meu Pluggy / Open Finance).
 *
 * Ideia: as compras entram na hora pelo Apple Pay (rápido, com a categoria que você escolheu)
 * e depois o extrato oficial confirma. Cada transação do banco é casada com um lançamento
 * local pelo valor, data próxima e cartão/conta. O que casar vira "verificado"; o que só existe
 * no banco vira sugestão de lançamento (ex.: compra feita com o cartão físico).
 *
 * Ver src/lib/pluggy.ts para buscar o extrato.
 */
import type { Tx } from '@/store/finance';
import type { DateKey } from './date';
import { fromKey } from './date';
import { normalizeName } from './finance';

export interface BankTx {
  /** id da transação no Pluggy */
  id: string;
  date: DateKey;
  /** sempre positivo */
  amount: number;
  type: 'in' | 'out';
  description: string;
  /** id local da conta/cartão a que esta conta do banco corresponde (se já vinculada) */
  localAccountId?: string;
  localCardId?: string;
}

export interface ReconcileResult {
  /** pares (lançamento local, transação do banco) */
  matched: { tx: Tx; bank: BankTx; confidence: number }[];
  /** só no banco → sugerir criar */
  bankOnly: BankTx[];
  /** só no app, dentro do período conferido → possível erro de digitação ou ainda não compensado */
  localOnly: Tx[];
}

const daysBetween = (a: DateKey, b: DateKey) => Math.abs(fromKey(a).getTime() - fromKey(b).getTime()) / 86_400_000;

function score(tx: Tx, bank: BankTx): number {
  if (tx.type !== bank.type) return 0;
  if (Math.abs(tx.amount - bank.amount) > 0.01) return 0;
  const days = daysBetween(tx.date, bank.date);
  if (days > 3) return 0; // compras no cartão podem levar alguns dias para aparecer
  let s = 0.6 - days * 0.1;
  if (bank.localCardId && tx.cardId === bank.localCardId) s += 0.25;
  if (bank.localAccountId && tx.accountId === bank.localAccountId) s += 0.25;
  const a = normalizeName(tx.description);
  const b = normalizeName(bank.description);
  if (a && b && (a.includes(b) || b.includes(a) || a.split(' ')[0] === b.split(' ')[0])) s += 0.15;
  return Math.min(1, s);
}

export function reconcile(local: Tx[], bank: BankTx[], period: { from: DateKey; to: DateKey }): ReconcileResult {
  const candidates = local.filter((t) => t.date >= period.from && t.date <= period.to && !t.externalId);
  const used = new Set<string>();
  const matched: ReconcileResult['matched'] = [];
  const bankOnly: BankTx[] = [];

  // transações já importadas antes não entram de novo
  const known = new Set(local.map((t) => t.externalId).filter(Boolean));

  for (const b of [...bank].sort((x, y) => x.date.localeCompare(y.date))) {
    if (known.has(b.id)) continue;
    let best: { tx: Tx; s: number } | null = null;
    for (const t of candidates) {
      if (used.has(t.id)) continue;
      const s = score(t, b);
      if (s > 0 && (!best || s > best.s)) best = { tx: t, s };
    }
    if (best && best.s >= 0.4) {
      used.add(best.tx.id);
      matched.push({ tx: best.tx, bank: b, confidence: best.s });
    } else {
      bankOnly.push(b);
    }
  }
  const localOnly = candidates.filter((t) => !used.has(t.id) && !t.verified);
  return { matched, bankOnly, localOnly };
}
