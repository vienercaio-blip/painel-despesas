"""Conversão de bancos antigos (perfil MEI / PME e edições por posição)."""
import json
import sqlite3

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
    con.close()

    criar_tabelas(caminho)
    criar_tabelas(caminho)  # a segunda vez não pode mudar nada

    con = sqlite3.connect(caminho)
    assert {r[0] for r in con.execute("SELECT perfil FROM extratos")} == {"empresa"}
    assert set(con.execute("SELECT nome, perfil FROM paginas")) == {("Loja", "empresa"), ("loja (MEI)", "empresa"), ("Cartão", "empresa")}
    prefs = {r[0]: json.loads(r[1]) for r in con.execute("SELECT usuario_id, valor FROM preferencias WHERE chave = 'config'")}
    assert prefs == {ana: {"perfil": "empresa", "textoGrande": True}, bruno: {"textoGrande": True}}
    edicoes = dict(con.execute("SELECT chave, nome FROM edicoes_padrao"))
    assert edicoes == {"pf:mercado": "Feira", "empresa:aluguel": "Imóvel", "empresa:fornecedores": "Compras"}
    con.close()


def test_categoria_criada_com_nome_de_categoria_padrao_nova(app):
    """Quem já tinha criado "Delivery" ou "Seguros" antes de virarem categorias
    padrão fica com a sua renomeada, levando junto as regras e correções."""
    caminho = app.config["BANCO"]
    con = sqlite3.connect(caminho)
    ana = _ids(con)["ana@exemplo.com"]
    con.execute("INSERT INTO categorias (usuario_id, nome, palavras, criada_em) VALUES (?, 'delivery', '[\"ifood\"]', 'x')", (ana,))
    con.execute("INSERT INTO categorias (usuario_id, nome, palavras, criada_em) VALUES (?, 'Diarista', '[]', 'x')", (ana,))
    con.execute("INSERT INTO regras VALUES (?, 'ifood x', 'delivery', 'IFOOD X', 'x')", (ana,))
    cur = con.execute("INSERT INTO extratos (usuario_id, nome, perfil, salvo_em) VALUES (?, 'E', 'pf', 'x')", (ana,))
    lanc = con.execute("INSERT INTO lancamentos (extrato_id, data, descricao, valor) VALUES (?, '2026-01-01', 'IFOOD X', -10)", (cur.lastrowid,)).lastrowid
    con.execute("INSERT INTO correcoes VALUES (?, 'delivery')", (lanc,))
    con.commit()
    con.close()

    criar_tabelas(caminho)
    criar_tabelas(caminho)

    con = sqlite3.connect(caminho)
    assert {r[0] for r in con.execute("SELECT nome FROM categorias")} == {"delivery (sua)", "Diarista"}
    assert con.execute("SELECT categoria FROM regras").fetchone()[0] == "delivery (sua)"
    assert con.execute("SELECT categoria FROM correcoes").fetchone()[0] == "delivery (sua)"
    con.close()
