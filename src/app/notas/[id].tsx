import { router, useLocalSearchParams } from 'expo-router';
import { Archive, ImagePlus, Pin, PinOff, Trash } from 'lucide-react-native';
import { useEffect } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { PhotoStrip } from '@/components/Photos';
import { GlassButton, Screen, T } from '@/components/ui';
import { choosePhotos } from '@/lib/media';
import { useNotes } from '@/store/misc';
import { space, type, useColors } from '@/theme';

export default function NotaEditor() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useNotes((s) => s.notes.find((n) => n.id === id));
  const { update, remove } = useNotes.getState();

  // nota vazia (sem texto e sem foto) é descartada ao sair
  useEffect(
    () => () => {
      const n = useNotes.getState().notes.find((x) => x.id === id);
      if (n && !n.title.trim() && !n.body.trim() && !n.images?.length) useNotes.getState().remove(id);
    },
    [id],
  );

  if (!note) return null;
  const images = note.images ?? [];

  return (
    <Screen
      back
      scroll={false}
      actions={
        <>
          <GlassButton
            icon={ImagePlus}
            accessibilityLabel="Adicionar foto"
            onPress={async () => {
              const names = await choosePhotos();
              if (names.length) update(id, { images: [...images, ...names] });
            }}
          />
          <GlassButton
            icon={note.pinned ? PinOff : Pin}
            color={note.pinned ? c.accent : undefined}
            accessibilityLabel={note.pinned ? 'Desafixar' : 'Fixar'}
            onPress={() => update(id, { pinned: !note.pinned })}
          />
          <GlassButton
            icon={Archive}
            accessibilityLabel="Arquivar nota"
            onPress={() => {
              update(id, { archived: true });
              router.back();
            }}
          />
          <GlassButton
            icon={Trash}
            color={c.danger}
            accessibilityLabel="Excluir nota"
            onPress={() =>
              Alert.alert('Excluir nota?', 'O texto e as fotos serão apagados.', [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir',
                  style: 'destructive',
                  onPress: () => {
                    remove(id);
                    router.back();
                  },
                },
              ])
            }
          />
        </>
      }>
      <ScrollView keyboardDismissMode="interactive" contentContainerStyle={{ gap: space.md, paddingBottom: space.xxxl }} showsVerticalScrollIndicator={false}>
        <T v="caption" tone="faint">
          Editada {new Date(note.updatedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        </T>
        <TextInput
          value={note.title}
          onChangeText={(title) => update(id, { title })}
          placeholder="Título"
          placeholderTextColor={c.textFaint}
          selectionColor={c.accent}
          keyboardAppearance="dark"
          autoFocus={!note.title && !note.body && !images.length}
          style={[type.largeTitle, { color: c.text, fontSize: 28 }]}
        />
        {images.length > 0 && (
          <View>
            <PhotoStrip photos={images} onChange={(next) => update(id, { images: next })} size={112} />
          </View>
        )}
        <TextInput
          value={note.body}
          onChangeText={(body) => update(id, { body })}
          placeholder="Comece a escrever…"
          placeholderTextColor={c.textFaint}
          selectionColor={c.accent}
          keyboardAppearance="dark"
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          style={[type.body, { color: c.text, lineHeight: 26, minHeight: 320 }]}
        />
      </ScrollView>
    </Screen>
  );
}
