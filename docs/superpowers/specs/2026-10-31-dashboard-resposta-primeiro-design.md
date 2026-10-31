# Dashboard "resposta primeiro"

Data: 31/10/2026 · Situação: aprovado em conversa, aguardando revisão deste documento

## Objetivo

O site é para **pessoas leigas e sem tempo**. O dashboard atual parece um relatório de analista: começa com quatro números soltos, mostra vários gráficos que exigem interpretação e deixa as conclusões, que são a parte mais útil, no fim da página.

O novo dashboard precisa responder, **em poucos segundos e de cima para baixo**:

1. A situação está boa ou ruim?
2. O que eu faço?
3. Para onde vai o meu dinheiro?
4. Como isso evoluiu?

Ele também passa a permitir **escolher quais despesas entram na análise**: algumas categorias, as N maiores ou todas.

**Critério de sucesso:** quem abre o dashboard entende a situação lendo só o veredito e os cartões de ação, sem precisar rolar a página nem interpretar gráficos.

## Ordem da página

1. Veredito
2. O que fazer agora
3. Para onde vai o dinheiro (com o seletor de despesas)
4. Mês a mês
5. Ver mais detalhes (fechado por padrão)

O cartão do período (ano, mês, semana e faixa de meses) continua acima de tudo, como hoje.

## Regras que valem para a página toda

- **"Por mês":** com vários meses no período, os valores são a média por mês, e a página diz isso ("média por mês, em 12 meses"). Com um mês só, são os valores daquele mês. Na visão de semana, são os valores da semana.
- **Textos por tipo de conta:** vêm do objeto `TEXTOS` que já existe em `painel.js`. Pessoa física fala em "sobrou" e "gastos"; Empresa ou MEI fala em "lucro" e "custos".
- **Estornos** já vêm descontados da categoria deles, como foi feito antes neste ramo.
- **O filtro de despesas nunca muda o veredito, os três números, as ações, o saldo acumulado nem a projeção.** Esses mostram sempre a situação real.

## Parte 1: Veredito

**Uma frase com cor**, decidida por quanto sobrou do que entrou no período (`sobra = (entradas − saídas) / entradas`):

| Situação | Cor | Pessoa física | Empresa ou MEI |
|---|---|---|---|
| sobra ≥ 10% | verde | **Tudo certo:** sobram R$ X por mês, Y% do que entra. | **Lucro saudável:** R$ X por mês, Y% do faturamento. |
| 0 ≤ sobra < 10% | amarelo | **Atenção:** sobra pouco, R$ X por mês. Um imprevisto já aperta. | **Margem apertada:** lucro de R$ X por mês, só Y% do faturamento. |
| sobra < 0 | vermelho | **Alerta:** você gasta R$ X a mais do que ganha por mês. | **Prejuízo:** saem R$ X a mais do que entram por mês. |
| nenhuma entrada no período | vermelho | **Alerta:** saíram R$ X e não entrou nada neste período. | **Sem faturamento:** saíram R$ X e não entrou nada neste período. |

"Por mês" segue a regra geral: vira "neste mês" com um mês só e "nesta semana" na visão de semana.

**Segunda linha:** "O que mais pesa: [categoria], com Y% dos gastos." É a categoria com mais saídas, sem contar "Outros (revisar)", e sempre sobre todas as despesas. Se não houver nenhuma categoria, a linha não aparece.

**Três números grandes**, nesta ordem: **Entrou · Saiu · Sobrou**. O terceiro vira **Faltou**, em vermelho, quando é negativo.

- Com um mês ou uma semana escolhidos, cada número ganha uma seta comparando com o período anterior (o mês ou a semana anterior), por exemplo "↑ 12% vs. setembro". A seta só aparece se o período anterior tiver lançamentos.
- O **Sobrou** usa sempre o total real.

**Sai do topo:** os quatro cartões atuais (Resultado, Margem, Contas fixas e o quarto cartão). A margem passa a ser o "Y%" da frase. "Contas fixas" e "Onde mais gasta" viram a Parte 3. O cartão "Taxas de cartão e apps" de Empresa vira a ação "Negociar a taxa da maquininha".

## Parte 2: O que fazer agora

São **no máximo 3 cartões**. Cada um tem:
- **título:** a ação;
- **uma linha de motivo**, com o valor por mês e o % das saídas;
- **economia estimada**: "Economia: ~R$ X/mês · R$ Y/ano", quando houver.

As bases são **médias mensais do período, sobre todas as despesas**.

| Ação (título) | Tipo | Aparece quando | Economia |
|---|---|---|---|
| Pedir delivery metade das vezes | pf | Delivery > 8% das saídas | 50% de Delivery |
| Trocar para uma conta sem tarifa | pf | Tarifas bancárias > 0 | 100% de Tarifas |
| Cancelar assinaturas que não usa | pf | Assinaturas > R$ 100/mês | 1/3 de Assinaturas |
| Esperar 24 h antes de comprar online | pf | Compras online > 10% das saídas | 30% de Compras online |
| Quitar primeiro as dívidas com juros | pf | Dívidas e juros > 15% das saídas | sem estimativa (mostra o valor pago) |
| Negociar a taxa da maquininha | empresa | Taxas de cartão e apps > 3% das entradas | 25% de Taxas |
| Negociar o pacote do banco | empresa | Tarifas bancárias > 0 | 100% de Tarifas |
| Revisar contratos fixos | empresa | Custos fixos > 60% das saídas | sem estimativa (mostra o valor) |
| Trazer [categoria] de volta ao normal | os dois | Com 3 meses ou mais no período: no último mês, a categoria passou 20% e R$ 50 da média dos meses anteriores. Entra só a de maior diferença | a diferença |
| Classificar despesas sem categoria | os dois | "Outros (revisar)" > 10% das saídas | sem economia ("deixa o painel mais preciso"), com link para a aba Organizar |

As categorias são encontradas **pelo código** (`delivery`, `tarifas`, `assinaturas`, `compras`, `dividas`, `taxas`), com a função `catByCode`, e usam o nome atual, mesmo que o cliente tenha renomeado.

**Regras:**
- Os cartões vêm **ordenados pela maior economia por mês**. Os sem estimativa ficam por último, e a página mostra no máximo 3.
- Se nenhuma ação se aplicar, aparece **uma linha verde**: "Nada urgente: seus gastos estão sob controle." (em Empresa ou MEI: "Nada urgente: seus custos estão sob controle.").
- Na **visão de semana**, os cartões não aparecem. No lugar fica a linha: "Escolha um mês ou mais para ver sugestões."
- Ao passar o mouse, ou ao clicar no celular, o cartão mostra **as 3 maiores origens** daquele gasto, como "IFD*IFOOD PIZZARIA: R$ 180/mês".

**"Principais conclusões" atuais:** as que viraram ação saem (delivery, tarifas, maquininha). As informativas vão para "Ver mais detalhes".

## Parte 3: Para onde vai o dinheiro

### Seletor "Despesas analisadas"

- Fica no topo da seção, como um botão que mostra **"Todas as despesas (N) ▾"** ou, com filtro, **"K de N categorias ▾"**.
- Ao clicar, abre um painel com:
  - **atalhos:** "Todas", "Só as 3 maiores", "Só as 5 maiores" e "Tirar as contas fixas";
  - **caixas de marcar**, uma por categoria que tem saídas no extrato, ordenadas pelo valor no período, com o valor por mês ao lado.
- Com filtro ligado, aparece uma faixa: "Analisando K de N categorias: R$ X/mês, Y% das saídas · **Mostrar todas**".
- A escolha vale **enquanto o extrato estiver aberto**. Ao abrir outro extrato, volta para "Todas". Se uma categoria for renomeada, a escolha acompanha o nome novo.
- Desmarcar todas as categorias não é permitido: a última caixa marcada fica travada.

### Barras

São horizontais, uma por categoria analisada, da maior para a menor. Cada barra mostra:
- **o valor por mês** e **o % do total analisado**;
- a etiqueta **"fixa"** nas categorias de custo fixo;
- uma **seta ↑ ou ↓** só quando, com 2 meses ou mais no período, o último mês variou mais de 10% em relação à média da categoria.

Acima das barras, uma linha: "Contas fixas: R$ X por mês, Y% das saídas" (Empresa: "Custos fixos: …"). Ela usa as categorias analisadas.

- **Clicar numa barra** abre a aba Lançamentos filtrada naquela categoria, só com saídas.
- **"Outros (revisar)"** fica sempre por último, em cinza, com o link **classificar →**, que leva para a aba Organizar.
- **Valor negativo no período** (o estorno superou o gasto): a barra fica vazia e o valor aparece em verde.

**Sai:** o quadro "Custos fixos e variáveis".

## Parte 4: Mês a mês e Ver mais detalhes

### Mês a mês

- **Sem filtro:** é o gráfico de resultado por mês de hoje, com barras verdes ou vermelhas e o seletor "Últimos 6 meses / 12 meses / Todos / Ano".
- **Com filtro:** mostra o gasto das categorias escolhidas em cada mês. O título vira "Gastos com [A] e [B], mês a mês" quando são até 2 categorias, e "Gastos com as K categorias escolhidas, mês a mês" quando são mais.
- Ao passar o mouse, cada barra mostra os números do mês, como hoje.

### Ver mais detalhes

É um bloco **fechado por padrão**, que fica aberto enquanto o extrato estiver aberto.

| Item | Usa o filtro |
|---|---|
| Saldo acumulado / Caixa acumulado | não |
| Saídas por dia do mês | sim |
| Entradas por dia da semana (só Empresa ou MEI) | não |
| Categorias que mais mudaram | sim |
| Projeção para o próximo mês | não |
| Outras informações: melhor e pior mês, dias em que as saídas se concentram, dias de renda que pagam as contas fixas | só a dos dias em que as saídas se concentram |

### Exportar PDF

Segue a mesma ordem: veredito e os três números, o que fazer agora, para onde vai o dinheiro, mês a mês e outras informações. Com filtro ligado, o PDF informa quais categorias foram analisadas.

## Fora do escopo

- A aba **Despesas**, que não muda.
- Novos tipos de gráfico ou bibliotecas.
- Guardar na conta a escolha do filtro ou se o bloco de detalhes está aberto.

## Testes

**Automáticos**, rodando o dashboard no Node com DOM simulado, como nas tarefas anteriores. Os scripts ficam fora do projeto. São conferidos:
- a frase e a cor do veredito nos 4 casos, em Pessoa física e em Empresa ou MEI;
- as setas dos três números com um mês escolhido;
- cada ação aparecendo e não aparecendo no limite da sua regra, a ordem por economia, o máximo de 3, a linha "Nada urgente" e a visão de semana;
- o filtro: os atalhos (3 maiores, 5 maiores, tirar fixas), o estorno acompanhando a categoria, o veredito e os três números sem mudar, a faixa de aviso, a troca do título do gráfico mês a mês e a volta para "Todas" ao abrir outro extrato;
- a barra com valor negativo e "Outros" sempre por último;
- a sintaxe com `node --check` e os testes do servidor, que precisam continuar passando.

**Manual:** um roteiro curto no navegador, com `extrato-pessoa-fisica-com-entradas-2025-2026.ofx` (Pessoa física) e `extrato-cafeteria-ago-out-2026.ofx` (Empresa ou MEI).
