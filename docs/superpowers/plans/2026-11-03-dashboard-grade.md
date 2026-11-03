# Dashboard em grade: plano de implementação

> **Para quem executar:** use superpowers:executing-plans. A especificação é `docs/superpowers/specs/2026-11-03-dashboard-grade-design.md`, e as decisões estão lá. O trabalho fica no ramo `dashboard-grade`. Commits em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Tarefa 1: regras puras (TDD)

- **Testes**, em `frontend/tests/analise.test.js`, seguindo a seção 5 da especificação, para `visiveis` e `serieMeses`.
- **Rodar e ver os testes falharem.** Depois implementar em `analise.js` e exportar as duas funções.
- **Ver os testes passarem.** Commit com a mensagem `Regras do Dashboard em grade: 5 maiores categorias e séries dos minigráficos`.

## Tarefa 2: gráficos com altura própria e minigráfico (`painel.js`)

**`barSVG(data, o)`:**
- `o.altura` define a altura `H` do viewBox;
- `o.largura` define a largura `W`, que por padrão continua 640;
- quando `o.altura` existe, as margens e o tamanho das letras seguem o padrão compacto, sem a classe `big`;
- `o.minW` padrão 0 quando compacto.

**`lineSVG(pts, o)`:** recebe as mesmas `o.altura` e `o.largura`, e o `min-width` dele pode ser zero.

**`sparkSVG(valores, cor, dicas) -> string`:**
- viewBox `0 0 100 28`, com `preserveAspectRatio="none"` só no caminho da linha;
- linha de 2 px com `vector-effect:non-scaling-stroke`;
- um `<rect class="hit">` invisível para cada ponto, com o `data-tip` da dica (mês e valor);
- devolve `''` quando a lista de valores vem vazia.

**CSS:** com a altura fixa vinda do viewBox, a regra `.chart-box svg{min-width:420px}` passa a valer só para `.chart-box svg.big`, para os gráficos compactos não estourarem a largura do cartão.

## Tarefa 3: estrutura da página e estilo

**`index.html`, seção do Dashboard:**
- `#dNums` continua o mesmo, e o JS acrescenta o minigráfico dentro de cada `.kpi`;
- `<div class="dash-grid2">` passa a envolver `#dOnde` (o cartão "Para onde vai o dinheiro") e o cartão do "Mês a mês", que sai da `.grid2` atual;
- `#dAcoesSec` fica depois dessa grade, com `#dAcoes` usando `.dash-grid3`;
- dentro do `<details id="dDet">`, uma `.dash-grid2` com o cartão do saldo acumulado (`#dCum`) e o da projeção (`#dProj`), e embaixo o cartão das categorias que mais mudaram;
- saem a `.grid2` dos dias, `#dWeekCard`, `#dWeek` e o cartão de `#dDom`.

**CSS:**
- `.dash-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}`;
- `.dash-grid3`, com 3 colunas;
- abaixo de 900 px, as duas viram uma coluna;
- `.acao` compacto: o título com 15 px e o motivo (`p`) escondido, exceto `.eco`;
- `.kpi .spark{margin-top:6px}`.

**JS:**
- o código de `#dWeek` e de `#dDom` sai, junto com as variáveis que só eles usavam (`dowTx`, `dowAvg`, `domTx`, `domOut`, `bestD`, `order`, `top3`);
- antes de apagar cada variável, conferir com grep que ela não é usada em outro lugar, como nos `insights` ou no PDF.

## Tarefa 4: ligar tudo em `renderDashboard`

- **Números:** depois de montar `#dNums`, acrescentar em cada `.kpi` o `sparkSVG(Analise.serieMeses(months, campo), cor, dicas)`:
  - os campos são `ins`, `outs` e `res`;
  - as cores são `var(--good)`, `var(--ink-3)` e `var(--s1)`;
  - as dicas são `'<b>'+o.name+'</b><br>'+brl.format(v)`;
  - na visão de semana, a série é `[]`.
- **Barras:**
  - `var vis = Analise.visiveis(bar.linhas, !!state.dashTodas, 5)`;
  - desenhar `vis.linhas`;
  - se `vis.escondidas>0` ou `state.dashTodas`, acrescentar um `<li class="barras-mais">` com um botão "Ver todas as N categorias" ou "Ver menos", que alterna `state.dashTodas` e chama `renderDashboard()`;
  - `load()` zera `state.dashTodas`.
- **Mês a mês:**
  - `barSVG(..., {altura:160, largura:520, ...})`, sem `big`;
  - sem filtro, a cor é `var(--s1)` quando o resultado for maior ou igual a 0, e `var(--bad)` quando for menor.
- **Saldo acumulado:** `lineSVG(pts, {altura:180, largura:520, ...})`.
- **Dicas (`.acao`):** o motivo vai para a dica (`data-tip`), e o `<p>` do motivo continua no HTML, escondido pelo CSS.
- **PDF:** conferir que `exportPdf` lê as barras dos dados, e não de `#dBarras li`. Se ler da tela, passar a guardar em `state.pdfBarras` todas as `bar.linhas`.

## Tarefa 5: verificação e fechamento

- Rodar as duas suítes de testes.
- Conferir a sintaxe e se cada `$('id')` existe no HTML.
- Abrir a página pelo servidor e conferir que ela responde 200.
- Revisão independente por um subagente (opus) e uma passada de correções.
- Teste do usuário, seguindo a seção 5 da especificação.
