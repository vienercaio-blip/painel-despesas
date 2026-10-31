"""Categorias (criadas e padrão), regras do cliente e recategorização."""
import json

from flask import jsonify, request

from auth import login_obrigatorio
from banco import agora, obter_banco
from categorizacao import (
    OUTROS, PERFIS, carregar_categorizador, carregar_edicoes, normalizar, perfil_valido, separar_palavras,
)
from rotas import api
from rotas.util import corpo, erro, texto, uid

TIPOS_CUSTO = {"fixo", "variavel"}


# ---------- funções de apoio (também usadas por conta.py) ----------

def listar_categorias(banco, usuario_id):
    return [
        {"id": str(r["id"]), "nome": r["nome"], "tipo": r["tipo"],
         "palavras": json.loads(r["palavras"] or "[]"), "criada_em": r["criada_em"]}
        for r in banco.execute("SELECT * FROM categorias WHERE usuario_id = ? ORDER BY id", (usuario_id,))
    ]


def listar_regras(banco, usuario_id):
    return {
        r["origem"]: {"categoria": r["categoria"], "rotulo": r["rotulo"], "criada_em": r["criada_em"]}
        for r in banco.execute("SELECT * FROM regras WHERE usuario_id = ?", (usuario_id,))
    }


def _renomear_em_tudo(banco, antigo, novo):
    """Quando uma categoria muda de nome, regras e correções vão junto."""
    if antigo == novo:
        return
    banco.execute("UPDATE regras SET categoria = ? WHERE usuario_id = ? AND categoria = ?", (novo, uid(), antigo))
    banco.execute(
        "UPDATE correcoes SET categoria = ? WHERE categoria = ? AND lancamento_id IN ("
        "SELECT l.id FROM lancamentos l JOIN extratos e ON e.id = l.extrato_id WHERE e.usuario_id = ?)",
        (novo, antigo, uid()),
    )


def _dados_categoria(d):
    nome = texto(d.get("nome"), 40, "Dê um nome para a categoria.")
    if normalizar(nome) == normalizar(OUTROS):
        erro(f'"{OUTROS}" é uma categoria do sistema. Escolha outro nome.', 409)
    tipo = d.get("tipo") if d.get("tipo") in TIPOS_CUSTO else "variavel"
    palavras = d.get("palavras")
    if isinstance(palavras, list):
        palavras = separar_palavras(",".join(str(p) for p in palavras))
    else:
        palavras = separar_palavras(palavras)
    return nome, tipo, palavras[:200]


def _nome_em_uso(banco, nome, exceto_id=None):
    for r in banco.execute("SELECT id, nome FROM categorias WHERE usuario_id = ?", (uid(),)):
        if r["id"] != exceto_id and normalizar(r["nome"]) == normalizar(nome):
            return True
    return False


def _buscar_categoria(banco, cat_id):
    r = banco.execute("SELECT * FROM categorias WHERE id = ? AND usuario_id = ?", (cat_id, uid())).fetchone()
    if r is None:
        erro("Categoria não encontrada.", 404)
    return r


def _nome_padrao_atual(banco, perfil, posicao):
    ed = carregar_edicoes(banco, uid()).get(f"{perfil}:{posicao}")
    return (ed and ed["nome"]) or PERFIS[perfil]["regras"][posicao][0]


def _validar_padrao(perfil, posicao):
    if perfil not in PERFIS or not (0 <= posicao < len(PERFIS[perfil]["regras"])):
        erro("Categoria padrão não encontrada.", 404)


# ---------- categorias criadas pelo cliente ----------

@api.post("/categorias")
@login_obrigatorio
def criar_categoria():
    banco = obter_banco()
    nome, tipo, palavras = _dados_categoria(corpo())
    if _nome_em_uso(banco, nome):
        erro(f'Já existe uma categoria chamada "{nome}". Escolha outro nome.', 409)
    cur = banco.execute(
        "INSERT INTO categorias (usuario_id, nome, tipo, palavras, criada_em) VALUES (?, ?, ?, ?, ?)",
        (uid(), nome, tipo, json.dumps(palavras, ensure_ascii=False), agora()),
    )
    banco.commit()
    nova = [c for c in listar_categorias(banco, uid()) if c["id"] == str(cur.lastrowid)][0]
    return jsonify(nova), 201


@api.patch("/categorias/<int:cat_id>")
@login_obrigatorio
def editar_categoria(cat_id):
    banco = obter_banco()
    atual = _buscar_categoria(banco, cat_id)
    nome, tipo, palavras = _dados_categoria(corpo())
    if _nome_em_uso(banco, nome, exceto_id=cat_id):
        erro(f'Já existe uma categoria chamada "{nome}". Escolha outro nome.', 409)
    banco.execute(
        "UPDATE categorias SET nome = ?, tipo = ?, palavras = ? WHERE id = ?",
        (nome, tipo, json.dumps(palavras, ensure_ascii=False), cat_id),
    )
    _renomear_em_tudo(banco, atual["nome"], nome)
    banco.commit()
    return jsonify(ok=True)


@api.delete("/categorias/<int:cat_id>")
@login_obrigatorio
def excluir_categoria(cat_id):
    """Exclui a categoria e as regras/correções ligadas a ela."""
    banco = obter_banco()
    cat = _buscar_categoria(banco, cat_id)
    banco.execute("DELETE FROM regras WHERE usuario_id = ? AND categoria = ?", (uid(), cat["nome"]))
    banco.execute(
        "DELETE FROM correcoes WHERE categoria = ? AND lancamento_id IN ("
        "SELECT l.id FROM lancamentos l JOIN extratos e ON e.id = l.extrato_id WHERE e.usuario_id = ?)",
        (cat["nome"], uid()),
    )
    banco.execute("DELETE FROM categorias WHERE id = ?", (cat_id,))
    banco.commit()
    return jsonify(ok=True)


# ---------- ajustes nas categorias padrão ----------

@api.put("/categorias-padrao/<perfil>/<int:posicao>")
@login_obrigatorio
def editar_padrao(perfil, posicao):
    """Muda nome, tipo e/ou palavras de uma categoria padrão.
    "palavras": null mantém as palavras originais do sistema."""
    _validar_padrao(perfil, posicao)
    d = corpo()
    banco = obter_banco()
    nome = texto(d.get("nome"), 40, "Dê um nome para a categoria.")
    tipo = d.get("tipo") if d.get("tipo") in TIPOS_CUSTO else "variavel"
    palavras = d.get("palavras")
    palavras_json = None if palavras is None else json.dumps(
        separar_palavras(",".join(str(p) for p in palavras) if isinstance(palavras, list) else palavras),
        ensure_ascii=False,
    )
    antigo = _nome_padrao_atual(banco, perfil, posicao)
    banco.execute(
        "INSERT INTO edicoes_padrao (usuario_id, chave, nome, tipo, palavras) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(usuario_id, chave) DO UPDATE SET nome = excluded.nome, tipo = excluded.tipo, palavras = excluded.palavras",
        (uid(), f"{perfil}:{posicao}", nome, tipo, palavras_json),
    )
    _renomear_em_tudo(banco, antigo, nome)
    banco.commit()
    return jsonify(ok=True)


@api.delete("/categorias-padrao/<perfil>/<int:posicao>")
@login_obrigatorio
def restaurar_padrao(perfil, posicao):
    """Volta a categoria padrão ao original do sistema."""
    _validar_padrao(perfil, posicao)
    banco = obter_banco()
    antigo = _nome_padrao_atual(banco, perfil, posicao)
    banco.execute("DELETE FROM edicoes_padrao WHERE usuario_id = ? AND chave = ?", (uid(), f"{perfil}:{posicao}"))
    _renomear_em_tudo(banco, antigo, PERFIS[perfil]["regras"][posicao][0])
    banco.commit()
    return jsonify(ok=True)


# ---------- regras do cliente ----------

@api.post("/regras")
@login_obrigatorio
def salvar_regra():
    """Cria ou troca a regra "esta origem é sempre desta categoria"."""
    d = corpo()
    origem = texto(d.get("origem"), 300, "Origem inválida.")
    categoria = texto(d.get("categoria"), 80, "Categoria inválida.")
    rotulo = texto(d.get("rotulo"), 300) or origem
    banco = obter_banco()
    criada_em = agora()
    banco.execute(
        "INSERT INTO regras (usuario_id, origem, categoria, rotulo, criada_em) VALUES (?, ?, ?, ?, ?) "
        "ON CONFLICT(usuario_id, origem) DO UPDATE SET categoria = excluded.categoria, rotulo = excluded.rotulo, criada_em = excluded.criada_em",
        (uid(), origem, categoria, rotulo, criada_em),
    )
    banco.commit()
    return jsonify(origem=origem, categoria=categoria, rotulo=rotulo, criada_em=criada_em)


@api.delete("/regras")
@login_obrigatorio
def excluir_regra():
    origem = request.args.get("origem", "")
    banco = obter_banco()
    banco.execute("DELETE FROM regras WHERE usuario_id = ? AND origem = ?", (uid(), origem))
    banco.commit()
    return jsonify(ok=True)


# ---------- recategorizar ----------

@api.post("/categorizar")
@login_obrigatorio
def categorizar():
    """Recalcula a categoria automática de uma lista de descrições
    (usado depois de criar ou editar categorias)."""
    d = corpo()
    descricoes = d.get("descricoes")
    if not isinstance(descricoes, list) or len(descricoes) > 100_000:
        erro("Lista de descrições inválida.")
    cat = carregar_categorizador(obter_banco(), uid(), perfil_valido(d.get("perfil")))
    resultados = []
    for desc in descricoes:
        nome, palavra = cat.categorizar(str(desc))
        resultados.append({"categoria": nome, "palavra": palavra})
    return jsonify(resultados=resultados)
