# Início em lista, com movimentos (etapa 2 do redesenho, parte 2)

Data: 04/11/2026. Base: `main` em `3c77d55` (identidade "sobrou." e Dashboard em grade já entraram).

## Objetivo

A tela de Início deve levar a pessoa leiga e sem tempo à resposta com o menor número de cliques:
- quem chega pela primeira vez envia o extrato e cai direto no Dashboard;
- quem volta encontra os extratos salvos logo de cara e clica em "Abrir".

O usuário também pediu **animações de movimento**. Ele aprovou os seis movimentos mostrados na página de comparação.

## Decisões do usuário

- Layout **A · Lista primeiro**, escolhido entre A, B (pastas em cartões) e C (duas colunas).
- Depois do envio, o site **salva e abre o Dashboard direto**.
- O extrato é **salvo sempre**. Existe só a opção pequena "Só ver agora, sem salvar".
- Os seis movimentos entram: cascata, área que reage ao arrastar, progresso da leitura, extrato novo ou excluído na lista, troca de pasta e passagem para o Dashboard.

## 1. Arrumação

### Sem extrato salvo (primeira visita)
1. Título "Comece pelo seu extrato" e a frase "Veja para onde vai o seu dinheiro, sem planilha." (este é o slogan que ficou pendente da etapa 1).
2. Área grande de envio (`#drop`, com a classe `drop-big`):
   - ícone, "Arraste o extrato para cá" e a linha "PDF, OFX, CSV ou Excel · um ou vários arquivos";
   - o botão "Escolher arquivos";
   - a caixinha "Só ver agora, sem salvar", desmarcada.
3. Cartão "Como baixar o extrato do seu banco", **aberto**, com 4 passos:
   - abrir o app ou o site do banco e entrar no extrato;
   - escolher o período;
   - tocar em exportar, baixar ou compartilhar e escolher PDF (ou OFX, se tiver);
   - enviar o arquivo aqui.

   Uma linha curta lembra que o PDF é conferido nos bancos C6, Inter, Nubank, Bradesco, Banco do Brasil e Mercado Pago.
4. Linha de segurança: "Seu arquivo vai com segurança e só você vê os seus extratos." Quando "Só ver agora" estiver marcado, ela acrescenta: "Este extrato não será guardado."

### Com extratos salvos
1. Título "Seus extratos" e a mesma frase.
2. **Faixa fina de envio**: a mesma área `#drop`, em formato baixo e na horizontal.
   - "Enviar extrato", "Arraste aqui" e o botão "Escolher arquivo".
   - Com uma pasta escolhida, o texto diz "vai para a pasta **X**".
   - Embaixo da faixa, numa linha pequena: o link "Como baixar o extrato do seu banco" e a caixinha "Só ver agora, sem salvar". O link abre e fecha o mesmo passo a passo (`<details>`).
3. **Etiquetas de pasta** (uma linha que quebra quando precisa), cada uma com a contagem:
   - "Todos", que vem marcada ao entrar;
   - uma etiqueta para cada pasta;
   - "Sem pasta", só quando existe pasta **e** algum extrato fora de pasta;
   - "+ Nova pasta", que abre o formulário de nome já existente.
   - A sugestão "Tem empresa ou MEI? Crie as pastas Pessoal e Empresa" continua igual, logo abaixo das etiquetas.
4. **Cabeçalho da pasta**, só com uma pasta escolhida: "Pasta **X**" com os botões "Ver a pasta inteira" (quando a pasta tem extrato), "Renomear" e "Excluir". Em "Todos" e "Sem pasta" esse cabeçalho não aparece.
5. **Lista**:
   - ordem: do enviado mais recente para o mais antigo;
   - em "Todos", cada linha mostra também o nome da pasta;
   - cada linha mostra o nome, o "⚠ Confira" (quando houver aviso), o período, o número de lançamentos e "enviado em", além de "Abrir" e o ⚙ (renomear, mover, excluir) como hoje. A marca "Aberto agora" continua;
   - lista vazia numa pasta: "Esta pasta ainda não tem extratos." A faixa de envio logo acima já serve para enviar.

### O que sai
- Os dois botões "Enviar novo extrato" e "Extratos salvos", e a troca entre os painéis (`showPanel`).
- Os cartões laterais "Como exportar do seu banco" e "Formatos". O conteúdo vai para o passo a passo e para a linha da área de envio.
- O seletor "na pasta…" (`#savePage`). O destino passa a ser a pasta escolhida nas etiquetas: "Todos" e "Sem pasta" salvam sem pasta.
- O cartão "Últimos extratos" (`#upResult`) com os botões "Ver dashboard / despesas / categorias". O andamento do envio passa para dentro da faixa (veja a seção 2).
- O antigo menu "Vendas" (`#panelVendas`, `#modoSel`) continua escondido e **não é mexido**. Ele só deixa de depender de `showPanel`: o código de vendas mantém o painel dele visível do jeito que precisa.

## 2. Envio

1. Ao escolher ou soltar arquivos, a faixa (ou a área grande) passa para o estado **"Lendo"**: mostra "Lendo N arquivo(s)…" e a barra de progresso (seção 3), e embaixo a lista de arquivos (`#upFiles`), com a linha de cada arquivo como hoje (`linhaArquivo`):
   - lançamentos encontrados e aviso;
   - a caixinha de senha do PDF, com "Abrir" e "Pular este arquivo";
   - a mensagem de erro do arquivo.
2. **Pelo menos um arquivo lido, sem senha pendente:**
   - **Salvar** (padrão): salva na pasta escolhida, carrega o extrato salvo e vai para o Dashboard (`irPara('dashboard')`) com a passagem animada. Um aviso curto confirma "Extrato salvo: N lançamentos" (mais os repetidos ignorados, se houver). O aviso de conferência aparece no Dashboard (`mostrarAvisoLeitura`), como já acontece ao abrir um extrato salvo.
   - **Só ver agora:** carrega sem salvar e vai para o Dashboard do mesmo jeito.
   - **Falha ao salvar:** carrega sem salvar, vai para o Dashboard e mostra o erro no aviso, como hoje.
3. **Nenhum arquivo lido:** a área fica no Início, com o título "Não foi possível ler o extrato", a lista dos arquivos com o motivo de cada um e "Confira o formato do arquivo e tente de novo." Um envio novo limpa esse estado.
4. Quando ainda há senha pendente, o site espera a pessoa abrir ou pular o arquivo, como hoje.
5. Os lançamentos repetidos entre arquivos continuam sendo ignorados como hoje (a regra de contar por arquivo não muda).

## 3. Movimentos

Regras gerais:
- duração de 0,6 s ou menos (o efeito "lendo…", que dura enquanto espera, é a exceção);
- curva `cubic-bezier(.2,.7,.2,1)`;
- só `transform` e `opacity`, sempre que possível;
- `@media (prefers-reduced-motion: reduce)` desliga tudo e mostra o estado final na hora;
- nenhuma biblioteca nova.

1. **Cascata:** ao entrar no Início (`chegou()` com a vista `inicio`), os blocos principais (cabeçalho, envio, etiquetas e as primeiras linhas da lista) sobem 12 px e aparecem, com 80 ms de diferença entre um e outro. Só as 6 primeiras linhas da lista animam. Não repete quando a lista é redesenhada por clique (renomear, menu, pasta).
2. **Área que reage:** com um arquivo arrastado por cima (a classe `over`, que já existe), a borda e o fundo ficam dourados (`--accent`, `--accent-soft`), a área cresce 2% (`scale(1.02)`), aparece um halo suave, o ícone flutua e o texto muda para "Pode soltar". Ao soltar, o ícone desce e some (0,3 s), e a área entra em "Lendo".
3. **Progresso honesto:** o servidor responde a leitura de uma vez só, então a barra não finge porcentagem.
   - Enquanto espera, ela mostra um brilho que corre de um lado para o outro (indeterminado).
   - Com a resposta, a barra completa (0,4 s), o número de lançamentos sobe contando até o total (0,6 s, desacelerando) e aparece "✓ conferido" com um pequeno salto. O "✓ conferido" só aparece quando nenhum arquivo lido trouxe aviso; com aviso, aparece "⚠ confira".
   - Depois disso vem a passagem para o Dashboard, uns 0,5 s depois do fim da contagem, para dar tempo de ver.
4. **Extrato novo ou excluído:**
   - Novo: um extrato que aparece na lista depois de um envio (ao voltar ao Início) entra com altura crescendo e um brilho dourado que some em 2 s.
   - Excluído: ao excluir, a linha encolhe e some (0,3 s) antes de a lista ser redesenhada.
5. **Troca de pasta:** a marcação da etiqueta escolhida desliza até ela (um elemento de fundo posicionado pela etiqueta ativa). A lista some e volta (0,25 s) com o conteúdo novo, sem mudar a rolagem (`keepScroll` continua).
6. **Passagem para o Dashboard:** usada **só** depois de um envio. O Início sai para a esquerda e esmaece, e o Dashboard entra da direita (0,5 s no total). Não é usada na navegação comum pelo menu. O Dashboard continua sendo desenhado com a largura real dos cartões: o desenho acontece com a vista já visível, antes de a animação começar.

## 4. Onde fica cada coisa

- `frontend/index.html`: troca a marcação de `#viewEnviar`, no trecho de despesas.
- `frontend/css/estilo.css`:
  - estilos da faixa, das etiquetas, do cabeçalho da pasta e da lista;
  - movimentos e estado "Lendo";
  - tudo com as variáveis de cor existentes, para funcionar no escuro e no marfim;
  - remove o CSS que ficar sem uso (`.choices`/`.choice` só se o modo vendas não usar, `.up-side`, `.fmts`, `.steps` antigos).
- `frontend/js/pastas.js` (puro, testado), funções novas:
  - `etiquetas(pastas, extratos, atual)`: devolve a lista de etiquetas (id, nome, contagem, marcada), com "Todos", as pastas e "Sem pasta" só quando necessário;
  - `filtrar(extratos, pastas, atual)`: devolve os extratos da etiqueta, do mais recente para o mais antigo;
  - `destino(atual, pastas)`: devolve a pasta que recebe o envio (`null` para Todos, Sem pasta ou pasta que não existe mais).
- `frontend/js/painel.js`:
  - `renderSaved` passa a usar as funções acima e decide entre "primeira visita" e "com extratos";
  - o fim de `readFiles`/`seguirLeitura` salva e abre o Dashboard;
  - novas funções pequenas para os movimentos (`animarEntrada`, `contarAte`, `passarParaDashboard`, `marcarNovo`);
  - o valor inicial de `state.page` passa a ser "Todos" (`null`), e "Sem pasta" vira o valor `'none'`.

## 5. Testes

- `node --test frontend/tests`: testes novos em `pastas.test.js` para `etiquetas`, `filtrar` e `destino`, cobrindo:
  - sem pastas;
  - pastas sem extrato fora de pasta (sem a etiqueta "Sem pasta");
  - pasta apagada;
  - ordem por data de envio;
  - contagens.
- Os testes do servidor (`pytest`) continuam passando, sem mudança no servidor.
- No navegador, nos temas escuro e marfim, na largura de computador e na de celular:
  - primeira visita;
  - envio de um OFX;
  - envio de vários arquivos;
  - PDF com senha;
  - arquivo inválido;
  - "Só ver agora";
  - troca de pasta;
  - nova pasta, renomear e excluir pasta;
  - renomear, mover e excluir extrato;
  - "Ver a pasta inteira";
  - movimentos com e sem "reduzir movimento".

## Fora do escopo

- Despesas, Lançamentos e Organizar (as próximas partes da etapa 2).
- Barra inferior do celular e PWA (etapa 3).
- Guardar o aviso da conferência no banco (pendência antiga).
- Vendas.
