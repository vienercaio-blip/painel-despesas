# Dashboard "resposta primeiro": plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** reorganizar o dashboard em veredito, ações, "para onde vai o dinheiro" (com filtro de categorias), mês a mês e um bloco de detalhes fechado.

**Arquitetura:** as contas e regras (sem DOM) ficam num módulo novo, `frontend/js/analise.js`, exposto como `window.Analise` e também exportável para o Node. O módulo é testado com `node --test`. O `painel.js` monta um objeto de contexto a partir dos lançamentos, chama o `Analise` e desenha a página.

**Tecnologia:** JavaScript ES5 sem build; `node --test` (Node 26) só para os testes; Flask/pytest no servidor, que não muda.

**Especificação:** [docs/superpowers/specs/2026-10-31-dashboard-resposta-primeiro-design.md](../specs/2026-10-31-dashboard-resposta-primeiro-design.md). Os textos, limites e porcentagens vêm de lá, ao pé da letra.

## Restrições gerais

- ES5 no navegador (`var`, `function`), no mesmo estilo do `painel.js`: nomes e comentários em português. Nada de bibliotecas novas.
- `analise.js` não toca em DOM, em `state` nem em `cfg`. Recebe tudo por parâmetro.
- O filtro **nunca** muda o veredito, os três números, as ações, o saldo acumulado nem a projeção.
- Moeda: o `analise.js` recebe a função de formatação (`brl`) pelo contexto, para usar o mesmo `Intl.NumberFormat` do painel.
- Testes JS: `node --test frontend/tests`. Testes do servidor: `backend/.venv/Scripts/python -m pytest -q` (dentro de `backend/`), que precisam continuar com 56 passando.
- Um commit por tarefa, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Pontos de atenção na revisão

1. **Período sem nenhuma saída** (só entradas): o veredito fica verde, as barras ficam vazias com a mensagem "Nenhuma saída neste período" e não aparece nenhuma ação. Fica a cargo das Tarefas 1 e 4.
2. **Filtro com uma categoria que deixa de existir no período** (o filtro foi escolhido no ano todo e depois o usuário escolhe um mês sem aquela categoria): ela não aparece nas barras. A faixa conta só as que têm valor, e o seletor mantém a escolha. Fica a cargo da Tarefa 4.
3. **Categoria renomeada com o filtro ligado:** a escolha acompanha o nome novo, via `renameCat`. Fica a cargo da Tarefa 4.
4. **Entradas zero e saídas zero ao mesmo tempo** (o período não tem nada): o painel já volta para o extrato inteiro em `render()`. O veredito nunca recebe esse caso, e o teste confere que `veredito` com `ins=0, outs=0` não lança erro. Fica a cargo da Tarefa 1.
5. **Celular:** os cartões de ação mostram as origens ao tocar (usa o `data-more` já existente). O painel do filtro cabe em 360 px de largura. Fica a cargo das Tarefas 3 e 4 (conferido no roteiro manual).

---

### Tarefa 1: módulo `analise.js` — veredito, barras e atalhos do filtro

**Arquivos:**
- Criar: `frontend/js/analise.js`, `frontend/tests/analise.test.js`

**Interfaces:**
- Produz:
  - **`Contexto`**, o objeto montado pelo `painel.js` na Tarefa 3:
    `{ perfil:'pf'|'empresa', escopo:'meses'|'mes'|'semana', nM:number, ins:number, outs:number, byCat:{nome:total}, meses:[{name:string, cat:{nome:total}}], fixas:[nome], nomes:{delivery,tarifas,assinaturas,compras,dividas,taxas}, outros:string, brl:function(n)->string, pct:function(n)->string }`.
    Em `nomes`, cada valor é o nome atual da categoria ou `null`. `byCat` é a soma das saídas (os estornos já descontam) e `meses` vem em ordem cronológica.
  - `Analise.veredito(ctx) -> {cor:'verde'|'amarelo'|'vermelho', titulo:string, texto:string, pesa:string|null}`
  - `Analise.barras(ctx, selecionadas:[nome]|null) -> {linhas:[{nome, mes:number, pct:number, fixa:bool, seta:'sobe'|'desce'|null, negativo:bool, outros:bool}], total:number}`
  - `Analise.atalho(tipo:'todas'|'top3'|'top5'|'semFixas', ctx) -> [nome]|null` (`null` = todas)

- [ ] **Passo 1: escrever os testes em `frontend/tests/analise.test.js`**

Usar `node:test` e `node:assert`. Carregar com `require('../js/analise.js')` (o módulo termina com `if (typeof module!=='undefined') module.exports = Analise;`). Criar um ajudante `ctx(over)` com valores padrão (pf, escopo `'meses'`, `nM=1`, `brl` = `n => 'R$ '+n.toFixed(2)`, `pct` = `n => Math.round(n*100)+'%'`). Testes:

```js
test('veredito verde, amarelo, vermelho e sem entradas (pf)', () => {
  assert.equal(Analise.veredito(ctx({ins:1000, outs:850})).cor, 'verde');      // sobra 15%
  assert.equal(Analise.veredito(ctx({ins:1000, outs:950})).cor, 'amarelo');    // sobra 5%
  assert.equal(Analise.veredito(ctx({ins:1000, outs:1200})).cor, 'vermelho');
  const v = Analise.veredito(ctx({ins:0, outs:300}));
  assert.equal(v.cor, 'vermelho'); assert.match(v.texto, /não entrou nada neste período/);
});
test('limite de 10% é verde', () => assert.equal(Analise.veredito(ctx({ins:1000, outs:900})).cor, 'verde'));
test('textos de pf e empresa', () => {
  assert.equal(Analise.veredito(ctx({ins:1000, outs:850})).titulo, 'Tudo certo:');
  assert.equal(Analise.veredito(ctx({perfil:'empresa', ins:1000, outs:850})).titulo, 'Lucro saudável:');
  assert.equal(Analise.veredito(ctx({perfil:'empresa', ins:1000, outs:1200})).titulo, 'Prejuízo:');
});
test('por mês / neste mês / nesta semana', () => {
  assert.match(Analise.veredito(ctx({ins:2000, outs:1700, nM:2})).texto, /por mês/);
  assert.match(Analise.veredito(ctx({ins:1000, outs:850, escopo:'mes'})).texto, /neste mês/);
  assert.match(Analise.veredito(ctx({ins:1000, outs:850, escopo:'semana'})).texto, /nesta semana/);
});
test('o que mais pesa ignora Outros', () => {
  const v = Analise.veredito(ctx({ins:1000, outs:500, byCat:{'Outros (revisar)':300, 'Mercado':200}}));
  assert.equal(v.pesa, 'O que mais pesa: Mercado, com 40% dos gastos.');
});
test('veredito sem nada não lança erro', () => assert.doesNotThrow(() => Analise.veredito(ctx({ins:0, outs:0}))));
test('barras: ordem, Outros por último, negativo e seta', () => {
  const c = ctx({nM:2, byCat:{'Mercado':400, 'Outros (revisar)':900, 'Compras online':-20, 'Moradia':1000},
    meses:[{name:'set', cat:{'Mercado':100}}, {name:'out', cat:{'Mercado':300}}], fixas:['Moradia']});
  const b = Analise.barras(c, null);
  assert.deepEqual(b.linhas.map(l => l.nome), ['Moradia', 'Mercado', 'Compras online', 'Outros (revisar)']);
  assert.equal(b.linhas[0].fixa, true);
  assert.equal(b.linhas[1].seta, 'sobe');          // out 300 vs média 200: +50%
  assert.equal(b.linhas[2].negativo, true);
});
test('barras respeitam a seleção', () =>
  assert.deepEqual(Analise.barras(ctx({byCat:{A:3, B:2, C:1}}), ['C', 'A']).linhas.map(l => l.nome), ['A', 'C']));
test('atalhos', () => {
  const c = ctx({byCat:{A:5, B:4, C:3, D:2, E:1, F:0.5, 'Outros (revisar)':9}, fixas:['A']});
  assert.equal(Analise.atalho('todas', c), null);
  assert.deepEqual(Analise.atalho('top3', c), ['A', 'B', 'C']);   // Outros não entra nos "maiores"
  assert.equal(Analise.atalho('top5', c).length, 5);
  assert.deepEqual(Analise.atalho('semFixas', c), ['B', 'C', 'D', 'E', 'F', 'Outros (revisar)']);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `node --test frontend/tests`
Esperado: FAIL (`Cannot find module '../js/analise.js'`).

- [ ] **Passo 3: implementar `frontend/js/analise.js`**

Use um IIFE que cria `var Analise = {...}`, atribua a `window.Analise` quando existir `window` e exporte para o Node. Copiar as frases da especificação (Parte 1) ao pé da letra. Regras:
- O "por mês" fica no fim da frase: `nM>1 ? 'por mês' : escopo==='semana' ? 'nesta semana' : 'neste mês'`. Com `escopo:'meses'` e `nM===1`, usar "neste mês".
- Os valores na frase são `ins/nM`, `outs/nM` e o resultado dividido por `nM`.
- A seta das barras exige `meses.length>=2`. Ela compara o último mês com a média dos meses do período na categoria e só aparece se variar mais de 10%.

- [ ] **Passo 4: rodar e ver passar**

Rodar: `node --test frontend/tests`
Esperado: todos passam.

- [ ] **Passo 5: commit**

```bash
git add frontend/js/analise.js frontend/tests/analise.test.js
git commit -m "Módulo de análise do dashboard: veredito, barras e atalhos do filtro"
```

---

### Tarefa 2: `analise.js` — ações ("O que fazer agora")

**Arquivos:**
- Modificar: `frontend/js/analise.js`, `frontend/tests/analise.test.js`

**Interfaces:**
- Consome: o `Contexto` da Tarefa 1.
- Produz: `Analise.acoes(ctx) -> {lista:[{id, titulo, motivo, economia:number|null, cat:string|null, link:'organizar'|null}], vazio:string|null}`.
  - `vazio` vem preenchido quando `lista` está vazia: na semana, "Escolha um mês ou mais para ver sugestões."; sem nenhuma ação, "Nada urgente: seus gastos estão sob controle." (empresa: "custos").
  - `id` é um destes: `delivery`, `tarifas`, `assinaturas`, `compras`, `dividas`, `taxas`, `tarifasEmpresa`, `fixos`, `normal`, `outros`.

- [ ] **Passo 1: escrever os testes**

Um teste por linha da tabela da Parte 2 da especificação. Cada um confere que a ação aparece **logo acima** do limite e **não aparece** no limite ou abaixo. Exemplos, todos com `nM:1`:

```js
test('delivery acima de 8% das saídas, economia metade', () => {
  const sim = Analise.acoes(ctx({outs:1000, byCat:{Delivery:81}, nomes:{delivery:'Delivery'}}));
  assert.equal(sim.lista[0].id, 'delivery'); assert.equal(sim.lista[0].economia, 40.5);
  assert.equal(Analise.acoes(ctx({outs:1000, byCat:{Delivery:80}, nomes:{delivery:'Delivery'}})).lista.length, 0);
});
test('ordem por economia, sem estimativa por último, no máximo 3', () => { /* 5 ações ativas → 3, ordenadas */ });
test('semana não sugere nada', () =>
  assert.equal(Analise.acoes(ctx({escopo:'semana', outs:1000, byCat:{Delivery:500}, nomes:{delivery:'Delivery'}})).vazio,
    'Escolha um mês ou mais para ver sugestões.'));
test('volta ao normal: 3+ meses, +20% e +R$ 50, só a maior', () => { /* meses [100,100,190] → aparece, economia 90; [100,100,140] → não aparece (só +40) */ });
test('nome renomeado: usa ctx.nomes', () => { /* nomes:{delivery:'Comida em casa'}, byCat:{'Comida em casa':200} → aparece */ });
test('empresa: maquininha usa % das entradas', () => { /* ins:1000, byCat:{Taxas:31} → aparece, economia 7.75 */ });
```

A ação "volta ao normal" compara o **último** mês de `meses` com a **média dos anteriores** do período, categoria por categoria (ignorando `outros`).

- [ ] **Passo 2: rodar e ver falhar.** `node --test frontend/tests`. Esperado: FAIL (`Analise.acoes is not a function`).
- [ ] **Passo 3: implementar `acoes(ctx)`** com os títulos, limites e economias da tabela, ao pé da letra. O `motivo` é "Você gastou R$ X por mês com [categoria], Y% de tudo que saiu." (empresa: "Saíram R$ X por mês com [categoria], Y% das saídas."), com uma variação própria para maquininha ("Y% do que entrou") e para "Outros" ("N% das saídas estão sem categoria.").
- [ ] **Passo 4: rodar e ver passar.** `node --test frontend/tests`. Esperado: todos passam.
- [ ] **Passo 5: commit.** `git commit -m "Ações sugeridas no dashboard com economia estimada"`

---

### Tarefa 3: nova estrutura da página — veredito, três números e ações

**Arquivos:**
- Modificar: `frontend/index.html` (o bloco `#dashBank` e a tag `<script>` do `analise.js` antes de `painel.js`), `frontend/css/estilo.css`, `frontend/js/painel.js` (`renderDashboard`)

**Interfaces:**
- Consome: `Analise.veredito` e `Analise.acoes` (Tarefas 1 e 2).
- Produz: `function contextoDash(tx) -> Contexto` em `painel.js`. É usado pela Tarefa 4.

- [ ] **Passo 1: HTML.** No lugar de `<section class="kpis" id="dKpis">`, criar:
  - `<section class="card verdict" id="dVer">` com `#dVerT` (título), `#dVerTx` (frase), `#dVerPesa` e `<div class="kpis kpis3" id="dNums">`;
  - `<section class="card" id="dAcoesSec">` com o `h2` "O que fazer agora" e `<div id="dAcoes" class="acoes">`.

  Apagar o card "Custos fixos e variáveis" (`#dFix`, `#dFixT`).
- [ ] **Passo 2: CSS.**
  - Tokens `--warn` (claro `#9A6700`, escuro `#E3B341`) em `:root` e nos dois blocos escuros, ao lado de `--good` e `--bad`.
  - `.verdict` com borda esquerda de 4px na cor do estado (`.verdict.verde/.amarelo/.vermelho`), título em 20px e negrito.
  - `.kpis3` com 3 colunas, que viram 1 abaixo de 560px.
  - `.acoes` em grade de cartões, `.acao .eco` em `--good`, e `.acoes-vazio` em `--good`.
- [ ] **Passo 3: `contextoDash(tx)`.** Monta o `Contexto`:
  - `escopo` vem de `state.p` (`w!=='all'` dá `'semana'`, `m!=='all'` dá `'mes'`, senão `'meses'`);
  - `nM`, `meses` e `byCat` vêm do `groupMonths` e do laço que já existem (`ehSaida`/`catOf`);
  - `fixas` = `FIXED`; `nomes` com `catByCode`; `outros` = `OTHER`; `brl` e `pct` são as funções de formatação do painel.

  Remover o array de 4 KPIs. Desenhar o veredito, os 3 números e as setas usando `prevP()` e `sums()`, que já existem. Desenhar as ações, com `data-more` mostrando as 3 maiores origens via `topOrigins` e o link "classificar →" (`#categorias`) quando `link==='organizar'`.
- [ ] **Passo 4: verificar.**
  - `node --check frontend/js/painel.js` e `node --test frontend/tests`.
  - Usar o harness de DOM simulado do scratchpad (`dash.js`), adaptado para os novos ids, com `extrato-pessoa-fisica-com-entradas-2025-2026.ofx` (pf) e `extrato-cafeteria-ago-out-2026.ofx` (empresa).
  - Esperado: veredito amarelo em pf (sobra ~2%) com "Atenção:"; veredito verde em empresa (~11%) com "Lucro saudável:"; ações em pf incluem "Trocar para uma conta sem tarifa".
- [ ] **Passo 5: commit.** `git commit -m "Dashboard começa pelo veredito e pelo que fazer agora"`

---

### Tarefa 4: "Para onde vai o dinheiro", filtro, mês a mês e "Ver mais detalhes"

**Arquivos:**
- Modificar: `frontend/index.html`, `frontend/css/estilo.css`, `frontend/js/painel.js`

**Interfaces:**
- Consome: `contextoDash` (Tarefa 3) e `Analise.barras`/`Analise.atalho` (Tarefa 1).
- Produz: `state.dashCats` (`null` = todas, ou um array de nomes). Volta a `null` em `load()` e é atualizado em `renameCat`. Também produz `state.dashDet` (bool), que diz se o bloco de detalhes está aberto.

- [ ] **Passo 1: HTML.**
  - Seção `#dOnde`, com o `h2` "Para onde vai o dinheiro", o botão `#dFiltroBtn` (`aria-expanded`), o painel `#dFiltro` (atalhos com `data-atalho` e lista `#dFiltroLista` de checkboxes), a faixa `#dFiltroAviso`, a linha `#dFixLinha` e a lista `#dBarras`.
  - O card "Resultado por mês" ganha o título `id="dResT"`.
  - Um `<details id="dDet">` com `<summary>Ver mais detalhes</summary>`, que recebe os cards existentes: saldo, dia da semana, dia do mês, categorias que mudaram, projeção e "Outras informações" (`#dIns`).
- [ ] **Passo 2: CSS.** `.barras` com linhas em grade (nome · barra · valor · %), `.barra-neg` com o valor em `--good`, `.barra-outros` em `--ink-3`, `.tag-fixa`, `.filtro-painel` absoluto que cabe em 360px, e `details#dDet summary` com aparência de botão.
- [ ] **Passo 3: JS.**
  - Desenhar as barras com `Analise.barras(ctx, state.dashCats)`. Clicar numa barra faz `state.fcat=nome; state.filter='out'; location.hash='lancamentos'`.
  - Montar o painel do filtro: os atalhos usam `Analise.atalho`, e a última caixa marcada fica `disabled`. Fechar o painel ao clicar fora ou com Esc.
  - Quando `state.dashCats` não é `null`, o gráfico mês a mês passa a mostrar os gastos das categorias selecionadas, com o título da especificação. O gráfico "Saídas por dia do mês" e a tabela "Categorias que mais mudaram" filtram as saídas pela seleção.
  - As conclusões que viraram ação (delivery, tarifas, maquininha) saem da lista `L`. O título do card da lista passa a ser "Outras informações".
  - `state.dashDet` acompanha o evento `toggle` do `<details>`.
- [ ] **Passo 4: verificar.** `node --check`, `node --test frontend/tests` e o harness, conferindo:
  - "Só as 3 maiores" deixa 3 barras e a faixa "Analisando 3 de N categorias";
  - veredito e números iguais com e sem filtro;
  - o título do mês a mês muda;
  - `load()` volta para "Todas";
  - um período sem saídas mostra "Nenhuma saída neste período".
- [ ] **Passo 5: commit.** `git commit -m "Para onde vai o dinheiro, com filtro de categorias, e detalhes recolhidos"`

---

### Tarefa 5: PDF, README e roteiro de teste

**Arquivos:**
- Modificar: `frontend/js/painel.js` (`exportPdf`), `README.md`

- [ ] **Passo 1: `exportPdf`.** Montar o PDF na ordem nova, lendo:
  - o veredito (`#dVerT`, `#dVerTx`, `#dVerPesa`) e os números (`#dNums .kpi`);
  - as ações (`#dAcoes .acao`, título, motivo e economia);
  - as barras (`#dBarras` nome/valor/%), com a linha "Categorias analisadas: …" quando `state.dashCats` está ativo;
  - o mês a mês (as chips `#pMonths`, como hoje);
  - as outras informações (`#dIns li`).

  Remover os seletores antigos (`#dKpis`, `#cats`).
- [ ] **Passo 2: verificar.** No harness, chamar `exportPdf` com `saveBytes` substituído, decodificar o texto do PDF e conferir que os títulos das seções aparecem na ordem.
- [ ] **Passo 3: README.** Na seção "Quem faz o quê" (ou num parágrafo novo), explicar o dashboard em uma frase por parte e citar `node --test frontend/tests`.
- [ ] **Passo 4: rodar tudo.** `node --test frontend/tests`, `node --check frontend/js/painel.js` e `pytest -q`. Esperado: tudo passa.
- [ ] **Passo 5: commit.** `git commit -m "PDF e README acompanham o novo dashboard"`. A mensagem final ao usuário inclui o roteiro de teste no navegador.
