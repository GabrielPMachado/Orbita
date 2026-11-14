/**
 * Conferência com o Meu Pluggy (Open Finance).
 *
 *  1. Baixa o extrato dos últimos 45 dias das contas vinculadas.
 *  2. Casa cada transação do banco com um lançamento do Órbita (lib/reconcile.ts).
 *  3. O que casar ganha o selo de verificado automaticamente.
 *  4. O que só existe no banco vira sugestão (você escolhe a categoria e importa).
 *  5. O que só existe no app fica sinalizado para você conferir.
 *
 * Nada de senha de banco: o acesso é o consentimento Open Finance que você dá no Meu Pluggy.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { addDays, fromKey, toKey, today } from './date';
import { normalizeName } from './finance';
import { authenticate, getItem, listAccounts, listTransactions, type PluggyAccount } from './pluggy';
import { reconcile, type BankTx } from './reconcile';
import { deleteSecret, getSecret, setSecret } from './secrets';
import { useFinance, type Tx } from '@/store/finance';
import { usePluggy, type LinkedAccount } from '@/store/pluggy';
import { toast } from '@/store/toast';

const K_ID = 'pluggy.clientId';
const K_SECRET = 'pluggy.clientSecret';
const AUTO_EVERY = 6 * 60 * 60 * 1000;
const DAYS = 45;
const shift = (n: number) => toKey(addDays(fromKey(today()), n));

async function credentials() {
  const [clientId, clientSecret] = await Promise.all([getSecret(K_ID), getSecret(K_SECRET)]);
  if (!clientId || !clientSecret) throw new Error('Configure o Meu Pluggy primeiro.');
  return { clientId, clientSecret };
}

export async function hasCredentials() {
  const [a, b] = await Promise.all([getSecret(K_ID), getSecret(K_SECRET)]);
  return !!a && !!b;
}

export async function forgetPluggy() {
  await Promise.all([deleteSecret(K_ID), deleteSecret(K_SECRET)]);
  usePluggy.getState().reset();
}

/** tenta vincular sozinho pelo nome ("Nubank" ↔ cartão "Nubank") quando só existe um candidato */
function guessLink(a: Omit<LinkedAccount, 'enabled'>) {
  const { accounts, cards } = useFinance.getState();
  const hay = normalizeName(`${a.bank} ${a.name}`);
  const pick = <T extends { id: string; name: string }>(list: T[]) => {
    const hits = list.filter((x) => {
      const n = normalizeName(x.name);
      return n.length >= 3 && hay.includes(n);
    });
    return hits.length === 1 ? hits[0].id : undefined;
  };
  return a.kind === 'CREDIT' ? { localCardId: pick(cards) } : { localAccountId: pick(accounts) };
}

async function fetchAccounts(apiKey: string, itemIds: string[]) {
  const out: Omit<LinkedAccount, 'enabled' | 'localAccountId' | 'localCardId'>[] = [];
  for (const itemId of itemIds) {
    const [item, accs] = await Promise.all([getItem(apiKey, itemId).catch(() => undefined), listAccounts(apiKey, itemId)]);
    accs.forEach((a: PluggyAccount) =>
      out.push({
        id: a.id,
        itemId,
        name: a.marketingName || a.name,
        bank: item?.connector?.name ?? 'Banco',
        color: item?.connector?.primaryColor ? `#${item.connector.primaryColor.replace('#', '')}` : undefined,
        kind: a.type === 'CREDIT' ? 'CREDIT' : 'BANK',
        balance: a.balance,
      }),
    );
  }
  return out;
}

/** Salva as credenciais no Keychain, testa e lista as contas. Lança erro legível se falhar. */
export async function connectPluggy(clientId: string, clientSecret: string, itemIds: string[]) {
  const apiKey = await authenticate({ clientId: clientId.trim(), clientSecret: clientSecret.trim() });
  const ids = [...new Set(itemIds.map((i) => i.trim()).filter(Boolean))];
  const accounts = await fetchAccounts(apiKey, ids);
  await Promise.all([setSecret(K_ID, clientId.trim()), setSecret(K_SECRET, clientSecret.trim())]);
  const st = usePluggy.getState();
  const known = new Set(st.accounts.map((a) => a.id));
  st.setItemIds(ids);
  st.mergeAccounts(accounts);
  accounts.filter((a) => !known.has(a.id)).forEach((a) => st.linkAccount(a.id, guessLink(a)));
  st.setConfigured(true);
  return accounts.length;
}

/* ---------- Conferência ---------- */

const linkOf = (a: LinkedAccount) => ({ localAccountId: a.localAccountId, localCardId: a.localCardId });

export interface Review {
  matched: number;
  bankOnly: BankTx[];
  localOnly: Tx[];
  verified: Tx[];
}

/** Calcula a conferência com o extrato salvo, sem rede. */
export function review(txs = useFinance.getState().txs, st = usePluggy.getState()): Review {
  const empty: Review = { matched: 0, bankOnly: [], localOnly: [], verified: [] };
  if (!st.period) return empty;
  const bank = st.bankTxs.filter((b) => !st.ignored.includes(b.id));
  const r = reconcile(txs, bank, st.period);
  const linkedAcc = new Set(st.accounts.filter((a) => a.enabled && a.localAccountId).map((a) => a.localAccountId));
  const linkedCard = new Set(st.accounts.filter((a) => a.enabled && a.localCardId).map((a) => a.localCardId));
  // o banco pode levar uns dias para mostrar a compra; não acusa o que é muito recente
  const settled = shift(-2);
  const localOnly = r.localOnly.filter(
    (t) =>
      t.date <= settled &&
      !st.localOk.includes(t.id) &&
      ((t.accountId && linkedAcc.has(t.accountId)) || (t.cardId && linkedCard.has(t.cardId))),
  );
  const verified = txs.filter((t) => t.verified && t.date >= st.period!.from && t.date <= st.period!.to).sort((a, b) => b.date.localeCompare(a.date));
  return { matched: r.matched.length, bankOnly: r.bankOnly.sort((a, b) => b.date.localeCompare(a.date)), localOnly, verified };
}

/** Aplica o selo de verificado em tudo que casou. Retorna quantos. */
export function applyMatches() {
  const st = usePluggy.getState();
  if (!st.period) return 0;
  const { txs, updateTx } = useFinance.getState();
  const r = reconcile(
    txs,
    st.bankTxs.filter((b) => !st.ignored.includes(b.id)),
    st.period,
  );
  r.matched.forEach(({ tx, bank }) => updateTx(tx.id, { verified: true, externalId: bank.id }));
  return r.matched.length;
}

/** Importa uma transação que só existe no banco, com a categoria escolhida. */
export function importBankTx(b: BankTx, category: string, description?: string) {
  useFinance.getState().addTx({
    type: b.type,
    amount: b.amount,
    category,
    description: (description ?? b.description).trim() || b.description,
    date: b.date,
    accountId: b.localCardId ? undefined : b.localAccountId,
    cardId: b.localCardId,
    source: 'pluggy',
    externalId: b.id,
    verified: true,
  });
}

/** Desfaz o selo (ex.: casou com a compra errada). */
export function unverify(txId: string) {
  useFinance.getState().updateTx(txId, { verified: false, externalId: undefined });
}

let inFlight: Promise<{ verified: number; pending: number }> | null = null;

/** Baixa o extrato, aplica as conferências e devolve um resumo. */
export function syncPluggy() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const st = usePluggy.getState();
    try {
      // prévia web: dados de demonstração, sem rede
      if (st.itemIds[0] === 'demo' && st.period) {
        st.setSynced({ bankTxs: st.bankTxs, period: st.period });
        return { verified: applyMatches(), pending: review().bankOnly.length };
      }
      const apiKey = await authenticate(await credentials());
      const accounts = await fetchAccounts(apiKey, st.itemIds);
      st.mergeAccounts(accounts);
      const linked = usePluggy.getState().accounts.filter((a) => a.enabled);
      const period = { from: shift(-DAYS), to: today() };
      const bankTxs: BankTx[] = [];
      for (const a of linked) bankTxs.push(...(await listTransactions(apiKey, a.id, period.from, period.to, linkOf(a))));
      st.setSynced({ bankTxs, period });
      const verified = applyMatches();
      return { verified, pending: review().bankOnly.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Não foi possível falar com o Pluggy.';
      st.setError(msg);
      throw e;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Sincroniza sozinho ao abrir o app (no máximo a cada 6 h). */
export function useAutoPluggySync() {
  useEffect(() => {
    const run = () => {
      const s = usePluggy.getState();
      if (!s.configured || !s.autoSync || (s.lastSync && Date.now() - s.lastSync < AUTO_EVERY)) return;
      syncPluggy()
        .then(({ verified, pending }) => {
          if (verified || pending)
            toast({
              message: [verified ? `${verified} conferido${verified > 1 ? 's' : ''} com o banco` : '', pending ? `${pending} para revisar` : '']
                .filter(Boolean)
                .join(' · '),
              kind: 'info',
            });
        })
        .catch(() => {});
    };
    const first = setTimeout(run, 2500);
    const sub = AppState.addEventListener('change', (a) => a === 'active' && run());
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, []);
}

/** "IFOOD *BURGER KING" → "Ifood Burger King" (extratos vêm em caixa alta) */
export function prettyDesc(raw: string) {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na']);
  const clean = raw.replace(/[*_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean !== clean.toUpperCase()) return clean;
  return clean
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w) ? w : /^(pix|iof|ted|doc|ltda|sa|me)$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/* ---------- Sugestão de categoria ---------- */

const RULES: [RegExp, string][] = [
  [/ifood|rappi|restaurante|lanchon|padaria|burger|pizza|cafe|mcdonald|bk |subway|outback|starbucks/, 'Alimentação'],
  [/mercado|supermerc|zaffari|carrefour|atacad|assai|bourbon|nacional|big |hortifruti/, 'Mercado'],
  [/uber|99 ?app|99 ?pop|cabify|posto|shell|ipiranga|petrobras|br mania|estaciona|sem parar|veloe|metro|trensurb/, 'Transporte'],
  [/netflix|spotify|disney|prime video|amazon prime|youtube|hbo|max\b|apple\.com|icloud|google one|deezer|globoplay|chatgpt|openai|claude|anthropic/, 'Assinaturas'],
  [/farmac|drogar|panvel|raia|pacheco|sao joao|clinica|laborat|unimed|hospital/, 'Saúde'],
  [/aluguel|condominio|imobili/, 'Moradia'],
  [/ceee|rge|equatorial|corsan|dmae|sabesp|claro|vivo|tim\b|oi\b|net\b|internet|energia|agua|luz/, 'Contas'],
  [/cinema|ingresso|steam|playstation|xbox|nintendo|bar\b|show|sympla|eventim/, 'Lazer'],
  [/shopee|shein|aliexpress|mercado ?livre|magalu|amazon|renner|riachuelo|c&a|zara|centauro|netshoes/, 'Compras'],
  [/escola|curso|udemy|alura|faculdade|livraria/, 'Educação'],
  [/petz|cobasi|pet\b|veterin/, 'Pets'],
  [/hotel|airbnb|booking|latam|gol\b|azul\b|decolar/, 'Viagem'],
  [/iof|imposto|ipva|iptu|darf|tarifa/, 'Impostos'],
];

/** Usa o histórico (mesma descrição já categorizada) e, se não houver, palavras-chave. */
export function guessCategory(b: BankTx, txs = useFinance.getState().txs): string {
  const n = normalizeName(b.description);
  const first = n.split(' ')[0];
  const prev = txs.find((t) => t.type === b.type && first.length >= 3 && normalizeName(t.description).split(' ')[0] === first);
  if (prev) return prev.category;
  if (b.type === 'in') return /salario|folha|pagamento/.test(n) ? 'Salário' : /pix/.test(n) ? 'Pix recebido' : /estorno|reembolso/.test(n) ? 'Reembolso' : 'Outros';
  return RULES.find(([re]) => re.test(n))?.[1] ?? 'Outros';
}
