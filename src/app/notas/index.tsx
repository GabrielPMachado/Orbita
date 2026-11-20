import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Images, Library, Pin, Plus, Search } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { Card, Empty, GlassButton, Screen, Section, T } from '@/components/ui';
import { mediaUri } from '@/lib/media';
import { useNotes, type Note } from '@/store/misc';
import { radius, space, type, useColors } from '@/theme';

export default function Notas() {
  const c = useColors();
  const allNotes = useNotes((s) => s.notes);
  const notes = allNotes.filter((n) => !n.archived);
  const create = useNotes((s) => s.create);
  const [q, setQ] = useState('');

  const list = notes.filter((n) => (n.title + ' ' + n.body).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt);
  const pinned = list.filter((n) => n.pinned);
  const others = list.filter((n) => !n.pinned);
  const newNote = () => router.push(`/notas/${create()}`);

  const card = (n: Note) => (
    <Card key={n.id} onPress={() => router.push(`/notas/${n.id}`)} style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {n.pinned && <Pin size={14} color={c.accent} />}
        <T v="headline" numberOfLines={1} style={{ flex: 1 }}>
          {n.title || 'Sem título'}
        </T>
        <T v="caption" tone="faint">
          {new Date(n.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1, gap: space.xs }}>
          {n.body ? (
            <T v="callout" tone="dim" numberOfLines={3}>
              {n.body}
            </T>
          ) : null}
          {n.images && n.images.length > 1 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Images size={12} color={c.textFaint} />
              <T v="caption" tone="faint">
                {n.images.length} fotos
              </T>
            </View>
          ) : null}
        </View>
        {n.images?.[0] ? (
          <Image
            source={{ uri: mediaUri(n.images[0]) }}
            style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: c.surface2 }}
            contentFit="cover"
          />
        ) : null}
      </View>
    </Card>
  );

  return (
    <Screen
      back
      title="Notas"
      subtitle={notes.length ? `${notes.length} ${notes.length === 1 ? 'nota' : 'notas'}` : undefined}
      actions={<GlassButton icon={Plus} label="Nova" onPress={newNote} />}>
      {notes.length > 0 && (
        <Glass style={styles.search}>
          <Search size={18} color={c.textFaint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar nas notas"
            placeholderTextColor={c.textFaint}
            selectionColor={c.accent}
            keyboardAppearance="dark"
            style={[type.body, { flex: 1, color: c.text }]}
          />
        </Glass>
      )}
      {notes.length === 0 && (
        <Empty icon={Library} title="Nenhuma nota" hint="Ideias, resumos, listas — tudo num lugar só." action="Escrever nota" onAction={newNote} />
      )}
      {pinned.length > 0 && <Section title="Fixadas">{pinned.map(card)}</Section>}
      {others.length > 0 && <Section title={pinned.length ? 'Outras' : 'Recentes'}>{others.map(card)}</Section>}
      {notes.length > 0 && list.length === 0 && (
        <T v="callout" tone="dim" align="center">
          Nada encontrado para “{q}”.
        </T>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 48, paddingHorizontal: space.lg, borderRadius: radius.sm },
});
