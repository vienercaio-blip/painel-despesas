# Painel de Despesas — frontend e backend separados

O painel agora tem duas partes:

```
dados_site/
├── backend/            ← o servidor (Python + Flask + banco SQLite)
│   ├── app.py              ponto de partida
│   ├── auth.py             login, logout e criação de usuários
│   ├── banco.py            conexão com o banco de dados
│   ├── schema.sql          as tabelas do banco
│   ├── leitura.py          lê extratos OFX, CSV e Excel (.xlsx)
│   ├── categorizacao.py    categorias padrão e regras de classificação
│   ├── rotas/              a API, separada por assunto
│   ├── templates/          tela de login
│   ├── tests/              testes automáticos + extratos de exemplo
│   └── dados/              (criada sozinha) banco painel.db e chave secreta
└── frontend/           ← as telas (o que roda no navegador)
    ├── index.html
    ├── css/estilo.css
    └── js/
        ├── api.js          todas as conversas com o servidor
        └── painel.js       telas, gráficos e interações
```

**Quem faz o quê**

| Backend (servidor) | Frontend (navegador) |
|---|---|
| Login e separação dos dados de cada cliente | Desenhar telas, gráficos e tabelas |
| Ler os arquivos do banco (OFX, CSV, Excel) | Filtros de período, busca, tooltips |
| Categorizar automaticamente cada despesa | Confirmações antes de cada mudança |
| Guardar extratos, páginas, categorias, regras, correções e preferências | Exportar PDF e CSV |

Antes, tudo isso ficava no `localStorage` do navegador: se o cliente trocasse de computador ou limpasse o navegador, perdia tudo. Agora fica no banco de dados, na conta de cada cliente.

## Como rodar no seu computador (Windows)

Precisa ter o **Python 3.10 ou mais novo** instalado (em python.org; na instalação, marque "Add Python to PATH").

1. Abra o **Prompt de Comando** e entre na pasta do backend:
   ```
   cd C:\Users\CAIO\Desktop\dados_site\backend
   ```
2. Crie um ambiente virtual e instale as dependências (só na primeira vez):
   ```
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Crie o seu login (e um para cada comerciante que for testar):
   ```
   flask --app app criar-usuario
   ```
4. Ligue o servidor:
   ```
   flask --app app run --debug
   ```
5. Abra **http://127.0.0.1:5000** no navegador e entre com o e-mail e a senha.

Nas próximas vezes, basta os passos 1, `.venv\Scripts\activate` e 4.

## Testes

Dentro da pasta `backend`, com o ambiente ativado:
```
python -m pytest
```
São 18 testes: leitura dos 4 formatos, salvar/abrir/mesclar extratos, páginas, categorias, regras, preferências e a garantia de que um cliente não enxerga os dados de outro.

## Endereços da API

Todos exigem login e respondem em JSON.

| Método e endereço | Para quê |
|---|---|
| `GET /api/estado` | Tudo para abrir o painel: perfis, categorias, regras, preferências |
| `POST /api/leitura` | Envia arquivos e recebe os lançamentos lidos e categorizados (não salva) |
| `GET /api/extratos?tipo=despesas` | Lista os extratos salvos |
| `POST /api/extratos` | Salva um extrato |
| `GET /api/extratos/<id>` | Abre um extrato (lançamentos + correções) |
| `PATCH /api/extratos/<id>` | Renomeia ou muda de página |
| `DELETE /api/extratos/<id>` | Exclui |
| `POST /api/extratos/<id>/lancamentos` | Acrescenta lançamentos (ignora repetidos) |
| `PUT /api/extratos/<id>/correcoes` | Guarda as correções "só neste extrato" |
| `POST /api/extratos/mesclar` | Junta vários extratos do mesmo perfil |
| `GET/POST /api/paginas`, `PATCH/DELETE /api/paginas/<id>` | Páginas |
| `POST /api/categorias`, `PATCH/DELETE /api/categorias/<id>` | Categorias criadas pelo cliente |
| `PUT/DELETE /api/categorias-padrao/<perfil>/<posição>` | Editar ou restaurar uma categoria padrão |
| `POST /api/regras`, `DELETE /api/regras?origem=...` | Regras do cliente |
| `POST /api/categorizar` | Recalcula a categoria automática de uma lista de descrições |
| `PUT /api/preferencias/<confirmacoes ou config>` | Preferências |
| `DELETE /api/dados` | Apaga todos os dados do cliente (o login continua) |

## Antes de colocar na internet para os comerciantes

Do jeito que está, é para rodar no seu computador e testar. Para publicar:

- Rodar com um servidor de produção (por exemplo `waitress` no Windows ou `gunicorn` no Linux), nunca com `--debug`.
- Usar **HTTPS** (extrato bancário é dado sensível).
- Definir a variável `SECRET_KEY` no servidor e fazer **backup** do arquivo `dados/painel.db`.
- Trocar SQLite por **PostgreSQL** quando houver vários clientes usando ao mesmo tempo (só `banco.py` e as consultas SQL mudam).
- Escrever a política de privacidade (LGPD): o que é guardado, por quanto tempo e como o cliente apaga.

## Observações

- A leitura de extratos e a categorização em Python foram conferidas contra a versão antiga em JavaScript com os mesmos arquivos: resultados idênticos.
- A planilha de **vendas** continua em pausa; quando voltar, a leitura dela também deve ir para o backend.
- Os extratos salvos no navegador pela versão antiga (artefato) não passam sozinhos para cá: é só enviar os arquivos de novo.
