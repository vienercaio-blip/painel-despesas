"""Conexão com o banco de dados (SQLite).

Para trocar por PostgreSQL no futuro, é este arquivo (e as consultas SQL)
que muda. O resto do sistema só chama `obter_banco()`.
"""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import current_app, g


def obter_banco():
    """Abre (uma vez por requisição) a conexão com o banco."""
    if "banco" not in g:
        g.banco = sqlite3.connect(current_app.config["BANCO"])
        g.banco.row_factory = sqlite3.Row
        g.banco.execute("PRAGMA foreign_keys = ON")
    return g.banco


def fechar_banco(_erro=None):
    banco = g.pop("banco", None)
    if banco is not None:
        banco.close()


def criar_tabelas(caminho_banco):
    """Cria as tabelas se ainda não existirem."""
    Path(caminho_banco).parent.mkdir(parents=True, exist_ok=True)
    schema = (Path(__file__).parent / "schema.sql").read_text(encoding="utf-8")
    con = sqlite3.connect(caminho_banco)
    try:
        con.executescript(schema)
        _atualizar(con)
        con.commit()
    finally:
        con.close()


def _atualizar(con):
    """Acrescenta colunas novas em bancos criados por versões antigas."""
    colunas = {r[1] for r in con.execute("PRAGMA table_info(paginas)")}
    if "perfil" not in colunas:
        con.execute("ALTER TABLE paginas ADD COLUMN perfil TEXT NOT NULL DEFAULT 'pf'")


def agora():
    """Data e hora atual em texto (formato ISO, UTC)."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def iniciar(app):
    app.teardown_appcontext(fechar_banco)
    criar_tabelas(app.config["BANCO"])
