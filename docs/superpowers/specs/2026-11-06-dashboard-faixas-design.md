# Dashboard em faixas, com movimentos (etapa 2, parte 3)

Data: 06/11/2026. Base: `main` em `8262f0d`. Ramo de trabalho: `dashboard-faixas`.

## Objetivo

A pessoa leiga deve entender o Dashboard **quase sem rolar a tela**: tudo empilhado em faixas finas, da largura toda, uma por assunto. O Dashboard ganha movimento (como o Início) e três respostas que hoje não dá ou deixa escondidas: comparação com o mês passado, previsão do próximo mês e maiores gastos. A regra de ouro continua valendo: o site nunca mostra número errado calado, e todos os números saem das contas que o Dashboard já faz.

## Decisões do usuário (06/11)

- **Layout A · Faixas compactas**, escolhido entre A, B (linhas com nome à esquerda) e C (linhas que deslizam).
- **Novidades:** comparação com o mês passado, previsão, maiores gastos e meta de economia.
- **Página Economia separada** (próxima parte, com especificação própria). A meta de economia e as dicas completas vão para ela. O usuário deixou a divisão por minha conta, e eu escolhi fazer o Dashboard primeiro e a Economia em seguida.
- **Movimentos:** os seis aprovados. A barra da meta fica para a página Economia, então aqui entram cinco.

## 1. As faixas, de cima para baixo

Cada faixa é um cartão baixo (`card faixa`), da largura toda, com padding vertical de 10 a 12 px e título curto de uma palavra à esquerda, quando houver. Ficam fora dessa sequência:
- a faixa de **Período**, que continua como hoje, acima de tudo;
- os avisos de pasta, de movimento interno e de leitura, que continuam como estão.

1. **Veredito:** uma linha com `titulo` colorido + `texto`, e "O que mais pesa…" na mesma linha (cinza) quando couber. Sem números aqui.
2. **Números:** Entrou, Saiu e Sobrou (ou Faltou) **na mesma linha**, cada um com o total do período, o "por mês" embaixo e o minigráfico ao lado (os mesmos de hoje: `Analise.numeros` + `serieMeses`). No celular, os três se empilham.
3. **Comparação:** compara o último mês do período com o mês anterior. Usa os mesmos `cmpA`/`cmpB` que alimentam "Mudanças".
   - Uma frase: "Em <mês B> saiu <R$ X> a mais (ou a menos) que em <mês A>." e, na mesma linha, "Maior alta: <categoria> +NN%." e "Maior queda: <categoria> −NN%." (as duas maiores variações em reais, entre as categorias com gasto nos dois meses; "nova" quando não havia gasto no mês A).
   - Sem dois meses para comparar, a faixa não aparece.
   - Clicar na categoria abre Organizar › "De onde veio" daquela categoria (o mesmo atalho das barras).
4. **Categorias:** **uma barra só**, dividida em cores, com as 5 maiores + "Outros" (pela regra de `Analise.visiveis(…, 5)`), e a legenda em linha embaixo: "Moradia 27% · Mercado 20% …".
   - Cada pedaço e cada item da legenda são clicáveis e levam ao mesmo lugar que a barra leva hoje.
   - À direita do título ficam o filtro "Todas as despesas ▾" (igual a hoje) e o link "Ver todas as N categorias", que abre a lista de barras atual (`#dBarras`) logo abaixo, dentro da faixa.
   - A linha das contas fixas (`#dFixLinha`) fica embaixo, pequena.
   - As cores dos pedaços usam uma escala derivada de `--s1`/`--accent` até `--s2`, com "Outros" em `--surface-2`.
5. **Meses:** o gráfico "Meses" atual, na largura toda e com altura reduzida (120 px no computador, 140 px no celular), com o seletor "Período do gráfico" à direita do título. A dica do mês ao passar o mouse continua como hoje.
6. **Maiores gastos:** as 3 maiores saídas do período (lançamentos individuais, estornos de fora), em uma linha cada: data · descrição · valor.
   - Clicar abre Lançamentos com a busca preenchida pela descrição (`state.q`) e o período atual.
   - Sem saídas no período, a faixa não aparece.
7. **Previsão:** uma linha: "Próximo mês: entra ~<R$>, sai ~<R$>, sobra (ou falta) ~<R$>." e o texto pequeno "Média dos últimos N meses do extrato." Os mesmos números de hoje (`pIns`, `pOut`, `pRes`), que saem de "Ver mais detalhes".
8. **Dicas:** as ações de `Analise.acoes`, como **pílulas** em linha: "<título> · <economia>/mês". Clicar faz o mesmo que o clique nas ações hoje. Sem ações, aparece a frase de vazio atual.
   - Na parte seguinte (Economia), esta faixa vira um atalho para a página nova.
9. **Ver mais detalhes** (fechado): Saldo, Mudanças e Detalhes, como hoje. A Previsão sai daqui.

**Altura esperada:** num notebook (1280×800), as faixas 1 a 5 cabem na primeira tela, abaixo da faixa de Período.

## 2. Movimentos

Mesmas regras gerais do Início:
- duração de 0,8 s ou menos;
- curva `cubic-bezier(.2,.7,.2,1)`;
- só `transform`, `opacity`, `width` e `height` das barras;
- "reduzir movimento" mostra o estado final na hora (com `semMovimento()` e a regra global do CSS);
- nenhuma biblioteca nova.

1. **Cascata:** ao chegar no Dashboard (`chegou()` com a vista `dashboard`, vinda de outra vista), as faixas sobem 10 px e aparecem com 70 ms de diferença. Não repete quando o Dashboard é redesenhado por um filtro ou uma troca de período.
2. **Números contando:** os três valores de Entrou, Saiu e Sobrou contam do valor anterior até o novo (do zero na chegada), em 0,8 s, desacelerando.
   - O texto final é exatamente o `brl.format` do valor, para nunca parar num número diferente.
   - Vale na chegada e ao trocar de período.
3. **Barra de categorias se enchendo:** os pedaços crescem da esquerda para a direita, com 80 ms entre um e outro, na chegada e ao trocar de período ou de filtro.
4. **Meses subindo:** as barras do gráfico crescem de baixo para cima, com 40 ms entre uma e outra (no máximo 0,8 s no total), só na chegada.
5. **Aviso que pulsa uma vez:** quando o veredito é `amarelo` ou `vermelho`, a faixa dá um pulso de sombra na cor do veredito, uma vez, na chegada.

## 3. Onde fica cada coisa

- `frontend/js/analise.js` (puro e testado), funções novas:
  - `comparacao(A, B, brl, pct)`:
    - recebe os dois meses no formato `{name, ins, outs, cat:{nome:total}}`;
    - devolve `{frase, alta:{nome, txt}|null, queda:{nome, txt}|null}`;
    - a maior alta e a maior queda são escolhidas pela variação em reais, sem empate instável.
  - `maioresGastos(lista, n)`:
    - recebe `[{data, desc, valor}]` (valor positivo = saída);
    - devolve as `n` maiores por valor, desempatando pela data mais recente.
  - `fatias(linhas)`:
    - recebe as linhas de `visiveis(...)`;
    - devolve `[{nome, pct, outros}]` com as porcentagens somando 100% (a diferença de arredondamento vai para a maior fatia);
    - as linhas com valor negativo ficam de fora.
- `frontend/index.html`: a marcação de `#viewDash` (faixas 1–8, mantendo os ids usados pelo código: `dVer`, `dVerT`, `dVerTx`, `dVerPesa`, `dNums`, `dOnde`, `dFiltroBtn`, `dFiltro`, `dBarras`, `dFixLinha`, `dRes`, `rPeriod`, `dAcoes`, `dDet`, `dCum`, `dChg*`, `dIns`). Ids novos: `dCmp`, `dFatias`, `dLegenda`, `dTodasBtn`, `dGastos`, `dPrev`. A seção `#dProj` sai de "Ver mais detalhes".
- `frontend/css/estilo.css`: `.faixa` e as classes de cada faixa, a barra fatiada, as pílulas de dicas e os movimentos. Remove o CSS que ficar sem uso (`.dash-grid2`/`.dash-grid3`, se mais nada usar).
- `frontend/js/painel.js` (`renderDashboard`):
  - desenha as faixas novas com as funções acima;
  - pílulas de dicas;
  - previsão em uma linha;
  - funções de movimento (`animarDashboard`, `contarValor`) reaproveitando `semMovimento()` e `contarAte`;
  - atalhos de clique (comparação, fatias, legenda, maiores gastos).
- `state.resumo` (o resumo do Início) continua sendo gravado do mesmo jeito.

## 4. Testes

- `node --test frontend/tests`, testes novos em `analise.test.js`:
  - `comparacao`: saiu mais, saiu menos, igual, categoria nova, sem categorias em comum;
  - `maioresGastos`: ordem, empate e menos de `n` itens;
  - `fatias`: soma 100 com arredondamento, "Outros" no fim e negativos de fora.
- `pytest` sem mudança.
- Chrome automático com banco temporário, nos temas escuro e claro, em 1280×800 e 390×844:
  - as faixas 1 a 5 acima da dobra a 1280×800;
  - os números do Dashboard e do resumo do Início iguais;
  - os cliques da comparação, das fatias, da legenda e dos maiores gastos;
  - os movimentos com e sem "reduzir movimento";
  - "Ver todas as categorias";
  - o filtro de despesas e a troca de período.

## Fora do escopo

- A página Economia: meta de economia, dicas completas, gastos que se repetem, simulador (próxima especificação).
- Despesas, Lançamentos e Organizar.
- O PDF exportado, que continua com o conteúdo de hoje.
