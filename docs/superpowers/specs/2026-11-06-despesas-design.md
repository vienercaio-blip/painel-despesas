# Página Despesas: "para onde foi o dinheiro" — design

Data: 06/11/2026 · Etapa 2 do redesenho "sobrou.", parte 6 · Ramo: `despesas`

## Por que

Hoje a página Despesas repete o Dashboard (Entradas, Saídas, Resultado, Maior despesa,
Categorias). O usuário escolheu que ela vire uma página **só sobre gastos**: para onde foi
o dinheiro, com mais profundidade que o Dashboard. Público leigo, sem tempo: uma coluna,
frases simples, nada de número errado em silêncio.

## Escolhas do usuário (navegador, 06/11)

- Papel: "Para onde foi o dinheiro" (não só arrumar, não juntar com o Dashboard).
- Layout **A · Lista que abre**: número no topo, divisão fixas × dia a dia, categorias que
  abrem no lugar. Uma coluna, igual no celular.
- Faixas abaixo das categorias: **Gastos mês a mês, O que mudou, Maiores gastos, Resumo em frases** (todas).
- Detalhe da categoria aberta (escolha delegada): **mês a mês + onde foi o dinheiro + "Ver os N lançamentos"**.
  Ficou fora "comparação com a média" (O que mudou já cobre; "média" confunde com um mês só).
- Gráfico do mês a mês da categoria: **B · barras com o mês mais caro** em dourado e o valor
  em cima, média tracejada, nomes dos meses embaixo, dica ao passar o mouse.

## O que sai

- Quadros Entradas, Resultado do período e Maior despesa (estão no Dashboard).
- O Fluxo atual (entradas × saídas).
- Do Resumo: "Sobraram…", comparação de entradas e o maior pagamento individual (vira a faixa Maiores gastos).
- Clicar numa categoria deixa de levar a Organizar › De onde veio: agora abre no lugar.

O Período, a faixa de meses, o "Como funciona" (balão) e o "Comparar…" continuam como estão.

## As faixas (de cima para baixo)

Todas seguem o Período. "Saída" = o que `saiDaConta` considera (sem dinheiro guardado nem
transferências entre contas; estornos descontam, como hoje).

### 1. Topo

- Título grande: **"Saiu R$ X por mês"** usando o mesmo divisor do Dashboard
  (`Periodo.fatorMes`; com dias exatos ≥ 30 dias, "por mês" é a média de 30 dias).
  Quando o divisor é 1 (um mês, uma semana, dias exatos < 30): **"Saiu R$ X em out/26"**
  / "em 12 dias" (mesmo texto curto do período que o Dashboard usa).
- Linha de baixo: "R$ total em N meses · N lançamentos" e, se existir período anterior
  coberto por inteiro (`Periodo.anterior` + `cobreInteiro`, mesma regra das setas de hoje),
  "+4% que <nome do anterior>" (vermelho se subiu, verde se caiu).
- Barra de duas cores: **Contas fixas** (categorias de tipo `fixo`, as mesmas de `FIXED`)
  em dourado e **Dia a dia** (todo o resto, inclusive "sem categoria") em azul, com
  "R$ x/mês (49%)" de cada parte. Se as saídas forem zero: "Nenhuma saída neste período." e
  as outras faixas somem.

### 2. Categorias

- Lista do maior para o menor ("Outras"/sem categoria sempre por último), cada linha com
  nome, "R$ x/mês · 27%" (ou o total quando o divisor é 1) e barra.
- Mostra as **6 maiores** e "Ver todas as N categorias" (e "Mostrar menos").
- **Uma aberta por vez.** Clicar abre/fecha (botão com `aria-expanded`). Ao entrar na página
  nenhuma está aberta. A categoria aberta fica guardada enquanto o período mudar; se ela
  sumir do período, fecha.
- Aberta mostra:
  1. **Mês a mês** (opção B): uma barra por mês do período com saídas nessa categoria, o mês
     mais caro em dourado com o valor em cima, os demais neutros, linha tracejada na média
     (média dos meses mostrados), rótulos de mês embaixo (pulando rótulos se não couber),
     dica ao passar o mouse/tocar com "mês: R$ x". Mês cortado pelo extrato leva "(até dd/mm)"
     / "(desde dd/mm)" na dica e barra mais clara. Com Período de **um mês**, as barras são
     por semana; com **uma semana**, o gráfico não aparece. Com 1 barra só, também não aparece.
  2. **Onde foi o dinheiro**: as 3 origens (mesmo agrupamento por `origin` de "De onde veio")
     que mais levaram, cada uma com "R$ total · % da categoria"; se houver mais, uma linha
     "+ N outras origens · R$ y".
  3. Link **"Ver os N lançamentos →"** (usa `abrirLancamentos(cat)`).
- Estornos maiores que os gastos (categoria negativa) não entram na lista, como na barra do Dashboard.

### 3. Gastos mês a mês

- Barras só de saídas, na unidade de hoje do Fluxo: semana escolhida → por dia; um mês →
  por semana; até 40 dias → por semana; mais de 2 anos → por ano; senão por mês.
- Linha tracejada dourada na média das unidades **completas**; unidades cortadas pelo extrato
  ficam mais claras e com "(parcial)" na dica (mesma marcação feita no Fluxo da comparação).
- Legenda curta: "- - - média R$ x por <unidade>".

### 4. O que mudou

- Mesmo par de meses que a faixa Comparação do Dashboard (último mês do período contra o
  anterior; com "(até dd/mm)"/"(desde dd/mm)" quando cortado). Para não divergirem, a conta
  do par sai de `renderDashboard` para uma função usada pelas duas páginas.
- Frase: "Out/26 (até 28/10) contra set/26:" seguida das **2 categorias que mais subiram e as
  2 que mais caíram** em reais, como pílulas "Mercado +R$ 412 (+27%)" (vermelho) e
  "Lazer −R$ 240 (−100%)" (verde); categoria nova: "nova". Clicar numa pílula abre os
  lançamentos dela.
- Sem par (um mês só no extrato) ou com uma semana escolhida: a faixa some.

### 5. Maiores gastos

- Os **5** maiores pagamentos do período: `Analise.maioresGastos` com uma por origem, sem
  estornos e sem movimentos internos (igual ao Dashboard, que mostra 3). Data, descrição,
  valor; clicar leva à busca em Lançamentos (mesmo comportamento do Dashboard).

### 6. Resumo em frases

Só sobre gastos, na ordem:
- ⚠ "N despesas ficaram sem categoria (R$ x). Classifique em Organizar…" (existe hoje).
- ⚠/ℹ Taxas (existe hoje; aviso se > 5% das entradas).
- ℹ "As 3 maiores categorias levam X% de tudo o que saiu." (só com 4+ categorias).
- ℹ "Suas contas fixas equivalem a cerca de N dias de renda." (mesma conta e texto do
  Dashboard; só se houver entradas e contas fixas).
Se nenhuma frase couber, a faixa some.

## Comparar ligado

A faixa "Comparando A × B · Sair" continua no topo. Tudo por mês (`dadosPeriodo`):
- Topo: "Saiu R$ x por mês" do Período 1, embaixo "Período 2: R$ y · +R$ d" e a barra
  fixas × dia a dia do Período 1 com o percentual do Período 2 ao lado.
- Categorias: barras duplas de hoje; não abrem — clicar leva aos lançamentos, ainda comparando.
- Gastos mês a mês: as duas linhas de saídas de hoje (`renderFluxoComparacao`).
- O que mudou: entre Período 1 e Período 2, mesmas pílulas (2 subidas, 2 quedas, por mês).
- Maiores gastos: os 3 maiores de cada período, cada um com a etiqueta do período.
- Resumo: frases de `Periodo.resumoComparacao` + avisos (como hoje).

## Movimento

O número do topo conta até o valor; as barras (topo, categorias, gráficos) crescem; a
categoria abre deslizando (altura) e o gráfico dela cresce. Só ao trocar de período ou abrir
a página, não a cada redesenho. Com "reduzir movimento", tudo aparece pronto.

## Código

- Novo módulo puro **`frontend/js/despesas.js`** (testes em `frontend/tests/despesas.test.js`):
  divisão fixas × dia a dia, "onde foi o dinheiro" (top 3 + resto), série de barras com maior
  e média só das completas, "o que mudou" (2 subidas e 2 quedas, sem categorias negativas),
  frases do resumo. Contas em centavos arredondados para as partes somarem o total.
- `painel.js`: `render()` deixa de preencher kIn/kRes/kTop; nova `renderDespesas()` (e a
  versão comparando substitui `renderDespesasComparacao`); `renderFlow` e o handler de
  `#cats` saem; função compartilhada do par de meses.
- `index.html`: novo miolo de `#viewDespesas` em faixas (`card faixa`), "Como funciona"
  de Despesas reescrito para as 6 faixas.
- `estilo.css`: estilos das faixas novas, reaproveitando `.faixa`, `.cmp-*`, `.tag-per`.

## Testes

- `node --test frontend/tests` (novo arquivo + os 106 de hoje) e `pytest` (203).
- Chrome (puppeteer, banco temporário na porta 5055): números do topo batem com o Dashboard
  (Saiu por mês), fixas + dia a dia = total, abrir/fechar categoria e só uma aberta, gráfico
  com o mês mais caro certo, link de lançamentos filtra, O que mudou igual ao Dashboard,
  Maiores gastos sem transferências, comparação, 390 px sem rolagem lateral, temas claro e
  escuro, reduzir movimento, console sem erros.

## Fora do escopo

Organizar (próxima parte), Vendas, PDF (continua saindo do Dashboard), gastos que se repetem
(estão na Economia).
