# Leitura de extrato em PDF

Data: 02/11/2026 · Situação: aprovado em conversa, aguardando revisão deste documento

## Objetivo

No celular, o formato que todo banco oferece é o **PDF**. OFX e CSV costumam ficar escondidos, ou só existem no internet banking pelo computador. O site passa a aceitar o extrato da conta em PDF, **sem custo e sem os dados saírem do servidor**.

**Regra de ouro:** o site **nunca mostra números errados calado**. Todo PDF lido passa por uma conferência (totais impressos ou saldo). Se a conferência não fechar, ou se não houver como conferir e o sinal dos valores for duvidoso, o PDF é recusado com uma mensagem clara.

**Fora do escopo:**
- PDF escaneado ou foto (precisaria de reconhecimento de imagem);
- fatura de cartão de crédito;
- Open Finance;
- tratar aplicação e resgate de investimento como movimento interno (fica anotado para depois).

## Bancos e garantia

Cinco formatos foram estudados com **extratos reais**. Eles estão em `backend/dados/pdfs-exemplo/`, pasta ignorada pelo git, e nunca entram no projeto nem nos testes.

| Banco | Como o PDF é montado | Conferência | Garantia |
|---|---|---|---|
| **C6** | uma linha por lançamento: `01/08 03/08 Saída PIX Pix enviado para X -R$ 300,00`; ano no cabeçalho do mês; **tem senha** | entradas e saídas de cada mês = totais do cabeçalho do mês | real |
| **Inter** | cabeçalho por dia (`11 de Agosto de 2025 Saldo do dia: R$ 0,00`); linha `Tipo: "texto" -R$ 299,99 -R$ 299,99` (valor e saldo) | cadeia de saldos linha a linha e "Saldo do dia" | real |
| **Nubank** | cabeçalho por dia (`05 OUT 2026 Total de entradas + 1.071,47`); seções "Total de entradas" / "Total de saídas" dão o sinal; valor sem sinal na **primeira** linha da descrição, com a continuação embaixo | soma de cada seção = "Total de…"; total geral = resumo do topo; saldo inicial + entradas − saídas = saldo final | real |
| **Bradesco** (formato "Bradesco Celular") | tabela Data · Histórico · Docto. · Crédito · Débito · Saldo; **valores sem sinal** (o sinal vem da coluna); **saldo negativo só pela cor vermelha**; data só na primeira linha do dia; histórico centralizado na célula | crédito e débito = linha "Total"; cadeia de saldos usando a cor | real |
| **Banco do Brasil** (formato "Dia Lote Documento Histórico Valor") | sinal `(+)`/`(-)` depois do valor; histórico centralizado na célula; "Saldo Anterior", "Saldo do dia" e "S A L D O" | Saldo Anterior + lançamentos = cada "Saldo do dia" e o "S A L D O" final | real |
| **Mercado Pago** (acrescentado depois) | tabela Data · Descrição · ID da operação · Valor · Saldo; data com traço (`01-10-2026`); valor com sinal depois do "R$"; descrição centralizada, às vezes continuando na página seguinte; nem toda página repete o cabeçalho | cadeia de saldos desde o saldo inicial; entradas e saídas do resumo; saldo final | real |
| **Itaú, Caixa, Santander e outros** | perfil genérico (ver abaixo) | saldo, quando houver coluna de saldo | sem extrato real; recusa se não fechar |

## Parte 1: o que a pessoa vê na tela

**Formatos aceitos,** na tela inicial: "**PDF** · Aceito. Lido com conferência no C6, Inter, Nubank, Bradesco e Banco do Brasil; nos outros bancos, em teste."

**PDF com senha:** aparece uma caixinha logo abaixo daquele arquivo:
> 🔒 **"nome.pdf" tem senha.** Digite a senha do PDF (o banco informa qual é, ao gerar o extrato).
> `[ senha ]` **[Abrir]** [Pular este arquivo]

- Com a senha errada, a caixinha mostra "Senha incorreta. Tente de novo." e continua aberta.
- Com vários arquivos, cada PDF protegido ganha a sua caixinha, e os outros arquivos seguem normalmente.
- A senha só é usada para abrir o arquivo naquele envio. Ela não é guardada nem entra em mensagem de erro ou registro.

**Mensagens:**

| Situação | Mensagem |
|---|---|
| Banco conhecido, conferência fechando | nenhuma: abre como um OFX |
| Banco conhecido, conferência **não** fechando | ⚠️ "A soma não bateu com os totais do banco (diferença de R$ X em [mês/dia]). Algum lançamento pode ter ficado de fora. Se puder, exporte em OFX." O extrato abre com esse aviso. |
| Genérico lido **com** conferência pelo saldo | nenhuma |
| Genérico lido **sem** como conferir (sinal explícito, sem coluna de saldo) | ℹ️ "Lemos este PDF pelo formato geral. Confira se o total de entradas e saídas bate com o seu extrato." |
| Genérico sem fechar, ou com sinal duvidoso | ❌ "Ainda não conhecemos este formato de PDF. Exporte em OFX ou CSV" + link para "Como exportar do seu banco". |
| PDF sem texto (escaneado ou foto) | ❌ "Não consegui ler os lançamentos deste PDF. Ele pode ser uma foto ou um formato que ainda não conhecemos. Exporte em OFX ou CSV" + link. |
| Extrato sem nenhum lançamento | ❌ "Este extrato não tem lançamentos no período escolhido. Gere de novo no app do banco com um período maior." |
| Fatura de cartão | ❌ "Este PDF parece uma fatura de cartão de crédito. Por enquanto lemos só extratos da conta." |
| Arquivo grande demais | ❌ "Este PDF é grande demais (limite de 15 MB e 300 páginas). Gere um período menor." |

## Parte 2: como o leitor funciona

**Arquivos:**
- `backend/leitura_pdf/`: um pacote novo, com `__init__.py` (entrada e orquestração), um arquivo por perfil (`c6.py`, `inter.py`, `nubank.py`, `bradesco.py`, `bb.py`, `generico.py`) e `comum.py` (valores, datas, linhas e palavras com posição, conferências).
- `backend/leitura.py` só passa a mandar os `.pdf` para o pacote.

**Fluxo de `ler_pdf(conteudo, senha=None) -> (lancamentos, aviso | None)`:**
1. **Limites:** mais de 15 MB ou mais de 300 páginas são recusados.
2. **Abrir.** Se o PDF tem senha e ela não veio, levanta `SenhaNecessaria`. Se veio errada, levanta `SenhaIncorreta`. As duas são subclasses de `ErroLeitura`.
3. **Extrair** de cada página o texto em linhas e as palavras com posição (`x0`, `x1`, `top`, `bottom`) e cor de preenchimento. O espaço não separável (`\xa0`) vira espaço comum.
4. **Recusar** quando:
   - não há texto nenhum: mensagem do PDF escaneado;
   - aparece "Não há transações no período": mensagem do extrato vazio;
   - há "vencimento" junto com "pagamento mínimo" ou "limite total": mensagem da fatura.
5. **Escolher o perfil.** Cada perfil tem `reconhece(doc) -> bool` e `ler(doc) -> Resultado(lancamentos, conferencia_ok, aviso)`. Os perfis são testados em ordem (C6, Inter, Nubank, Bradesco, BB) e o genérico é sempre o último.
6. Devolver os lançamentos no formato de sempre, `{"data": "AAAA-MM-DD", "descricao", "valor"}` em ordem de data, junto com o aviso.

**Reconhecimento:**

| Perfil | Reconhece pelo texto |
|---|---|
| C6 | "C6 Bank" |
| Inter | "Instituição: Banco Inter" |
| Nubank | ("Nu Pagamentos" ou "Nu Financeira") e "VALORES EM R$" |
| Bradesco | "Bradesco Celular" e o cabeçalho "Crédito (R$)", "Débito (R$)", "Saldo (R$)" |
| BB | "Extrato de Conta Corrente" e o cabeçalho "Dia Lote Documento Histórico Valor" |

**Os três jeitos de ler** (funções em `comum.py`, usadas pelos perfis e pelo genérico):

| Jeito | Para quem | Como |
|---|---|---|
| **Linha** | C6, Inter | cada linha de texto com valor é um lançamento |
| **Valor no topo** | Nubank | a linha com valor abre o lançamento; as linhas sem valor que vêm depois, até o próximo valor ou cabeçalho, continuam a descrição, inclusive na página seguinte |
| **Célula centralizada** | Bradesco, BB | por posição: as linhas com valor (e data, quando houver) viram lançamentos; cada palavra da coluna de histórico vai para o lançamento **mais próximo na vertical**; o sinal vem da coluna (Crédito/Débito), do `(+)/(-)` ou do `-`; o saldo sem sinal fica negativo quando a cor é vermelha `(1, 0, 0)` |

**Detalhes por perfil:**
- **C6:**
  - usa a primeira das duas datas (a do lançamento);
  - o ano vem do cabeçalho "Mês AAAA ( DD/MM/AAAA - … )", o que funciona na virada de ano;
  - ignora "Saldo do dia";
  - a descrição é a coluna Descrição, com o Tipo na frente só quando a Descrição não começa com "Pix" (ex.: "Débito de Cartão MOB PARKING").
- **Inter:**
  - a data vem do cabeçalho do dia;
  - a descrição vira `Tipo texto`, sem as aspas e sem o prefixo `Cp :NNNNNNNN-`;
  - ignora o rodapé "Fale com a gente…".
- **Nubank:**
  - o sinal vem da seção;
  - ignora o cabeçalho de cada página (até "VALORES EM R$"), o rodapé e "Movimentações";
  - a descrição é cortada no primeiro ` - ` seguido de CPF/CNPJ (`•••.ddd.ddd-••` ou `dd.ddd.ddd/dddd-dd`). Assim fica "Transferência enviada pelo Pix MERCADINHO MODELO", e o banco de destino ("STONE", "PAGSEGURO") não confunde a categorização.
- **Bradesco:**
  - a data é herdada nas linhas seguintes do mesmo dia;
  - o número do documento sai da descrição;
  - a linha "Total" vira conferência e não é lançamento.
- **BB:**
  - "Saldo Anterior", "Saldo do dia" e "S A L D O" viram conferência e não são lançamentos;
  - ignora tudo a partir de "Aplicações Financeiras";
  - lote e documento saem da descrição.

**Perfil genérico:**
1. Tenta os três jeitos, nesta ordem: célula centralizada, quando há um cabeçalho com "Crédito" e "Débito" ou uma coluna "Saldo"; depois linha; depois valor no topo.
2. Data no começo da linha (`DD/MM/AAAA`, `DD/MM` ou `DD MMM AAAA`), ou herdada da linha anterior.
3. Sinal por `-1,00`, `1,00-`, `1,00 D`/`C`, `1,00D`, `(+)`/`(-)` ou coluna.
4. Ano pela própria data, por um cabeçalho com mês e ano ou pelo período escrito no PDF ("de DD/MM/AAAA a DD/MM/AAAA"), com cada mês recebendo o ano certo na virada.
5. Ignora as linhas que contêm "saldo".
6. **Com coluna de saldo:** a cadeia de saldos precisa fechar em todas as linhas. Se só fechar invertendo o sinal de uma linha, o sinal é corrigido. Se não fechar, aquele jeito é descartado.
7. **Sem coluna de saldo:** só aceita se todo valor tiver sinal explícito, e devolve o aviso de "confira".
8. Se nenhum jeito passar, ou se sobrarem mais de 10% das linhas com data e valor sem leitura, o PDF é recusado.

**Estornos:** as devoluções de PIX aparecem como "Pix enviado devolvido" (Inter) e "Pix-Envio devolvido" (BB). `PALAVRAS_ESTORNO` (em `categorizacao.py`) ganha `devolvid`, para que essas entradas descontem da categoria, como os outros estornos.

**Ligação com o site:**
- `POST /api/leitura` aceita o campo opcional `senha`. A tela só manda a senha ao reenviar um único PDF pela caixinha.
- Para cada arquivo, a resposta pode trazer `aviso` (junto com os lançamentos) ou `codigo: "senha" | "senha_incorreta"` (junto com o `erro`, sem lançamentos). A senha nunca volta na resposta.
- `ler_arquivo` continua devolvendo a lista para os outros formatos. A rota usa uma função nova, `ler_arquivo_com_aviso(nome, conteudo, senha=None) -> (lista, aviso)`.
- Dependências novas em `requirements.txt`: `pdfplumber` e `cryptography`, para leitura e senha, e `pypdf`, só para os testes criarem PDFs com senha. O `instalar.bat` já instala pelo `requirements.txt`.

## Parte 3: testes

**Os extratos reais nunca entram nos testes nem no git.** Os testes automáticos usam PDFs inventados, gerados por um ajudante (`backend/tests/pdf_falso.py`). Ele escreve um PDF simples com texto **em posição e cor escolhidas**, para imitar cada layout, e usa o `pypdf` para colocar senha.

**Testes do servidor** (escritos antes do código):

| Teste | O que confere |
|---|---|
| C6 | Dois meses com virada dez→jan e totais certos dão os lançamentos certos e nenhum aviso. Com o total errado, sai o aviso com o mês e a diferença. "Saldo do dia" é ignorado. |
| Inter | Cabeçalho por dia, aspas e "Cp :…" removidos, cadeia de saldos fechando. Uma linha adulterada gera o aviso. O rodapé é ignorado. |
| Nubank | Seções dão o sinal, a descrição continua embaixo (inclusive na página seguinte), a descrição é cortada no CPF/CNPJ e as três conferências passam. |
| Bradesco | O sinal vem da coluna, o saldo vermelho é negativo, a data é herdada, o histórico em duas linhas cai no lançamento certo e a linha "Total" confere. |
| BB | `(+)/(-)`, histórico centralizado (acima, no meio e abaixo da linha do valor), "Saldo do dia" confere e "Aplicações Financeiras" é ignorado. |
| Genérico | Linha com `150,00-` / `D` / `C` aceita com o aviso de "confira". Coluna de saldo com cadeia fechando é aceita sem aviso. Um sinal invertido é corrigido pela cadeia. Cadeia que não fecha e PDF sem sinal nem saldo são recusados. |
| Recusas | PDF sem texto, extrato vazio, fatura de cartão e arquivo acima do limite dão as mensagens da Parte 1. |
| Senha | Sem senha: `SenhaNecessaria`. Senha errada: `SenhaIncorreta`. Senha certa: lê normalmente. |
| `/api/leitura` | Um PDF com senha volta com `codigo: "senha"` e sem lançamentos. Com a senha, volta com lançamentos. A senha não aparece na resposta. |
| Estornos | "Pix enviado devolvido" (entrada) é marcado como estorno. |
| Testes atuais | Os 56 continuam passando. O que hoje espera "PDF ainda não é aceito" passa a esperar a mensagem nova. |

**Conferência com os extratos reais:** um script fora do projeto pede as senhas na hora e espera estes números:

| Arquivo | Esperado |
|---|---|
| `c6.pdf` | 941 lançamentos; agosto: entradas 196.186,83 e saídas 173.469,43; setembro: entradas 124.453,84 e saídas 150.878,25; nenhum aviso |
| `inter.pdf` | 262 lançamentos; nenhum aviso |
| `nubank.pdf` | 42 lançamentos; entradas 2.479,67 e saídas 2.481,63; nenhum aviso |
| `bradesco.pdf` | 14 lançamentos; créditos 52,93 e débitos 55,69; nenhum aviso |
| `bb.pdf` | 59 lançamentos; nenhum aviso |

**Tela:** checagem de sintaxe e teste com o DOM de verdade (jsdom, fora do projeto) do fluxo da caixinha de senha (pedir, errar, acertar, pular) e da exibição dos avisos.

**Roteiro manual:** enviar no navegador os PDFs reais, com o tipo de conta certo (C6 como Empresa ou MEI; os outros como Pessoa física), e conferir os totais no dashboard.

**Ordem de implementação** (um commit por passo):
1. Base: `comum.py`, `pdf_falso.py`, as recusas, os limites e a senha.
2. Perfis C6 e Inter.
3. Perfil Nubank.
4. Perfis Bradesco e BB (célula centralizada).
5. Perfil genérico.
6. Ligação com `/api/leitura`, estornos "devolvido" e `requirements.txt`.
7. Tela (caixinha de senha, avisos, texto de formatos), conferência com os reais, README e roteiro.
