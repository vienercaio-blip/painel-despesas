# Comparar em Despesas e Lançamentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** "Comparar…" também em Despesas e Lançamentos, cada página com a sua comparação (spec §2 e §3).

**Architecture:** `state.cmp` passa a valer em Dashboard, Despesas e Lançamentos. Os números vêm de `dadosPeriodo()` + `Periodo.comparar()` (os mesmos do Dashboard). Duas funções puras novas em `periodo.js`; o resto é desenho em `painel.js`.

**Tech Stack:** ES5, `node --test`, puppeteer (scratchpad, porta 5055).

**Spec:** `docs/superpowers/specs/2026-11-06-comparar-paginas-design.md`

## Global Constraints
- Cores: A = `--accent`, B = `--s2`. Sempre por mês, com os mesmos divisores de `dadosPeriodo`.
- Sair: "Sair da comparação", ou escolher atalho, mês, Personalizado ou semana. Ir a outras páginas **não** sai.
- Clicar numa categoria abre Lançamentos sem sair da comparação.
- "Exportar PDF" escondido nas três páginas enquanto compara.

## Review Focus
1. Períodos que se sobrepõem em Lançamentos → linha com as duas etiquetas, somas sem dobrar (Task 3, `c3.js`).
2. Filtros de Lançamentos (busca, categoria, Saídas/Entradas) combinados com o filtro de período → rodapé coerente com a lista (Task 3).
3. Fluxo com períodos de tamanhos diferentes (6 × 2 meses) → linhas de comprimentos diferentes, sem NaN (Task 1 `posicoes`; Task 2 `c2.js`).
4. Sair da comparação por um atalho quando está em Lançamentos ou Despesas → página volta ao normal no período do atalho (Task 2).
5. Categoria só em B em Despesas → aparece no fim com "sumiu" e a barra de A vazia (Task 2).

---

### Task 1: `posicoes` e `resumoComparacao` em `periodo.js`
- [ ] Testes em `frontend/tests/periodo.test.js`:
  - `posicoes(deMeses('2025-11','2026-02'),'mes')` → chaves `['2025-11','2025-12','2026-01','2026-02']`, rótulos `['nov/25','dez/25','jan/26','fev/26']`;
  - `posicoes({tipo:'mes',y:2026,m:9},'semana')` → começa na segunda-feira `'2026-09-28'` e termina em `'2026-10-26'`;
  - `posicoes(deDias('2026-03-01','2026-03-03'),'dia')` → 3 dias;
  - `resumoComparacao`: melhorou → 1ª frase = veredito; "Saiu R$ 100 a menos por mês que em <B>."; "O que mais subiu: Delivery (+R$ 40/mês)."; "O que mais caiu: Mercado (−R$ 100/mês)."; "A maior despesa continua sendo Moradia." / "A maior despesa passou de X para Y.".
- [ ] RED → implementar → GREEN → commit "Período: posições e resumo da comparação".

### Task 2: Despesas comparando + regras gerais
- [ ] `c2.js` (Chrome): os itens de Despesas, navegação, categoria e saída da spec §5.
- [ ] RED → implementar:
  - botão nas três páginas;
  - `chegou()` sem saída automática;
  - `htmlTopoComparacao`;
  - `#dCmpTopoDesp`;
  - KPIs, categorias, Fluxo de duas linhas e Resumo;
  - clique em categoria sem sair;
  - PDF escondido.
- [ ] GREEN + regressões (`p4` muda: ir a Lançamentos **não** sai mais; atualizar como Ruling) → commit.

### Task 3: Lançamentos comparando + ajuda
- [ ] `c3.js`: etiquetas, filtro "Os dois · A · B", rodapé batendo com Entrou/Saiu de cada período, sobreposição com as duas etiquetas, 390 px.
- [ ] RED → implementar a coluna "Período" (escondida fora da comparação), `#txPerCmp`, o rodapé e os textos do "Como funciona" → GREEN + regressão completa → commit.
