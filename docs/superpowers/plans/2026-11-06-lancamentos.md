# Lançamentos (tabela melhorada + animações) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Lançamentos com números clicáveis no topo, ordenação por Data/Valor, categoria sempre editável na linha, 50 por vez, comparação nos números e as 8 animações.

**Architecture:** Duas funções puras novas em `analise.js` (ordenar e contar "para revisar"); o resto em `renderTable` (painel.js), HTML de `#viewLanc` e CSS. Animações com modos entrada/troca/calmo (como Despesas) e FLIP na ordenação.

**Tech Stack:** ES5, `node --test frontend/tests`, `pytest`, puppeteer no scratchpad (`pup/`, cliques reais, banco temporário, porta 5055).

**Spec:** `docs/superpowers/specs/2026-11-06-lancamentos-design.md`

## Global Constraints
- Entrou/Saiu = `sums()` do período (iguais ao Dashboard). Para revisar = saídas em `OTHER`.
- Comparando: Entrou/Saiu por mês de `dadosPeriodo(cmp.a)` com P2 embaixo; Para revisar sem contar duas vezes.
- Ordem inicial: data mais nova primeiro; Valor ordena por |valor|.
- Corrigir na linha usa `perguntarMudanca` (pergunta de hoje). `state.editLanc` e `#editLanc` saem.
- "Reduzir movimento": nada anima, nenhum valor intermediário.

## Review Focus
1. Corrigir uma categoria com a lista ordenada por Valor e na página 3 → continua na mesma ordem e página, sem cascata (Task 2/4).
2. Filtro "Para revisar" ligado e corrigir o último → lista vazia com mensagem, número vira "Nada para revisar ✓" (Task 2).
3. Busca + ordenação + página: o realce não quebra descrições com acentos ou caracteres especiais (`esc`) (Task 2).
4. Comparando com períodos que se sobrepõem → Para revisar não conta duas vezes (Task 3).
5. Trocar o período com a ordem por Valor → mantém a ordem escolhida (Task 2).

---

### Task 1: funções puras
**Files:** Modify `frontend/js/analise.js`, `frontend/tests/analise.test.js`.
**Produces:** `ordenarLancamentos(lista:[{date:Date, value:number}], col:'data'|'valor', dir:'desc'|'asc') → nova lista` (estável; empate pela data mais nova; valor por |value|) e `paraRevisar(lista, ehOutro:(t)=>bool) → number`.
- [ ] Testes: data desc/asc; valor desc põe −1650 antes de +250 antes de −29; empate de valor → data mais nova primeiro; não altera a lista original; `paraRevisar` conta só os que `ehOutro` aceita.
- [ ] RED → implementar → GREEN → commit "Lançamentos: ordenar e contar para revisar".

### Task 2: topo, ferramentas, tabela
**Files:** `frontend/index.html` (`#lNums` abaixo do Período; títulos Data/Valor como `<button data-ord>`; sai `#editLanc`/`#txHint`; ajuda reescrita), `frontend/js/painel.js` (`renderTable`), `frontend/css/estilo.css`.
**Consumes:** Task 1.
- [ ] `pup/l1.js` (cliques reais): números iguais ao Dashboard (Entrou/Saiu, todo o extrato) e "Para revisar" = linhas "Revisar" da lista filtrada; clicar Entrou → só entradas e `aria-pressed`; de novo → Todos; Para revisar → só "Revisar"; 50 linhas; primeira linha = data mais nova; clicar Valor → maior |valor| primeiro, de novo → menor; Data volta; seletor em toda linha (sem botão Editar); corrigir uma "Revisar" pela linha → pergunta aparece → "Não, só neste extrato" → Para revisar −1 e linha some do filtro Revisar; ordem por Valor mantida ao trocar período; busca "uber" marca `<mark>`; ajuda sem "Editar categorias"; 390 px sem rolagem; console sem erros.
- [ ] RED → implementar → GREEN + `c3`, `y6`, `x10` → commit "Lançamentos: números, ordenação e categoria na linha".

### Task 3: comparando
**Files:** `frontend/js/painel.js`.
- [ ] Estender `pup/l1.js` (ou `pup/l2.js`): comparando out/26 × set/26, Entrou/Saiu por mês = tabela do Dashboard; "P2" embaixo; Para revisar dos dois; sobreposição (jan–jun × abr–set) não conta duas vezes; Sair volta aos números normais.
- [ ] RED → implementar → GREEN + `c3` → commit "Lançamentos: números comparando".

### Task 4: as 8 animações
**Files:** `frontend/js/painel.js`, `frontend/css/estilo.css`.
- [ ] `pup/l3.js`: (1) números contam ao chegar e do antigo ao novo ao trocar período; (2) linhas com `animation-delay` crescente ao chegar e ao trocar filtro; (3) ordenar: linhas com `transform` durante a transição, sem cascata, setinha gira; (4) corrigir: etiqueta com classe de confirmação (verde ✓) e número com salto, sem cascata; (5) busca: linhas que saem ganham `sv-saindo`-like antes de redesenhar; (6) hover: `transform` na linha; (7) Próxima: lista com animação da direita, Anterior da esquerda; (8) Para revisar: etiquetas "Revisar" com animação de pulso; "reduzir movimento": nada disso; console sem erros.
- [ ] RED → implementar → GREEN + regressão completa (node, pytest, l1, l2, c2, c3, y6, y7, y8, y9, x10, x12, e8) → commit "Lançamentos: animações"; atualizar `docs/RESUMO-TRANSICAO.md` no mesmo commit.
