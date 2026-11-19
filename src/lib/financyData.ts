/**
 * Financy como base das Finanças do Órbita.
 *
 * Os lançamentos moram no Financy (users/{uid}/despesas | receitas | investimentos).
 * O Órbita guarda um espelho no aparelho (funciona offline) e:
 *  - puxa tudo ao abrir/voltar ao app e ao puxar a tela;
 *  - nunca escreve lá: lançar, editar e apagar é no Financy (o Órbita abre o app já preenchido);
 *  - compras do Apple Pay viram só um aviso de categoria que o Financy aplica na compra do banco.
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

/** O Órbita não escreve no Financy: só lê. (Mantido para quem ainda chama.) */
export async function pushChanges() {}

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
      const [tx, cards, cats] = await Promise.all([
        Promise.all(COLS.map(async (c) => (await listAll(c)).map((d) => fromFinancy(d, c)).filter((x): x is Tx => !!x))),
        listAll('cartoes'),
        listAll('categorias'),
      ]);
      const all = tx.flat();
      useFinance.getState().applyMirror({
        txs: all.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
        cards: cards.map(cardFrom),
        categories: cats
          .map((d) => {
            const f = Object.fromEntries(Object.entries(d.fields ?? {}).map(([k, v]) => [k, val(v)])) as Record<string, unknown>;
            return {
              name: String(f.name ?? ''),
              type: f.type === 'income' ? ('in' as const) : ('out' as const),
              color: typeof f.color === 'string' ? f.color : undefined,
            };
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
      if (link.connected && fin.base !== 'financy') {
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
    return () => {
      clearTimeout(t);
      sub.remove();
      unsubLink();
      h1();
      h2();
    };
  }, []);
}
