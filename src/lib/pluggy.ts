/**
 * Cliente mínimo da API do Pluggy para uso pessoal com o Meu Pluggy.
 * Usado por lib/pluggySync.ts; as telas ficam em app/financas/pluggy.tsx e conferencia.tsx.
 *
 * Passo a passo (docs.pluggy.ai → "Personal use with Meu Pluggy"):
 *  1. Conecte os bancos em meu.pluggy.ai
 *  2. No Pluggy Dashboard → Applications → sua aplicação → Demo → Connect Account → MeuPluggy
 *  3. Copie Client ID, Client Secret e o itemId de cada banco
 *  4. POST /auth { clientId, clientSecret } → apiKey  (header X-API-KEY nas próximas chamadas)
 *  5. GET /accounts?itemId=…  e  GET /v2/transactions?accountId=… (cursor)
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
    headers: { 'Content-Type': 'application/json', ...(init.apiKey ? { 'X-API-KEY': init.apiKey } : {}), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403)
      throw new PluggyError('Credenciais recusadas pelo Pluggy. Confira o Client ID e o Client Secret.', res.status);
    if (res.status === 404) throw new PluggyError('Conexão não encontrada. Confira o Item ID.', res.status);
    if (res.status === 410) throw new PluggyError('O Pluggy desativou um endereço que o app usa. Atualize o Órbita.', res.status);
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

/**
 * Data da transação no fuso de Brasília. A Pluggy manda em UTC: cortar os 10 primeiros caracteres
 * jogaria compras das 21h–23h59 para o dia seguinte.
 */
function dataBR(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * Busca as transações de uma conta no período e converte para o formato da conferência.
 * Usa o GET /v2/transactions (paginação por cursor): o /transactions antigo foi desativado (erro 410).
 */
export async function listTransactions(
  apiKey: string,
  accountId: string,
  from: string,
  to: string,
  link: { localAccountId?: string; localCardId?: string } = {},
): Promise<BankTx[]> {
  const out: BankTx[] = [];
  // `next` já vem pronto para ser colado no caminho (ex.: "?accountId=…&after=…")
  let path: string | null = `/v2/transactions?accountId=${encodeURIComponent(accountId)}&dateFrom=${from}&dateTo=${to}`;
  for (let page = 0; path && page < 40; page++) {
    const r: { results: PluggyTransaction[]; next: string | null } = await call(path, { apiKey });
    for (const t of r.results) {
      const isOut = t.type ? t.type === 'DEBIT' : t.amount < 0;
      out.push({ id: t.id, date: dataBR(t.date), amount: Math.abs(t.amount), type: isOut ? 'out' : 'in', description: t.description, ...link });
    }
    path = r.next && r.results.length ? `/v2/transactions${r.next.startsWith('?') ? r.next : `?${r.next}`}` : null;
  }
  return out;
}
