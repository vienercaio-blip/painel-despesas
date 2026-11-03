# Sem perfil: pastas livres e lista única de categorias

Data: 03/11/2026. Ramo: `sem-perfil`, criado a partir do `main` **depois** que o ramo `leitura-pdf` for juntado a ele.

## Objetivo

Hoje a pessoa escolhe entre **Pessoa física** (`pf`) e **Empresa ou MEI** (`empresa`) no cadastro e no envio. Essa escolha muda as categorias, alguns textos e as duas pastas principais. Vamos tirá-la.

Por que tirar:
- a escolha é uma etapa chata ou confusa para o público leigo e sem tempo;
- muita gente com MEI mistura gastos pessoais e da empresa na mesma conta.

Como fica:
- **Ninguém escolhe perfil.** A pessoa só envia o extrato.
- Ela organiza os extratos em **pastas livres** ("Empresa", "Banco A", "Casa"...).
- Ela pode ver **uma pasta inteira somada** no painel.
- Existe **uma lista só** de categorias.

Critério de sucesso: quem usa o site hoje não perde nenhum dado, nenhuma pasta e nenhum ajuste de categoria. E o MEI consegue ver quanto a empresa gastou sem precisar configurar nada além de criar uma pasta.

## Fora do escopo

- Separação automática "Casa / Empresa" dentro de um mesmo extrato. As pastas cumprem esse papel.
- Pastas dentro de pastas. Só existe um nível.
- Pergunta sobre o tipo de conta no cadastro, mesmo que opcional.
- Textos diferentes para quem tem empresa.
- Planilhas de vendas (`tipo = 'vendas'`), que estão em pausa. Elas continuam como estão.

## 1. O que a pessoa vê

### Cadastro e envio
- A pergunta "Pessoa física ou Empresa ou MEI?" sai do cadastro e do envio.
- No envio, escolher uma pasta é **opcional**. Sem escolha, o extrato vai para **"Sem pasta"**.

### Pastas
- São criadas pela pessoa, todas no mesmo nível, com nome livre. Não podem existir duas com o mesmo nome; a comparação usa `normalizar`.
- Cada extrato tem o menu **"Mover para"**, que já existe.
- Ao excluir uma pasta, os extratos dela voltam para "Sem pasta" e **nunca são apagados**.
- "Sem pasta" não é uma pasta de verdade: é o lugar dos extratos com `pagina_id = NULL`. Ela não pode ser renomeada nem excluída.
- **Sugestão de pastas:** na área de pastas aparece uma sugestão discreta: *"Tem empresa ou MEI? Crie as pastas Pessoal e Empresa com um toque."*
  - Um toque cria as duas pastas. Se uma delas já existir, só a que falta é criada.
  - A sugestão some quando as duas existem. Também pode ser dispensada com "Agora não", e essa escolha fica guardada em `preferencias`.

### Pasta inteira no painel
- Cada pasta tem o botão **"Ver a pasta inteira"**. Ele abre o painel com os lançamentos de **todos os extratos da pasta somados**: veredito, ações, categorias, mês a mês, lançamentos e detalhes. O título do painel mostra o nome da pasta.
- Abrir um extrato sozinho continua funcionando como hoje.
- **Repetidos:** um lançamento com a mesma data, o mesmo valor e a mesma descrição normalizada em **extratos diferentes** da pasta conta uma vez só.
  - Repetidos dentro de um mesmo extrato são lançamentos legítimos e continuam contando.
  - Se algum repetido for descartado, o painel mostra o aviso: *"Encontramos N lançamentos repetidos entre os extratos desta pasta e contamos cada um uma vez só."*
- Na pasta inteira, trocar a categoria de um lançamento funciona como no extrato. A correção fica gravada no lançamento original.
- Com a pasta vazia, aparece a mensagem *"Esta pasta ainda não tem extratos."* e um atalho para enviar um.
- O recurso "mesclar extratos", que cria um extrato novo, continua existindo. Ele perde a trava "só do mesmo perfil".

### Textos
- Os textos passam a ser sempre os de pessoa física: "Contas fixas" e "Saldo acumulado". O objeto `TEXTOS` por perfil deixa de existir.
- O cartão "Gastos por dia da semana", que hoje é só de empresa, passa a aparecer para todos dentro de "Ver mais detalhes".

## 2. Lista única de categorias

São 25 categorias. O código fixo é o de `pf` quando ela existe. O painel só mostra categorias com movimento.

| Ordem | Código | Nome | Fixa? | Origem |
|---|---|---|---|---|
| 1 | `dividas` | Dívidas e juros | sim | pf |
| 2 | `tarifas` | Tarifas bancárias | sim | pf + empresa |
| 3 | `taxas` | Taxas de cartão e apps | não | empresa |
| 4 | `impostos` | Impostos e encargos | sim | empresa |
| 5 | `folha` | Folha de pagamento | sim | empresa |
| 6 | `moradia` | Moradia e aluguel | sim | pf `moradia` + empresa `aluguel` |
| 7 | `casa` | Água, luz e internet | sim | pf `casa` + empresa `contas` |
| 8 | `contabilidade` | Contabilidade e sistemas | sim | empresa |
| 9 | `seguros` | Seguros | sim | empresa |
| 10 | `delivery` | Delivery | não | pf |
| 11 | `assinaturas` | Assinaturas | sim | pf |
| 12 | `compras` | Compras online | não | pf |
| 13 | `mercado` | Mercado | não | pf |
| 14 | `fornecedores` | Fornecedores | não | empresa |
| 15 | `transporte` | Transporte e combustível | não | pf `transporte` + empresa `combustivel` |
| 16 | `manutencao` | Manutenção | não | empresa |
| 17 | `marketing` | Marketing | não | empresa |
| 18 | `pets` | Pets | não | pf |
| 19 | `saude` | Saúde | não | pf |
| 20 | `academia` | Academia e bem-estar | não | pf |
| 21 | `educacao` | Educação | sim | pf |
| 22 | `lazer` | Lazer | não | pf |
| 23 | `presentes` | Presentes | não | pf |
| 24 | `investimentos` | Investimentos | não | pf |
| 25 | `transferencias` | Transferências para pessoas | não | pf + empresa |

- Nas categorias unidas, as palavras-chave são **a soma** das duas listas, sem repetição.
- A ordem acima é a de prioridade, e pode ser ajustada durante a execução se os testes de categorização pedirem. **Risco conhecido:** palavras de empresa (por exemplo "das" em Impostos) passam a valer para quem antes era pessoa física. O teste de categorização com os extratos de exemplo de pessoa física deve mostrar **as mesmas categorias de antes**, exceto nas categorias unidas, e cada diferença tem de ser justificada.
- **Palavras que aparecem nas duas listas:** hoje Fornecedores (empresa) tem palavras de supermercado ("mercado", "supermerc", "padaria", "carrefour"...). Na lista única, compras em supermercado e padaria vão para **Mercado**, para todo mundo, e Fornecedores fica só com as palavras próprias de empresa ("fornecedor", "distribuidora", "atacadista", "insumo", "nota fiscal"...). Quem quiser mandar o mercado da empresa para Fornecedores usa a troca de categoria com "também nos próximos". A mesma limpeza vale para qualquer outra palavra repetida entre as duas listas.
- `REGRAS_PF`, `REGRAS_EMPRESA` e `PERFIS` dão lugar a uma lista única `REGRAS`. As edições ficam com a chave `padrao:<código>`, e as rotas passam a ser `/api/categorias-padrao/<codigo>`.
- `carregar_categorizador(banco, usuario_id)` deixa de receber o perfil.
- Estornos, "Outros" e as categorias criadas pela pessoa continuam como estão.

## 3. Conversão dos dados de quem já usa o site

Ela roda sozinha quando o servidor liga, em `banco.py`, no mesmo estilo de `_converter_tipos_de_conta`. Na segunda vez não encontra nada para converter. Tudo acontece numa transação só.

### Pastas e extratos (`tipo = 'despesas'`)
1. As subpastas de `pf` continuam com o mesmo nome.
2. As subpastas de `empresa` continuam com o mesmo nome, mas se já existir uma de `pf` com o mesmo nome normalizado, a de empresa ganha o sufixo **" (Empresa)"**.
3. Os extratos de `empresa` que estavam soltos (`pagina_id NULL`) vão para uma pasta nova chamada **"Empresa"**.
   - Se já existir uma pasta com esse nome normalizado, eles vão para ela.
   - Se não houver nenhum extrato solto de empresa, a pasta não é criada.
4. Os extratos de `pf` que estavam soltos continuam soltos e aparecem em "Sem pasta".
5. **Marca de conversão:** a coluna `perfil` recebe o valor `'unico'` em `paginas` e `extratos` depois de convertida. Só são convertidas as linhas com `perfil IN ('pf', 'empresa')`. As linhas novas já nascem com `'unico'`.

### Categorias
1. **Nomes antigos para nomes novos:** "Moradia" e "Aluguel" viram "Moradia e aluguel"; "Contas da casa" e "Água, luz e internet" viram "Água, luz e internet"; "Transporte" e "Combustível e entregas" viram "Transporte e combustível". Essa troca vale para `regras.categoria` e para `correcoes.categoria`. Se a pessoa tinha renomeado uma dessas categorias, o nome dela é mantido e vale a regra da edição abaixo.
2. **Edições (`edicoes_padrao`):** `pf:<código>` vira `padrao:<código>`; `empresa:<código>` vira `padrao:<código novo>` (aluguel → moradia, contas → casa, combustivel → transporte).
   - Se as duas existirem para o mesmo código novo, ficam o **nome e o tipo da de `pf`**, e as **palavras são somadas**, sem repetição.
   - Uma edição com `palavras NULL` (manteve as originais) somada a uma com palavras próprias resulta nas palavras próprias mais as originais da outra categoria.
3. Depois disso, tudo o que se refere à categoria pelo nome (regras e correções) é atualizado para o nome final, usando a mesma lógica de `rotas/categorias.py`.
4. Se a pessoa criou uma categoria com o mesmo nome de uma categoria padrão nova (por exemplo, "Fornecedores" criada por quem era `pf`), a criada pela pessoa continua existindo, e a padrão com o mesmo nome **não aparece** para essa pessoa. Ninguém fica com duas categorias iguais na tela.

### Colunas
- `paginas.perfil` e `extratos.perfil` continuam na tabela para não exigir reconstruir as tabelas no SQLite. O código para de ler essas colunas, exceto a própria conversão.

## 4. Mudanças por arquivo (visão geral)

- **`backend/categorizacao.py`:** lista única `REGRAS` e `FIXAS`; tira `PERFIS` e `perfil_valido`; mantém `CODIGOS_ANTIGOS` só para a conversão antiga.
- **`backend/banco.py`:** nova `_converter_sem_perfil` e `schema.sql` com o padrão `'unico'`.
- **`backend/rotas/paginas.py`:** pastas sem perfil; nome único por usuário e tipo.
- **`backend/rotas/extratos.py`:** sem perfil ao salvar, mover e mesclar; nova rota `GET /api/paginas/<id>/lancamentos`, que devolve os lançamentos da pasta já sem os repetidos e com a contagem dos repetidos.
- **`backend/rotas/leitura.py`:** o envio não recebe mais o perfil.
- **`backend/rotas/categorias.py`:** rotas das categorias padrão sem perfil.
- **`frontend/`:** tira a escolha de perfil, o `TEXTOS` por perfil e a ideia de duas pastas principais; acrescenta "Sem pasta", "Ver a pasta inteira", a sugestão de pastas e o aviso de repetidos. As contas novas (por exemplo, a remoção de repetidos, se for feita no navegador) ficam em `analise.js`.

## 5. Testes

TDD em cada tarefa.

- **Conversão:** um banco com os dois perfis, subpastas com nomes repetidos, extratos soltos dos dois lados, edições nas duas categorias que viraram uma, regras e correções com nomes antigos. Conferir o resultado e que **rodar a conversão duas vezes dá o mesmo resultado**.
- **Categorização:** os lançamentos de exemplo caem nas categorias esperadas; as categorias unidas reconhecem as palavras das duas origens; os extratos de exemplo de pessoa física mantêm as categorias de antes (ver o risco na seção 2).
- **Pasta inteira:** soma de vários extratos; repetidos entre extratos contam uma vez só e são contados; repetidos dentro do mesmo extrato continuam; pasta vazia; pasta de outro usuário dá 404.
- **Rotas:** criar pasta com nome repetido dá erro; excluir a pasta devolve os extratos para "Sem pasta"; envio sem perfil.
- **JS:** textos neutros e regra de exibição da sugestão de pastas.
- Todos os testes atuais continuam passando, ajustados onde testavam o perfil.

**Teste do usuário no navegador:**
1. Abrir o site com os dados atuais e ver as pastas e os extratos no lugar esperado.
2. Criar a pasta "Empresa", mover dois extratos para ela, tocar em "Ver a pasta inteira" e conferir a soma.
3. Enviar o mesmo extrato duas vezes na mesma pasta e ver que ele não conta em dobro e que aparece o aviso.
4. Confirmar que o cadastro não pergunta mais o tipo de conta.

Hoje não existe cópia de segurança automática antes das conversões. Por isso, o plano inclui uma: antes de converter, o servidor copia `backend/dados/painel.db` para um arquivo com a data no nome, e faz isso só quando há algo a converter.
