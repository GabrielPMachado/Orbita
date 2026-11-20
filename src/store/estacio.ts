import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '@/lib/storage';

export type PassoLog = { name: string; ok: boolean; info?: string };

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
  /** passos da última leitura (onde clicou, se achou o que procurava) */
  lastSteps?: PassoLog[];
  /** última varredura da nuvem já vista (04:00, GitHub Actions) */
  cloudAt: number;
  /** a última varredura da nuvem falhou: por quê */
  cloudErro?: string;
  /** pedido de varredura em segundo plano (montada na raiz) */
  running: boolean;
  set: (p: Partial<Omit<EstacioState, 'set'>>) => void;
}
export const useEstacio = create<EstacioState>()(
  persist((set) => ({ connected: false, needsLogin: false, auto: true, lastSweep: 0, cloudAt: 0, running: false, set: (p) => set(p) }), {
    name: 'orbita-estacio',
    storage,
    partialize: (s) =>
      ({
        connected: s.connected,
        needsLogin: s.needsLogin,
        auto: s.auto,
        lastSweep: s.lastSweep,
        lastSummary: s.lastSummary,
        lastSteps: s.lastSteps,
        cloudAt: s.cloudAt,
        cloudErro: s.cloudErro,
      }) as unknown as EstacioState,
  }),
);
