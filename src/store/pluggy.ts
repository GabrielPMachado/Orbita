/**
 * Estado da conferência com o Meu Pluggy. Só dados não sensíveis ficam aqui (AsyncStorage);
 * Client ID e Client Secret ficam no Keychain (lib/secrets.ts).
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BankTx } from '@/lib/reconcile';
import { storage } from '@/lib/storage';

export interface LinkedAccount {
  /** id da conta no Pluggy */
  id: string;
  itemId: string;
  name: string;
  bank: string;
  color?: string;
  kind: 'BANK' | 'CREDIT';
  balance: number;
  /** conta ou cartão do Órbita correspondente */
  localAccountId?: string;
  localCardId?: string;
  /** desligada = não entra na conferência */
  enabled: boolean;
}

interface PluggyState {
  configured: boolean;
  itemIds: string[];
  accounts: LinkedAccount[];
  /** extrato baixado na última sincronização */
  bankTxs: BankTx[];
  period?: { from: string; to: string };
  lastSync?: number;
  lastError?: string;
  autoSync: boolean;
  /** transações do banco que você mandou ignorar */
  ignored: string[];
  /** lançamentos do app que você confirmou que não vão aparecer no extrato (dinheiro vivo etc.) */
  localOk: string[];

  setConfigured: (v: boolean) => void;
  setItemIds: (ids: string[]) => void;
  mergeAccounts: (list: Omit<LinkedAccount, 'enabled' | 'localAccountId' | 'localCardId'>[]) => void;
  linkAccount: (id: string, link: { localAccountId?: string; localCardId?: string; enabled?: boolean }) => void;
  setSynced: (r: { bankTxs: BankTx[]; period: { from: string; to: string } }) => void;
  setError: (e?: string) => void;
  setAutoSync: (v: boolean) => void;
  ignore: (bankId: string) => void;
  unignore: (bankId: string) => void;
  markLocalOk: (txId: string) => void;
  reset: () => void;
}

const empty = { configured: false, itemIds: [], accounts: [], bankTxs: [], period: undefined, lastSync: undefined, lastError: undefined, ignored: [], localOk: [] };

export const usePluggy = create<PluggyState>()(
  persist(
    (set) => ({
      ...empty,
      autoSync: true,
      setConfigured: (configured) => set({ configured }),
      setItemIds: (itemIds) => set({ itemIds }),
      mergeAccounts: (list) =>
        set((s) => ({
          accounts: list.map((a) => {
            const prev = s.accounts.find((x) => x.id === a.id);
            return { ...a, enabled: prev?.enabled ?? true, localAccountId: prev?.localAccountId, localCardId: prev?.localCardId };
          }),
        })),
      linkAccount: (id, link) => set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...link } : a)) })),
      setSynced: ({ bankTxs, period }) => set({ bankTxs, period, lastSync: Date.now(), lastError: undefined }),
      setError: (lastError) => set({ lastError }),
      setAutoSync: (autoSync) => set({ autoSync }),
      ignore: (id) => set((s) => ({ ignored: [...s.ignored.filter((x) => x !== id), id].slice(-500) })),
      unignore: (id) => set((s) => ({ ignored: s.ignored.filter((x) => x !== id) })),
      markLocalOk: (id) => set((s) => ({ localOk: [...s.localOk.filter((x) => x !== id), id].slice(-500) })),
      reset: () => set({ ...empty }),
    }),
    { name: 'pluggy', storage },
  ),
);
