/**
 * Confere a sintaxe de todo JavaScript que o Órbita injeta em páginas (portal da Estácio etc.).
 * Um escape errado num template literal (\n, \d, \/) quebra o script inteiro em silêncio:
 * a página não reclama e o app simplesmente não lê nada.
 */
import { HOOK_JS, LINKS_JS, PAGE_JS, pdfJs } from '../src/lib/estacio';
import { PORTAL } from '../src/lib/estacioApi';
import { FIN_JS, SIA_ACESSAR_JS } from '../src/lib/estacioFinanceiro';

const scripts: Record<string, string> = {
  HOOK_JS,
  PAGE_JS,
  LINKS_JS,
  FIN_JS,
  SIA_ACESSAR_JS,
  pdfJs: pdfJs('https://exemplo/boleto.pdf'),
  irAvaliacoes: PORTAL.irAvaliacoes,
  contar: PORTAL.contar,
  abrir: PORTAL.abrir(0),
  aba: PORTAL.aba('Prova AV'),
};
let erros = 0;
for (const [nome, code] of Object.entries(scripts)) {
  try {
    new Function(code);
    console.log(`ok  ${nome}`);
  } catch (e) {
    erros++;
    console.error(`ERRO ${nome}: ${(e as Error).message}`);
  }
}
if (erros) process.exit(1);
