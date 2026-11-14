import { create } from 'zustand';

/** Estado de interface (não salvo): sheets globais abertos a partir da tab bar. */
interface UIState {
  capture: boolean;
  setCapture: (v: boolean) => void;
}

export const useUI = create<UIState>()((set) => ({
  capture: false,
  setCapture: (capture) => set({ capture }),
}));
