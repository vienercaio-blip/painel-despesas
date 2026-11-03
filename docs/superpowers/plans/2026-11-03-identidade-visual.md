# Identidade visual "sobrou.": plano de implementação

> **Para quem executar:** use superpowers:executing-plans, uma tarefa de cada vez. Cada passo tem uma caixinha (`- [ ]`) para marcar o andamento.

**Objetivo:** aplicar a marca "sobrou." ao site: nome, logo, fontes, cores escuras e claras "marfim", troca de aparência e menu na coluna da esquerda, sem mudar a organização das telas.

**Arquitetura:**
- **Cores:** só os valores das variáveis de `:root` mudam; os nomes continuam os mesmos.
- **Tema:** uma função pura nova, `tema.js`, decide o atributo de tema da página.
- **Menu:** o cabeçalho `<header class="top">` vira uma coluna `<aside class="menu">`. Os links `a.tab[data-view]` continuam os mesmos, então `setView` e `refreshTabs` não mudam.

**Tecnologias:** HTML, CSS e JS em ES5, sem build; Google Fonts (Fraunces e Manrope); `node --test`.

**Especificação:** `docs/superpowers/specs/2026-11-03-identidade-visual-design.md`. As tabelas de cores e os textos fixos estão lá.

## Restrições gerais
- Trabalhar no ramo `identidade-visual`. Commits em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Sem bibliotecas novas. Ícones em SVG em linha, com traço de 1,8 e `stroke="currentColor"`.
- Os testes atuais continuam passando: `cd backend && .venv/Scripts/python -m pytest -q` e `node --test frontend/tests`.
- Ao terminar cada tarefa, conferir:
  - a sintaxe do `painel.js` com `node -e "new Function(...)"`;
  - se todo `$('id')` existe no HTML ou é criado pelo próprio JS.

## Pontos de atenção na revisão
1. **Cor errada ao carregar:** com "Escura" escolhida e o aparelho no modo claro, a página não pode piscar no claro. O `<script>` do `<head>` resolve isso.
2. **Contraste:** o dourado sobre o marfim e o texto `--ink-3` sobre `--surface` nos dois modos precisam chegar a 4,5:1.
3. **Largura entre 900 e 1100 px:** a coluna de 220 px não pode espremer gráficos e tabelas.
4. **Itens do menu escondidos:** antes de abrir um extrato, só aparece "Início". A coluna não pode ficar estranha nesse caso.
5. **Gráficos em SVG:** eles usam `var(--s1)`, `var(--s2)` e `var(--grid)`, e precisam continuar legíveis nos dois modos.

---

### Tarefa 1: escolha de aparência (tema)

**Arquivos:**
- criar `frontend/js/tema.js` e `frontend/tests/tema.test.js`;
- mudar `frontend/index.html` e `frontend/js/painel.js`.

**O que a tarefa entrega:**
- `Tema.atributo(escolha) -> null|'light'|'dark'`: `'claro'` dá `'light'`, `'escuro'` dá `'dark'`, e qualquer outro valor dá `null`;
- `Tema.CHAVE = 'sobrou-tema'`, a chave usada no `localStorage`.

- [ ] **Passo 1: testes que falham**, em `tema.test.js`:
  - `atributo('claro')` dá `'light'`;
  - `atributo('escuro')` dá `'dark'`;
  - `atributo('auto')`, `atributo(undefined)` e `atributo('xyz')` dão `null`.
- [ ] **Passo 2:** ver os testes falharem, implementar no mesmo estilo de `pastas.js` (exportando como `window.Tema` e `module.exports`) e ver todos passarem.
- [ ] **Passo 3: tela.**
  - No `index.html`, dentro da seção "Aparência e movimento", entra `<label class="cfg-row">Aparência <select id="cfgTema">`, com as opções `auto` ("Automática (segue o aparelho)"), `claro` ("Clara") e `escuro` ("Escura").
  - No `<head>`, antes do CSS, entra um script pequeno: ele lê `localStorage['sobrou-tema']`, dentro de `try`, e põe o `data-theme` correspondente.
  - Também no `<head>`: `<script src="/js/tema.js">` antes do `painel.js`.
- [ ] **Passo 4:** no `painel.js`, `applyCfg()` aplica `Tema.atributo(cfg.tema)`:
  - põe o atributo, ou o remove, em `document.documentElement`;
  - grava `cfg.tema||'auto'` no `localStorage`, dentro de `try`.

  Também: `openCfg()` preenche `#cfgTema`, e o `change` do `#cfgTema` faz `cfg.tema = valor; saveCfg(); applyCfg()`.
- [ ] **Passo 5:** commit com a mensagem `Aparência: automática, clara ou escura`.

### Tarefa 2: cores, fontes, nome e favicon

**Arquivos:** `frontend/css/estilo.css`, `frontend/index.html`, `frontend/favicon.svg` (novo), `frontend/js/painel.js` (só o título do PDF) e o servidor de arquivos estáticos (conferir se `/favicon.svg` é servido; se não for, colocar o arquivo onde os estáticos já são servidos).

- [ ] **Passo 1: cores.**
  - `:root` recebe os valores **do modo claro "marfim"**, que é o tema base.
  - `@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){...} }` e `:root[data-theme="dark"]{...}` recebem os valores **do modo escuro**.
  - Os valores estão na tabela da seção 3 da especificação. Acrescentar duas variáveis novas: `--menu-bg` (`#0E1420` no claro e `#0A0F18` no escuro) e `--menu-ink` (`#E8ECF3` nos dois). Elas serão usadas na Tarefa 3.
- [ ] **Passo 2: fontes.**
  - Trocar o link do Google Fonts por `Fraunces:opsz,wght@9..144,600;9..144,700` e `Manrope:wght@400;600;700;800`.
  - Ficam assim: `--font-display:'Fraunces',Georgia,serif`, `--font-body:'Manrope',system-ui,sans-serif` e `--font-mono:'Manrope',system-ui,sans-serif`. Os números continuam com `tabular-nums` pela classe `.num`, que já existe.
  - Os títulos `h1`, `h2` e `h3` usam peso 600.
- [ ] **Passo 3: nome.**
  - `<title>sobrou.</title>`;
  - `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`;
  - o SVG de `favicon.svg`: um quadrado de 64×64 com raio 14 e fundo `#0E1420`, com o texto "s" em serif claro e um círculo dourado `#E2B04A` fazendo o ponto;
  - o comentário do topo do `painel.js` passa a dizer "sobrou.";
  - o PDF: `doc.line('sobrou. · Relatório de despesas', 18, true, 4)`.
- [ ] **Passo 4:** conferir o contraste com um script no scratchpad (não vai para o projeto). Ele calcula a razão WCAG de cada par de texto e fundo dos dois modos: `--ink`, `--ink-2` e `--ink-3` sobre `--bg` e sobre `--surface`; `--accent` sobre `--bg` e sobre `--surface`; `--good`, `--warn` e `--bad` sobre `--surface`; e `--accent-ink` sobre `--accent`. Todos precisam dar 4,5 ou mais. Se algum par não chegar, ajustar o valor o mínimo necessário e anotar a decisão.
- [ ] **Passo 5:** commit com a mensagem `Cores, fontes e nome "sobrou."`.

### Tarefa 3: menu na coluna da esquerda

**Arquivos:** `frontend/index.html`, `frontend/css/estilo.css` e `frontend/js/painel.js` (só se algum seletor mudar).

**Mudança no HTML:**
```
<div class="app">
  <aside class="menu">
    <a class="logo" href="#inicio">sobrou<span class="ponto">.</span></a>
    <nav class="tabs" aria-label="Seções"> ... os mesmos a.tab, cada um com um <svg> de ícone antes do texto ... </nav>
    <div class="menu-pe"> Olá, <b id="userName"></b> · o mesmo #cfgBtn (com texto "Configurações") · #modoTop </div>
  </aside>
  <div class="wrap"> ... conteúdo de hoje, sem o <header class="top"> ... </div>
</div>
```

- [ ] **Passo 1:** mudar a marcação. Mantêm os mesmos ids: `userName`, `cfgBtn`, `modoTop`, `modoName` e `modoTrocar`. O `#cfgBtn` continua abrindo as configurações.
- [ ] **Passo 2: CSS para 900 px ou mais.**
  - `.app` é `display:grid` com `grid-template-columns:220px 1fr`.
  - `.menu` usa `position:sticky;top:0;height:100vh`, fundo `--menu-bg`, texto `--menu-ink`, `display:flex;flex-direction:column` e padding de 18 px por 12 px.
  - O logo usa Fraunces 700, com 26 px, e `.ponto` usa `color:#E2B04A`.
  - `.menu .tabs` fica em coluna. Cada `.tab` ocupa a largura inteira e tem `min-height:42px`.
  - O item com `[aria-current="page"]` tem fundo `rgba(255,255,255,.06)`, texto em negrito e `box-shadow:inset 3px 0 0 #E2B04A`.
  - `.menu-pe` fica com `margin-top:auto`.
  - `.wrap` mantém o `max-width` atual e é centralizado na coluna da direita.
- [ ] **Passo 3: CSS para menos de 900 px.**
  - `.app` vira um bloco comum.
  - `.menu` deixa de ser `sticky`, perde a altura de 100vh e fica em linha: o logo à esquerda e o `#cfgBtn` (só o ícone) à direita, quebrando a linha.
  - `.menu .tabs` vira uma linha que rola para os lados (`overflow-x:auto; flex-wrap:nowrap`), e os ícones ficam escondidos.
  - A saudação "Olá" fica escondida.
- [ ] **Passo 4:** os ícones, um SVG de 18 px para cada item:
  - Início: uma casa;
  - Dashboard: um gráfico de barras;
  - Despesas: uma pizza;
  - Lançamentos: uma lista;
  - Organizar: etiquetas.
- [ ] **Passo 5:** conferir que `setView` continua marcando `aria-current` e que `wrapEl`, usado por `keepScroll`, ainda é encontrado com `document.querySelector('.wrap')`. Commit com a mensagem `Menu na coluna da esquerda`.

### Tarefa 4: componentes e página de entrar

- [ ] **Componentes, em `estilo.css`:** só aparência.
  - Cartões (`.card`): raio de 14 px, borda `--line` e sem sombra no modo escuro.
  - Botões (`.btn`): raio de 10 px. `.btn.primary` usa `background:var(--accent);color:var(--accent-ink)` no escuro. No claro, usa `background:#0E1420;color:#F3EBD9`, por um seletor do modo claro, igual ao padrão das cores.
  - Campos (`input`, `select`): raio de 10 px e `:focus-visible{outline:2px solid var(--accent);outline-offset:1px}`.
  - Etiquetas (`.ctag`, `.why`, `.why.estorno`): formato de pílula.
  - `#dVerT` usa a fonte display.
- [ ] **`backend/templates/entrar.html`:**
  - as mesmas fontes e cores, com uma cópia mínima das variáveis dos dois modos dentro do `<style>` da página, já que ela é independente;
  - o título passa a ser `Entrar · sobrou.`;
  - acima do formulário entram o logo "sobrou." e o slogan *"Veja para onde vai o seu dinheiro e quanto sobra no mês."*;
  - o favicon.
- [ ] **Teste:** conferir que `test_api` ainda encontra o texto "incorretos" na página de entrar. Commit com a mensagem `Componentes e página de entrar no estilo "sobrou."`.

### Tarefa 5: fechamento
- [ ] README: o nome "sobrou." e uma linha sobre a aparência. Atualizar também `docs/RESUMO-TRANSICAO.md`, que fica fora do git.
- [ ] Rodar as duas suítes de testes e ligar o site para conferir se as páginas e os arquivos (`/favicon.svg`, `/js/tema.js`) respondem 200.
- [ ] Revisão independente por um subagente (opus) e uma passada de correções.
- [ ] Teste do usuário nos dois modos, seguindo a seção 7 da especificação. Só depois: merge `--ff-only` no `main` e push.
