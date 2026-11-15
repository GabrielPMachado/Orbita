import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';

export interface FinancySummary {
  saldo: number;
  entradasMes: number;
  gastosMes: number;
  pendentesTotal: number;
  /** ISO, quando o Financy gerou o resumo */
  atualizadoEm?: string;
  /** quando o Órbita leu */
  lidoEm: number;
}

/** compra do Apple Pay a caminho do Financy */
export interface FinancyHint {
  id: string;
  valor: number;
  data: string;
  hora?: string;
  estabelecimento?: string;
  cartao?: string;
  categoria: string;
  at: number;
}

interface FinancyLinkState {
  connected: boolean;
  summary?: FinancySummary;
  lastError?: string;
  /** manda a categoria das compras do Apple Pay para o Financy */
  forwardApplePay: boolean;
  /** o widget de saldo mostra o saldo do Financy */
  widgetFromFinancy: boolean;
  pendingHints: FinancyHint[];
  setConnected: (v: boolean) => void;
  setSummary: (s: FinancySummary) => void;
  setError: (e?: string) => void;
  setForward: (v: boolean) => void;
  setWidgetFromFinancy: (v: boolean) => void;
  queueHint: (h: FinancyHint) => void;
  dropHint: (id: string) => void;
  reset: () => void;
}

export const useFinancyLink = create<FinancyLinkState>()(
  persist(
    (set) => ({
      connected: false,
      forwardApplePay: true,
      widgetFromFinancy: true,
      pendingHints: [],
      setConnected: (connected) => set({ connected }),
      setSummary: (summary) => set({ summary }),
      setError: (lastError) => set({ lastError }),
      setForward: (forwardApplePay) => set({ forwardApplePay }),
      setWidgetFromFinancy: (widgetFromFinancy) => set({ widgetFromFinancy }),
      queueHint: (h) => set((s) => ({ pendingHints: [...s.pendingHints.filter((x) => x.id !== h.id), h].slice(-50) })),
      dropHint: (id) => set((s) => ({ pendingHints: s.pendingHints.filter((x) => x.id !== id) })),
      reset: () => set({ connected: false, summary: undefined, lastError: undefined, pendingHints: [] }),
    }),
    { name: 'financy-link', storage },
  ),
);
