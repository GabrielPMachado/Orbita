/**
 * Ligação com o Financy (app de finanças completo do Gabriel, Firebase).
 *
 *  - Abrir: financy://resumo, financy://novo?... no app nativo; sem ele, o site.
 *  - Conectar: a "chave do Atalho" do Financy (Ajustes › Órbita › Copiar chave) é um
 *    refresh token do Firebase. Fica no Keychain e só abre os dados do próprio usuário
 *    (as regras do Firestore garantem isso).
 *  - Ler: users/{uid}/resumo/atual (saldo, entradas e gastos do mês).
 *  - Enviar: cada compra do Apple Pay vai para users/{uid}/comprasApplePay com a categoria;
 *    o Financy aplica essa categoria quando a compra chega pelo Open Finance (sem duplicar).
 */
import { useEffect } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { deleteSecret, getSecret, setSecret } from './secrets';
import { useFinancyLink, type FinancyHint, type FinancySummary } from '@/store/financyLink';

export const FINANCY_URL = 'https://financy-2d.web.app';
const API_KEY = 'AIzaSyDepvsTarS6FfS-nGNz51EVOlOR0yK5yOg'; // chave pública do app web (não é segredo)
const PROJECT = 'financy-2d';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const K_TOKEN = 'financy.refreshToken';
const REFRESH_EVERY = 10 * 60 * 1000;
// a chave de API pode estar restrita ao site; o app manda o mesmo Referer
const REFERER = { Referer: `${FINANCY_URL}/` };

/* ---------- Abrir o Financy ---------- */

type Action = { action: 'resumo' } | { action: 'novo'; tipo?: 'expense' | 'income'; valor?: number; descricao?: string; categoria?: string; data?: string };

function query(a: Action) {
  if (a.action === 'resumo') return '';
  const p = new URLSearchParams();
  if (a.tipo) p.set('tipo', a.tipo);
  if (a.valor) p.set('valor', String(a.valor));
  if (a.descricao) p.set('descricao', a.descricao);
  if (a.categoria) p.set('categoria', a.categoria);
  if (a.data) p.set('data', a.data);
  return p.toString();
}

/** Abre o app do Financy (se instalado) ou o site, já na ação pedida. */
export async function openFinancy(a?: Action) {
  const q = a ? query(a) : '';
  const native = a ? `financy://${a.action}${q ? `?${q}` : ''}` : 'financy://';
  try {
    if (Platform.OS !== 'web' && (await Linking.canOpenURL('financy://'))) return await Linking.openURL(native);
  } catch {}
  const webAction = a ? (a.action === 'resumo' ? 'resumo' : 'quick-add') : '';
  const web = webAction ? `${FINANCY_URL}/?action=${webAction}${q ? `&${q}` : ''}` : FINANCY_URL;
  return Linking.openURL(web).catch(() => {});
}

/* ---------- Conexão ---------- */

export class FinancyError extends Error {}

let session: { idToken: string; uid: string; exp: number } | null = null;

async function auth(refreshToken?: string) {
  if (session && Date.now() < session.exp) return session;
  const token = refreshToken ?? (await getSecret(K_TOKEN));
  if (!token) throw new FinancyError('Conecte o Financy primeiro.');
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...REFERER },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(token.trim())}`,
  });
  const j = (await res.json().catch(() => ({}))) as { id_token?: string; user_id?: string; expires_in?: string; refresh_token?: string; error?: { message?: string } };
  if (!res.ok || !j.id_token || !j.user_id) {
    const m = j.error?.message ?? '';
    throw new FinancyError(
      /INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|INVALID_GRANT/.test(m)
        ? 'Chave inválida ou revogada. Copie de novo no Financy (Ajustes › Órbita).'
        : `O Financy recusou a conexão${m ? ` (${m})` : ''}.`,
    );
  }
  if (j.refresh_token && j.refresh_token !== token) await setSecret(K_TOKEN, j.refresh_token);
  session = { idToken: j.id_token, uid: j.user_id, exp: Date.now() + (Number(j.expires_in ?? 3600) - 120) * 1000 };
  return session;
}

type FsValue = { stringValue?: string; doubleValue?: number; integerValue?: string; booleanValue?: boolean };
const num = (v?: FsValue) => (v?.doubleValue ?? (v?.integerValue != null ? Number(v.integerValue) : undefined)) ?? 0;

async function readSummary(): Promise<FinancySummary> {
  const s = await auth();
  const res = await fetch(`${DOCS}/users/${s.uid}/resumo/atual`, { headers: { Authorization: `Bearer ${s.idToken}`, ...REFERER } });
  if (res.status === 404) throw new FinancyError('O resumo ainda não existe. Abra o Financy uma vez para ele ser criado.');
  if (!res.ok) throw new FinancyError(`Não consegui ler o Financy (erro ${res.status}).`);
  const f = ((await res.json()) as { fields?: Record<string, FsValue> }).fields ?? {};
  return {
    saldo: num(f.saldo),
    entradasMes: num(f.entradasMes),
    gastosMes: num(f.gastosMes),
    pendentesTotal: num(f.pendentesTotal),
    atualizadoEm: f.atualizadoEm?.stringValue,
    lidoEm: Date.now(),
  };
}

/** Salva a chave (Keychain), testa e já traz o resumo. */
export async function connectFinancy(key: string) {
  session = null;
  const k = key.trim().replace(/^["']|["']$/g, '');
  if (k.length < 40) throw new FinancyError('Isso não parece a chave do Financy. Copie em Ajustes › Órbita › Copiar chave.');
  await auth(k);
  await setSecret(K_TOKEN, k);
  const summary = await readSummary();
  useFinancyLink.getState().setConnected(true);
  useFinancyLink.getState().setSummary(summary);
  return summary;
}

export async function disconnectFinancy() {
  session = null;
  await deleteSecret(K_TOKEN);
  useFinancyLink.getState().reset();
}

export async function refreshFinancy(force = false) {
  const st = useFinancyLink.getState();
  if (!st.connected) return null;
  if (!force && st.summary && Date.now() - st.summary.lidoEm < REFRESH_EVERY) return st.summary;
  try {
    const summary = await readSummary();
    st.setSummary(summary);
    st.setError(undefined);
    return summary;
  } catch (e) {
    st.setError(e instanceof Error ? e.message : 'Falha ao ler o Financy');
    throw e;
  }
}

/* ---------- Compras do Apple Pay → Financy ---------- */

async function postHint(h: FinancyHint) {
  const s = await auth();
  const fields: Record<string, FsValue> = {
    valor: { doubleValue: h.valor },
    data: { stringValue: h.data },
    categoria: { stringValue: h.categoria },
    criadoEm: { stringValue: new Date(h.at).toISOString() },
  };
  if (h.hora) fields.hora = { stringValue: h.hora };
  if (h.estabelecimento) fields.estabelecimento = { stringValue: h.estabelecimento };
  if (h.cartao) fields.cartao = { stringValue: h.cartao };
  // documentId fixo: reenviar a mesma compra não cria outra
  const res = await fetch(`${DOCS}/users/${s.uid}/comprasApplePay?documentId=orbita-${encodeURIComponent(h.id)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s.idToken}`, 'Content-Type': 'application/json', ...REFERER },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok && res.status !== 409) throw new FinancyError(`Erro ${res.status} ao enviar a compra`);
}

/** Enfileira e tenta mandar na hora; o que falhar vai na próxima abertura. */
export function forwardPurchase(h: Omit<FinancyHint, 'at'>) {
  const st = useFinancyLink.getState();
  if (!st.connected || !st.forwardApplePay) return;
  st.queueHint({ ...h, at: Date.now() });
  flushHints().catch(() => {});
}

let flushing = false;
export async function flushHints() {
  if (flushing) return;
  flushing = true;
  try {
    for (const h of [...useFinancyLink.getState().pendingHints]) {
      await postHint(h);
      useFinancyLink.getState().dropHint(h.id);
    }
  } finally {
    flushing = false;
  }
}

/** Atualiza o resumo e envia o que ficou na fila ao abrir/voltar ao app. */
export function useFinancySync() {
  useEffect(() => {
    const run = () => {
      if (!useFinancyLink.getState().connected) return;
      refreshFinancy().catch(() => {});
      flushHints().catch(() => {});
    };
    const t = setTimeout(run, 1500);
    const sub = AppState.addEventListener('change', (a) => a === 'active' && run());
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, []);
}
