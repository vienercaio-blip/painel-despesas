"""Estado inicial do painel, preferências e apagar dados."""
import json

from flask import g, jsonify

from auth import login_obrigatorio
from banco import obter_banco
from categorizacao import OUTROS, PERFIS, carregar_edicoes
from rotas import api
from rotas.categorias import listar_categorias, listar_regras
from rotas.util import corpo, erro, uid

PREFERENCIAS_VALIDAS = {"confirmacoes", "config"}


@api.get("/estado")
@login_obrigatorio
def estado():
    """Tudo o que o painel precisa para abrir: perfis e categorias padrão,
    categorias e regras do cliente, e as preferências salvas."""
    banco = obter_banco()
    prefs = {k: {} for k in PREFERENCIAS_VALIDAS}
    for r in banco.execute("SELECT chave, valor FROM preferencias WHERE usuario_id = ?", (uid(),)):
        prefs[r["chave"]] = json.loads(r["valor"])
    return jsonify(
        usuario={"nome": g.usuario["nome"], "email": g.usuario["email"]},
        outros=OUTROS,
        perfis={
            k: {"rotulo": p["rotulo"], "regras": p["regras"], "fixas": p["fixas"]}
            for k, p in PERFIS.items()
        },
        categorias=listar_categorias(banco, uid()),
        edicoes=carregar_edicoes(banco, uid()),
        regras=listar_regras(banco, uid()),
        preferencias=prefs,
    )


@api.put("/preferencias/<chave>")
@login_obrigatorio
def salvar_preferencia(chave):
    if chave not in PREFERENCIAS_VALIDAS:
        erro("Preferência desconhecida.", 404)
    valor = corpo().get("valor")
    if not isinstance(valor, dict):
        erro("Valor inválido.")
    banco = obter_banco()
    banco.execute(
        "INSERT INTO preferencias (usuario_id, chave, valor) VALUES (?, ?, ?) "
        "ON CONFLICT(usuario_id, chave) DO UPDATE SET valor = excluded.valor",
        (uid(), chave, json.dumps(valor, ensure_ascii=False)),
    )
    banco.commit()
    return jsonify(ok=True)


@api.delete("/dados")
@login_obrigatorio
def apagar_dados():
    """Apaga todos os dados do cliente (extratos, páginas, categorias,
    regras e preferências). O login continua existindo."""
    banco = obter_banco()
    for tabela in ("extratos", "paginas", "regras", "categorias", "edicoes_padrao", "preferencias"):
        banco.execute(f"DELETE FROM {tabela} WHERE usuario_id = ?", (uid(),))
    banco.commit()
    return jsonify(ok=True)
