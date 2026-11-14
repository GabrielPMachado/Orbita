/**
 * Cliente mínimo da API do Pluggy para uso pessoal com o Meu Pluggy.
 * Usado por lib/pluggySync.ts; as telas ficam em app/financas/pluggy.tsx e conferencia.tsx.
 *
 * Passo a passo (docs.pluggy.ai → "Personal use with Meu Pluggy"):
 *  1. Conecte os bancos em meu.pluggy.ai
 *  2. No Pluggy Dashboard → Applications → sua aplicação → Demo → Connect Account → MeuPluggy
 *  3. Copie Client ID, Client Secret e o itemId de cada banco
 *  4. POST /auth { clientId, clientSecret } → apiKey  (header X-API-KEY nas próximas chamadas)
 *  5. GET /accounts?itemId=…  e  GET /transactions?accountId=…
 *
 * Uso pessoal é gratuito, até 5 conexões; a autorização dura 1 ano.
 * As credenciais devem ficar no expo-secure-store (Keychain), nunca no código.
 */
import type { BankTx } from './reconcile';

const API = 'https://api.pluggy.ai';

export interface PluggyCredentials {
  clientId: string;
  clientSecret: string;
}

async function call<T>(path: string, init: RequestInit & { apiKey?: string } = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.apiKey ? { 'X-API-KEY': init.apiKey } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new PluggyError('Credenciais recusadas pelo Pluggy. Confira o Client ID e o Client Secret.', res.status);
    if (res.status === 404) throw new PluggyError('Conexão não encontrada. Confira o Item ID.', res.status);
    if (res.status === 429) throw new PluggyError('Muitas consultas seguidas. Tente de novo em alguns minutos.', res.status);
    throw new PluggyError(`O Pluggy respondeu com erro ${res.status}.`, res.status);
  }
  return res.json() as Promise<T>;
}

export class PluggyError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

export async function authenticate(c: PluggyCredentials): Promise<string> {
  const r = await call<{ apiKey: string }>('/auth', { method: 'POST', body: JSON.stringify(c) });
  return r.apiKey;
}

export interface PluggyAccount {
  id: string;
  name: string;
  marketingName?: string | null;
  number?: string;
  type: 'BANK' | 'CREDIT' | string;
  subtype?: string;
  balance: number;
  itemId: string;
}

export interface PluggyItem {
  id: string;
  status: string; // UPDATED | UPDATING | LOGIN_ERROR | OUTDATED ...
  updatedAt?: string;
  connector?: { name: string; primaryColor?: string };
}

export async function getItem(apiKey: string, itemId: string) {
  return call<PluggyItem>(`/items/${encodeURIComponent(itemId)}`, { apiKey });
}

export async function listAccounts(apiKey: string, itemId: string) {
  const r = await call<{ results: PluggyAccount[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`, { apiKey });
  return r.results;
}

interface PluggyTransaction {
  id: string;
  date: string; // ISO
  amount: number;
  description: string;
  type?: 'DEBIT' | 'CREDIT';
}

/** Busca as transações de uma conta no período e converte para o formato da conferência. */
export async function listTransactions(
  apiKey: string,
  accountId: string,
  from: string,
  to: string,
  link: { localAccountId?: string; localCardId?: string } = {},
): Promise<BankTx[]> {
  const out: BankTx[] = [];
  let page = 1;
  for (;;) {
    const q = `accountId=${encodeURIComponent(accountId)}&from=${from}&to=${to}&pageSize=500&page=${page}`;
    const r = await call<{ results: PluggyTransaction[]; totalPages: number }>(`/transactions?${q}`, { apiKey });
    for (const t of r.results) {
      const isOut = t.type ? t.type === 'DEBIT' : t.amount < 0;
      out.push({
        id: t.id,
        date: t.date.slice(0, 10),
        amount: Math.abs(t.amount),
        type: isOut ? 'out' : 'in',
        description: t.description,
        ...link,
      });
    }
    if (page >= (r.totalPages ?? 1)) break;
    page++;
  }
  return out;
}
