/**
 * Segredos (credenciais do Pluggy) no Keychain do iPhone via expo-secure-store.
 * Nunca vão para o AsyncStorage, para o código nem para backups em texto puro.
 * Na prévia web ficam só em memória.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const mem = new Map<string, string>();
const web = Platform.OS === 'web';
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

export async function getSecret(key: string): Promise<string | null> {
  if (web) return mem.get(key) ?? null;
  return SecureStore.getItemAsync(key, opts).catch(() => null);
}
export async function setSecret(key: string, value: string) {
  if (web) return void mem.set(key, value);
  await SecureStore.setItemAsync(key, value, opts);
}
export async function deleteSecret(key: string) {
  if (web) return void mem.delete(key);
  await SecureStore.deleteItemAsync(key, opts).catch(() => {});
}
