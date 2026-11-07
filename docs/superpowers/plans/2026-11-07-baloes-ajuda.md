# Balões de ajuda em passo a passo — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os 6 balões de ajuda viram passo a passo com trilho dourado, o Dashboard explica Entrou/Saiu/Sobrou/Faltou com duas contas desenhadas, e o balão fecha pelo botão "Ajuda" e ao trocar de página.

**Architecture:** Só frontend, sem build. HTML dos balões em `frontend/index.html` (reestruturado, textos mantidos), um bloco de CSS novo em `frontend/css/estilo.css` (componente `.ajuda-passos`/`.ajuda-extras`/`.ajuda-conta` e movimento), e duas mudanças pequenas no bloco "Como funciona" e em `setView` de `frontend/js/painel.js`.

**Tech Stack:** HTML, CSS, JavaScript ES5; testes no Chrome com puppeteer-core em `.superpowers/testes-navegador/` (fora do Git).

**Spec:** `docs/superpowers/specs/2026-11-07-baloes-ajuda-design.md`

## Global Constraints

- JavaScript ES5 (sem `let`/`const`/arrow em `frontend/js`); os testes de navegador podem usar JS moderno.
- Só variáveis de cor existentes (`--accent`, `--accent-soft`, `--surface-2`, `--line`, `--good`, `--bad`, `--ink*`); funciona no tema escuro e no marfim.
- Textos atuais dos balões mantidos (os testes `e7` e `e8` conferem trechos deles); só o passo 2 do Dashboard é novo.
- Movimento só dentro de `@media (prefers-reduced-motion: no-preference)`.
- Testes de navegador: servidor de teste na porta 5055 com `BANCO=.superpowers/testes-navegador/teste/t.db` (ver `LEIA-ME.md` de lá); login por fetch (`h.js`).
- Respostas e textos de tela em português.

## Review Focus

- Balão aberto e o usuário clica num item do menu da própria página atual (mesmo hash): não há troca de página, o balão continua aberto — esperado, não fechar. (Teste: b1 passo 4b.)
- Início na primeira visita (sem extratos) abre o balão sozinho; ir para outra página e voltar não deve deixá-lo aberto com `aria-expanded="false"` (estado incoerente). (Teste: b1 passo 4c confere `hidden` ↔ `aria-expanded` em todos os balões após cada troca.)
- Celular 320px: a conta "Entrou − Saiu = Sobrou" com valores de 5 dígitos não estoura. (Teste: b1 roda também a 320px para o Dashboard.)
- Focar o título do balão ao abrir não deve rolar a página para longe do botão (o balão é `position:absolute` no topo). (Teste: b1 confere `scrollY` igual antes e depois de abrir.)
- Clique duplo rápido em "Ajuda" deixa o balão num estado coerente (aberto→fechado), sem animação presa. (Teste: b1 clica duas vezes seguidas e confere fechado + `aria-expanded="false"`.)

---

### Task 1: Abrir e fechar (botão alterna, troca de página fecha)

**Files:**
- Modify: `frontend/js/painel.js` (bloco "Como funciona", ~linhas 3764-3780; `setView`, ~linha 1866)
- Test: `.superpowers/testes-navegador/b1.js` (novo; esta tarefa cria a parte "abrir/fechar")

**Interfaces:**
- Produces: `ajudaFecharTodas()` — fecha todo `.ajuda-quadro` aberto, põe `aria-expanded="false"` no botão dele, não move o foco. Chamada por `setView` quando a página mostrada muda.

- [ ] **Step 1: Escrever `b1.js` (parte abrir/fechar)** com a estrutura dos testes existentes (`abrir`, `ok[...]`, imprime OK/FALHA, sai 0/1). Viewports 1280 e 390. Checagens:
  - `ajuda alterna em <página>`: para Dashboard, Despesas, Lançamentos, Organizar, Economia e Início: clicar no botão abre (`!hidden`, `aria-expanded="true"`); clicar de novo fecha (`hidden`, `aria-expanded="false"`, foco no botão).
  - `duplo clique coerente`: dois `click()` seguidos no botão do Dashboard → fechado e `aria-expanded="false"`.
  - `abrir não rola`: `scrollY` antes e depois de abrir iguais.
  - `trocar de página fecha`: abre no Dashboard, vai para `#despesas` pelo menu (`.tab[data-view=despesas]`), confere `#dAjuda.hidden` e `aria-expanded="false"` em `#dAjudaBtn`; volta ao Dashboard e confere fechado.
  - `mesma página não fecha` (4b): abre no Dashboard e clica no item de menu do Dashboard; continua aberto.
  - `coerência` (4c): após cada troca, para todo `.ajuda-btn`, `aria-expanded==="true"` ⇔ balão visível.
  - `console sem erros`.
- [ ] **Step 2: Rodar `node b1.js`** — esperado: FALHA em "alterna" (o segundo clique não fecha) e "trocar de página fecha".
- [ ] **Step 3: Implementar.** No clique de `.ajuda-btn`: `ajudaAbrir(b, $(controls).hidden)` (alterna). Criar `ajudaFecharTodas()`. Em `setView`, guardar a página anterior (`state.viewAtual`) e, se `v !== state.viewAtual`, chamar `ajudaFecharTodas()` antes de mostrar a nova; atualizar `state.viewAtual = v`. Trocar o comentário "fecha só no X".
- [ ] **Step 4: Rodar `node b1.js`, `node e7.js`, `node e8.js`** — esperado: tudo OK.
- [ ] **Step 5: Commit** — `git add frontend/js/painel.js && git commit -m "Ajuda: o botão abre e fecha o balão; trocar de página fecha"` (com a linha Co-Authored-By).

### Task 2: Componente passo a passo + balão do Dashboard

**Files:**
- Modify: `frontend/css/estilo.css` (novo bloco "Balões de ajuda: passo a passo", no fim do arquivo; remover a regra `.ajuda-quadro .ajuda-grade{...}` quando nenhum balão usar mais `.ajuda-grade`, na Task 3)
- Modify: `frontend/index.html` (balão `#dAjuda`, ~linhas 245-300)
- Test: `.superpowers/testes-navegador/b1.js` (parte "estrutura")

**Interfaces:**
- Produces (marcação usada na Task 3):
  ```html
  <ol class="ajuda-passos">
    <li class="ajuda-passo"><span class="ajuda-num" aria-hidden="true">1</span><div><h3>Título</h3>…texto atual…</div></li>
  </ol>
  <div class="ajuda-extras">
    <div class="ajuda-passo"><span class="ajuda-ico" aria-hidden="true"><svg …16px…/></span><div><h3>Escolher o período</h3>…</div></div>
  </div>
  ```
  O `ol` leva `list-style:none`; cada `h3` começa com o número visível para leitor de tela via `<span class="visually-hidden">1. </span>` antes do título (o círculo é `aria-hidden`). Se a classe `visually-hidden` não existir no CSS, criá-la no mesmo bloco.
- Produces: `.ajuda-conta` (fileira `role="img"` + `aria-label`, filhos `.ajuda-k` com `.en`/`.so`/`.fa` e `.ajuda-op` para "−"/"="), só no Dashboard.

- [ ] **Step 1: Acrescentar a `b1.js` a parte "estrutura" para o Dashboard** (1280, 390 e 320):
  - `#dAjuda ol.ajuda-passos > li.ajuda-passo` tem 6 itens; os `.ajuda-num` leem "1".."6".
  - `#dAjuda .ajuda-extras .ajuda-passo` tem 2 itens, cada um com `.ajuda-ico svg`.
  - `#dAjuda .ajuda-conta` tem 2 fileiras; a 1ª contém um `.ajuda-k.so` com texto "Sobrou" e "800"; a 2ª um `.ajuda-k.fa` com "Faltou" e "400"; cada fileira tem `role="img"` e `aria-label` não vazio.
  - O texto do passo 2 contém "Entrou", "Saiu", "Sobrou", "Faltou", "não contam" e "Estornos".
  - `sem rolagem lateral` com o balão aberto (`scrollWidth <= clientWidth`) e `getBoundingClientRect()` do balão dentro de `[0, innerWidth]`.
  - Nenhum `.ajuda-grade` dentro de `#dAjuda`.
- [ ] **Step 2: Rodar `node b1.js`** — esperado: FALHA nas checagens de estrutura.
- [ ] **Step 3: CSS do componente.** Valores da spec: círculo 28px, fundo `--accent-soft`, borda 1px e número `--accent`, peso 800; grade do passo `28px 1fr`, `gap:10px`; espaço entre passos 14px; trilho `::before` no `li:not(:last-child)`, `left:13.5px`, `top:30px`, `bottom:-14px`, `width:1px`, `background:linear-gradient(var(--accent),transparent)`; extras com `border-top:1px dashed var(--line)`, `margin-top:14px`, `padding-top:12px`; `.ajuda-ico` 28px, raio 8px, fundo `--surface-2`, borda `--line`, cor `--accent`; `.ajuda-conta` flex com `gap:5px`, `max-width:340px`, cartões `flex:1;min-width:0`, rótulo 10.5px `--ink-3`, valor 12.5px; `.en` valor `--good`, `.so` borda+valor `--accent`, `.fa` borda+valor `--bad`.
- [ ] **Step 4: HTML do `#dAjuda`** conforme a tabela e o passo 2 da spec (textos atuais mantidos; "Escolher o período" e "Comparar dois períodos" viram extras com ícones calendário e setas opostas). Valores das contas sem "R$" (5.000, 4.200, 800; 3.000, 3.400, 400); `aria-label` "Exemplo: entrou 5.000 reais, saiu 4.200, sobrou 800" e "Exemplo: entrou 3.000 reais, saiu 3.400, faltou 400".
- [ ] **Step 5: Rodar `node b1.js`, `node e8.js`** e olhar `shots/` do balão a 390px nos dois temas — esperado: OK e visual igual ao escolhido no companheiro (opção "uma coluna com trilho").
- [ ] **Step 6: Commit** — `git commit -m "Ajuda: passo a passo com trilho e Entrou/Saiu/Sobrou/Faltou no Dashboard"`.

### Task 3: Os outros 5 balões

**Files:**
- Modify: `frontend/index.html` (`#iAjuda` ~65-90, `#eAjuda` ~402-460, `#pAjuda` ~561-600, `#lAjuda` ~640-675, `#oAjuda` ~715-740)
- Modify: `frontend/css/estilo.css` (remover regras de `.ajuda-grade` e `.ajuda-quadro h3` antigas que ficarem sem uso; manter `.ajuda-ex`)
- Test: `.superpowers/testes-navegador/b1.js`

**Interfaces:**
- Consumes: marcação e classes da Task 2.

- [ ] **Step 1: Estender a parte "estrutura" de `b1.js` aos 6 balões** (1280 e 390): passos por balão `{iAjuda:4, dAjuda:6, eAjuda:6, pAjuda:5, lAjuda:5, oAjuda:3}` (`pAjuda` = Despesas, `eAjuda` = Economia); extras `{iAjuda:2, dAjuda:2, eAjuda:0, pAjuda:2, lAjuda:1, oAjuda:0}`; `.ajuda-conta` só em `#dAjuda`; nenhum `.ajuda-grade` em nenhum balão; sem rolagem lateral com cada um aberto; `#iAjuda` continua com o botão `[data-exemplo]` e a lista `.fmts`; `#eAjuda` continua com `.ajuda-ex`.
- [ ] **Step 2: Rodar `node b1.js`** — esperado: FALHA nos 5 balões.
- [ ] **Step 3: Reestruturar os 5 balões** conforme a tabela da spec (ícones: documento para Formatos aceitos, olho para Ver um exemplo, calendário e setas como no Dashboard). No Início, o texto "Quer ver antes como fica?" + botão `[data-exemplo]` vai para o extra "Ver um exemplo".
- [ ] **Step 4: Rodar `node b1.js`, `node e7.js`, `node e8.js`, `node z1.js`** — esperado: tudo OK (z1 cobre o balão do Início brotando e a abertura automática).
- [ ] **Step 5: Commit** — `git commit -m "Ajuda: passo a passo nos balões do Início, Despesas, Lançamentos, Organizar e Economia"`.

### Task 4: Movimento ao abrir

**Files:**
- Modify: `frontend/css/estilo.css` (dentro do bloco da Task 2, numa `@media (prefers-reduced-motion: no-preference)`)
- Test: `.superpowers/testes-navegador/b1.js` (parte "movimento")

- [ ] **Step 1: Acrescentar a parte "movimento" a `b1.js`**: com movimento, abrir o Dashboard e conferir `getComputedStyle` do 1º e do 3º `.ajuda-passo`: `animationName` não é `none` e o `animationDelay` do 3º é maior que o do 1º (esperado 0.12s e 0.24s); o `::before` do 1º passo tem `animationName` não `none`; `.ajuda-extras` tem animação. Com `reduz:true`: `animationName` dos passos é `none`. Abrir, fechar e abrir de novo: a animação do 1º passo recomeça (`getAnimations()` do 1º passo com `currentTime` < 200ms logo após reabrir).
- [ ] **Step 2: Rodar `node b1.js`** — esperado: FALHA em "movimento".
- [ ] **Step 3: Implementar**: `@keyframes ajuda-sobe{from{opacity:0;transform:translateY(8px)}}` 0,35s em `.ajuda-quadro:not([hidden]) .ajuda-passo`, atraso `calc(.12s + (n-1) * 60ms)` por `:nth-child(1..6)`; `@keyframes ajuda-trilho{from{transform:scaleY(0)}}` no `::before` com `transform-origin:top` e o mesmo atraso; `.ajuda-extras` com `ajuda-sobe` em `.5s` de atraso. A regra global de `prefers-reduced-motion: reduce` já zera animações.
- [ ] **Step 4: Rodar `node b1.js` (com e sem reduzir movimento), `node z1.js`, `node e7.js`, `node e8.js` e `node --test frontend/tests`** (a partir da raiz) — esperado: tudo OK.
- [ ] **Step 5: Commit** — `git commit -m "Ajuda: passos aparecem em cascata e o trilho desce ao abrir"`.

### Depois das tarefas

- Revisão independente do ramo inteiro (opus), correções, teste do usuário no navegador, `git merge --ff-only` no `main` e `git push`; atualizar `docs/RESUMO-TRANSICAO.md` e a memória do projeto.
