# Organizar (lista + detalhe, animações, mover em todo o site) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Organizar em lista + detalhe (Para revisar no topo, categoria com editar/apagar/origens/regras, nova categoria, todas as regras), as 8 animações e `voar()` nos três lugares de mover.

**Architecture:** Reaproveitar as peças de hoje (`#origins` e o "Mover todos para", o formulário de editar em `#customList`, `#ncForm`, `#rulesList`) dentro de um detalhe controlado por `state.catView` ('cat'|'rev'|'nova'|'regras'); as abas saem. `showSub`/`showNc` continuam existindo como atalhos (Lançamentos › Criar categoria). Ordem da lista em função pura `Analise.listaOrganizar`. `voar()` genérica em painel.js.

**Tech Stack:** ES5, `node --test frontend/tests`, `pytest`, puppeteer (cliques reais; `scratchpad/reset_rev.py` antes).

**Spec:** `docs/superpowers/specs/2026-11-06-organizar-design.md`

## Global Constraints
- Sempre o extrato inteiro (`state.tx`), como hoje. Lista só com categorias de saída (sem internas, sem Entrada).
- Editar/criar/apagar/restaurar/mover/apagar regra usam as funções e perguntas de hoje.
- "Reduzir movimento": nada anima; `voar` não cria fantasma.

## Review Focus
1. Renomear a categoria escolhida → detalhe continua nela com o nome novo (Task 2).
2. Apagar a categoria escolhida → detalhe vai para Para revisar (ou a primeira), sem erro (Task 2).
3. Lançamentos › "+ Criar nova categoria…" → Organizar abre na Nova categoria e volta para Lançamentos depois (Task 2).
4. Mover a última origem de Para revisar → "Tudo revisado!" (Task 3).
5. `voar` com destino fora da tela ou escondido → sobe e some, sem erro (Task 4).

---

### Task 1: `listaOrganizar`
**Files:** `frontend/js/analise.js`, `frontend/tests/analise.test.js`.
**Produces:** `listaOrganizar(byCat:{nome:valor}, todas:string[], outros:string, internos:string[]) → {revisar:number(valor de outros), comGastos:[{nome,v}], semGastos:[nome]}` — comGastos: v>0, sem outros/internos, maior primeiro (empate por nome); semGastos: as de `todas` sem gasto (>0), sem outros/internos, em ordem alfabética.
- [ ] Testes com valores exatos → RED → implementar → GREEN → commit.

### Task 2: layout C
**Files:** `frontend/index.html` (`#viewCategorias`: sem `.subnav`; detalhe com cabeçalho, `#customList` (só a escolhida), `#subOrigem`, `#subRegras`, `#subNova`; botões `#oNova` e `#oRegras` embaixo da lista; ajuda reescrita), `frontend/js/painel.js` (`renderCategorias`, `renderCustom`, `renderRules`, clique na lista, `showSub`/`showNc`), `frontend/css/estilo.css`.
- [ ] `pup/o1.js`: lista começa por Para revisar (com número = saídas em Outros) e termina com categorias "sem gastos"; sem abas; escolher Mercado → detalhe "Mercado" com total igual ao de hoje e origens; Editar → formulário → mudar tipo para fixa e salvar (pergunta → Salvar) → etiqueta "fixa"; renomear (Mercado → Mercado e feira → e de volta) mantém a escolhida; + Nova categoria → formulário → criar "Pets teste" → aparece na lista e fica escolhida; Apagar "Pets teste" → pergunta → some e detalhe vai para outra; Todas as regras → lista de regras; Para revisar → origens com "Mover todos para"; Lançamentos › Criar nova categoria abre a Nova categoria; 390 px; console sem erros.
- [ ] RED → implementar → GREEN + `l1`, `y6` → commit.

### Task 3: as animações 1, 2, 4–8
**Files:** `frontend/js/painel.js`, `frontend/css/estilo.css`.
- [ ] `pup/o2.js`: trocar de categoria → detalhe com animação de entrada e total contando; marcador da lista com `transition` e posição nova; barras das origens com atraso crescente; Editar → formulário com animação de abrir; salvar → nome com animação verde; apagar regra → linha com animação de saída antes de sumir; categoria nova com brilho; mover a última de Para revisar → "Tudo revisado!" com confetes; reduzir movimento: nada; console sem erros.
- [ ] RED → implementar → GREEN → commit.

### Task 4: `voar()` em todo o site
**Files:** `frontend/js/painel.js`, `frontend/css/estilo.css`.
- [ ] `pup/o3.js`: Organizar "Mover todos para" (Não, só neste extrato) → fantasma `.voo` aparece e destino na lista com classe de piscar; Início › menu › Mover para outra pasta → fantasma e etiqueta da pasta pisca/número salta; arrastar extrato para a etiqueta (via eventos de arrastar) → idem; Lançamentos com filtro Para revisar, corrigir → fantasma voa até o número; reduzir movimento: nenhum fantasma; console sem erros.
- [ ] RED → implementar → GREEN + regressão completa (node, pytest, o1, o2, o3, l1, l3, l4, y6, y7, z1, c3, e8) → commit; `docs/RESUMO-TRANSICAO.md` no mesmo commit.
