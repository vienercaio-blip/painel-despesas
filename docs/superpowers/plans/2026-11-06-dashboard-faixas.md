# Dashboard em faixas, com movimentos — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar o Dashboard em faixas finas empilhadas, com comparação, maiores gastos, previsão em linha, dicas em pílulas e cinco movimentos (spec `docs/superpowers/specs/2026-11-06-dashboard-faixas-design.md`).

**Architecture:** As contas novas são puras e testadas em `frontend/js/analise.js` (`comparacao`, `maioresGastos`, `fatias`). A marcação de `#viewDash` é reorganizada mantendo os ids existentes. `renderDashboard` em `painel.js` desenha as faixas novas e ganha funções de movimento que reaproveitam `semMovimento()` e `contarAte()`.

**Tech Stack:** JS ES5 sem build, CSS puro, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-06-dashboard-faixas-design.md`

## Global Constraints

- ES5 em `frontend/js`. Cores só por variáveis (`--accent`, `--s1`, `--s2`, `--surface-2`, `--good`, `--warn`, `--bad`…).
- Todos os números saem das contas que `renderDashboard` já faz (`T`, `months`, `byCat`, `cmpA`/`cmpB`, `pIns`/`pOut`/`pRes`, `Analise.*`). Nenhuma conta paralela.
- Movimentos: ≤ 0,8 s, curva `cubic-bezier(.2,.7,.2,1)`; com `semMovimento()` o estado final aparece na hora; a cascata não repete em redesenhos.
- Ids existentes mantidos (lista na spec §3). `state.resumo` continua gravado igual.
- Ao fim de cada tarefa: `node --test frontend/tests` e `node --check frontend/js/painel.js`.

## Review Focus

1. **Período de um mês só, ou semana:** sem dois meses para comparar, a faixa de comparação some (não aparece "em X saiu R$ 0 a mais"). Semana não tem comparação nem meses animados.
2. **Filtro de despesas ativo (`state.dashCats`):** as fatias e a legenda seguem o filtro como as barras seguem hoje; o veredito, os números, a previsão e os maiores gastos não mudam.
3. **Contagem dos números ao trocar de período várias vezes rápido:** o valor final é sempre o `brl.format` do período atual (uma contagem antiga não pode terminar por último).
4. **Categoria com saldo negativo (estornos maiores que os gastos):** ela fica de fora da barra fatiada, e a soma continua dando 100%.
5. **Celular (390 px):** os três números se empilham, a legenda quebra linha e nada transborda para o lado.

Os itens 1 e 4 têm testes puros na Tarefa 1. O 3 tem verificação no Chrome automático na Tarefa 4. O 2 e o 5 têm verificação no navegador na Tarefa 3.

---

### Tarefa 1: Contas novas (`analise.js`)

**Files:** Modify `frontend/js/analise.js`; Test `frontend/tests/analise.test.js`

**Interfaces — Produces:**
- `Analise.comparacao(A, B, brl, pct) -> {frase, alta, queda}`:
  - `A` e `B` = `{name, outs, cat:{nome:valor}}` (A = mês anterior, B = último);
  - `alta` e `queda` = `{nome, txt}` ou `null`;
  - `txt` = `'+18%'`, `'−12%'` ou `'nova'`.
- `Analise.maioresGastos(lista, n) -> lista` (itens `{data:Date, desc, valor}` com valor > 0).
- `Analise.fatias(linhas) -> [{nome, pct, outros}]` (linhas de `visiveis`; `pct` inteiro de 0 a 100).

- [ ] **Step 1:** testes. `brl` = `n => 'R$ '+n.toFixed(2)` e `pct` = `n => Math.round(n*100)+'%'` nos testes.
  - `comparacao` saiu mais: A `{name:'setembro de 2026', outs:1000, cat:{Mercado:400, Moradia:600}}`, B `{name:'outubro de 2026', outs:1120, cat:{Mercado:472, Moradia:600, Delivery:48}}` → `frase === 'Em outubro de 2026 saiu R$ 120.00 a mais que em setembro de 2026.'`, `alta` `{nome:'Mercado', txt:'+18%'}` (+72 é a maior variação em reais; Delivery +48 vem depois), `queda === null`.
  - saiu menos: B.outs 900 → frase com `'a menos'`; a maior queda aparece com `'−'`.
  - igual: `'Em outubro de 2026 saiu o mesmo que em setembro de 2026.'` (diferença abaixo de R$ 0,50).
  - categoria nova como maior alta → `txt:'nova'`.
- `maioresGastos`: ordem por valor; empate → a data mais recente primeiro; `n` maior que a lista → a lista inteira.
  - `fatias`: linhas `[{nome:'A',pct:.333},{nome:'B',pct:.333},{nome:'Outros',pct:.334,outros:true},{nome:'N',pct:-.1,negativo:true}]` → soma dos `pct` = 100, 'N' fica de fora, 'Outros' por último.
- [ ] **Step 2:** `node --test frontend/tests`, que deve FALHAR (funções inexistentes).
- [ ] **Step 3:** implementar.
  - `fatias` arredonda cada `pct*100` e soma a diferença para 100 na maior fatia que não seja Outros. As porcentagens são recalculadas entre as linhas positivas.
  - `comparacao` usa `Math.abs(B.outs-A.outs)<0.5` para "o mesmo"; a alta e a queda saem das categorias com variação ≠ 0, ordenadas por `|d|`.
- [ ] **Step 4:** `node --test frontend/tests`, que deve PASSAR.
- [ ] **Step 5:** commit "Analise: comparação com o mês anterior, maiores gastos e fatias da barra de categorias".

### Tarefa 2: Marcação e estilo das faixas

**Files:** `frontend/index.html` (`#viewDash`), `frontend/css/estilo.css`

**Interfaces — Produces:** ids novos `dCmp` (section.faixa), `dCmpTx`, `dFatias`, `dLegenda`, `dTodasBtn`, `dGastosSec`, `dGastos` (ul), `dPrev` (section.faixa), `dPrevTx`. A classe `faixa` vai em todas as faixas, e `#dashBank` passa a ser uma coluna com gap de 10 px.

- [ ] **Step 1:** reorganizar `#dashBank` na ordem da spec §1:
  - `#dVer` (classe `card verdict faixa`, veredito e pesa numa linha `.verdict-frase`) e, logo abaixo, `#dNums` como faixa própria (`section.card.faixa` com `#dNums` dentro). Os avisos `dAvisoPasta`, `dInterno` e `dAvisoLeitura` ficam dentro de `#dVer`;
  - `#dCmp`;
  - `#dOnde` (cabeçalho: h2 Categorias + filtro + `#dTodasBtn` "Ver todas as categorias"; depois `#dFatias` (div.fatias), `#dLegenda` (ul.legenda), `#dFiltroAviso`, `#dBarras` com `hidden` até "Ver todas", e `#dFixLinha`);
  - `#dMesSec`;
  - `#dGastosSec`;
  - `#dPrev`;
  - `#dAcoesSec`;
  - `#dDet`, sem a seção da Previsão. `#dProj` sai do HTML, e `#dCum` fica sozinho na largura toda.
  - Os `.dash-grid2` e `.dash-grid3` saem.
- [ ] **Step 2:** CSS:
  - `.faixa{padding:12px 16px}`, com o título da faixa em linha;
  - `.fatias{display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--surface-2)}` e `.fatias button{all:unset;cursor:pointer;height:100%}`, com cor por `style="background:..."` vinda do JS;
  - `.legenda` em linha com bolinha de cor;
  - `#dNums` em grade de 3 colunas (1 abaixo de 560 px);
  - `.gastos li` em linha (data · descrição · valor alinhado à direita);
  - pílulas de dicas `.acao-pilula` (como `.ptab`, com o valor em `--good`);
  - altura do gráfico de meses via JS.
  - Remover `.dash-grid2`/`.dash-grid3` e as regras de grid do Dashboard que ficarem sem uso.
- [ ] **Step 3:** `node --check` e `node --test`. Ainda nada novo para conferir na tela: a Tarefa 3 preenche as faixas.
- [ ] **Step 4:** commit "Dashboard: marcação e estilo das faixas".

### Tarefa 3: Conteúdo das faixas (`renderDashboard`)

**Files:** `frontend/js/painel.js`

**Interfaces — Consumes:** Tarefa 1; ids da Tarefa 2; `abrirLancamentos(cat)` (já existe).

- [ ] **Step 1:** faixas:
  - **comparação:** com `cmpA`, `Analise.comparacao(cmpA, cmpB, …)`. A frase vai em `#dCmpTx`, e "Maior alta: <button data-cat>Mercado</button> +18%." e "Maior queda: …" vão como botões `.cmp-cat` que chamam `abrirLancamentos`. Sem `cmpA` ou em semana: `#dCmp.hidden = true`;
  - **fatias:** `Analise.fatias(vis.linhas)` gera os botões em `#dFatias` (`data-cat`, `title` "Moradia · 27%", `aria-label`) e os itens em `#dLegenda`. As cores vêm de uma lista fixa de 5 tons gerada por `color-mix(in srgb, var(--s1) X%, var(--s2))` com X = 100, 80, 60, 40, 25, e Outros usa `var(--surface-2)` com borda;
  - **"Ver todas as categorias":** `#dTodasBtn` alterna `state.dashTodas` e mostra ou esconde `#dBarras` (que continua com a lista completa quando `state.dashTodas`). O texto alterna para "Ver menos";
  - **gráfico de meses:** altura 120 (ou 140 abaixo de 560 px), passada para `barSVG`;
  - **maiores gastos:** `Analise.maioresGastos(tx.filter(ehSaida && !estorno).map(t => ({data:t.date, desc:t.desc, valor:-t.value})), 3)` em `#dGastos`, cada `li` com um botão `data-gasto="<desc>"`. O clique faz `state.q = desc`, preenche `#q` e chama `abrirLancamentos('all')`. Lista vazia → `#dGastosSec.hidden = true`;
  - **previsão:** em `#dPrevTx`, a frase da spec §1.7 com `pIns`/`pOut`/`pRes` ("sobra" ou "falta" com `Math.abs`), mais o texto pequeno com N meses;
  - **dicas:** cada ação vira `<div class="acao acao-pilula" tabindex="0" data-tip data-more>` com o título · "~R$ X/mês" (sem o parágrafo do motivo, que continua no `data-tip`). Os cliques e o teclado existentes continuam funcionando, porque usam `.acao`.
- [ ] **Step 2:** Chrome automático (banco temporário, 1280×800, escuro e claro):
  - a faixa de Meses começa acima de 800 px (`getBoundingClientRect().top < 800`);
  - os textos da comparação batem com a tabela "Mudanças" (mesmo par de meses);
  - o clique na fatia e na legenda abre Lançamentos na categoria; o clique num gasto abre Lançamentos com a busca;
  - com o filtro "Só as 3 maiores", as fatias mostram 3 + Outros e os números não mudam (Review Focus 2);
  - a 390×844 não há rolagem lateral (Review Focus 5);
  - período de um mês só → sem faixa de comparação, se o mês anterior não existir no extrato (Review Focus 1).
- [ ] **Step 3:** commit "Dashboard: faixas de comparação, categorias fatiadas, maiores gastos, previsão e dicas em pílulas".

### Tarefa 4: Movimentos

**Files:** `frontend/js/painel.js`, `frontend/css/estilo.css`

**Interfaces — Produces:**
- `animarDashboard()`: cascata, chamada em `chegou()` quando a vista vira `dashboard` vinda de outra (`state.vistaDashAntes`);
- `contarValor(el, valor)`:
  - conta do valor anterior (`el.dataset.v`, 0 na primeira vez) até o novo em 800 ms;
  - termina com o `brl.format` exato e guarda `el.dataset.v`;
  - usa um token por elemento (`el._conta`) para que uma contagem antiga pare quando começar outra (Review Focus 3).

- [ ] **Step 1:** CSS:
  - dentro de `prefers-reduced-motion: no-preference`: `#viewDash.entra .faixa` com `sobe` (10 px) e atrasos de 70 ms por posição (até 9);
  - `.fatias button` com `transition: flex-grow .8s` (as fatias usam `flex-grow` com o `pct`; o crescimento começa em 0 com o `delay` via `style` de 80 ms × índice);
  - `.verdict.pulsa` com `pulso` de 1,2 s na cor de `--warn`/`--bad`;
  - as barras do `barSVG` com a classe `cresce`: `transform-origin:bottom; animation: cresceY .6s` e `animation-delay` por índice (40 ms, até 0,8 s no total).
- [ ] **Step 2:** JS:
  - `renderDashboard` passa os valores de `#dNums` por `contarValor` (os spans `.value` recebem `data-alvo`);
  - as fatias são desenhadas com `flex-grow:0` e, no quadro seguinte, recebem o valor (sem movimento → direto);
  - na chegada, as barras do gráfico recebem `cresce` (só na chegada, não nos redesenhos);
  - o veredito ganha `pulsa` na chegada se for `amarelo` ou `vermelho`.
- [ ] **Step 3:** Chrome automático:
  - na chegada, `#viewDash` tem `entra`, e os números terminam iguais ao `brl.format` (comparar com `state.resumo`);
  - trocar de período três vezes seguidas, rápido → o texto final é o do último período;
  - com "reduzir movimento" → sem `entra` e os números já no valor final;
  - o pulso só acontece com veredito amarelo ou vermelho.
- [ ] **Step 4:** commit "Dashboard: movimentos (cascata, números contando, fatias, meses e pulso)".

### Tarefa 5: Fechamento

- [ ] Rodar o conjunto completo (node e pytest) e os testes antigos do Chrome automático. Atualizar o "ONDE PARAMOS" no `docs/RESUMO-TRANSICAO.md`, fazer o commit e pedir a revisão do ramo inteiro (opus). Depois: correções, teste do usuário, merge e push.
