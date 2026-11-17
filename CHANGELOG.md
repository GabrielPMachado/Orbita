# Changelog

Todas as mudanças relevantes do Órbita ficam registradas aqui.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Versionamento Semântico](https://semver.org/lang/pt-BR/). A versão é a mesma do `app.json`.

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

### Adicionado
- Ícone próprio (planeta em órbita), irmão do ícone do Financy, com versões escura e tingida do iOS 18.
- Ícone do app em 5 estilos (Grafite, Cor, Claro, Contorno, Mono) e 6 cores, podendo acompanhar a cor do app.
- Estilos Vidro e Gradiente para os ícones das listas.
- Conectar ao Financy com um toque (`orbita://financy/conectar`).

### Alterado
- Tudo sincroniza sozinho, sem botões de sincronizar (puxar a tela ainda atualiza).
- Chave manual, troca de chaves e desconectar ficam em Configurações › Avançado.

### Corrigido
- Conferência do App Group no build do CI.

## [0.8.0] - 2026-11-14

### Adicionado
- Interligação com o Financy: abrir o lançamento completo no app ou no site, saldo e mês do Financy nas Configurações e no widget, e categoria das compras do Apple Pay enviada ao Financy com fila offline.
- Aparência: cores prontas e próprias, roda de intensidade (0 a 11) e estilos de ícone, compartilhada com o Financy nos dois sentidos.
- Build do CI confere se o widget e a Live Activity estão dentro do app (e falha se faltarem).

### Alterado
- Menu inferior no desenho do Financy: uma pílula de vidro única, e o botão + da captura rápida no topo das telas Hoje e Tarefas.
- Check-in do dia num modal simples de uma tela só, com Salvar e Agora não.

## [0.7.0] - 2026-11-14

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
