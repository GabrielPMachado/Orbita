/**
 * Resultado da varredura da Estácio feita na nuvem (GitHub Actions, 04:00 de Brasília).
 * O job grava em users/{uid}/orbita/estacio-cloud no Firestore do Financy; aqui só lemos.
 */
import { fsRequest, type FsValue } from './financy';
import { importarEstacio, type Resultado } from './estacioImport';
import { useEstacio, type PassoLog } from '@/store/estacio';
import { useFinancyLink } from '@/store/financyLink';

type Campos = Record<string, FsValue & { timestampValue?: string }>;

/** Busca a última varredura da nuvem e importa se for nova. Devolve o resumo quando importou. */
export async function pullEstacioCloud(): Promise<string | undefined> {
  if (!useFinancyLink.getState().connected) return;
  const res = await fsRequest('orbita/estacio-cloud').catch(() => undefined);
  if (!res?.ok) return;
  const f = ((await res.json().catch(() => ({}))) as { fields?: Campos }).fields ?? {};
  const at = Date.parse(f.at?.timestampValue ?? '') || 0;
  const st = useEstacio.getState();
  if (!at || at <= st.cloudAt) return;
  if (!f.ok?.booleanValue) {
    st.set({ cloudAt: at, cloudErro: f.erro?.stringValue ?? 'A varredura da nuvem falhou.' });
    return;
  }
  let r: Resultado;
  try {
    r = JSON.parse(f.resultado?.stringValue ?? '') as Resultado;
  } catch {
    st.set({ cloudAt: at, cloudErro: 'O resultado da nuvem veio incompleto.' });
    return;
  }
  const msg = importarEstacio(r);
  let passos: PassoLog[] | undefined;
  try {
    passos = f.passos?.stringValue ? (JSON.parse(f.passos.stringValue) as PassoLog[]) : undefined;
  } catch {
    passos = undefined;
  }
  st.set({ cloudAt: at, cloudErro: undefined, ...(passos ? { lastSteps: passos } : {}), lastSweep: Math.max(st.lastSweep, at), lastSummary: msg });
  return msg;
}
