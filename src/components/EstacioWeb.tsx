import { File, Paths } from 'expo-file-system';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import WebView, { type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';
import type { FileDownloadEvent, ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { OrbitaDocs } from '../../modules/orbita-docs';
import { lerTexto } from '@/lib/boleto';
import { analisar, ESTACIO_URLS, HOOK_JS, isLoginUrl, isPortalApi, LINKS_JS, novaCaptura, PAGE_JS, pdfJs, type Captura } from '@/lib/estacio';
import { PORTAL } from '@/lib/estacioApi';
import { FIN_JS, SIA_FINANCEIRO, type FinRow } from '@/lib/estacioFinanceiro';
import type { Resultado } from '@/lib/estacioImport';
import { keepFile } from '@/lib/media';
import { uid } from '@/lib/storage';
import { avisar } from '@/lib/avisar';

// os tipos da WebView 14 não fecham com o React 19; o componente em si é o mesmo
const WV = WebView as unknown as (p: WebViewProps & { ref?: Ref<WebView> }) => React.ReactElement;

const PAGE_WAIT = 4500; // a página monta o conteúdo depois de carregar
const MAX_PAGES = 18;
const MAX_TIME = 150_000;

export type SweepState = { phase: 'idle' | 'login' | 'sweeping' | 'done'; visited: number; total: number; label?: string };
export type EstacioWebHandle = { sweep: () => void; reload: () => void; capture: () => Captura; result: () => Resultado; go: (url: string) => void };

/**
 * O portal da Estácio numa WebView que copia o que a página recebe (JSON, texto, tabelas, PDFs).
 * `autoSweep`: depois de entrar, visita sozinho as páginas do menu ligadas a notas, provas,
 * agendamento, calendário e financeiro, e chama `onDone` com o que achou.
 */
export const EstacioWeb = forwardRef(function EstacioWeb(
  {
    style,
    autoSweep = false,
    onChange,
    onSweep,
    onDone,
    onLoading,
    onPage,
    initialUrl,
  }: {
    style?: StyleProp<ViewStyle>;
    autoSweep?: boolean;
    onChange?: (r: Resultado) => void;
    onSweep?: (s: SweepState) => void;
    onDone?: (r: Resultado, s: { loggedOut: boolean }) => void;
    onLoading?: (l: boolean) => void;
    /** cada página lida: endereço, se pede senha e quanto texto tinha */
    onPage?: (p: { url: string; login: boolean; chars: number; api: boolean }) => void;
    /** página para abrir primeiro (padrão: o portal) */
    initialUrl?: string;
  },
  ref: Ref<EstacioWebHandle>,
) {
  const web = useRef<WebView>(null);
  const onPageRef = useRef(onPage);
  onPageRef.current = onPage;
  const cap = useRef(novaCaptura());
  /** última página carregada e se a API do portal já respondeu (prova de sessão válida) */
  const lastUrl = useRef('');
  const apiOk = useRef(false);
  const naLogin = () => cap.current.login || isLoginUrl(lastUrl.current);
  const pdfs = useRef<{ texto: string; arquivo?: string }[]>([]);
  const [url, setUrl] = useState(initialUrl ?? ESTACIO_URLS[0].url);

  // varredura
  const queue = useRef<{ text: string; href: string }[]>([]);
  const visited = useRef(new Set<string>());
  const phase = useRef<SweepState['phase']>('idle');
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wantSweep = useRef(autoSweep);

  const result = useCallback((): Resultado => {
    const r = analisar(
      cap.current,
      pdfs.current.map((p) => p.texto),
    );
    return { ...r, arquivos: pdfs.current };
  }, []);

  const emit = (s: Partial<SweepState>) =>
    onSweep?.({ phase: phase.current, visited: visited.current.size, total: visited.current.size + queue.current.length, ...s });

  const finish = useCallback(
    (loggedOut = false) => {
      clearTimeout(timer.current);
      const r = result();
      const vazio = !r.disciplinas.length && !(r.avaliacoes ?? []).length && !(r.cobrancas ?? []).length && !r.boletos.length;
      // caiu no login, ou o portal nunca respondeu com dados: a sessão não vale
      const telaDeLogin = loggedOut || naLogin();
      const out = telaDeLogin || (vazio && !apiOk.current);
      // só volta a "esperar o login" se viu a tela de login (senão ficaria varrendo em círculo)
      phase.current = telaDeLogin ? 'login' : 'done';
      emit({});
      onDone?.(r, { loggedOut: out });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onDone, result],
  );

  const next = useCallback(() => {
    clearTimeout(timer.current);
    if (phase.current !== 'sweeping') return;
    if (Date.now() - started.current > MAX_TIME || visited.current.size >= MAX_PAGES) return finish();
    const n = queue.current.shift();
    if (!n) return finish();
    if (visited.current.has(n.href)) return next();
    visited.current.add(n.href);
    emit({ label: n.text });
    setUrl(n.href);
    // se a página não terminar de carregar, segue mesmo assim
    timer.current = setTimeout(next, PAGE_WAIT * 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finish]);

  /* ---------- roteiro do portal atual (estudante.estacio.br + sala de avaliações) ---------- */
  type Passo = { label?: string; run: () => void; wait: number; disc?: number };
  /** disciplina que o roteiro está lendo agora (para casar respostas sem código) */
  const atual = useRef<number | undefined>(undefined);
  const roteiro = useRef<Passo[]>([]);
  const feitos = useRef(0);
  const passo = useCallback(() => {
    clearTimeout(timer.current);
    if (phase.current !== 'sweeping') return;
    if (Date.now() - started.current > MAX_TIME * 2) return finish();
    const p = roteiro.current.shift();
    if (!p) return finish();
    if (p.disc !== undefined) atual.current = p.disc;
    feitos.current++;
    onSweep?.({ phase: 'sweeping', visited: feitos.current, total: feitos.current + roteiro.current.length, label: p.label });
    try {
      p.run();
    } catch (e) {
      avisar('passo da varredura da Estácio', e);
    }
    timer.current = setTimeout(passo, p.wait);
  }, [finish, onSweep]);
  const js = (code: string) => () => web.current?.injectJavaScript(code);

  /** Depois de contar as disciplinas: abre cada uma e lê AV, AVS e as notas. */
  const montarDisciplinas = (n: number) => {
    const passos: Passo[] = [];
    for (let i = 0; i < Math.min(n, 12); i++) {
      passos.push(
        { label: 'Avaliações', run: () => setUrl(`${PORTAL.avaliacoes}?d=${i}`), wait: 7000, disc: -1 },
        { label: `Disciplina ${i + 1} de ${n}`, run: js(PORTAL.abrir(i)), wait: 9000, disc: i },
        { label: `Disciplina ${i + 1}: Prova AV`, run: js(PORTAL.aba('Prova AV')), wait: 4000 },
        { label: `Disciplina ${i + 1}: Prova AVS`, run: js(PORTAL.aba('Prova AVS')), wait: 4500 },
        { label: `Disciplina ${i + 1}: simulados`, run: js(PORTAL.aba('Simulados')), wait: 4500 },
        { label: `Disciplina ${i + 1}: notas`, run: js(PORTAL.aba('Minhas notas')), wait: 4500 },
      );
    }
    // financeiro (SIA): mensalidades abertas e pagas — o login é o mesmo (Microsoft)
    passos.push(
      { label: 'Financeiro', run: () => setUrl(SIA_FINANCEIRO), wait: 15000 },
      { label: 'Financeiro: boletos', run: js(FIN_JS), wait: 2500 },
      { label: 'Início', run: () => setUrl(PORTAL.inicio), wait: 6000 },
    );
    roteiro.current.push(...passos);
  };

  const startPortal = () => {
    phase.current = 'sweeping';
    started.current = Date.now();
    feitos.current = 0;
    roteiro.current = [
      { label: 'Início', run: () => setUrl(PORTAL.inicio), wait: 7000 },
      { label: 'Lista de avaliações', run: js(PORTAL.irAvaliacoes), wait: 4500 },
      { label: 'Contando disciplinas', run: js(PORTAL.contar), wait: 2500 },
    ];
    passo();
  };

  const startSweep = useCallback(() => {
    if (naLogin()) {
      phase.current = 'login';
      emit({});
      return;
    }
    // portal novo da Estácio: roteiro sob medida
    if ([...cap.current.pages.keys()].some((u) => /estudante\.estacio\.br/.test(u)) || /estudante\.estacio\.br/.test(url)) {
      startPortal();
      return;
    }
    phase.current = 'sweeping';
    started.current = Date.now();
    visited.current = new Set([url]);
    emit({});
    web.current?.injectJavaScript(LINKS_JS);
    timer.current = setTimeout(next, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, url]);

  useImperativeHandle(ref, () => ({
    sweep: () => {
      wantSweep.current = true;
      startSweep();
    },
    reload: () => web.current?.reload(),
    capture: () => cap.current,
    result,
    go: (u: string) => setUrl(u),
  }));

  const bump = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const changed = () => {
    clearTimeout(bump.current);
    bump.current = setTimeout(() => onChange?.(result()), 600);
  };

  const onMessage = useCallback(
    async (e: WebViewMessageEvent) => {
      let m: { type: string; [k: string]: unknown };
      try {
        m = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      const cp = cap.current;
      if (m.type === 'json' && typeof m.body === 'string') {
        if (isPortalApi(String(m.url))) apiOk.current = true;
        cp.json.push({
          ordem: atual.current !== undefined && atual.current >= 0 ? atual.current : undefined,
          url: String(m.url),
          body: m.body,
          page: typeof m.page === 'string' ? m.page : undefined,
          disc: typeof m.disc === 'string' ? m.disc : undefined,
        });
        if (cp.json.length > 400) cp.json.shift();
        changed();
      } else if (m.type === 'page') {
        cp.login = !!m.login;
        lastUrl.current = String(m.url);
        onPageRef.current?.({ url: String(m.url), login: naLogin(), chars: String(m.text ?? '').length, api: apiOk.current });
        cp.pages.set(String(m.url) + (m.view ? `#${String(m.view)}` : ''), {
          url: String(m.url),
          title: String(m.title ?? ''),
          text: String(m.text ?? ''),
          tables: (m.tables as string[][][]) ?? [],
        });
        changed();
      } else if (m.type === 'sia-fin' && Array.isArray(m.rows)) {
        cp.fin = m.rows as FinRow[];
        changed();
      } else if (m.type === 'count' && typeof m.n === 'number') {
        montarDisciplinas(m.n);
      } else if (m.type === 'links' && Array.isArray(m.items)) {
        for (const it of m.items as { text: string; href: string }[]) {
          if (!visited.current.has(it.href) && !queue.current.some((q) => q.href === it.href)) queue.current.push(it);
        }
        emit({});
      } else if (m.type === 'pdf' && typeof m.b64 === 'string' && OrbitaDocs) {
        // boleto em PDF aberto dentro do portal: lê no próprio iPhone
        try {
          const f = new File(Paths.cache, `estacio-${uid()}.pdf`);
          f.write(m.b64, { encoding: 'base64' });
          const r = await OrbitaDocs.readPdf(f.uri, null);
          if (!r.locked && lerTexto(r.text, r.codes).length) {
            pdfs.current.push({ texto: r.text + '\n' + r.codes.join('\n'), arquivo: keepFile(f.uri, 'pdf') });
            changed();
          }
        } catch (e) {
          avisar('ler o PDF baixado da Estácio', e);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // terminou de carregar uma página: lê, e na varredura procura mais links e segue
  const onLoadEnd = (e?: { nativeEvent?: { url?: string } }) => {
    onLoading?.(false);
    if (e?.nativeEvent?.url) lastUrl.current = e.nativeEvent.url;
    web.current?.injectJavaScript(PAGE_JS);
    setTimeout(() => {
      if (phase.current === 'sweeping' && naLogin()) {
        // a sessão caiu no meio da leitura
        finish(true);
      } else if (phase.current === 'sweeping' && (feitos.current > 0 || roteiro.current.length)) {
        // roteiro do portal: os passos têm tempo próprio
      } else if (phase.current === 'sweeping') {
        web.current?.injectJavaScript(LINKS_JS);
        clearTimeout(timer.current);
        timer.current = setTimeout(next, PAGE_WAIT);
      } else if (wantSweep.current && phase.current === 'idle') {
        // primeira página depois do login: começa sozinho
        if (naLogin()) {
          phase.current = 'login';
          emit({});
          if (!onSweep) return;
        } else startSweep();
      } else if (phase.current === 'login' && !naLogin() && wantSweep.current) {
        // acabou de entrar
        phase.current = 'idle';
        startSweep();
      }
    }, PAGE_WAIT);
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  const source = useMemo(() => ({ uri: url }), [url]);

  return (
    <WV
      ref={web}
      source={source}
      style={style}
      sharedCookiesEnabled
      javaScriptEnabled
      domStorageEnabled
      allowsBackForwardNavigationGestures
      injectedJavaScriptBeforeContentLoaded={HOOK_JS}
      injectedJavaScript={PAGE_JS}
      onLoadStart={() => onLoading?.(true)}
      onLoadEnd={onLoadEnd}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={(req: ShouldStartLoadRequest) => {
        if (/\.pdf(\?|$)/i.test(req.url) || /boleto.*(pdf|imprimir|download)|(pdf|imprimir|download).*boleto/i.test(req.url)) {
          web.current?.injectJavaScript(pdfJs(req.url));
        }
        return true;
      }}
      onFileDownload={({ nativeEvent }: FileDownloadEvent) => web.current?.injectJavaScript(pdfJs(nativeEvent.downloadUrl))}
    />
  );
});
