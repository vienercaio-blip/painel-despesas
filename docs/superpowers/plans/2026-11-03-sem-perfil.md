# Sem perfil — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** tirar a divisão Pessoa física / Empresa ou MEI. Em troca, o site ganha pastas livres de um nível, a visão "Ver a pasta inteira" e uma lista única de 25 categorias, sem perder os dados de quem já usa o site.

**Arquitetura:** a lista única substitui `PERFIS` em `categorizacao.py`, e o categorizador deixa de receber perfil. As conversões de bancos antigos saem de `banco.py` e vão para um módulo próprio, `conversoes.py`, que faz uma cópia de segurança antes de converter. A pasta inteira é montada no servidor, em duas rotas novas em `rotas/paginas.py`. No navegador, `painel.js` perde toda a lógica de perfil e ganha o modo "pasta". As regras puras ficam em `analise.js` e no novo `pastas.js`.

**Tecnologias:** Python 3.15, Flask, SQLite, pytest; JavaScript ES5 sem build, `node --test`.

**Especificação:** `docs/superpowers/specs/2026-11-03-sem-perfil-design.md`. Leia junto com este plano.

## Restrições gerais

- O ramo `sem-perfil` sai do `main` **depois** do merge de `leitura-pdf`: `git switch main && git switch -c sem-perfil`.
- Nomes, comentários, mensagens e commits em português. Cada commit termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Frontend em ES5 (`var`, `function`), sem bibliotecas novas. As contas ficam em `analise.js` e `pastas.js`, e o `painel.js` só desenha.
- Backend no estilo de `leitura.py` e `categorizacao.py`: regex no topo, docstrings curtas.
- TDD: escrever o teste, vê-lo falhar e só então implementar.
- Testes do servidor: `cd backend && .venv/Scripts/python -m pytest -q`. Testes de JS: `node --test frontend/tests` (na raiz).
- Nunca copiar dados dos extratos reais (`backend/dados/pdfs-exemplo/`) para testes ou commits. Antes de cada commit, buscar identificadores reais com grep.
- Valor novo da coluna `perfil` em `paginas` e `extratos`: `'unico'`. Chave das edições das categorias padrão: `padrao:<código>`.
- Texto do aviso de repetidos: `Encontramos N lançamentos repetidos entre os extratos desta pasta e contamos cada um uma vez só.` Com N = 1, use o singular: "1 lançamento repetido".
- Texto da sugestão de pastas: `Tem empresa ou MEI? Crie as pastas Pessoal e Empresa com um toque.`
- Texto da pasta vazia: `Esta pasta ainda não tem extratos.`

## Pontos de atenção na revisão

1. **Conversão no banco real:** ao ligar o servidor com o `painel.db` atual, a cópia de segurança é feita uma vez, e ligar de novo não muda nada. Os testes estão na Tarefa 3.
2. **Correção feita na pasta inteira:** ela deve aparecer ao abrir aquele extrato sozinho. Salvar as correções da pasta não pode apagar as correções de extratos fora dela, nem mexer na pasta de outro usuário. Os testes estão na Tarefa 5.
3. **Repetido descartado na pasta:** fica o lançamento do extrato mais antigo (menor id), e a correção dele é a que vale. O teste está na Tarefa 5.
4. **Mover um extrato antigo de Empresa para uma pasta criada antes como Pessoa física:** tem de funcionar, já que não existe mais trava de perfil. O teste está na Tarefa 4.
5. **Editar e restaurar uma categoria unida** (`moradia`): o novo nome vai para as regras e correções, e restaurar volta para "Moradia e aluguel". O teste está na Tarefa 2.

---

### Tarefa 1: foto da categorização de hoje

Guarda o resultado da categorização **antes** da mudança, para a Tarefa 2 provar que nada mudou sem motivo.

**Arquivos:**
- Criar: `backend/tests/dados/categorias_antes_pf.json`
- Script temporário (fora do projeto): `<scratchpad>/foto_categorias.py`

- [ ] **Passo 1:** escrever o script temporário. Ele lê, com `leitura.ler_arquivo`, cada `dados_teste/extrato-pessoa-fisica*.ofx` e `dados_teste/extrato-banco-*.ofx|csv` e categoriza as saídas e os estornos com `Categorizador("pf", [], {})`. O resultado é gravado como `{descrição: categoria}`, em ordem alfabética, com `ensure_ascii=False` e `indent=1`. Fazer o mesmo com `Categorizador("empresa", [], {})` para `extrato-empresa-*`, `extrato-mei-*` e `extrato-cafeteria-*`, gravando em `backend/tests/dados/categorias_antes_empresa.json`.
- [ ] **Passo 2:** rodar com `backend/.venv/Scripts/python -I <script>` (com `sys.path` apontando para `backend`) e conferir que os dois arquivos têm mais de 20 descrições cada.
- [ ] **Passo 3:** confirmar que os `dados_teste` são inventados (eles já estão no git) e fazer o commit: `Foto da categorização atual para comparar depois`.

---

### Tarefa 2: lista única de categorias

**Arquivos:**
- Modificar: `backend/categorizacao.py`, `backend/rotas/categorias.py`, `backend/rotas/conta.py`, `backend/rotas/leitura.py`, `backend/rotas/extratos.py` (só as chamadas ao categorizador)
- Testes: `backend/tests/test_categorizacao.py`, `backend/tests/test_api.py`

**Interfaces:**
- Produz, em `categorizacao.py`:
  - `REGRAS: list[tuple[str, str, list[str]]]`, com os 25 itens na ordem e com os nomes da tabela da seção 2 da especificação;
  - `FIXAS: set[str] = {"dividas", "tarifas", "impostos", "folha", "moradia", "casa", "contabilidade", "seguros", "assinaturas", "educacao"}`;
  - `definicoes_padrao(edicoes) -> list[dict]`, que lê a chave `padrao:<código>`;
  - `Categorizador(categorias_cliente, edicoes)`;
  - `carregar_categorizador(banco, usuario_id)`.
- Saem: `PERFIS`, `REGRAS_PF`, `REGRAS_EMPRESA` e `perfil_valido`. `CODIGOS_ANTIGOS` continua.
- API:
  - `GET /api/estado` troca `perfis` por `categorias_padrao: [{codigo, nome, palavras, fixa}]`;
  - `PUT` e `DELETE /api/categorias-padrao/<codigo>`;
  - `POST /api/categorizar {descricoes}`;
  - `POST /api/leitura` não lê nem devolve `perfil`; a resposta é `{arquivos}`.

- [ ] **Passo 1: testes que falham** em `test_categorizacao.py`:
  - `test_codigos_unicos_e_contagem`: `len(REGRAS) == 25`, códigos únicos e `REGRAS[-1][0] == "transferencias"`.
  - `test_categorias_unidas_reconhecem_as_duas_origens`, parametrizado:
    - `("PAG ALUGUEL SALA", "Moradia e aluguel")`, `("CONDOMINIO EDIF", "Moradia e aluguel")`;
    - `("COELBA ENERGIA", "Água, luz e internet")`;
    - `("POSTO SHELL GASOLINA", "Transporte e combustível")`, `("MOTOBOY ENTREGA", "Transporte e combustível")`, `("UBER TRIP", "Transporte e combustível")`.
  - `test_palavras_de_empresa_nao_roubam_gastos_pessoais`, parametrizado:
    - `("PIX ENVIADO MARIA DAS DORES", "Transferências para pessoas")`;
    - `("IFOOD *PEDIDO", "Delivery")`;
    - `("PIX ENVIADO MERCADO PAGO", "Mercado")`, que é o comportamento de hoje para pessoa física e cuja colisão é conhecida;
    - `("PAGAMENTO DAS MEI", "Impostos e encargos")`.
  - `test_mercado_vence_fornecedores`: `"SUPERMERCADO BOM PRECO"` e `"PADARIA PAO QUENTE"` dão `"Mercado"`; `"DISTRIBUIDORA DE BEBIDAS"` dá `"Fornecedores"`.
  - `test_categorizacao_igual_a_de_antes`: carrega os dois JSON da Tarefa 1 e categoriza cada descrição com `Categorizador([], {})`. Cada resultado deve ser igual ao antigo, ou ao antigo passado por `TROCAS`.
    - Para pessoa física: `TROCAS = {"Moradia": "Moradia e aluguel", "Contas da casa": "Água, luz e internet", "Transporte": "Transporte e combustível"}`.
    - Para empresa: `{"Aluguel": "Moradia e aluguel", "Combustível e entregas": "Transporte e combustível"}` mais a lista de exceções justificadas que aparecer.
    - Toda exceção vira um item `EXCECOES = {descrição: (antiga, nova, "motivo")}` no próprio teste. Exceções esperadas: mercado e padaria que antes iam para Fornecedores.
  - `test_edicao_por_codigo`: atualizar para a chave `"padrao:mercado"`.
  - Remover `test_pme_e_cafe_viram_empresa` e o parâmetro `perfil` de `test_categoria_de_descricoes_reais`. Nos casos que eram de empresa, conferir se o resultado esperado continua valendo na lista única. Se não continuar, aplicar a regra das exceções.
- [ ] **Passo 2:** em `test_api.py`, tirar `perfil` de `enviar`, `salvar`, `/api/categorizar` e `/api/paginas`. Acrescentar o teste `test_editar_e_restaurar_categoria_unida`:
  - criar uma regra apontando para `"Moradia e aluguel"`;
  - fazer `PUT /api/categorias-padrao/moradia` com `{"nome": "Casa própria", "tipo": "fixo", "palavras": None}` e conferir que a regra passou a apontar para `"Casa própria"`;
  - fazer `DELETE` e conferir que ela voltou para `"Moradia e aluguel"`;
  - conferir que `PUT /api/categorias-padrao/inexistente` dá 404.
  Os testes de pastas com perfil (por volta das linhas 149 a 175 e 219 a 221) ficam para a Tarefa 4. Por enquanto, marque-os com `@pytest.mark.skip("Tarefa 4")`.
- [ ] **Passo 3:** rodar `pytest -q` e ver os testes novos falharem.
- [ ] **Passo 4:** implementar.
  - Nas categorias unidas, as palavras são a soma das duas listas, sem repetição, mantendo os espaços propositais das originais.
  - Em `fornecedores`, tirar `mercado`, `supermerc`, `atacad`, `assai`, `makro`, `carrefour`, `hortifruti`, `acougue` e `padaria`.
  - Em `taxas`, tirar ` ifood ` e `rappi`. Como `taxas` (posição 3) vem antes de `delivery` (posição 10), sem essa remoção um pedido de iFood deixaria de ser Delivery.
  - Em `taxas`, tirar também `mercado pago`. Senão, um PIX pago pelo Mercado Pago de quem era pessoa física passaria a ser "Taxas de cartão e apps".
  - Em `impostos`, tirar `" das "`; ficam `das mei`, `pgmei` e `simples nacional`. Senão, "PIX ENVIADO MARIA DAS DORES" iria para Impostos para todo mundo.
  - Em `tarifas`, a palavra `juros` (que só existia na lista de empresa) fica de fora, porque `dividas` já a pega antes.
  - `/api/estado` monta `categorias_padrao` a partir de `REGRAS` e `FIXAS`.
- [ ] **Passo 5:** rodar `pytest -q`. Tudo passa, menos os testes marcados com skip.
- [ ] **Passo 6:** fazer o commit: `Lista única de categorias, sem perfil`.

---

### Tarefa 3: conversão dos bancos antigos, com cópia de segurança

**Arquivos:**
- Criar: `backend/conversoes.py`, que recebe `_converter_tipos_de_conta` vindo de `banco.py` e a conversão nova
- Modificar: `backend/banco.py` (`_atualizar` chama `conversoes.converter(con, caminho_banco)`) e `backend/schema.sql` (os dois `DEFAULT 'pf'` de `perfil` viram `DEFAULT 'unico'`; atualizar o comentário das páginas)
- Teste: `backend/tests/test_conversao.py`

**Interfaces:**
- Produz `conversoes.converter(con, caminho_banco) -> None`. Ela roda, em ordem:
  1. `_converter_tipos_de_conta(con)`, sem o passo do " (sua)", que muda de lugar;
  2. `_copia_de_seguranca(con, caminho_banco)`, só quando `_ha_algo_para_converter(con)`;
  3. `_converter_sem_perfil(con)`.
- `_ha_algo_para_converter(con) -> bool`: verdadeiro se existe `paginas` ou `extratos` com `perfil IN ('pf','empresa')`, ou alguma `edicoes_padrao.chave` que começa com `pf:` ou `empresa:`.
- `_copia_de_seguranca`: grava `<pasta do banco>/painel-antes-sem-perfil-AAAAMMDD-HHMMSS.db` com `con.backup(destino)`. Com `":memory:"` não faz nada.
- Constantes da conversão, em `conversoes.py`:
  - `NOMES_ANTIGOS = {"pf": {código: nome}, "empresa": {código: nome}}`, com os nomes originais de hoje;
  - `CODIGO_NOVO = {"aluguel": "moradia", "contas": "casa", "combustivel": "transporte"}`.

- [ ] **Passo 1: testes que falham** em `test_conversao.py`:
  - Atualizar `test_conversao_de_banco_antigo` para o estado final: `perfil` igual a `'unico'` em tudo; as chaves `padrao:mercado`, `padrao:moradia` (que veio de `empresa:aluguel`, "Imóvel") e `padrao:fornecedores`; e as páginas convertidas conforme as regras abaixo.
  - `test_pastas_sem_perfil`:
    - Ana tem as páginas pf "Nubank" e "Casa", e as páginas empresa "nubank" e "Loja";
    - tem um extrato pf solto, dois extratos empresa soltos e um extrato empresa dentro de "Loja";
    - resultado esperado: as páginas `{"Nubank", "Casa", "nubank (Empresa)", "Loja", "Empresa"}`;
    - os dois extratos empresa soltos ficam dentro de "Empresa", e o extrato pf continua com `pagina_id NULL`;
    - Bruno, que só tem extratos pf soltos, não ganha a pasta "Empresa".
  - `test_pasta_empresa_ja_existente_e_reaproveitada`: uma página pf chamada "empresa" já existe; os extratos empresa soltos vão para ela, e nenhuma pasta nova é criada.
  - `test_edicoes_unidas`:
    - `pf:moradia` = ("Casa própria", "fixo", `["aluguel", "cond"]`) e `empresa:aluguel` = ("Ponto", "variavel", `["sala"]`);
    - resultado: `padrao:moradia` = ("Casa própria", "fixo", `["aluguel", "cond", "sala"]`);
    - uma regra apontando para "Ponto" passa a apontar para "Casa própria".
  - `test_edicao_unida_com_palavras_originais`: `pf:casa` com `palavras NULL` e `empresa:contas` com `["luz loja"]`. O resultado tem as palavras originais de `pf:casa` (sem os espaços) mais `"luz loja"`.
  - `test_nomes_antigos_nas_regras_e_correcoes`: uma regra e uma correção com "Moradia", outra com "Combustível e entregas" e outra com "Contas da casa", sem edição. Elas passam a ser "Moradia e aluguel", "Transporte e combustível" e "Água, luz e internet".
  - Atualizar `test_categoria_criada_com_nome_de_categoria_padrao_nova`: uma categoria criada chamada "Fornecedores" por quem era pf vira "Fornecedores (sua)", e a regra vai junto.
  - `test_copia_de_seguranca_uma_vez_so`: com algo para converter, `criar_tabelas` duas vezes gera **exatamente um** arquivo `painel-antes-sem-perfil-*.db` em `tmp_path`. Num banco novo, sem nada para converter, não gera nenhum.
  - `test_paginas_de_vendas_nao_mudam_de_nome`: uma página `tipo='vendas'` mantém o nome e recebe `perfil='unico'`.
- [ ] **Passo 2:** rodar `pytest tests/test_conversao.py -q` e ver os testes falharem.
- [ ] **Passo 3:** implementar `_converter_sem_perfil(con)`, numa transação só, nesta ordem:
  1. Categorias criadas pela pessoa com nome igual (normalizado) a um nome de `REGRAS` ganham " (sua)", e as regras e correções vão junto.
  2. Edições: `pf:x` vira `padrao:x`; `empresa:x` vira `padrao:CODIGO_NOVO.get(x, x)`. No conflito vale a regra da especificação: nome e tipo de pf, palavras somadas, e `NULL` vira as originais (sem os espaços) de `NOMES_ANTIGOS`/`REGRAS` daquele perfil.
  3. Renomear nas regras e correções de cada usuário: para cada código antigo de pf e de empresa, o nome atual antigo (o editado ou o de `NOMES_ANTIGOS`) vira o nome final (o editado em `padrao:` ou o de `REGRAS`), quando os dois forem diferentes.
  4. Pastas e extratos conforme a especificação, seção 3. Depois, `UPDATE ... SET perfil = 'unico' WHERE perfil IN ('pf','empresa')` nas duas tabelas.
- [ ] **Passo 4:** rodar `pytest -q`. Tudo passa, menos os skips da Tarefa 2.
- [ ] **Passo 5:** fazer o commit: `Converte bancos antigos para sem perfil, com cópia de segurança`.

---

### Tarefa 4: pastas e extratos sem perfil

**Arquivos:**
- Modificar: `backend/rotas/paginas.py`, `backend/rotas/extratos.py`
- Teste: `backend/tests/test_api.py`

**Interfaces:**
- `_json` das páginas e `_meta` dos extratos deixam de ter `perfil`.
- `_nome_em_uso(banco, nome, tipo, exceto=None)`.
- `_validar_pagina(banco, pagina_id, tipo)`.
- Todo `INSERT` em `paginas` e em `extratos` grava `perfil = 'unico'`.

- [ ] **Passo 1:** tirar os skips da Tarefa 2 e reescrever esses testes sem perfil:
  - `test_paginas` (já existe): tirar `perfil`; a resposta não tem a chave `perfil`; criar "cafetéria" dá 409 com a mensagem `Já existe uma pasta chamada "cafetéria".`; excluir a pasta devolve o extrato para "Sem pasta" (`pagina_id None`), como já é testado.
  - `test_subpastas_separadas_por_tipo` e `test_extrato_so_vai_para_subpasta_do_mesmo_tipo` saem, porque testavam a trava de perfil. A separação entre despesas e vendas fica coberta por um teste novo, `test_pasta_de_vendas_nao_recebe_extrato`: salvar um extrato de despesas com o `pagina_id` de uma página de vendas dá 404.
  - `test_mover_extrato_para_qualquer_pasta`: no banco cru, um extrato com `perfil='empresa'` e uma página com `perfil='pf'` (simulando dados antigos). `PATCH` com o `pagina_id` dá 200.
  - `test_mesclar_extratos_de_origens_diferentes`: mesclar dois extratos que antes eram de perfis diferentes funciona.
  - Remover os testes de conversão de "pme" que dependem de `perfil` na resposta (por volta das linhas 219 a 221).
- [ ] **Passo 2:** rodar e ver os testes falharem.
- [ ] **Passo 3:** implementar. As mensagens passam de "subpasta" para "pasta": `Dê um nome para a pasta.` e `Pasta não encontrada.` Atualizar a docstring do módulo `paginas.py`.
- [ ] **Passo 4:** rodar `pytest -q`. Tudo passa.
- [ ] **Passo 5:** fazer o commit: `Pastas livres, sem perfil`.

---

### Tarefa 5: a pasta inteira no servidor

**Arquivos:**
- Modificar: `backend/rotas/paginas.py`
- Teste: `backend/tests/test_pasta_inteira.py` (novo)

**Interfaces:**
- `sem_repetidos(grupos: list[list[dict]]) -> tuple[list[dict], int]`, função pura.
  - `grupos` são os lançamentos de cada extrato, na ordem dos ids dos extratos.
  - A chave é `(data, normalizar(descricao), valor)`.
  - Um lançamento do grupo *i* fica quando a contagem daquela chave dentro do grupo *i* passa a contagem que já ficou dos grupos anteriores. Na prática, fica o máximo de cópias de um único extrato.
  - Devolve os que ficaram (na ordem) e quantos saíram.
- `GET /api/paginas/<id>/lancamentos` devolve `{id, nome, extratos: [ids em texto], lancamentos: [... mesmo formato de abrir_extrato, mais "extrato_id"], correcoes: {lanc_id: categoria}, repetidos: int}`. Só para `tipo='despesas'`; outra pasta dá 404. A ordem dos lançamentos é por data e id.
- `PUT /api/paginas/<id>/correcoes {correcoes}` substitui as correções **só** dos lançamentos dos extratos daquela pasta. Ids fora da pasta são ignorados.

- [ ] **Passo 1: testes que falham**:
  - `test_sem_repetidos`, parametrizado:
    - `[[A, B], [A, C]]` dá `[A, B, C]` e 1;
    - `[[A, A], [A]]` dá `[A, A]` e 1;
    - `[[A], [A, A]]` dá `[A, A]` e 0. O segundo grupo traz uma cópia a mais, que fica;
    - `[[A, "a  "]]`, ou seja, a mesma data e valor com a descrição em caixa ou espaço diferente dentro do mesmo grupo, dá as duas e 0.
  - `test_pasta_soma_extratos`: dois extratos na pasta, sem repetidos. `len(lancamentos)` é a soma, e `repetidos == 0`.
  - `test_pasta_conta_repetido_uma_vez`: o mesmo lançamento salvo em dois extratos dá `repetidos == 1`, e o lançamento que fica é o do extrato de menor id (`extrato_id`).
  - `test_pasta_vazia`: `lancamentos == []` e `repetidos == 0`.
  - `test_pasta_de_outro_usuario_da_404`: tanto no GET quanto no PUT.
  - `test_correcao_na_pasta_aparece_no_extrato`: fazer `PUT /api/paginas/<id>/correcoes` com a correção de um lançamento, e conferir que `GET /api/extratos/<id do extrato>` tem essa correção.
  - `test_correcoes_da_pasta_nao_apagam_as_de_fora`: um extrato fora da pasta com uma correção; o PUT na pasta com `{}` mantém a correção do extrato de fora.
- [ ] **Passo 2:** rodar e ver os testes falharem.
- [ ] **Passo 3:** implementar. Reaproveitar `preparar_lancamentos` e `carregar_categorizador`. Para não repetir o laço de `salvar_correcoes`, ele pode ir para uma função de apoio `gravar_correcoes(banco, ids_validos, correcoes)` em `rotas/extratos.py`, usada pelas duas rotas.
- [ ] **Passo 4:** rodar `pytest -q`. Tudo passa.
- [ ] **Passo 5:** fazer o commit: `Ver a pasta inteira: lançamentos somados sem repetidos`.

---

### Tarefa 6: regras do navegador sem perfil

**Arquivos:**
- Modificar: `frontend/js/analise.js`
- Criar: `frontend/js/pastas.js`
- Testes: `frontend/tests/analise.test.js`, `frontend/tests/pastas.test.js` (novo)

**Interfaces:**
- O contexto do `Analise` perde `perfil`. O veredito usa sempre os textos atuais de `pf`.
- `acoes(c)`: as ações de pf (delivery, tarifas, assinaturas, compras, dívidas), depois `taxas` e `fixos` da empresa, todas com o mesmo `gastou` de pf. A ação `tarifasEmpresa` sai. O texto de "Trazer X de volta ao normal" usa sempre "você gastou".
- `Pastas.sugerir(nomes: string[], dispensada: boolean) -> string[]`: devolve quais de `["Pessoal", "Empresa"]` ainda faltam, comparando sem acento e sem diferença de maiúsculas. Devolve `[]` se `dispensada` for verdadeiro ou se nada faltar. Exportado como `window.Pastas` e `module.exports`, igual ao `analise.js`.
- `Pastas.avisoRepetidos(n: number) -> string|null`: `null` para 0; senão, o texto das Restrições gerais, com singular para 1.

- [ ] **Passo 1: testes que falham**:
  - em `analise.test.js`, tirar `perfil` do `ctx` e trocar os testes de empresa por:
    - `taxas acima de 3% das entradas sugere negociar a maquininha` (sem perfil);
    - `fixos acima de 60% sugere revisar contratos`;
    - `tarifas gera uma ação só` (só `tarifas`, sem `tarifasEmpresa`);
    - `veredito usa sempre textos de pessoa física` (com prejuízo: o título é `Alerta:`).
  - em `pastas.test.js`:
    - `sugerir([], false)` dá `["Pessoal","Empresa"]`;
    - `sugerir(["pessoal"], false)` dá `["Empresa"]`;
    - `sugerir(["Pessoal","EMPRESA"], false)` dá `[]`;
    - `sugerir([], true)` dá `[]`;
    - `avisoRepetidos(0)` dá `null`;
    - `avisoRepetidos(1)` e `avisoRepetidos(12)` dão os textos exatos.
- [ ] **Passo 2:** rodar `node --test frontend/tests` e ver os testes falharem.
- [ ] **Passo 3:** implementar.
- [ ] **Passo 4:** rodar `node --test frontend/tests`. Tudo passa.
- [ ] **Passo 5:** fazer o commit: `Regras do painel sem perfil e sugestão de pastas`.

---

### Tarefa 7: a tela sem perfil e com a pasta inteira

**Arquivos:**
- Modificar: `frontend/js/painel.js`, `frontend/js/api.js`, `frontend/index.html`, `frontend/css/estilo.css`

**Interfaces:**
- Consome: as rotas das Tarefas 2, 4 e 5, além de `Pastas.sugerir` e `Pastas.avisoRepetidos`.
- `api.js`:
  - `lerArquivos(arquivos, senha)`;
  - `criarPagina(nome, tipo)`;
  - `editarPadrao(codigo, c)` e `restaurarPadrao(codigo)`;
  - `categorizar(descricoes)`;
  - novos: `abrirPasta(id)` e `salvarCorrecoesPasta(id, correcoes)`.

- [ ] **Passo 1:** tirar o perfil do `painel.js`.
  - `PROFILES`, `validPerfil`, `curPerfil`, `chosenPerfil`, `perfilOf`, `perfilLabel`, `avisoTipo`, `PASTAS`, as abas com cadeado, as checagens de "perfis diferentes" no mesclar e `contaTipo` saem.
  - `curRules()` passa a devolver as regras de `estado.categorias_padrao`.
  - `bKey(codigo)` passa a devolver `'padrao:'+codigo`.
  - `TEXTOS` vira um objeto só, com os valores de pf. `mostraDiaSemana` fica verdadeiro, e `negocio` sai.
  - O `ctx` do `Analise` perde `perfil`.
- [ ] **Passo 2:** no `index.html`, remover:
  - os rádios `tipoExt` do envio e o aviso "escolha o tipo real do extrato";
  - os rádios `cfgPerfil` das configurações.
  Acrescentar:
  - `<script src="/js/pastas.js"></script>` antes do `painel.js`;
  - `<p class="aviso-pasta" id="dAvisoPasta" role="status" hidden></p>` logo abaixo do veredito;
  - o espaço da sugestão de pastas na área de extratos salvos.
  Tirar do CSS o que ficar sem uso, como `.perfil-choice` (se só o envio usava) e `.ptab.locked`.
- [ ] **Passo 3:** pastas na lista de extratos salvos.
  - As abas são "Sem pasta" (os extratos com `page` nulo) e as pastas da pessoa.
  - Os textos "subpasta" viram "pasta".
  - Excluir uma pasta devolve os extratos para "Sem pasta".
  - A sugestão aparece quando `Pastas.sugerir(nomes, cfg.sugestaoPastas==='dispensada')` não estiver vazia. O botão cria as pastas que faltam, com `API.criarPagina`, uma por vez. "Agora não" grava `cfg.sugestaoPastas = 'dispensada'` pela preferência `config`, que já existe.
- [ ] **Passo 4:** modo pasta inteira.
  - Com uma pasta aberta e com extratos, o cabeçalho dela mostra o botão **"Ver a pasta inteira"**. Com a pasta vazia, mostra `Esta pasta ainda não tem extratos.` e um atalho para a aba Início.
  - `carregarPasta(id)` funciona como `carregarSalvo`, mas usa `API.abrirPasta`. Ela guarda `state.pastaId = id`, `state.savedId = null` e o nome do arquivo igual ao nome da pasta, e mostra `Pastas.avisoRepetidos(resp.repetidos)` em `dAvisoPasta` (ou esconde o aviso).
  - `persistOverrides()` chama `API.salvarCorrecoesPasta` quando `state.pastaId` existe.
  - `carregarSalvo` e um envio novo zeram `state.pastaId` e escondem o aviso.
- [ ] **Passo 5:** ligar o site (`iniciar.bat`) e conferir à mão, com uma conta de teste:
  1. enviar dois arquivos de `dados_teste/` sem escolher tipo;
  2. criar as pastas pela sugestão;
  3. mover os extratos;
  4. "Ver a pasta inteira": os totais batem com a soma dos dois;
  5. enviar o mesmo arquivo de novo para a mesma pasta e ver o aviso de repetidos;
  6. trocar uma categoria na pasta inteira e conferir que ela aparece ao abrir o extrato sozinho;
  7. a aba Organizar mostra as 25 categorias.
  Rodar também `node --test frontend/tests` e `pytest -q`.
- [ ] **Passo 6:** fazer o commit: `Tela sem perfil, com pastas livres e a pasta inteira no painel`.

---

### Tarefa 8: documentação

**Arquivos:**
- Modificar: `README.md` e `docs/RESUMO-TRANSICAO.md` (este, se já estiver no git; se não, só atualizar o arquivo)

- [ ] **Passo 1:** tirar do `README.md` as menções aos dois tipos de conta e descrever as pastas e a pasta inteira em uma ou duas frases.
- [ ] **Passo 2:** atualizar o resumo de transição. Ele perde "Dois tipos de conta", e os próximos passos ficam com este item como feito.
- [ ] **Passo 3:** fazer o commit: `Documentação: sem perfil`.

Depois disso: a revisão independente do ramo inteiro, uma passada de correções e o teste do usuário no navegador, antes do merge.
