import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  /** ícone: sucesso, aviso ou neutro */
  kind?: 'success' | 'info' | 'danger';
  action?: { label: string; onPress: () => void };
}

interface ToastState {
  current?: Toast;
  show: (t: Omit<Toast, 'id'>, ms?: number) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Aviso flutuante no rodapé — com ação opcional (ex.: Desfazer). */
export const useToast = create<ToastState>()((set) => ({
  current: undefined,
  show: (t, ms = 3800) => {
    if (timer) clearTimeout(timer);
    set({ current: { ...t, id: Date.now() } });
    timer = setTimeout(() => set({ current: undefined }), ms);
  },
  hide: () => {
    if (timer) clearTimeout(timer);
    set({ current: undefined });
  },
}));

export const toast = (t: Omit<Toast, 'id'>, ms?: number) => useToast.getState().show(t, ms);
