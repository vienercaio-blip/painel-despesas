"""Testes da API. Para rodar (dentro da pasta backend):  python -m pytest"""
import io
import sqlite3

import pytest


def enviar(cliente, *nomes_e_conteudos):
    dados = {"arquivos": [(io.BytesIO(c), n) for n, c in nomes_e_conteudos]}
    return cliente.post("/api/leitura", data=dados, content_type="multipart/form-data")


def salvar(cliente, lancamentos, nome="Extrato teste", pagina_id=None):
    r = cliente.post("/api/extratos", json={
        "nome": nome, "pagina_id": pagina_id,
        "lancamentos": [{"data": l["data"], "descricao": l["descricao"], "valor": l["valor"]} for l in lancamentos],
    })
    assert r.status_code == 201, r.json
    return r.json


# ---------- login ----------

def test_sem_login_api_responde_401(app):
    c = app.test_client()
    assert c.get("/api/estado").status_code == 401
    assert c.get("/").status_code == 302


def test_senha_errada(app):
    r = app.test_client().post("/entrar", data={"email": "ana@exemplo.com", "senha": "errada"})
    assert r.status_code == 200 and "incorretos" in r.get_data(as_text=True)


def test_estado_inicial(cliente):
    e = cliente.get("/api/estado").json
    assert e["usuario"]["nome"] == "Ana"
    assert "perfis" not in e and len(e["categorias_padrao"]) == 26
    assert {c["codigo"] for c in e["categorias_padrao"] if c["interna"]} == {"investimentos", "entre_contas"}
    moradia = [c for c in e["categorias_padrao"] if c["codigo"] == "moradia"][0]
    assert (moradia["nome"], moradia["fixa"]) == ("Moradia e aluguel", True)
    assert e["categorias"] == [] and e["regras"] == {}


# ---------- leitura de arquivos ----------

def test_leitura_de_varios_formatos(cliente, arquivo):
    r = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx")), ("cafe.csv", arquivo("cafe.csv")),
               ("banco-latin1.csv", arquivo("banco-latin1.csv")), ("planilha.xlsx", arquivo("planilha.xlsx")),
               ("extrato.pdf", b"%PDF"))
    arqs = {a["nome"]: a for a in r.json["arquivos"]}
    assert len(arqs["cafe.ofx"]["lancamentos"]) == 188
    assert len(arqs["cafe.csv"]["lancamentos"]) == 188
    assert len(arqs["banco-latin1.csv"]["lancamentos"]) == 60
    assert len(arqs["planilha.xlsx"]["lancamentos"]) == 55
    assert arqs["extrato.pdf"]["erro"].startswith("Não consegui ler os lançamentos deste PDF")
    # OFX e CSV do mesmo extrato dão o mesmo resultado
    assert arqs["cafe.ofx"]["lancamentos"] == arqs["cafe.csv"]["lancamentos"]
    aluguel = next(l for l in arqs["cafe.ofx"]["lancamentos"] if "ALUGUEL IMOBILIARIA" in l["descricao"])
    assert aluguel["categoria_auto"] == "Moradia e aluguel" and aluguel["origem"] == "aluguel imobiliaria sol"


def test_acentos_do_csv_latin1(cliente, arquivo):
    lanc = enviar(cliente, ("b.csv", arquivo("banco-latin1.csv"))).json["arquivos"][0]["lancamentos"]
    assert all("Saldo" not in l["descricao"] for l in lanc)
    assert any(l["valor"] > 0 for l in lanc) and any(l["valor"] < 0 for l in lanc)


# ---------- extratos salvos ----------

def test_salvar_abrir_renomear_excluir(cliente, arquivo):
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    meta = salvar(cliente, lanc)
    assert meta["quantidade"] == 188 and meta["inicio"] == "2026-08-01"

    aberto = cliente.get(f"/api/extratos/{meta['id']}").json
    assert len(aberto["lancamentos"]) == 188 and aberto["correcoes"] == {}

    cliente.patch(f"/api/extratos/{meta['id']}", json={"nome": "Café ago-out"})
    assert cliente.get("/api/extratos").json[0]["nome"] == "Café ago-out"

    assert cliente.delete(f"/api/extratos/{meta['id']}").status_code == 200
    assert cliente.get("/api/extratos").json == []


def test_acrescentar_ignora_repetidos(cliente, arquivo):
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    meta = salvar(cliente, lanc[:100])
    r = cliente.post(f"/api/extratos/{meta['id']}/lancamentos", json={"lancamentos": lanc})
    assert r.json["adicionados"] == 88 and r.json["repetidos"] == 100 and r.json["quantidade"] == 188


CAFE_5 = {"data": "2026-08-10", "descricao": "VENDA CAFE EXPRESSO", "valor": 5.0}
PAO_7 = {"data": "2026-08-10", "descricao": "VENDA PAO DE QUEIJO", "valor": 7.0}


def test_lancamentos_iguais_no_mesmo_dia_sao_mantidos(cliente):
    meta = salvar(cliente, [CAFE_5, CAFE_5, PAO_7])
    assert meta["quantidade"] == 3


def test_acrescentar_conta_repetidos_pela_quantidade(cliente):
    meta = salvar(cliente, [CAFE_5, CAFE_5, PAO_7])
    # o mesmo arquivo enviado de novo não duplica nada
    r = cliente.post(f"/api/extratos/{meta['id']}/lancamentos", json={"lancamentos": [CAFE_5, CAFE_5, PAO_7]})
    assert r.json["adicionados"] == 0 and r.json["repetidos"] == 3 and r.json["quantidade"] == 3
    # um arquivo com um café a mais acrescenta só esse café
    r = cliente.post(f"/api/extratos/{meta['id']}/lancamentos", json={"lancamentos": [CAFE_5, CAFE_5, CAFE_5]})
    assert r.json["adicionados"] == 1 and r.json["repetidos"] == 2 and r.json["quantidade"] == 4


def test_correcoes_so_neste_extrato(cliente, arquivo):
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    meta = salvar(cliente, lanc)
    aberto = cliente.get(f"/api/extratos/{meta['id']}").json
    alvo = aberto["lancamentos"][1]["id"]
    cliente.put(f"/api/extratos/{meta['id']}/correcoes", json={"correcoes": {alvo: "Mercado", "999999": "X"}})
    assert cliente.get(f"/api/extratos/{meta['id']}").json["correcoes"] == {alvo: "Mercado"}


def test_mesclar_nao_existe_mais(cliente):
    """Juntar extratos agora é com pastas ("Ver a pasta inteira"): o mesclar saiu."""
    a = salvar(cliente, [CAFE_5], nome="A")
    b = salvar(cliente, [PAO_7], nome="B")
    r = cliente.post("/api/extratos/mesclar", json={"ids": [a["id"], b["id"]]})
    assert r.status_code in (404, 405)
    assert sorted(x["nome"] for x in cliente.get("/api/extratos").json) == ["A", "B"]


def test_lancamento_invalido_e_recusado(cliente):
    r = cliente.post("/api/extratos", json={"nome": "x", "lancamentos": [{"data": "ontem", "descricao": "a", "valor": 1}]})
    assert r.status_code == 400


# ---------- páginas ----------

def test_paginas(cliente, arquivo):
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    p = cliente.post("/api/paginas", json={"nome": "Cafeteria"}).json
    assert "perfil" not in p
    r = cliente.post("/api/paginas", json={"nome": "cafetéria"})
    assert r.status_code == 409 and r.json["erro"] == 'Já existe uma pasta chamada "cafetéria".'
    meta = salvar(cliente, lanc[:5], pagina_id=p["id"])
    assert meta["pagina_id"] == p["id"] and "perfil" not in meta
    # excluir a pasta devolve o extrato para "Sem pasta"
    cliente.delete(f"/api/paginas/{p['id']}")
    assert cliente.get("/api/extratos").json[0]["pagina_id"] is None


def test_renomear_pasta_com_nome_repetido(cliente):
    a = cliente.post("/api/paginas", json={"nome": "Casa"}).json
    cliente.post("/api/paginas", json={"nome": "Empresa"})
    assert cliente.patch(f"/api/paginas/{a['id']}", json={"nome": "empresa"}).status_code == 409
    assert cliente.patch(f"/api/paginas/{a['id']}", json={"nome": "Pessoal"}).json["nome"] == "Pessoal"


def test_mover_extrato_para_qualquer_pasta(app, cliente):
    """Dados antigos: extrato de Empresa e pasta criada como Pessoa física."""
    meta = salvar(cliente, [CAFE_5])
    pasta = cliente.post("/api/paginas", json={"nome": "Casa"}).json
    con = sqlite3.connect(app.config["BANCO"])
    con.execute("UPDATE extratos SET perfil = 'empresa' WHERE id = ?", (int(meta["id"]),))
    con.execute("UPDATE paginas SET perfil = 'pf' WHERE id = ?", (int(pasta["id"]),))
    con.commit()
    con.close()
    assert cliente.patch(f"/api/extratos/{meta['id']}", json={"pagina_id": pasta["id"]}).json["pagina_id"] == pasta["id"]
    assert cliente.patch(f"/api/extratos/{meta['id']}", json={"pagina_id": None}).json["pagina_id"] is None


def test_pasta_de_vendas_nao_recebe_extrato(cliente):
    vendas = cliente.post("/api/paginas", json={"nome": "Vendas", "tipo": "vendas"}).json
    r = cliente.post("/api/extratos", json={"nome": "x", "pagina_id": vendas["id"], "lancamentos": [CAFE_5]})
    assert r.status_code == 404


def test_extratos_e_pastas_novos_gravam_perfil_unico(app, cliente):
    """Nada novo pode parecer "dado antigo" para a conversão."""
    salvar(cliente, [CAFE_5])
    cliente.post("/api/paginas", json={"nome": "Casa"})
    con = sqlite3.connect(app.config["BANCO"])
    assert {r[0] for r in con.execute("SELECT perfil FROM extratos UNION SELECT perfil FROM paginas")} == {"unico"}
    con.close()


# ---------- categorias e regras ----------

def test_categoria_criada_muda_a_classificacao(cliente):
    descs = ["PAGAMENTO CONSULTORIA XYZ"]
    antes = cliente.post("/api/categorizar", json={"descricoes": descs}).json["resultados"][0]
    assert antes["categoria"] == "Outros (revisar)"
    cliente.post("/api/categorias", json={"nome": "Consultoria", "tipo": "fixo", "palavras": ["consultoria"]})
    depois = cliente.post("/api/categorizar", json={"descricoes": descs}).json["resultados"][0]
    assert depois == {"categoria": "Consultoria", "palavra": "consultoria"}


def test_renomear_categoria_leva_regras_junto(cliente):
    c = cliente.post("/api/categorias", json={"nome": "Contab", "palavras": "contabil"}).json
    cliente.post("/api/regras", json={"origem": "pix enviado maria contabilidade", "categoria": "Contab", "rotulo": "PIX MARIA"})
    cliente.patch(f"/api/categorias/{c['id']}", json={"nome": "Contabilidade", "tipo": "fixo", "palavras": ["contabil"]})
    regras = cliente.get("/api/estado").json["regras"]
    assert regras["pix enviado maria contabilidade"]["categoria"] == "Contabilidade"
    cliente.delete(f"/api/categorias/{c['id']}")
    assert cliente.get("/api/estado").json["regras"] == {}


def test_editar_e_restaurar_categoria_unida(cliente):
    cliente.post("/api/regras", json={"origem": "aluguel imobiliaria sol", "categoria": "Moradia e aluguel"})
    cliente.put("/api/categorias-padrao/moradia", json={"nome": "Casa própria", "tipo": "fixo", "palavras": None})
    e = cliente.get("/api/estado").json
    assert e["edicoes"]["padrao:moradia"]["nome"] == "Casa própria"
    assert e["regras"]["aluguel imobiliaria sol"]["categoria"] == "Casa própria"
    cliente.delete("/api/categorias-padrao/moradia")
    e = cliente.get("/api/estado").json
    assert e["edicoes"] == {} and e["regras"]["aluguel imobiliaria sol"]["categoria"] == "Moradia e aluguel"
    assert cliente.put("/api/categorias-padrao/inexistente", json={"nome": "X"}).status_code == 404


def test_excluir_regra(cliente):
    cliente.post("/api/regras", json={"origem": "uber trip", "categoria": "Transporte"})
    cliente.delete("/api/regras", query_string={"origem": "uber trip"})
    assert cliente.get("/api/estado").json["regras"] == {}


# ---------- preferências e apagar dados ----------

def test_preferencias_e_apagar_tudo(cliente, arquivo):
    cliente.put("/api/preferencias/config", json={"valor": {"perfil": "pme", "textoGrande": True}})
    assert cliente.get("/api/estado").json["preferencias"]["config"]["perfil"] == "pme"
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    salvar(cliente, lanc[:5])
    cliente.delete("/api/dados")
    assert cliente.get("/api/extratos").json == []
    assert cliente.get("/api/estado").json["preferencias"]["config"] == {}


# ---------- um cliente não vê os dados do outro ----------

def test_dados_separados_por_usuario(cliente, outro_cliente, arquivo):
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    meta = salvar(cliente, lanc[:5])
    cliente.post("/api/regras", json={"origem": "uber trip", "categoria": "Transporte"})
    assert outro_cliente.get("/api/extratos").json == []
    assert outro_cliente.get(f"/api/extratos/{meta['id']}").status_code == 404
    assert outro_cliente.delete(f"/api/extratos/{meta['id']}").status_code == 404
    assert outro_cliente.get("/api/estado").json["regras"] == {}


# ---------- extrato em PDF com senha ----------

def _pdf_c6_com_senha():
    from pdf_falso import pdf_linhas
    return pdf_linhas([[
        "Agosto 2026 ( 01/08/2026 - 31/08/2026 ) Entradas: R$ 100,00 • Saídas: R$ 30,00",
        "01/08 03/08 Saída PIX Pix enviado para LOJA EXEMPLO -R$ 30,00",
        "02/08 03/08 Entrada PIX Pix recebido de FULANO R$ 100,00",
        "No app do C6 Bank",
    ]], senha="segredo-123")


def test_pdf_com_senha_pede_senha(cliente):
    conteudo = _pdf_c6_com_senha()

    def enviar_pdf(senha=None):
        dados = {"arquivos": [(io.BytesIO(conteudo), "extrato.pdf")]}
        if senha is not None:
            dados["senha"] = senha
        return cliente.post("/api/leitura", data=dados, content_type="multipart/form-data")

    r = enviar_pdf()
    item = r.json["arquivos"][0]
    assert item["codigo"] == "senha" and "lancamentos" not in item
    r = enviar_pdf("errada")
    assert r.json["arquivos"][0]["codigo"] == "senha_incorreta"
    assert "errada" not in r.get_data(as_text=True)
    r = enviar_pdf("segredo-123")
    item = r.json["arquivos"][0]
    assert [l["valor"] for l in item["lancamentos"]] == [-30.0, 100.0] and "codigo" not in item
    assert "segredo-123" not in r.get_data(as_text=True)


def test_entrada_e_nome_reservado(cliente):
    """"Entrada" é a opção "sem categoria" das entradas: não pode virar nome de categoria."""
    r = cliente.post("/api/categorias", json={"nome": "entrada", "palavras": []})
    assert r.status_code == 409 and "Entrada" in r.json["erro"]
    c = cliente.post("/api/categorias", json={"nome": "Bicos", "palavras": []}).json
    assert cliente.patch(f"/api/categorias/{c['id']}", json={"nome": "Entrada"}).status_code == 409
    assert cliente.put("/api/categorias-padrao/lazer", json={"nome": "Entrada", "tipo": "variavel", "palavras": None}).status_code == 409
