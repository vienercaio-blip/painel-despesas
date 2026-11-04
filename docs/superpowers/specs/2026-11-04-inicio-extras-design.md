# Início: resumo, lembrete, exemplo, arrastar e busca (etapa 2, parte 2b)

Data: 04/11/2026. Base: ramo `inicio-lista` (`22a1534`). Ramo de trabalho: `inicio-extras`.

## Objetivo

Fazer o Início responder sozinho para quem volta, ajudar quem chega e tornar a organização mais rápida. O público continua sendo leigo e sem tempo, e a regra de ouro continua valendo: o site nunca mostra número errado calado. O usuário aprovou os 5 itens e as pendências desta lista em 04/11.

## 1. Resumo do último extrato aberto

- **Lembrar o último aberto:** ao abrir um extrato salvo (`openSaved`) ou uma pasta inteira (`openPasta`), o site guarda `cfg.ultimoAberto = {tipo:'extrato'|'pasta', id}` com `saveCfg()`.
- **Reabrir na entrada:**
  - na primeira resposta de `recarregarSalvos`, se nada estiver carregado (`!state.loaded`) e o último aberto ainda existir, o site o carrega em segundo plano (`carregarSalvo` ou `carregarPasta`), **sem mudar de página**;
  - se ele não existir mais, ou se a carga falhar, nada aparece e não há aviso. A pessoa continua podendo abrir pela lista.
- **Cartão no topo** do Início, só com extratos e com um extrato real carregado (`state.loaded && state.source!=='sample'`):
  - linha pequena: "Último extrato aberto · <nome>" (ou "Última pasta aberta · <nome>") · "<período escolhido>" (`periodName(state.p)`);
  - o veredito (`titulo` colorido + `texto`) e "O que mais pesa…" vêm do mesmo objeto calculado pelo Dashboard (`Analise.veredito(ctx)` dentro de `renderDashboard`). O `renderDashboard` guarda em `state.resumo = {ver, ins, outs, nM}` o que desenhou;
  - três números: Entrou, Saiu e Sobrou **por mês** (total ÷ `nM`), formatados com `brl`;
  - botão "Ver o Dashboard" (`irPara('dashboard')`);
  - borda esquerda na cor do veredito, as mesmas cores do cartão do Dashboard.
- O cartão é desenhado em `renderSaved` (Início) a partir de `state.resumo`. Quando o extrato muda (`render`), ele é redesenhado. Some quando nada está carregado (`fecharExtrato`).

## 2. Lembrete do mês que falta

- Função pura `Pastas.mesesFaltando(ultimaData, hoje)`:
  - `ultimaData` é o texto `AAAA-MM-DD` do fim mais recente entre os extratos da etiqueta escolhida (Todos = todos);
  - devolve a lista de meses **completos** depois do mês de `ultimaData` e antes do mês de `hoje`, como `[{ano, mes}]` (mes de 0 a 11);
  - exemplo: fim 28/10/2026 e hoje 04/11/2026 → `[]`; hoje 05/12/2026 → `[nov/2026]`; hoje 10/02/2027 → `[nov, dez/2026, jan/2027]`.
- `Pastas.textoLembrete(meses)`:
  - 1 mês → "Falta o extrato de novembro.";
  - 2 → "Faltam os extratos de novembro e dezembro.";
  - 3 ou mais → "Faltam os extratos desde novembro.";
  - quando o ano do mês faltante é diferente do ano de hoje, o nome do mês ganha o ano ("novembro de 2026").
- Faixa no Início, logo abaixo do cartão de resumo: "📅 " + texto + " Envie para manter a conta em dia.", com o botão "Agora não".
  - "Agora não" grava `cfg.lembreteVisto = 'AAAA-MM'` (mês de hoje) e esconde a faixa até o mês seguinte.
  - Só aparece com extratos salvos. Usa o estilo de nota (`--note-bg`/`--note-ink`).

## 3. Ver um exemplo

- **Servidor:** `GET /api/exemplo` (com login) lê `backend/exemplo/extrato-exemplo.ofx`, uma cópia de `dados_teste/extrato-pessoa-fisica-com-entradas-2025-2026.ofx`, e responde como `/api/leitura`: `{nome:'Extrato de exemplo', lancamentos:[...]}`, categorizado com o categorizador do usuário. Nada é salvo.
- **Tela:**
  - botão "Ver um exemplo" (estilo `btn`, sem destaque) ao lado de "Escolher arquivos", só na área grande da primeira visita;
  - um link "Ver um exemplo do painel" no fim do quadro Ajuda, que vale nos dois modos.
- **Ao clicar:** `load(lista, 'sample', 'Extrato de exemplo')` e `irPara('dashboard')`. O selo "Exemplo · dados fictícios" e o texto de exemplo já existem.
  - O texto de `srcText` no modo exemplo passa a ser: "Este é um extrato de exemplo, de <início> a <fim>. Envie o extrato do seu banco para ver os seus números." (com as datas reais do exemplo).
  - O exemplo não vira o "último aberto" e não mostra cartão de resumo.

## 4. Arrastar o extrato para a pasta (computador)

- Cada linha da lista ganha a alça "⠿" (`<span class="sv-alca" aria-hidden="true">`) e `draggable="true"` (só em despesas).
- Ao arrastar sobre uma etiqueta de pasta (inclusive "Sem pasta"; "Todos" não aceita), a etiqueta ganha a classe `alvo` (borda tracejada dourada).
- Ao soltar numa etiqueta diferente da pasta atual do extrato: `API.alterarExtrato(id, {pagina_id})` → `recarregarSalvos()` → aviso "Extrato movido para a pasta X." (ou "para "Sem pasta"."). Sem confirmação: arrastar já é um gesto deliberado.
- A área de envio (`#drop`) ignora o arrasto de linhas: só reage quando há arquivos (`dataTransfer.types` contém `Files`).
- No celular continua o "Mover para" do ⚙. O toque não dispara arrasto nativo, e nada muda lá.

## 5. Busca

- Campo "Buscar extrato" (`<input type="search" id="svBusca">`) na linha das etiquetas, alinhado à direita. Só aparece quando há 10 extratos ou mais (`todos.length>=10`).
- `Pastas.buscar(lista, texto)` filtra pelo nome, sem ligar para maiúsculas e acentos (`chave`). Texto vazio devolve a lista inteira.
- A busca vale dentro da etiqueta escolhida. Sem resultado: "Nenhum extrato com "<texto>"." O texto fica guardado em `state.busca` e não se perde ao redesenhar.

## 6. Pendências que entram

1. **Título:** `#upTitle` fica "Início" até `state.salvosProntos`.
2. **Etiquetas pelo teclado:** a lista de etiquetas usa *roving tabindex* (só a marcada com `tabindex=0`), as setas ←/→ (e Home/End) mudam a etiqueta, e depois da troca o foco volta para a etiqueta escolhida.
3. **Salvo mas não abriu:** se `recarregarSalvos`/`carregarSalvo` falhar depois do salvamento: `estadoEnvio('normal')` e o aviso "Extrato salvo, mas não foi possível abrir agora. Ele está na lista."
4. **Senha antiga:** o `.catch` do envio de senha ignora a resposta se `state.leitura !== L`.
5. **Pulou todos:** se não sobrar nenhum arquivo depois de pular as senhas: `estadoEnvio('normal')` e a mensagem "Você pulou todos os arquivos. Nada foi lido."
6. **Abrir outro durante a contagem:** `openSaved`/`openPasta` incrementam `state.escolhaManual`. O envio guarda o valor ao começar e, se ele mudou antes de abrir, só salva, atualiza a lista e avisa "Extrato salvo: N lançamentos. Ele está na lista.", sem trocar o extrato aberto.
7. **Vendas:** o botão "+ Nova pasta" diz "+ Nova página" no modo vendas.

## Testes

- `node --test frontend/tests`: `mesesFaltando`, `textoLembrete` e `buscar`.
- `pytest`: `/api/exemplo` exige login e devolve lançamentos categorizados.
- Navegador (Chrome automático com banco temporário, mais o teste do usuário):
  - resumo na entrada, com os mesmos números do Dashboard;
  - lembrete, testado com uma data simulada;
  - exemplo;
  - arrastar para a pasta (com eventos de arrasto simulados);
  - busca com 10 ou mais extratos;
  - teclado nas etiquetas;
  - cada pendência.

## Fora do escopo

- Arrastar no celular.
- Desfazer a mudança de pasta.
- O resto dos detalhes visuais do modo Vendas.
