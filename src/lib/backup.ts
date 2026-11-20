/**
 * Backup dos dados do Órbita, para não perder nada ao reinstalar ou atualizar o .ipa.
 *
 * Os dados ficam no AsyncStorage, dentro do app. Se o iOS tratar a nova instalação como outro
 * app (ex.: o Sideloadly trocou o bundle ID, ou o app foi apagado antes de instalar), tudo some.
 * Por isso há duas cópias:
 *  - na sua conta do Financy (Firestore, users/{uid}/orbita/…), a cada vez que o app vai para
 *    o fundo e no máximo a cada 15 min — volta sozinho numa instalação nova;
 *  - um arquivo .json que você exporta/importa quando quiser.
 * Fotos e anexos (arquivos) não entram: só os dados.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { useEffect } from 'react';
import { Alert, AppState, Platform, Share } from 'react-native';
import { fsRequest } from './financy';
import { useFinancyLink } from '@/store/financyLink';
import { avisar } from '@/lib/avisar';

const PART = 700_000; // caracteres por documento (o Firestore aceita até ~1 MB)
const META = 'orbita/backup';
const MIN_GAP = 15 * 60 * 1000;
/** chaves que não vale a pena guardar (cache e estado de sessão) */
const SKIP = /^(news|orbita-backup-meta)$/;

export type Backup = { v: 1; at: number; app?: string; data: Record<string, string> };

async function snapshot(): Promise<Backup> {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => !SKIP.test(k));
  const pairs = await AsyncStorage.multiGet(keys);
  const data: Record<string, string> = {};
  for (const [k, v] of pairs) if (v != null) data[k] = v;
  return { v: 1, at: Date.now(), data };
}

/** Há dados de verdade aqui? (tarefas, hábitos, notas, metas…) */
async function hasRealData() {
  const pairs = await AsyncStorage.multiGet([
    'tasks',
    'habits',
    'notes',
    'goals',
    'reminders',
    'subjects',
    'projects',
    'titles',
    'boletos',
    'clients',
    'invoices',
    'exams',
    'mood',
  ]);
  return pairs.some(([, v]) => {
    if (!v) return false;
    try {
      const st = (JSON.parse(v) as { state?: Record<string, unknown> }).state ?? {};
      return Object.values(st).some((x) => Array.isArray(x) && x.length > 0);
    } catch {
      return false;
    }
  });
}

async function restoreData(b: Backup) {
  await AsyncStorage.multiSet(Object.entries(b.data));
  await AsyncStorage.setItem('orbita-backup-meta', JSON.stringify({ restoredAt: Date.now(), from: b.at }));
  await reloadAppAsync('backup restaurado').catch(() => {
    Alert.alert('Backup restaurado', 'Feche o Órbita e abra de novo para ver seus dados.');
  });
}

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i += 7) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
};

/* ---------- nuvem (conta do Financy) ---------- */

let lastHash = '';
let lastAt = 0;
let busy = false;

export async function cloudBackup(force = false) {
  if (!useFinancyLink.getState().connected || busy) return false;
  if (!force && Date.now() - lastAt < MIN_GAP) return false;
  busy = true;
  try {
    const b = await snapshot();
    const json = JSON.stringify(b.data);
    const h = hash(json);
    if (!force && h === lastHash) return false;
    // proteção: uma instalação nova quase vazia não apaga um backup grande da nuvem
    if (!force) {
      const info = await cloudInfo().catch(() => null);
      if (info && info.size > 4000 && json.length < info.size * 0.5) return false;
    }
    const parts = Math.max(1, Math.ceil(json.length / PART));
    for (let i = 0; i < parts; i++) {
      const res = await fsRequest(`orbita/backup-${i}`, {
        method: 'PATCH',
        body: JSON.stringify({ fields: { chunk: { stringValue: json.slice(i * PART, (i + 1) * PART) } } }),
      });
      if (!res.ok) throw new Error(`Financy respondeu ${res.status}`);
    }
    const res = await fsRequest(META, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          at: { integerValue: String(b.at) },
          parts: { integerValue: String(parts) },
          size: { integerValue: String(json.length) },
          device: { stringValue: Platform.OS },
        },
      }),
    });
    if (!res.ok) throw new Error(`Financy respondeu ${res.status}`);
    lastHash = h;
    lastAt = Date.now();
    await AsyncStorage.setItem('orbita-backup-meta', JSON.stringify({ cloudAt: b.at, size: json.length }));
    return true;
  } finally {
    busy = false;
  }
}

export async function cloudInfo(): Promise<{ at: number; parts: number; size: number } | null> {
  const res = await fsRequest(META);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Financy respondeu ${res.status}`);
  const f = ((await res.json()) as { fields?: Record<string, { integerValue?: string }> }).fields ?? {};
  return { at: Number(f.at?.integerValue ?? 0), parts: Number(f.parts?.integerValue ?? 1), size: Number(f.size?.integerValue ?? 0) };
}

export async function cloudRestore() {
  const info = await cloudInfo();
  if (!info) throw new Error('Nenhum backup na sua conta ainda.');
  let json = '';
  for (let i = 0; i < info.parts; i++) {
    const res = await fsRequest(`orbita/backup-${i}`);
    if (!res.ok) throw new Error(`Financy respondeu ${res.status}`);
    const f = ((await res.json()) as { fields?: { chunk?: { stringValue?: string } } }).fields;
    json += f?.chunk?.stringValue ?? '';
  }
  const data = JSON.parse(json) as Record<string, string>;
  await restoreData({ v: 1, at: info.at, data });
}

/* ---------- arquivo ---------- */

export async function exportFile() {
  const b = await snapshot();
  const d = new Date(b.at);
  const name = `orbita-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  const f = new File(Paths.cache, name);
  f.write(JSON.stringify(b));
  await Share.share({ url: f.uri, title: name });
}

export async function importFile() {
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets[0]) return;
  const b = JSON.parse(await new File(r.assets[0].uri).text()) as Backup;
  if (b?.v !== 1 || !b.data) throw new Error('Esse arquivo não é um backup do Órbita.');
  const when = new Date(b.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  Alert.alert('Restaurar backup?', `Backup de ${when}. Os dados atuais do Órbita serão substituídos.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Restaurar', style: 'destructive', onPress: () => restoreData(b) },
  ]);
}

/* ---------- automático ---------- */

/**
 * Montado na raiz:
 *  - instalação nova (sem dados) e há backup na conta → oferece restaurar;
 *  - ao ir para o fundo, faz backup (se mudou e passou o intervalo).
 */
export function useAutoBackup() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let asked = false;
    const offer = async () => {
      if (asked || !useFinancyLink.getState().connected) return;
      asked = true;
      try {
        if (await hasRealData()) return;
        const info = await cloudInfo();
        if (!info?.at) return;
        const when = new Date(info.at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        Alert.alert('Recuperar seus dados?', `Achei um backup do Órbita de ${when} na sua conta. Restaurar agora?`, [
          { text: 'Agora não', style: 'cancel' },
          {
            text: 'Restaurar',
            onPress: () => cloudRestore().catch((e) => Alert.alert('Não deu', e instanceof Error ? e.message : 'Tente de novo.')),
          },
        ]);
      } catch (e) {
        avisar('procurar backup na nuvem', e);
      }
    };
    const t = setTimeout(offer, 2500);
    // conectou o Financy depois de abrir (instalação nova): oferece também
    const unsub = useFinancyLink.subscribe((n, p) => {
      if (n.connected && !p.connected) setTimeout(offer, 1500);
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        hasRealData()
          .then((ok) => (ok ? cloudBackup() : false))
          .catch(() => {});
      }
    });
    return () => {
      clearTimeout(t);
      unsub();
      sub.remove();
    };
  }, []);
}
