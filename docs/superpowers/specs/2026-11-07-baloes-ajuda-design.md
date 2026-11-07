# Balões de ajuda mais atraentes — especificação

Data: 07/11/2026. Ramo: `baloes-ajuda` (a partir do `main` 7260a76).

## Objetivo

Os 6 balões de ajuda (Início, Dashboard, Despesas, Lançamentos, Organizar, Economia) hoje são uma grade de textos com títulos "1. …", "2. …". Ficam mais atraentes e fáceis de seguir para um público leigo, no estilo **passo a passo com trilho** escolhido pelo usuário no companheiro visual. O Dashboard ganha a explicação de **Entrou, Saiu, Sobrou e Faltou**. O balão também fecha ao clicar de novo em "Ajuda" e fecha sozinho ao trocar de página.

## Decisões do usuário

- Estilo A "passo a passo" (círculos dourados numerados) em **todos** os balões.
- Arrumação "uma coluna com trilho" (linha dourada ligando os números), igual no computador e no celular.
- Explicação completa de Entrou/Saiu/Sobrou/Faltou **só no Dashboard**.
- Movimento ao abrir: passos em cascata e trilho que desce.
- Clicar no botão "Ajuda" com o balão aberto fecha o balão.
- Trocar de página com o balão aberto fecha o balão.

## Visual

Estrutura de cada balão (dentro de `.ajuda-quadro`, que continua sendo o balão ancorado no botão "Ajuda" do canto superior direito):

1. Cabeçalho igual ao de hoje (título em Fraunces + botão "×").
2. Frase de abertura (`.ajuda-lead`) onde já existe.
3. **Passos** (`ol.ajuda-passos`): cada `li.ajuda-passo` tem
   - um círculo de 28px (`.ajuda-num`) com fundo `--accent-soft`, borda e número em `--accent`, peso 800;
   - ao lado, o título do passo (`h3`, sem o "1." no texto, porque o número está no círculo) e o texto (parágrafos/listas atuais).
   - entre um passo e o seguinte, uma linha vertical de 1px (o trilho) saindo do centro do círculo até o próximo, em degradê de `--accent` para transparente (`::before` no `li` que não é o último).
   - a numeração vem do próprio HTML (o número escrito dentro do círculo), para leitores de tela lerem "1, Veredito" de forma previsível; o `ol` fica com `list-style:none`.
4. **Extras** (`div.ajuda-extras`), quando houver assuntos sem número: separados dos passos por uma linha tracejada (`border-top:1px dashed var(--line)`), cada um com um quadradinho de 28px (`.ajuda-ico`, raio 8px, fundo `--surface-2`, borda `--line`) com um ícone SVG em `--accent` no lugar do número.
5. O quadro de exemplo da Economia (`.ajuda-ex`) continua como está, abaixo dos extras.

Some a grade em duas colunas (`.ajuda-grade`) dentro dos balões: tudo fica numa coluna. Funciona nos dois temas (escuro e marfim) só com as variáveis de cor existentes.

Ícones dos extras (SVG em linha, 16px, traço 1.8, mesmo estilo dos ícones do menu): calendário (Escolher o período), duas setas opostas (Comparar dois períodos), documento (Formatos aceitos), olho (Ver um exemplo / Exemplo).

## Conteúdo por balão

Os textos atuais são mantidos; só muda a arrumação. Em cada balão:

| Balão | Passos (trilho) | Extras |
|---|---|---|
| Início | os 4 passos de "Passo a passo" (abrir o extrato no banco, escolher período, exportar PDF/OFX, enviar aqui) | Formatos aceitos (a lista atual); Ver um exemplo (o link atual "Ver um exemplo do painel") |
| Dashboard | 1 Veredito, 2 Entrou, Saiu, Sobrou e Faltou (novo, abaixo), 3 Comparação, 4 Categorias, 5 Meses, Maiores gastos e Previsão, 6 Dicas, detalhes e PDF | Escolher o período; Comparar dois períodos |
| Despesas | 1 Quanto saiu, 2 Categorias, 3 Gastos mês a mês, 4 O que mudou, 5 Maiores gastos e Resumo | Comparar dois períodos; Escolher o período |
| Lançamentos | 1 Período, 2 Entrou, Saiu e Para revisar, 3 Encontrar e ordenar, 4 Corrigir uma categoria, 5 Etiquetas | Comparar dois períodos |
| Organizar | 1 Para revisar, 2 Uma categoria, 3 Nova categoria e regras | — |
| Economia | 1 Meta do mês, 2 Objetivo (opcional), 3 Quanto já guardou, 4 Onde dá para economizar, 5 Quanto consigo guardar por mês, 6 Extrato inteiro e onde fica salvo | — (o quadro "Exemplo" continua no fim) |

### Dashboard, passo 2 — "Entrou, Saiu, Sobrou e Faltou"

Substitui o passo atual "Entrou, Saiu e Sobrou":

- **Entrou**: tudo que chegou na conta (salário, PIX recebido, vendas).
- **Saiu**: tudo que você pagou ou gastou.
- **Sobrou**: Entrou − Saiu, quando entrou mais do que saiu.
- **Faltou**: Saiu − Entrou, quando você gastou mais do que entrou. O cartão "Sobrou" troca de nome para "Faltou" e fica vermelho.

Duas contas desenhadas (`.ajuda-conta`), cada uma uma fileira de três cartõezinhos com "−" e "=" entre eles:

- `Entrou 5.000` − `Saiu 4.200` = `Sobrou 800` (cartão do resultado com borda e valor em `--accent`);
- `Entrou 3.000` − `Saiu 3.400` = `Faltou 400` (borda e valor em `--bad`).

Os valores de Entrou ficam em `--good`. A fileira tem largura máxima de 340px e, no celular, os três cartões dividem a largura (sem estourar a 320px). A conta é imagem de apoio: a fileira tem `role="img"` com `aria-label` ("Exemplo: entrou 5.000 reais, saiu 4.200, sobrou 800") e os cartões internos ficam `aria-hidden`.

Embaixo, mantidos do texto atual: o total do período com a média por mês embaixo e o minigráfico; dinheiro guardado e transferências entre as suas contas não contam como entrada nem saída; estornos descontam do gasto.

O passo "Meses" do Dashboard continua dizendo "sobrou (dourado) ou faltou (vermelho)".

## Movimento

Só com `prefers-reduced-motion: no-preference` (quem pediu para reduzir movimento vê tudo parado), cada vez que um balão abre:

- o balão continua brotando do botão como hoje (`i-brota`);
- cada passo aparece subindo e clareando (0,35s), um depois do outro, com 60ms de atraso entre eles, começando em 0,12s;
- o trilho de cada passo cresce de cima para baixo (`scaleY` de 0 a 1, origem no topo) junto com o passo;
- os extras aparecem por último, juntos.

A animação é reiniciada a cada abertura porque o balão sai de `hidden` (as animações CSS recomeçam quando o elemento volta a ser exibido).

## Abrir e fechar

Em `painel.js`, bloco "Como funciona":

- **Clicar em "Ajuda"**: se o balão está fechado, abre (foco vai para o título, como hoje); se está aberto, fecha (foco fica no botão).
- **"×" e Esc**: continuam fechando, como hoje.
- **Trocar de página**: em `setView`, quando a página mostrada muda, todo balão aberto é fechado sem mover o foco (atualiza `hidden` e `aria-expanded="false"`). Isso cobre o menu, os links internos e os botões "voltar" do navegador.
- A abertura automática do balão do Início na primeira visita (sem extratos) continua igual.

## Fora do escopo

- Mudar os textos além da arrumação e do novo passo 2 do Dashboard.
- Explicação de Entrou/Saiu/Sobrou/Faltou em outros balões.
- Fechar ao clicar fora do balão (hoje não fecha; continua assim).
- Ajuda da página Vendas (não tem balão).

## Testes

Teste no Chrome (`.superpowers/testes-navegador/b1.js`, servidor de teste na porta 5055), a 1280px e a 390px, com e sem "reduzir movimento":

1. Cada um dos 6 balões abre pelo botão "Ajuda", tem `ol.ajuda-passos` com o número certo de passos (4, 6, 5, 5, 3, 6) e os círculos numerados em sequência.
2. Nenhum balão estoura a largura da tela (sem rolagem lateral; o balão cabe entre 0 e a largura da janela).
3. Clicar de novo em "Ajuda" fecha; "×" fecha; Esc fecha; `aria-expanded` acompanha.
4. Com o balão do Dashboard aberto, ir para Despesas pelo menu fecha o balão do Dashboard; voltar ao Dashboard mostra o balão fechado.
5. As contas `.ajuda-conta` existem só no Dashboard (2 fileiras: uma "Sobrou", uma "Faltou").
6. Com movimento: o 3º passo tem animação com atraso maior que o 1º; com "reduzir movimento": nenhuma animação.
7. Console sem erros.

Também rodar os testes antigos que tocam nos balões (`e7`, `e8`, `z1`) e `node --test frontend/tests`.
