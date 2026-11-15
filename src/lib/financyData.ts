/**
 * Financy como base das Finanças do Órbita.
 *
 * Os lançamentos moram no Financy (users/{uid}/despesas | receitas | investimentos).
 * O Órbita guarda um espelho no aparelho (funciona offline) e:
 *  - puxa tudo ao abrir/voltar ao app e ao puxar a tela;
 *  - envia o que foi criado, editado ou apagado aqui (fila com `sync` / `pendingDeletes`);
 *  - compras do Apple Pay entram na hora como lançamento provisório (source 'applepay').
 *    Quando a mesma compra chega do banco pelo Open Finance, a categoria escolhida vai
 *    para a compra do banco e o provisório é apagado: nada fica em dobro.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { fsRequest, type FsValue } from './financy';
import { useFinance, type Card, type FyCol, type Tx } from '@/store/finance';
import { useFinancyLink } from '@/store/financyLink';
import { today } from './date';

const COLS: FyCol[] = ['despesas', 'receitas', 'investimentos'];
const PULL_EVERY = 2 * 60 * 1000;
const CARD_COLORS: Record<string, string> = {
  emerald: '#10B981',
  purple: '#8B5CF6',
  amber: '#F5A524',
  rose: '#F43F5E',
  blue: '#4C8DFF',
  slate: '#64748B',
};

/* ---------- conversão Firestore ⇄ JS ---------- */

type FsDoc = { name: string; fields?: Record<string, FsValue & { mapValue?: { fields?: Record<string, FsValue> } }> };

function val(v?: FsValue & { mapValue?: { fields?: Record<string, FsValue> }; nullValue?: null }): unknown {
  if (!v) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.arrayValue) return (v.arrayValue.values ?? []).map((x) => val(x));
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, val(x)]));
  return undefined;
}
function toFs(v: unknown): FsValue {
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  return { stringValue: String(v) };
}
const idOf = (d: FsDoc) => d.name.split('/').pop()!;

async function listAll(col: string): Promise<FsDoc[]> {
  const out: FsDoc[] = [];
  let token = '';
  for (let i = 0; i < 40; i++) {
    const res = await fsRequest(`${col}?pageSize=300${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
    if (res.status === 404) return out;
    if (!res.ok) throw new Error(`Financy respondeu ${res.status} ao ler ${col}`);
    const j = (await res.json()) as { documents?: FsDoc[]; nextPageToken?: string };
    out.push(...(j.documents ?? []));
    if (!j.nextPageToken) break;
    token = j.nextPageToken;
  }
  return out;
}

/* ---------- Financy → Órbita ---------- */

function fromFinancy(d: FsDoc, col: FyCol): Tx | null {
  const f = Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, val(v)])) as Record<string, unknown>;
  const amount = Number(f.amount);
  const date = String(f.date ?? '');
  if (!(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const type = col === 'receitas' ? 'in' : 'out';
  const source = f.source === 'pluggy' ? 'pluggy' : f.source === 'applepay' ? 'applepay' : 'manual';
  return {
    id: idOf(d),
    type,
    amount,
    category: String(f.category ?? (col === 'investimentos' ? 'Investimentos' : 'Outros')),
    description: String(f.description ?? ''),
    date,
    cardId: typeof f.cardId === 'string' ? f.cardId : undefined,
    paid: date <= today(),
    fixed: f.isRecurring === true || undefined,
    attachments: [],
    createdAt: Date.parse(`${date}T${typeof f.time === 'string' ? f.time : '12:00'}:00`) || Date.now(),
    source,
    verified: source === 'pluggy' || undefined,
    fyCol: col,
  };
}

function cardFrom(d: FsDoc): Card {
  const f = Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, val(v)])) as Record<string, unknown>;
  const bank = String(f.bank ?? '');
  const name = String(f.name ?? 'Cartão');
  return {
    id: idOf(d),
    name: bank && !name.toLowerCase().includes(bank.toLowerCase()) ? `${bank} ${name}` : name,
    limit: Number(f.limit ?? 0),
    closingDay: Number(f.closingDay ?? 1),
    dueDay: Number(f.dueDay ?? 10),
    color: CARD_COLORS[String(f.color)] ?? '#10B981',
  };
}

/* ---------- Órbita → Financy ---------- */

const colFor = (t: Tx): FyCol => (t.type === 'in' ? 'receitas' : t.fyCol === 'investimentos' ? 'investimentos' : 'despesas');

function fieldsFor(t: Tx) {
  const d = new Date(t.createdAt || Date.now());
  const f: Record<string, unknown> = {
    description: t.description || t.category,
    amount: t.amount,
    type: t.type === 'in' ? 'income' : colFor(t) === 'investimentos' ? 'investment' : 'expense',
    category: t.category,
    date: t.date,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
  if (t.cardId) f.cardId = t.cardId;
  if (t.fixed) f.isRecurring = true;
  if (t.source === 'applepay') f.source = 'applepay';
  return f;
}

async function putDoc(col: FyCol, id: string, fields: Record<string, unknown>, mask?: string[]) {
  const m = mask ? '?' + mask.map((k) => `updateMask.fieldPaths=${k}`).join('&') : '';
  const res = await fsRequest(`${col}/${encodeURIComponent(id)}${m}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toFs(v)])) }),
  });
  if (!res.ok) throw new Error(`Financy respondeu ${res.status} ao salvar`);
}
async function deleteDoc(col: FyCol, id: string) {
  const res = await fsRequest(`${col}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`Financy respondeu ${res.status} ao apagar`);
}

/* ---------- sincronização ---------- */

let pushing = false;
/** Envia criações, edições e exclusões feitas aqui. */
export async function pushChanges() {
  const st = useFinance.getState();
  if (st.base !== 'financy' || pushing) return;
  pushing = true;
  try {
    const done: string[] = [];
    for (const t of st.txs.filter((x) => x.sync)) {
      const col = colFor(t);
      if (t.sync === 'dirty' && t.fyCol && t.fyCol !== col) {
        // mudou de tipo (gasto ⇄ entrada): sai de uma coleção e entra na outra
        await deleteDoc(t.fyCol, t.id);
        await putDoc(col, t.id, fieldsFor(t));
      } else if (t.sync === 'dirty') {
        const f = fieldsFor(t);
        await putDoc(col, t.id, f, Object.keys(f)); // só os campos do Órbita; o resto do Financy fica
      } else {
        await putDoc(col, t.id, fieldsFor(t));
      }
      done.push(t.id);
      useFinance.setState((s) => ({ txs: s.txs.map((x) => (x.id === t.id ? { ...x, fyCol: col } : x)) }));
    }
    const gone: string[] = [];
    for (const d of st.pendingDeletes) {
      await deleteDoc(d.col, d.id);
      gone.push(d.id);
    }
    useFinance.getState().markSynced(done, gone);
  } finally {
    pushing = false;
  }
}

/**
 * Compra do Apple Pay (provisória) × a mesma compra vinda do banco: mesmo valor, banco
 * até 2 dias depois. A categoria vai para a do banco e o provisório sai.
 */
async function resolveApplePay(txs: Tx[]) {
  const prov = txs.filter((t) => t.source === 'applepay' && t.fyCol === 'despesas' && !t.sync);
  const bank = txs.filter((t) => t.source === 'pluggy' && t.type === 'out');
  const used = new Set<string>();
  const dayDiff = (a: string, b: string) => (Date.parse(`${a}T12:00:00`) - Date.parse(`${b}T12:00:00`)) / 86400000;
  let n = 0;
  for (const p of prov) {
    const hit = bank
      .filter((b) => !used.has(b.id) && Math.abs(b.amount - p.amount) < 0.01 && dayDiff(b.date, p.date) >= 0 && dayDiff(b.date, p.date) <= 2)
      .sort((a, b) => dayDiff(a.date, p.date) - dayDiff(b.date, p.date))[0];
    if (!hit) continue;
    used.add(hit.id);
    await putDoc('despesas', hit.id, { category: p.category, applePayCategory: true }, ['category', 'applePayCategory']);
    await deleteDoc('despesas', p.id);
    n++;
  }
  return n;
}

let pulling: Promise<void> | null = null;
let lastPull = 0;
/** Traz tudo do Financy (e antes manda o que estiver pendente). */
export function pullFinancy(force = false) {
  const st = useFinance.getState();
  if (st.base !== 'financy' || !useFinancyLink.getState().connected) return Promise.resolve();
  if (!force && Date.now() - lastPull < PULL_EVERY) return Promise.resolve();
  if (pulling) return pulling;
  pulling = (async () => {
    try {
      await pushChanges();
      const [tx, cards, cats] = await Promise.all([
        Promise.all(COLS.map(async (c) => (await listAll(c)).map((d) => fromFinancy(d, c)).filter((x): x is Tx => !!x))),
        listAll('cartoes'),
        listAll('categorias'),
      ]);
      let all = tx.flat();
      if (await resolveApplePay(all)) {
        // casou compra do Apple Pay com a do banco: lê de novo já resolvido
        all = (await Promise.all(COLS.map(async (c) => (await listAll(c)).map((d) => fromFinancy(d, c)).filter((x): x is Tx => !!x)))).flat();
      }
      useFinance.getState().applyMirror({
        txs: all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
        cards: cards.map(cardFrom),
        categories: cats
          .map((d) => {
            const f = Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, val(v)])) as Record<string, unknown>;
            return { name: String(f.name ?? ''), type: f.type === 'income' ? ('in' as const) : ('out' as const), color: typeof f.color === 'string' ? f.color : undefined };
          })
          .filter((c) => c.name),
      });
      lastPull = Date.now();
      useFinancyLink.getState().setError(undefined);
    } catch (e) {
      useFinancyLink.getState().setError(e instanceof Error ? e.message : 'Falha ao ler o Financy');
      throw e;
    } finally {
      pulling = null;
    }
  })();
  return pulling;
}

/** Envia os lançamentos antigos do Órbita (de antes de virar Financy) para lá. */
export function uploadLocalBackup() {
  const st = useFinance.getState();
  const bk = st.localBackup;
  if (!bk?.txs.length) return 0;
  const ids = new Set(st.txs.map((t) => t.id));
  const fresh = bk.txs.filter((t) => !ids.has(t.id)).map((t) => ({ ...t, accountId: undefined, cardId: undefined, sync: 'new' as const }));
  useFinance.setState((s) => ({ txs: [...fresh, ...s.txs], localBackup: { ...bk, txs: [] } }));
  pushChanges().catch(() => {});
  return fresh.length;
}

/** Montado na raiz: liga o modo base ao conectar, sincroniza ao abrir e a cada mudança. */
export function useFinancyBaseSync() {
  useEffect(() => {
    const run = (force = false) => {
      if (useFinance.getState().base !== 'financy') return;
      pullFinancy(force).catch(() => {});
    };
    // espera os dois cadastros carregarem do aparelho antes de decidir a base
    const ready = () => useFinance.persist.hasHydrated() && useFinancyLink.persist.hasHydrated();
    const ensure = () => {
      if (!ready()) return;
      const link = useFinancyLink.getState();
      const fin = useFinance.getState();
      // conectado ao Financy (e sem ter desligado): ele é a base das Finanças
      if (link.connected && !link.baseOptOut && fin.base !== 'financy') {
        fin.setBase('financy');
        run(true);
      }
      if (!link.connected && fin.base === 'financy') fin.setBase('orbita');
    };
    const unsubLink = useFinancyLink.subscribe((n, p) => {
      if (n.connected !== p.connected) ensure();
    });
    const h1 = useFinance.persist.onFinishHydration(ensure);
    const h2 = useFinancyLink.persist.onFinishHydration(ensure);
    ensure();
    const t = setTimeout(() => run(true), 1200);
    const sub = AppState.addEventListener('change', (a) => a === 'active' && run());
    // mudou algo aqui: envia logo
    let deb: ReturnType<typeof setTimeout> | undefined;
    const unsubFin = useFinance.subscribe((n, p) => {
      if (n.base !== 'financy' || (n.txs === p.txs && n.pendingDeletes === p.pendingDeletes)) return;
      if (!n.txs.some((x) => x.sync) && !n.pendingDeletes.length) return;
      clearTimeout(deb);
      deb = setTimeout(() => pushChanges().catch(() => {}), 800);
    });
    return () => {
      clearTimeout(t);
      clearTimeout(deb);
      sub.remove();
      unsubLink();
      h1();
      h2();
      unsubFin();
    };
  }, []);
}
