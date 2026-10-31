"""Conexão com o banco de dados (SQLite).

Para trocar por PostgreSQL no futuro, é este arquivo (e as consultas SQL)
que muda. O resto do sistema só chama `obter_banco()`.
"""
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from flask import current_app, g

from categorizacao import CODIGOS_ANTIGOS, PERFIS, normalizar


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
    _converter_tipos_de_conta(con)


def _converter_tipos_de_conta(con):
    """O perfil MEI / PME ("pme") virou "empresa", e as edições das categorias
    padrão passaram a ser guardadas pelo código ("pf:mercado") em vez da
    posição ("pf:3"). Só encontra o que converter na primeira vez."""
    # edições: as de pf e empresa primeiro, para a de Empresa vencer a de MEI
    antigas = [
        (r[0], r[1], m.group(1), int(m.group(2)))
        for r in con.execute("SELECT usuario_id, chave FROM edicoes_padrao")
        for m in [re.fullmatch(r"(pf|empresa|pme):(\d+)", r[1])] if m
    ]
    antigas.sort(key=lambda x: x[2] == "pme")
    for usuario_id, chave, perfil, pos in antigas:
        codigos = CODIGOS_ANTIGOS[perfil]
        codigo = codigos[pos] if pos < len(codigos) else None
        nova = f"{'pf' if perfil == 'pf' else 'empresa'}:{codigo}"
        ja_existe = con.execute(
            "SELECT 1 FROM edicoes_padrao WHERE usuario_id = ? AND chave = ?", (usuario_id, nova)
        ).fetchone()
        if codigo is None or ja_existe:
            con.execute("DELETE FROM edicoes_padrao WHERE usuario_id = ? AND chave = ?", (usuario_id, chave))
        else:
            con.execute("UPDATE edicoes_padrao SET chave = ? WHERE usuario_id = ? AND chave = ?", (nova, usuario_id, chave))

    # subpastas de MEI vão para Empresa; nome repetido ganha " (MEI)"
    for pid, usuario_id, nome, tipo in con.execute(
        "SELECT id, usuario_id, nome, tipo FROM paginas WHERE perfil = 'pme'"
    ).fetchall():
        repetido = any(
            normalizar(r[0]) == normalizar(nome)
            for r in con.execute(
                "SELECT nome FROM paginas WHERE usuario_id = ? AND tipo = ? AND perfil = 'empresa'", (usuario_id, tipo)
            )
        )
        con.execute(
            "UPDATE paginas SET nome = ?, perfil = 'empresa' WHERE id = ?",
            (nome + " (MEI)" if repetido else nome, pid),
        )

    con.execute("UPDATE extratos SET perfil = 'empresa' WHERE perfil = 'pme'")

    # categoria criada pelo cliente com o nome de uma categoria padrão (ex.: ele
    # criou "Delivery" antes de ela existir): a dele ganha " (sua)", e as regras
    # e correções que apontavam para ela vão junto
    padrao = {normalizar(nome) for p in PERFIS.values() for _, nome, _ in p["regras"]}
    for cid, usuario_id, nome in con.execute("SELECT id, usuario_id, nome FROM categorias").fetchall():
        if normalizar(nome) in padrao:
            novo = nome + " (sua)"
            con.execute("UPDATE categorias SET nome = ? WHERE id = ?", (novo, cid))
            con.execute("UPDATE regras SET categoria = ? WHERE usuario_id = ? AND categoria = ?", (novo, usuario_id, nome))
            con.execute(
                "UPDATE correcoes SET categoria = ? WHERE categoria = ? AND lancamento_id IN ("
                "SELECT l.id FROM lancamentos l JOIN extratos e ON e.id = l.extrato_id WHERE e.usuario_id = ?)",
                (novo, nome, usuario_id),
            )

    for usuario_id, valor in con.execute("SELECT usuario_id, valor FROM preferencias WHERE chave = 'config'").fetchall():
        config = json.loads(valor)
        if isinstance(config, dict) and config.get("perfil") == "pme":
            config["perfil"] = "empresa"
            con.execute(
                "UPDATE preferencias SET valor = ? WHERE usuario_id = ? AND chave = 'config'",
                (json.dumps(config, ensure_ascii=False), usuario_id),
            )


def agora():
    """Data e hora atual em texto (formato ISO, UTC)."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def iniciar(app):
    app.teardown_appcontext(fechar_banco)
    criar_tabelas(app.config["BANCO"])
