/**
 * Varredura da Estácio na nuvem (GitHub Actions, todo dia às 04:00 de Brasília).
 *
 * Abre o portal num Chromium sem tela, entra com a sua conta (segredos do repositório),
 * percorre o mesmo roteiro do app (disciplinas → AV, AVS, simulados, notas; SIA → financeiro)
 * com os MESMOS scripts injetados, e grava o resultado no seu Firestore do Financy em
 * users/{uid}/orbita/estacio-cloud. O Órbita busca esse documento quando abre.
 *
 * Só lê. O repositório é público: o log mostra só etapas e contagens, nunca dados.
 */
import { chromium, devices, type Page } from 'playwright';
import { analisar, HOOK_JS, isPortalApi, novaCaptura, PAGE_JS } from '../../src/lib/estacio';
import { PORTAL } from '../../src/lib/estacioApi';
import { FIN_JS, SIA_ENTRADA, SIA_FINANCEIRO, type FinRow } from '../../src/lib/estacioFinanceiro';

const API_KEY = 'AIzaSyDepvsTarS6FfS-nGNz51EVOlOR0yK5yOg';
const PROJECT = 'financy-2d';
const REFERER = { Referer: 'https://financy-2d.web.app/' };

const env = (k: string) => {
  const v = process.env[k]?.trim();
  if (!v) throw new Erro(`Falta o segredo ${k} no repositório.`);
  return v;
};
class Erro extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const log = (m: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

/* ---------- Firestore (mesma conta do Financy) ---------- */

async function firebase(refresh: string) {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...REFERER },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`,
  });
  const j = (await res.json().catch(() => ({}))) as { id_token?: string; user_id?: string };
  if (!res.ok || !j.id_token || !j.user_id)
    throw new Erro('A chave do Financy (FINANCY_KEY) foi recusada. Copie de novo no Financy › Ajustes › Órbita.');
  return { token: j.id_token, uid: j.user_id };
}

async function gravar(fb: { token: string; uid: string }, doc: { ok: boolean; erro?: string; resultado?: string; passos?: string; etapas: number }) {
  const fields: Record<string, unknown> = {
    at: { timestampValue: new Date().toISOString() },
    ok: { booleanValue: doc.ok },
    etapas: { integerValue: String(doc.etapas) },
  };
  if (doc.erro) fields.erro = { stringValue: doc.erro };
  if (doc.resultado) fields.resultado = { stringValue: doc.resultado };
  if (doc.passos) fields.passos = { stringValue: doc.passos };
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${fb.uid}/orbita/estacio-cloud`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fb.token}`, ...REFERER },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Erro(`Não consegui gravar no Firestore (HTTP ${res.status}).`);
}

/* ---------- login Microsoft ---------- */

/**
 * Só conta como logado quando a API do portal responde com sucesso (sessaoOk): a tela inicial
 * de quem ainda não entrou também é uma página do portal com texto.
 */
export async function entrar(page: Page, login: string, senha: string, sessaoOk: () => boolean) {
  await page.goto(PORTAL.inicio, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  let etapa = '';
  const marca = (e: string) => {
    if (e !== etapa) log(`  login: ${e}`);
    etapa = e;
  };
  for (let i = 0; i < 50; i++) {
    await sleep(1500);
    if (sessaoOk()) return;
    const u = page.url();
    if (/estudante\.estacio\.br/.test(u) && !(await page.locator('input[type=password]:visible').count())) {
      // tela inicial sem sessão: toca no botão de entrar (é ele que leva ao login da Microsoft)
      const botao = page.locator('button:visible, a:visible').filter({ hasText: /^\s*(entrar|acessar|login|fazer login|entrar com)/i });
      if (await botao.count()) {
        marca('botão de entrar do portal');
        await botao
          .first()
          .click()
          .catch(() => {});
      } else marca('esperando o portal');
      continue;
    }
    const mfa = await page.locator('#idDiv_SAOTCS_Proofs, #idDiv_SAOTCAS_Title, #idDiv_SAOTCC_Title, input[name=otc], #idTxtBx_SAOTCC_OTC').count();
    if (mfa)
      throw new Erro(
        'A Microsoft pediu verificação em duas etapas. Na nuvem não dá para aprovar: entre uma vez pelo app ou desative o 2FA da conta da Estácio.',
      );
    // o erro só vale se estiver visível e com texto (o espaço dele existe escondido na página)
    const erroVisivel = async (sel: string) => {
      const el = page.locator(`${sel}:visible`);
      return (
        (await el.count()) > 0 &&
        (
          (await el
            .first()
            .innerText()
            .catch(() => '')) || ''
        ).trim().length > 0
      );
    };
    if (await erroVisivel('#usernameError'))
      throw new Erro('A Microsoft não reconheceu o login. O segredo ESTACIO_LOGIN deve ser matricula@alunos.estacio.br.');
    if (await erroVisivel('#passwordError')) throw new Erro('A Microsoft recusou a senha. Confira o segredo ESTACIO_SENHA.');
    const email = page.locator('input[name=loginfmt]:visible, input[type=email]:visible');
    if (await email.count()) {
      marca('e-mail');
      await email.first().fill(login);
      await page
        .locator('#idSIButton9, input[type=submit]')
        .first()
        .click()
        .catch(() => {});
      continue;
    }
    const pass = page.locator('input[type=password]:visible');
    if (await pass.count()) {
      marca('senha');
      await pass.first().fill(senha);
      await page
        .locator('#idSIButton9, input[type=submit], button[type=submit]')
        .first()
        .click()
        .catch(() => {});
      continue;
    }
    // "Continuar conectado?" → Sim
    if (await page.locator('#KmsiCheckboxField, #KmsiDescription').count()) {
      marca('continuar conectado');
      await page
        .locator('#idSIButton9')
        .click()
        .catch(() => {});
      continue;
    }
    // seletor de conta já usada
    const tile = page.locator('#tilesHolder .table[role=button]');
    if (await tile.count())
      await tile
        .first()
        .click()
        .catch(() => {});
  }
  throw new Erro(`O login da Estácio não terminou (parou em: ${etapa || 'abrir o portal'}).`);
}

/* ---------- varredura ---------- */

async function varrer(login: string, senha: string) {
  const cap = novaCaptura();
  let atual: number | undefined;
  let contagem: number | undefined;
  let etapas = 0;
  /** a API do portal respondeu com sucesso: a sessão vale */
  let apiOk = false;
  const caminhos = new Set<string>();
  const passos: { name: string; ok: boolean; info: string }[] = [];

  const browser = await chromium.launch({ headless: true });
  const { defaultBrowserType: _, ...iphone } = devices['iPhone 13'];
  const ctx = await browser.newContext({ ...iphone, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });

  // o mesmo canal do app: os scripts falam com window.ReactNativeWebView.postMessage
  await ctx.exposeBinding('__orbitaPost', (_src, data: string) => {
    let m: { type: string; [k: string]: unknown };
    try {
      m = JSON.parse(data);
    } catch {
      return;
    }
    if (m.type === 'json' && typeof m.body === 'string') {
      if (isPortalApi(String(m.url))) apiOk = true;
      // só o caminho, sem números nem query: ajuda a ver o que respondeu sem expor dados
      try {
        const u = new URL(String(m.url));
        caminhos.add(u.host + u.pathname.replace(/\d+/g, '#'));
      } catch {
        /* url estranha: ignora */
      }
      cap.json.push({
        ordem: atual !== undefined && atual >= 0 ? atual : undefined,
        url: String(m.url),
        body: m.body,
        page: typeof m.page === 'string' ? m.page : undefined,
        disc: typeof m.disc === 'string' ? m.disc : undefined,
      });
      if (cap.json.length > 600) cap.json.shift();
    } else if (m.type === 'page') {
      cap.login = !!m.login;
      cap.pages.set(String(m.url) + (m.view ? `#${String(m.view)}` : ''), {
        url: String(m.url),
        title: String(m.title ?? ''),
        text: String(m.text ?? ''),
        tables: (m.tables as string[][][]) ?? [],
      });
    } else if (m.type === 'sia-fin' && Array.isArray(m.rows)) cap.fin = m.rows as FinRow[];
    else if (m.type === 'count' && typeof m.n === 'number') contagem = m.n;
    else if (m.type === 'step' && typeof m.name === 'string') {
      // só nome do passo, ok/falhou e contagens: nada de dados (o log é público)
      const passo = { name: m.name, ok: !!m.ok, info: typeof m.info === 'string' ? m.info.slice(0, 80) : '' };
      passos.push(passo);
      log(`  ${passo.ok ? 'ok' : 'FALHOU'} ${passo.name}${passo.info ? ` (${passo.info})` : ''}`);
    }
  });
  await ctx.addInitScript(`window.ReactNativeWebView = { postMessage: function(d){ try { window.__orbitaPost(d); } catch(e){} } };\n${HOOK_JS}`);

  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  const run = (code: string) => page.evaluate(code).catch(() => {});
  const ler = async () => {
    await run(PAGE_JS);
    await sleep(400);
  };
  const ir = async (url: string, espera: number) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {});
    await sleep(espera);
    await ler();
  };
  const passo = async (rotulo: string, code: string, espera: number) => {
    etapas++;
    log(rotulo);
    await run(code);
    await sleep(espera);
    await ler();
  };

  try {
    log('Entrando');
    await entrar(page, login, senha, () => apiOk);
    log('Dentro do portal');

    await ir(PORTAL.inicio, 7000);
    await passo('Lista de avaliações', PORTAL.irAvaliacoes, 4500);
    await passo('Contando disciplinas', PORTAL.contar, 11_000);
    const n = Math.min(contagem ?? 0, 12);
    log(`${n} disciplina(s)`);

    for (let i = 0; i < n; i++) {
      atual = -1;
      await ir(`${PORTAL.avaliacoes}?d=${i}`, 7000);
      atual = i;
      await passo(`Disciplina ${i + 1}/${n}`, PORTAL.abrir(i), 9000);
      await passo(`Disciplina ${i + 1}: Prova AV`, PORTAL.aba('Prova AV'), 4000);
      await passo(`Disciplina ${i + 1}: Prova AVS`, PORTAL.aba('Prova AVS'), 4500);
      await passo(`Disciplina ${i + 1}: simulados`, PORTAL.aba('Simulados'), 4500);
      await passo(`Disciplina ${i + 1}: notas`, PORTAL.aba('Minhas notas'), 4500);
    }
    atual = undefined;

    log('Financeiro (SIA)');
    await ir(SIA_ENTRADA, 12_000); // cria a sessão do SIA antes de abrir o financeiro
    await ir(SIA_FINANCEIRO, 12_000);
    await passo('Financeiro: boletos', FIN_JS, 11_000);
  } finally {
    await browser.close();
  }

  log(`Respostas da API: ${[...caminhos].slice(0, 25).join(', ') || 'nenhuma'}`);
  const r = analisar(cap);
  log(
    `Lido: ${r.disciplinas.length} disciplina(s), ${(r.avaliacoes ?? []).length} avaliação(ões), ${(r.cobrancas ?? []).length} cobrança(s), ${cap.json.length} resposta(s) JSON`,
  );
  if (!r.disciplinas.length && !(r.avaliacoes ?? []).length && !(r.cobrancas ?? []).length)
    throw new Erro('Entrei no portal mas não consegui ler nada. O layout pode ter mudado.');
  return { r, etapas, passos };
}

/* ---------- principal ---------- */

async function main() {
  const fb = await firebase(env('FINANCY_KEY'));
  try {
    const { r, etapas, passos } = await varrer(env('ESTACIO_LOGIN'), env('ESTACIO_SENHA'));
    await gravar(fb, { ok: true, etapas, resultado: JSON.stringify(r), passos: JSON.stringify(passos.slice(-120)) });
    log('Gravado. O Órbita importa quando abrir.');
  } catch (e) {
    const msg = e instanceof Erro ? e.message : 'Erro inesperado na varredura.';
    console.error(msg);
    if (!(e instanceof Erro)) console.error((e as Error)?.name ?? 'Error'); // sem detalhes: o log é público
    await gravar(fb, { ok: false, erro: msg, etapas: 0 }).catch(() => {});
    process.exit(1);
  }
}

// ORBITA_TESTE=1: só importa as funções (teste local do login)
if (!process.env.ORBITA_TESTE)
  main().catch((e) => {
    console.error(e instanceof Erro ? e.message : 'Falha ao iniciar.');
    process.exit(1);
  });
