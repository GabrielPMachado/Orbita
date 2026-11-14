import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Armazenamento local (fica no aparelho). Depois dá pra trocar por sync com Firebase. */
export const storage = createJSONStorage(() => AsyncStorage);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
