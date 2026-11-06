# Página Lançamentos: tabela melhorada + animações — design

Data: 06/11/2026 · Etapa 2 do redesenho "sobrou.", parte 7 · Ramo: `lancamentos`

## Por que

Hoje: uma tabela de 10 linhas por vez, da mais antiga para a mais nova, filtros em cima e um
modo separado "Editar categorias". O usuário entra na página para **achar um lançamento**,
**corrigir categorias** e **ver o que entrou**. Público leigo: menos cliques, nada de número
errado em silêncio.

## Escolhas do usuário (06/11)

- Layout **C · tabela de hoje, melhorada** (não a lista por dia nem as três abas).
- Ordenar clicando em **Data** e **Valor** (clique de novo inverte; começa pela data mais nova).
- Corrigir a categoria **direto na linha**, **continuando a perguntar** se vale para os próximos
  extratos (a pergunta de hoje, com "não perguntar de novo").
- Comparando: os números do topo mostram **os dois períodos**.
- **Todas as 8 animações** da demonstração.

## A página

O Período (com Personalizado e Comparar) continua dentro do quadro, como hoje; a faixa de meses
continua fora de Lançamentos.

### 1. Três números no topo (clicáveis)

Logo abaixo do Período: **Entrou**, **Saiu** e **Para revisar**.
- Entrou/Saiu = os mesmos totais do Dashboard para o período (`sums`, sem dinheiro guardado nem
  transferências entre contas; estornos descontam). Embaixo: "em out/26", "em 12 meses" etc.
  (o mesmo texto curto de Despesas).
- Para revisar = quantas saídas do período estão em "Outros (revisar)". Zero: "Nada para revisar ✓".
- Clicar em Entrou mostra só Entradas; em Saiu, só Saídas; em Para revisar, só as saídas em
  "Outros (revisar)" (categoria filtrada). O número clicado fica marcado (`aria-pressed`).
  Clicar de novo no marcado volta para Todos.

### 2. Ferramentas

Uma linha: **busca** (descrição), abas **Todos · Saídas · Entradas** e o filtro de **Categoria**
(de hoje). O botão "Editar categorias" e a dica "Para corrigir uma categoria…" saem.

### 3. Tabela

- Colunas: Data · Descrição · Categoria · Valor (e "Período" ao comparar, como hoje).
- Ordem inicial: **data mais nova primeiro**. Os títulos **Data** e **Valor** são botões:
  clicar ordena por eles, clicar de novo inverte; setinha ▲/▼ mostra a ordem (`aria-sort`).
  Valor ordena pelo tamanho (o maior gasto ou a maior entrada primeiro em ▼).
- **Categoria sempre editável**: cada linha tem o seletor de categoria com cara de etiqueta
  (entrada: Entrada ou um dos movimentos internos; saída: as categorias + "Criar nova
  categoria…"). "Outros (revisar)" aparece como etiqueta "Revisar" dourada. Trocar abre a
  pergunta de hoje (`perguntarMudanca`).
- **50 por vez** por padrão ("Mostrar por vez" continua: 10, 25, 50, 100, Todos), Anterior/Próxima.
- Rodapé de hoje ("Mostrando 1 a 50 de 613 · soma …"), e o de comparação continua igual.

### 4. Comparando

A faixa "Comparando A × B · Sair" e o filtro "Os dois · A · B" continuam. Os números do topo:
Entrou e Saiu **por mês** do Período 1 com "P2: R$ y" embaixo (`dadosPeriodo`); Para revisar
conta as saídas em "Outros (revisar)" dos dois períodos (sem contar duas vezes as que estão nos
dois).

## Animações (todas, nenhuma com "reduzir movimento")

1. **Números contam**: ao abrir a página contam de zero; ao trocar o período, do valor antigo ao novo.
2. **Linhas em cascata**: ao abrir a página e ao trocar período, filtro, aba, categoria filtrada
   ou "Mostrar por vez", as linhas visíveis aparecem uma após a outra (atraso de ~25 ms cada, no
   máximo ~0,5 s). Ordenar não usa a cascata (ver 3).
3. **Ordenar desliza**: ao clicar em Data/Valor, as linhas que estavam visíveis deslizam até o
   novo lugar (técnica FLIP: posição antiga → nova); as que entram aparecem; a setinha gira.
4. **Correção confirmada**: depois de corrigir, a etiqueta da linha acende em verde com ✓ por
   ~1 s e o número "Para revisar" (se mudou) dá um salto. Corrigir **não** refaz a cascata.
5. **Busca destaca e filtra suave**: o trecho buscado fica marcado em dourado na descrição; as
   linhas que deixam de bater somem encolhendo antes da lista ser redesenhada (~0,3 s).
6. **Linha realça ao passar o mouse**: fundo, desliza 3 px para o lado e o valor acende.
7. **Trocar de página desliza**: Próxima entra pela direita, Anterior pela esquerda.
8. **"Para revisar" chama atenção**: ao clicar nele, as etiquetas "Revisar" pulsam duas vezes.

Redesenhos sem mudança de período/filtro (corrigir categoria, redimensionar) não animam nada
além do item 4.

## Código

- `painel.js`: `renderTable` ganha o topo (`#lNums`), a ordenação (`state.txOrd = {col, dir}`),
  o seletor sempre ativo, o realce da busca (reaproveita `realce` do Início), o modo da animação
  (entrada/troca/calmo, como em Despesas) e a FLIP da ordenação. `state.editLanc` e o botão
  `#editLanc` saem. Padrão `state.txPor = 50`.
- Função pura nova em `frontend/js/analise.js` (testada): `ordenarLancamentos(lista, col, dir)`
  (data/valor, estável, empate pela data mais nova) e `paraRevisar(lista, ehOutro)`.
- `index.html`: topo de números, títulos Data/Valor como botões, ajuda de Lançamentos reescrita
  (sem "Editar categorias").
- `estilo.css`: etiqueta-seletor, números, setinhas e as animações.

## Testes

- `node --test frontend/tests` e `pytest`.
- Chrome (cliques reais): números iguais ao Dashboard; clicar nos números filtra; ordenar por
  Data/Valor (e inverter); corrigir a categoria na linha (pergunta aparece; Para revisar diminui;
  etiqueta verde); 50 por vez; comparação; busca com marca; as 8 animações e "reduzir movimento";
  390 px sem rolagem lateral; console sem erros. Regressões: c3 (Lançamentos comparando), y6, x10.

## Fora do escopo

Organizar, Vendas, a página de categorias (De onde veio), exportar lista.
