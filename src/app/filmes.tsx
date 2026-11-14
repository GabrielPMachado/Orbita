import { Image } from 'expo-image';
import { Clapperboard, Film, ImagePlus, Minus, Plus, Trash, Tv } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Stars, confirmDelete } from '@/components/extra';
import { Glass } from '@/components/Glass';
import { Button, Chip, Empty, Field, GlassButton, Screen, Segmented, Sheet, T, tap } from '@/components/ui';
import { friendlyDate, today } from '@/lib/date';
import { choosePhotos, deleteMedia, mediaUri } from '@/lib/media';
import { useTitles, type Title, type WatchStatus } from '@/store/modules';
import { radius, space, useColors } from '@/theme';

const STATUS: { value: WatchStatus; label: string }[] = [
  { value: 'vendo', label: 'Assistindo' },
  { value: 'quero', label: 'Quero ver' },
  { value: 'visto', label: 'Vistos' },
];
const PLATFORMS = ['Netflix', 'Prime Video', 'Max', 'Disney+', 'Apple TV+', 'Globoplay', 'Cinema', 'Outro'];

export default function Filmes() {
  const c = useColors();
  const titles = useTitles((s) => s.items);
  const update = useTitles((s) => s.update);
  const [tab, setTab] = useState<WatchStatus>('vendo');
  const [kind, setKind] = useState<'todos' | 'filme' | 'serie'>('todos');
  const [editing, setEditing] = useState<Title | 'new' | null>(null);

  const list = titles.filter((t) => t.status === tab && (kind === 'todos' || t.kind === kind));
  const count = (s: WatchStatus) => titles.filter((t) => t.status === s).length;

  return (
    <>
      <Screen back title="Filmes e Séries" subtitle={`${count('visto')} vistos · ${count('quero')} na lista`} actions={<GlassButton icon={Plus} label="Adicionar" onPress={() => setEditing('new')} />}>
        <Segmented value={tab} onChange={setTab} options={STATUS.map((s) => ({ ...s, count: count(s.value) }))} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Chip label="Tudo" active={kind === 'todos'} onPress={() => setKind('todos')} />
          <Chip label="Filmes" icon={Film} active={kind === 'filme'} onPress={() => setKind('filme')} />
          <Chip label="Séries" icon={Tv} active={kind === 'serie'} onPress={() => setKind('serie')} />
        </View>

        {list.length === 0 ? (
          <Empty
            icon={Clapperboard}
            title={tab === 'vendo' ? 'Nada em andamento' : tab === 'quero' ? 'Lista vazia' : 'Nenhum visto ainda'}
            hint="Guarde o que quer ver, acompanhe o episódio da série e dê nota no final."
            action="Adicionar título"
            onAction={() => setEditing('new')}
          />
        ) : (
          <View style={styles.grid}>
            {list.map((t) => (
              <Pressable key={t.id} onPress={() => setEditing(t)} style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.8 : 1 }]}>
                <Glass style={styles.poster}>
                  {t.poster ? (
                    <Image source={{ uri: mediaUri(t.poster) }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <View style={styles.placeholder}>
                      {t.kind === 'filme' ? <Film size={28} color={c.textFaint} /> : <Tv size={28} color={c.textFaint} />}
                      <T v="caption" tone="dim" align="center" numberOfLines={3} style={{ paddingHorizontal: space.sm }}>
                        {t.name}
                      </T>
                    </View>
                  )}
                </Glass>
                <T v="caption" numberOfLines={1} style={{ fontSize: 13 }}>
                  {t.name}
                </T>
                {t.kind === 'serie' && t.status === 'vendo' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <T v="caption" tone="dim" tabular>
                      T{t.season ?? 1} · E{t.episode ?? 1}
                    </T>
                    <Pressable
                      accessibilityLabel="Próximo episódio"
                      hitSlop={8}
                      onPress={() => {
                        tap();
                        update(t.id, { episode: (t.episode ?? 1) + 1 });
                      }}>
                      <Plus size={14} color={c.accent} />
                    </Pressable>
                  </View>
                ) : t.rating ? (
                  <Stars value={t.rating} size={11} />
                ) : (
                  <T v="caption" tone="faint" numberOfLines={1}>
                    {t.platform ?? (t.kind === 'filme' ? 'Filme' : 'Série')}
                  </T>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </Screen>
      <TitleSheet editing={editing} defaultStatus={tab} onClose={() => setEditing(null)} />
    </>
  );
}

function TitleSheet({ editing, defaultStatus, onClose }: { editing: Title | 'new' | null; defaultStatus: WatchStatus; onClose: () => void }) {
  const c = useColors();
  const { add, update, remove } = useTitles.getState();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Title['kind']>('filme');
  const [status, setStatus] = useState<WatchStatus>('quero');
  const [rating, setRating] = useState<number | undefined>();
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [platform, setPlatform] = useState<string | undefined>();
  const [poster, setPoster] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [key, setKey] = useState<string | null>(null);

  const k = editing === 'new' ? 'new' : editing?.id ?? null;
  if (k !== key) {
    setKey(k);
    const e = editing && editing !== 'new' ? editing : undefined;
    setName(e?.name ?? '');
    setKind(e?.kind ?? 'filme');
    setStatus(e?.status ?? defaultStatus);
    setRating(e?.rating);
    setSeason(e?.season ?? 1);
    setEpisode(e?.episode ?? 1);
    setPlatform(e?.platform);
    setPoster(e?.poster);
    setNotes(e?.notes ?? '');
  }

  const save = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      kind,
      status,
      rating,
      season: kind === 'serie' ? season : undefined,
      episode: kind === 'serie' ? episode : undefined,
      platform,
      poster,
      notes: notes.trim() || undefined,
      watchedAt: status === 'visto' ? (editing !== 'new' && editing?.watchedAt) || today() : undefined,
    };
    if (editing === 'new') add(data);
    else if (editing) update(editing.id, data);
    onClose();
  };

  const counter = (label: string, v: number, set: (n: number) => void) => (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <T v="callout" tone="dim">
        {label}
      </T>
      <Pressable accessibilityLabel={`Diminuir ${label}`} onPress={() => set(Math.max(1, v - 1))} hitSlop={8}>
        <Minus size={16} color={c.textDim} />
      </Pressable>
      <T v="headline" tabular>
        {v}
      </T>
      <Pressable accessibilityLabel={`Aumentar ${label}`} onPress={() => set(v + 1)} hitSlop={8}>
        <Plus size={16} color={c.accent} />
      </Pressable>
    </View>
  );

  return (
    <Sheet visible={!!editing} onClose={onClose} title={editing === 'new' ? 'Novo título' : 'Detalhes'}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Pressable
          accessibilityLabel="Capa"
          onPress={async () => {
            const [p] = await choosePhotos({ multiple: false, title: 'Capa' });
            if (p) {
              if (poster) deleteMedia(poster);
              setPoster(p);
            }
          }}>
          <Glass interactive style={{ width: 84, height: 124, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }}>
            {poster ? <Image source={{ uri: mediaUri(poster) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ImagePlus size={22} color={c.textDim} />}
          </Glass>
        </Pressable>
        <View style={{ flex: 1, gap: space.sm }}>
          <Field value={name} onChangeText={setName} placeholder="Nome" autoFocus={editing === 'new'} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Chip label="Filme" icon={Film} active={kind === 'filme'} onPress={() => setKind('filme')} />
            <Chip label="Série" icon={Tv} active={kind === 'serie'} onPress={() => setKind('serie')} />
          </View>
        </View>
      </View>
      <Segmented value={status} onChange={setStatus} options={STATUS} />
      {kind === 'serie' && (
        <View style={{ flexDirection: 'row' }}>
          {counter('Temporada', season, setSeason)}
          {counter('Episódio', episode, setEpisode)}
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {PLATFORMS.map((p) => (
          <Chip key={p} label={p} active={platform === p} onPress={() => setPlatform(platform === p ? undefined : p)} />
        ))}
      </View>
      {status === 'visto' && (
        <View style={{ gap: space.sm }}>
          <T v="overline" tone="dim">
            Sua nota
          </T>
          <Stars value={rating} onChange={setRating} size={30} />
        </View>
      )}
      <Field value={notes} onChangeText={setNotes} placeholder="Comentário (opcional)" multiline style={{ minHeight: 64, textAlignVertical: 'top' }} />
      {editing && editing !== 'new' && editing.watchedAt ? (
        <T v="caption" tone="faint">
          Visto {friendlyDate(editing.watchedAt).toLowerCase()}
        </T>
      ) : null}
      <Button label="Salvar" onPress={save} disabled={!name.trim()} />
      {editing && editing !== 'new' && (
        <Button
          label="Excluir"
          icon={Trash}
          variant="danger"
          onPress={() =>
            confirmDelete('Excluir título?', editing.name, () => {
              if (editing.poster) deleteMedia(editing.poster);
              remove(editing.id);
              onClose();
            })
          }
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { width: '30.5%', gap: 4 },
  poster: { aspectRatio: 2 / 3, borderRadius: radius.sm, overflow: 'hidden' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
