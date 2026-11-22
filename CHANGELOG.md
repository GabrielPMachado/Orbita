# Changelog

Todas as mudanças relevantes do Órbita ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/). A versão é a mesma do `app.json`.

## [0.18.4] - 2026-11-22

### Corrigido
- A prova de sessão da Estácio (no app e na nuvem) aceitava qualquer resposta da API do portal, mas ela tem endereços públicos que respondem sem login. Agora só valem turmas, avaliações e dados do aluno.

## [0.18.3] - 2026-11-22

### Corrigido
- Leitura da Estácio na nuvem: o robô achava que já tinha entrado assim que via a tela inicial do portal (que também aparece sem login) e lia tudo vazio. Agora só conta como logado quando a API do portal responde; na tela inicial ele toca em "Entrar" e segue o login da Microsoft. O log mostra em que parte do login parou, se parar.
- A contagem de disciplinas espera até 10 s pela lista, no app e na nuvem (antes o roteiro seguia depois de 2,5 s e podia achar zero).

## [0.18.2] - 2026-11-22

### Corrigido
- Boletos da Estácio: a leitura abria direto o endereço do financeiro do SIA, que dá erro sem a sessão do SIA, e não trazia nenhuma cobrança. Agora entra primeiro pela entrada do SIA (onde o login da Microsoft cria a sessão), depois abre o financeiro e espera as cobranças aparecerem (até 10 s). Vale para a leitura no app e para a da nuvem.
- Se o financeiro ainda não mostrar nada, Contas e conexões › Estácio mostra o passo "financeiro (SIA)" com o endereço e o título da página em que parou.

## [0.18.1] - 2026-11-22

### Corrigido
- Meu Pluggy dava "erro 410": o Pluggy desativou o endereço antigo de transações. O Órbita agora usa o /v2/transactions, com paginação por cursor, e as datas saem no fuso de Brasília (compras depois das 21h não caem mais no dia seguinte).
- Vincular contas do banco: com o Financy como base não há contas no Órbita, então as contas do banco aparecem como "Conferida por valor e data", sem o aviso amarelo, e a tela explica isso em vez de mandar cadastrar contas em Finanças. Os cartões continuam vinculáveis aos cartões do Financy.

## [0.18.0] - 2026-11-22

### Mudado
- Estudos › Avaliações redesenhada: separada em A fazer, Marcadas e Feitas (com contagem em cada uma), mais uma visão por matéria. Filtro por tipo: provas, simulados e trabalhos.
- Cada avaliação virou um cartão: tipo em destaque (AV, AVS, Simulado 1…), matéria com a cor dela, prazo com contagem regressiva e uma barra de quanto da janela para agendar já passou; nas feitas, a nota sobre o máximo com barra. As de prazo encerrado ficam separadas.
- "Próxima avaliação" conta até o fim do prazo para agendar/fazer, não só a data.

### Adicionado
- Metas: botão "Valor" para lançar qualquer valor (somar, tirar ou definir o total) e escolher quanto os botões + e − somam em cada meta (ou voltar ao automático). Dá para definir esse valor já ao criar a meta.

## [0.17.3] - 2026-11-22

### Corrigido
- A extensão do widget saía compilada no formato de desenvolvimento (com `ExpoWidgetsTarget.debug.dylib` e `__preview.dylib`), mesmo no build Release. Agora o widget sai no formato normal de Release, como o app.

## [0.17.2] - 2026-11-20

### Corrigido
- A leitura da Estácio clicava nos lugares errados: os cliques eram feitos depois de um tempo fixo, mesmo que a página ainda não tivesse carregado, e o "Voltar" podia ser tocado fora da sala de avaliações. Agora cada passo espera o botão aparecer (até 10 s), só age no site certo e usa o "Voltar" só dentro da sala.
- A leitura escondida rodava numa tela de 2×2 pixels, e o portal montava outro layout; agora usa o tamanho de um iPhone (invisível).

### Adicionado
- Contas e conexões › Estácio mostra o resultado da última leitura passo a passo (quantos deram certo e quais falharam, com o motivo). A leitura na nuvem manda os mesmos passos, e o log do GitHub mostra só nomes de passos e contagens.

## [0.17.1] - 2026-11-20

### Corrigido
- Estácio aparecia como "Conectado · atualizado hoje" com a sessão expirada: quando a sessão cai, o portal manda para a página da Microsoft que pede só o e-mail (sem campo de senha), e o app não reconhecia isso como login. Agora a página de login é reconhecida pelo endereço, e "conectado" só vale quando a API do portal responde com os seus dados.
- A leitura automática só marca "atualizado" quando trouxe dados de verdade; se não trouxe, tenta de novo em 2 horas em vez de fingir que leu.
- Testar conexão da Estácio só diz "sessão ativa" quando o portal devolve os seus dados (antes bastava abrir qualquer página do portal).
- Respostas de erro do portal (sessão recusada) não são mais lidas como dados.
- Se a sessão cai no meio da leitura, ela para e pede para entrar de novo.

## [0.17.0] - 2026-11-20

### Removido
- Código que nenhuma tela usava mais: teclado de valores antigo, agrupador de vidro, rastreio de envio de lançamentos ao Financy (o Órbita só lê de lá), exclusão local de lançamentos, funções de teste e de ícone sem uso, estilos e importações órfãs.
- A dependência expo-device, o script reset-project e as imagens do modelo do Expo que não eram usadas.

### Corrigido
- Conferir uma compra com o banco não trava mais aquele lançamento: quando o Financy muda o valor ou a categoria, o Órbita atualiza e mantém o selo de conferido, as fotos e as notas.

## [0.16.0] - 2026-11-20

### Adicionado
- Contas e conexões: tocar numa conexão abre os botões para entrar/conectar e para testar a conexão de verdade, com o resultado logo abaixo. A Estácio abre o portal escondido e diz se a sessão ainda vale; o Financy lê o saldo; o Pluggy lista as contas; o TMDB confere a chave; a nuvem mostra a última leitura; notificações mandam uma de teste.
- O Órbita avisa o Financy quando abre, e o Financy mostra quando ele foi visto pela última vez.

## [0.15.0] - 2026-11-20

### Adicionado
- Configurações em seções: Perfil, Contas e conexões, Personalização (Aparência, Widgets, Módulos), Rotina e Dados. Cada item abre a própria tela.
- Contas e conexões: Estácio, leitura na nuvem das 04h, Financy, Meu Pluggy, TMDB, notificações e widgets num lugar só, com o estado de cada um (conectado, atenção ou desligado) e o que fazer. A chave do TMDB pode ser colada ali mesmo; a da nuvem mostra o último erro e abre os segredos do GitHub.

### Corrigido
- A versão no rodapé das Configurações agora é a real (vinha fixa em 0.6).

## [0.14.0] - 2026-11-19

### Adicionado
- Varredura da Estácio na nuvem: todo dia às 04:00 (horário de Brasília) um job no GitHub lê o portal, mesmo com o celular desligado. O Órbita importa o resultado quando abre e mostra em Estudos se a leitura da nuvem deu certo ou por que falhou.
- Boletos da Estácio pelo financeiro do SIA: mensalidades em aberto entram em Boletos com linha digitável, código de barras, valor e vencimento; as pagas entram como pagas, com a data do pagamento.

### Corrigido
- A atualização da Estácio dizia "nada novo" mesmo lendo todas as páginas: um escape errado no script injetado no portal impedia a leitura das respostas. Agora o CI confere a sintaxe de todo script injetado.
- Provas sem disciplina iam para uma matéria genérica "Estácio". Agora cada prova fica na sua matéria; o que estava na matéria genérica (e você não editou) sai, e ela some se ficar vazia.
- Quando o portal não devolve nada, o app avisa que não conseguiu ler, em vez de dizer "nada novo".

## [0.13.1] - 2026-11-19

### Mudado
- Movimento sem efeito elástico em todo o app: folhas, listas, abas e botões deslizam com ease-out curto e não passam do ponto. Ao tocar, cards e botões encolhem pouquinho e esmaecem, em vez de afundar e quicar.

## [0.13.0] - 2026-11-19

### Adicionado
- Estácio entra em cada avaliação de cada disciplina (Prova AV, Prova AVS, Simulado 1 e 2) e traz para a matéria em Estudos: nota sobre o valor (ex.: 3,2/8), se foi feita, agendada ou ainda precisa agendar, data e hora, local (polo e sala), modo (polo ou online) e a janela para agendar/fazer.
- Avaliações da Estácio são editáveis: título, data, nota e anotações que você mudar ficam, mesmo quando o portal for lido de novo.
- O que ainda dá para agendar ou fazer vira tarefa com prazo no fim da janela ("Agendar Prova AV · …", "Fazer Simulado 2 · …"); quando a prova é feita ou agendada, a tarefa se conclui sozinha.

## [0.12.2] - 2026-11-19

### Corrigido
- Provas da Estácio iam para uma matéria genérica "Estácio": agora cada uma vai para a matéria certa, pelo código da disciplina (ARA…), com a mesma matéria que você já tinha (mesmo com acento diferente).
- Prova feita entra com a nota; a janela de agendamento aparece na própria matéria ("Prova AVS · agendar até 03/12") e vira tarefa com o nome da matéria.

## [0.12.1] - 2026-11-19

### Melhorado
- Leitura da Estácia feita sob medida para o portal atual: disciplinas e professor pela API do portal, e em cada disciplina a Sala de Avaliações (Prova AV, Prova AVS e Minhas notas). Vira tarefa o período de agendamento de cada prova (a AVS só se a nota parcial ainda não chega a 6), vira avaliação a prova marcada, vêm as notas (AV, AVS, simulados, progresso e parcial), o aviso da mensalidade com vencimento e a renovação de matrícula pendente.

## [0.12.0] - 2026-11-19

### Adicionado
- Backup automático dos dados na sua conta (a mesma do Financy) sempre que o app vai para o fundo; numa instalação nova o Órbita oferece restaurar. Também dá para exportar e importar um arquivo .json (Configurações › Seus dados).
- Estácio lê tudo sozinha: depois do login, percorre as páginas de notas, provas, agendamento, calendário e financeiro. Provas e entregas viram avaliações em Estudos; janelas de agendamento e prazos viram tarefas de prioridade alta; boletos vão para Boletos.
- Atualização diária da Estácio em segundo plano (pode desligar); se a sessão expirar, Estudos avisa para entrar de novo.

### Mudado
- Build do IPA com ccache e cache do CocoaPods, sem avisos dos pods e com actions em Node 24.

## [0.11.1] - 2026-11-19

### Corrigido
- O app fechava ao abrir: a lista de projetos da nova tarefa era recriada a cada desenho e travava a tela num laço. Agora é calculada uma vez por mudança.
- Abrir pelo aviso de um boleto não depende mais de uma função que não existe na prévia web.

## [0.11.0] - 2026-11-19

### Mudado
- Finanças só leem o Financy: o Órbita não grava, edita nem apaga lançamentos. "Lançar" (e o check-in, os boletos, as cobranças e o simulador) abre o Financy já preenchido; compras do Apple Pay vão para o Financy só com a categoria.
- Modais e folhas abrem sem o teclado; ele só aparece quando você toca no campo.
- Tarefas agrupadas por prazo, origem ou prioridade, com selos de prioridade, projeto de origem (ou caixa de entrada) e prazo em cada tarefa.
- Nova tarefa: escolha prioridade e projeto com um toque.

### Corrigido
- Ícone do app acompanhando a cor: escolhe pelo matiz, tem 5 cores novas (roxo, índigo, rosa, laranja, ciano), aplica ao ligar a opção e ao abrir o app, e tenta de novo se o iOS recusar.

## [0.10.0] - 2026-11-18

### Adicionado
- Filmes e Séries buscam no TMDB enquanto você digita: capa, sinopse, ano, gêneros, nota e onde assistir no Brasil (streaming, aluguel e compra), atualizado sozinho. A chave gratuita do TMDB fica no Keychain.
- Boletos: colar a linha digitável, o código de barras ou o Pix copia e cola, fotografar, abrir print ou PDF (inclusive com senha). Valor, vencimento e banco entram sozinhos, com conferência dos dígitos e aviso na véspera e no dia. Ao pagar, dá para lançar nas Finanças.
- Estácio: o portal abre dentro do Órbita; depois do login, ele importa disciplinas, notas, faltas e boletos (inclusive em PDF). A senha não passa pelo Órbita.
- Estudos mostra notas e faltas vindas da Estácio.
- Tocar no aviso de um boleto abre a tela de Boletos.

## [0.9.3] - 2026-11-18

### Corrigido
- Faixa preta embaixo das telas ao rolar: o fundo colorido agora cobre a tela toda.
- Widget de saldo em branco: ele procura o App Group que de fato veio na assinatura (o Sideloadly pode trocar o nome) e, sem dados, mostra "Abra o Órbita para atualizar".

### Adicionado
- Configurações › Widget de saldo mostra se o widget está conectado ao app e atualiza na hora com um toque.

## [0.9.2] - 2026-11-17

### Corrigido
- Modais e folhas abriam por baixo do teclado: agora sobem junto com ele, encolhem para caber na tela e rolam até o campo em foco.
- Telas com campos de texto também deixam o campo visível acima do teclado.
- Cards e botões às vezes ficavam sem fundo nem borda no iOS 26: o Liquid Glass fica só nas partes flutuantes (barra, folhas, cabeçalho) e o conteúdo usa um vidro leve que sempre aparece.

## [0.9.1] - 2026-11-16

### Adicionado
- Finanças usa o Financy como base: o Órbita lê, cria, edita e apaga os lançamentos, cartões e categorias direto no Financy, com espelho local para funcionar offline.
- Saldo, previsto e widget passam a vir do Financy.
- Opção para voltar aos dados próprios do Órbita e enviar os lançamentos antigos para o Financy.
- Animação do app em 2K e 60 quadros no README, gravada de uma tela real de iPhone.

### Alterado
- Compra feita com Apple Pay entra como provisória e é trocada pela compra do banco, sem duplicar.
- O Órbita passa a ser só para iPhone: saem a configuração Android, os ícones Android e o script `npm run android`.

## [0.9.0] - 2026-11-15
<!-- commit: 84ae65cec818c5bdfe479be215d65ecda9ad19ea -->

### Adicionado
- Ícone próprio (planeta em órbita), irmão do ícone do Financy, com versões escura e tingida do iOS 18.
- Ícone do app em 5 estilos (Grafite, Cor, Claro, Contorno, Mono) e 6 cores, podendo acompanhar a cor do app.
- Estilos Vidro e Gradiente para os ícones das listas.
- Conectar ao Financy com um toque (`orbita://financy/conectar`).

### Alterado
- Tudo sincroniza sozinho, sem botões de sincronizar (puxar a tela ainda atualiza).
- Chave manual, troca de chaves e desconectar ficam em Configurações › Avançado.

### Corrigido
- Build do CI confere se o widget, o App Group e a Live Activity estão dentro do app (e falha se faltarem).

## [0.8.0] - 2026-11-14
<!-- commit: f22d958d746e8d618a6b417d0caec5d39c46fe90 -->

### Adicionado
- Interligação com o Financy: abrir o lançamento completo no app ou no site, saldo e mês do Financy nas Configurações e no widget, e categoria das compras do Apple Pay enviada ao Financy com fila offline.
- Aparência: cores prontas e próprias, roda de intensidade (0 a 11) e estilos de ícone, compartilhada com o Financy nos dois sentidos.

### Alterado
- Menu inferior no desenho do Financy: uma pílula de vidro única, e o botão + da captura rápida no topo das telas Hoje e Tarefas.
- Check-in do dia num modal simples de uma tela só, com Salvar e Agora não.

## [0.7.0] - 2026-11-14
<!-- commit: 026c73488940038f0ddf07a14fe1cb2093294ac0 -->

Primeira versão pública.

### Adicionado
- App de organização pessoal em Expo SDK 58 com Liquid Glass.
- Módulos de tarefas, hábitos, finanças, trabalho, saúde, estudos e outros.
- Lançamentos automáticos de compras feitas com Apple Pay (Atalhos do iPhone) e conferência com o Meu Pluggy.
- Widget de saldo e modo foco com Live Activity.
- Workflow do GitHub Actions que gera o `.ipa` para instalar pelo Sideloadly.
- Check-in diário na primeira abertura do dia (humor, sono, energia, intenção do dia e o que ficou de ontem), com a intenção no topo da tela Hoje.
- Painel de diagnóstico com as últimas compras recebidas pelo Atalhos.

### Corrigido
- Compras feitas com o app suspenso agora entram: a fila do Atalhos é relida sempre que o app volta ao primeiro plano.
- Uma compra nunca é descartada: valor não reconhecido entra com R$ 0 e o texto original.

[0.9.1]: https://github.com/GabrielPMachado/Orbita/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/GabrielPMachado/Orbita/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/GabrielPMachado/Orbita/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/GabrielPMachado/Orbita/releases/tag/v0.7.0
