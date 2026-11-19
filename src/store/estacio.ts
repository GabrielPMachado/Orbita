import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';

/** Estado da ligação com o portal da Estácio (a sessão em si fica nos cookies da WebView). */
interface EstacioState {
  /** já entrou pelo menos uma vez: dá para varrer sozinho */
  connected: boolean;
  /** a sessão expirou: precisa entrar de novo */
  needsLogin: boolean;
  /** varrer sozinho uma vez por dia */
  auto: boolean;
  lastSweep: number;
  lastSummary?: string;
  /** pedido de varredura em segundo plano (montada na raiz) */
  running: boolean;
  set: (p: Partial<Omit<EstacioState, 'set'>>) => void;
}
export const useEstacio = create<EstacioState>()(
  persist(
    (set) => ({ connected: false, needsLogin: false, auto: true, lastSweep: 0, running: false, set: (p) => set(p) }),
    {
      name: 'orbita-estacio',
      storage,
      partialize: (s) => ({ connected: s.connected, needsLogin: s.needsLogin, auto: s.auto, lastSweep: s.lastSweep, lastSummary: s.lastSummary }) as unknown as EstacioState,
    },
  ),
);
