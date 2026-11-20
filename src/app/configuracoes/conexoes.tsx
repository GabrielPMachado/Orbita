import { router } from 'expo-router';
import { CheckCircle2, KeyRound, LogIn, PlugZap, XCircle } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Switch, View } from 'react-native';
import { StatusBadge, useConnections, type Conn } from '@/components/connections';
import { EstacioWeb } from '@/components/EstacioWeb';
import { Button, Field, IconTile, List, Row, Screen, Section, T } from '@/components/ui';
import { PORTAL } from '@/lib/estacioApi';
import { saveTmdbKey } from '@/lib/tmdb';
import { useEstacio } from '@/store/estacio';
import { toast } from '@/store/toast';
import { space, useColors } from '@/theme';

type Resultado = { ok: boolean; msg: string; at: number };

/**
 * Abre o portal escondido e vê se a sessão ainda vale: chegou ao portal com conteúdo = conectado;
 * caiu no login da Microsoft = sessão expirada.
 */
function EstacioProbe({ onResult }: { onResult: (ok: boolean, msg: string) => void }) {
  const done = useRef(false);
  const last = useRef<{ url: string; login: boolean } | null>(null);
  const finish = useCallback(
    (ok: boolean, msg: string) => {
      if (done.current) return;
      done.current = true;
      onResult(ok, msg);
    },
    [onResult],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      const l = last.current;
      if (l && /estudante\.estacio\.br/.test(l.url) && !l.login) finish(true, 'O portal abriu com a sua sessão');
      else finish(false, l ? 'O portal não respondeu direito. Tente de novo.' : 'Sem resposta do portal. Confira a internet.');
    }, 30_000);
    return () => clearTimeout(t);
  }, [finish]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -20, top: 0, width: 2, height: 2, opacity: 0 }}>
      <EstacioWeb
        initialUrl={PORTAL.inicio}
        onPage={(p) => {
          last.current = p;
          if (p.login || /login\.microsoftonline\.com|login\.live\.com/.test(p.url)) {
            useEstacio.getState().set({ needsLogin: true });
            finish(false, 'A sessão expirou. Toque em "Entrar de novo".');
          } else if (/estudante\.estacio\.br/.test(p.url) && p.chars > 150) {
            useEstacio.getState().set({ needsLogin: false, connected: true });
            finish(true, 'Sessão ativa: o portal abriu com os seus dados');
          }
        }}
      />
    </View>
  );
}

export default function Conexoes() {
  const c = useColors();
  const auto = useEstacio((s) => s.auto);
  const setEst = useEstacio((s) => s.set);
  const [open, setOpen] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Resultado>>({});
  const [probe, setProbe] = useState<((ok: boolean, msg: string) => void) | null>(null);
  const [tmdbKey, setTmdbKey] = useState('');
  const [saving, setSaving] = useState(false);

  const probeEstacio = useCallback(
    () =>
      new Promise<string>((resolve, reject) =>
        setProbe(() => (ok: boolean, msg: string) => {
          setProbe(null);
          if (ok) resolve(msg);
          else reject(new Error(msg));
        }),
      ),
    [],
  );
  const conns = useConnections({ probeEstacio });
  const groups = [...new Set(conns.map((x) => x.group))];

  const testar = async (x: Conn) => {
    if (!x.test || testing) return;
    setTesting(x.id);
    try {
      const msg = await x.test();
      setResults((r) => ({ ...r, [x.id]: { ok: true, msg, at: Date.now() } }));
    } catch (e) {
      setResults((r) => ({ ...r, [x.id]: { ok: false, msg: e instanceof Error ? e.message : 'Falhou', at: Date.now() } }));
    } finally {
      setTesting(null);
    }
  };

  const salvarTmdb = async () => {
    setSaving(true);
    try {
      await saveTmdbKey(tmdbKey);
      setTmdbKey('');
      setResults((r) => ({ ...r, tmdb: { ok: true, msg: 'Chave salva e aceita pelo TMDB', at: Date.now() } }));
    } catch (e) {
      toast({ message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const painel = (x: Conn) => {
    const r = results[x.id];
    const busy = testing === x.id;
    return (
      <View style={{ gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg }}>
        {x.id === 'tmdb' && x.status === 'off' ? (
          <>
            <Field
              value={tmdbKey}
              onChangeText={setTmdbKey}
              placeholder="Token de leitura ou chave da API"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Button
              label={saving ? 'Testando…' : 'Salvar e testar'}
              icon={KeyRound}
              onPress={salvarTmdb}
              disabled={saving || tmdbKey.trim().length < 20}
            />
            <T v="caption" tone="faint">
              Em themoviedb.org › Configurações › API, copie o &quot;Token de leitura da API&quot;.
            </T>
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {x.login ? (
              <Button
                label={x.login.label}
                icon={LogIn}
                variant={x.status === 'ok' ? 'secondary' : 'primary'}
                onPress={() => void x.login!.run()}
                style={{ flex: 1 }}
              />
            ) : null}
            {x.test ? (
              <Button
                label={busy ? 'Testando…' : 'Testar conexão'}
                icon={PlugZap}
                variant={x.status === 'ok' ? 'primary' : 'secondary'}
                onPress={() => testar(x)}
                disabled={!!testing}
                style={{ flex: 1 }}
              />
            ) : null}
          </View>
        )}
        {busy ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <ActivityIndicator size="small" color={c.textDim} />
            <T v="caption" tone="dim">
              {x.id === 'estacio' ? 'Abrindo o portal (até 30 s)…' : 'Testando…'}
            </T>
          </View>
        ) : r ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            {r.ok ? <CheckCircle2 size={16} color={c.success} /> : <XCircle size={16} color={c.danger} />}
            <T v="caption" tone={r.ok ? 'success' : 'danger'} style={{ flex: 1 }}>
              {r.msg}
            </T>
          </View>
        ) : null}
        {x.route ? (
          <Pressable onPress={() => router.push(x.route as never)} hitSlop={8}>
            <T v="caption" tone="accent">
              Ver detalhes ›
            </T>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <Screen back title="Contas e conexões" subtitle="Toque numa conexão para entrar ou testar">
      {groups.map((g) => (
        <Section key={g} title={g}>
          <List>
            {conns
              .filter((x) => x.group === g)
              .map((x) => (
                <View key={x.id}>
                  <Row
                    leading={<IconTile icon={x.icon} color={x.status === 'off' ? c.textFaint : x.color} />}
                    title={x.name}
                    subtitle={x.detail}
                    subtitleTone={x.status === 'warn' ? 'warning' : 'dim'}
                    trailing={<StatusBadge status={x.status} />}
                    onPress={() => setOpen((o) => (o === x.id ? null : x.id))}
                  />
                  {open === x.id ? painel(x) : null}
                </View>
              ))}
            {g === 'Faculdade' ? (
              <Row
                title="Ler pelo app também"
                subtitle="Uma vez por dia, com o app aberto, se a nuvem não tiver lido"
                trailing={<Switch value={auto} onValueChange={(v) => setEst({ auto: v })} trackColor={{ true: c.accent, false: c.surface3 }} />}
              />
            ) : null}
          </List>
        </Section>
      ))}

      <T v="caption" tone="faint">
        Senhas e chaves ficam no Keychain do iPhone. O Órbita nunca pede a senha do banco: as finanças vêm do Financy e do Open Finance.
      </T>

      {probe ? <EstacioProbe onResult={probe} /> : null}
    </Screen>
  );
}
