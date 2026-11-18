import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import { ChevronLeft, Download, RotateCw } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WebView, { type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import type { ShouldStartLoadRequest, FileDownloadEvent } from 'react-native-webview/lib/WebViewTypes';
import type { Ref } from 'react';

// os tipos da WebView 14 não fecham com o React 19; o componente em si é o mesmo
const WV = WebView as unknown as (p: WebViewProps & { ref?: Ref<WebView> }) => React.ReactElement;
import { OrbitaDocs } from '../../modules/orbita-docs';
import { Advanced } from '@/components/Advanced';
import { Glass } from '@/components/Glass';
import { Button, Chip, Sheet, T, tap } from '@/components/ui';
import { lerTexto } from '@/lib/boleto';
import { agendarAvisos } from '@/lib/boletoImport';
import { analisar, ESTACIO_URLS, formato, HOOK_JS, novaCaptura, PAGE_JS, pdfJs } from '@/lib/estacio';
import { keepFile } from '@/lib/media';
import { uid } from '@/lib/storage';
import { useBoletos } from '@/store/boletos';
import { useSubjects } from '@/store/modules';
import { toast } from '@/store/toast';
import { space, useColors } from '@/theme';

const PALETTE = ['#8B5CF6', '#06B6D4', '#F59E0B', '#22C55E', '#EC4899', '#3B82F6', '#F97316', '#EF4444'];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export default function Estacio() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const web = useRef<WebView>(null);
  const cap = useRef(novaCaptura());
  const pdfTexts = useRef<{ text: string; arquivo?: string }[]>([]);
  const [url, setUrl] = useState(ESTACIO_URLS[0].url);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0); // força recalcular o que já dá para importar
  const [review, setReview] = useState(false);

  const result = useMemo(
    () => analisar(cap.current, pdfTexts.current.map((p) => p.text)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );
  const bump = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const changed = () => {
    clearTimeout(bump.current);
    bump.current = setTimeout(() => setTick((t) => t + 1), 600);
  };

  const onMessage = useCallback(async (e: WebViewMessageEvent) => {
    let m: { type: string; [k: string]: unknown };
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    const cp = cap.current;
    if (m.type === 'json' && typeof m.body === 'string') {
      cp.json.push({ url: String(m.url), body: m.body });
      if (cp.json.length > 300) cp.json.shift();
      changed();
    } else if (m.type === 'page') {
      cp.pages.set(String(m.url), { url: String(m.url), title: String(m.title ?? ''), text: String(m.text ?? ''), tables: (m.tables as string[][][]) ?? [] });
      changed();
    } else if (m.type === 'pdf' && typeof m.b64 === 'string' && OrbitaDocs) {
      // boleto em PDF aberto dentro do portal: lê no próprio iPhone
      try {
        const f = new File(Paths.cache, `estacio-${uid()}.pdf`);
        f.write(m.b64, { encoding: 'base64' });
        const r = await OrbitaDocs.readPdf(f.uri, null);
        if (!r.locked && lerTexto(r.text, r.codes).length) {
          pdfTexts.current.push({ text: r.text + '\n' + r.codes.join('\n'), arquivo: keepFile(f.uri, 'pdf') });
          changed();
          toast({ message: 'Boleto em PDF encontrado' });
        }
      } catch {}
    }
  }, []);

  const importar = () => {
    const subs = useSubjects.getState();
    const now = Date.now();
    let novas = 0;
    let atual = 0;
    result.disciplinas.forEach((d, i) => {
      const ex = subs.items.find((s) => norm(s.name) === norm(d.nome) || (d.codigo && s.code === d.codigo));
      const patch = {
        code: d.codigo ?? ex?.code,
        professor: d.professor ?? ex?.professor,
        grades: Object.keys(d.notas).length ? d.notas : ex?.grades,
        absences: d.faltas ?? ex?.absences,
        schedule: d.horario ?? ex?.schedule,
        source: 'estacio' as const,
        syncedAt: now,
      };
      if (ex) {
        subs.update(ex.id, patch);
        atual++;
      } else {
        subs.add({ name: d.nome, color: PALETTE[(subs.items.length + i) % PALETTE.length], ...patch });
        novas++;
      }
    });
    const bol = useBoletos.getState();
    let nb = 0;
    for (const b of result.boletos) {
      if (bol.items.some((x) => (b.barras && x.barras === b.barras) || (b.pix && x.pix === b.pix))) continue;
      const arquivo = pdfTexts.current.find((p) => (b.linha && p.text.replace(/\D/g, '').includes(b.linha.replace(/\D/g, ''))) || (b.barras && p.text.includes(b.barras)))?.arquivo;
      const data = {
        descricao: 'Mensalidade Estácio',
        valor: b.valor,
        vencimento: b.vencimento,
        linha: b.linha,
        barras: b.barras,
        pix: b.pix,
        banco: b.banco,
        beneficiario: b.beneficiario,
        origem: 'estacio' as const,
        arquivo,
      };
      const id = bol.add(data);
      agendarAvisos(data).then((avisos) => useBoletos.getState().update(id, { avisos }));
      nb++;
    }
    setReview(false);
    const partes = [
      novas ? `${novas} disciplina${novas > 1 ? 's' : ''} nova${novas > 1 ? 's' : ''}` : null,
      atual ? `${atual} atualizada${atual > 1 ? 's' : ''}` : null,
      nb ? `${nb} boleto${nb > 1 ? 's' : ''}` : null,
    ].filter(Boolean);
    toast({ message: partes.length ? `Importado: ${partes.join(', ')}` : 'Nada novo para importar' });
  };

  const total = result.disciplinas.length + result.boletos.length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Voltar" style={styles.icon}>
          <ChevronLeft size={24} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', gap: space.sm }}>
          {ESTACIO_URLS.map((u) => (
            <Chip key={u.url} label={u.label} active={url === u.url} onPress={() => setUrl(u.url)} />
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

      <WV
        ref={web}
        source={{ uri: url }}
        style={{ flex: 1, backgroundColor: '#fff' }}
        sharedCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        injectedJavaScriptBeforeContentLoaded={HOOK_JS}
        injectedJavaScript={PAGE_JS}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => {
          setLoading(false);
          web.current?.injectJavaScript(PAGE_JS);
        }}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={(req: ShouldStartLoadRequest) => {
          // boleto em PDF: baixa com a sessão do portal para ler aqui
          if (/\.pdf(\?|$)/i.test(req.url) || /boleto.*(pdf|imprimir|download)|(pdf|imprimir|download).*boleto/i.test(req.url)) {
            web.current?.injectJavaScript(pdfJs(req.url));
          }
          return true;
        }}
        onFileDownload={({ nativeEvent }: FileDownloadEvent) => web.current?.injectJavaScript(pdfJs(nativeEvent.downloadUrl))}
      />

      <Glass floating style={[styles.footer, { marginBottom: insets.bottom + space.sm }]}>
        <View style={{ flex: 1 }}>
          <T v="callout" numberOfLines={1}>
            {total ? `${result.disciplinas.length} disciplina${result.disciplinas.length === 1 ? '' : 's'} · ${result.boletos.length} boleto${result.boletos.length === 1 ? '' : 's'}` : 'Entre e abra notas, aulas ou financeiro'}
          </T>
          <T v="caption" tone="dim" numberOfLines={1}>
            Sua senha fica só no portal da Estácio
          </T>
        </View>
        <Button label="Importar" icon={Download} disabled={!total} onPress={() => (tap(), setReview(true))} />
      </Glass>

      <Sheet visible={review} onClose={() => setReview(false)} title="Importar da Estácio">
        {result.disciplinas.map((d) => (
          <View key={d.nome} style={{ gap: 2 }}>
            <T v="callout">{d.nome}</T>
            <T v="caption" tone="dim">
              {[
                Object.entries(d.notas)
                  .map(([k, v]) => `${k} ${v.toFixed(1).replace('.', ',')}`)
                  .join(' '),
                d.faltas != null ? `${d.faltas} faltas` : null,
                d.professor,
                d.horario,
              ]
                .filter(Boolean)
                .join(' · ') || 'Sem notas ainda'}
            </T>
          </View>
        ))}
        {result.boletos.map((b) => (
          <View key={b.barras ?? b.pix} style={{ gap: 2 }}>
            <T v="callout">Boleto{b.valor ? ` · R$ ${b.valor.toFixed(2).replace('.', ',')}` : ''}</T>
            <T v="caption" tone="dim">
              {b.vencimento ? `Vence ${b.vencimento.split('-').reverse().join('/')}` : 'Sem vencimento'}
              {b.valido ? '' : ' · ⚠ confira o código'}
            </T>
          </View>
        ))}
        <Button label="Importar tudo" onPress={importar} />
        <Advanced label="Não veio certo?">
          <T v="caption" tone="dim">
            Copie a forma dos dados (só nomes de campos e cabeçalhos, sem notas, valores ou dados pessoais) e mande para ajustar a leitura.
          </T>
          <Button
            label="Copiar forma dos dados"
            variant="secondary"
            onPress={async () => {
              await Clipboard.setStringAsync(formato(cap.current));
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
  footer: { position: 'absolute', left: space.md, right: space.md, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 24 },
});
