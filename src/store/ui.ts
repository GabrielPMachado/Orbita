import { create } from 'zustand';

/** Estado de interface (não salvo): sheets globais abertos a partir da tab bar. */
interface UIState {
  capture: boolean;
  setCapture: (v: boolean) => void;
  checkin: boolean;
  setCheckin: (v: boolean) => void;
}

export const useUI = create<UIState>()((set) => ({
  capture: false,
  setCapture: (capture) => set({ capture }),
  checkin: false,
  setCheckin: (checkin) => set({ checkin }),
}));

/** Abre o check-in do dia (modal de uma tela). */
export const openCheckin = () => useUI.getState().setCheckin(true);
