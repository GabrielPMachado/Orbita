import {
  BookOpen,
  Briefcase,
  Bus,
  CircleEllipsis,
  Dog,
  Gift,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Plane,
  Popcorn,
  Receipt,
  Repeat,
  RotateCcw,
  Shirt,
  ShoppingCart,
  TrendingUp,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import type { Account, Card, Tx, TxType } from '@/store/finance';
import { today, type DateKey } from './date';

/* ---------- Categorias ---------- */
export interface Category {
  name: string;
  icon: LucideIcon;
  color: string;
}

export const CATEGORIES: Record<TxType, Category[]> = {
  out: [
    { name: 'Alimentação', icon: Utensils, color: '#F59E0B' },
    { name: 'Mercado', icon: ShoppingCart, color: '#22C55E' },
    { name: 'Transporte', icon: Bus, color: '#3B82F6' },
    { name: 'Moradia', icon: House, color: '#A78BFA' },
    { name: 'Contas', icon: Zap, color: '#EAB308' },
    { name: 'Lazer', icon: Popcorn, color: '#EC4899' },
    { name: 'Saúde', icon: HeartPulse, color: '#EF4444' },
    { name: 'Educação', icon: BookOpen, color: '#06B6D4' },
    { name: 'Assinaturas', icon: Repeat, color: '#8B5CF6' },
    { name: 'Compras', icon: Shirt, color: '#F97316' },
    { name: 'Pets', icon: Dog, color: '#84CC16' },
    { name: 'Viagem', icon: Plane, color: '#0EA5E9' },
    { name: 'Presentes', icon: Gift, color: '#F43F5E' },
    { name: 'Impostos', icon: Receipt, color: '#94A3B8' },
    { name: 'Outros', icon: CircleEllipsis, color: '#64748B' },
  ],
  in: [
    { name: 'Salário', icon: Briefcase, color: '#34C77B' },
    { name: 'Freela', icon: Laptop, color: '#2DD4BF' },
    { name: 'Pix recebido', icon: Landmark, color: '#22D3EE' },
    { name: 'Investimentos', icon: TrendingUp, color: '#A3E635' },
    { name: 'Reembolso', icon: RotateCcw, color: '#60A5FA' },
    { name: 'Outros', icon: CircleEllipsis, color: '#64748B' },
  ],
};

const ALL = [...CATEGORIES.out, ...CATEGORIES.in];
export const category = (name: string, type?: TxType): Category =>
  (type ? CATEGORIES[type] : ALL).find((c) => c.name === name) ?? { name, icon: CircleEllipsis, color: '#64748B' };

export const ACCOUNT_COLORS = ['#8B5CF6', '#F97316', '#22C55E', '#3B82F6', '#EC4899', '#EAB308', '#06B6D4', '#94A3B8'];
export const ACCOUNT_KINDS = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  carteira: 'Carteira',
  investimento: 'Investimento',
} as const;

/* ---------- Datas por mês ---------- */
export type MonthKey = string; // "AAAA-MM"
export const monthOf = (d: DateKey): MonthKey => d.slice(0, 7);
export const thisMonth = () => monthOf(today());

export function addMonths(d: DateKey, n: number): DateKey {
  const [y, m, day] = d.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const dd = Math.min(day, last);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
export const addMonthKey = (k: MonthKey, n: number) => monthOf(addMonths(k + '-01', n));

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const monthName = (k: MonthKey, short = false) => {
  const [y, m] = k.split('-').map(Number);
  const n = MONTHS[m - 1];
  return short ? n.slice(0, 3) : `${n} ${y}`;
};

/* ---------- Cartão de crédito ---------- */
/** Mês em que a fatura com essa compra VENCE. */
export function invoiceMonth(date: DateKey, card: Card): MonthKey {
  const day = Number(date.slice(8, 10));
  // compra depois do fechamento entra na fatura seguinte
  let closing = day > card.closingDay ? addMonthKey(monthOf(date), 1) : monthOf(date);
  // vencimento antes (ou no) dia do fechamento cai no mês seguinte ao fechamento
  if (card.dueDay <= card.closingDay) closing = addMonthKey(closing, 1);
  return closing;
}

export function invoice(txs: Tx[], card: Card, month: MonthKey) {
  const items = txs.filter((t) => t.cardId === card.id && t.type === 'out' && invoiceMonth(t.date, card) === month);
  const total = items.reduce((a, t) => a + t.amount, 0);
  return { items: items.sort((a, b) => b.date.localeCompare(a.date)), total };
}

/** Limite comprometido: tudo que ainda não venceu (fatura atual + futuras). */
export function cardUsed(txs: Tx[], card: Card) {
  const now = thisMonth();
  return txs
    .filter((t) => t.cardId === card.id && t.type === 'out' && invoiceMonth(t.date, card) >= now)
    .reduce((a, t) => a + t.amount, 0);
}

/** Mês em que o lançamento pesa no caixa (cartão: no vencimento da fatura). */
export function cashMonth(t: Tx, cards: Card[]): MonthKey {
  if (t.cardId) {
    const card = cards.find((c) => c.id === t.cardId);
    if (card) return invoiceMonth(t.date, card);
  }
  return monthOf(t.date);
}

/* ---------- Saldos ---------- */
const signed = (t: Tx) => (t.type === 'in' ? t.amount : -t.amount);

/** Saldo de uma conta considerando só o que já foi pago/recebido. */
export function accountBalance(account: Account, txs: Tx[]) {
  return account.initial + txs.filter((t) => t.accountId === account.id && t.paid).reduce((a, t) => a + signed(t), 0);
}

/** Saldo atual = saldo inicial das contas + tudo pago até hoje (fora do cartão). */
export function currentBalance(accounts: Account[], txs: Tx[]) {
  const initial = accounts.reduce((a, c) => a + c.initial, 0);
  return initial + txs.filter((t) => t.paid && !t.cardId).reduce((a, t) => a + signed(t), 0);
}

/**
 * Saldo acumulado previsto no fim do mês: saldo inicial + todo lançamento
 * cujo efeito no caixa (cartão = mês da fatura) acontece até aquele mês.
 */
export function projectedBalance(accounts: Account[], txs: Tx[], cards: Card[], month: MonthKey) {
  const initial = accounts.reduce((a, c) => a + c.initial, 0);
  return initial + txs.filter((t) => cashMonth(t, cards) <= month).reduce((a, t) => a + signed(t), 0);
}

export function monthTotals(txs: Tx[], month: MonthKey) {
  const list = txs.filter((t) => monthOf(t.date) === month);
  const income = list.filter((t) => t.type === 'in').reduce((a, t) => a + t.amount, 0);
  const expense = list.filter((t) => t.type === 'out').reduce((a, t) => a + t.amount, 0);
  const pending = list.filter((t) => !t.paid && t.type === 'out').reduce((a, t) => a + t.amount, 0);
  return { list, income, expense, pending, net: income - expense };
}

export function byCategory(txs: Tx[], month: MonthKey) {
  const map: Record<string, number> = {};
  txs.filter((t) => t.type === 'out' && monthOf(t.date) === month).forEach((t) => (map[t.category] = (map[t.category] ?? 0) + t.amount));
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

/* ---------- Valores ---------- */
export const parseMoney = (s: string) => Number(s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;

export function txLabel(t: Tx) {
  const base = t.description || t.category;
  return t.installment ? `${base} (${t.installment.n}/${t.installment.total})` : base;
}

/**
 * Lê valores em qualquer formato que o Atalhos possa mandar:
 * "R$ 1.234,56", "1234,56", "1,234.56", "25.9", "25".
 */
export function parseAmount(raw: string): number {
  const s = String(raw).replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    // o separador que aparece por último é o decimal
    normalized = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0) {
    const decimals = s.length - lastDot - 1;
    // "1.234" (milhar) × "12.5" / "12.50" (decimal)
    normalized = decimals === 3 && s.indexOf('.') === lastDot ? s.replace('.', '') : s.replace(/\.(?=.*\.)/g, '');
  } else {
    normalized = s;
  }
  return Math.abs(Number(normalized)) || 0;
}

export const normalizeName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Saldo de verdade: com o Financy como base, o saldo é o dele (ele conhece as contas);
 * no modo local, saldo inicial das contas + lançamentos pagos fora do cartão.
 */
export function balanceFor(base: 'orbita' | 'financy', accounts: Account[], txs: Tx[], financySaldo?: number) {
  return base === 'financy' && financySaldo !== undefined ? financySaldo : currentBalance(accounts, txs);
}

/** Categorias para escolher: as do Órbita + as criadas no Financy (quando ele é a base). */
export function categoryOptions(type: TxType, extra: { name: string; type: TxType; color?: string }[] = []): Category[] {
  const own = CATEGORIES[type];
  const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const known = new Set(own.map((c) => norm(c.name)));
  const more = extra
    .filter((c) => c.type === type && !known.has(norm(c.name)))
    .map((c) => ({ ...category(c.name), color: c.color && /^#/.test(c.color) ? c.color : '#64748B' }));
  return [...own, ...more];
}
