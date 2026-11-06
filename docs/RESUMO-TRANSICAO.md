# Resumo de transição — sobrou. (antes Painel de Despesas)

Atualizado em 03/11/2026. **Redesenho em 3 etapas:** 1 identidade visual "sobrou." (ramo `identidade-visual`, especificação `docs/superpowers/specs/2026-11-03-identidade-visual-design.md`), 2 arrumação das telas, 3 celular e PWA. Leia isto primeiro ao abrir um novo chat. A memória do Claude Code deste projeto (`C:\Users\CAIO\.claude\projects\c--Users-CAIO-Desktop-dados-site\memory\`) também tem estas informações.


> **ONDE PARAMOS (06/11/2026):** o **novo Período** (etapa 2, parte 5) está no `main` (`ff03e8d`): atalhos (Todo o extrato, Último mês), **Personalizado…** (Últimos 3/6 meses, Este ano, anos, meses inteiros ou dias exatos, com "média de 30 dias") e **Comparar…** no Dashboard, Despesas e Lançamentos (a comparação continua ao trocar de página). Faixa de meses em caixa própria abaixo do Período; "Como funciona" isolado no canto superior direito, em balão que fecha no "×". Contas em `frontend/js/periodo.js` (testadas em `frontend/tests/periodo.test.js`); Vendas segue com o período antigo. Especificações `docs/superpowers/specs/2026-11-06-periodo-design.md` e `2026-11-06-comparar-paginas-design.md`. **Despesas "para onde foi o dinheiro"** (etapa 2, parte 6) está no `main` (`0037a29`): topo "Saiu R$ x por mês" com contas fixas × dia a dia, categorias que abrem (mês a mês com o mês mais caro, onde foi o dinheiro, ver lançamentos), Gastos mês a mês, O que mudou (mesmo par de meses do Dashboard, `parMeses`), Maiores gastos, Resumo, Comparar e 8 animações. Também no `main`: botão "Ajuda" (antes "Como funciona") em balão em todas as páginas, inclusive no Início; caixas Personalizado/Comparar fecham ao escolher um período e só o botão da caixa aberta fica destacado; sem faixa de meses em Lançamentos; Economia por último no menu. Contas em `frontend/js/despesas.js`; spec `docs/superpowers/specs/2026-11-06-despesas-design.md`. Testes no Chrome: o login dos testes é por fetch (enviar o formulário faz o Chrome mostrar "Salvar senha?" e trava os cliques). Animações do Início também no `main` (cartão do último extrato, seta de enviar, borda que anda, reflexo no botão, extrato levanta, pastas, sublinhado em "sobra", balão de Ajuda que brota, busca que destaca; a busca só aparece com 10+ extratos). Próximo: Organizar e a etapa 3 (celular e PWA).

---

## 1. Objetivo geral

Um site (e no futuro um app de celular) que lê o **extrato bancário** da pessoa e mostra **para onde vai o dinheiro**, de forma **direta e objetiva**.

- **Público:** pessoas **leigas e sem tempo**, que não querem passar horas analisando a vida financeira. Toda decisão de tela e de texto deve priorizar simplicidade.
- **Sem tipo de conta** (no `main` desde 03/11): a pessoa só envia o extrato e organiza tudo em **pastas livres** ("Empresa", "Casa"...). "Ver a pasta inteira" soma os extratos da pasta. As categorias são **uma lista só, com 25**. Antes havia Pessoa física (`pf`) e Empresa ou MEI (`empresa`).
- **Formatos aceitos:** OFX, CSV, Excel e, no ramo atual, **PDF**, que é o formato que todo app de banco oferece no celular.

**Regra de ouro da leitura de extratos:** o site **nunca mostra números errados calado**. Toda leitura é conferida (totais ou saldo impressos pelo banco). Se a conferência não fechar, o site avisa ou recusa.

---

## 2. Estado atual

### Projeto e ambiente
- **Pasta:** `C:\Users\CAIO\Desktop\dados_site`. Windows 11, com PowerShell e Git Bash.
- **Backend:** Python 3.15 + Flask + SQLite, em `backend/`. O ambiente virtual fica em `backend/.venv`.
- **Frontend:** JavaScript ES5 puro, sem build, em `frontend/` (`index.html`, `css/estilo.css`, `js/api.js`, `js/analise.js`, `js/painel.js`).
- **Ligar o site:** dar dois cliques em `iniciar.bat`, ou rodar `backend/.venv/Scripts/python -m flask --app app run --debug` dentro de `backend/`. O endereço é http://127.0.0.1:5000.
- **Testes:**
  - servidor: `cd backend && .venv/Scripts/python -m pytest -q` (114 passam no ramo `leitura-pdf`);
  - JS: `node --test frontend/tests` (27 passam).
- **GitHub:** https://github.com/vienercaio-blip/painel-despesas (privado). O login do git já funciona; `git push` roda sem pedir senha.

### Situação do git
- **`main`** e **`origin/main`** estão em `0604e09` (03/11/2026). Depois do movimento interno: em Lançamentos, o seletor de categoria tem "+ Criar nova categoria…" (vai para Organizar › Criar categoria e volta aplicando ao lançamento); em Organizar, escolher uma categoria abre "De onde veio"; e mudar de página sempre abre no topo (`irPara`/`chegou` no `painel.js`). Antes disso: `0b1ef64`. Último trabalho: **movimento interno** (aplicação, cofrinho e resgate ficam fora de Entrou/Saiu, com a linha "Você guardou"; entradas podem ser marcadas como "Transferências entre suas contas"). Especificação em `docs/superpowers/specs/2026-11-03-movimento-interno-design.md`; pendências pequenas na memória do projeto. Antes disso: `0d44b1f`. Depois do sem perfil saíram a opção de **mesclar** (juntar extratos agora é só com pastas) e o painel passou a mostrar o **total do período** em Entrou, Saiu e Sobrou, com a média por mês embaixo. Antes disso: `4f33b5d`, com a leitura de PDF e o "sem perfil" (pastas livres e lista única de categorias). Os ramos `leitura-pdf` e `sem-perfil` foram juntados e apagados.
- **Ignorados pelo git:** `backend/dados/` (banco `painel.db`, chave secreta, cópia de segurança do banco e os **PDFs reais** em `backend/dados/pdfs-exemplo/`), `.venv`, caches e `.superpowers/`.

### O que já foi feito e funciona

**Tipos de conta e categorias** (no `main`, especificação em `docs/superpowers/specs/2026-10-31-tipos-de-conta-design.md`)
- Só `pf` e `empresa`. O antigo `pme`/MEI vira `empresa` automaticamente ao ligar o servidor (`banco._converter_tipos_de_conta`).
- As categorias padrão têm **código fixo** (`pf:mercado`, `empresa:fornecedores`). As edições do cliente são guardadas pelo código, e as rotas são `/api/categorias-padrao/<perfil>/<codigo>`.
- **Pessoa física tem 17 categorias** (com Delivery, Pets, Compras online, Tarifas, Transferências para pessoas e outras). **Empresa ou MEI tem 13**. As listas ficam em `backend/categorizacao.py` (`REGRAS_PF`, `REGRAS_EMPRESA`, `PERFIS`, `CODIGOS_ANTIGOS`).
- **Estornos:** uma entrada com "estorno / estornad / devolucao / devolvid / reembolso / chargeback" vira `estorno: true`, recebe a categoria da despesa e **desconta da categoria**. Na tela, isso usa `ehEntrada(t)` e `ehSaida(t)` no `painel.js`.

**Dashboard "resposta primeiro"** (no `main`, especificação em `docs/superpowers/specs/2026-10-31-dashboard-resposta-primeiro-design.md`)
- A página vem nesta ordem:
  1. veredito colorido (verde, amarelo ou vermelho) com Entrou, Saiu e Sobrou;
  2. "O que fazer agora", com até 3 ações e a economia estimada;
  3. "Para onde vai o dinheiro", com barras e o seletor **"Despesas analisadas"** (Todas, 3 maiores, 5 maiores, sem fixas ou à escolha). **O filtro nunca muda o veredito, os números, as ações, o saldo nem a projeção**;
  4. mês a mês;
  5. "Ver mais detalhes", fechado por padrão.
- As contas ficam em `frontend/js/analise.js` (puro e testado). O desenho da página fica em `renderDashboard` no `painel.js`, e o objeto `TEXTOS` guarda os textos por tipo de conta.
- **Outras mudanças de tela:**
  - abas na ordem **Início · Dashboard · Despesas · Lançamentos · Organizar** (Organizar é a antiga "Categorias");
  - Lançamentos mostra **10 por vez** (sempre começa em 10) e tem o botão "Editar categorias";
  - ao trocar uma categoria, a pessoa escolhe entre "só este lançamento", "todos da origem neste extrato" e "também nos próximos";
  - clicar numa barra do dashboard abre Lançamentos **no topo**;
  - a faixa de meses só se move quando os meses não cabem na tela.
- **Extrato de exemplo novo:** `dados_teste/extrato-pessoa-fisica-com-entradas-2025-2026.ofx`.

**Leitura de PDF** (ramo `leitura-pdf`; especificação em `docs/superpowers/specs/2026-11-02-leitura-pdf-design.md` e plano em `docs/superpowers/plans/2026-11-02-leitura-pdf.md`)
- **Pacote `backend/leitura_pdf/`:**
  - `comum.py`:
    - `abrir` aplica os limites (15 MB e 300 páginas) e a senha, e extrai linhas e palavras com posição e cor;
    - utilitários: `valor_br`, `cadeia_quebras`, `agrupar_linhas` (por proximidade vertical, com tolerância de 3 pt), `ler_valor_no_topo` e `ler_celulas` (a célula centralizada: cada texto vai para a linha de valor mais próxima na vertical);
    - `MENSAGENS`, com as mensagens para o cliente.
  - Os perfis têm `reconhece(doc)` e `ler(doc) -> (lancamentos, aviso)`. A ordem em `__init__.PERFIS` é `[c6, inter, nubank, bradesco, bb, mercadopago, generico]`, e **o genérico é sempre o último**.
  - `ler_pdf(conteudo, senha=None) -> (lancamentos, aviso)` e `leitura.ler_arquivo_com_aviso(nome, conteudo, senha)`.
  - Exceções: `SenhaNecessaria` e `SenhaIncorreta`. A rota responde com `codigo: "senha" | "senha_incorreta"`.
- **Conferência de cada banco:**
  - C6: totais de cada mês. **O PDF tem senha.**
  - Inter: cadeia de saldos e saldo do dia.
  - Nubank: total de cada seção, resumo e saldo final. A descrição é cortada no CPF/CNPJ.
  - Bradesco Celular: o sinal vem da coluna Crédito/Débito, o saldo negativo vem da cor vermelha, e a conferência usa a linha Total e a cadeia de saldos.
  - Banco do Brasil: sinal `(+)`/`(-)`, saldo anterior, saldo do dia e "S A L D O".
  - Mercado Pago: data com traço, cadeia de saldos, resumo e saldo final.
  - Genérico: lê por colunas ou por linhas. Só aceita o que consegue conferir; sem saldo, aceita apenas sinal explícito com o aviso "confira". Se não fechar, recusa.
- **Recusas com mensagem:** PDF sem texto (escaneado), extrato vazio, fatura de cartão e PDF grande demais.
- **Tela:**
  - o seletor aceita `.pdf`;
  - cada PDF com senha ganha uma **caixinha na lista de arquivos**, com "Abrir" e "Pular este arquivo";
  - avisos aparecem na lista e na mensagem de "Extrato salvo";
  - um envio novo anula senhas pendentes do anterior;
  - a senha nunca é guardada nem devolvida.
- **Conferência com os 6 extratos reais**, feita por um script fora do projeto: **tudo confere** e nenhum gera aviso.

| Arquivo | Lançamentos | Entradas | Saídas |
|---|---|---|---|
| c6.pdf | 941 | ago 196.186,83 · set 124.453,84 | ago 173.469,43 · set 150.878,25 |
| inter.pdf | 262 | 27.558,15 | 27.558,97 |
| nubank.pdf | 42 | 2.479,67 | 2.481,63 |
| bradesco.pdf | 14 | 52,93 | 55,69 |
| bb.pdf | 59 | 12.599,69 | 10.442,76 |
| mercadopago.pdf | 305 | 9.599,72 | 9.534,71 |

O C6 tem senha. Ela foi informada pelo usuário no chat e **não está guardada em lugar nenhum**. Peça de novo se precisar.

---

## 3. Próximos passos (em ordem)

1. ~~Teste e merge da leitura de PDF e do sem perfil~~ — feito em 03/11.
2. ~~Tratar transferências internas como movimento interno~~ — feito em 03/11 (o reconhecimento automático de PIX entre contas, por pares, ficou para quando aparecer em extratos reais).
   Texto original:, e não como renda nem gasto. Hoje elas inflam os dois lados. Exemplos:
   - aplicação e resgate de CDB e Tesouro (Inter);
   - "Reserva por gasto Chão / Cofrinho" e "Dinheiro retirado" (Mercado Pago);
   - PIX entre contas da própria pessoa, ao juntar extratos de bancos diferentes.
3. **Guardar o aviso da conferência junto com o extrato salvo**, para ele aparecer ao reabrir. Isso exige uma mudança no banco de dados.
4. **Pendências pequenas da leitura de PDF:**
   - reconhecer o banco só pelo cabeçalho (hoje um texto em qualquer parte do PDF serve);
   - validar datas no genérico;
   - adivinhar o ano no genérico pelo período, e não pela primeira menção a mês e ano;
   - fechar o arquivo se `pdf.pages` falhar;
   - ler mais rápido, derivando as linhas das palavras (hoje são ~0,36 s por página);
   - linhas desconhecidas de rodapé do Nubank;
   - mostrar todos os avisos, e não só o primeiro;
   - link "Como exportar do seu banco" nas mensagens de recusa.
5. **Pendências pequenas do dashboard:**
   - "Saiu" fica negativo quando os estornos superam os gastos;
   - o mês aparece sem o ano em "Trazer X de volta ao normal";
   - `aria-live` no veredito inteiro;
   - CSS morto (`.fixvar`, `.stack`, `.fv-*`);
   - veredito verde quando não há entrada nem saída;
   - o PDF do relatório ignora o filtro no mês a mês.
6. **Colisões de palavras-chave das categorias:**
   - "IPTU PARCELA" cai em Dívidas, e não em Moradia;
   - "PIX … MARIA DAS DORES" cai em Impostos;
   - "JOAO SEGURO" cai em Seguros;
   - "COMPRA PARCELADA" cai em Dívidas;
   - "PIX ENVIADO MERCADO PAGO" cai em Mercado;
   - "MATERIAL LIMPEZA" e "FEIRA DO PRODUTOR" caem em Outros.
7. **Novos perfis de PDF** (Itaú, Caixa, Santander) quando o usuário conseguir extratos reais. Sempre estudar o real antes: a pesquisa na internet errou em pontos importantes (descrições do Nubank, sinais do Bradesco).
8. **App de celular:** PWA (instalável, ícone, tela cheia) e uma revisão da tela no celular.
9. **Colocar o site no ar:**
   - servidor de produção (waitress ou gunicorn);
   - HTTPS;
   - `SECRET_KEY`;
   - backup do banco;
   - política de privacidade (LGPD).
10. **Open Finance** (Pluggy, Belvo), **só quando houver receita**. Custa a partir de ~R$ 2.500/mês.

---

## 4. Restrições e regras

**Com o usuário**
- Responder sempre em **português**, de forma clara, para alguém que não é programador.
- Ao terminar cada tarefa, dizer o que mudou e como testar.
- Quando o usuário delega uma decisão ("faça o que achar melhor"), decidir pensando no **público leigo e sem tempo**.

**Processo** (skills do superpowers)
- **Funcionalidade nova:** brainstorming (perguntas, abordagens, desenho em partes aprovado), depois especificação em `docs/superpowers/specs/`, depois plano em `docs/superpowers/plans/`, depois execução.
- **Execução:** o usuário costuma escolher "eu mesmo faço nesta conversa". No fim vem uma **revisão independente** por um subagente (modelo opus) e depois **uma** passada de correções.
- **Em toda tarefa:** **TDD**, ou seja, escrever o teste, vê-lo falhar e só então implementar.
- **Decisões tomadas sem consultar** são registradas e relatadas ao usuário, junto com as pendências deixadas para depois.
- **Um ramo por funcionalidade.** Juntar ao `main` e enviar ao GitHub **só depois que o usuário testar e aprovar**.
- **Commits:** em português, um por tarefa, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Dados pessoais** (muito importante)
- Os extratos reais (do usuário e de uma terceira pessoa, a "Andreia") ficam **só** em `backend/dados/pdfs-exemplo/`, que o git ignora.
- **Nunca** copiar nomes, CPF/CNPJ, contas, valores ou nomes de comércio dos extratos reais para testes, documentos ou commits. Já aconteceu uma vez e o commit foi bloqueado.
- Os testes usam **PDFs inventados**, gerados por `backend/tests/pdf_falso.py` (`pdf(paginas, senha=None)` com itens `(x, y, texto[, (r, g, b)])`, ou `pdf_linhas`).
- Antes de cada commit, buscar com grep identificadores reais.
- Ao analisar os PDFs reais, imprimir só contagens e totais, e redigir o texto (letras viram x, números viram 9).
- Nunca gravar senhas em arquivo.

**Código**
- **Nomes, comentários e mensagens em português.**
- **Frontend:** ES5 (`var`, `function`), sem bibliotecas novas. As contas ficam em `analise.js`, e o `painel.js` só desenha.
- **Backend:** seguir o estilo de `leitura.py` e `categorizacao.py`, com regex no topo do módulo e docstrings curtas.
- **Novo banco em PDF:** criar `backend/leitura_pdf/<banco>.py` com `reconhece` e `ler`, incluir uma conferência (totais ou saldo), colocá-lo antes do `generico` em `PERFIS`, escrever testes com PDF falso e conferir com o extrato real.
- **Ambiente Windows:**
  - usar o Python do `.venv` com `-I` para scripts avulsos;
  - scripts temporários vão para o scratchpad da sessão, não para o projeto;
  - cuidado com heredocs longos no Bash: quando falharem, gravar o script num arquivo.
- **Escolhas do usuário a manter:**
  - Lançamentos começa com 10 por vez;
  - a aba "Organizar" fica por último;
  - o filtro de despesas vale só enquanto o extrato estiver aberto;
  - o 13º e outras entradas não têm categoria;
  - estornos descontam da categoria.
