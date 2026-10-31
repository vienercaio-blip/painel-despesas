"""Funções pequenas usadas por todas as rotas."""
from flask import abort, g, jsonify, make_response, request


def uid():
    """Id do usuário logado."""
    return g.usuario["id"]


def corpo():
    """Corpo JSON da requisição (ou dicionário vazio)."""
    dados = request.get_json(silent=True)
    return dados if isinstance(dados, dict) else {}


def erro(mensagem, status=400):
    """Interrompe a requisição devolvendo {"erro": mensagem}."""
    abort(make_response(jsonify(erro=mensagem), status))


def texto(valor, limite, obrigatorio_msg=None):
    """Limpa espaços extras e corta no tamanho máximo."""
    t = " ".join(str(valor or "").split())[:limite]
    if not t and obrigatorio_msg:
        erro(obrigatorio_msg)
    return t


def id_ou_none(valor):
    if valor in (None, "", "none", "null"):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        erro("Identificador inválido.")
