"""Extratos salvos: listar, salvar, abrir, renomear, mover, excluir,
acrescentar lançamentos, guardar correções e mesclar."""
import json
import math

from flask import jsonify, request

from auth import login_obrigatorio
from banco import agora, obter_banco
from categorizacao import carregar_categorizador, perfil_valido, preparar_lancamentos
from leitura import ler_data
from rotas import api
from rotas.util import corpo, erro, id_ou_none, texto, uid

TIPOS = {"despesas", "vendas"}
MAX_LANCAMENTOS = 100_000


# ---------- funções de apoio ----------

def _meta(banco, linha):
    """Resumo de um extrato para a lista de salvos."""
    if linha["tipo"] == "vendas":
        linhas = json.loads(linha["linhas_json"] or "[]")
        qtd = len(linhas)
        inicio = linhas[0][0] if linhas else None
        fim = linhas[-1][0] if linhas else None
    else:
        r = banco.execute(
            "SELECT COUNT(*) AS n, MIN(data) AS ini, MAX(data) AS fim FROM lancamentos WHERE extrato_id = ?",
            (linha["id"],),
        ).fetchone()
        qtd, inicio, fim = r["n"], r["ini"], r["fim"]
    return {
        "id": str(linha["id"]),
        "nome": linha["nome"],
        "tipo": linha["tipo"],
        "perfil": linha["perfil"],
        "pagina_id": str(linha["pagina_id"]) if linha["pagina_id"] is not None else None,
        "salvo_em": linha["salvo_em"],
        "quantidade": qtd,
        "inicio": inicio,
        "fim": fim,
    }


def _buscar(banco, extrato_id):
    linha = banco.execute(
        "SELECT * FROM extratos WHERE id = ? AND usuario_id = ?", (extrato_id, uid())
    ).fetchone()
    if linha is None:
        erro("Extrato não encontrado.", 404)
    return linha


def _validar_pagina(banco, pagina_id, tipo):
    if pagina_id is None:
        return None
    ok = banco.execute(
        "SELECT 1 FROM paginas WHERE id = ? AND usuario_id = ? AND tipo = ?", (pagina_id, uid(), tipo)
    ).fetchone()
    if not ok:
        erro("Página não encontrada.", 404)
    return pagina_id


def _limpar_lancamentos(lista):
    """Confere cada lançamento recebido do navegador antes de gravar."""
    if not isinstance(lista, list):
        erro("Lista de lançamentos inválida.")
    if len(lista) > MAX_LANCAMENTOS:
        erro("Extrato grande demais.")
    limpos = []
    for item in lista:
        if not isinstance(item, dict):
            erro("Lançamento inválido.")
        data = ler_data(item.get("data"))
        valor = item.get("valor")
        if data is None or not isinstance(valor, (int, float)) or isinstance(valor, bool) or not math.isfinite(valor):
            erro("Lançamento com data ou valor inválido.")
        limpos.append({
            "data": data.isoformat(),
            "descricao": texto(item.get("descricao"), 300) or "Sem descrição",
            "valor": round(float(valor), 2),
        })
    return limpos


def _inserir_lancamentos(banco, extrato_id, lista):
    """Grava os lançamentos que ainda não existem no extrato.
    Devolve (adicionados, repetidos)."""
    existentes = {
        (r["data"], r["descricao"], r["valor"])
        for r in banco.execute("SELECT data, descricao, valor FROM lancamentos WHERE extrato_id = ?", (extrato_id,))
    }
    novos = []
    for l in lista:
        chave = (l["data"], l["descricao"], l["valor"])
        if chave in existentes:
            continue
        existentes.add(chave)
        novos.append((extrato_id, l["data"], l["descricao"], l["valor"]))
    banco.executemany("INSERT INTO lancamentos (extrato_id, data, descricao, valor) VALUES (?, ?, ?, ?)", novos)
    return len(novos), len(lista) - len(novos)


# ---------- rotas ----------

@api.get("/extratos")
@login_obrigatorio
def listar_extratos():
    tipo = request.args.get("tipo", "despesas")
    banco = obter_banco()
    linhas = banco.execute(
        "SELECT * FROM extratos WHERE usuario_id = ? AND tipo = ? ORDER BY salvo_em DESC, id DESC",
        (uid(), tipo),
    ).fetchall()
    return jsonify([_meta(banco, l) for l in linhas])


@api.post("/extratos")
@login_obrigatorio
def salvar_extrato():
    d = corpo()
    tipo = d.get("tipo", "despesas")
    if tipo not in TIPOS:
        erro("Tipo inválido.")
    banco = obter_banco()
    nome = texto(d.get("nome"), 120) or "Extrato"
    pagina_id = _validar_pagina(banco, id_ou_none(d.get("pagina_id")), tipo)
    perfil = perfil_valido(d.get("perfil"))

    linhas_json = None
    if tipo == "vendas":
        linhas = d.get("linhas")
        if not isinstance(linhas, list) or len(linhas) > MAX_LANCAMENTOS:
            erro("Planilha inválida.")
        linhas_json = json.dumps(linhas, ensure_ascii=False)
    else:
        lancamentos = _limpar_lancamentos(d.get("lancamentos"))
        if not lancamentos:
            erro("O extrato não tem lançamentos.")

    cur = banco.execute(
        "INSERT INTO extratos (usuario_id, pagina_id, tipo, nome, perfil, linhas_json, salvo_em) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (uid(), pagina_id, tipo, nome, perfil, linhas_json, agora()),
    )
    if tipo == "despesas":
        _inserir_lancamentos(banco, cur.lastrowid, lancamentos)
    banco.commit()
    return jsonify(_meta(banco, _buscar(banco, cur.lastrowid))), 201


@api.get("/extratos/<int:extrato_id>")
@login_obrigatorio
def abrir_extrato(extrato_id):
    """Extrato completo: lançamentos já categorizados e correções."""
    banco = obter_banco()
    linha = _buscar(banco, extrato_id)
    resposta = _meta(banco, linha)
    if linha["tipo"] == "vendas":
        resposta["linhas"] = json.loads(linha["linhas_json"] or "[]")
        return jsonify(resposta)

    lancamentos = [
        {"id": str(r["id"]), "data": r["data"], "descricao": r["descricao"], "valor": r["valor"]}
        for r in banco.execute(
            "SELECT id, data, descricao, valor FROM lancamentos WHERE extrato_id = ? ORDER BY data, id",
            (extrato_id,),
        )
    ]
    categorizador = carregar_categorizador(banco, uid(), linha["perfil"])
    resposta["lancamentos"] = preparar_lancamentos(lancamentos, categorizador)
    resposta["correcoes"] = {
        str(r["lancamento_id"]): r["categoria"]
        for r in banco.execute(
            "SELECT c.lancamento_id, c.categoria FROM correcoes c "
            "JOIN lancamentos l ON l.id = c.lancamento_id WHERE l.extrato_id = ?",
            (extrato_id,),
        )
    }
    return jsonify(resposta)


@api.patch("/extratos/<int:extrato_id>")
@login_obrigatorio
def alterar_extrato(extrato_id):
    """Renomear (nome) e/ou mover de página (pagina_id)."""
    d = corpo()
    banco = obter_banco()
    linha = _buscar(banco, extrato_id)
    if "nome" in d:
        nome = texto(d["nome"], 120, "Dê um nome para o extrato.")
        banco.execute("UPDATE extratos SET nome = ? WHERE id = ?", (nome, extrato_id))
    if "pagina_id" in d:
        pagina_id = _validar_pagina(banco, id_ou_none(d["pagina_id"]), linha["tipo"])
        banco.execute("UPDATE extratos SET pagina_id = ? WHERE id = ?", (pagina_id, extrato_id))
    banco.commit()
    return jsonify(_meta(banco, _buscar(banco, extrato_id)))


@api.delete("/extratos/<int:extrato_id>")
@login_obrigatorio
def excluir_extrato(extrato_id):
    banco = obter_banco()
    _buscar(banco, extrato_id)
    banco.execute("DELETE FROM extratos WHERE id = ?", (extrato_id,))
    banco.commit()
    return jsonify(ok=True)


@api.post("/extratos/<int:extrato_id>/lancamentos")
@login_obrigatorio
def acrescentar_lancamentos(extrato_id):
    """Acrescenta lançamentos de novos arquivos a um extrato salvo,
    ignorando os repetidos."""
    d = corpo()
    banco = obter_banco()
    linha = _buscar(banco, extrato_id)
    if linha["tipo"] != "despesas":
        erro("Só é possível acrescentar lançamentos a extratos.")
    adicionados, repetidos = _inserir_lancamentos(banco, extrato_id, _limpar_lancamentos(d.get("lancamentos")))
    if d.get("nome"):
        banco.execute("UPDATE extratos SET nome = ? WHERE id = ?", (texto(d["nome"], 120), extrato_id))
    banco.commit()
    resposta = _meta(banco, _buscar(banco, extrato_id))
    resposta.update(adicionados=adicionados, repetidos=repetidos)
    return jsonify(resposta)


@api.put("/extratos/<int:extrato_id>/correcoes")
@login_obrigatorio
def salvar_correcoes(extrato_id):
    """Substitui as correções "só neste extrato" ({id_lançamento: categoria})."""
    correcoes = corpo().get("correcoes")
    if not isinstance(correcoes, dict):
        erro("Correções inválidas.")
    banco = obter_banco()
    _buscar(banco, extrato_id)
    ids_validos = {
        r["id"] for r in banco.execute("SELECT id FROM lancamentos WHERE extrato_id = ?", (extrato_id,))
    }
    banco.execute(
        "DELETE FROM correcoes WHERE lancamento_id IN (SELECT id FROM lancamentos WHERE extrato_id = ?)",
        (extrato_id,),
    )
    for lanc_id, categoria in correcoes.items():
        lanc_id = id_ou_none(lanc_id)
        if lanc_id in ids_validos and isinstance(categoria, str) and categoria.strip():
            banco.execute(
                "INSERT INTO correcoes (lancamento_id, categoria) VALUES (?, ?)", (lanc_id, categoria.strip()[:80])
            )
    banco.commit()
    return jsonify(ok=True)


@api.post("/extratos/mesclar")
@login_obrigatorio
def mesclar_extratos():
    """Junta dois ou mais extratos do mesmo perfil num extrato novo."""
    d = corpo()
    ids = [id_ou_none(i) for i in (d.get("ids") or [])]
    ids = list(dict.fromkeys(i for i in ids if i is not None))
    if len(ids) < 2:
        erro("Escolha pelo menos dois extratos.")
    banco = obter_banco()
    origens = [_buscar(banco, i) for i in ids]
    if any(o["tipo"] != "despesas" for o in origens):
        erro("Só é possível mesclar extratos bancários.")
    perfis = {perfil_valido(o["perfil"]) for o in origens}
    if len(perfis) > 1:
        erro("Só é possível mesclar extratos do mesmo perfil.")

    base = origens[0]
    nome = texto(d.get("nome"), 120) or "Mesclado: " + " + ".join(o["nome"] for o in origens)
    cur = banco.execute(
        "INSERT INTO extratos (usuario_id, pagina_id, tipo, nome, perfil, salvo_em) VALUES (?, ?, 'despesas', ?, ?, ?)",
        (uid(), base["pagina_id"], nome[:120], perfis.pop(), agora()),
    )
    novo_id = cur.lastrowid
    todos = []
    for o in origens:
        todos += [
            {"data": r["data"], "descricao": r["descricao"], "valor": r["valor"]}
            for r in banco.execute("SELECT data, descricao, valor FROM lancamentos WHERE extrato_id = ? ORDER BY data, id", (o["id"],))
        ]
    todos.sort(key=lambda l: l["data"])
    adicionados, repetidos = _inserir_lancamentos(banco, novo_id, todos)
    if d.get("excluir_originais"):
        banco.executemany("DELETE FROM extratos WHERE id = ?", [(i,) for i in ids])
    banco.commit()
    resposta = _meta(banco, _buscar(banco, novo_id))
    resposta.update(adicionados=adicionados, repetidos=repetidos)
    return jsonify(resposta), 201
