import { requireOptionalNativeModule } from 'expo-modules-core';

type Native = {
  readPdf(uri: string, password?: string | null): Promise<{ locked: boolean; text: string; codes: string[]; pages?: number }>;
  readImage(uri: string): Promise<{ text: string; codes: string[] }>;
};

/** null fora do build nativo (prévia web, Expo Go). */
export const OrbitaDocs = requireOptionalNativeModule<Native>('OrbitaDocs');
