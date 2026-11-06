# Página Organizar: lista + detalhe melhorado, animações e "mover" em todo o site — design

Data: 06/11/2026 · Etapa 2 do redesenho "sobrou.", parte 8 (última da etapa 2) · Ramo: `organizar`

## Por que

Hoje a página mistura o detalhe de uma categoria (Origens, Lançamentos) com coisas gerais (Criar,
Regras) em abas presas à categoria escolhida; a aba Lançamentos repete a página Lançamentos; o
texto de Regras cita uma opção que não existe mais. Os usos que importam: **revisar o que ficou sem
categoria**, **mover uma origem inteira**, **criar e editar categorias** e **ver e apagar regras**.

## Escolhas do usuário (06/11)

- Layout **C · lista + detalhe, melhorado** (sem abas).
- Numa categoria dá para: **renomear**, **fixa ou variável**, **palavras-chave**, **apagar** (só as
  criadas pelo usuário; as que vêm no site têm "Restaurar padrão" quando editadas, como hoje).
- **Todas as 8 animações** da demonstração e a animação de **mover** em todos os lugares de mover do site.

## A página (sempre o extrato inteiro, como hoje)

### Lista (esquerda; no celular, em cima)

1. **Para revisar** fixo no topo, com o número de saídas em "Outros (revisar)" e destaque dourado.
   Com zero: "✓ Tudo revisado".
2. As **categorias de saída**: primeiro as que têm gastos (maior total primeiro, nome, total e nº de
   lançamentos, etiqueta "fixa" quando for), depois as sem gastos neste extrato ("sem gastos").
   Movimentos internos e Entrada não aparecem.
3. **+ Nova categoria** e **Todas as regras (N)** embaixo da lista.

A escolhida fica marcada por um marcador dourado que desliza (animação 2).

### Detalhe (direita)

- **Categoria**: nome, etiqueta fixa/variável, "Total · % das saídas · N lançamentos · N origens";
  botões **Editar** e **Apagar** (só criadas) / **Restaurar padrão** (padrão editada).
  - **Editar** abre no lugar o formulário de hoje (nome, tipo fixa/variável, palavras-chave) com
    Salvar/Cancelar; salvar usa as funções de hoje (`API.editarCategoria`/`editarPadrao`).
  - **Apagar** pergunta antes ("Os lançamentos dela voltam para Para revisar") e usa a função de hoje.
  - **Origens**: a lista de hoje (nome, total, pagamentos, último, % e barra) com **Mover todos
    para…** (mesmo comportamento de hoje).
  - **Regras desta categoria**: as regras que mandam para ela, cada uma com **Apagar**. Sem regras:
    uma linha explicando como criar ("ao corrigir uma categoria em Lançamentos, escolha que vale
    para os próximos extratos").
- **Para revisar**: as origens das saídas em "Outros (revisar)", cada uma com total, pagamentos e
  **Mover todos para…**. Zero: "✓ Tudo revisado! Nenhum lançamento sem categoria."
- **Nova categoria**: o formulário de criar de hoje; ao criar, ela entra na lista e fica escolhida.
- **Todas as regras**: a lista de hoje (inclui regras de entradas e de movimentos internos), com Apagar.

Saem: abas Origens/Lançamentos/Criar/Regras, a sub-aba "Criadas" (a edição vai para o detalhe) e o
texto antigo de Regras. A ajuda da página é reescrita.

## Animações (nenhuma com "reduzir movimento")

1. **Detalhe entra**: ao escolher outra categoria, o detalhe entra deslizando da direita e o total conta.
2. **Marcador desliza** na lista até a escolhida.
3. **Mover** (ver abaixo).
4. **Barras das origens** crescem uma depois da outra ao abrir uma categoria.
5. **Editar**: o formulário abre deslizando (altura); ao salvar, o nome acende em verde.
6. **Apagar**: regra ou categoria apagada desliza para o lado e encolhe até sumir antes de redesenhar.
7. **Categoria nova** entra na lista com brilho dourado que some.
8. **"Tudo revisado!"**: ao zerar o Para revisar, o aviso aparece com um salto e confetes discretos (~1 s).

### Mover, em todo o site

Uma função única `voar(origem, destino)`: um "fantasma" da linha movida voa até o destino (posição
na tela), encolhendo e sumindo (~0,6 s); o destino pisca em verde e o número dele, se tiver, dá um
salto. Sem destino visível, o fantasma sobe e some. Usada em:
- **Organizar**: "Mover todos para…" → voa até a categoria de destino na lista; o número do "Para
  revisar" (se mudou) salta.
- **Início**: mover um extrato para uma pasta (menu "Mover para outra pasta" ou arrastar para a
  etiqueta da pasta) → voa até a etiqueta da pasta; o número dela salta.
- **Lançamentos**: corrigir a categoria de uma linha que sai do filtro → em vez de sair deslizando
  para o lado, voa até o número "Para revisar" (ou "Saiu"/"Entrou", conforme o filtro); o ✓ verde
  continua.

## Código

- `index.html`: novo miolo de `#viewCategorias` (lista `#catList` + detalhe `#catDet`), ajuda reescrita.
- `painel.js`: `renderCategorias` reescrita (lista com Para revisar, categorias com e sem gastos,
  detalhe por tipo: categoria / revisar / nova / regras), reaproveitando as funções de hoje de
  editar, criar, apagar, restaurar, mover origem e regras; `voar()` nova, ligada nos três lugares.
- Função pura em `analise.js` (testada): `listaOrganizar(byCat, todas, outros, internos)` →
  `{revisar:n, comGastos:[…], semGastos:[…]}` na ordem da lista.
- `estilo.css`: layout, marcador, animações e o fantasma de `voar`.

## Testes

- `node --test frontend/tests` e `pytest`.
- Chrome (cliques reais, banco de teste restaurado antes): lista com Para revisar no topo e
  categorias sem gastos no fim; escolher categoria mostra o detalhe certo (total igual ao de hoje);
  editar nome/tipo/palavras-chave e salvar; criar categoria (entra e fica escolhida); apagar
  categoria criada (pergunta, some, lançamentos voltam para revisar); apagar regra; mover origem em
  Para revisar (número diminui; "Tudo revisado!" ao zerar); as 8 animações; `voar` no Início
  (menu e arrastar), em Organizar e em Lançamentos; "reduzir movimento"; 390 px; console sem erros.
  Regressões: l1, l3, l4, y6, y7, c3.

## Fora do escopo

Etapa 3 (celular e PWA), Vendas.
