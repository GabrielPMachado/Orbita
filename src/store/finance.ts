import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { addMonths } from '@/lib/finance';
import { storage, uid } from '@/lib/storage';
import { today, type DateKey } from '@/lib/date';

export type TxType = 'in' | 'out';
export type AccountKind = 'corrente' | 'poupanca' | 'carteira' | 'investimento';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** saldo na data em que a conta foi cadastrada */
  initial: number;
  color: string;
}

export interface Card {
  id: string;
  name: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  color: string;
}

export interface Tx {
  id: string;
  type: TxType;
  amount: number;
  category: string;
  description: string;
  date: DateKey;
  accountId?: string;
  cardId?: string;
  /** pago/recebido (lançamentos futuros nascem como pendentes) */
  paid: boolean;
  /** lançamentos criados juntos (parcelas ou fixos) compartilham o grupo */
  group?: string;
  installment?: { n: number; total: number };
  fixed?: boolean;
  notes?: string;
  attachments: string[];
  createdAt: number;
  /** de onde veio: digitado, automação do Apple Pay ou Open Finance (Meu Pluggy) */
  source?: TxSource;
  /** conferido com o extrato do banco (Open Finance) */
  verified?: boolean;
  /** id da transação no banco/Pluggy, para não importar duas vezes */
  externalId?: string;
  /** Financy como base: coleção do documento lá (despesas/receitas/investimentos) */
  fyCol?: FyCol;
}

export type FyCol = 'despesas' | 'receitas' | 'investimentos';
export type FinanceBase = 'orbita' | 'financy';

export type TxSource = 'manual' | 'applepay' | 'pluggy';

export interface NewTx {
  type: TxType;
  amount: number;
  category: string;
  description: string;
  date: DateKey;
  accountId?: string;
  cardId?: string;
  notes?: string;
  attachments?: string[];
  /** compra parcelada no cartão: valor total dividido em N */
  installments?: number;
  /** repetir todo mês por N meses (contas fixas, salário…) */
  repeatMonths?: number;
  source?: TxSource;
  externalId?: string;
  verified?: boolean;
}

interface FinanceState {
  /** onde moram os lançamentos: aqui no aparelho ou no Financy */
  base: FinanceBase;
  /** cópia do que era do Órbita antes de virar Financy (volta se desligar) */
  localBackup?: { txs: Tx[]; accounts: Account[]; cards: Card[] };
  /** exclusões ainda não enviadas ao Financy */
  /** categorias do Financy (nome + tipo + cor) */
  fyCategories: { name: string; type: 'in' | 'out'; color?: string }[];
  setBase: (b: FinanceBase) => void;
  /** troca a lista inteira pelo espelho do Financy (mantém fotos, notas e conferência do banco feitas aqui) */
  applyMirror: (m: { txs: Tx[]; cards: Card[]; categories: FinanceState['fyCategories'] }) => void;
  txs: Tx[];
  accounts: Account[];
  cards: Card[];
  budgets: Record<string, number>;
  /** ids de invocações da automação já processadas (evita duplicar) */
  processedIntents: string[];
  /** últimas compras recebidas do Atalhos, cruas (diagnóstico) */
  intentLog: { at: number; valor: string; estabelecimento: string; cartao: string; categoria: string; ok: boolean }[];
  logIntent: (e: FinanceState['intentLog'][number]) => void;

  addTx: (t: NewTx) => void;
  markIntentProcessed: (id: string) => void;
  updateTx: (id: string, patch: Partial<Tx>) => void;

  addAccount: (a: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  removeAccount: (id: string) => void;

  addCard: (c: Omit<Card, 'id'>) => void;
  updateCard: (id: string, patch: Partial<Card>) => void;
  removeCard: (id: string) => void;

  setBudget: (category: string, value?: number) => void;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export const useFinance = create<FinanceState>()(
  persist(
    (set, get) => ({
      base: 'orbita',
      fyCategories: [],
      setBase: (b) =>
        set((s) => {
          if (b === s.base) return {};
          if (b === 'financy')
            return { base: b, localBackup: { txs: s.txs, accounts: s.accounts, cards: s.cards }, txs: [], accounts: [], cards: [] };
          const bk = s.localBackup;
          return { base: b, txs: bk?.txs ?? [], accounts: bk?.accounts ?? [], cards: bk?.cards ?? [], localBackup: undefined };
        }),
      applyMirror: ({ txs, cards, categories }) =>
        set((s) => {
          if (s.base !== 'financy') return {};
          const local = new Map(s.txs.map((t) => [t.id, t]));
          // fotos, notas e a conferência com o banco só existem aqui no aparelho
          const merged = txs.map((t) => {
            const mine = local.get(t.id);
            return mine
              ? {
                  ...t,
                  attachments: mine.attachments,
                  notes: mine.notes ?? t.notes,
                  verified: mine.verified ?? t.verified,
                  externalId: mine.externalId ?? t.externalId,
                }
              : t;
          });
          const remoteIds = new Set(txs.map((t) => t.id));
          // importadas do banco aqui (não vieram do Financy) continuam
          const onlyHere = s.txs.filter((t) => !t.fyCol && !remoteIds.has(t.id));
          return { txs: [...onlyHere, ...merged], cards, fyCategories: categories };
        }),
      txs: [],
      accounts: [],
      cards: [],
      budgets: {},
      processedIntents: [],
      intentLog: [],
      logIntent: (e) => set((st) => ({ intentLog: [e, ...st.intentLog].slice(0, 10) })),

      markIntentProcessed: (id) => set((s) => ({ processedIntents: [...s.processedIntents.slice(-299), id] })),

      addTx: (t) => {
        const now = Date.now();
        const t0 = today();
        const base = {
          type: t.type,
          category: t.category,
          accountId: t.cardId ? undefined : t.accountId,
          cardId: t.cardId,
          notes: t.notes,
          createdAt: now,
          source: t.source ?? 'manual',
          externalId: t.externalId,
          verified: t.verified,
        };
        const out: Tx[] = [];
        const n = Math.max(1, Math.floor(t.installments ?? 1));
        const r = Math.max(1, Math.floor(t.repeatMonths ?? 1));

        if (n > 1) {
          const group = uid();
          const part = round2(t.amount / n);
          for (let i = 0; i < n; i++) {
            // a última parcela absorve a diferença de centavos
            const amount = i === n - 1 ? round2(t.amount - part * (n - 1)) : part;
            const date = addMonths(t.date, i);
            out.push({
              ...base,
              id: uid(),
              amount,
              date,
              description: t.description,
              group,
              installment: { n: i + 1, total: n },
              paid: date <= t0,
              attachments: i === 0 ? (t.attachments ?? []) : [],
            });
          }
        } else if (r > 1) {
          const group = uid();
          for (let i = 0; i < r; i++) {
            const date = addMonths(t.date, i);
            out.push({
              ...base,
              id: uid(),
              amount: t.amount,
              date,
              description: t.description,
              group,
              fixed: true,
              paid: date <= t0,
              attachments: i === 0 ? (t.attachments ?? []) : [],
            });
          }
        } else {
          out.push({
            ...base,
            id: uid(),
            amount: t.amount,
            date: t.date,
            description: t.description,
            paid: t.date <= t0,
            attachments: t.attachments ?? [],
          });
        }
        set((s) => ({ txs: [...out, ...s.txs] }));
      },

      updateTx: (id, patch) => set((s) => ({ txs: s.txs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

      addAccount: (a) => set((s) => ({ accounts: [...s.accounts, { ...a, id: uid() }] })),
      updateAccount: (id, patch) => set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      removeAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          txs: s.txs.map((t) => (t.accountId === id ? { ...t, accountId: undefined } : t)),
        })),

      addCard: (c) => set((s) => ({ cards: [...s.cards, { ...c, id: uid() }] })),
      updateCard: (id, patch) => set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      removeCard: (id) =>
        set((s) => ({ cards: s.cards.filter((c) => c.id !== id), txs: s.txs.map((t) => (t.cardId === id ? { ...t, cardId: undefined } : t)) })),

      setBudget: (category, value) =>
        set((s) => {
          const budgets = { ...s.budgets };
          if (value && value > 0) budgets[category] = value;
          else delete budgets[category];
          return { budgets };
        }),
    }),
    {
      name: 'finance',
      storage,
      version: 2,
      // v0 só tinha `txs` simples
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Partial<FinanceState>;
        if (version < 1) {
          return {
            txs: (p.txs ?? []).map((t) => ({ ...t, paid: true, attachments: [], createdAt: Date.now() })),
            accounts: [],
            cards: [],
            budgets: {},
            processedIntents: [],
          } as unknown as FinanceState;
        }
        return { processedIntents: [], intentLog: [], base: 'orbita', fyCategories: [], ...p } as FinanceState;
      },
    },
  ),
);
