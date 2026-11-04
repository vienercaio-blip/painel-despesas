# Início: resumo, lembrete, exemplo, arrastar e busca — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 5 itens e as pendências de `docs/superpowers/specs/2026-11-04-inicio-extras-design.md`.

**Architecture:** As regras puras (meses faltando, texto do lembrete, busca) vão para `frontend/js/pastas.js`, com testes. O servidor ganha só `GET /api/exemplo`. A tela (`index.html`, `estilo.css`, `painel.js`) ganha o cartão de resumo, a faixa do lembrete, o botão de exemplo, a alça de arrasto e a busca.

**Tech Stack:** JS ES5 sem build, Flask, `node --test`, `pytest`.

**Spec:** `docs/superpowers/specs/2026-11-04-inicio-extras-design.md`

## Global Constraints

- ES5 em `frontend/js`. Cores só pelas variáveis existentes. Movimentos respeitam `semMovimento()`.
- Textos exatos da spec (resumo, lembrete, exemplo, mensagens das pendências).
- Os números do resumo saem do mesmo cálculo do Dashboard (`state.resumo`, preenchido em `renderDashboard`), nunca de uma conta paralela.
- Nada muda no banco de dados. A única rota nova é `GET /api/exemplo`.
- Ao fim de cada tarefa: `node --test frontend/tests` e `node --check frontend/js/painel.js`. Nas tarefas que mexem no servidor, também `pytest -q`.

## Review Focus

1. **Último aberto que sumiu ou falhou** (excluído, pasta apagada, servidor fora): esperado nenhum cartão, nenhum erro na tela e a lista normal.
2. **Resumo × Dashboard:** depois de mudar o período no Dashboard e voltar, o cartão mostra o mesmo período e os mesmos números; ao fechar o extrato (excluir o aberto), o cartão some.
3. **Arrasto de linha sobre a área de envio:** não pode acender a área nem disparar a leitura. Só arquivos de verdade disparam.
4. **Lembrete na virada do ano** e com extratos sem data de fim (`last` vazio): sem erro, com o ano no nome quando precisa.
5. **Exemplo enquanto um extrato real está aberto:** o exemplo substitui o que está na tela; o "último aberto" continua sendo o real; o resumo não mostra o exemplo.

---

### Tarefa 1: Regras puras (lembrete e busca)

**Files:** Modify `frontend/js/pastas.js`; Test `frontend/tests/pastas.test.js`

**Interfaces — Produces:**
- `Pastas.mesesFaltando(ultimaData:'AAAA-MM-DD'|null, hoje:Date) -> [{ano, mes}]`
- `Pastas.textoLembrete(meses, hoje:Date) -> string|null`
- `Pastas.buscar(lista:[{name}], texto) -> lista`

- [ ] **Step 1:** testes:
  - `mesesFaltando('2026-10-28', new Date(2026,10,4))` → `[]`;
  - `(…, new Date(2026,11,5))` → `[{ano:2026,mes:10}]`;
  - `(…, new Date(2027,1,10))` → nov/2026, dez/2026, jan/2027;
  - `(null, …)` → `[]`;
  - `('2026-12-31', new Date(2027,0,15))` → `[]`.
  - `textoLembrete([{2026,10}], dez/2026)` → `'Falta o extrato de novembro.'`;
  - dois meses → `'Faltam os extratos de novembro e dezembro.'`;
  - três ou mais → `'Faltam os extratos desde novembro de 2026.'` (hoje em 2027);
  - `[]` → `null`.
  - `buscar([{name:'Extrato Março'},{name:'Nubank'}], 'marco')` → só o primeiro; texto vazio → os dois; `name` nulo não quebra.
- [ ] **Step 2:** `node --test frontend/tests`, que deve FALHAR (funções inexistentes).
- [ ] **Step 3:** implementar. Nomes dos meses em minúsculas; o ano entra quando `ano !== hoje.getFullYear()`.
- [ ] **Step 4:** `node --test frontend/tests`, que deve PASSAR.
- [ ] **Step 5:** commit "Pastas: meses que faltam, texto do lembrete e busca de extratos".

### Tarefa 2: Extrato de exemplo (servidor + botão)

**Files:**
- Create `backend/exemplo/extrato-exemplo.ofx` (cópia);
- Modify `backend/rotas/leitura.py`;
- Test `backend/tests/test_api.py`;
- Modify `frontend/js/api.js`, `frontend/index.html`, `frontend/js/painel.js`.

**Interfaces — Produces:**
- `GET /api/exemplo -> {nome:'Extrato de exemplo', lancamentos:[...]}`;
- `API.exemplo() -> Promise`;
- `abrirExemplo()` em `painel.js`.

- [ ] **Step 1:** testes pytest:
  - `test_exemplo_exige_login`: sem login → 401;
  - `test_exemplo_devolve_lancamentos_categorizados`: 200, `nome=='Extrato de exemplo'`, mais de 600 lançamentos e todos com `categoria`. Antes, conferir o nome do campo em `preparar_lancamentos`.
- [ ] **Step 2:** `pytest -q tests/test_api.py -k exemplo`, que deve FALHAR (404).
- [ ] **Step 3:** rota em `leitura.py` (lê o arquivo com `Path(__file__).parent.parent / 'exemplo' / 'extrato-exemplo.ofx'`, `ler_arquivo_com_aviso`, `preparar_lancamentos`); `API.exemplo`; botão `#verExemplo` (`.so-big`) na área grande, ao lado de "Escolher arquivos"; link `<button class="link-exemplo" data-exemplo>` no fim de `#ajuda`. `abrirExemplo()`: `API.exemplo().then(r => { load(r.lancamentos.map(doServidor), 'sample', r.nome); irPara('dashboard'); })`, com `falhou` no erro. `srcText` do exemplo com as datas reais.
- [ ] **Step 4:** pytest PASSA; no Chrome automático, o exemplo abre o Dashboard com o selo "Exemplo · dados fictícios".
- [ ] **Step 5:** commit "Início: ver um exemplo do painel".

### Tarefa 3: Resumo do último extrato aberto

**Files:** `frontend/index.html`, `frontend/css/estilo.css`, `frontend/js/painel.js`

**Interfaces — Produces:**
- `state.resumo = {ver, ins, outs, nM}`, gravado em `renderDashboard` logo depois de `Analise.veredito(ctx)`;
- `cfg.ultimoAberto = {tipo, id}`;
- `#iniResumo` (section `card ini-resumo ini-bloco`, `hidden`), desenhado por `desenharResumo()`, chamado no fim de `render()` e de `renderSaved()`.

- [ ] **Step 1:** marcação `#iniResumo` antes de `#inicioDesp`, dentro de `#modeArea`. CSS:
  - borda esquerda 4px nas cores do veredito, com as classes `verde`/`amarelo`/`vermelho`/`neutro` iguais às do `#dVer`. Conferir o nome real das classes do veredito no CSS antes;
  - números em linha com `.num`.
- [ ] **Step 2:** `desenharResumo()`: mostra o cartão só se `MODE==='despesas' && state.loaded && state.source!=='sample' && state.resumo && getSaved().length`. Conteúdo conforme a spec §1. Os valores usam `brl.format(x/nM)`.
- [ ] **Step 3:**
  - `openSaved`/`openPasta` gravam `cfg.ultimoAberto` e chamam `saveCfg()`;
  - a primeira resposta de `recarregarSalvos` chama `reabrirUltimo()`, que confere se o id ainda está em `getSaved()` ou `getPages()` e chama `carregarSalvo`/`carregarPasta` com `.catch` silencioso;
  - `fecharExtrato` esconde o cartão;
  - o exemplo não grava `ultimoAberto`.
- [ ] **Step 4:** Chrome automático:
  - entrar → o cartão aparece com os mesmos números do Dashboard (comparar o texto do veredito e o "por mês" de Entrou);
  - mudar o período no Dashboard e voltar → o cartão acompanha;
  - excluir o extrato aberto → o cartão some;
  - `ultimoAberto` com id inexistente → sem cartão e sem erro.
- [ ] **Step 5:** commit "Início: resumo do último extrato aberto".

### Tarefa 4: Lembrete do mês que falta

**Files:** `frontend/index.html`, `frontend/css/estilo.css`, `frontend/js/painel.js`

- [ ] **Step 1:** `#iniLembrete` (`div.ini-lembrete`, `hidden`) logo depois de `#iniResumo`, com `<span id="iniLembreteT">` e o botão `data-lemb-nao` "Agora não".
- [ ] **Step 2:** em `renderSaved` (despesas, com extratos):
  - `ultima` = o maior `x.last` dos extratos de `Pastas.filtrar(todos, pages, cur)`;
  - `meses = Pastas.mesesFaltando(ultima, HOJE())`, onde `HOJE()` devolve `new Date()` ou `window.__hoje` (gancho só para teste);
  - a faixa aparece se houver texto e se `cfg.lembreteVisto !== mês de hoje`;
  - "Agora não" grava `cfg.lembreteVisto`, chama `saveCfg()` e redesenha.
- [ ] **Step 3:** Chrome automático com `window.__hoje = new Date(2026,11,5)`: a faixa mostra "Falta o extrato de novembro."; "Agora não" esconde.
- [ ] **Step 4:** commit "Início: lembrete do mês que falta".

### Tarefa 5: Busca e arrastar para a pasta

**Files:** `frontend/index.html`, `frontend/css/estilo.css`, `frontend/js/painel.js`

- [ ] **Step 1:** busca:
  - `<input type="search" id="svBusca" placeholder="Buscar extrato" aria-label="Buscar extrato">` dentro de `.chips-wrap`, com `margin-left:auto`;
  - fica `hidden` quando há menos de 10 extratos;
  - o `input` grava `state.busca` e redesenha (sem perder o foco: o campo fica fora do `innerHTML` redesenhado);
  - a lista passa por `Pastas.buscar`; o texto de vazio segue a spec.
- [ ] **Step 2:** arrastar:
  - em despesas, as linhas recebem `draggable="true"` e a alça `.sv-alca`;
  - `dragstart` na lista grava o id em `dataTransfer` (`text/x-extrato`) e em `state.arrastando`;
  - `dragover`/`dragleave`/`drop` em `#pagesBar` sobre `[data-page]` diferente de `all` acendem a classe `alvo`; o `drop` move (spec §4);
  - `dragend` limpa tudo;
  - os ouvintes de `#drop` passam a exigir `Files` em `dataTransfer.types` para acender e para ler.
- [ ] **Step 3:** Chrome automático:
  - com 10 extratos, "pequeno" filtra a lista;
  - arrasto simulado (eventos `DragEvent` com `DataTransfer`) de uma linha para "Casa" move o extrato e mostra o aviso;
  - o mesmo arrasto sobre `#drop` não acende a área.
- [ ] **Step 4:** commit "Início: busca e arrastar o extrato para a pasta".

### Tarefa 6: Pendências

**Files:** `frontend/js/painel.js` (e `index.html`, se precisar)

- [ ] **Step 1:** os 7 itens da spec §6, um por um:
  - título "Início" até a lista chegar;
  - *roving tabindex* + setas/Home/End em `#pagesBar`, com o foco de volta depois de `trocarPasta`;
  - mensagem de salvo-mas-não-abriu;
  - guarda no `.catch` da senha;
  - "Você pulou todos os arquivos. Nada foi lido.";
  - `state.escolhaManual`;
  - "+ Nova página" em vendas.
- [ ] **Step 2:** Chrome automático:
  - setas trocam de etiqueta e o foco fica nela;
  - pular a única senha mostra a mensagem (usar um PDF com senha? se não houver na pasta de testes, simular a resposta da leitura por interceptação com `codigo:'senha'`);
  - clicar em "Abrir" durante a contagem mantém o extrato escolhido;
  - salvar com sucesso mas falhar ao reabrir (interceptar `GET /api/extratos/<id>` com 500) mostra a mensagem.
- [ ] **Step 3:** commit "Início: pendências da revisão".

### Tarefa 7: Fechamento

- [ ] Rodar o conjunto completo (node e pytest), atualizar "ONDE PARAMOS" no `docs/RESUMO-TRANSICAO.md`, fazer o commit e pedir a revisão do ramo (opus).
