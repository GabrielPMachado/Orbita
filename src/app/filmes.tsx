import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Clapperboard, ExternalLink, Film, ImagePlus, KeyRound, Minus, Plus, Search, Trash, Tv } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Advanced } from '@/components/Advanced';
import { Stars, confirmDelete } from '@/components/extra';
import { Glass } from '@/components/Glass';
import { Button, Chip, Empty, Field, GlassButton, Screen, Segmented, Sheet, T, tap } from '@/components/ui';
import {
  loadTmdbKey,
  removeTmdbKey,
  saveTmdbKey,
  searchTitles,
  shortProvider,
  titleDetails,
  TMDB_IMG,
  useTmdbKey,
  type Providers,
  type TmdbDetails,
  type TmdbHit,
} from '@/lib/tmdb';
import { toast } from '@/store/toast';
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

  const hasKey = useTmdbKey((st) => st.has);
  useEffect(() => loadTmdbKey(), []);
  // "onde assistir" muda: atualiza em segundo plano o que está na lista há mais de 5 dias
  useEffect(() => {
    if (!hasKey) return;
    const old = useTitles
      .getState()
      .items.filter((t) => t.tmdbId && t.status !== 'visto' && Date.now() - (t.providersAt ?? 0) > 5 * 864e5)
      .slice(0, 8);
    old.forEach((t, i) =>
      setTimeout(() => {
        titleDetails(t.tmdbId!, t.kind)
          .then((d) => update(t.id, { providers: d.providers, providersAt: Date.now(), seasons: d.seasons ?? t.seasons }))
          .catch(() => {});
      }, i * 400),
    );
  }, [hasKey, update]);

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
                  {t.poster || t.posterPath ? (
                    <Image
                      source={{ uri: t.poster ? mediaUri(t.poster) : TMDB_IMG(t.posterPath!) }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="disk"
                    />
                  ) : (
                    <View style={styles.placeholder}>
                      {t.kind === 'filme' ? <Film size={28} color={c.textFaint} /> : <Tv size={28} color={c.textFaint} />}
                      <T v="caption" tone="dim" align="center" numberOfLines={3} style={{ paddingHorizontal: space.sm }}>
                        {t.name}
                      </T>
                    </View>
                  )}
                  {t.providers?.stream[0]?.logo ? (
                    <Image source={{ uri: TMDB_IMG(t.providers.stream[0].logo, 'w92') }} style={styles.badge} accessibilityLabel={t.providers.stream[0].name} />
                  ) : null}
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
                    {t.platform ?? (t.year ? `${t.kind === 'filme' ? 'Filme' : 'Série'} · ${t.year}` : t.kind === 'filme' ? 'Filme' : 'Série')}
                  </T>
                )}
              </Pressable>
            ))}
          </View>
        )}
        {hasKey ? (
          <Advanced>
            <Button
              label="Remover chave do TMDB"
              icon={KeyRound}
              variant="secondary"
              onPress={() => removeTmdbKey().then(() => toast({ message: 'Chave removida' }))}
            />
          </Advanced>
        ) : null}
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
  const [info, setInfo] = useState<Partial<TmdbDetails> & { id?: number }>({});
  const [key, setKey] = useState<string | null>(null);
  const hasKey = useTmdbKey((st) => st.has);
  const [hits, setHits] = useState<TmdbHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);

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
    setInfo(
      e?.tmdbId
        ? { id: e.tmdbId, poster: e.posterPath, overview: e.overview, year: e.year, genres: e.genres, vote: e.vote, runtime: e.runtime, seasons: e.seasons, providers: e.providers }
        : {},
    );
    setHits([]);
    setPicked(!!e);
  }

  // busca enquanto digita (só para título novo e ainda não escolhido)
  const seq = useRef(0);
  useEffect(() => {
    if (!editing || picked || !hasKey || name.trim().length < 2) {
      setHits([]);
      return;
    }
    const my = ++seq.current;
    setSearching(true);
    const t = setTimeout(() => {
      searchTitles(name)
        .then((r) => my === seq.current && setHits(r))
        .catch(() => my === seq.current && setHits([]))
        .finally(() => my === seq.current && setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [name, picked, hasKey, editing]);

  // ao abrir um título já salvo: atualiza onde assistir se estiver velho
  useEffect(() => {
    if (!editing || editing === 'new' || !editing.tmdbId || !hasKey) return;
    if (Date.now() - (editing.providersAt ?? 0) < 864e5) return;
    titleDetails(editing.tmdbId, editing.kind)
      .then((d) => {
        setInfo((i) => ({ ...i, providers: d.providers, seasons: d.seasons ?? i.seasons }));
        update(editing.id, { providers: d.providers, providersAt: Date.now() });
      })
      .catch(() => {});
  }, [editing, hasKey, update]);

  const pick = async (h: TmdbHit) => {
    tap();
    setPicked(true);
    setHits([]);
    setName(h.name);
    setKind(h.kind);
    setInfo({ id: h.id, poster: h.poster, overview: h.overview, year: h.year });
    setLoadingInfo(true);
    try {
      const d = await titleDetails(h.id, h.kind);
      setInfo({ ...d, id: h.id });
      const first = d.providers.stream[0];
      if (first) setPlatform(shortProvider(first.name));
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : 'Não consegui buscar os detalhes' });
    } finally {
      setLoadingInfo(false);
    }
  };

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
      tmdbId: info.id,
      posterPath: info.poster,
      overview: info.overview,
      year: info.year,
      genres: info.genres,
      vote: info.vote,
      runtime: info.runtime,
      seasons: info.seasons,
      providers: info.providers,
      providersAt: info.providers ? Date.now() : undefined,
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
            {poster || info.poster ? (
              <Image source={{ uri: poster ? mediaUri(poster) : TMDB_IMG(info.poster!) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            ) : (
              <ImagePlus size={22} color={c.textDim} />
            )}
          </Glass>
        </Pressable>
        <View style={{ flex: 1, gap: space.sm }}>
          <Field
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (picked && editing === 'new') {
                setPicked(false);
                setInfo({});
              }
            }}
            placeholder={hasKey ? 'Buscar filme ou série' : 'Nome'}
            autoFocus={editing === 'new'}
            returnKeyType="search"
          />
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Chip label="Filme" icon={Film} active={kind === 'filme'} onPress={() => setKind('filme')} />
            <Chip label="Série" icon={Tv} active={kind === 'serie'} onPress={() => setKind('serie')} />
            {searching || loadingInfo ? <ActivityIndicator size="small" color={c.textDim} /> : null}
          </View>
          {info.year || info.genres?.length || info.vote ? (
            <T v="caption" tone="dim" numberOfLines={2}>
              {[info.year, info.genres?.slice(0, 2).join(', '), info.runtime ? (kind === 'filme' ? `${info.runtime} min` : `${info.runtime} min/ep`) : null, info.seasons && kind === 'serie' ? `${info.seasons} temp.` : null]
                .filter(Boolean)
                .join(' · ')}
              {info.vote ? `  ★ ${String(info.vote).replace('.', ',')}` : ''}
            </T>
          ) : null}
        </View>
      </View>

      {hits.length > 0 ? (
        <View style={{ gap: 2 }}>
          {hits.map((h) => (
            <Pressable
              key={`${h.kind}${h.id}`}
              onPress={() => pick(h)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.hit, { backgroundColor: pressed ? c.surface2 : 'transparent' }]}>
              <View style={[styles.hitThumb, { backgroundColor: c.surface2 }]}>
                {h.poster ? <Image source={{ uri: TMDB_IMG(h.poster, 'w92') }} style={StyleSheet.absoluteFill} contentFit="cover" /> : h.kind === 'filme' ? <Film size={16} color={c.textFaint} /> : <Tv size={16} color={c.textFaint} />}
              </View>
              <View style={{ flex: 1 }}>
                <T v="callout" numberOfLines={1}>
                  {h.name}
                </T>
                <T v="caption" tone="dim" numberOfLines={1}>
                  {[h.kind === 'filme' ? 'Filme' : 'Série', h.year, h.original].filter(Boolean).join(' · ')}
                </T>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!hasKey && editing === 'new' ? <TmdbSetup /> : null}

      {info.overview ? (
        <T v="callout" tone="dim" numberOfLines={5}>
          {info.overview}
        </T>
      ) : null}
      {info.providers ? <WhereToWatch p={info.providers} /> : null}
      <Segmented value={status} onChange={setStatus} options={STATUS} />
      {kind === 'serie' && (
        <View style={{ flexDirection: 'row' }}>
          {counter('Temporada', season, setSeason)}
          {counter('Episódio', episode, setEpisode)}
        </View>
      )}
      {info.providers?.stream.length ? null : (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {PLATFORMS.map((p) => (
          <Chip key={p} label={p} active={platform === p} onPress={() => setPlatform(platform === p ? undefined : p)} />
        ))}
      </View>
      )}
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

/** Onde assistir no Brasil: streaming com logo; aluguel e compra numa linha. */
function WhereToWatch({ p }: { p: Providers }) {
  const c = useColors();
  if (!p.stream.length && !p.rent.length && !p.buy.length) {
    return (
      <T v="caption" tone="faint">
        Sem streaming no Brasil no momento.
      </T>
    );
  }
  const line = (label: string, l: Providers['rent']) =>
    l.length ? (
      <T v="caption" tone="dim" numberOfLines={2}>
        {label}: {l.slice(0, 5).map((x) => shortProvider(x.name)).join(', ')}
      </T>
    ) : null;
  return (
    <View style={{ gap: space.sm }}>
      <T v="overline" tone="dim">
        Onde assistir
      </T>
      {p.stream.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {p.stream.slice(0, 6).map((x) => (
            <View key={x.id} style={[styles.prov, { backgroundColor: c.surface2 }]}>
              {x.logo ? <Image source={{ uri: TMDB_IMG(x.logo, 'w92') }} style={styles.provLogo} /> : null}
              <T v="caption">{shortProvider(x.name)}</T>
            </View>
          ))}
        </View>
      ) : null}
      {line('Alugar', p.rent)}
      {line('Comprar', p.buy)}
      {p.link ? (
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(p.link!, { controlsColor: c.accent }).catch(() => {})}
          hitSlop={6}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <ExternalLink size={13} color={c.accent} />
          <T v="caption" color={c.accent}>
            Abrir no serviço
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Primeira vez: colar a chave gratuita do TMDB. */
function TmdbSetup() {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [k, setK] = useState('');
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={[styles.setup, { borderColor: c.border }]}>
        <Search size={16} color={c.accent} />
        <T v="caption" tone="dim" style={{ flex: 1 }}>
          Puxar capa, sinopse e onde assistir sozinho? Toque para ligar (grátis, uma vez só).
        </T>
      </Pressable>
    );
  }
  return (
    <View style={[styles.setup, { borderColor: c.border, flexDirection: 'column', alignItems: 'stretch' }]}>
      <T v="caption" tone="dim">
        1. Crie uma conta grátis no TMDB. 2. Em Configurações › API, peça uma chave (uso pessoal). 3. Copie o “Token de leitura da API” e cole aqui.
      </T>
      <Button
        label="Abrir o TMDB"
        icon={ExternalLink}
        variant="secondary"
        onPress={() => WebBrowser.openBrowserAsync('https://www.themoviedb.org/settings/api', { controlsColor: c.accent }).catch(() => {})}
      />
      <Field value={k} onChangeText={setK} placeholder="Token de leitura da API" autoCapitalize="none" autoCorrect={false} secureTextEntry />
      <Button
        label={busy ? 'Conferindo…' : 'Salvar chave'}
        disabled={!k.trim() || busy}
        onPress={async () => {
          setBusy(true);
          try {
            await saveTmdbKey(k);
            toast({ message: 'Pronto: agora é só digitar o nome' });
          } catch (e) {
            toast({ message: e instanceof Error ? e.message : 'Chave não aceita' });
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { position: 'absolute', left: 6, bottom: 6, width: 22, height: 22, borderRadius: 6 },
  hit: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: radius.sm },
  hitThumb: { width: 36, height: 54, borderRadius: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  prov: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingLeft: 5, paddingRight: 10, borderRadius: 10 },
  provLogo: { width: 22, height: 22, borderRadius: 5 },
  setup: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  cell: { width: '30.5%', gap: 4 },
  poster: { aspectRatio: 2 / 3, borderRadius: radius.sm, overflow: 'hidden' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
