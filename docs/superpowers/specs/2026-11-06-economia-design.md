# Página Economia (etapa 2, parte 4)

Data: 06/11/2026. Base: `main` em `97ba476`. Ramo de trabalho: `economia`.

## Objetivo

Uma página só sobre economizar, para leigos sem tempo. Em poucos segundos a pessoa deve saber três coisas: quanto está sobrando, se está perto da meta e qual é a primeira coisa a cortar. A regra de ouro continua valendo: nenhum número inventado ou contado duas vezes, e todos saem das contas que o Dashboard já faz.

## Decisões do usuário (06/11)

- **Meta:** as duas formas, uma meta mensal ("sobrar R$ X por mês") e um objetivo opcional com prazo.
- **Simulador:** os dois modos juntos, cortes por categoria e um valor fixo livre por mês.
- **Layout B · Plano de ação**, escolhido entre A (faixas), B e C (duas colunas). Dicas, gastos que se repetem e categorias acima do normal viram uma lista só, com caixinhas de marcar que alimentam a barra da meta.
- Desenho aprovado em duas partes: lugar, meta e objetivo; depois lista, simulador e movimentos.

## 1. Lugar no site

- **Menu:** item novo "Economia" (`#economia`, `data-view="economia"`, classe `dash-tab`), logo abaixo de Dashboard, com ícone de cofrinho no mesmo traço dos outros. Aparece quando há extrato aberto, como os outros itens. Só no modo despesas.
- **Título da página:** "Economia" (uma palavra, como as outras).
- **Período (mudado em 06/11, pedido do usuário):** a página **não tem o quadro de Período** e usa sempre o **extrato inteiro** (as mesmas contas do Dashboard em "Ver todo o período"). No topo, a linha "Com base em todo o extrato: ago/2026 a out/2026 (3 meses)." Não há mais aviso de semana. O atalho do Dashboard também usa o extrato inteiro.
- **Dashboard:** a faixa Dicas (`#dAcoesSec`) vira um atalho de uma linha: "Dá para economizar ~R$ X/mês em N itens →", que leva a `#economia`. X e N são o total e a contagem dos itens com valor da lista da Economia, sem marcar nada, já com o limite por categoria (§3.4). Sem itens: "Veja onde dá para economizar →".

## 2. Topo: meta, objetivo e quanto guardou

### 2.1 Meta do mês

- **Campo:** "Quero sobrar R$ ___ por mês", digitado ali mesmo. Sem meta, aparece só o campo, com a frase "Defina quanto quer sobrar por mês."
- **Base:** `sobra` = o "Sobrou por mês" do período, o mesmo número do Dashboard (`Analise.numeros`).
- **Barra:**
  - parte cheia (dourada) = `max(0, sobra) / meta`;
  - parte clara logo depois = economia dos itens marcados / meta;
  - o total desenhado é limitado a 100%.
- **Texto:**
  - "Sobrou R$ 303 de R$ 500 · faltam R$ 197";
  - com itens marcados, acrescenta "· com o que você marcou: R$ 494";
  - meta atingida: "Meta batida: sobrou R$ 620 de R$ 500";
  - faltou dinheiro: barra vazia e "Faltou R$ X por mês no período".

### 2.2 Objetivo (opcional)

- Link "+ Juntar para um objetivo". Abre os campos nome (até 40 caracteres), valor, prazo (mês e ano, a partir do mês atual) e "já tenho R$ ___".
  - "Já tenho" é sempre informado pela pessoa, porque o extrato não mostra o que há guardado em outros lugares.
  - Botões "Salvar" e "Remover objetivo".
- **Mostra:**
  - a barra `tenho / valor`, em verde;
  - "Faltam R$ F · precisa de R$ P/mês até <mês/ano>", com P = F / meses até o prazo (contando o mês atual) e arredondado para cima em reais;
  - "No ritmo atual, chega em N meses" ou "Neste ritmo não chega no prazo", em que ritmo = `max(0, sobra) + economia marcada`;
  - com o campo do valor fixo preenchido (§3.5), também "Guardando R$ G/mês, chega em M meses";
  - ritmo 0: "Neste ritmo não sobra nada para o objetivo";
  - objetivo alcançado (tenho ≥ valor): "Objetivo alcançado!";
  - prazo já passado: "O prazo passou: escolha um novo".

### 2.3 Quanto já guardou

Uma linha com `Analise.linhaInterno` (a mesma frase do Dashboard) e, com mais de um mês, "(R$ Y por mês)". Sem dinheiro guardado no período, a linha não aparece.

## 3. Lista "Onde dá para economizar"

Uma lista única, ordenada pela economia por mês (maior primeiro). As linhas sem valor estimado vão para o fim.

### 3.1 Fontes

1. **Dicas:** `Analise.acoes(...)`, com a mesma entrada do Dashboard, exceto a dica `normal`, que é coberta pela fonte 3.
   - Com `economia`: item marcável, tipo `categoria` (corte ajustável).
   - Sem `economia` (dívidas, contratos fixos): item informativo, sem caixinha, no fim.
2. **Gastos que se repetem:**
   - uma mesma origem (`t.origin`) com saída em **3 meses ou mais** do extrato inteiro (`state.tx`);
   - o valor mensal de cada mês fica a até 20% da mediana desses meses;
   - ficam de fora as saídas internas (`saiDaConta`), os estornos e as categorias essenciais (códigos `moradia`, `casa`, `impostos`, `dividas`, `educacao`, `folha`);
   - economia = média mensal dessa origem nos meses em que apareceu; descrição = a descrição mais recente;
   - tipo `cancelar` (tudo ou nada); título "Cancelar <descrição>";
   - com menos de 3 meses no extrato, não há itens desta fonte.
3. **Acima do normal:**
   - toda categoria (menos "Outros") em que o último mês do período passou a média dos meses anteriores do período em mais de 20% e em pelo menos R$ 50 (a mesma regra de hoje, mas para todas, não só a maior);
   - precisa de 3 meses ou mais no período;
   - economia = último mês − média; título "Trazer <categoria> de volta ao normal"; tipo `categoria`.

### 3.2 Linha da lista

- caixinha (só nos itens com valor);
- título, que é um link para os lançamentos da categoria (itens de categoria) ou com a busca pela descrição (itens que se repetem), pelo mesmo caminho dos cliques do Dashboard;
- etiqueta "dica", "repete todo mês" ou "acima do normal";
- valor "R$ X/mês" (ou "sem valor estimado");
- a frase do motivo (`motivo`) aparece pequena embaixo do título.

### 3.3 Corte ajustável

Um item `categoria` marcado mostra um controle deslizante de 10% a 100%, em passos de 10%.
- A posição inicial representa a economia sugerida: `sugerida / gasto mensal da categoria`, arredondada para o passo mais próximo e mantida entre 10% e 100%.
- A economia passa a ser `pct × gasto mensal da categoria`.
- Para "acima do normal", 100% = a diferença inteira (não a categoria inteira).

### 3.4 Limite por categoria (regra de ouro)

A economia simulada somada dos itens marcados de uma mesma categoria nunca passa do gasto mensal dela no período. Os itens `cancelar` contam na categoria da origem. Se passar, o total da categoria é cortado no limite, e a linha mostra "(já contado em <categoria>)" no item que excedeu. O total da lista e o atalho do Dashboard também usam esse limite.

### 3.5 Valor fixo por mês

Abaixo da lista: "Quanto consigo guardar por mês: R$ ___". Só alimenta a linha extra do objetivo (§2.2); não mexe na barra da meta.

### 3.6 Guardar o que foi marcado

- Fica tudo em `cfg.economia`, salvo na conta por `saveCfg()`:
  ```
  { meta: número|null,
    objetivo: {nome, valor, prazo:'AAAA-MM', tenho} | null,
    marcados: {<id>: pct|true},
    fixo: número|null }
  ```
- Ids estáveis: `dica:<id da ação>`, `rep:<origem>`, `cat:<nome da categoria>`.
- Ids marcados que não existem no período atual são ignorados (e mantidos para quando voltarem).

## 4. Movimentos

Mesmas regras do Início e do Dashboard:
- 0,8 s ou menos;
- curva `cubic-bezier(.2,.7,.2,1)`;
- só `transform`, `opacity` e largura das barras;
- `semMovimento()` e a regra global de "reduzir movimento".

1. **Cascata:** ao chegar na página vindo de outra vista, os blocos sobem 10 px e aparecem com 70 ms de diferença.
2. **Barras se enchendo:** a barra da meta e a do objetivo crescem de 0 até o valor na chegada.
3. **Marcar/desmarcar:** o trecho claro da barra cresce ou encolhe (transição de largura), e "com o que você marcou: R$ X" conta do valor anterior até o novo. O texto final é exatamente o `brl` do valor.
4. **Brilho da meta:** quando o total (sobra + marcados) passa da meta pela primeira vez numa visita, a barra dá um brilho dourado, uma vez.

## 5. Onde fica cada coisa

- **`frontend/js/economia.js`** (novo, puro, sem DOM, exportado para o navegador e para o Node como `analise.js`):
  - `repetidos(lista, opcoes)`:
    - recebe `[{data, desc, valor, origem, cat}]` (valor positivo = saída, já sem internos e estornos) e `{essenciais:[nome], minMeses:3, tolerancia:0.2}`;
    - devolve `[{id:'rep:'+origem, origem, desc, cat, mensal, meses}]`, ordenado por `mensal`.
  - `acimaDoNormal(meses, outros)`:
    - recebe `[{name, cat:{nome:total}}]` (do período, em ordem);
    - devolve `[{id:'cat:'+nome, cat, agora, media, dif}]` com a regra de §3.1.3.
  - `itens(fontes)`: junta as três fontes no formato `{id, tipo:'categoria'|'cancelar'|'info', titulo, motivo, etiqueta, cat, economia, base}`, ordenados como em §3, em que `base` é o gasto mensal que vale 100% no corte.
  - `simular(itens, marcados, gastoCat)`: aplica §3.3 e §3.4 e devolve `{total, porItem:{id:valor}, cortados:[id]}`.
  - `pctInicial(item)`: a posição inicial do controle (§3.3).
  - `objetivo(o, ritmo, fixo, hoje)`: devolve `{falta, porMes, meses, mesesFixo, estado:'ok'|'nao-chega'|'sem-ritmo'|'alcancado'|'prazo-passou'}`.
- **`frontend/index.html`:**
  - item de menu;
  - `<section id="viewEconomia">` com `#eMeta`, `#eObjetivo`, `#eGuardou`, `#eLista`, `#eFixo` e o aviso de semana `#eSemana`;
  - `<script src="/js/economia.js">` antes de `painel.js`.
  - Na faixa Dicas do Dashboard, `#dAcoes` dá lugar ao atalho `#dEcoAtalho`.
- **`frontend/css/estilo.css`:** barras da meta e do objetivo, linhas da lista, controle deslizante, etiquetas, movimentos. Mesmas variáveis de cor (`--s1`, `--accent`, `--ok`) nos dois temas.
- **`frontend/js/painel.js`:**
  - `renderEconomia()`, chamado por `chegou()` quando a vista é `economia` e quando o período muda com a página aberta;
  - a entrada de `Analise.acoes` sai para uma função comum, usada pelo Dashboard e pela Economia;
  - cliques e edição dos campos, salvando com `saveCfg()`;
  - `animarEconomia()`;
  - o atalho no Dashboard.
- **Servidor:** nenhuma mudança (a preferência `config` já aceita qualquer objeto).

## 6. Testes

- `node --test frontend/tests`, arquivo novo `economia.test.js`:
  - `repetidos`: 3 meses parecidos entram; 2 meses não entram; variação acima de 20% fica de fora; categoria essencial fica de fora; média e descrição mais recente.
  - `acimaDoNormal`: acima de 20% e R$ 50 entra; só 20% ou só R$ 50 não entra; menos de 3 meses não gera nada; "Outros" fica de fora.
  - `simular`: soma simples; corte em %; limite por categoria com dica + cancelar na mesma categoria; ids desconhecidos ignorados.
  - `pctInicial`: arredonda para 10% e fica entre 10% e 100%.
  - `objetivo`: por mês arredondado para cima; não chega; sem ritmo; alcançado; prazo passado; com valor fixo.
- `pytest` sem mudança.
- Chrome automático, com banco temporário, nos temas escuro e claro, em 1280×800 e 390×844:
  - menu e atalho do Dashboard levam à Economia;
  - a sobra da meta é igual ao "Sobrou por mês" do Dashboard;
  - marcar itens mexe na barra e no total;
  - a meta e o objetivo continuam lá depois de recarregar a página;
  - semana mostra o aviso;
  - sem rolagem lateral no celular;
  - movimentos com e sem "reduzir movimento";
  - aplicação/CDB nunca aparece como gasto que se repete.

## Fora do escopo

- Lembretes ou avisos fora do site (e-mail, notificação).
- Somar automaticamente as sobras dos meses ao "já tenho" do objetivo.
- Mais de um objetivo.
- Despesas, Lançamentos e Organizar (próximas partes).
