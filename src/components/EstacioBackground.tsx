import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { pullEstacioCloud } from '@/lib/estacioCloud';
import { importarEstacio } from '@/lib/estacioImport';
import { useEstacio } from '@/store/estacio';
import { toast } from '@/store/toast';
import { EstacioWeb } from './EstacioWeb';

const EVERY = 20 * 3600 * 1000;
/** se a leitura não trouxe nada (portal fora, rede ruim), tenta de novo só depois disto */
const RETRY = 2 * 3600 * 1000;
let lastTry = 0;

/**
 * Ao abrir, importa a varredura da nuvem (04:00). Se ela não rodou, uma vez por dia, com o app aberto, lê o portal da Estácio escondido (a sessão é a mesma da
 * tela da Estácio). Se a sessão expirou, só marca que precisa entrar de novo.
 */
export function EstacioBackground() {
  const [run, setRun] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      // primeiro o que a nuvem leu às 04:00; só varre aqui se ela não trouxe nada recente
      const msg = await pullEstacioCloud().catch(() => undefined);
      if (msg && !/nada novo/.test(msg)) toast({ message: msg });
      const s = useEstacio.getState();
      if (
        Platform.OS === 'ios' &&
        s.connected &&
        s.auto &&
        !s.needsLogin &&
        Date.now() - s.lastSweep > EVERY &&
        Date.now() - lastTry > RETRY &&
        AppState.currentState === 'active'
      ) {
        lastTry = Date.now();
        setRun(true);
      }
    };
    const later = () => {
      clearTimeout(t);
      t = setTimeout(check, 10_000);
    };
    later();
    const sub = AppState.addEventListener('change', (a) => a === 'active' && later());
    const h = useEstacio.persist.onFinishHydration(later);
    return () => {
      clearTimeout(t);
      sub.remove();
      h();
    };
  }, []);
  useEffect(() => {
    if (!run) return;
    const stop = setTimeout(() => setRun(false), 7 * 60 * 1000);
    return () => clearTimeout(stop);
  }, [run]);

  if (!run) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -20, top: 0, width: 2, height: 2, opacity: 0 }}>
      <EstacioWeb
        autoSweep
        onSweep={(s) => {
          if (s.phase === 'login') {
            useEstacio.getState().set({ needsLogin: true });
            setRun(false);
          }
        }}
        onDone={(r, { loggedOut }) => {
          setRun(false);
          if (loggedOut) return useEstacio.getState().set({ needsLogin: true });
          const msg = importarEstacio(r);
          const leu = r.disciplinas.length || (r.avaliacoes ?? []).length || (r.cobrancas ?? []).length;
          // só conta como "atualizado" quando o portal devolveu dados de verdade
          useEstacio.getState().set(leu ? { lastSweep: Date.now(), lastSummary: msg, needsLogin: false } : { lastSummary: msg });
          if (!/nada novo/.test(msg)) toast({ message: msg });
        }}
      />
    </View>
  );
}
