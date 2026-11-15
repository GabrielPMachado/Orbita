# Órbita — organização pessoal

App de organização pessoal com módulos que ligam e desligam (inspirado no Nexo, feito do zero).
Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router · Zustand (dados salvos no aparelho).

---

## 1. Testar rápido no iPhone (Expo Go, sem compilar)

No Windows (precisa do Node.js 22.13+ instalado):

```bash
npm install
npx expo start
```

No iPhone, instale o **Expo Go** da App Store e aponte a câmera para o QR code. PC e celular precisam estar na mesma rede Wi-Fi (se não conectar, use `npx expo start --tunnel`).

> Toda alteração no código aparece no celular na hora. Esse é o jeito de desenvolver no dia a dia.

## 2. Gerar o .ipa e instalar com o Sideloadly

Compilar pra iOS exige um Mac. Este projeto usa um **Mac grátis do GitHub Actions**:

1. Crie um repositório no GitHub e suba esta pasta (`git init`, `git add .`, `git commit`, `git push`).
2. No repositório, vá na aba **Actions** → **Build iOS (.ipa para Sideloadly)** → **Run workflow**.
   (Ele também roda sozinho a cada push na `main`.) Demora uns 15–25 min.
3. Quando terminar, abra a execução e baixe o artefato **Orbita-ipa** (vem num .zip; extraia o `Orbita.ipa`).
4. No Windows, abra o **Sideloadly**, conecte o iPhone no cabo, arraste o `Orbita.ipa`, coloque seu Apple ID e clique em **Start**.
5. No iPhone: **Ajustes → Geral → VPN e Gerenciamento de Dispositivos** → confie no seu Apple ID.
   No iOS 16+ também precisa ligar o **Modo de Desenvolvedor** (Ajustes → Privacidade e Segurança).

**Limites com Apple ID gratuito:** o app expira em 7 dias (é só reinstalar pelo Sideloadly; os dados ficam) e no máximo 3 apps instalados assim.
Com a conta Apple Developer paga, dura 1 ano.

> Repositório privado tem uma cota mensal de minutos de macOS no plano grátis; repositório público é ilimitado.

## 3. Estrutura

```
src/
  app/                 telas (cada arquivo = uma rota)
    (tabs)/            abas com a tab bar de vidro
      index.tsx        Hoje: progresso, humor, agenda, hábitos, lembretes, saldo
      tarefas.tsx      kanban (a fazer / fazendo / feito) com filtro por tag
      habitos.tsx      hábitos com sequência e semana
      modulos.tsx      todos os módulos
    lembretes.tsx      notificações locais (única / diária / semanal)
    metas.tsx          metas com progresso
    notas/             lista + editor
    financas/          visão geral, novo (passo a passo), [id], contas, cartoes, orcamentos, simulador
    configuracoes.tsx  nome, cor de destaque, ligar/desligar módulos
    em-breve/[id].tsx  tela dos módulos ainda não feitos
  components/          UI (ui.tsx), Glass, TabBar, captura rápida…
  store/               estado + persistência (Zustand + AsyncStorage)
  lib/parse.ts         entende "pagar boleto amanhã 15h #casa !alta"
  modules.ts           registro dos módulos (seções, ícones, prontos ou não)
  theme.ts             cores, espaçamentos, cores de destaque
```

### Criar um módulo novo

1. Crie `src/app/<id>.tsx` (copie `metas.tsx` como base: `<Screen back title=…>`).
2. Se precisar guardar dados, crie a store em `src/store/` com `persist(..., { name: '<id>', storage })`.
3. Em `src/modules.ts`, mude `ready: true` no módulo.

### Captura rápida (linguagem natural)

| Você escreve | O app entende |
|---|---|
| `amanhã 15h` / `hoje 18h30` / `às 7` | data + hora |
| `sexta` / `segunda-feira` | próximo dia da semana |
| `dia 20` / `05/12` / `em 3 dias` / `em 2 semanas` | data |
| `#trabalho` | tag |
| `!alta` `!media` `!baixa` (ou `!1 !2 !3`, `urgente`) | prioridade |

## 4. Design

- **Direção:** calmo, preciso, noturno. Grafite profundo, um único acento, vidro só no que flutua.
- **Vidro:** `src/components/Glass.tsx` usa **Liquid Glass nativo** (`expo-glass-effect`) no iOS 26+ em praticamente tudo: tab bar (agrupada com `GlassContainer`), botões, cards, listas, campos, chips, controles segmentados, teclado de valor, seletor de humor, módulos e sheets. Um fundo ambiente (`Ambient`) dá cor para o vidro refratar. Sem Liquid Glass, o que flutua usa desfoque (`expo-blur`) e o resto um vidro translúcido leve.
- **Ícones:** só SVG (Lucide), mesmo traço em tudo. Humor usa ícones de clima; hábitos têm 20 ícones para escolher.
- **Tipografia:** Sora (títulos) + Manrope (texto), números tabulares em valores.
- **Tokens:** cores, espaços (4/8), raios e escala de texto em `src/theme.ts`.

## 4.1 Movimento e gestos

`src/components/motion.tsx` (Reanimated 4 + Gesture Handler 3). Tudo respeita **Reduzir movimento** do iOS.

- **Entrada em cascata** dos blocos de cada tela e **listas animadas** (itens entram, saem e se reorganizam com mola).
- **Título grande que some** ao rolar e dá lugar a uma **barra compacta de vidro**; fundo ambiente com parallax; puxar para atualizar (Notícias).
- **Toque com mola** em cards, botões, chips e botões de vidro; **checkbox** que pula; **indicador deslizante** no controle segmentado e na tab bar (ícone pula ao trocar de aba).
- **Anéis e barras de progresso** animados; **números que contam** (saldo, %, metas); **gráficos que crescem**.
- **Deslizar linhas**: tarefas (→ concluir, ← excluir), lançamentos (→ pago/pendente, ← excluir), lembretes. Exclusões com **Desfazer** no aviso.
- **Sheets**: arraste a alça/título para baixo para fechar.
- **Confete** ao completar o dia, ao bater meta, ao fechar um foco e em marcos de sequência (7, 14, 21, 30, 50, 100, 365 dias).
- **Skeleton** enquanto as notícias carregam; chips da captura rápida "pulam" para dentro enquanto você digita.

## 5. Finanças

- **Contas** com saldo inicial → saldo atual calculado sozinho (só o que está pago/recebido).
- **Cartões** com dia de fechamento e vencimento: cada compra cai na fatura certa; limite usado e disponível.
- **Parcelas** no cartão (até 24x) e **lançamentos fixos** (repetir N meses). Os meses futuros nascem pendentes.
- **Saldo previsto** no fim de cada mês (cartão pesa no mês da fatura).
- **Orçamentos** por categoria, gráfico dos últimos 6 meses, gastos por categoria.
- **Novo lançamento** em 4 passos com teclado de valor estilo banco e comprovante em foto.
- **Simulador freela** (por hora ou projeto, taxa, imposto, custos) com cópia formatada para o WhatsApp e botão para lançar como entrada.

## 6. Fotos

Fotos (câmera ou galeria) em **notas**, **comprovantes de lançamentos** e **foto de perfil**. Ficam salvas dentro do app (`Documents/media`), só o nome do arquivo vai para os dados.

## 7. Lançamentos automáticos (Apple Pay)

Cada compra feita com o iPhone entra sozinha, sem abrir o app. Você só escolhe a categoria.

- `app-intents/RegistrarCompraIntent.swift` cria a ação **Registrar compra** no app Atalhos (via `expo-app-intents`). Ela roda escondida (`openAppWhenRun = false`) e pergunta a categoria quando a automação não informa.
- A compra fica numa fila nativa e vira lançamento quando o Órbita é aberto (`src/lib/autoCapture.ts`). Valor, comerciante e cartão vêm da transação da Carteira; o nome do cartão é casado com os cartões/contas cadastrados.
- Passo a passo dentro do app: **Finanças → Lançamentos automáticos**.
- Só funciona no app instalado (.ipa). No Expo Go a ação não existe.

### Conferência com o banco (Meu Pluggy)

Configurar: **Finanças → Conferência com o banco** (ou Configurações → Integrações → Meu Pluggy).

1. Em meu.pluggy.ai, conecte seus bancos e cartões (Open Finance, autorizado no app do banco).
2. No Pluggy Dashboard, crie uma aplicação; em **Demo → Connect Account** escolha **MeuPluggy**.
3. Copie **Client ID**, **Client Secret** e o **Item ID** de cada conexão e cole no Órbita.
4. Toque em cada conta do banco para vincular a uma conta/cartão do Órbita (ele tenta adivinhar pelo nome).

Como funciona:
- Baixa o extrato dos últimos 45 dias (`src/lib/pluggySync.ts`), sozinho ao abrir o app no máximo a cada 6 h, ou puxando a tela para baixo.
- O que bater (valor igual, data até 3 dias, mesmo cartão/conta) ganha o **selo de verificado** automaticamente (`src/lib/reconcile.ts`).
- **No banco**: o que só existe no extrato (cartão físico, Pix, débito automático) — toque para importar; a categoria já vem sugerida pelo seu histórico ou por palavras-chave (iFood → Alimentação, Uber → Transporte…). Deslize para ignorar.
- **No app**: lançamentos de contas vinculadas que não apareceram no extrato depois de 2 dias — corrija ou marque como certo.
- O Client ID e o Client Secret ficam no **Keychain** do iPhone (`expo-secure-store`, só neste aparelho). Nenhuma senha de banco passa pelo app.

## 7.1 Widget de saldo (tela de bloqueio)

`src/widgets/SaldoWidget.tsx` (expo-widgets): retangular, circular e em linha na tela de bloqueio, e pequeno/médio na tela inicial.
Mostra o saldo atual e o resultado do mês; atualiza a cada lançamento (`src/lib/nativeWidgets.ts`). Em **Configurações → Widget de saldo** dá para esconder os valores (R$ •••••).

Adicionar: na tela de bloqueio, toque e segure → **Personalizar** → **Tela Bloqueada** → área de widgets → **Órbita**.

## 7.2 Modo foco (Pomodoro)

- **Hoje → foco** (ou Produtividade → Modo foco) abre a tela cheia: anel que anda sozinho, brilho que "respira" no ritmo 4 s/4 s, tela sempre acesa (`expo-keep-awake`).
- **Emendar ciclos**: foco → pausa → foco sem tocar. A cada 4 focos vem a pausa longa.
- **Live Activity** (`src/widgets/FocoActivity.tsx`): a contagem aparece na tela de bloqueio e na Dynamic Island, contada pelo próprio iOS (fica certa mesmo com o app fechado).
- O motor fica em `src/lib/focus.ts` e é o mesmo para as duas telas.

> Widget e Live Activity só existem no app instalado (.ipa). No Expo Go e na prévia web eles não aparecem; o resto funciona.
>
> **Sideloadly com Apple ID gratuito:** o .ipa agora tem uma extensão (o widget). O Sideloadly assina a extensão junto e cada instalação usa mais App IDs (limite de 10 por semana na conta grátis). Se o widget não mostrar o saldo, o compartilhamento entre app e widget (App Group) não foi aceito pela conta grátis — o app em si continua funcionando. Com a conta paga isso não acontece.

## 7.3 Financy (app de finanças completo)

- **Ver completo no Financy** (Finanças e Hoje) abre o app nativo do Financy (`financy://`) ou, sem ele, o site.
- **Conectar:** no Financy, *Ajustes › Órbita › Copiar chave*; no Órbita, *Configurações › Financy* → colar. A chave fica no Keychain.
- Conectado, o Órbita mostra o saldo e o mês do Financy e o widget da tela de bloqueio pode usar o saldo dele.
- Cada compra do Apple Pay manda a categoria escolhida para o Financy (`comprasApplePay`). Quando a compra chega pelo Open Finance, o Financy aplica a categoria nela, sem lançar em dobro. Sem internet, fica numa fila e vai depois.
- No Financy, o botão de órbita no topo abre o Órbita (`orbita://`).

## 7.4 Aparência

- **Configurações › Aparência:** cores prontas (as mesmas do Financy) e suas próprias (+). Tocar numa cor abre a **roda de intensidade** (0–11), que pinta o fundo do app; no 11 tudo acende.
- **Ícones:** estilo (suave, sólido, contorno, só ícone) e cor (coloridos, destaque, neutros).
- Com o Financy conectado, cor, roda e ícones ficam iguais nos dois apps (`aparencia/compartilhada`); quem mudou por último vale.

## 8. Prévia web

A prévia publicada roda a versão web do app com dados de exemplo. O Liquid Glass é exclusivo do iOS 26+; na web o vidro aparece como desfoque/translúcido.

## 9. Módulos

| Módulo | O que faz |
|---|---|
| Trabalho | Projetos e subprojetos com tarefas (aparecem também no Kanban), progresso, cliente |
| Clientes | Contatos com WhatsApp/ligar/e-mail, projetos e cobranças de cada um |
| Invoices | Cobranças com itens, vencimento, status (atrasada automático), mensagem pronta pro WhatsApp; marcar como paga lança a entrada em Finanças |
| Saúde | Água (meta + toques rápidos), sono da semana, peso com gráfico, remédios com lembrete diário e estoque |
| Academia | Fichas A/B/C (com modelos), cargas, modo treino com cronômetro, histórico e volume |
| Estudos | Matérias, provas/entregas com contagem regressiva, notas com média ponderada, tempo de estudo |
| Filmes e Séries | Quero ver / assistindo / vistos, temporada e episódio, nota, plataforma, capa |
| Notícias | RSS de g1, Folha, Tecnoblog, Canaltech, InfoMoney (+ adicionar feed), salvar para depois |
| Revisão | Resumo da semana (tarefas, hábitos, humor, foco, treinos, dinheiro) + reflexão |
| Produtividade | Pomodoro com ciclos, modo foco em tela cheia, Live Activity, notificação ao terminar, meta diária |
| Analytics | 7/30/90 dias: tarefas, humor, foco, constância dos hábitos, gastos por categoria |
| Arquivos | Itens arquivados (restaurar/excluir) e galeria de todas as fotos do app |

## 10. Roadmap

- [x] Base: tema, módulos liga/desliga, launcher, Home
- [x] Kanban, Hábitos, Lembretes, Metas, Notas, Finanças
- [x] Finanças completo (contas, cartões, parcelas, orçamentos, simulador) e fotos
- [x] Trabalho, Saúde, Academia, Estudos, Filmes e Séries, Notícias
- [x] Clientes, Invoices
- [x] Revisão semanal, Produtividade (Pomodoro), Analytics, Arquivos
- [x] Lançamentos automáticos via Apple Pay + Atalhos
- [x] Conferência com o banco via Meu Pluggy (Open Finance)
- [x] Widget de saldo na tela de bloqueio
- [x] Modo foco com Live Activity
- [ ] Login + sync na nuvem (Firebase ou Supabase)

Nome, ícone e bundle id ficam em `app.json`.
