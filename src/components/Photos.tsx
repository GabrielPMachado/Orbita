import { Image } from 'expo-image';
import { ImagePlus, Trash, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { choosePhotos, deleteMedia, mediaUri } from '@/lib/media';
import { radius, space, useColors } from '@/theme';
import { GlassButton, T, tap } from './ui';

/** Tela cheia para ver uma foto, com opção de excluir. */
export function ImageViewer({ name, onClose, onDelete }: { name: string | null; onClose: () => void; onDelete?: (name: string) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!name} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {name && <Image source={{ uri: mediaUri(name) }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />}
        <View style={[styles.viewerBar, { top: insets.top + space.sm }]}>
          <GlassButton icon={X} onPress={onClose} accessibilityLabel="Fechar" />
          {onDelete && name ? (
            <GlassButton
              icon={Trash}
              color="#F26464"
              accessibilityLabel="Excluir foto"
              onPress={() =>
                Alert.alert('Excluir foto?', undefined, [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: () => {
                      onDelete(name);
                      onClose();
                    },
                  },
                ])
              }
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Faixa de fotos com botão de adicionar.
 * Recebe os nomes salvos e devolve a lista atualizada em onChange.
 */
export function PhotoStrip({
  photos,
  onChange,
  size = 88,
  addLabel = 'Foto',
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  size?: number;
  addLabel?: string;
}) {
  const c = useColors();
  const [viewing, setViewing] = useState<string | null>(null);

  const add = async () => {
    const names = await choosePhotos();
    if (names.length) onChange([...photos, ...names]);
  };
  const remove = (name: string) => {
    deleteMedia(name);
    onChange(photos.filter((p) => p !== name));
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {photos.map((p) => (
          <Pressable
            key={p}
            accessibilityLabel="Abrir foto"
            onPress={() => {
              tap();
              setViewing(p);
            }}>
            <Image
              source={{ uri: mediaUri(p) }}
              style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: c.surface2 }}
              contentFit="cover"
              transition={120}
            />
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adicionar foto"
          onPress={() => {
            tap();
            add();
          }}
          style={({ pressed }) => [
            styles.add,
            { width: size, height: size, borderColor: c.border, backgroundColor: pressed ? c.surface3 : c.surface2 },
          ]}>
          <ImagePlus size={22} color={c.textDim} strokeWidth={1.8} />
          <T v="caption" tone="dim" style={{ fontSize: 11 }}>
            {addLabel}
          </T>
        </Pressable>
      </ScrollView>
      <ImageViewer name={viewing} onClose={() => setViewing(null)} onDelete={remove} />
    </>
  );
}

const styles = StyleSheet.create({
  viewerBar: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
  add: { borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
});
