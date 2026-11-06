# Comparar dois períodos em Despesas e Lançamentos

Data: 06/11/2026. Base: ramo `periodo` em `2b3f505`. Continua no mesmo ramo.

## Objetivo

O botão "Comparar…" do quadro de Período passa a existir também em Despesas e Lançamentos, e cada página mostra a comparação do seu jeito:
- Despesas: cada quadro com os dois períodos;
- Lançamentos: uma lista só, com o período em cada linha.

A regra de ouro continua valendo: os números saem das mesmas contas da comparação do Dashboard (`dadosPeriodo` e `Periodo.comparar`), sempre por mês, e com os mesmos avisos de mês incompleto e de períodos que se sobrepõem.

## Decisões do usuário (06/11)

- Comparar dentro de cada página, não só no Dashboard.
- **Despesas · A:** cada quadro mostra os dois períodos (escolhido entre A e B, "um quadro de comparação no topo").
- **Lançamentos · A:** uma lista só, com uma etiqueta do período em cada linha (escolhido entre A, B "duas listas lado a lado" e C "agrupado por origem").
- Desenho aprovado como apresentado.

## 1. Regras gerais

- **Onde está o botão:** "Comparar…" aparece no quadro de Período do Dashboard, de Despesas e de Lançamentos. A regra de 2 meses ou mais continua valendo.
- **Navegação:** `state.cmp` continua ativo entre essas três páginas, e cada uma desenha a sua comparação.
  - Economia, Organizar e Início ignoram `state.cmp` e não o apagam; ao voltar, a comparação está lá.
  - Isto substitui a regra antiga "sair do Dashboard sai da comparação", que estava em `chegou()`.
- **Sair:** "Sair da comparação", ou escolher outro período (atalho, mês, Personalizado ou semana). O período passa a ser o Período 1.
- **Faixa do topo:** as três páginas mostram a mesma faixa ("Comparando A × B · Sair da comparação", mais os avisos), gerada por uma função só, `htmlTopoComparacao()`.
  - Dashboard: no lugar de hoje.
  - Despesas: no topo da página.
  - Lançamentos: dentro do quadro, logo abaixo do Período.
- **"Exportar PDF":** escondido em qualquer página enquanto compara.
- **Clicar numa categoria** (em Despesas ou no Dashboard): abre Lançamentos filtrado nessa categoria, **sem sair** da comparação. Antes, no Dashboard, clicar saía da comparação; isso muda.

## 2. Despesas comparando

1. **Os quatro números** (`#kIn`, `#kOut`, `#kRes`, `#kTop`):
   - Entradas, Saídas e Resultado mostram o valor **por mês** do Período 1 (`linhas[i].a` de `Periodo.comparar`), com o rótulo "Entradas por mês", "Saídas por mês" e "Resultado por mês".
   - O subtexto diz "<B>: R$ X · +R$ Y". A diferença leva a classe `pos` ou `neg` conforme `bom`.
   - "Maior despesa": a categoria com maior gasto no Período 1; o subtexto diz "<B>: <categoria>" ou "<B>: a mesma".
2. **Categorias** (`#cats`):
   - barras duplas (A em `--accent` em cima, B em `--s2` embaixo) com o gasto por mês de cada período, na escala do maior valor;
   - ordenadas pelo valor de A (e as que só existem em B no fim, pelo valor de B);
   - ao lado, "+NN%", "−NN%", "nova" ou "sumiu" (o mesmo `txt` de `comparar`); categorias negativas de fora;
   - `#catHint` diz "Por mês, <A> × <B>";
   - clicar → `abrirLancamentos(cat)`, ainda comparando.
3. **Fluxo** (`#flow`):
   - duas linhas de **saídas**, uma por período (cores A e B), alinhadas por posição;
   - unidade: mês quando os dois períodos têm 2 meses ou mais; senão semana; com semana escolhida, dia;
   - o eixo mostra "1º", "2º", "3º"…; ao passar o mouse, a dica mostra o nome de cada ponto nos dois períodos (por exemplo "jan/26: R$ 7.200 · jul/25: R$ 7.900");
   - o título fica "Fluxo · saídas"; a legenda mostra os nomes curtos de A e B.
4. **Resumo** (`#insights`): frases em lista:
   - o veredito da comparação (texto de `comparar`);
   - "Saiu R$ X a mais (ou a menos) por mês que em <B>.";
   - "O que mais subiu: <cat> (+R$ X/mês)." e "O que mais caiu: <cat> (−R$ X/mês).";
   - "A maior despesa continua sendo <cat>." ou "A maior despesa passou de <catB> para <catA>.";
   - os avisos de mês incompleto ou sobreposição, se houver, com o ícone ⚠.

## 3. Lançamentos comparando

- **A lista:** os lançamentos que estão em A **ou** em B, do mais novo para o mais antigo, com os filtros de hoje (Saídas/Entradas/Todos, categoria, busca e "Editar categorias").
  - Coluna nova "Período", com uma etiqueta da cor de A e/ou de B: ambas quando o lançamento está nos dois períodos sobrepostos.
  - Fora da comparação, a coluna não aparece.
- **Filtro de período:** botões "Os dois · <A> · <B>" (`#txPerCmp`, mesmo estilo do filtro Saídas/Entradas), ao lado dos outros filtros.
- **Rodapé** (`#foot`):
  - "<A>: −R$ X (N) · <B>: −R$ Y (M) · por mês: ±R$ Z", com as somas dos lançamentos filtrados de cada período e a diferença por mês = `somaA/divisorA − somaB/divisorB`, usando os mesmos divisores de `dadosPeriodo`;
  - com o filtro num período só, mostra só a soma dele.
- **Paginação e "Mostrar por vez":** continuam valendo.

## 4. Onde fica cada coisa

- **`frontend/js/periodo.js`** (puro, testado):
  - `posicoes(p, unidade) -> [{chave, rotulo}]`: as unidades em ordem (mês `AAAA-MM`, semana `AAAA-MM-DD` da segunda-feira, dia ISO) que o período cobre;
  - `resumoComparacao(r, A, B, maiorA, maiorB) -> [texto]`: as frases do §2.4, sem os avisos.
- **`frontend/js/painel.js`:**
  - `htmlTopoComparacao(A, B)`;
  - na `render()`, os ramos de comparação de Despesas (`renderDespesasComparacao`) e de Lançamentos (filtro, coluna, rodapé dentro de `renderTable`);
  - o botão "Comparar…" visível nas três páginas;
  - `chegou()` sem a saída automática;
  - o clique na categoria não sai da comparação.
- **`frontend/index.html`:**
  - `#dCmpTopoDesp` no topo de `#viewDespesas`;
  - `#lCmpTopo` em Lançamentos, abaixo de `#lancPeriodo`;
  - `#txPerCmp` (botões de período) junto dos filtros;
  - a coluna "Período" na tabela, escondida fora da comparação;
  - textos do "Como funciona" de Despesas e Lançamentos explicando a comparação.
- **`frontend/css/estilo.css`:** etiquetas de período, barras duplas na lista de categorias, linhas do Fluxo e os subtextos dos números.

## 5. Testes

- `node --test frontend/tests`:
  - `posicoes`: mês, semana e dia, e intervalo que cruza o ano;
  - `resumoComparacao`: melhorou/piorou, subiu/caiu, "continua sendo" e "passou de … para …".
- Chrome automático (extrato de 12 meses, temas escuro e claro, 1280 e 390):
  - **o botão:** "Comparar…" em Despesas e em Lançamentos;
  - **Despesas:**
    - comparar "Este mês × mês passado" ali mesmo;
    - os valores por mês batem com a tabela do Dashboard na mesma comparação;
    - barras duplas com "sumiu";
    - Fluxo com duas linhas;
    - o Resumo começa pelo veredito;
  - **navegação e saída:**
    - ir ao Dashboard e a Lançamentos mantém a comparação; ir à Economia e voltar também;
    - clicar numa categoria abre Lançamentos ainda comparando;
    - "Sair da comparação" volta ao normal no Período 1;
    - escolher um atalho sai da comparação;
  - **Lançamentos:**
    - etiquetas nas linhas;
    - o filtro "Os dois · A · B" muda a lista;
    - as somas do rodapé batem com Entrou/Saiu de cada período (Saídas → total de saídas);
    - sobreposição mostra as duas etiquetas;
  - **"Exportar PDF":** escondido nas três páginas;
  - **celular:** 390 px sem rolagem lateral; console sem erros.

## Fora do escopo

- PDF da comparação.
- Comparação na Economia e em Organizar.
- Agrupar Lançamentos por origem (a opção C).
