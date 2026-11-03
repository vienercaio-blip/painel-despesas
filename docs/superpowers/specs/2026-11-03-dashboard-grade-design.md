# Dashboard em grade (etapa 2 do redesenho, parte 1)

Data: 03/11/2026. Ramo: `dashboard-grade`, criado a partir de `identidade-visual`, a etapa 1, que ainda espera o teste do usuário.

## Objetivo

Deixar o Dashboard com cara de painel profissional:
- gráficos do tamanho certo para ler de relance, já que hoje cada um ocupa a largura inteira;
- a resposta e o porquê visíveis numa tela, quase sem rolar;
- o estilo "sobrou." da etapa 1.

As regras do painel continuam as mesmas: o veredito, os números, as dicas e o filtro "Despesas analisadas" não mudam de conta.

Escolhas do usuário, feitas na comparação visual (`.superpowers/brainstorm/.../dashboard-layout.html`):
- o **layout A, "painel em grade"**;
- em "Ver mais detalhes", **ficam só o saldo acumulado, as categorias que mais mudaram e a projeção**. Os gráficos de dia da semana e de dia do mês saem.

## Fora do escopo

- As outras telas (Início, Despesas, Lançamentos e Organizar) ficam para as próximas partes da etapa 2.
- O celular e o PWA ficam para a etapa 3. Aqui só garantimos que, abaixo de 900 px, os cartões fiquem empilhados sem espremer.

## 1. Ordem e layout

1. **Veredito:** `#dVer`, igual ao de hoje, com as linhas de aviso logo embaixo: `dAvisoPasta`, `dInterno` e `dAvisoLeitura`.
2. **Três números** (`#dNums`), lado a lado, com o total em destaque e o texto embaixo, como hoje.
   - Embaixo de cada número entra um **minigráfico** de linha: 100% de largura por 28 px de altura, sem eixos, com os valores mensais do período.
     - Cores: Entrou em `--good`, Saiu em `--ink-3` e Sobrou em `--s1`.
     - Ao passar o mouse ou tocar, aparece o mês e o valor, com a dica (`data-tip`) que o site já usa.
   - **Com 1 mês, ou na visão de semana, não há minigráfico.**
3. **Grade de dois cartões** (`.dash-grid2`):
   - **"Para onde vai o dinheiro"** (`#dOnde`), com o filtro e a linha das contas fixas no cabeçalho do cartão, em texto menor.
     - A lista mostra as **5 maiores** categorias.
     - Se houver mais, aparece o link **"Ver todas as N categorias"**. Ele mostra todas e vira "Ver menos".
     - A escolha vale enquanto o extrato estiver aberto (`state.dashTodas`).
     - "Outros" fica sempre por último e só aparece entre as 5 se estiver entre as 5 maiores.
     - Com o filtro ligado, a regra das 5 vale sobre as categorias escolhidas.
   - **"Mês a mês"** (`#dRes`): colunas com **160 px de altura**, dourado (`--s1`) quando sobrou e `--bad` quando faltou. O nome do mês fica embaixo, e o seletor de intervalo fica no cabeçalho do cartão.
     - Com o filtro ligado, mostra os gastos das categorias escolhidas, como hoje, também com 160 px.
4. **"O que fazer agora"** (`#dAcoes`): até 3 cartões numa linha (`.dash-grid3`), cada um com o título e a economia em `--good`.
   - Clicar abre as origens, como hoje.
   - O texto do motivo fica escondido no cartão e aparece na dica ao passar o mouse e no detalhe ao clicar.
   - Sem dicas, fica a mensagem de hoje, ocupando a linha inteira.
5. **"Ver mais detalhes"** (`#dDet`), fechado, numa grade com dois cartões:
   - **Saldo acumulado** (`#dCum`), linha com **180 px**;
   - **Projeção para o próximo mês** (`#dProj`), três números pequenos.

   Embaixo vem **"Categorias que mais mudaram"** (`#dChg`), com a largura inteira e uma tabela compacta.

   Os cartões `#dWeekCard`, com o gráfico `#dWeek`, e o de `#dDom` **saem**, junto com o código que os desenha.

**Abaixo de 900 px**, `.dash-grid2` e `.dash-grid3` viram uma coluna, e os três números continuam lado a lado até 560 px, como hoje.

## 2. Gráficos

Seguem as boas práticas de visualização:
- **marcas finas:** colunas com cantos de 4 px só na ponta de cima e linhas de 2 px;
- **grade e eixos discretos**, em `--grid` e `--ink-3`;
- **números alinhados**, com `tabular-nums`;
- **legenda:** cada gráfico tem uma série só, e o título do cartão diz o que é;
- **cores:** dourado (`--s1`) é a cor principal, cinza (`--s2`) é "Outros", e vermelho (`--bad`) só aparece para resultado negativo;
- **dica em todo valor**, ao passar o mouse ou tocar, com o comportamento atual (`data-tip`).

Funções de desenho:
- `barSVG(data, o)` e `lineSVG(pts, o)` ganham `o.altura`, a altura em pixels. O desenho passa a ter altura fixa: o SVG usa `width:100%` com a altura pedida, e o viewBox acompanha.
- Uma função nova, `sparkSVG(valores, cor, dicas)`, desenha os minigráficos.

## 3. Regras puras (`analise.js`, testadas)

- `visiveis(linhas, todas, n) -> {linhas, escondidas}`:
  - recebe as linhas de `Analise.barras` (já em ordem, com "Outros" por último);
  - com `todas` falso, devolve as `n` primeiras e quantas ficaram de fora;
  - "Outros" só entra se estiver entre as `n` primeiras, já que vem por último;
  - com `todas` verdadeiro, devolve todas e `escondidas = 0`.
- `serieMeses(meses, campo) -> number[]`:
  - devolve os valores de `campo` (`ins`, `outs` ou `res`) na ordem dos meses;
  - um mês sem valor vale 0;
  - com menos de 2 meses, devolve `[]`, e aí não há minigráfico.

## 4. PDF do relatório

- "Para onde vai o dinheiro" continua com **todas** as categorias. Elas são lidas dos dados, e não das linhas visíveis na tela.
- As seções dos gráficos de dias que saíram somem do PDF, se forem citadas lá.

## 5. Testes

- **JS:**
  - `visiveis`: 8 categorias com n = 5 dão 5 linhas e 3 escondidas; `todas` verdadeiro dá 8 linhas e 0 escondidas; 3 categorias dão 3 e 0; "Outros" na 6ª posição fica de fora com `todas` falso.
  - `serieMeses`: a ordem dos valores; um mês com campo ausente dá 0; 1 mês dá `[]`.
- **Os testes atuais** continuam passando.
- **No navegador, com o usuário:**
  1. Abrir o Dashboard de um extrato com vários meses e conferir o layout e as dicas dos minigráficos.
  2. Usar "Ver todas" e "Ver menos".
  3. Usar o filtro e o intervalo.
  4. Abrir os detalhes.
  5. Ver no modo claro, no escuro e numa janela estreita.
  6. Gerar o PDF.
