# Changelog

Todas as mudanças relevantes do Órbita ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/). A versão é a mesma do `app.json`.

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
