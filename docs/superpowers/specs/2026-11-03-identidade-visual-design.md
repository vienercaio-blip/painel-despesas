# Identidade visual: "sobrou."

Data: 03/11/2026. É a **etapa 1 de 3** do redesenho:
1. identidade visual;
2. arrumação das telas;
3. celular e PWA.

Ramo: `identidade-visual`, criado a partir do `main` **depois** que o ramo `aviso-e-pendencias` for juntado a ele.

## Objetivo

O site deixa de parecer uma ferramenta caseira e ganha uma marca própria, com cara de produto financeiro sério, mas sem assustar quem é leigo. Esta etapa troca nome, logo, cores, fontes e o "esqueleto" da página (o menu). A organização do conteúdo de cada tela fica para a etapa 2.

Decisões tomadas com o usuário, com as comparações visuais em `.superpowers/brainstorm/`:
- **Direção:** moderna e premium. Escuro como base, detalhes dourados, títulos com fonte elegante.
- **Modo claro "marfim":** o site segue o aparelho, com troca manual nas Configurações.
- **Nome:** **Sobrou**, com o logo **"sobrou."** em minúsculas e o ponto dourado.
- **Menu:** uma coluna fixa à esquerda no computador.

## Fora do escopo

- Reorganizar o conteúdo das telas: ordem, textos e cartões ficam para a etapa 2.
- A barra de menu embaixo da tela no celular e o PWA ficam para a etapa 3. Nesta etapa, telas estreitas mantêm um menu no topo que funciona.
- Domínio, registro de marca e logo em arquivo para impressão.

## 1. Marca

- **Nome:** "Sobrou". O logo é a palavra `sobrou` em Fraunces 700, em minúsculas, seguida de um ponto dourado (`.`). Ele é feito em texto mais um `<span>`, sem imagem, para ficar nítido em qualquer tamanho.
- **Ícone (favicon):** "s." em Fraunces sobre um quadrado arredondado `#0E1420`, com o ponto dourado. É um SVG em `frontend/favicon.svg`, ligado no `<head>`.
- **Onde o nome muda:**
  - o `<title>` do site e da página de entrar ("sobrou." e "Entrar · sobrou.");
  - o cabeçalho, que hoje mostra "Grão de Dados";
  - o título do relatório em PDF;
  - o README.
- **Slogan**, usado na página de entrar e no Início: *"Veja para onde vai o seu dinheiro e quanto sobra no mês."*

## 2. Fontes

- **Fraunces** (600 e 700): logo, títulos de página (`h1`), títulos de seção (`h2`) e o título do veredito.
- **Manrope** (400, 600, 700 e 800): o resto. Os números usam `font-variant-numeric: tabular-nums`, para os valores ficarem alinhados.
- As duas fontes vêm do Google Fonts, como as atuais. Bricolage Grotesque, Instrument Sans e IBM Plex Mono saem. Onde o código usa `--font-mono`, a variável passa a apontar para Manrope com números alinhados.

## 3. Cores

Os nomes das variáveis de `:root` em `estilo.css` **continuam os mesmos**, para não ter de mexer no resto do CSS e do JS. Só os valores mudam.

| Variável | Escuro | Claro "marfim" |
|---|---|---|
| `--bg` | `#0E1420` | `#F7F3EA` |
| `--surface` | `#151E2E` | `#FFFDF8` |
| `--surface-2` | `#1B2638` | `#F1EBDD` |
| `--line` | `#23314A` | `#E8DFCB` |
| `--ink` | `#E8ECF3` | `#1A2233` |
| `--ink-2` | `#B4C0D3` | `#4A5466` |
| `--ink-3` | `#8E9BB0` | `#6A7385` |
| `--accent` (dourado) | `#E2B04A` | `#8A6516` (texto) |
| `--accent-ink` (texto sobre dourado) | `#0E1420` | `#F3EBD9` |
| `--accent-soft` | `#3A2E12` | `#FBEBC5` |
| `--good` | `#4CC38A` | `#17804B` |
| `--warn` | `#E3B341` | `#B07A00` |
| `--bad` | `#FF8A80` | `#B42318` |
| `--note-bg`, `--note-ink` e `--note-line` | `#3A2E12`, `#F3D27F` e `#584520` | `#FBEBC5`, `#6B4A00` e `#E8D29A` |
| `--s1` (série principal dos gráficos) | `#E2B04A` | `#C8952F` |
| `--s2` (série secundária) | `#5B6B85` | `#B9B1A0` |
| `--grid` | `#1F2A3B` | `#E8DFCB` |

**Regras:**
- **Botão principal:** fundo dourado com texto escuro no modo escuro; fundo `#0E1420` com texto `#F3EBD9` no modo claro. É a classe `.btn.primary`.
- **Coluna do menu:** escura nos dois modos (`#0A0F18` no escuro e `#0E1420` no claro), com o logo e o ponto dourado. Isso mantém a identidade no modo claro, como na comparação aprovada.
- **Contraste:** todo texto precisa ter pelo menos 4,5:1 sobre o fundo dele (padrão WCAG AA). Por isso o dourado usado em texto no modo claro é mais escuro (`#8A6516`).

## 4. Modo claro e escuro

- O padrão é seguir o aparelho, com `prefers-color-scheme`, como hoje.
- **Nas Configurações**, na seção "Aparência e movimento", entra a opção **Aparência**, com três escolhas: *Automática (segue o aparelho)*, *Clara* e *Escura*.
- A escolha é guardada em `cfg.tema` (`'auto' | 'claro' | 'escuro'`), na preferência `config` que já existe. `applyCfg()` põe `data-theme="light"`, `data-theme="dark"` ou nenhum atributo no `<html>`. O CSS já trata esses atributos.
- Para não piscar a cor errada ao carregar, um `<script>` pequeno no `<head>` lê a última escolha de `localStorage`. Ela é guardada lá por `applyCfg`, só como atalho; o valor que vale é o do servidor.

## 5. O menu na coluna da esquerda

- **Telas com 900 px ou mais de largura:**
  - uma coluna fixa à esquerda, com 220 px de largura e a altura inteira da tela;
  - de cima para baixo: o logo, os itens do menu (Início, Dashboard, Despesas, Lançamentos e Organizar, com as mesmas regras de hoje para aparecer ou sumir) e, no rodapé da coluna, "Olá, nome" e o botão de Configurações;
  - **item atual:** fundo `--surface`, texto em negrito e uma marca dourada de 3 px à esquerda;
  - cada item ganha um ícone simples em SVG desenhado à mão, de traço fino, sem biblioteca nova;
  - o conteúdo ocupa o resto da largura, com o mesmo limite máximo de hoje.
- **Telas com menos de 900 px:**
  - o menu fica no topo, numa barra com o logo à esquerda e o botão de Configurações à direita;
  - embaixo dela, os itens do menu numa linha que rola para os lados.

  A etapa 3 troca isso por uma barra embaixo da tela.
- A marcação passa a ser `<aside class="menu">` com um `<nav>`. Os links continuam sendo `<a class="tab" data-view="...">`, então o `painel.js` (`setView`, `refreshTabs`) não muda de lógica.
- Acessibilidade: o `<nav>` tem `aria-label="Seções"`, o item atual tem `aria-current="page"`, e todos os itens podem ser usados pelo teclado.

## 6. Componentes

Só a aparência muda, nada de estrutura:
- **Cartões:** fundo `--surface`, borda de 1 px `--line`, raio de 14 px e sem sombra no modo escuro.
- **Botões:** raio de 10 px. Além do principal, há o secundário, com contorno, e o fantasma, só com texto dourado.
- **Campos:** raio de 10 px. O foco aparece com um contorno dourado de 2 px.
- **Etiquetas** ("Padrão", "⚠ Confira", "Investimentos e reservas"): formato de pílula, com as cores da comparação aprovada.
- **Vereditos:** a borda esquerda tem a cor da situação (bom, atenção, alerta ou neutro), e o título fica em Fraunces na mesma cor.

## 7. Testes e verificação

- Não há regra nova de negócio, então os testes atuais têm de continuar passando: os do servidor e o `node --test`.
- **Testes novos de JS:** a escolha de tema vira uma função pura num módulo novo, `frontend/js/tema.js`: `Tema.atributo('auto'|'claro'|'escuro') -> null|'light'|'dark'`. Um valor desconhecido vale como `'auto'`. Ela é testada em `frontend/tests/tema.test.js`.
- **Contraste:** um script de conferência, fora do projeto, calcula o contraste dos pares de texto e fundo da tabela da seção 3. Todos precisam ficar em 4,5:1 ou mais.
- **Teste do usuário no navegador,** nos dois modos:
  1. Ver Início, Dashboard, Despesas, Lançamentos e Organizar no modo escuro e no modo claro.
  2. Trocar a aparência nas Configurações.
  3. Diminuir a janela para menos de 900 px e ver o menu ir para o topo.
  4. Gerar o PDF do relatório.
  5. Ver a página de entrar.
