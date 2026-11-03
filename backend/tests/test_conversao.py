"""Conversão de bancos antigos (perfil MEI / PME, edições por posição e o fim dos perfis)."""
import json
import sqlite3
from pathlib import Path

from banco import criar_tabelas


def _ids(con):
    return {r[0]: r[1] for r in con.execute("SELECT email, id FROM usuarios")}


def test_conversao_de_banco_antigo(app):
    caminho = app.config["BANCO"]
    con = sqlite3.connect(caminho)
    ids = _ids(con)
    ana, bruno = ids["ana@exemplo.com"], ids["bruno@exemplo.com"]
    con.execute("INSERT INTO extratos (usuario_id, nome, perfil, salvo_em) VALUES (?, 'Loja', 'pme', 'x')", (ana,))
    for nome, perfil in [("Loja", "empresa"), ("loja", "pme"), ("Cartão", "pme")]:
        con.execute("INSERT INTO paginas (usuario_id, nome, perfil, criado_em) VALUES (?, ?, ?, 'x')", (ana, nome, perfil))
    con.execute("INSERT INTO preferencias VALUES (?, 'config', ?)", (ana, json.dumps({"perfil": "pme", "textoGrande": True})))
    con.execute("INSERT INTO preferencias VALUES (?, 'config', ?)", (bruno, json.dumps({"textoGrande": True})))
    for chave, nome in [("pf:3", "Feira"), ("empresa:2", "Imóvel"), ("pme:2", "Ponto"), ("pme:6", "Compras"), ("empresa:6", "Mercadinho")]:
        con.execute("INSERT INTO edicoes_padrao VALUES (?, ?, ?, 'variavel', NULL)", (ana, chave, nome))
    con.commit()
    con.execute("PRAGMA user_version = 0")  # simula um banco de versão antiga
    con.close()

    criar_tabelas(caminho)
    criar_tabelas(caminho)  # a segunda vez não pode mudar nada

    con = sqlite3.connect(caminho)
    assert {r[0] for r in con.execute("SELECT perfil FROM extratos")} == {"unico"}
    assert set(con.execute("SELECT nome, perfil FROM paginas")) == {
        ("Loja", "unico"), ("loja (MEI)", "unico"), ("Cartão", "unico"), ("Empresa", "unico")}
    prefs = {r[0]: json.loads(r[1]) for r in con.execute("SELECT usuario_id, valor FROM preferencias WHERE chave = 'config'")}
    assert prefs == {ana: {"perfil": "empresa", "textoGrande": True}, bruno: {"textoGrande": True}}
    edicoes = dict(con.execute("SELECT chave, nome FROM edicoes_padrao"))
    assert edicoes == {"padrao:mercado": "Feira", "padrao:moradia": "Imóvel", "padrao:fornecedores": "Compras"}
    con.close()


def test_categoria_criada_com_nome_de_categoria_padrao_nova(app):
    """Quem já tinha criado "Delivery" ou "Seguros" antes de virarem categorias
    padrão fica com a sua renomeada, levando junto as regras e correções."""
    caminho = app.config["BANCO"]
    con = sqlite3.connect(caminho)
    ana = _ids(con)["ana@exemplo.com"]
    con.execute("INSERT INTO categorias (usuario_id, nome, palavras, criada_em) VALUES (?, 'delivery', '[\"ifood\"]', 'x')", (ana,))
    con.execute("INSERT INTO categorias (usuario_id, nome, palavras, criada_em) VALUES (?, 'Diarista', '[]', 'x')", (ana,))
    con.execute("INSERT INTO categorias (usuario_id, nome, palavras, criada_em) VALUES (?, 'Fornecedores', '[]', 'x')", (ana,))
    con.execute("INSERT INTO regras VALUES (?, 'atacado x', 'Fornecedores', 'ATACADO X', 'x')", (ana,))
    con.execute("INSERT INTO regras VALUES (?, 'ifood x', 'delivery', 'IFOOD X', 'x')", (ana,))
    cur = con.execute("INSERT INTO extratos (usuario_id, nome, perfil, salvo_em) VALUES (?, 'E', 'pf', 'x')", (ana,))
    lanc = con.execute("INSERT INTO lancamentos (extrato_id, data, descricao, valor) VALUES (?, '2026-01-01', 'IFOOD X', -10)", (cur.lastrowid,)).lastrowid
    con.execute("INSERT INTO correcoes VALUES (?, 'delivery')", (lanc,))
    con.commit()
    con.execute("PRAGMA user_version = 0")  # simula um banco de versão antiga
    con.close()

    criar_tabelas(caminho)
    criar_tabelas(caminho)

    con = sqlite3.connect(caminho)
    assert {r[0] for r in con.execute("SELECT nome FROM categorias")} == {"delivery (sua)", "Diarista", "Fornecedores (sua)"}
    assert dict(con.execute("SELECT origem, categoria FROM regras")) == {"ifood x": "delivery (sua)", "atacado x": "Fornecedores (sua)"}
    assert con.execute("SELECT categoria FROM correcoes").fetchone()[0] == "delivery (sua)"
    con.close()


# ---------- o fim dos perfis ----------

def _pagina(con, uid, nome, perfil, tipo="despesas"):
    return con.execute(
        "INSERT INTO paginas (usuario_id, nome, tipo, perfil, criado_em) VALUES (?, ?, ?, ?, 'x')", (uid, nome, tipo, perfil)
    ).lastrowid


def _extrato(con, uid, perfil, pagina_id=None, nome="E"):
    return con.execute(
        "INSERT INTO extratos (usuario_id, pagina_id, nome, perfil, salvo_em) VALUES (?, ?, ?, ?, 'x')", (uid, pagina_id, nome, perfil)
    ).lastrowid


def _edicao(con, uid, chave, nome, tipo, palavras):
    con.execute("INSERT INTO edicoes_padrao VALUES (?, ?, ?, ?, ?)",
                (uid, chave, nome, tipo, None if palavras is None else json.dumps(palavras)))


def _converter(app):
    criar_tabelas(app.config["BANCO"])
    criar_tabelas(app.config["BANCO"])  # a segunda vez não pode mudar nada
    return sqlite3.connect(app.config["BANCO"])


def test_pastas_sem_perfil(app):
    con = sqlite3.connect(app.config["BANCO"])
    ids = _ids(con)
    ana, bruno = ids["ana@exemplo.com"], ids["bruno@exemplo.com"]
    _pagina(con, ana, "Nubank", "pf")
    _pagina(con, ana, "Casa", "pf")
    _pagina(con, ana, "nubank", "empresa")
    loja = _pagina(con, ana, "Loja", "empresa")
    solto_pf = _extrato(con, ana, "pf")
    soltos_emp = [_extrato(con, ana, "empresa"), _extrato(con, ana, "empresa")]
    na_loja = _extrato(con, ana, "empresa", loja)
    _extrato(con, bruno, "pf")
    con.commit()
    con.execute("PRAGMA user_version = 0")  # simula um banco de versão antiga
    con.close()

    con = _converter(app)
    assert {r[0] for r in con.execute("SELECT nome FROM paginas WHERE usuario_id = ?", (ana,))} == {
        "Nubank", "Casa", "nubank (Empresa)", "Loja", "Empresa"}
    empresa = con.execute("SELECT id FROM paginas WHERE usuario_id = ? AND nome = 'Empresa'", (ana,)).fetchone()[0]
    pasta = dict(con.execute("SELECT id, pagina_id FROM extratos"))
    assert [pasta[i] for i in soltos_emp] == [empresa, empresa]
    assert pasta[solto_pf] is None and pasta[na_loja] == loja
    assert con.execute("SELECT COUNT(*) FROM paginas WHERE usuario_id = ?", (bruno,)).fetchone()[0] == 0
    assert {r[0] for r in con.execute("SELECT perfil FROM paginas UNION SELECT perfil FROM extratos")} == {"unico"}
    con.close()


def test_pasta_empresa_ja_existente_e_reaproveitada(app):
    con = sqlite3.connect(app.config["BANCO"])
    ana = _ids(con)["ana@exemplo.com"]
    pasta = _pagina(con, ana, "empresa", "pf")
    e = _extrato(con, ana, "empresa")
    con.commit()
    con.execute("PRAGMA user_version = 0")  # simula um banco de versão antiga
    con.close()

    con = _converter(app)
    assert con.execute("SELECT COUNT(*) FROM paginas").fetchone()[0] == 1
    assert con.execute("SELECT pagina_id FROM extratos WHERE id = ?", (e,)).fetchone()[0] == pasta
    con.close()


def test_edicoes_unidas(app):
    con = sqlite3.connect(app.config["BANCO"])
    ana = _ids(con)["ana@exemplo.com"]
    _edicao(con, ana, "pf:moradia", "Casa própria", "fixo", ["aluguel", "cond"])
    _edicao(con, ana, "empresa:aluguel", "Ponto", "variavel", ["sala", "aluguel"])
    con.execute("INSERT INTO regras VALUES (?, 'sala x', 'Ponto', 'SALA X', 'x')", (ana,))
    con.commit()
    con.execute("PRAGMA user_version = 0")  # simula um banco de versão antiga
    con.close()

    con = _converter(app)
    assert list(con.execute("SELECT chave, nome, tipo, palavras FROM edicoes_padrao")) == [
        ("padrao:moradia", "Casa própria", "fixo", json.dumps(["aluguel", "cond", "sala"]))]
    assert con.execute("SELECT categoria FROM regras").fetchone()[0] == "Casa própria"
    con.close()


def test_edicao_unida_com_palavras_originais(app):
    con = sqlite3.connect(app.config["BANCO"])
    ana = _ids(con)["ana@exemplo.com"]
    _edicao(con, ana, "pf:casa", "Contas", "fixo", None)
    _edicao(con, ana, "empresa:contas", "Contas da loja", "fixo", ["luz loja"])
    con.commit()
    con.execute("PRAGMA user_version = 0")  # simula um banco de versão antiga
    con.close()

    con = _converter(app)
    palavras = json.loads(con.execute("SELECT palavras FROM edicoes_padrao WHERE chave = 'padrao:casa'").fetchone()[0])
    assert palavras[0] == "energia" and "internet" in palavras and palavras[-1] == "luz loja"
    assert all(p == p.strip() for p in palavras)
    con.close()


def test_nomes_antigos_nas_regras_e_correcoes(app):
    con = sqlite3.connect(app.config["BANCO"])
    ana = _ids(con)["ana@exemplo.com"]
    for origem, cat in [("a", "Moradia"), ("b", "Combustível e entregas"), ("c", "Contas da casa"), ("d", "Mercado")]:
        con.execute("INSERT INTO regras VALUES (?, ?, ?, ?, 'x')", (ana, origem, cat, origem))
    e = _extrato(con, ana, "pf")
    lanc = con.execute("INSERT INTO lancamentos (extrato_id, data, descricao, valor) VALUES (?, '2026-01-01', 'X', -1)", (e,)).lastrowid
    con.execute("INSERT INTO correcoes VALUES (?, 'Aluguel')", (lanc,))
    con.commit()
    con.execute("PRAGMA user_version = 0")  # simula um banco de versão antiga
    con.close()

    con = _converter(app)
    assert dict(con.execute("SELECT origem, categoria FROM regras")) == {
        "a": "Moradia e aluguel", "b": "Transporte e combustível", "c": "Água, luz e internet", "d": "Mercado"}
    assert con.execute("SELECT categoria FROM correcoes").fetchone()[0] == "Moradia e aluguel"
    con.close()


def test_copia_de_seguranca_uma_vez_so(app):
    pasta = Path(app.config["BANCO"]).parent
    criar_tabelas(app.config["BANCO"])
    assert list(pasta.glob("painel-antes-sem-perfil-*.db")) == []  # banco novo: nada a converter
    con = sqlite3.connect(app.config["BANCO"])
    _extrato(con, _ids(con)["ana@exemplo.com"], "pf")
    con.commit()
    con.execute("PRAGMA user_version = 0")  # simula um banco de versão antiga
    con.close()

    _converter(app).close()
    assert len(list(pasta.glob("painel-antes-sem-perfil-*.db"))) == 1


def test_paginas_de_vendas_nao_mudam_de_nome(app):
    con = sqlite3.connect(app.config["BANCO"])
    ana = _ids(con)["ana@exemplo.com"]
    _pagina(con, ana, "Vendas", "pf", tipo="vendas")
    _pagina(con, ana, "vendas", "empresa", tipo="vendas")
    con.commit()
    con.execute("PRAGMA user_version = 0")  # simula um banco de versão antiga
    con.close()

    con = _converter(app)
    assert set(con.execute("SELECT nome, perfil FROM paginas")) == {("Vendas", "unico"), ("vendas", "unico")}
    con.close()


def test_banco_ja_convertido_nao_muda_mais(app):
    """Depois da conversão, nomes que o cliente escolher (mesmo iguais aos
    antigos, como "Transporte" ou "Moradia") não podem ser mexidos ao religar."""
    con = sqlite3.connect(app.config["BANCO"])
    ana = _ids(con)["ana@exemplo.com"]
    _edicao(con, ana, "padrao:transporte", "Transporte", "variavel", None)
    con.execute("INSERT INTO categorias (usuario_id, nome, palavras, criada_em) VALUES (?, 'Moradia', '[]', 'x')", (ana,))
    con.execute("INSERT INTO categorias (usuario_id, nome, palavras, criada_em) VALUES (?, 'Mercado', '[]', 'x')", (ana,))
    con.execute("INSERT INTO regras VALUES (?, 'uber', 'Transporte', 'UBER', 'x')", (ana,))
    con.execute("INSERT INTO regras VALUES (?, 'imob', 'Moradia', 'IMOB', 'x')", (ana,))
    con.commit()
    antes = (sorted(con.execute("SELECT * FROM regras")), sorted(con.execute("SELECT nome FROM categorias")))
    con.close()

    criar_tabelas(app.config["BANCO"])
    con = sqlite3.connect(app.config["BANCO"])
    assert (sorted(con.execute("SELECT * FROM regras")), sorted(con.execute("SELECT nome FROM categorias"))) == antes
    con.close()
