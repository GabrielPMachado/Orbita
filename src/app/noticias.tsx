import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Bookmark, BookmarkCheck, Newspaper, RefreshCw, Settings2, Trash, WifiOff } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Glass } from '@/components/Glass';
import { Skeleton } from '@/components/motion';
import { Button, Chip, Empty, Field, GlassButton, List, Row, Screen, Sheet, T, tap } from '@/components/ui';
import { fetchFeed, timeAgo, type Article } from '@/lib/rss';
import { useNews } from '@/store/modules';
import { radius, space, useColors } from '@/theme';

// cache em memória enquanto o app está aberto
let cache: { at: number; key: string; items: Article[]; failed: string[] } | null = null;

export default function Noticias() {
  const c = useColors();
  const { feeds, saved, toggleSaved } = useNews();
  const enabled = feeds.filter((f) => f.enabled);
  const key = enabled.map((f) => f.id).join(',');
  const [items, setItems] = useState<Article[]>(cache?.key === key ? cache.items : []);
  const [failed, setFailed] = useState<string[]>(cache?.key === key ? cache.failed : []);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState<string>('Tudo');
  const [manage, setManage] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled(enabled.map((f) => fetchFeed(f.url, f.name, f.topic)));
    const all: Article[] = [];
    const bad: string[] = [];
    results.forEach((r, i) => (r.status === 'fulfilled' ? all.push(...r.value) : bad.push(enabled[i].name)));
    const seen = new Set<string>();
    const merged = all
      .filter((a) => (seen.has(a.link) ? false : (seen.add(a.link), true)))
      .sort((a, b) => (b.date ?? 0) - (a.date ?? 0))
      .slice(0, 150);
    cache = { at: Date.now(), key, items: merged, failed: bad };
    setItems(merged);
    setFailed(bad);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!cache || cache.key !== key || Date.now() - cache.at > 10 * 60_000) load();
  }, [key, load]);

  const topics = ['Tudo', ...Array.from(new Set(enabled.map((f) => f.topic))), 'Salvos'];
  const isSaved = (link: string) => saved.some((s) => s.link === link);
  const list: Article[] =
    topic === 'Salvos'
      ? saved.map((s) => ({ title: s.title, link: s.link, source: s.source, topic: '', date: s.date ? Number(s.date) : undefined }))
      : items.filter((a) => topic === 'Tudo' || a.topic === topic);

  const open = (url: string) => {
    tap();
    WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET, controlsColor: c.accent }).catch(
      () => {},
    );
  };

  const [hero, ...rest] = list;

  return (
    <>
      <Screen
        back
        onRefresh={load}
        title="Notícias"
        subtitle={cache ? `Atualizado ${timeAgo(cache.at)} · ${enabled.length} portais` : `${enabled.length} portais`}
        actions={
          <>
            <GlassButton icon={RefreshCw} accessibilityLabel="Atualizar" onPress={load} />
            <GlassButton icon={Settings2} accessibilityLabel="Portais" onPress={() => setManage(true)} />
          </>
        }>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -space.lg }}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
          {topics.map((t) => (
            <Chip key={t} label={t === 'Salvos' ? `Salvos ${saved.length || ''}`.trim() : t} active={topic === t} onPress={() => setTopic(t)} />
          ))}
        </ScrollView>

        {loading && !items.length ? (
          <View style={{ gap: space.md }}>
            <Glass style={[styles.hero, { padding: space.lg, gap: space.sm }]}>
              <Skeleton height={170} />
              <Skeleton height={12} width="35%" />
              <Skeleton height={20} />
              <Skeleton height={20} width="70%" />
            </Glass>
            {[0, 1, 2, 3].map((i) => (
              <Glass key={i} style={{ borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', gap: space.md }}>
                <View style={{ flex: 1, gap: space.sm }}>
                  <Skeleton height={10} width="30%" />
                  <Skeleton height={16} />
                  <Skeleton height={16} width="60%" />
                </View>
                <Skeleton height={72} width={72} />
              </Glass>
            ))}
          </View>
        ) : list.length === 0 ? (
          topic === 'Salvos' ? (
            <Empty icon={Bookmark} title="Nada salvo" hint="Toque no marcador de uma notícia para ler depois." />
          ) : (
            <Empty
              icon={failed.length ? WifiOff : Newspaper}
              title={failed.length ? 'Não deu para carregar' : 'Sem notícias'}
              hint={failed.length ? `Verifique a internet. Falharam: ${failed.join(', ')}.` : 'Ative portais em Portais.'}
              action="Tentar de novo"
              onAction={load}
            />
          )
        ) : (
          <>
            {hero && (
              <Pressable onPress={() => open(hero.link)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Glass style={styles.hero}>
                  {hero.image ? <Image source={{ uri: hero.image }} style={styles.heroImg} contentFit="cover" transition={200} /> : null}
                  <View style={{ padding: space.lg, gap: space.xs }}>
                    <T v="overline" tone="accent">
                      {hero.source} {hero.date ? `· ${timeAgo(hero.date)}` : ''}
                    </T>
                    <T v="title" numberOfLines={3}>
                      {hero.title}
                    </T>
                    {hero.summary ? (
                      <T v="callout" tone="dim" numberOfLines={3}>
                        {hero.summary}
                      </T>
                    ) : null}
                  </View>
                </Glass>
              </Pressable>
            )}
            <List>
              {rest.map((a) => (
                <Pressable
                  key={a.link}
                  onPress={() => open(a.link)}
                  style={({ pressed }) => [styles.item, pressed && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <T v="caption" tone="dim">
                      {a.source} {a.date ? `· ${timeAgo(a.date)}` : ''}
                    </T>
                    <T v="headline" numberOfLines={3} style={{ fontSize: 15 }}>
                      {a.title}
                    </T>
                  </View>
                  {a.image ? <Image source={{ uri: a.image }} style={styles.thumb} contentFit="cover" transition={150} /> : null}
                  <Pressable
                    accessibilityLabel={isSaved(a.link) ? 'Remover dos salvos' : 'Salvar'}
                    hitSlop={10}
                    onPress={() => {
                      tap();
                      toggleSaved({ title: a.title, link: a.link, source: a.source, date: a.date ? String(a.date) : undefined });
                    }}>
                    {isSaved(a.link) ? <BookmarkCheck size={18} color={c.accent} /> : <Bookmark size={18} color={c.textFaint} />}
                  </Pressable>
                </Pressable>
              ))}
            </List>
            {failed.length > 0 && (
              <T v="caption" tone="faint" align="center">
                Sem resposta de: {failed.join(', ')}
              </T>
            )}
          </>
        )}
      </Screen>
      <FeedsSheet open={manage} onClose={() => setManage(false)} />
    </>
  );
}

function FeedsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const c = useColors();
  const { feeds, toggleFeed, addFeed, removeFeed } = useNews();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  return (
    <Sheet visible={open} onClose={onClose} title="Portais">
      <List>
        {feeds.map((f) => (
          <Row
            key={f.id}
            title={f.name}
            subtitle={f.topic}
            trailing={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                {!['g1', 'folha', 'tecnoblog', 'canaltech', 'olhar', 'infomoney'].includes(f.id) && (
                  <Pressable accessibilityLabel="Remover portal" hitSlop={8} onPress={() => removeFeed(f.id)}>
                    <Trash size={16} color={c.textFaint} />
                  </Pressable>
                )}
                <Switch
                  value={f.enabled}
                  onValueChange={() => toggleFeed(f.id)}
                  trackColor={{ true: c.accent, false: c.surface3 }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={c.surface3}
                />
              </View>
            }
          />
        ))}
      </List>
      <T v="overline" tone="dim">
        Adicionar feed RSS
      </T>
      <Field value={name} onChangeText={setName} placeholder="Nome (ex.: GZH)" />
      <Field value={url} onChangeText={setUrl} placeholder="https://…/feed" autoCapitalize="none" keyboardType="url" />
      <Field value={topic} onChangeText={setTopic} placeholder="Tema (ex.: Porto Alegre)" />
      <Button
        label="Adicionar"
        disabled={!name.trim() || !/^https?:\/\//.test(url.trim())}
        onPress={() => {
          addFeed({ name: name.trim(), url: url.trim(), topic: topic.trim() || 'Outros' });
          setName('');
          setUrl('');
          setTopic('');
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, overflow: 'hidden' },
  heroImg: { width: '100%', aspectRatio: 16 / 9 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  thumb: { width: 72, height: 72, borderRadius: 12 },
});
