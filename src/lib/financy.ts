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
import Constants from 'expo-constants';
import { useEffect } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { deleteSecret, getSecret, setSecret } from './secrets';
import { useFinancyLink, type FinancyHint, type FinancySummary } from '@/store/financyLink';
import { useSettings } from '@/store/settings';
import { resolveAccent } from '@/theme';

export const FINANCY_URL = 'https://financy-2d.web.app';
const API_KEY = 'AIzaSyDepvsTarS6FfS-nGNz51EVOlOR0yK5yOg'; // chave pública do app web (não é segredo)
const PROJECT = 'financy-2d';
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const K_TOKEN = 'financy.refreshToken';
const REFRESH_EVERY = 10 * 60 * 1000;
// a chave de API pode estar restrita ao site; o app manda o mesmo Referer
const REFERER = { Referer: `${FINANCY_URL}/` };

/* ---------- Abrir o Financy ---------- */

type Action =
  | { action: 'resumo' }
  | { action: 'conectar-orbita' }
  | { action: 'novo'; tipo?: 'expense' | 'income'; valor?: number; descricao?: string; categoria?: string; data?: string };

function query(a: Action) {
  if (a.action === 'resumo' || a.action === 'conectar-orbita') return '';
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
  const webAction = a ? (a.action === 'novo' ? 'quick-add' : a.action) : '';
  const web = webAction ? `${FINANCY_URL}/?action=${webAction}${q ? `&${q}` : ''}` : FINANCY_URL;
  return Linking.openURL(web).catch(() => {});
}

/** Pede ao Financy para mandar a chave de volta (orbita://financy/conectar?chave=…). */
export const requestFinancyLink = () => openFinancy({ action: 'conectar-orbita' });

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
  const j = (await res.json().catch(() => ({}))) as {
    id_token?: string;
    user_id?: string;
    expires_in?: string;
    refresh_token?: string;
    error?: { message?: string };
  };
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

/** Chamada autenticada ao Firestore do Financy (caminho relativo a users/{uid}/). */
export async function fsRequest(path: string, init: RequestInit = {}) {
  const s = await auth();
  const res = await fetch(`${DOCS}/users/${s.uid}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${s.idToken}`, 'Content-Type': 'application/json', ...REFERER, ...(init.headers ?? {}) },
  });
  return res;
}

export type FsValue = {
  stringValue?: string;
  doubleValue?: number;
  integerValue?: string;
  booleanValue?: boolean;
  arrayValue?: { values?: FsValue[] };
};
const num = (v?: FsValue) => v?.doubleValue ?? (v?.integerValue != null ? Number(v.integerValue) : undefined) ?? 0;

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
  useFinancyLink.getState().setBaseOptOut(false);
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

/** Avisa o Financy que o Órbita está conectado (Financy › Contas e conexões › Testar). */
export async function pingFinancy(version?: string) {
  const fields: Record<string, FsValue & { timestampValue?: string }> = {
    visto: { timestampValue: new Date().toISOString() },
    app: { stringValue: 'orbita' },
  };
  if (version) fields.versao = { stringValue: version };
  const res = await fsRequest('orbita/status', { method: 'PATCH', body: JSON.stringify({ fields }) });
  if (!res.ok) throw new FinancyError(`O Financy recusou a gravação (erro ${res.status}).`);
}

/** Testa a conexão: renova o acesso, lê o resumo e deixa o sinal de vida. */
export async function testFinancy(version?: string) {
  session = null;
  const summary = await refreshFinancy(true);
  if (!summary) throw new FinancyError('O Financy não está conectado.');
  await pingFinancy(version);
  return summary;
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

/* ---------- Aparência compartilhada ---------- */

/**
 * Aparência compartilhada (users/{uid}/aparencia/compartilhada): cor, roda de intensidade
 * e estilo dos ícones. Quem mudou por último (Órbita ou Financy) vale para os dois.
 */
let applyingRemote = false;

export async function pushAppearance() {
  if (!useFinancyLink.getState().connected || applyingRemote) return;
  const st = useSettings.getState();
  const s = await auth();
  const now = Date.now();
  const fields: Record<string, FsValue> = {
    cor: { stringValue: resolveAccent(st.accent) },
    intensidade: { integerValue: String(st.intensity ?? 4) },
    estiloIcones: { stringValue: st.iconStyle ?? 'suave' },
    tomIcones: { stringValue: st.iconTone ?? 'colorido' },
    cores: { arrayValue: { values: (st.customColors ?? []).map((c) => ({ stringValue: c })) } } as FsValue,
    origem: { stringValue: 'orbita' },
    atualizadoEm: { stringValue: new Date(now).toISOString() },
  };
  useFinancyLink.getState().setLookAt(now);
  const mask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${k}`)
    .join('&');
  const res = await fetch(`${DOCS}/users/${s.uid}/aparencia/compartilhada?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${s.idToken}`, 'Content-Type': 'application/json', ...REFERER },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new FinancyError(`Erro ${res.status} ao enviar a aparência`);
}

/** Traz a aparência se ela foi mudada no Financy depois da última mudança aqui. */
export async function pullAppearance() {
  if (!useFinancyLink.getState().connected) return;
  const s = await auth();
  const res = await fetch(`${DOCS}/users/${s.uid}/aparencia/compartilhada`, { headers: { Authorization: `Bearer ${s.idToken}`, ...REFERER } });
  if (!res.ok) return;
  const f = ((await res.json()) as { fields?: Record<string, FsValue> }).fields ?? {};
  const at = Date.parse(f.atualizadoEm?.stringValue ?? '') || 0;
  if (f.origem?.stringValue !== 'financy' || at <= useFinancyLink.getState().lookAt) return;
  const cor = f.cor?.stringValue;
  const st = useSettings.getState();
  applyingRemote = true;
  try {
    const cores = (f.cores?.arrayValue?.values ?? []).map((v) => v.stringValue).filter((x): x is string => !!x && /^#[0-9a-f]{6}$/i.test(x));
    const presetHit = cor
      ? Object.entries({ carmim: '#F2415A', ambar: '#F5A524', azul: '#4C8DFF', menta: '#3DD6B0', lima: '#A3E635', verde: '#10B981' }).find(
          ([, h]) => h.toLowerCase() === cor.toLowerCase(),
        )?.[0]
      : undefined;
    useSettings.setState({
      accent: presetHit ?? (cor && /^#[0-9a-f]{6}$/i.test(cor) ? cor.toUpperCase() : st.accent),
      customColors: [
        ...new Set([...(st.customColors ?? []), ...cores.map((c) => c.toUpperCase()), ...(!presetHit && cor ? [cor.toUpperCase()] : [])]),
      ].slice(-12),
      intensity: f.intensidade ? Math.max(0, Math.min(11, num(f.intensidade))) : st.intensity,
      iconStyle: (['suave', 'solido', 'contorno', 'simples'] as const).find((x) => x === f.estiloIcones?.stringValue) ?? st.iconStyle,
      iconTone: (['colorido', 'destaque', 'neutro'] as const).find((x) => x === f.tomIcones?.stringValue) ?? st.iconTone,
    });
    useFinancyLink.getState().setLookAt(at);
  } finally {
    setTimeout(() => (applyingRemote = false), 1500);
  }
}

/** Atualiza o resumo e envia o que ficou na fila ao abrir/voltar ao app. */
export function useFinancySync() {
  useEffect(() => {
    const run = () => {
      if (!useFinancyLink.getState().connected) return;
      refreshFinancy().catch(() => {});
      pingFinancy(Constants.expoConfig?.version).catch(() => {});
      flushHints().catch(() => {});
      pullAppearance().catch(() => {});
    };
    const t = setTimeout(run, 1500);
    const sub = AppState.addEventListener('change', (a) => a === 'active' && run());
    // mudou a cor/roda/ícones: espera parar de mexer e manda para o Financy
    let deb: ReturnType<typeof setTimeout> | undefined;
    const unsubLook = useSettings.subscribe((n, p) => {
      if (applyingRemote) return;
      if (
        n.accent === p.accent &&
        n.intensity === p.intensity &&
        n.iconStyle === p.iconStyle &&
        n.iconTone === p.iconTone &&
        n.customColors === p.customColors
      )
        return;
      clearTimeout(deb);
      deb = setTimeout(() => pushAppearance().catch(() => {}), 1200);
    });
    const unsubLink = useFinancyLink.subscribe((n, p) => {
      if (n.connected && !p.connected) pushAppearance().catch(() => {});
    });
    return () => {
      clearTimeout(t);
      clearTimeout(deb);
      sub.remove();
      unsubLook();
      unsubLink();
    };
  }, []);
}
