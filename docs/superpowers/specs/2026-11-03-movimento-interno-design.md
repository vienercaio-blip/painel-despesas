# Movimento interno: dinheiro guardado e transferências entre suas contas

Data: 03/11/2026. Ramo: `movimento-interno`, criado a partir do `main` (`0d44b1f`).

## Objetivo

Hoje o painel conta como gasto o dinheiro que a pessoa **guarda** (aplicação em CDB, Tesouro, cofrinho) e como renda o que ela **resgata**. Também conta duas vezes o PIX entre as próprias contas dela: uma vez como saída no banco de origem e outra como entrada no banco de destino. Isso distorce o veredito. Num mês em que a pessoa só guardou dinheiro, o painel pode dizer "você gasta mais do que ganha".

Nos extratos reais do usuário:
- havia R$ 16.214,20 em aplicações e R$ 724,00 em "reserva por gasto" (cofrinho) contados como saída;
- não havia nenhum par de PIX entre contas.

Critério de sucesso: Entrou, Saiu e Sobrou respondem "estou gastando mais do que ganho?". O dinheiro guardado aparece à parte, como boa notícia. Nenhum valor some sem a pessoa ver para onde foi.

## Fora do escopo

- Reconhecer sozinho o PIX entre as próprias contas, por pares de saída e entrada do mesmo valor. Fica para quando aparecer em extratos reais.
- Categorias internas criadas pela pessoa. Só as duas do sistema são internas.

## 1. O que a pessoa vê

### Duas categorias internas
- **"Investimentos e reservas"** (código `investimentos`) substitui "Investimentos".
  - Reconhece sozinha as saídas com as palavras de hoje mais `cofrinho`, `caixinha`, `reserva` (início de palavra) e `rdb`.
  - Reconhece também as entradas de resgate: `resgate`, `resg `, `dinheiro retirado`.
- **"Transferências entre suas contas"** (código `entre_contas`) é nova e não tem palavras-chave. Só entra o que a pessoa marcar.
- **Rendimentos** ("RENDIMENTO POUPANCA", "RENDIMENTO CDB") são juros ganhos, ou seja, dinheiro novo. Eles **continuam contando no Entrou**, sem categoria, como as outras entradas.

### No painel
- **Entrou, Saiu e Sobrou** deixam de fora os lançamentos internos, sejam entradas ou saídas.
- Logo abaixo dos três números aparece a linha `dInterno`, só quando houver algo para mostrar:
  - guardado = aplicado − resgatado, no período:
    - se for positivo: `Você guardou R$ X em investimentos e reservas.`
    - se for negativo: `Você tirou R$ X dos investimentos e reservas.`
    - se for zero: nada;
  - transferido = soma, em valor absoluto, das entradas e saídas em "Transferências entre suas contas":
    - se for maior que zero, acrescenta `R$ Y em transferências entre suas contas não contam como entrada nem saída.`;
  - quando as duas partes aparecem, elas ficam na mesma linha, separadas por espaço.
- "Para onde vai o dinheiro" (as barras e o filtro "Despesas analisadas"), "O que fazer agora", o mês a mês e o veredito também deixam os internos de fora.
- **O saldo acumulado continua com todos os lançamentos**, porque mostra o dinheiro que está de fato na conta.
- Os nomes usados na linha `dInterno` são fixos ("investimentos e reservas" e "transferências entre suas contas"), mesmo que a pessoa renomeie as categorias. Assim a frase continua compreensível.

### Em Lançamentos
- Fora do modo "Editar categorias", uma entrada interna mostra o nome da categoria no lugar de "Entrada".
- No modo "Editar categorias", toda entrada ganha um seletor com três opções:
  - **Entrada**, que significa sem categoria e conta no Entrou;
  - **o nome atual de "Investimentos e reservas"**;
  - **o nome atual de "Transferências entre suas contas"**.
- A troca usa o fluxo que já existe: "só este lançamento", "todos da origem neste extrato" ou "também nos próximos".
- **Regras e entradas:** uma regra "também nos próximos" só vale para uma entrada quando aponta para uma categoria interna. Uma regra antiga de despesa nunca muda uma entrada.
- Na aba Organizar, as duas categorias internas aparecem com a observação "não conta como entrada nem saída".

## 2. Servidor

- **`categorizacao.py`**
  - `REGRAS`:
    - `investimentos` passa a se chamar "Investimentos e reservas" e ganha as palavras novas;
    - entra `("entre_contas", "Transferências entre suas contas", [])` logo antes de `transferencias`. Ficam 26 categorias.
  - `INTERNAS = {"investimentos", "entre_contas"}`.
  - `PALAVRAS_RESGATE = ["resgate", "resg ", "dinheiro retirado"]` e `eh_resgate(descricao, valor)`, que só vale para entradas.
  - `preparar_lancamentos`:
    - uma entrada que não é estorno, mas é resgate, recebe `categoria_auto` com o nome atual da categoria `investimentos` (respeitando a edição feita pelo cliente) e `palavra` com a palavra encontrada;
    - as outras entradas continuam com `None`.
  - Para achar o nome atual, o `Categorizador` ganha `nome_por_codigo(codigo)`.
- **`/api/estado`:** cada item de `categorias_padrao` ganha `"interna": bool`.
- **Conversão, versão 2 dos dados** (`conversoes.py`, `VERSAO = 2`):
  - roda nos bancos com `user_version < 2`;
  - a conversão sem perfil, que é a versão 1, continua rodando antes, quando `user_version < 1`;
  - para cada usuário sem edição em `padrao:investimentos`, as regras e correções com "Investimentos" passam a "Investimentos e reservas";
  - uma categoria criada pela pessoa com o nome igual (normalizado) a "Investimentos e reservas" ou a "Transferências entre suas contas" ganha " (sua)", como já é feito hoje;
  - a cópia de segurança é feita antes, só se houver algo a converter: regras, correções ou categorias afetadas. O nome do arquivo é `painel-antes-movimento-interno-<data>.db`.

## 3. Navegador

- **`painel.js`**
  - `INTERNAS` vem de `/api/estado`, a partir dos itens com `interna: true`.
  - `ehInterno(t)` é verdadeiro quando a categoria de `t` é o nome atual de uma categoria interna.
  - `catOf(t)` para entradas:
    1. vale a correção, se houver;
    2. senão, vale a regra, mas só se ela apontar para uma categoria interna;
    3. senão, vale `t.auto`, que só é preenchido nos resgates.
  - As somas do painel (Entrou e Saiu, por categoria, por mês, por dia do mês, por dia da semana e a projeção, que é uma média de quanto sobra por mês) passam a ignorar `ehInterno`. Só o saldo acumulado e as listas de lançamentos de cada dia, mostradas nele, continuam com tudo.
- **`analise.js`:** `linhaInterno({aplicado, resgatado, transferido, brl})` devolve o texto da linha `dInterno`, ou `null` quando não há nada a mostrar.
  - `aplicado` é a soma, em valor absoluto, das saídas internas de investimento;
  - `resgatado` é a soma das entradas internas de investimento;
  - `transferido` é a soma dos valores absolutos de "Transferências entre suas contas".
- **`index.html`:** acrescenta `<p class="aviso-pasta" id="dInterno" hidden></p>` logo depois de `dAvisoPasta`.

## 4. Testes

- **Servidor**
  - `eh_resgate`:
    - "RESGATE TESOURO SELIC" e "DINHEIRO RETIRADO COFRINHO" são resgate;
    - "RENDIMENTO POUPANCA" e uma saída com "resgate" não são.
  - Categorização:
    - "RESERVA POR GASTO CHAO", "APLICACAO CDB" e "COFRINHO" vão para "Investimentos e reservas";
    - "RESERVA HOTEL PRAIA" vai para Lazer.
  - Comparação com a categorização de antes: "Investimentos" entra em `TROCAS`. Diferenças novas só com motivo, como cofrinho e reserva, que antes iam para Outros.
  - `preparar_lancamentos`:
    - um resgate recebe a categoria, com o nome editado quando a pessoa o renomeou;
    - um rendimento fica sem categoria.
  - `/api/estado`: exatamente as duas categorias internas.
  - Conversão para a versão 2:
    - as regras e correções com "Investimentos" mudam;
    - com edição em `padrao:investimentos`, nada muda;
    - religar o servidor não muda nada;
    - a cópia de segurança é feita só quando há algo a converter.
- **JS (`linhaInterno`)**
  - guardou;
  - tirou;
  - só transferências;
  - os dois juntos;
  - tudo zero dá `null`.
- **Navegador (o usuário)**
  1. Um extrato com aplicação no CDB ou cofrinho: o Saiu diminui e aparece "Você guardou R$ X".
  2. Uma entrada marcada como "Transferências entre suas contas": ela sai do Entrou e aparece a frase das transferências.
  3. O saldo acumulado não muda.
