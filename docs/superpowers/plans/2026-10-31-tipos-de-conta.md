# Tipos de conta (Pessoa física e Empresa ou MEI): plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** reduzir os tipos de conta a `pf` e `empresa`, dar códigos fixos às categorias padrão com as listas novas, converter os dados antigos e adaptar os textos do dashboard a cada tipo.

**Arquitetura:** as listas de categorias e o mapa "posição antiga → código" ficam em `backend/categorizacao.py`. A conversão de dados roda uma vez em `banco._atualizar()`, ao ligar o servidor. Na tela, os textos que mudam por tipo ficam num único objeto `TEXTOS` em `frontend/js/painel.js`.

**Tecnologia:** Python 3 + Flask + SQLite, pytest; JavaScript puro (ES5, sem build) no frontend.

**Especificação:** [docs/superpowers/specs/2026-10-31-tipos-de-conta-design.md](../specs/2026-10-31-tipos-de-conta-design.md). As listas de palavras-chave, a tabela de posição → código e todos os textos de tela vêm de lá, **copiados ao pé da letra**, inclusive os espaços dentro das palavras-chave.

## Restrições gerais

- Tipos válidos: `pf` ("Pessoa física") e `empresa` ("Empresa ou MEI"). `pme` e `cafe` recebidos de fora viram `empresa`. Qualquer outro valor vira `pf`.
- Código de cada categoria padrão: exatamente os da coluna "Código" da especificação. A chave de edição é `"<perfil>:<codigo>"`.
- "Transferências para pessoas" é sempre a última categoria de cada tipo.
- Textos de tela em português, ao pé da letra da especificação, Parte 3.
- Estilo do código: o dos arquivos vizinhos (nomes em português, comentários curtos em português, ES5 com `var` e `function` no `painel.js`).
- Rodar os testes dentro de `backend/`: `.venv/Scripts/python -m pytest -q`.
- Um commit por tarefa, com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` no final da mensagem.

## Pontos de atenção na revisão

1. **Regra ou correção apontando para uma categoria que não existe no tipo atual** (ex.: "Mercado" num extrato de Empresa). A expectativa é que o lançamento continue mostrando "Mercado" e que o seletor da tabela tenha essa opção selecionada, em vez de cair silenciosamente na primeira opção. Fica a cargo da Tarefa 3.
2. **Rodar a conversão duas vezes** (o servidor reinicia): nada pode mudar na segunda vez. Coberto na Tarefa 2.
3. **Subpasta MEI com nome igual ao de Empresa, diferindo só por maiúsculas ou acento** ("Loja" × "loja"): deve ganhar " (MEI)", porque o resto do sistema compara nomes normalizados. Coberto na Tarefa 2.
4. **Configuração salva sem o campo `perfil`, ou com outros campos junto** (`textoGrande`): a conversão só pode trocar `pme` por `empresa` e precisa manter o resto intacto. Coberto na Tarefa 2.
5. **Cartão "Onde mais gasta" quando quase tudo é "Outros (revisar)", ou quando não há saídas**: nunca pode mostrar "Outros" como resposta nem quebrar. Se não houver categoria, ele mostra "—". Fica a cargo da Tarefa 4.

---

### Tarefa 1: categorias novas com códigos fixos (servidor)

**Arquivos:**
- Modificar: `backend/categorizacao.py`, `backend/rotas/categorias.py`, `backend/rotas/conta.py`, `backend/schema.sql` (só os comentários)
- Criar: `backend/tests/test_categorizacao.py`
- Modificar testes: `backend/tests/test_api.py` (`test_estado_inicial`, `test_editar_e_restaurar_categoria_padrao`, `test_subpastas_separadas_por_tipo`, `test_extrato_so_vai_para_subpasta_do_mesmo_tipo`)

**Interfaces:**
- Produz, em `categorizacao.py`:
  - `REGRAS_PF` e `REGRAS_EMPRESA`: listas de tuplas `(codigo: str, nome: str, palavras: list[str])`, na ordem da especificação. `REGRAS_PME` deixa de existir.
  - `PERFIS = {"pf": {"rotulo": "Pessoa física", "regras": ..., "fixas": set_de_codigos}, "empresa": {"rotulo": "Empresa ou MEI", ...}}`. Agora `fixas` guarda **códigos**, e não nomes.
  - `perfil_valido(perfil) -> "pf" | "empresa"`: `"pme"` e `"cafe"` viram `"empresa"`.
  - `CODIGOS_ANTIGOS = {"pf": [10 códigos], "empresa": [8 itens, com None na posição 6], "pme": [10 códigos]}`, copiado da tabela "De posição para código" da especificação. A Tarefa 2 usa esse mapa.
  - `definicoes_padrao(perfil, edicoes)` devolve itens com `"id": "b:<codigo>"` e `"codigo"`. O campo `"posicao"` sai.
- Produz, na API:
  - `GET /api/estado` → `perfis[k] = {"rotulo", "regras": [{"codigo", "nome", "palavras", "fixa": bool}]}`. A chave `fixas` some.
  - `PUT/DELETE /api/categorias-padrao/<perfil>/<codigo>`: aceitam `pme` (vira `empresa`) e respondem 404 para um código que não existe.

- [ ] **Passo 1: escrever `tests/test_categorizacao.py`**

Um teste parametrizado, `test_categoria_de_descricoes_reais(perfil, descricao, esperado)`, com as 15 células preenchidas da tabela da Parte 4 da especificação (cada célula não vazia vira um caso). A montagem é `Categorizador(perfil, [], {}).categorizar(descricao)[0] == esperado`. Acrescentar estes testes:

```python
def test_transferencias_e_sempre_a_ultima():
    for p in ("pf", "empresa"):
        assert PERFIS[p]["regras"][-1][0] == "transferencias"

def test_codigos_unicos_e_contagem():
    assert len(PERFIS["pf"]["regras"]) == 17 and len(PERFIS["empresa"]["regras"]) == 13
    for p in ("pf", "empresa"):
        cods = [r[0] for r in PERFIS[p]["regras"]]
        assert len(cods) == len(set(cods))

def test_pme_e_cafe_viram_empresa():
    assert perfil_valido("pme") == "empresa" and perfil_valido("cafe") == "empresa"
    assert perfil_valido("xyz") == "pf" and set(PERFIS) == {"pf", "empresa"}

def test_edicao_por_codigo():
    d = {x["codigo"]: x for x in definicoes_padrao("pf", {"pf:mercado": {"nome": "Feira", "tipo": "variavel", "palavras": None}})}
    assert d["mercado"]["nome"] == "Feira" and d["mercado"]["id"] == "b:mercado" and d["mercado"]["editada"]
    assert d["dividas"]["tipo"] == "fixo" and d["lazer"]["tipo"] == "variavel"
```

- [ ] **Passo 2: ajustar os testes de API existentes**

- `test_estado_inicial`: `set(e["perfis"]) == {"pf", "empresa"}`. Também confere que `e["perfis"]["empresa"]["regras"][0] == {"codigo": "taxas", "nome": "Taxas de cartão e apps", "palavras": [...], "fixa": False}`; aqui basta checar `codigo`, `nome` e `fixa`.
- `test_editar_e_restaurar_categoria_padrao`: trocar `empresa/2` por `empresa/aluguel` e a chave `"empresa:2"` por `"empresa:aluguel"`. Acrescentar `assert cliente.put("/api/categorias-padrao/empresa/nao-existe", json={"nome": "X"}).status_code == 404` e `assert cliente.put("/api/categorias-padrao/pme/aluguel", json={"nome": "Imóvel", "tipo": "fixo", "palavras": None}).status_code == 200`. O resultado do segundo aparece em `e["edicoes"]["empresa:aluguel"]`.
- Novo `test_pme_vindo_de_fora_vira_empresa`: `salvar(cliente, [CAFE_5], perfil="pme")["perfil"] == "empresa"`, `cliente.post("/api/paginas", json={"nome": "X", "perfil": "pme"}).json["perfil"] == "empresa"` e `enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx")), perfil="pme").json["perfil"] == "empresa"`.
- `test_subpastas_separadas_por_tipo` e `test_extrato_so_vai_para_subpasta_do_mesmo_tipo`: trocar `"pme"` por `"empresa"` nos POST e no conjunto esperado.

- [ ] **Passo 3: rodar e ver falhar**

Rodar: `.venv/Scripts/python -m pytest -q`
Esperado: os testes novos e os ajustados falham (ImportError de `CODIGOS_ANTIGOS`/`definicoes_padrao` sem `codigo`, perfil `pme` presente, rota esperando `int`).

- [ ] **Passo 4: implementar**

- `categorizacao.py`: copiar as listas da especificação e montar `PERFIS`, `CODIGOS_ANTIGOS` e `perfil_valido`. Em `definicoes_padrao`, o tipo padrão é `"fixo" if codigo in fixas`. Atualizar a docstring do módulo (dois perfis).
- `rotas/categorias.py`: a rota recebe `<perfil>/<codigo>`, e `_validar_padrao(perfil, codigo)` devolve o perfil já validado por `perfil_valido`. Criar `_regra_padrao(perfil, codigo) -> tuple` para achar o nome original, usado em `_nome_padrao_atual` e em `restaurar_padrao`.
- `rotas/conta.py`: montar `perfis` no formato de objetos descrito em Interfaces.
- `schema.sql`: atualizar os comentários (`chave = "perfil:codigo"`, perfis `'pf'` ou `'empresa'`).

- [ ] **Passo 5: rodar e ver passar**

Rodar: `.venv/Scripts/python -m pytest -q`
Esperado: todos passam. `test_leitura_de_varios_formatos` continua mandando "ALUGUEL IMOBILIARIA" para "Aluguel".

- [ ] **Passo 6: commit**

```bash
git add backend/categorizacao.py backend/rotas/categorias.py backend/rotas/conta.py backend/schema.sql backend/tests/
git commit -m "Categorias padrão com códigos fixos e listas novas por tipo"
```

---

### Tarefa 2: conversão dos dados antigos (MEI → Empresa e edições por código)

**Arquivos:**
- Modificar: `backend/banco.py`
- Criar: `backend/tests/test_conversao.py`

**Interfaces:**
- Consome: `CODIGOS_ANTIGOS` e `normalizar` de `categorizacao.py` (Tarefa 1).
- Produz: `_converter_tipos_de_conta(con)`, chamada no fim de `_atualizar(con)`.

- [ ] **Passo 1: escrever o teste**

Em `test_conversao.py`, `test_conversao_de_banco_antigo(app, tmp_path)`. O teste usa a fixture `app`, cujo banco fica em `app.config["BANCO"]`, e insere direto com `sqlite3`, no `usuario_id` da Ana:
- extrato com perfil `pme`;
- subpastas `("Loja", "empresa")`, `("loja", "pme")` e `("Cartão", "pme")`;
- preferência `config = {"perfil": "pme", "textoGrande": true}`;
- edições `pf:3` (nome "Feira"), `empresa:2` (nome "Imóvel"), `pme:2` (nome "Ponto"), `pme:6` (nome "Compras"), `empresa:6` (nome "Mercadinho").

Depois chama `criar_tabelas(app.config["BANCO"])` **duas vezes** e confere:

```python
assert perfis_dos_extratos == {"empresa"}
assert subpastas == {("Loja", "empresa"), ("loja (MEI)", "empresa"), ("Cartão", "empresa")}
assert config == {"perfil": "empresa", "textoGrande": True}
assert edicoes == {"pf:mercado": "Feira", "empresa:aluguel": "Imóvel", "empresa:fornecedores": "Compras"}
```

O teste também confere que uma `config` sem `perfil`, por exemplo `{"textoGrande": true}`, passa pela conversão sem mudar. Para isso, usar um segundo usuário (Bruno).

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `.venv/Scripts/python -m pytest -q tests/test_conversao.py`
Esperado: FAIL (nada é convertido).

- [ ] **Passo 3: implementar `_converter_tipos_de_conta(con)` em `banco.py`**

A ordem importa para que Empresa vença MEI:
1. Edições com chave `^(pf|empresa|pme):\d+$`. Processar primeiro as de `pf` e `empresa`, depois as de `pme`. A chave nova é `perfil_destino:CODIGOS_ANTIGOS[perfil][pos]`. Se o código for `None` ou a posição estiver fora da lista, apagar a edição. Se a chave nova já existir para o usuário, apagar a antiga. Se não existir, trocar a chave.
2. Subpastas `pme`: se já houver subpasta `empresa` do mesmo usuário e do mesmo `tipo` com o nome normalizado igual (`normalizar`), acrescentar `" (MEI)"` ao nome. Depois, `perfil = 'empresa'`.
3. `UPDATE extratos SET perfil = 'empresa' WHERE perfil = 'pme'`.
4. Preferências `config` cujo JSON tenha `perfil == "pme"`: regravar com `"empresa"`, mantendo os outros campos.

Cada passo só encontra dados a converter na primeira vez, e é isso que garante a idempotência.

- [ ] **Passo 4: rodar todos os testes**

Rodar: `.venv/Scripts/python -m pytest -q`
Esperado: todos passam.

- [ ] **Passo 5: commit**

```bash
git add backend/banco.py backend/tests/test_conversao.py
git commit -m "Converte dados de MEI para Empresa e edições para códigos"
```

---

### Tarefa 3: tela com dois tipos e categorias por código

**Arquivos:**
- Modificar: `frontend/js/painel.js`, `frontend/index.html`

**Interfaces:**
- Consome: `perfis[k].regras = [{codigo, nome, palavras, fixa}]` e as rotas `.../<perfil>/<codigo>` (Tarefa 1).
- Produz: `builtinDefs()` com itens `{id:'b:'+codigo, codigo, builtin, edited, name, type, kws, raw}`. Também produz `feesName()`, que devolve o nome atual da categoria `taxas` ou `null`, e `catByCode(codigo)`, que devolve o nome atual de uma categoria padrão do tipo atual ou `null`. A Tarefa 4 usa as duas.

- [ ] **Passo 1: implementar**

- `PROFILES[k] = { label:p.rotulo, rules:p.regras }`. Remover `baseFixed`. `bKey(codigo)` passa a ser `curPerfil()+':'+codigo`.
- `builtinDefs()`: `name` = edição ou `r.nome`, `type` = edição ou (`r.fixa ? 'fixo' : 'variavel'`), `kws`/`raw` a partir de `r.palavras`.
- Trocar `d.idx`/`bd.idx` por `d.codigo`/`bd.codigo` nas chamadas a `API.editarPadrao` e `API.restaurarPadrao` e em `bKey`. Em `curRules()[bd.idx][0]`, buscar o nome por código.
- `validPerfil(v)`: `pme` e `cafe` viram `'empresa'` antes da checagem. `perfilOf` passa a só chamar `validPerfil`.
- `PASTAS = ['pf', 'empresa']`. Em `index.html`, remover os rádios `value="pme"` (`tipoExt` e `cfgPerfil`) e trocar o texto "Empresa" por "Empresa ou MEI" nos dois.
- Remover `BASE_FIXED`, se não for mais usado depois de `refreshFixed()`.
- Ponto de atenção 1: nos dois seletores de categoria (linhas ~601 e ~1486), se a categoria selecionada não estiver em `allCats()`, acrescentá-la como opção extra, para continuar aparecendo selecionada.

- [ ] **Passo 2: verificar a sintaxe**

Rodar: `node --check frontend/js/painel.js` (se não houver `node`, usar `backend/.venv/Scripts/python -c "import esprima"`; se nenhum dos dois existir, registrar isso e seguir para a verificação manual do passo 3).
Esperado: nenhuma saída.

- [ ] **Passo 3: verificar no navegador**

Ligar o servidor (`iniciar.bat`) e abrir http://127.0.0.1:5000. Conferir:
- configurações com 2 opções;
- Extratos salvos com 2 pastas;
- na página Categorias, Pessoa física com 17 categorias e Empresa com 13;
- editar e restaurar uma categoria padrão funciona;
- um extrato de exemplo de Pessoa física classifica "IFD*…" como Delivery.

- [ ] **Passo 4: commit**

```bash
git add frontend/js/painel.js frontend/index.html
git commit -m "Tela com dois tipos de conta e categorias por código"
```

---

### Tarefa 4: textos e indicadores do dashboard por tipo

**Arquivos:**
- Modificar: `frontend/js/painel.js` (`renderDashboard`, por volta das linhas 763-970), `frontend/index.html` (ids nos títulos)

**Interfaces:**
- Consome: `feesName()` e `catByCode(codigo)` da Tarefa 3.
- Produz: `var TEXTOS = { pf:{...}, empresa:{...} }` e `function textos(){ return TEXTOS[curPerfil()]; }`, logo acima de `renderDashboard`.

- [ ] **Passo 1: criar `TEXTOS`**

Uma chave por texto que muda, com os valores copiados da especificação, Parte 3. Em `empresa`, os valores são os textos atuais do código. Chaves:
- `pilulaPos`, `pilulaNeg`;
- `margemTitulo`, `margemNota` (pf: "…folga no orçamento…"; empresa: "…folga no caixa…"; corrige o "caixaio");
- `fixosTitulo`, `fixosTituloSemana`;
- `fixvarTitulo`, `fixosDesc`, `varDesc`, `fixosNota` (pf: "Pagas todo mês, mesmo sem usar."; empresa: o texto atual "São pagos todo mês, com ou sem movimento. É o mínimo que o negócio precisa faturar.");
- `diasEntradas(d, fixedM)`, uma função que devolve a frase da conclusão (pf: "Suas contas fixas (R$ X por mês) equivalem a cerca de N dias de renda. Ou seja, o salário dos primeiros N dias do mês vai só para as contas fixas.");
- `caixaTitulo`;
- `mostraDiaSemana` (pf `false`) e `negocio` (pf `false`), que ligam as conclusões só de Empresa.

Para "Contas fixas na semana" e o texto de variáveis "Mudam conforme o seu consumo", seguir a especificação.

- [ ] **Passo 2: usar `TEXTOS` no `renderDashboard`**

- Cartões 1 a 3 com os textos de `textos()`.
- Cartão 4: em Empresa, igual a hoje. Em Pessoa física, "Onde mais gasta":
  - a categoria com maior `byCat`, ignorando `OTHER`;
  - `v` = valor por mês;
  - `s` = `nome · X% das saídas`;
  - `m` = `moreHTML` com as 5 maiores origens dessa categoria;
  - sem nenhuma categoria (ponto de atenção 5): `v:'—'` e `s:'Nenhuma saída classificada'`.
- `index.html`: dar `id="dFixT"` ao `h2` "Custos fixos e variáveis", `id="dCumT"` ao `h2` "Caixa acumulado" e `id="dWeekCard"` ao card "Entradas por dia da semana". Trocar o texto dos dois títulos pelo de `textos()` e esconder o card com `hidden = !textos().mostraDiaSemana`. O `aria` do gráfico de linha usa `caixaTitulo`.
- Conclusões:
  - as do dia da semana e da maquininha só entram com `textos().negocio`;
  - a dos "dias de entradas" usa `textos().diasEntradas`;
  - em Pessoa física, entram duas conclusões novas com as frases exatas da especificação. **Delivery**: `byCat[catByCode('delivery')]/T.outs > 0.10`, com `w:true`. **Tarifas bancárias**: `byCat[catByCode('tarifas')] > 0`, com o valor anual `= valor/nM*12` e `w:false`.

- [ ] **Passo 3: verificar a sintaxe**

Rodar: `node --check frontend/js/painel.js`
Esperado: nenhuma saída.

- [ ] **Passo 4: verificar no navegador**

Abrir `extrato-pessoa-fisica-2anos-2024-2026.ofx` como Pessoa física. Conferir:
- o selo "Sobrou/Faltou dinheiro";
- os títulos "Quanto sobra", "Contas fixas por mês" e "Onde mais gasta";
- "Saldo acumulado" como título do gráfico;
- o gráfico de dia da semana escondido;
- nenhuma conclusão de maquininha.

Depois, abrir `extrato-cafeteria-ago-out-2026.ofx` como Empresa: tudo deve estar igual a antes, exceto a dica da Margem, que agora diz "folga no caixa".

- [ ] **Passo 5: commit**

```bash
git add frontend/js/painel.js frontend/index.html
git commit -m "Dashboard fala a língua de cada tipo de conta"
```

---

### Tarefa 5: medição, README e roteiro de teste

**Arquivos:**
- Criar (fora do projeto): `<scratchpad>/medir_outros.py`
- Modificar: `README.md`

- [ ] **Passo 1: medir "Outros (revisar)"**

O script recebe a pasta `dados_teste` como argumento e roda com `backend/.venv/Scripts/python -I`, com `sys.path` apontando para `backend/`. Para cada arquivo, ele lê com `leitura.ler_arquivo(nome, bytes)`, classifica as saídas com `Categorizador(perfil, [], {})` e imprime o % do valor das saídas que caiu em `OUTROS`, mais as 10 descrições mais frequentes nessa categoria. Perfil por arquivo:
- `pf`: `*pessoa-fisica*`;
- `empresa`: `*cafeteria*`, `*empresa*` e `*mei*`;
- `extrato-banco-*`: medir nos dois perfis, só como informação.

Meta: menos de 5% em Pessoa física e menos de 10% em Empresa. Se a meta não for atingida, acrescentar palavras-chave para as descrições mais frequentes, com um caso novo em `tests/test_categorizacao.py` para cada uma, e repetir a medição. Commitar esse ajuste à parte, com a mensagem "Ajusta palavras-chave após a medição".

- [ ] **Passo 2: atualizar o README**

- "Páginas" vira "subpastas" (dentro das pastas Pessoa física e Empresa ou MEI).
- O número de testes passa a ser o que `pytest -q` mostrar.
- Rotas `categorias-padrao/<perfil>/<codigo>`.
- Remover a menção a três perfis.

- [ ] **Passo 3: rodar tudo**

Rodar: `.venv/Scripts/python -m pytest -q`
Esperado: todos passam.

- [ ] **Passo 4: commit**

```bash
git add README.md
git commit -m "Atualiza o README para os dois tipos de conta"
```

Na mensagem final ao usuário, incluir:
- os % medidos por arquivo;
- o roteiro de teste no navegador (os passos de verificação das Tarefas 3 e 4);
- o lembrete de que a cópia do banco está em `backend/dados/painel-backup-2026-10-31-antes-tipos-de-conta.db`.
