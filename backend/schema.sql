-- Estrutura do banco de dados do painel.
-- Cada tabela com "usuario_id" guarda dados de um cliente só:
-- um usuário nunca enxerga os dados de outro.

CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  senha_hash  TEXT NOT NULL,
  criado_em   TEXT NOT NULL
);

-- Páginas: pastas para organizar os extratos salvos.
CREATE TABLE IF NOT EXISTS paginas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'despesas',   -- 'despesas' ou 'vendas'
  criado_em   TEXT NOT NULL
);

-- Extratos (ou planilhas de vendas) salvos.
CREATE TABLE IF NOT EXISTS extratos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  pagina_id   INTEGER REFERENCES paginas(id) ON DELETE SET NULL,
  tipo        TEXT NOT NULL DEFAULT 'despesas',
  nome        TEXT NOT NULL,
  perfil      TEXT NOT NULL DEFAULT 'pf',         -- 'pf', 'empresa' ou 'pme'
  linhas_json TEXT,                               -- só para planilhas de vendas (recurso em pausa)
  salvo_em    TEXT NOT NULL
);

-- Cada linha do extrato bancário.
CREATE TABLE IF NOT EXISTS lancamentos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  extrato_id  INTEGER NOT NULL REFERENCES extratos(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,                      -- AAAA-MM-DD
  descricao   TEXT NOT NULL,
  valor       REAL NOT NULL                       -- negativo = saída
);
CREATE INDEX IF NOT EXISTS idx_lanc_extrato ON lancamentos(extrato_id, data);

-- Correções "só neste extrato": a categoria escolhida à mão para um lançamento.
CREATE TABLE IF NOT EXISTS correcoes (
  lancamento_id INTEGER PRIMARY KEY REFERENCES lancamentos(id) ON DELETE CASCADE,
  categoria     TEXT NOT NULL
);

-- Regras do cliente: "esta origem é sempre desta categoria", em todos os extratos.
CREATE TABLE IF NOT EXISTS regras (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  origem      TEXT NOT NULL,
  categoria   TEXT NOT NULL,
  rotulo      TEXT NOT NULL,
  criada_em   TEXT NOT NULL,
  PRIMARY KEY (usuario_id, origem)
);

-- Categorias criadas pelo cliente.
CREATE TABLE IF NOT EXISTS categorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'variavel',   -- 'fixo' ou 'variavel'
  palavras    TEXT NOT NULL DEFAULT '[]',         -- lista JSON de palavras-chave
  criada_em   TEXT NOT NULL
);

-- Ajustes feitos pelo cliente nas categorias padrão do sistema.
-- chave = "perfil:posição", por exemplo "pf:3".
CREATE TABLE IF NOT EXISTS edicoes_padrao (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave       TEXT NOT NULL,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  palavras    TEXT,                               -- NULL = mantém as palavras originais
  PRIMARY KEY (usuario_id, chave)
);

-- Preferências do cliente (configurações da tela e confirmações desligadas).
CREATE TABLE IF NOT EXISTS preferencias (
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave       TEXT NOT NULL,
  valor       TEXT NOT NULL,                      -- JSON
  PRIMARY KEY (usuario_id, chave)
);
