import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { ChevronLeft, Download, RotateCw, ScanSearch } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Advanced } from '@/components/Advanced';
import { EstacioWeb, type EstacioWebHandle, type SweepState } from '@/components/EstacioWeb';
import { Glass } from '@/components/Glass';
import { Button, Chip, Sheet, T, tap } from '@/components/ui';
import { ESTACIO_URLS, formato } from '@/lib/estacio';
import { importarEstacio, type Resultado } from '@/lib/estacioImport';
import { useEstacio } from '@/store/estacio';
import { toast } from '@/store/toast';
import { space, useColors } from '@/theme';

const br = (k: string) => k.split('-').reverse().join('/');

export default function Estacio() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const web = useRef<EstacioWebHandle>(null);
  const [site, setSite] = useState(ESTACIO_URLS[0].url);
  const [loading, setLoading] = useState(true);
  const [res, setRes] = useState<Resultado>({ disciplinas: [], boletos: [], eventos: [] });
  const [sweep, setSweep] = useState<SweepState>({ phase: 'idle', visited: 0, total: 0 });
  const [review, setReview] = useState(false);
  const auto = useEstacio((s) => s.auto);

  const salvar = (r: Resultado) => {
    const msg = importarEstacio(r);
    useEstacio.getState().set({ connected: true, needsLogin: false, lastSweep: Date.now(), lastSummary: msg });
    toast({ message: msg });
  };

  const total = res.disciplinas.length + res.boletos.length + res.eventos.length;
  const status =
    sweep.phase === 'sweeping'
      ? `Lendo ${sweep.label ? `“${sweep.label}”` : 'o portal'} · ${sweep.visited}/${Math.max(sweep.total, sweep.visited)}`
      : sweep.phase === 'login'
        ? 'Entre com seu login: depois eu leio tudo sozinho'
        : total
          ? `${res.disciplinas.length} disciplina${res.disciplinas.length === 1 ? '' : 's'} · ${res.eventos.length} prazo${res.eventos.length === 1 ? '' : 's'} · ${res.boletos.length} boleto${res.boletos.length === 1 ? '' : 's'}`
          : 'Abrindo o portal…';

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Voltar" style={styles.icon}>
          <ChevronLeft size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: space.sm }}>
          {ESTACIO_URLS.map((u) => (
            <Chip
              key={u.url}
              label={u.label}
              active={site === u.url}
              onPress={() => {
                setSite(u.url);
                web.current?.go(u.url);
              }}
            />
          ))}
        </View>
        {loading ? (
          <ActivityIndicator color={c.textDim} style={styles.icon} />
        ) : (
          <Pressable onPress={() => web.current?.reload()} hitSlop={10} accessibilityLabel="Recarregar" style={styles.icon}>
            <RotateCw size={19} color={c.textDim} />
          </Pressable>
        )}
      </View>

      <EstacioWeb
        ref={web}
        style={{ flex: 1, backgroundColor: '#fff' }}
        autoSweep
        onLoading={setLoading}
        onChange={setRes}
        onSweep={setSweep}
        onDone={(r, { loggedOut, passos }) => {
          setRes(r);
          useEstacio.getState().set({ lastSteps: passos });
          if (loggedOut) return;
          salvar(r);
        }}
      />

      <Glass floating style={[styles.footer, { marginBottom: insets.bottom + space.sm }]}>
        <View style={{ flex: 1 }}>
          <T v="callout" numberOfLines={1}>
            {status}
          </T>
          <T v="caption" tone="dim" numberOfLines={1}>
            {sweep.phase === 'sweeping' ? 'Não feche: leva uns 2 minutos' : 'Sua senha fica só no portal da Estácio'}
          </T>
        </View>
        {sweep.phase === 'sweeping' ? (
          <ActivityIndicator color={c.accent} />
        ) : sweep.phase === 'done' ? (
          <Button label="Ver" icon={Download} variant="secondary" onPress={() => (tap(), setReview(true))} />
        ) : (
          <Button label="Ler tudo" icon={ScanSearch} onPress={() => (tap(), web.current?.sweep())} />
        )}
      </Glass>

      <Sheet visible={review} onClose={() => setReview(false)} title="O que veio da Estácio">
        {res.eventos.map((e) => (
          <View key={`${e.titulo}${e.data}`} style={{ gap: 2 }}>
            <T v="callout">{e.titulo}</T>
            <T v="caption" tone="dim">
              {[
                e.tipo === 'agendamento' ? 'Agendamento' : e.tipo === 'prova' ? 'Prova' : e.tipo === 'entrega' ? 'Entrega' : 'Prazo',
                e.ate ? `${br(e.data)} a ${br(e.ate)}` : br(e.data),
                e.disciplina,
              ]
                .filter(Boolean)
                .join(' · ')}
            </T>
          </View>
        ))}
        {res.disciplinas.map((d) => (
          <View key={d.nome} style={{ gap: 2 }}>
            <T v="callout">{d.nome}</T>
            <T v="caption" tone="dim">
              {[
                Object.entries(d.notas)
                  .map(([k, v]) => `${k} ${v.toFixed(1).replace('.', ',')}`)
                  .join(' '),
                d.faltas != null ? `${d.faltas} faltas` : null,
                d.professor,
              ]
                .filter(Boolean)
                .join(' · ') || 'Sem notas ainda'}
            </T>
          </View>
        ))}
        {res.boletos.map((b) => (
          <View key={b.barras ?? b.pix} style={{ gap: 2 }}>
            <T v="callout">Boleto{b.valor ? ` · R$ ${b.valor.toFixed(2).replace('.', ',')}` : ''}</T>
            <T v="caption" tone="dim">
              {b.vencimento ? `Vence ${br(b.vencimento)}` : 'Sem vencimento'}
              {b.valido ? '' : ' · ⚠ confira o código'}
            </T>
          </View>
        ))}
        <Button label="Importar de novo" variant="secondary" onPress={() => (salvar(web.current?.result() ?? res), setReview(false))} />
        <Advanced label="Opções">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <T v="body">Atualizar sozinho todo dia</T>
              <T v="caption" tone="dim">
                Lê o portal em segundo plano quando você abre o Órbita
              </T>
            </View>
            <Switch value={auto} onValueChange={(v) => useEstacio.getState().set({ auto: v })} trackColor={{ true: c.accent, false: c.surface3 }} />
          </View>
          <T v="caption" tone="dim">
            Não veio certo? Copie a forma dos dados (só nomes de campos e cabeçalhos, sem notas, valores ou dados pessoais) e mande para ajustar a
            leitura.
          </T>
          <Button
            label="Copiar forma dos dados"
            variant="secondary"
            onPress={async () => {
              const cap = web.current?.capture();
              if (!cap) return;
              await Clipboard.setStringAsync(formato(cap));
              toast({ message: 'Copiado' });
            }}
          />
        </Advanced>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  icon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  footer: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 24,
  },
});
