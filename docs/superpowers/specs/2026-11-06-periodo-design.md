# Período com atalhos, intervalo e comparação (etapa 2, parte 5)

Data: 06/11/2026. Base: `main` em `c7c9cdf`. Ramo de trabalho: `periodo`.

## Objetivo

Escolher o período sem pensar em datas. O que é comum fica a um clique ("Últimos 3 meses", "Este ano"), um intervalo livre fica a dois cliques (meses inteiros ou dias exatos), e o Dashboard ganha um modo de comparar dois períodos. A regra de ouro continua valendo: o "por mês" nunca engana quando o intervalo corta um mês no meio, e a comparação é sempre justa entre períodos de tamanhos diferentes.

## Decisões do usuário (06/11)

- **As três opções:** de um mês até outro, de uma data até outra e comparar dois períodos.
- **Quadro de Período: B · Atalhos prontos + Personalizado**, escolhido entre A (abas), B e C (linha do tempo de meses).
- **Comparação: A · No próprio Dashboard**, escolhido entre A, B (página própria) e C (dois Dashboards lado a lado).
- Desenho aprovado em duas partes: o quadro de Período e o modo Comparar.
- Continuam valendo:
  - a Economia **não tem** quadro de Período e usa o extrato inteiro;
  - em Lançamentos o quadro fica **dentro** do quadro dos lançamentos.

## 1. Modelo do período

- **Formato:** `state.p` passa a ter a forma `{tipo, ...}`:
  - `{tipo:'tudo'}`: todo o extrato;
  - `{tipo:'mes', y, m}`: um mês (`m` de 0 a 11), como o antigo `p.m`;
  - `{tipo:'semana', w}`: uma semana (chave `AAAA-MM-DD` da segunda-feira), como o antigo `p.w`; com o mês dela em `y` e `m`, para a faixa de meses saber qual mês destacar;
  - `{tipo:'intervalo', de:'AAAA-MM-DD', ate:'AAAA-MM-DD', dias:bool, rotulo?}`: `dias:false` quando são meses inteiros (de = dia 1, até = último dia), `dias:true` quando são dias exatos; `rotulo` é o nome do atalho que o criou ("Últimos 3 meses"), só para destacar o atalho.
- **Funções que trocam de forma:** as três funções de hoje passam para o módulo novo, com a mesma ideia:
  - `inP(t, p)`: o lançamento está no período;
  - `prevP(p)`: o período anterior;
  - `periodName(p)`: o nome do período.
- O modo comparar fica em `state.cmp = {a: período, b: período} | null`. Enquanto ele existe, o Dashboard desenha a comparação (§3) e as outras páginas não existem nesse modo (§3.4).
- **"Por mês"** (`fatorMes(p, mesesComDados)`):
  - meses inteiros, mês, ano e tudo: o divisor é o número de meses com lançamentos, como hoje;
  - semana: sem "por mês", como hoje;
  - dias exatos: o divisor é `dias do intervalo / 30`; o texto diz "média de 30 dias" e mostra "intervalo de N dias".
- **Período anterior** (`prevP`), usado na comparação de Despesas:
  - mês, semana e ano como hoje;
  - intervalo: o intervalo de mesmo tamanho logo antes (em meses, se `dias:false`; em dias, se `dias:true`);
  - tudo: nenhum.

## 2. O quadro de Período

### 2.1 Atalhos (uma linha de botões)

Os atalhos são: **Todo o extrato · Último mês · Últimos 3 meses · Últimos 6 meses · Este ano · (um botão por ano, se houver mais de um) · Personalizado… · Comparar…**

- Contam a partir do **último mês do extrato** (`U`), não da data de hoje:
  - "Último mês" = U;
  - "Últimos 3 meses" = U−2..U;
  - "Últimos 6" = U−5..U;
  - "Este ano" = janeiro a U do ano de U.
- **Quando aparecem:**
  - "Últimos 3" só com 3 meses ou mais no extrato, "Últimos 6" só com 6 ou mais;
  - "Este ano" só se o extrato tiver mais de um ano ou começar antes de janeiro do ano de U;
  - botões por ano ("2025", "2026") só se o extrato tiver mais de um ano;
  - "Comparar…" só no Dashboard e com 2 meses ou mais.
- O atalho ativo fica destacado (`aria-pressed`). Um mês clicado na faixa de meses não destaca nenhum atalho.
- **Saem do quadro:** os campos "Ano" e "Mês" e o botão "Ver todo o período" (agora é o atalho "Todo o extrato"). O campo "Semana" continua: aparece só com um mês escolhido.

### 2.2 Faixa de meses

Os botões de mês (`#pMonths`) continuam: clicar escolhe aquele mês, e clicar de novo no mês ativo volta para "Todo o extrato". Com um intervalo ativo, os meses dentro dele ficam destacados de leve.

### 2.3 Personalizado…

Abre uma caixinha logo abaixo dos atalhos com duas abas.

- **Meses inteiros:** "De [mês/ano ▾] até [mês/ano ▾]", com os meses que existem no extrato.
- **Dias exatos:** "De [data] até [data]" (`type="date"`, `min` e `max` = primeiro e último dia do extrato). Onde o calendário não aparece, aceita `dd/mm/aaaa`.
- **Aplicar:**
  - confere se as datas são válidas, se o "até" é igual ou depois do "de" e se há lançamentos no intervalo;
  - erros em linguagem simples: "Escolha a data final depois da inicial." e "Não há lançamentos entre 10/03 e 25/03.";
  - um intervalo de meses que vira um mês só é guardado como `{tipo:'mes'}`.
- "Cancelar" ou Esc fecha sem mudar nada.

### 2.4 Linha de resumo

`#pSum` passa a dizer, por exemplo:
- "Mostrando de março a agosto de 2026 · 6 meses · 214 lançamentos";
- "Mostrando de 10/03/2026 a 25/08/2026 · 169 dias · 201 lançamentos".

### 2.5 Onde vale

- Dashboard, Despesas, Lançamentos (quadro embutido) e o PDF, que usa `periodName`.
- A Economia não muda.
- O Dashboard trata o intervalo como trata "vários meses" hoje. Com dias exatos:
  - Entrou, Saiu e Sobrou usam o fator de 30 dias e o subtexto "média de 30 dias";
  - o veredito diz "por mês (média de 30 dias)".

## 3. Modo Comparar (só no Dashboard)

### 3.1 Escolher

"Comparar…" abre uma caixinha com:
- **Período 1** (dourado, `--accent`) e **Período 2** (azul, `--s2`), cada um com "De [mês] até [mês]" e a aba "Dias exatos", como no Personalizado;
- **atalhos de comparação**, que só aparecem quando o extrato tem os dois períodos inteiros:
  - "Este mês × mês passado" (U × U−1);
  - "Últimos 3 meses × 3 anteriores";
  - "Este ano × ano passado" (jan–U × jan–U do ano anterior, mesmos meses);
- **Comparar:** valida cada período como no Personalizado e também se os dois são diferentes ("Escolha dois períodos diferentes."). Períodos que se sobrepõem são aceitos, com o aviso "Os períodos se sobrepõem.".

### 3.2 O que o Dashboard mostra

No topo, a faixa "Comparando **jan–jun/26** × **jul–dez/25** · Sair da comparação". Depois, nesta ordem:

1. **Veredito** pela diferença do Sobrou por mês (`d = sobraA − sobraB`):
   - `d ≥ 1`: verde, "Melhorou: sobrou R$ X a mais por mês que em <B>.";
   - `d ≤ −1`: vermelho, "Piorou: sobrou R$ X a menos por mês que em <B>.";
   - senão, "Igual: sobrou quase o mesmo por mês nos dois períodos.";
   - quando os dois períodos ficaram no negativo, o texto fala em "faltou".
2. **Tabela** com as linhas Entrou, Saiu e Sobrou (ou Faltou) por mês e as colunas Período 1, Período 2 e Diferença.
   - Cor da diferença: Entrou maior é verde, Saiu maior é vermelho, Sobrou maior é verde.
   - O "por mês" de cada período segue §1, com 30 dias para dias exatos.
3. **Categorias em barras duplas:**
   - para cada categoria, o gasto por mês em cada período (A dourado em cima, B azul embaixo), na mesma escala;
   - a variação ao lado: "+NN%", "−NN%", "nova" (0 em B) ou "sumiu" (0 em A);
   - mostra as 6 que mais mudaram em reais por mês, e "Ver todas" abre o resto;
   - ficam de fora as categorias com valor negativo em qualquer período (estornos maiores que os gastos), a mesma regra da faixa de comparação de hoje;
   - clicar abre os lançamentos da categoria no Período 1, o que sai da comparação (§3.4).
4. **O que mais mudou:** uma linha com até 3 altas e até 3 quedas em reais por mês, por exemplo "Delivery +R$ 120/mês · Mercado −R$ 190/mês".

### 3.3 Escondido enquanto compara

- as faixas Números, Comparação (mês anterior), Categorias (fatias), Meses, Maiores gastos, Previsão e Dicas;
- Ver mais detalhes;
- o aviso de pasta e a linha de movimento interno;
- o botão "Exportar PDF".

Ao sair da comparação, tudo volta.

### 3.4 Sair

- "Sair da comparação", escolher outro atalho ou um mês na faixa, ou ir para Despesas, Lançamentos ou Economia faz `state.cmp = null`.
- Quando a saída não escolhe outro período, o período passa a ser o Período 1.
- A comparação existe só no Dashboard, para nunca misturar números de dois períodos em outra página.

### 3.5 Movimentos

São as regras de sempre:
- 0,8 s ou menos;
- curva `cubic-bezier(.2,.7,.2,1)`;
- `semMovimento()`.

O que se move:
- ao entrar na comparação, as três linhas da tabela contam do zero;
- as barras duplas crescem da esquerda para a direita, com 40 ms entre categorias.

## 4. Onde fica cada coisa

- **`frontend/js/periodo.js`** (novo, puro, testado no Node), objeto `Periodo`:
  - `contem(data, p)`: troca `inP` (recebe a `Date` do lançamento);
  - `anterior(p) -> p|null`: troca `prevP`, sem o rótulo, que vem de `nomeAnterior(p)`;
  - `nome(p) -> texto`: troca `periodName`, por exemplo "março a agosto de 2026", "10/03/2026 a 25/08/2026", "agosto de 2026" ou "todo o período";
  - `curto(p)`: por exemplo "jan–jun/26" ou "10/03–25/08/26";
  - `atalhos(meses) -> [{id, rotulo, p}]`, em que `meses` = chaves `AAAA-MM` do extrato, em ordem;
  - `atalhosComparar(meses) -> [{id, rotulo, a, b}]`;
  - `deMeses(deChave, ateChave)`;
  - `deDias(deISO, ateISO)`;
  - `lerData(txt) -> ISO|null`: aceita `AAAA-MM-DD` e `dd/mm/aaaa`; recusa datas que não existem;
  - `validar(p, temLancamentos) -> null | mensagem`;
  - `fatorMes(p, mesesComDados) -> {divisor, nota}`;
  - `comparar(A, B) -> {veredito:{cor, texto}, linhas:[{rotulo, a, b, dif, bom}], categorias:[{nome, a, b, dif, txt}], mudou:{altas, quedas}}`, em que `A` e `B` são `{nome, ins, outs, nM, cat:{nome:total}}`, já com os totais do período e o divisor do "por mês".
- **`frontend/index.html`:** no `#periodSec`:
  - a linha de atalhos `#pAtalhos`;
  - a caixinha `#pPers` (abas Meses e Dias, campos, Aplicar, Cancelar e erro);
  - a caixinha `#pCmp` (Período 1, Período 2, atalhos, Comparar, Cancelar e erro);
  - sem `#pY`, `#pM` e `#pClear`; `#pW` continua.

  No `#viewDash`, a seção `#dCmpModo`, com a faixa do topo, o veredito, a tabela, as barras e "O que mais mudou".
- **`frontend/css/estilo.css`:** atalhos (como as pílulas), as caixinhas, os meses destacados no intervalo, a seção de comparação e os movimentos.
- **`frontend/js/painel.js`:**
  - todas as leituras de `state.p.y/m/w` passam a usar `Periodo` (são poucas: `inP`, `prevP`, `periodName`, o desenho do quadro, `isWeek`, o `escopo` do Dashboard, o modo do gráfico de Fluxo e a comparação com o mês anterior);
  - desenho dos atalhos e das caixinhas;
  - `renderComparacao()`;
  - a saída da comparação em `chegou()`.
- **Servidor:** nenhuma mudança.

## 5. Testes

- `node --test frontend/tests`, arquivo novo `periodo.test.js`:
  - `contem` para cada tipo, incluindo intervalo com dias e os limites do primeiro e do último dia;
  - `anterior`:
    - intervalo de 6 meses (mar–ago → set–fev);
    - intervalo de dias (169 dias antes);
    - mês em janeiro (vira dezembro do ano anterior);
  - `nome` e `curto` de cada tipo;
  - `atalhos`:
    - extrato de 2 meses: sem "Últimos 3" e sem anos;
    - extrato de 14 meses: com anos e "Este ano";
    - conta a partir do último mês do extrato;
  - `atalhosComparar` só com os dois períodos inteiros;
  - `lerData`: `dd/mm/aaaa`, ISO, 31/02 recusado e texto recusado;
  - `validar`: até antes de de, sem lançamentos e válido;
  - `fatorMes`: meses inteiros; dias exatos com 169 dias (divisor 169/30 e nota);
  - `comparar`:
    - veredito melhorou, piorou e igual (limite de R$ 1);
    - cores da diferença;
    - categorias com nova, sumiu e negativa de fora;
    - ordem pela mudança em reais;
    - altas e quedas.
- `pytest` sem mudança.
- Chrome automático com banco temporário, temas escuro e claro, 1280×800 e 390×844:
  - **atalhos:**
    - cada um muda o resumo e os números;
    - "Últimos 3 meses" bate com a soma dos 3 meses;
  - **Personalizado:**
    - meses e dias, com erro para "até" antes de "de";
    - dias exatos mostram "média de 30 dias";
  - **Despesas e Lançamentos:** com intervalo; o quadro embutido em Lançamentos;
  - **Comparar:**
    - atalho "Este mês × mês passado";
    - períodos de tamanhos diferentes;
    - veredito, tabela e barras;
    - sair pelo botão e indo para outra página (o período vira o Período 1);
    - PDF escondido;
  - **Economia:** não muda com nada disso;
  - **celular:** sem rolagem lateral;
  - **movimentos:** com e sem "reduzir movimento".

## Fora do escopo

- PDF da comparação.
- Comparar mais de dois períodos.
- Lembrar o período escolhido entre visitas (hoje ele começa sempre em "Todo o extrato").
- Comparação na Despesas, em Lançamentos e na Economia.
