import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { uid } from './storage';
import { avisar } from '@/lib/avisar';

/**
 * Fotos ficam numa pasta própria dentro de Documents do app.
 * No dado salvamos só o NOME do arquivo — o caminho do container do iOS muda
 * entre instalações, então o URI completo é montado na hora (mediaUri).
 */
const DIR = 'media';
const isWeb = Platform.OS === 'web';

function mediaDir() {
  const d = new Directory(Paths.document, DIR);
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

export function mediaUri(name: string): string {
  if (/^(file|blob|data|https?):/.test(name)) return name;
  return new File(Paths.document, DIR, name).uri;
}

export function deleteMedia(name: string) {
  if (isWeb || /^(blob|data|https?):/.test(name)) return;
  try {
    const f = new File(Paths.document, DIR, name);
    if (f.exists) f.delete();
  } catch (e) {
    avisar('apagar a mídia', e);
  }
}

async function persist(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (isWeb) return asset.uri;
  const ext = (asset.fileName?.split('.').pop() ?? asset.uri.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 4);
  const name = `${uid()}.${ext}`;
  const src = new File(asset.uri);
  src.copySync(new File(mediaDir(), name));
  return name;
}

type Source = 'camera' | 'library';

async function pick(source: Source, multiple: boolean): Promise<string[]> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Câmera bloqueada', 'Permita o acesso à câmera nos Ajustes do iPhone.');
      return [];
    }
  }
  const opts: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: multiple && source === 'library',
    selectionLimit: multiple ? 10 : 1,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled) return [];
  const out: string[] = [];
  for (const a of res.assets) {
    try {
      out.push(await persist(a));
    } catch {
      Alert.alert('Não foi possível salvar a foto', 'Tente novamente.');
    }
  }
  return out;
}

/** Pergunta "Câmera ou Galeria" com a folha de ações nativa e devolve os nomes salvos. */
export function choosePhotos({ multiple = true, title = 'Adicionar foto' } = {}): Promise<string[]> {
  return new Promise((resolve) => {
    if (isWeb) {
      pick('library', multiple).then(resolve);
      return;
    }
    const run = (s: Source) => pick(s, multiple).then(resolve);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title, options: ['Tirar foto', 'Escolher da galeria', 'Cancelar'], cancelButtonIndex: 2, userInterfaceStyle: 'dark' },
        (i) => (i === 0 ? run('camera') : i === 1 ? run('library') : resolve([])),
      );
    } else {
      Alert.alert(title, undefined, [
        { text: 'Tirar foto', onPress: () => run('camera') },
        { text: 'Galeria', onPress: () => run('library') },
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve([]) },
      ]);
    }
  });
}

/** Guarda uma cópia de um arquivo qualquer (PDF de boleto…) na pasta do app e devolve o nome. */
export function keepFile(uri: string, ext: string): string {
  if (isWeb) return uri;
  const name = `${uid()}.${ext.toLowerCase().slice(0, 4)}`;
  new File(uri).copySync(new File(mediaDir(), name));
  return name;
}
