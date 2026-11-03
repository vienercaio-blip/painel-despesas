"""Páginas: as pastas que o cliente cria para organizar os extratos salvos.

Um nível só, com nome livre (sem repetir). Extrato sem pasta fica em "Sem pasta"."""
from collections import Counter

from flask import jsonify, request

from auth import login_obrigatorio
from banco import agora, obter_banco
from categorizacao import carregar_categorizador, normalizar, preparar_lancamentos
from rotas import api
from rotas.extratos import gravar_correcoes
from rotas.util import corpo, erro, texto, uid

TIPOS = {"despesas", "vendas"}


def _json(r):
    return {"id": str(r["id"]), "nome": r["nome"], "tipo": r["tipo"], "criado_em": r["criado_em"]}


def _nome_em_uso(banco, nome, tipo, exceto=None):
    for r in banco.execute("SELECT id, nome FROM paginas WHERE usuario_id = ? AND tipo = ?", (uid(), tipo)):
        if r["id"] != exceto and normalizar(r["nome"]) == normalizar(nome):
            return True
    return False


def sem_repetidos(grupos):
    """Junta os lançamentos de vários extratos (um grupo por extrato, do mais
    antigo para o mais novo), contando uma vez só o que se repete entre eles.
    Repetidos dentro de um mesmo extrato são legítimos: de cada lançamento
    ficam tantas cópias quanto o extrato que mais tem. Devolve (lista, saíram)."""
    ficaram = Counter()
    lista, sairam = [], 0
    for grupo in grupos:
        no_grupo = Counter()
        for l in grupo:
            chave = (l["data"], normalizar(l["descricao"]), l["valor"])
            no_grupo[chave] += 1
            if no_grupo[chave] > ficaram[chave]:
                lista.append(l)
            else:
                sairam += 1
        for chave, n in no_grupo.items():
            ficaram[chave] = max(ficaram[chave], n)
    return lista, sairam


def _buscar(banco, pagina_id):
    r = banco.execute("SELECT * FROM paginas WHERE id = ? AND usuario_id = ?", (pagina_id, uid())).fetchone()
    if r is None:
        erro("Pasta não encontrada.", 404)
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
    nome = texto(d.get("nome"), 40, "Dê um nome para a pasta.")
    banco = obter_banco()
    if _nome_em_uso(banco, nome, tipo):
        erro(f'Já existe uma pasta chamada "{nome}".', 409)
    cur = banco.execute(
        "INSERT INTO paginas (usuario_id, nome, tipo, perfil, criado_em) VALUES (?, ?, ?, 'unico', ?)",
        (uid(), nome, tipo, agora()),
    )
    banco.commit()
    return jsonify(_json(_buscar(banco, cur.lastrowid))), 201


@api.patch("/paginas/<int:pagina_id>")
@login_obrigatorio
def renomear_pagina(pagina_id):
    banco = obter_banco()
    pagina = _buscar(banco, pagina_id)
    nome = texto(corpo().get("nome"), 40, "Dê um nome para a pasta.")
    if _nome_em_uso(banco, nome, pagina["tipo"], exceto=pagina_id):
        erro(f'Já existe uma pasta chamada "{nome}".', 409)
    banco.execute("UPDATE paginas SET nome = ? WHERE id = ?", (nome, pagina_id))
    banco.commit()
    return jsonify(_json(_buscar(banco, pagina_id)))


@api.delete("/paginas/<int:pagina_id>")
@login_obrigatorio
def excluir_pagina(pagina_id):
    """Exclui a pasta. Os extratos dela não são apagados: voltam para "Sem pasta"."""
    banco = obter_banco()
    _buscar(banco, pagina_id)
    banco.execute("UPDATE extratos SET pagina_id = NULL WHERE pagina_id = ?", (pagina_id,))
    banco.execute("DELETE FROM paginas WHERE id = ?", (pagina_id,))
    banco.commit()
    return jsonify(ok=True)


def _pasta_de_extratos(banco, pagina_id):
    """A pasta (de extratos bancários) e os ids dos extratos dela, do mais antigo para o mais novo."""
    pagina = _buscar(banco, pagina_id)
    if pagina["tipo"] != "despesas":
        erro("Pasta não encontrada.", 404)
    ids = [r["id"] for r in banco.execute(
        "SELECT id FROM extratos WHERE pagina_id = ? AND usuario_id = ? AND tipo = 'despesas' ORDER BY id",
        (pagina_id, uid()),
    )]
    return pagina, ids


@api.get("/paginas/<int:pagina_id>/lancamentos")
@login_obrigatorio
def abrir_pasta(pagina_id):
    """Todos os extratos da pasta somados, sem os repetidos entre extratos."""
    banco = obter_banco()
    pagina, ids = _pasta_de_extratos(banco, pagina_id)
    grupos = [
        [{"id": str(r["id"]), "extrato_id": str(eid), "data": r["data"], "descricao": r["descricao"], "valor": r["valor"]}
         for r in banco.execute("SELECT id, data, descricao, valor FROM lancamentos WHERE extrato_id = ? ORDER BY data, id", (eid,))]
        for eid in ids
    ]
    lancamentos, repetidos = sem_repetidos(grupos)
    lancamentos.sort(key=lambda l: (l["data"], int(l["id"])))
    ficaram = {l["id"] for l in lancamentos}
    correcoes = {}
    for eid in ids:
        for r in banco.execute(
            "SELECT c.lancamento_id, c.categoria FROM correcoes c "
            "JOIN lancamentos l ON l.id = c.lancamento_id WHERE l.extrato_id = ?", (eid,)
        ):
            if str(r["lancamento_id"]) in ficaram:
                correcoes[str(r["lancamento_id"])] = r["categoria"]
    return jsonify(
        id=str(pagina["id"]),
        nome=pagina["nome"],
        extratos=[str(i) for i in ids],
        lancamentos=preparar_lancamentos(lancamentos, carregar_categorizador(banco, uid())),
        correcoes=correcoes,
        repetidos=repetidos,
    )


@api.put("/paginas/<int:pagina_id>/correcoes")
@login_obrigatorio
def salvar_correcoes_pasta(pagina_id):
    """Substitui as correções "só neste extrato" dos lançamentos da pasta."""
    banco = obter_banco()
    _, ids = _pasta_de_extratos(banco, pagina_id)
    ids_validos = {
        r["id"] for eid in ids for r in banco.execute("SELECT id FROM lancamentos WHERE extrato_id = ?", (eid,))
    }
    gravar_correcoes(banco, ids_validos, corpo().get("correcoes"))
    banco.commit()
    return jsonify(ok=True)
