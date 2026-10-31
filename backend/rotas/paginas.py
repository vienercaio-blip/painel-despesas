"""Páginas: pastas para organizar os extratos salvos."""
from flask import jsonify, request

from auth import login_obrigatorio
from banco import agora, obter_banco
from categorizacao import normalizar
from rotas import api
from rotas.util import corpo, erro, texto, uid

TIPOS = {"despesas", "vendas"}


def _json(r):
    return {"id": str(r["id"]), "nome": r["nome"], "tipo": r["tipo"], "criado_em": r["criado_em"]}


def _nome_em_uso(banco, nome, tipo, exceto=None):
    for r in banco.execute("SELECT id, nome FROM paginas WHERE usuario_id = ? AND tipo = ?", (uid(), tipo)):
        if r["id"] != exceto and normalizar(r["nome"]) == normalizar(nome):
            return True
    return False


def _buscar(banco, pagina_id):
    r = banco.execute("SELECT * FROM paginas WHERE id = ? AND usuario_id = ?", (pagina_id, uid())).fetchone()
    if r is None:
        erro("Página não encontrada.", 404)
    return r


@api.get("/paginas")
@login_obrigatorio
def listar_paginas():
    tipo = request.args.get("tipo", "despesas")
    linhas = obter_banco().execute(
        "SELECT * FROM paginas WHERE usuario_id = ? AND tipo = ? ORDER BY id", (uid(), tipo)
    )
    return jsonify([_json(r) for r in linhas])


@api.post("/paginas")
@login_obrigatorio
def criar_pagina():
    d = corpo()
    tipo = d.get("tipo", "despesas")
    if tipo not in TIPOS:
        erro("Tipo inválido.")
    nome = texto(d.get("nome"), 40, "Dê um nome para a página.")
    banco = obter_banco()
    if _nome_em_uso(banco, nome, tipo):
        erro(f'Já existe uma página chamada "{nome}".', 409)
    cur = banco.execute(
        "INSERT INTO paginas (usuario_id, nome, tipo, criado_em) VALUES (?, ?, ?, ?)", (uid(), nome, tipo, agora())
    )
    banco.commit()
    return jsonify(_json(_buscar(banco, cur.lastrowid))), 201


@api.patch("/paginas/<int:pagina_id>")
@login_obrigatorio
def renomear_pagina(pagina_id):
    banco = obter_banco()
    pagina = _buscar(banco, pagina_id)
    nome = texto(corpo().get("nome"), 40, "Dê um nome para a página.")
    if _nome_em_uso(banco, nome, pagina["tipo"], exceto=pagina_id):
        erro(f'Já existe uma página chamada "{nome}".', 409)
    banco.execute("UPDATE paginas SET nome = ? WHERE id = ?", (nome, pagina_id))
    banco.commit()
    return jsonify(_json(_buscar(banco, pagina_id)))


@api.delete("/paginas/<int:pagina_id>")
@login_obrigatorio
def excluir_pagina(pagina_id):
    """Exclui a página. Os extratos dela não são apagados: ficam "Sem página"."""
    banco = obter_banco()
    _buscar(banco, pagina_id)
    banco.execute("UPDATE extratos SET pagina_id = NULL WHERE pagina_id = ?", (pagina_id,))
    banco.execute("DELETE FROM paginas WHERE id = ?", (pagina_id,))
    banco.commit()
    return jsonify(ok=True)
