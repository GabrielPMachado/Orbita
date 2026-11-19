import { useEffect, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { importarEstacio } from '@/lib/estacioImport';
import { useEstacio } from '@/store/estacio';
import { toast } from '@/store/toast';
import { EstacioWeb } from './EstacioWeb';

const EVERY = 20 * 3600 * 1000;

/**
 * Uma vez por dia, com o app aberto, lê o portal da Estácio escondido (a sessão é a mesma da
 * tela da Estácio). Se a sessão expirou, só marca que precisa entrar de novo.
 */
export function EstacioBackground() {
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const s = useEstacio.getState();
      if (s.connected && s.auto && !s.needsLogin && Date.now() - s.lastSweep > EVERY && AppState.currentState === 'active') setRun(true);
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
          useEstacio.getState().set({ lastSweep: Date.now(), lastSummary: msg, needsLogin: false });
          if (!/nada novo/.test(msg)) toast({ message: msg });
        }}
      />
    </View>
  );
}
