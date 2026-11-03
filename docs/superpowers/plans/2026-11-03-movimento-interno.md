# Movimento interno: plano de implementação

> **Para quem executar:** use superpowers:executing-plans ou superpowers:subagent-driven-development, uma tarefa por vez. Cada passo tem uma caixinha (`- [ ]`) para marcar o andamento.

**Objetivo:** tirar do Entrou e do Saiu o dinheiro guardado (aplicação, resgate e cofrinho) e as transferências entre as contas da própria pessoa. O dinheiro guardado passa a aparecer numa linha à parte.

**Arquitetura:**
- **Servidor:** marca as categorias internas e dá categoria às entradas de resgate.
- **Navegador:** decide quem é interno pela categoria (`catOf`) e tira os internos de todas as somas, menos do saldo acumulado.
- **Texto da linha "Você guardou...":** fica em `analise.js`, onde é testado.

**Tecnologias:** Python, Flask, SQLite e pytest; JavaScript ES5 testado com `node --test`.

**Especificação:** `docs/superpowers/specs/2026-11-03-movimento-interno-design.md`.

## Restrições gerais
- Trabalhar no ramo `movimento-interno`.
- Commits em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- TDD: escrever o teste, ver o teste falhar e só então implementar.
- Testes do servidor: `cd backend && .venv/Scripts/python -m pytest -q`.
- Testes do JS: `node --test frontend/tests`.
- Nunca copiar dados dos extratos reais para testes ou commits.
- Valor da opção "sem categoria" de uma entrada: a palavra `Entrada`. Ela é guardada como correção ou regra, igual a qualquer categoria.
- Textos fixos:
  - `Você guardou R$ X em investimentos e reservas.`
  - `Você tirou R$ X dos investimentos e reservas.`
  - `R$ Y em transferências entre suas contas não contam como entrada nem saída.`
  - `não conta como entrada nem saída`, para a aba Organizar.

## Pontos de atenção na revisão
1. **Regra antiga com origem igual à de uma entrada:** uma regra de despesa nunca pode mudar uma entrada. Uma regra "Entrada" nunca pode mudar uma saída.
2. **Categoria interna renomeada pela pessoa:** a categoria continua interna, porque é reconhecida pelo código, e a linha `dInterno` continua com os nomes fixos.
3. **Resgate maior que a aplicação no período:** a linha mostra "Você tirou".
4. **Filtro "Despesas analisadas" com a categoria interna marcada:** ela não aparece na lista do filtro, porque não está em "Para onde vai o dinheiro".
5. **Pasta inteira:** os internos de todos os extratos ficam fora, e a troca de categoria de uma entrada é salva na pasta como as outras trocas.

---

### Tarefa 1: categorias internas e resgates no servidor

**Arquivos:** `backend/categorizacao.py`, `backend/rotas/conta.py`, `backend/tests/test_categorizacao.py`, `backend/tests/test_api.py`

**O que esta tarefa entrega:**
- `REGRAS` passa a ter 26 itens:
  - `investimentos` é renomeada para "Investimentos e reservas" e ganha as palavras `cofrinho`, `caixinha`, `" reserva"` e `" rdb"`;
  - `("entre_contas", "Transferências entre suas contas", [])` entra logo antes de `transferencias`.
- `INTERNAS = {"investimentos", "entre_contas"}`.
- `PALAVRAS_RESGATE = ["resgate", "resg ", "dinheiro retirado"]` e `eh_resgate(descricao, valor) -> bool`, que só vale para valor maior que zero.
- `Categorizador.nome_por_codigo(codigo) -> str`, que devolve o nome atual, editado ou original.
- `preparar_lancamentos`: uma entrada que não é estorno, mas é resgate, recebe `categoria_auto = cat.nome_por_codigo("investimentos")` e a palavra encontrada.
- `/api/estado`: cada item de `categorias_padrao` ganha `"interna": codigo in INTERNAS`.

- [ ] **Passo 1: testes que falham**
  - `test_codigos_unicos_e_contagem` passa a esperar 26 categorias.
  - `test_resgate`, parametrizado:
    - "RESGATE TESOURO SELIC" com valor 100 é resgate;
    - "DINHEIRO RETIRADO COFRINHO" com valor 50 é resgate;
    - "RENDIMENTO POUPANCA" com valor 3 não é;
    - "RESGATE TESOURO" com valor -100 não é.
  - `test_guardado_e_reservas`:
    - "RESERVA POR GASTO CHAO", "APLICACAO CDB", "COFRINHO" e "CAIXINHA TURBO" dão "Investimentos e reservas";
    - "RESERVA HOTEL PRAIA" dá "Lazer".
  - `test_preparar_resgate_e_rendimento`:
    - um resgate fica com `categoria_auto` "Investimentos e reservas";
    - com a edição `padrao:investimentos` de nome "Reserva", fica "Reserva";
    - um rendimento fica com `None`.
  - Em `TROCAS`, acrescentar `"Investimentos": "Investimentos e reservas"`. As diferenças novas da comparação com antes, como cofrinho e reserva que antes iam para Outros, entram em `EXCECOES` com o motivo "dinheiro guardado".
  - Em `test_api.py::test_estado_inicial`: 26 categorias, e as internas são exatamente `{"investimentos", "entre_contas"}`.
- [ ] **Passo 2:** rodar `pytest -q` e ver os testes falharem.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar `pytest -q` e ver tudo passar.
- [ ] **Passo 5:** commit `Categorias internas e resgates no servidor`.

### Tarefa 2: conversão para a versão 2 dos dados

**Arquivos:** `backend/conversoes.py` e `backend/tests/test_conversao.py`

**O que esta tarefa entrega:**
- `VERSAO = 2`.
- `converter` roda:
  - a parte da versão 1 (o que existe hoje) só se `user_version < 1`;
  - a parte da versão 2 só se `user_version < 2`;
  - depois grava `user_version = 2`.
- `_converter_movimento_interno(con)`:
  1. uma categoria criada pela pessoa com o nome normalizado igual a "Investimentos e reservas" ou a "Transferências entre suas contas" ganha " (sua)", e as regras e correções vão junto;
  2. para cada usuário sem `padrao:investimentos`, o nome "Investimentos" nas regras e correções vira "Investimentos e reservas".
- A cópia de segurança `painel-antes-movimento-interno-<data>.db` é feita antes, só se o passo 1 ou o passo 2 for mudar alguma coisa.

- [ ] **Passo 1: testes que falham**
  - `test_investimentos_vira_investimentos_e_reservas`: uma regra e uma correção com "Investimentos" passam ao nome novo.
  - `test_investimentos_renomeada_nao_muda`: com `padrao:investimentos` = "Poupança" e uma regra apontando para "Poupança", nada muda.
  - `test_versao_2_uma_vez_so`: depois da conversão, uma regra nova com "Investimentos" não muda ao religar.
  - `test_copia_movimento_interno_so_quando_precisa`: num banco só com "Mercado", nenhuma cópia nova é feita.
  - Os testes que simulam bancos antigos usam `PRAGMA user_version = 0`, e os testes da versão 2 usam `PRAGMA user_version = 1`.
- [ ] **Passo 2:** ver os testes falharem.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** ver tudo passar.
- [ ] **Passo 5:** commit `Converte para a versão 2: Investimentos e reservas`.

### Tarefa 3: texto da linha "Você guardou"

**Arquivos:** `frontend/js/analise.js` e `frontend/tests/analise.test.js`

**O que esta tarefa entrega:** `linhaInterno({aplicado, resgatado, transferido, brl}) -> string|null`, exportada.

- [ ] **Passo 1: testes que falham**
  - aplicado 1000 e resgatado 200 dão `Você guardou R$ 800.00 em investimentos e reservas.`;
  - aplicado 100 e resgatado 300 dão `Você tirou R$ 200.00 dos investimentos e reservas.`;
  - só transferido 500 dá `R$ 500.00 em transferências entre suas contas não contam como entrada nem saída.`;
  - guardado e transferido juntos dão as duas frases, separadas por um espaço;
  - tudo zero dá `null`.
- [ ] **Passos 2 a 4:** ver os testes falharem, implementar e ver tudo passar.
- [ ] **Passo 5:** commit `Texto da linha de dinheiro guardado`.

### Tarefa 4: a tela

**Arquivos:** `frontend/js/painel.js`, `frontend/index.html` e `frontend/css/estilo.css`

**Mudanças em `painel.js`:**
- **Inicialização:** `INTERNAS_COD = REGRAS_PADRAO.filter(interna).map(codigo)`, e `function nomesInternos()` devolve os nomes atuais via `catByCode`.
- **`ehInterno(t)`:** `nomesInternos().indexOf(catOf(t))!==-1`. Também `contaNoPainel(t)`, que é `!ehInterno(t)`.
- **`catOf(t)` para entradas:**
  1. vale a correção;
  2. senão, vale a regra, só se ela apontar para uma categoria interna;
  3. senão, vale `t.auto`.

  Para saídas, uma regra cujo valor seja `'Entrada'` é ignorada.
- **`load()`:** entradas guardam `auto` e `kw` quando vierem do servidor. Hoje isso só é feito para saídas, na linha que monta `state.tx`.
- **Somas sem os internos**, com `contaNoPainel`:
  - `sums()`;
  - em `render()`, o laço de `ins`, `outs` e `byCat`;
  - em `renderCategorias()`, `base`;
  - em `renderDashboard()`: os meses (`groupMonths`, que também alimenta a projeção), `T`, `byCat`, os dias da semana, os dias do mês, `topOrigins` e as origens das ações;
  - o gráfico por período, perto de `g.inn` e `g.out`;
  - o atalho do filtro.
- **Continuam com tudo:** `byDay` e `dayTx` do saldo acumulado.
- **Linha `dInterno`:** em `renderDashboard`, sobre o `tx` do período, calcular `aplicado`, `resgatado` e `transferido` pelo código da categoria e mostrar `Analise.linhaInterno(...)`. Quando o resultado for nulo, a linha fica escondida.
- **Lançamentos:**
  - fora do modo de edição, uma entrada interna mostra o nome da categoria;
  - no modo de edição, toda entrada ganha um seletor com `Entrada` e os dois nomes internos.
- **`mudarCategoria`:** a "mesma origem" passa a considerar só lançamentos da mesma direção: `ehEntrada(x)===ehEntrada(t)`, com a direção pelo sinal e pelo estorno, sem olhar se é interno. Isso também vale para o "Mover todos" em `origins`.
- **Organizar:** no `renderCustom`, as categorias internas recebem o selo `não conta como entrada nem saída`.

**Outras mudanças:**
- `index.html`: `<p class="aviso-pasta" id="dInterno" role="status" hidden></p>` logo depois de `dAvisoPasta`.
- Atenção: `ehEntrada` e `ehSaida` continuam indicando a direção. "Entrou" e "Saiu" passam a ser `ehEntrada(t) && contaNoPainel(t)` e `ehSaida(t) && contaNoPainel(t)`.

- [ ] **Passo 1:** implementar e conferir a sintaxe com `node -e "new Function(...)"`. Conferir também se cada `$('id')` do JS existe no HTML ou é criado pelo próprio JS.
- [ ] **Passo 2:** verificação ponta a ponta pela API, numa **cópia** do banco real. Abrir a pasta e o extrato do Mercado Pago, e conferir que a soma das saídas sem os internos dá o total menos o "reserva por".
- [ ] **Passo 3:** rodar as duas suítes de testes.
- [ ] **Passo 4:** commit `Painel deixa de fora o dinheiro guardado e as transferências entre suas contas`.

### Tarefa 5: documentação e revisão
- [ ] Atualizar o README: as categorias internas, a linha "Você guardou" e a quantidade de testes. Atualizar também `docs/RESUMO-TRANSICAO.md`, que fica fora do git.
- [ ] Revisão final do ramo inteiro por um subagente (opus), seguida de uma passada de correções, cada uma com teste.
- [ ] O usuário testa no navegador e aprova. Só então: merge `--ff-only` no `main` e push.
