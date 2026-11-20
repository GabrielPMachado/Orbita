/**
 * De onde um boleto pode chegar: colado (linha digitável, barras, Pix), foto/print, ou PDF.
 * Tudo é lido no próprio iPhone (PDFKit + Vision); nada é enviado para fora.
 */
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Platform } from 'react-native';
import { OrbitaDocs } from '../../modules/orbita-docs';
import { lerCodigo, lerTexto, type BoletoInfo } from './boleto';
import { keepFile } from './media';
import { cancel, ensurePermission } from './notifications';
import * as Notifications from 'expo-notifications';
import { brl } from './date';
import type { Boleto } from '@/store/boletos';
import { avisar } from '@/lib/avisar';

export type Lido = { infos: BoletoInfo[]; texto?: string; arquivo?: string; origem: Boleto['origem'] };

/** Lê o que está na área de transferência. */
export async function doClipboard(): Promise<Lido | null> {
  const t = await Clipboard.getStringAsync();
  if (!t.trim()) return null;
  const um = lerCodigo(t);
  const infos = um ? [um] : lerTexto(t);
  return { infos, texto: t, origem: 'colar' };
}

/** Foto (câmera) ou print/imagem (galeria): código de barras, QR do Pix e texto. */
export async function deFoto(source: 'camera' | 'library'): Promise<Lido | null> {
  if (!OrbitaDocs) {
    Alert.alert('Disponível no app instalado', 'A leitura de fotos funciona no app do iPhone, não na prévia.');
    return null;
  }
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Câmera bloqueada', 'Permita o acesso à câmera nos Ajustes do iPhone.');
      return null;
    }
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return null;
  const r = await OrbitaDocs.readImage(res.assets[0].uri);
  return { infos: lerTexto(r.text, r.codes), texto: r.text, origem: 'foto' };
}

/** PDF do app Arquivos, do Mail ou de um download. Pede a senha se estiver protegido (muitos usam o CPF). */
export async function dePdf(): Promise<Lido | null> {
  if (!OrbitaDocs) {
    Alert.alert('Disponível no app instalado', 'A leitura de PDF funciona no app do iPhone, não na prévia.');
    return null;
  }
  const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (res.canceled || !res.assets[0]) return null;
  const uri = res.assets[0].uri;
  let r = await OrbitaDocs.readPdf(uri, null);
  if (r.locked) {
    const pass = await askPassword();
    if (pass === null) return null;
    r = await OrbitaDocs.readPdf(uri, pass);
    if (r.locked) {
      Alert.alert('Senha errada', 'Não consegui abrir o PDF com essa senha.');
      return null;
    }
  }
  let arquivo: string | undefined;
  try {
    arquivo = keepFile(uri, 'pdf');
  } catch (e) {
    avisar('guardar o PDF do boleto', e);
  }
  return { infos: lerTexto(r.text, r.codes), texto: r.text, arquivo, origem: 'pdf' };
}

function askPassword(): Promise<string | null> {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') return resolve(null);
    Alert.prompt(
      'PDF protegido',
      'Digite a senha do arquivo. Em boletos costuma ser o começo do CPF.',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Abrir', onPress: (v?: string) => resolve(v ?? '') },
      ],
      'secure-text',
    );
  });
}

/* ---------- avisos de vencimento ---------- */

/** Agenda aviso na véspera (19h) e no dia (9h). Devolve os ids. */
export async function agendarAvisos(b: Pick<Boleto, 'descricao' | 'valor' | 'vencimento' | 'avisos'>): Promise<string[]> {
  for (const id of b.avisos ?? []) await cancel(id);
  if (!b.vencimento || !(await ensurePermission())) return [];
  const [y, m, d] = b.vencimento.split('-').map(Number);
  const valor = b.valor ? ` · ${brl(b.valor)}` : '';
  const quando = [
    { at: new Date(y, m - 1, d - 1, 19, 0), title: `Boleto vence amanhã: ${b.descricao}${valor}` },
    { at: new Date(y, m - 1, d, 9, 0), title: `Boleto vence hoje: ${b.descricao}${valor}` },
  ];
  const ids: string[] = [];
  for (const q of quando) {
    if (q.at.getTime() <= Date.now()) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: q.title, body: 'Toque para ver o código e copiar.', sound: true, data: { url: 'orbita://boletos' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: q.at },
    }).catch(() => undefined);
    if (id) ids.push(id);
  }
  return ids;
}
export async function cancelarAvisos(ids?: string[]) {
  for (const id of ids ?? []) await cancel(id);
}
