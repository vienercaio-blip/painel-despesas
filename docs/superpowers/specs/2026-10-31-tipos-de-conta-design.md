# Tipos de conta: Pessoa física e Empresa ou MEI

Data: 31/10/2026 · Situação: aprovado em conversa, aguardando revisão deste documento

## Objetivo

Hoje o painel tem três tipos de conta (Pessoa física, Empresa e MEI / PME), e o dashboard fala com todos como se fossem um negócio. Além disso, boa parte das saídas de Pessoa física cai em "Outros (revisar)".

Esta mudança:

1. reduz para **dois tipos**, Pessoa física e Empresa ou MEI, e converte os dados existentes;
2. **completa as listas de categorias** dos dois tipos;
3. faz o **dashboard falar a língua de cada tipo**.

## Parte 1: dois tipos de conta e a conversão dos dados

### Os tipos

| Código | Nome na tela |
|---|---|
| `pf` | Pessoa física |
| `empresa` | Empresa ou MEI |

O código `pme` deixa de existir. O servidor continua aceitando `pme` vindo de algum lugar antigo e o trata como `empresa`, do mesmo jeito que já trata `cafe`.

**Onde aparece:** nas configurações (2 opções), na janela "De que tipo é esse extrato?" (2 opções) e nas pastas de "Extratos salvos" (2 pastas principais em vez de 3).

### Código fixo para cada categoria padrão

Hoje as edições do usuário nas categorias padrão são guardadas pela **posição** na lista (`pf:3`). Como as listas vão mudar de ordem e ganhar itens, cada categoria padrão passa a ter um **código que nunca muda** (`pf:mercado`, `empresa:fornecedores`). Isso vale para:

- a chave em `edicoes_padrao`;
- os endereços `PUT/DELETE /api/categorias-padrao/<perfil>/<codigo>`, que hoje recebem a posição;
- o `id` das categorias padrão na tela, hoje `b0`, `b1`… Ele passa a usar o código;
- a função da tela que acha o cartão "Taxas de cartão e apps" pela posição 0. Ela passa a procurar pelo código `taxas`.

Os códigos de cada categoria estão nas tabelas da Parte 2.

### Conversão automática

Roda dentro de `_atualizar()` quando o servidor liga. Na segunda vez em diante, ela não encontra nada para converter e não faz nada.

| O que | Antes | Depois |
|---|---|---|
| Extratos salvos | perfil `pme` | perfil `empresa` |
| Subpastas | da pasta MEI | da pasta Empresa ou MEI. Se já existir uma subpasta com o mesmo nome em Empresa, a que vem do MEI ganha o final " (MEI)" |
| Tipo de conta nas configurações (preferência `config`, campo `perfil`) | `pme` | `empresa` |
| Edições nas categorias padrão | por posição | por código, pela tabela abaixo. Se a mesma categoria foi editada em Empresa e em MEI, vale a de Empresa |
| Regras do usuário | apontam pelo nome da categoria | não mudam |

**De posição para código:**

| Posição antiga | `pf:` | `empresa:` | `pme:` (vira `empresa:`) |
|---|---|---|---|
| 0 | dividas | taxas | taxas |
| 1 | moradia | tarifas | tarifas |
| 2 | casa | aluguel | aluguel |
| 3 | mercado | folha | folha |
| 4 | transporte | impostos | impostos |
| 5 | saude | contas | contas |
| 6 | educacao | *descartada* ("Mercado" deixa de existir em Empresa) | fornecedores |
| 7 | lazer | manutencao | manutencao |
| 8 | assinaturas | | marketing |
| 9 | investimentos | | contabilidade |

**Atenção a um caso:** se o usuário tinha uma regra ou correção apontando para o "Mercado" de Empresa, ou para outro nome que só existia lá, ela continua salva, mas em Empresa nenhuma categoria tem mais esse nome. No plano, preciso conferir como a tela mostra uma categoria que não existe no tipo atual e garantir que ela não quebre nada.

## Parte 2: as categorias de cada tipo

A primeira categoria cuja palavra-chave aparece na descrição é a que vale, por isso a ordem importa. **"Transferências para pessoas" fica sempre por último**: só os PIX e transferências que nada mais reconhece caem nela.

As palavras são comparadas com a descrição já normalizada (minúsculas, sem acento, sem pontuação, com um espaço no começo e no fim). Um espaço antes ou depois da palavra é proposital: evita pegar pedaço de outra palavra.

**F** = conta como custo fixo.

### Pessoa física: 17 categorias

| # | Código | Categoria | F | Palavras-chave |
|---|---|---|---|---|
| 1 | dividas | Dívidas e juros | F | juros, parcela, emprestimo, financiamento, fatura, cartao de credito, multa, rotativo, cheque especial, consignado |
| 2 | tarifas | 🆕 Tarifas bancárias | F | tarifa, pacote servicos, pacote de servicos, cesta de servicos, cesta servicos, ` iof `, anuidade, manutencao de conta |
| 3 | moradia | Moradia | F | aluguel, condominio, iptu, imobiliaria |
| 4 | casa | Contas da casa | F | energia, coelba, enel, cemig, copel, ` light `, agua, embasa, sabesp, compesa, ` gas `, internet, ` vivo `, ` claro `, ` tim `, ` oi ` |
| 5 | delivery | 🆕 Delivery | | ifood, ` ifd `, rappi, ze delivery, 99food, ` 99 food`, keeta, aiqfome, james delivery, daki, uber eats, delivery |
| 6 | assinaturas | Assinaturas | F | assinatura, netflix, spotify, deezer, prime video, amazon prime, amazonprime, youtube, apple, google one, icloud, disney, ` max `, globoplay |
| 7 | compras | 🆕 Compras online | | shopee, mercado livre, mercadolivre, ` amazon `, magalu, magazine luiza, shein, aliexpress, temu |
| 8 | mercado | Mercado | | mercado, supermerc, atacad, assai, makro, carrefour, hortifruti, acougue, feira, padaria |
| 9 | transporte | Transporte | | uber, 99app, ` 99 pop`, combustivel, ` posto `, gasolina, etanol, estacionamento, pedagio, onibus, metro, passagem, ipva, licenciamento, detran, bilhete unico |
| 10 | pets | 🆕 Pets | | pet shop, petshop, petz, cobasi, veterin, racao |
| 11 | saude | Saúde | | farmacia, drogaria, drogasil, ` raia `, droga raia, pague menos, hospital, clinica, consulta, plano de saude, unimed, dentista, odonto, exame, laboratorio |
| 12 | academia | 🆕 Academia e bem-estar | | academia, smart fit, smartfit, pilates, salao, barbearia |
| 13 | educacao | Educação | F | escola, faculdade, curso, mensalidade, livro, udemy, alura |
| 14 | lazer | Lazer | | cinema, restaurante, ` bar `, show, viagem, hotel, ingresso, lanchonete |
| 15 | presentes | 🆕 Presentes | | presente, floricultura |
| 16 | investimentos | Investimentos | | investimento, aplicacao, tesouro, cdb, corretora, poupanca, fundo |
| 17 | transferencias | 🆕 Transferências para pessoas | | pix enviado, pix transf, transferencia, ` transf `, ` ted `, ` doc ` |

**Mudanças de ordem em relação ao que combinamos em conversa** (precisam do seu "ok"). Apareceram ao montar a lista completa:

- **Assinaturas e Compras online sobem para antes de Mercado.** Se Compras ficasse depois de Mercado, "MERCADO LIVRE" cairia em Mercado, porque contém a palavra "mercado". Assinaturas também sobe, para ficar antes de Compras: "AMAZON PRIME" vai para Assinaturas e "AMAZON MARKETPLACE" vai para Compras.
- **Pets sobe para antes de Saúde.** Assim, "CLINICA VETERINARIA" vai para Pets, e não para Saúde por causa de "clinica".
- **IOF e anuidade saem de Dívidas e vão para Tarifas bancárias.** Como Dívidas vem antes, se elas ficassem nas duas listas, Tarifas nunca as pegaria.
- **"cesta" vira "cesta de serviços".** Só "cesta" pegaria "CESTA BASICA" do supermercado.
- **"posto" ganha espaços dos dois lados** (aqui e em Empresa). Sem eles, "IMPOSTO" cai em Combustível. Esse erro já existe hoje.

### Empresa ou MEI: 13 categorias

(Na conversa eu disse 14, mas a lista sempre teve 13.)

| # | Código | Categoria | F | Palavras-chave |
|---|---|---|---|---|
| 1 | taxas | Taxas de cartão e apps | | ` taxa`, ` mdr `, antecipacao, comissao, ` ifood `, ` cielo `, ` stone `, ` getnet `, pagseguro, ` sumup `, ` rede `, mercado pago, maquininha, rappi |
| 2 | tarifas | Tarifas bancárias | F | tarifa, pacote servicos, pacote de servicos, cesta de servicos, ` iof `, juros, anuidade, manutencao de conta |
| 3 | impostos | Impostos e encargos | F | ` das `, das mei, pgmei, simples nacional, ` darf`, ` gps `, ` inss`, ` fgts`, ` iptu`, ` icms`, ` iss `, imposto |
| 4 | folha | Folha de pagamento | F | salario, folha, ` pro labore`, prolabore, vale transporte, vale refeicao, adiantamento, ferias, rescisao |
| 5 | aluguel | Aluguel | F | aluguel, imobiliaria, condominio |
| 6 | contas | Água, luz e internet | F | energia, coelba, ` enel`, cemig, copel, `light `, ` agua`, embasa, sabesp, compesa, internet, ` vivo`, ` claro`, ` tim `, ` oi `, ` gas ` |
| 7 | contabilidade | Contabilidade e sistemas | F | contabil, contador, sistema, software, nuvem, certificado digital |
| 8 | seguros | 🆕 Seguros | F | seguro, porto seguro, mapfre, allianz, tokio marine, sulamerica |
| 9 | fornecedores | Fornecedores | | fornecedor, distribuidora, atacadista, insumo, nota fiscal, nfe, mercado, supermerc, atacad, assai, makro, carrefour, hortifruti, acougue, padaria, laticinio, torrefacao, embalage, material de limpeza |
| 10 | combustivel | 🆕 Combustível e entregas | | ` posto `, gasolina, diesel, etanol, combustivel, motoboy, frete, correios, loggi, lalamove |
| 11 | manutencao | Manutenção | | manutencao, conserto, reparo, assistencia tecnica |
| 12 | marketing | Marketing | | anuncio, google ads, meta ads, facebook, instagram, impulsionamento, marketing, panfleto, grafica |
| 13 | transferencias | 🆕 Transferências para pessoas | | pix enviado, pix transf, transferencia, ` transf `, ` ted `, ` doc ` |

- **"Mercado" sai de Empresa.** As compras em supermercado e atacado passam a contar como Fornecedores, como já acontecia no MEI.
- Em Empresa, iFood e Rappi continuam em Taxas de cartão e apps: ali eles são a taxa que o app cobra do restaurante.
- **"compra" não é palavra-chave de Fornecedores** (mudança depois da revisão). Muitos bancos começam as compras no débito com "COMPRA CARTAO", e com ela "COMPRA CARTAO POSTO" cairia em Fornecedores, não em Combustível.
- **Categoria criada pelo cliente com o nome de uma categoria padrão nova** (ex.: ele já tinha criado "Delivery"): a dele ganha o final " (sua)", e as regras e correções que apontavam para ela vão junto. Isso roda junto com a conversão, quando o servidor liga.

## Parte 3: textos e indicadores do dashboard

Tudo o que muda por tipo fica **num único lugar do `painel.js`** (um objeto de textos por tipo), para não espalhar condicionais pelo arquivo.

**Os 4 cartões do topo**

| Hoje (para todos) | Pessoa física | Empresa ou MEI |
|---|---|---|
| Resultado, com o selo "Lucro / Prejuízo no período" | selo "Sobrou dinheiro / Faltou dinheiro" | igual a hoje |
| Margem ("De cada R$ 100 que entram…") | "Quanto sobra", com a mesma conta | igual a hoje |
| Custos fixos por mês | "Contas fixas por mês" | igual a hoje |
| Taxas de cartão e apps | "Onde mais gasta": a categoria com mais saídas, com o valor por mês e o % do total | igual a hoje |

**Textos e gráficos**

| Onde | Pessoa física | Empresa ou MEI |
|---|---|---|
| Quadro "Custos fixos e variáveis" | "Contas fixas e gastos do dia a dia". Fixas: "Pagas todo mês, mesmo sem usar". Variáveis: "Mudam conforme o seu consumo" | igual a hoje |
| "X dias de entradas" | "o salário dos primeiros X dias do mês vai só para as contas fixas" | igual a hoje |
| Gráfico "Caixa acumulado" | "Saldo acumulado" | igual a hoje |
| Gráfico "Entradas por dia da semana" | escondido | igual a hoje |
| Dica do cartão Margem | "Quanto maior, mais folga no orçamento para imprevistos." | "Quanto maior, mais folga no caixa para imprevistos." |

A dica da Margem corrige o "caixaio" que existe hoje. Ele é resto de uma troca de texto antiga, que deixou para trás o "io" de "negócio".

**Conclusões automáticas ("Principais conclusões")**

- **Só em Empresa ou MEI**, como hoje: a do dia da semana com mais entradas e a de negociar a taxa da maquininha.
- **Só em Pessoa física**, e só quando passar do limite:
  - Delivery acima de 10% das saídas: "Delivery levou R$ X por mês (Y% dos gastos). Cozinhar mais vezes por semana é uma das economias mais rápidas."
  - Tarifas bancárias acima de R$ 0: "Você pagou R$ X por ano em tarifas do banco. Muitas contas digitais não cobram tarifa."
- As outras conclusões (margem, dias em que as saídas se concentram, melhor e pior mês, categoria que mais subiu) valem para os dois tipos.

## Parte 4: testes e verificação

**Testes automáticos do servidor**, escritos antes do código:

1. **Conversão de dados**, partindo de um banco no formato antigo com:
   - extratos `pme`;
   - subpastas de MEI, uma delas com nome repetido em Empresa;
   - tipo de conta `pme` nas configurações;
   - edições `pf:3`, `pme:6`, `empresa:2` e `empresa:6`.

   Depois da conversão, o teste confere que tudo virou `empresa`, que a subpasta repetida ganhou " (MEI)", que cada edição foi para o código certo e que a edição de `empresa:6` foi descartada. Também confere que rodar a conversão de novo não muda nada.
2. **Categorização com descrições reais típicas:**

   | Descrição | Pessoa física | Empresa ou MEI |
   |---|---|---|
   | IFD*PIZZARIA BELLA | Delivery | |
   | UBER TRIP | Transporte | |
   | UBER EATS | Delivery | |
   | MERCADO LIVRE | Compras online | |
   | AMAZON PRIME | Assinaturas | |
   | CLINICA VETERINARIA | Pets | |
   | SMART FIT | Academia e bem-estar | |
   | PIX ENVIADO MARIA SILVA | Transferências para pessoas | Transferências para pessoas |
   | PIX ENVIADO MARIA CONTABILIDADE | | Contabilidade e sistemas |
   | DAS MEI | | Impostos e encargos |
   | PAGTO IMPOSTO | | Impostos e encargos |
   | TARIFA PACOTE SERVICOS | Tarifas bancárias | Tarifas bancárias |
   | CESTA BASICA SUPERMERCADO | Mercado | |
3. **`pme` vindo de fora:** o servidor aceita e trata como `empresa` na leitura, ao salvar, nas subpastas e nos endereços de categoria padrão.
4. **Os 23 testes atuais continuam passando.** Os que usam `pme` ou a posição da categoria são ajustados.

**Medição com os extratos de `dados_teste/`:** contar quanto das saídas cai em "Outros (revisar)". A meta é ficar **abaixo de 5% em Pessoa física** e **abaixo de 10% em Empresa**. A medição é feita por um script avulso, fora do projeto, e o resultado vai na mensagem final.

**Tela:** checagem de sintaxe do JavaScript e um roteiro curto para você testar no navegador:
- trocar o tipo de conta e ver os cartões e textos mudarem;
- ver só 2 pastas principais;
- conferir as conclusões novas de Pessoa física.

**Ordem de implementação**, um commit por passo:

1. Categorias novas com códigos fixos e conversão das edições (servidor e testes).
2. Fusão de MEI com Empresa: conversão de extratos, subpastas e configurações, mais a tela com 2 opções e 2 pastas.
3. Textos e indicadores por tipo no dashboard.
4. Medição final, atualização do README (que ainda fala em "páginas" e em 18 testes) e roteiro de teste.

## Fora do escopo

- Planilha de vendas, que continua em pausa.
- Mudanças na forma de classificar (a ordem de prioridade continua: correção, regra, categoria do cliente, categoria padrão).
