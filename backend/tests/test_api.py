"""Testes da API. Para rodar (dentro da pasta backend):  python -m pytest"""
import io


def enviar(cliente, *nomes_e_conteudos, perfil="empresa"):
    dados = {"perfil": perfil, "arquivos": [(io.BytesIO(c), n) for n, c in nomes_e_conteudos]}
    return cliente.post("/api/leitura", data=dados, content_type="multipart/form-data")


def salvar(cliente, lancamentos, nome="Extrato teste", perfil="empresa", pagina_id=None):
    r = cliente.post("/api/extratos", json={
        "nome": nome, "perfil": perfil, "pagina_id": pagina_id,
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
    assert set(e["perfis"]) == {"pf", "empresa"}
    taxas = e["perfis"]["empresa"]["regras"][0]
    assert (taxas["codigo"], taxas["nome"], taxas["fixa"]) == ("taxas", "Taxas de cartão e apps", False)
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
    assert "PDF" in arqs["extrato.pdf"]["erro"]
    # OFX e CSV do mesmo extrato dão o mesmo resultado
    assert arqs["cafe.ofx"]["lancamentos"] == arqs["cafe.csv"]["lancamentos"]
    aluguel = next(l for l in arqs["cafe.ofx"]["lancamentos"] if "ALUGUEL IMOBILIARIA" in l["descricao"])
    assert aluguel["categoria_auto"] == "Aluguel" and aluguel["origem"] == "aluguel imobiliaria sol"


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


def test_mesclar_mantem_lancamentos_iguais(cliente):
    a = salvar(cliente, [CAFE_5, CAFE_5, PAO_7], nome="A")
    b = salvar(cliente, [CAFE_5, CAFE_5], nome="B")
    r = cliente.post("/api/extratos/mesclar", json={"ids": [a["id"], b["id"]]})
    assert r.json["quantidade"] == 3 and r.json["adicionados"] == 3 and r.json["repetidos"] == 2


def test_correcoes_so_neste_extrato(cliente, arquivo):
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    meta = salvar(cliente, lanc)
    aberto = cliente.get(f"/api/extratos/{meta['id']}").json
    alvo = aberto["lancamentos"][1]["id"]
    cliente.put(f"/api/extratos/{meta['id']}/correcoes", json={"correcoes": {alvo: "Mercado", "999999": "X"}})
    assert cliente.get(f"/api/extratos/{meta['id']}").json["correcoes"] == {alvo: "Mercado"}


def test_mesclar(cliente, arquivo):
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    a = salvar(cliente, lanc[:120], nome="A")
    b = salvar(cliente, lanc[100:], nome="B")
    r = cliente.post("/api/extratos/mesclar", json={"ids": [a["id"], b["id"]], "nome": "A+B", "excluir_originais": True})
    assert r.status_code == 201 and r.json["quantidade"] == 188 and r.json["repetidos"] == 20
    assert [x["nome"] for x in cliente.get("/api/extratos").json] == ["A+B"]


def test_mesclar_perfis_diferentes_falha(cliente, arquivo):
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    a = salvar(cliente, lanc[:10], perfil="pf")
    b = salvar(cliente, lanc[10:20], perfil="empresa")
    assert cliente.post("/api/extratos/mesclar", json={"ids": [a["id"], b["id"]]}).status_code == 400


def test_lancamento_invalido_e_recusado(cliente):
    r = cliente.post("/api/extratos", json={"nome": "x", "lancamentos": [{"data": "ontem", "descricao": "a", "valor": 1}]})
    assert r.status_code == 400


# ---------- páginas ----------

def test_paginas(cliente, arquivo):
    lanc = enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx"))).json["arquivos"][0]["lancamentos"]
    p = cliente.post("/api/paginas", json={"nome": "Cafeteria", "perfil": "empresa"}).json
    assert p["perfil"] == "empresa"
    assert cliente.post("/api/paginas", json={"nome": "cafetéria", "perfil": "empresa"}).status_code == 409
    meta = salvar(cliente, lanc[:5], pagina_id=p["id"])
    assert meta["pagina_id"] == p["id"]
    # excluir a subpasta devolve o extrato para a pasta principal do tipo
    cliente.delete(f"/api/paginas/{p['id']}")
    assert cliente.get("/api/extratos").json[0]["pagina_id"] is None


def test_subpastas_separadas_por_tipo(cliente):
    pf = cliente.post("/api/paginas", json={"nome": "2026", "perfil": "pf"})
    pme = cliente.post("/api/paginas", json={"nome": "2026", "perfil": "empresa"})
    assert pf.status_code == 201 and pme.status_code == 201
    assert cliente.post("/api/paginas", json={"nome": "2026", "perfil": "pf"}).status_code == 409
    assert {(p["nome"], p["perfil"]) for p in cliente.get("/api/paginas").json} == {("2026", "pf"), ("2026", "empresa")}
    # renomear também só conflita dentro do mesmo tipo
    cliente.post("/api/paginas", json={"nome": "Cartão", "perfil": "pf"})
    assert cliente.patch(f"/api/paginas/{pme.json['id']}", json={"nome": "Cartão"}).status_code == 200


def test_extrato_so_vai_para_subpasta_do_mesmo_tipo(cliente):
    pf = cliente.post("/api/paginas", json={"nome": "Casa", "perfil": "pf"}).json
    pme = cliente.post("/api/paginas", json={"nome": "Loja", "perfil": "empresa"}).json
    r = cliente.post("/api/extratos", json={"nome": "x", "perfil": "pf", "pagina_id": pme["id"], "lancamentos": [CAFE_5]})
    assert r.status_code == 404
    meta = salvar(cliente, [CAFE_5], perfil="pf")
    assert cliente.patch(f"/api/extratos/{meta['id']}", json={"pagina_id": pme["id"]}).status_code == 404
    assert cliente.patch(f"/api/extratos/{meta['id']}", json={"pagina_id": pf["id"]}).json["pagina_id"] == pf["id"]
    # voltar para a pasta principal
    assert cliente.patch(f"/api/extratos/{meta['id']}", json={"pagina_id": None}).json["pagina_id"] is None


# ---------- categorias e regras ----------

def test_categoria_criada_muda_a_classificacao(cliente):
    descs = ["PAGAMENTO CONSULTORIA XYZ"]
    antes = cliente.post("/api/categorizar", json={"perfil": "empresa", "descricoes": descs}).json["resultados"][0]
    assert antes["categoria"] == "Outros (revisar)"
    cliente.post("/api/categorias", json={"nome": "Consultoria", "tipo": "fixo", "palavras": ["consultoria"]})
    depois = cliente.post("/api/categorizar", json={"perfil": "empresa", "descricoes": descs}).json["resultados"][0]
    assert depois == {"categoria": "Consultoria", "palavra": "consultoria"}


def test_renomear_categoria_leva_regras_junto(cliente):
    c = cliente.post("/api/categorias", json={"nome": "Contab", "palavras": "contabil"}).json
    cliente.post("/api/regras", json={"origem": "pix enviado maria contabilidade", "categoria": "Contab", "rotulo": "PIX MARIA"})
    cliente.patch(f"/api/categorias/{c['id']}", json={"nome": "Contabilidade", "tipo": "fixo", "palavras": ["contabil"]})
    regras = cliente.get("/api/estado").json["regras"]
    assert regras["pix enviado maria contabilidade"]["categoria"] == "Contabilidade"
    cliente.delete(f"/api/categorias/{c['id']}")
    assert cliente.get("/api/estado").json["regras"] == {}


def test_editar_e_restaurar_categoria_padrao(cliente):
    cliente.post("/api/regras", json={"origem": "aluguel imobiliaria sol", "categoria": "Aluguel"})
    cliente.put("/api/categorias-padrao/empresa/aluguel", json={"nome": "Imóvel", "tipo": "fixo", "palavras": None})
    e = cliente.get("/api/estado").json
    assert e["edicoes"]["empresa:aluguel"]["nome"] == "Imóvel"
    assert e["regras"]["aluguel imobiliaria sol"]["categoria"] == "Imóvel"
    cliente.delete("/api/categorias-padrao/empresa/aluguel")
    e = cliente.get("/api/estado").json
    assert e["edicoes"] == {} and e["regras"]["aluguel imobiliaria sol"]["categoria"] == "Aluguel"
    assert cliente.put("/api/categorias-padrao/empresa/nao-existe", json={"nome": "X"}).status_code == 404
    r = cliente.put("/api/categorias-padrao/pme/aluguel", json={"nome": "Imóvel", "tipo": "fixo", "palavras": None})
    assert r.status_code == 200
    assert cliente.get("/api/estado").json["edicoes"]["empresa:aluguel"]["nome"] == "Imóvel"


def test_pme_vindo_de_fora_vira_empresa(cliente, arquivo):
    assert salvar(cliente, [CAFE_5], perfil="pme")["perfil"] == "empresa"
    assert cliente.post("/api/paginas", json={"nome": "X", "perfil": "pme"}).json["perfil"] == "empresa"
    assert enviar(cliente, ("cafe.ofx", arquivo("cafe.ofx")), perfil="pme").json["perfil"] == "empresa"


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
