# Leitura de extrato em PDF — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** aceitar o extrato da conta em PDF (C6, Inter, Nubank, Bradesco Celular e Banco do Brasil com conferência; outros bancos pelo genérico), com pedido de senha e sem nunca mostrar números errados calado.

**Arquitetura:** um pacote novo, `backend/leitura_pdf/`, com uma base comum (abrir o PDF, linhas e palavras com posição e cor, valores, conferências, os três jeitos de ler) e um arquivo por perfil de banco. `leitura.py` manda os `.pdf` para o pacote. A rota `/api/leitura` ganha senha opcional, avisos e códigos. Na tela, a caixinha de senha fica na lista de arquivos enviados.

**Tecnologia:** Python 3 + Flask, `pdfplumber` + `cryptography` (leitura e senha) e `pypdf` (só nos testes, para gerar PDFs com senha); pytest; JS ES5 no `painel.js`.

**Especificação:** [docs/superpowers/specs/2026-11-02-leitura-pdf-design.md](../specs/2026-11-02-leitura-pdf-design.md). Mensagens, limites e regras de reconhecimento vêm de lá, ao pé da letra.

## Restrições gerais

- **Os extratos reais** (`backend/dados/pdfs-exemplo/*.pdf`) **nunca** entram em teste, commit nem mensagem. Os testes usam só PDFs inventados.
- A senha nunca aparece em resposta, mensagem de erro ou log.
- Limites: 15 MB e 300 páginas.
- Formato de saída de todo leitor: `{"data": "AAAA-MM-DD", "descricao": str, "valor": float}`, com o valor negativo para saída, em ordem de data.
- Estilo do código: o de `leitura.py` (nomes e docstrings em português, regex no topo do módulo).
- Rodar os testes em `backend/`: `.venv/Scripts/python -m pytest -q`. Os 56 atuais continuam passando, exceto o ajuste previsto na Tarefa 6.
- Um commit por tarefa, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Pontos de atenção na revisão

1. **Descrição que atravessa a página** (Nubank, BB): a continuação no topo da página seguinte precisa ir para o último lançamento, não para o cabeçalho nem para o próximo. É testado nas Tarefas 3 e 4.
2. **Valor zero ou "-R$ 0,00"** em linhas de saldo do Inter e do Bradesco: o sinal de zero não pode quebrar a cadeia. Fica a cargo de `cadeia_quebras` (Tarefa 1), com tolerância de R$ 0,005.
3. **Período com virada de ano sem ano nas datas** (C6 dez→jan; genérico com "de 15/12/2025 a 15/01/2026"): cada mês recebe o ano certo. É testado nas Tarefas 2 e 5.
4. **Dois arquivos com senha no mesmo envio,** sendo que um é pulado: os outros arquivos e o que recebeu a senha continuam e o extrato abre. É testado na Tarefa 7 (jsdom).
5. **PDF corrompido ou que não é PDF** (ex.: `b"%PDF"` ou um `.pdf` que na verdade é texto): mostra a mensagem do PDF escaneado, nunca um erro interno. É testado na Tarefa 1.

---

### Tarefa 1: base — abrir, limites, senha, recusas e ajudante de PDF falso

**Arquivos:**
- Criar: `backend/leitura_pdf/__init__.py`, `backend/leitura_pdf/comum.py`, `backend/tests/pdf_falso.py`, `backend/tests/test_leitura_pdf.py`
- Modificar: `backend/requirements.txt` (`pdfplumber>=0.11`, `cryptography>=42`, `pypdf>=4`)

**Interfaces (produz):**
- `comum.py`:
  - `class SenhaNecessaria(ErroLeitura)` e `class SenhaIncorreta(ErroLeitura)`. `ErroLeitura` vem de `leitura`; o import circular é evitado porque `leitura.py` só importa o pacote dentro de `ler_arquivo`.
  - `@dataclass Palavra(texto, x0, x1, top, bottom, cor)`, `@dataclass Pagina(linhas: list[str], palavras: list[Palavra])` e `@dataclass Doc(paginas: list[Pagina])`, com a propriedade `Doc.texto` (todas as linhas unidas por `\n`).
  - `abrir(conteudo: bytes, senha: str | None) -> Doc`: aplica os limites, a senha e a extração. As linhas vêm de `extract_text()` com `\xa0`→espaço e `strip()`. As palavras vêm de `extract_words(extra_attrs=["non_stroking_color"])`, com a cor como tupla ou `None`.
  - `valor_br(s: str) -> float`: aceita `1.234,56`, `R$ 1.234,56`, `-R$ 3,00` e `- 850,00`. Ignora `+`.
  - `cadeia_quebras(itens: list[tuple[float, float]]) -> list[int]`: recebe pares `(valor, saldo)` e devolve os índices `i≥1` onde `saldo[i-1] + valor[i]` difere de `saldo[i]` em mais de 0,005.
  - `MENSAGENS`: um dicionário com as mensagens da Parte 1 da especificação (`sem_texto`, `vazio`, `fatura`, `grande`, `desconhecido`, `confira`, `nao_bateu`).
- `__init__.py`: `ler_pdf(conteudo: bytes, senha: str | None = None) -> tuple[list[dict], str | None]`. Nesta tarefa ele só abre, aplica as recusas e, sem perfil, devolve `ErroLeitura(MENSAGENS["desconhecido"])`. A lista de perfis `PERFIS = []` é preenchida nas próximas tarefas.
- `tests/pdf_falso.py`:
  - `pdf(paginas: list[list[tuple]], senha: str | None = None) -> bytes`: cada item é `(x, y, texto)` ou `(x, y, texto, (r, g, b))`, com `y` medido a partir do topo e página A4 de 595×842. Escreve um PDF mínimo à mão, com Helvetica e `WinAnsiEncoding` (acentos e `•` mapeados para cp1252). Com senha, criptografa via `pypdf.PdfWriter.encrypt`.
  - `pdf_linhas(paginas: list[list[str]], **kw) -> bytes`: atalho que põe uma linha de texto a cada 14 pt, em `x=40`.

- [ ] **Passo 1: testes em `test_leitura_pdf.py`**
  - `test_pdf_falso_e_lido`: `abrir(pdf_linhas([["Olá mundo 1,00"]]), None).paginas[0].linhas == ["Olá mundo 1,00"]`, e a cor de uma palavra criada com `(1,0,0)` é `(1, 0, 0)`.
  - `test_senha`:
    - `pdf_linhas(..., senha="123")` sem senha levanta `SenhaNecessaria`;
    - com `"999"` levanta `SenhaIncorreta`;
    - com `"123"` abre.
  - `test_limites`: `b"x" * (15*1024*1024 + 1)` levanta `ErroLeitura` com a mensagem `grande`. Um PDF com 301 páginas também.
  - `test_recusas` (todas via `ler_pdf`):
    - PDF sem texto (página vazia) → `sem_texto`;
    - texto "Não há transações no período selecionado." → `vazio`;
    - "Vencimento" + "Pagamento mínimo" → `fatura`;
    - `b"%PDF"` e `b"nao sou pdf"` → `sem_texto`.
  - `test_valor_br` e `test_cadeia_quebras`: incluem `-R$ 0,00` e uma quebra na posição 2.
- [ ] **Passo 2:** `.venv/Scripts/python -m pip install -r requirements.txt` e depois rodar `pytest -q tests/test_leitura_pdf.py`. Esperado: FAIL (módulo inexistente).
- [ ] **Passo 3:** implementar o descrito em Interfaces. Exceções do pdfplumber/pdfminer ao abrir (fora a de senha) viram `ErroLeitura(MENSAGENS["sem_texto"])`. A senha errada é detectada pela exceção de senha do pdfminer: com `senha` vazia/None, `SenhaNecessaria`; com `senha` dada, `SenhaIncorreta`.
- [ ] **Passo 4:** `pytest -q`. Esperado: os testes novos passam e os 56 antigos também.
- [ ] **Passo 5:** commit "Base da leitura de PDF: abrir, senha, limites e recusas".

---

### Tarefa 2: perfis C6 e Inter (jeito "linha")

**Arquivos:** criar `backend/leitura_pdf/c6.py` e `backend/leitura_pdf/inter.py`; modificar `__init__.py` (`PERFIS`) e `test_leitura_pdf.py`.

**Interfaces:**
- Consome: `Doc`, `valor_br`, `cadeia_quebras` e `MENSAGENS` da Tarefa 1.
- Produz, em cada perfil: `reconhece(doc) -> bool` e `ler(doc) -> tuple[list[dict], str | None]`, com a lista de lançamentos e o aviso. **Todos os perfis seguem essa interface.**

- [ ] **Passo 1: testes**, com PDFs falsos que imitam os layouts da especificação.
  - **C6:**
    - Cabeçalhos "Dezembro 2025 ( 01/12/2025 - 31/12/2025 ) Entradas: R$ 100,00 • Saídas: R$ 30,00" e "Janeiro 2026 (…)" com as linhas `DD/MM DD/MM Tipo Descrição -R$ x`.
    - "Saldo do dia 03/12/25 …" é ignorado.
    - O rodapé contém "C6 Bank".
    - Esperado: datas `2025-12-…` e `2026-01-…`, a primeira data é a usada, a descrição "Pix enviado para X" sem o Tipo e "Débito de Cartão MOB" com o Tipo.
    - Totais certos dão aviso `None`. Total errado em um mês dá o aviso `nao_bateu`, contendo "Dezembro 2025" e a diferença formatada (ex.: "R$ 10,00").
  - **Inter:**
    - "Instituição: Banco Inter", cabeçalhos "11 de Agosto de 2025 Saldo do dia: R$ 0,82" e linhas `Pix enviado: "Cp :18236120-JOAO" -R$ 10,00 R$ 0,82`.
    - Uma página que continua o dia sem cabeçalho e o rodapé "Fale com a gente".
    - Esperado: descrição "Pix enviado JOAO", cadeia fechando com aviso `None`, e uma linha com saldo adulterado gerando `nao_bateu`.
- [ ] **Passo 2:** rodar e ver FAIL.
- [ ] **Passo 3:** implementar.
  - **C6:** regex de linha `^(\d\d)/(\d\d) \d\d/\d\d (.+?) (-?R\$ ?[\d.]+,\d\d)$` e de cabeçalho como na sonda (`(\S+) (\d{4}) \( (\d\d)/(\d\d)/(\d{4}) - … Entradas: … . Saídas: …`). Tipo e descrição saem do texto do meio: o Tipo é o prefixo entre {"Saída PIX", "Entrada PIX", "Débito de Cartão", "Pagamento", "Outros gastos", "Devolução PIX", "Entradas"}, e o resto é a descrição.
  - **Inter:** regex de dia `^(\d{1,2}) de (\w+) de (\d{4}) Saldo do dia: (-?R\$ ?[\d.]+,\d\d)` e de linha `^(.+?): "(.*)" (-?R\$ …) (-?R\$ …)$`. O prefixo `Cp :\d+-` é removido. Conferência: `cadeia_quebras` mais o saldo do dia igual à última linha do dia.
  - Ordem em `PERFIS`: `[c6, inter]`.
- [ ] **Passo 4:** `pytest -q`. Esperado: todos passam.
- [ ] **Passo 5:** commit "Leitura de PDF: perfis C6 e Inter".

---

### Tarefa 3: perfil Nubank (jeito "valor no topo")

**Arquivos:** criar `backend/leitura_pdf/nubank.py`; modificar `comum.py` (função do jeito), `__init__.py` e `test_leitura_pdf.py`.

**Interfaces:**
- Produz, em `comum.py`: `ler_valor_no_topo(linhas: list[str], eh_cabecalho, eh_valor) -> list[tuple[contexto, desc, valor_str]]`. Uma linha com valor no fim abre o lançamento, e as linhas sem valor seguintes são anexadas a ele até o próximo valor ou cabeçalho. O Nubank passa as linhas de todas as páginas já sem o cabeçalho de página e o rodapé.

- [ ] **Passo 1: testes**, com um PDF falso de 2 páginas:
  - **Resumo:** "Saldo inicial 4,66", "Total de entradas +100,00", "Total de saídas -60,00", "Saldo final do período 44,66".
  - **Dias:** "05 OUT 2026 Total de entradas + 100,00" com uma transferência de 100,00 cuja descrição ocupa 2 linhas, e "Total de saídas - 60,00" numa linha sozinha com duas saídas.
  - **Quebra de página:** uma saída com a continuação "Conta: 123" no topo da página 2, depois do cabeçalho de página que termina em "VALORES EM R$".
  - **Linha curta:** "Pagamento de fatura 20,00".
  - **Esperado:**
    - 3 lançamentos com os sinais certos;
    - a descrição "Transferência enviada pelo Pix DISQUE FEIRA", cortada antes de " - 96.714.530/0001-70 - STONE…";
    - o "Pagamento de fatura" com a própria descrição;
    - aviso `None`.
  - **Variações:** com o resumo adulterado, aviso `nao_bateu`; com o total de uma seção adulterado, também.
- [ ] **Passo 2:** rodar e ver FAIL.
- [ ] **Passo 3:** implementar.
  - Reconhece por (`Nu Pagamentos` ou `Nu Financeira`) e `VALORES EM R$`.
  - Dia: `^(\d\d) (JAN|…|DEZ) (\d{4}) Total de (entradas|saídas) ([+-]) ?([\d.]+,\d\d)$`. Seção: `^Total de (entradas|saídas) ([+-]) ?([\d.]+,\d\d)$`.
  - Rodapé: as linhas que começam com os prefixos da sonda e a linha exatamente igual a "Pagamento", que é a quebra de "Nu Pagamentos S.A. - Instituição de / Pagamento".
  - Corte da descrição: regex ` - (?:•••\.\d{3}\.\d{3}-••|\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}|\d{2}\.\d{3}\.\d{3}\s*/\d{4}-\d{2}).*$`. O caso `51.382.388 /0001-73`, que quebra a linha no meio do CNPJ, também é cortado.
  - Conferências: soma de cada seção = total da seção; totais = resumo; saldo inicial + entradas − saídas = saldo final.
- [ ] **Passo 4:** `pytest -q`. Esperado: todos passam.
- [ ] **Passo 5:** commit "Leitura de PDF: perfil Nubank".

---

### Tarefa 4: perfis Bradesco Celular e Banco do Brasil (jeito "célula centralizada")

**Arquivos:** criar `backend/leitura_pdf/bradesco.py` e `backend/leitura_pdf/bb.py`; modificar `comum.py`, `__init__.py` e `test_leitura_pdf.py`.

**Interfaces:**
- Produz, em `comum.py`: `ler_celulas(pagina: Pagina, topo: float, base: float, eh_linha_valor: callable, x_texto_min: float) -> list[dict]`.
  1. Agrupa as palavras entre `topo` e `base` em linhas (por `round(top/2)`).
  2. As linhas aceitas por `eh_linha_valor(palavras_ordenadas)` viram registros `{"y", "palavras"}`.
  3. As outras palavras com `x0 >= x_texto_min` vão para o registro de `y` mais próximo, em `registro["texto"]`, ordenadas por (top, x0).
- Perfis BB e Bradesco: os mesmos `reconhece` / `ler` da Tarefa 2.

- [ ] **Passo 1: testes**, com PDFs falsos posicionados.
  - **Bradesco:**
    - "Bradesco Celular" e o cabeçalho com "Crédito (R$)", "Débito (R$)" e "Saldo (R$)" em x≈397/463/529.
    - Lançamentos com o histórico em 2 linhas: uma 4 pt acima e outra 4 pt abaixo do valor.
    - O valor na coluna Débito, o saldo em vermelho `(1,0,0)` e a data só na primeira linha do dia.
    - Uma linha "Total" com créditos e débitos.
    - Esperado: sinais pela coluna, saldo vermelho negativo, cadeia fechando, descrição "PIX QR CODE DINAMICO DES: DISQUE FEIRA 06/09" sem o número do documento, data herdada e aviso `None`. Com "Total" adulterado, aviso `nao_bateu`.
  - **BB:**
    - "Extrato de Conta Corrente" e o cabeçalho "Dia Lote Documento Histórico Valor".
    - "Saldo Anterior 23,66 (+)".
    - Histórico acima, na linha e abaixo do valor, em 3 posições.
    - "Saldo do dia … (+)" e "S A L D O", seguidos de "Aplicações Financeiras / BB Reserva 40,21", que é ignorado.
    - Esperado: lançamentos com o histórico certo, sinais por `(+)/(-)`, saldos conferindo e aviso `None`. Com um "Saldo do dia" adulterado, aviso `nao_bateu`.
- [ ] **Passo 2:** rodar e ver FAIL.
- [ ] **Passo 3:** implementar como nas sondas `bradesco_sonda2.py` e `bb_sonda2.py`, usando `ler_celulas`.
  - Bradesco: a coluna de cada número é o centro x mais próximo entre os cabeçalhos; o documento `^\d{5,}$` sai da descrição.
  - BB: a linha de valor tem a data em `x` da coluna Dia e o padrão número + `(+)`/`(-)`. Os registros "Saldo Anterior", "Saldo do dia" e "S A L D O" são conferências.
- [ ] **Passo 4:** `pytest -q`. Esperado: todos passam.
- [ ] **Passo 5:** commit "Leitura de PDF: perfis Bradesco Celular e Banco do Brasil".

---

### Tarefa 5: perfil genérico

**Arquivos:** criar `backend/leitura_pdf/generico.py`; modificar `__init__.py` (o genérico fica por último em `PERFIS`, e `reconhece` sempre devolve `True`) e `test_leitura_pdf.py`.

**Interfaces:**
- Consome os três jeitos (`ler_celulas`, `ler_valor_no_topo` e o jeito "linha"), além de `cadeia_quebras` e `MENSAGENS`.
- Produz: `ler(doc)`, que segue a ordem e as regras 1 a 8 do "Perfil genérico" da especificação.

- [ ] **Passo 1: testes**, um por regra.
  - **Linha:** `05/08 PIX JOAO 150,00-`, `06/08 SALARIO 3.000,00 C` e `07/08 TARIFA 10,00 D`, com "Período: 01/08/2026 a 31/08/2026". Esperado: aceito, ano 2026, sinais certos e aviso `confira`.
  - **Virada de ano:** "de 15/12/2025 a 15/01/2026" com `20/12 …` e `05/01 …`. Esperado: 2025-12-20 e 2026-01-05.
  - **Coluna de saldo:** tabela com Data · Histórico · Valor · Saldo e cadeia fechando. Esperado: aceito e aviso `None`.
  - **Sinal invertido:** com uma linha de sinal invertido que fecha ao inverter, o sinal é corrigido e o aviso é `None`.
  - **Recusas:**
    - cadeia que não fecha → `ErroLeitura(MENSAGENS["desconhecido"])`;
    - valores sem sinal e sem saldo → `desconhecido`;
    - mais de 10% das linhas com data e valor sem leitura → `desconhecido`.
- [ ] **Passo 2:** rodar e ver FAIL.
- [ ] **Passo 3:** implementar. Para reaproveitar código, o genérico chama as funções de `comum.py`. O "jeito linha" genérico usa o regex `^(\d{2}/\d{2}(?:/\d{2,4})?)\s+(.+?)\s+(-?R?\$?\s?-?[\d.]+,\d{2})\s*(-|\(?[+-]\)?|[DC])?(?:\s+(-?[\d.]+,\d{2})\s*([DC])?)?$`, com o segundo número opcional sendo o saldo.
- [ ] **Passo 4:** `pytest -q`. Esperado: todos passam.
- [ ] **Passo 5:** commit "Leitura de PDF: perfil genérico com conferência pelo saldo".

---

### Tarefa 6: ligação com `/api/leitura` e estornos "devolvido"

**Arquivos:** modificar `backend/leitura.py`, `backend/rotas/leitura.py`, `backend/categorizacao.py` (`PALAVRAS_ESTORNO`), `backend/tests/test_api.py` e `backend/tests/test_categorizacao.py`.

**Interfaces:**
- `leitura.ler_arquivo_com_aviso(nome, conteudo, senha=None) -> tuple[list[dict], str | None]`: para `.pdf`, chama `ler_pdf`. Para os outros formatos, `(ler_arquivo(nome, conteudo), None)`. `ler_arquivo` continua existindo, sem a recusa de PDF.
- A rota lê `request.form.get("senha")`.
  - Item com sucesso: `{"nome", "lancamentos", "aviso"?}`.
  - Item com `SenhaNecessaria`: `{"nome", "erro": str(e), "codigo": "senha"}`.
  - Item com `SenhaIncorreta`: `{"nome", "erro", "codigo": "senha_incorreta"}`.

- [ ] **Passo 1: testes**
  - `test_api.py`: `test_pdf_com_senha_pede_senha`. Envia um PDF falso com senha, no layout C6, e confere:
    - sem senha: `codigo == "senha"`, sem a chave `lancamentos`, e a senha não aparece em `r.get_data(as_text=True)`;
    - com `senha` errada: `senha_incorreta`;
    - com a certa: lançamentos.
  - Ajustar `test_leitura_de_varios_formatos`: `arqs["extrato.pdf"]["erro"]` passa a ser a mensagem `sem_texto`, e não mais "PDF ainda não é aceito".
  - `test_categorizacao.py`: `("pf", "Pix enviado devolvido UBER")` com valor positivo → `estorno is True`. `"Pix-Envio devolvido 99 TECNOLOGIA"` também.
- [ ] **Passo 2:** rodar e ver FAIL.
- [ ] **Passo 3:** implementar.
  - `PALAVRAS_ESTORNO` ganha `"devolvid"`.
  - Em `ler_arquivo_com_aviso`, o import de `leitura_pdf` fica dentro da função.
- [ ] **Passo 4:** `pytest -q`. Esperado: todos passam.
- [ ] **Passo 5:** commit "Envio aceita PDF, com senha e avisos".

---

### Tarefa 7: tela, conferência com os PDFs reais, README e roteiro

**Arquivos:** modificar `frontend/js/api.js` (`lerArquivos(arquivos, perfil, senha)`), `frontend/js/painel.js` (`readFiles`), `frontend/index.html` (texto do formato PDF), `frontend/css/estilo.css` e `README.md`. Criar, **fora do projeto**, no scratchpad: `conferir_pdfs_reais.py` e um teste jsdom `senha.js`.

**Interfaces:**
- `API.lerArquivos(arquivos, perfil, senha)`: envia `senha` só quando ela é informada.
- `readFiles(files, perfil)` vira duas fases:
  - (a) envia o lote e guarda `state.leitura = {perfil, arquivos: [{file, resultado}]}`;
  - (b) `concluirLeitura()`, que é a parte atual depois da resposta, roda quando nenhum item tem `codigo` pendente.
  - Item com `codigo`: na lista `#upFiles`, aparece um formulário `.pdf-senha` com `input[type=password]`, **[Abrir]** e [Pular este arquivo]. Abrir reenvia só aquele arquivo com a senha e substitui o resultado. Pular remove o item. Com `senha_incorreta`, a mensagem "Senha incorreta. Tente de novo." aparece no formulário.
  - Item com `aviso`: mostra o aviso na linha do arquivo e dispara `toast` depois de abrir.
- `index.html`: o item do formato PDF vira `<span class="fmt ok">PDF</span>` com o texto da especificação.

- [ ] **Passo 1: teste jsdom** (`senha.js`, fora do projeto). Com uma API falsa que responde `codigo:"senha"` para "c6.pdf" e lançamentos para "outro.csv", confere:
  - aparece o formulário só para "c6.pdf";
  - a senha errada mostra a mensagem;
  - a senha certa conclui e carrega os dois arquivos;
  - em outro cenário com 2 PDFs protegidos, pular um e abrir o outro conclui (ponto de atenção 4);
  - o aviso aparece na lista.

  Rodar e ver FAIL.
- [ ] **Passo 2:** implementar a tela, o CSS (`.pdf-senha` em linha com gap, botões pequenos, mensagem em `--bad`) e o texto de formatos. `node --check frontend/js/painel.js`, depois rodar `senha.js` e ver PASS.
- [ ] **Passo 3: conferência com os reais.** `conferir_pdfs_reais.py` roda `leitura_pdf.ler_pdf` em cada arquivo de `backend/dados/pdfs-exemplo/`, pede a senha do C6 com `getpass`, compara com a tabela "Conferência com os extratos reais" da especificação e imprime só as contagens e os totais, **sem descrições**. Esperado: tudo bate e nenhum aviso.
- [ ] **Passo 4:** README: na seção de formatos, uma linha sobre o PDF (bancos com conferência, senha, limites), e o número de testes atualizado.
- [ ] **Passo 5:** `pytest -q`, `node --test frontend/tests` e `node --check frontend/js/painel.js`. Esperado: tudo passa. Commit "Tela pede a senha do PDF e mostra os avisos". Na mensagem final ao usuário vai o roteiro manual da especificação.
