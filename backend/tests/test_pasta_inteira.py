"""Ver a pasta inteira: os lançamentos de todos os extratos da pasta, somados,
com os repetidos entre extratos contados uma vez só."""
import pytest

from rotas.paginas import sem_repetidos


def L(descricao, data="2026-01-10", valor=-10.0):
    return {"data": data, "descricao": descricao, "valor": valor}


A, B, C = L("PADARIA"), L("MERCADO"), L("FARMACIA")


@pytest.mark.parametrize("grupos, ficam, saem", [
    ([[A, B], [A, C]], [A, B, C], 1),
    ([[A, A], [A]], [A, A], 1),
    ([[A], [A, A]], [A, A], 1),  # o segundo extrato tem uma cópia a mais: ela fica, a outra repete a do primeiro
    ([[A, L("padaria  ")]], [A, L("padaria  ")], 0),  # repetidos no mesmo extrato são legítimos
    ([[A], [L("Padaria")]], [A], 1),  # descrição comparada sem diferença de caixa
    ([[A], [L("PADARIA", valor=-11.0)], [L("PADARIA", data="2026-01-11")]], [A, L("PADARIA", valor=-11.0), L("PADARIA", data="2026-01-11")], 0),
])
def test_sem_repetidos(grupos, ficam, saem):
    assert sem_repetidos(grupos) == (ficam, saem)


def _salvar(cliente, lancamentos, pagina_id=None):
    r = cliente.post("/api/extratos", json={"nome": "E", "pagina_id": pagina_id, "lancamentos": lancamentos})
    assert r.status_code == 201, r.json
    return r.json["id"]


def _pasta(cliente, nome="Empresa"):
    return cliente.post("/api/paginas", json={"nome": nome}).json["id"]


def test_pasta_soma_extratos(cliente):
    p = _pasta(cliente)
    _salvar(cliente, [A, B], p)
    _salvar(cliente, [C], p)
    _salvar(cliente, [L("FORA DA PASTA")])
    r = cliente.get(f"/api/paginas/{p}/lancamentos").json
    assert r["nome"] == "Empresa" and len(r["extratos"]) == 2
    assert sorted(l["descricao"] for l in r["lancamentos"]) == ["FARMACIA", "MERCADO", "PADARIA"]
    assert r["repetidos"] == 0 and r["correcoes"] == {}
    assert {"id", "extrato_id", "categoria_auto", "origem", "estorno"} <= set(r["lancamentos"][0])


def test_pasta_conta_repetido_uma_vez(cliente):
    p = _pasta(cliente)
    primeiro = _salvar(cliente, [A, B], p)
    _salvar(cliente, [A], p)
    r = cliente.get(f"/api/paginas/{p}/lancamentos").json
    assert r["repetidos"] == 1 and len(r["lancamentos"]) == 2
    assert {l["extrato_id"] for l in r["lancamentos"]} == {primeiro}


def test_pasta_vazia(cliente):
    p = _pasta(cliente)
    r = cliente.get(f"/api/paginas/{p}/lancamentos").json
    assert r["lancamentos"] == [] and r["repetidos"] == 0 and r["extratos"] == []


def test_pasta_de_outro_usuario_da_404(cliente, outro_cliente):
    p = _pasta(cliente)
    assert outro_cliente.get(f"/api/paginas/{p}/lancamentos").status_code == 404
    assert outro_cliente.put(f"/api/paginas/{p}/correcoes", json={"correcoes": {}}).status_code == 404


def test_pasta_de_vendas_nao_abre_como_extrato(cliente):
    p = cliente.post("/api/paginas", json={"nome": "Vendas", "tipo": "vendas"}).json["id"]
    assert cliente.get(f"/api/paginas/{p}/lancamentos").status_code == 404


def test_correcao_na_pasta_aparece_no_extrato(cliente):
    p = _pasta(cliente)
    e = _salvar(cliente, [A, B], p)
    alvo = cliente.get(f"/api/paginas/{p}/lancamentos").json["lancamentos"][0]["id"]
    assert cliente.put(f"/api/paginas/{p}/correcoes", json={"correcoes": {alvo: "Lazer"}}).status_code == 200
    assert cliente.get(f"/api/extratos/{e}").json["correcoes"] == {alvo: "Lazer"}
    assert cliente.get(f"/api/paginas/{p}/lancamentos").json["correcoes"] == {alvo: "Lazer"}


def test_correcoes_da_pasta_nao_apagam_as_de_fora(cliente):
    p = _pasta(cliente)
    _salvar(cliente, [A], p)
    fora = _salvar(cliente, [B])
    alvo = cliente.get(f"/api/extratos/{fora}").json["lancamentos"][0]["id"]
    cliente.put(f"/api/extratos/{fora}/correcoes", json={"correcoes": {alvo: "Lazer"}})
    # um id de fora da pasta no pedido também é ignorado
    cliente.put(f"/api/paginas/{p}/correcoes", json={"correcoes": {alvo: "Saúde"}})
    assert cliente.get(f"/api/extratos/{fora}").json["correcoes"] == {alvo: "Lazer"}


def test_correcoes_da_pasta_nao_apagam_as_de_copias_escondidas(cliente):
    """O mesmo lançamento em dois extratos: a pasta mostra a cópia do mais antigo.
    Salvar as correções da pasta não pode apagar a correção feita na outra cópia."""
    p = _pasta(cliente)
    _salvar(cliente, [A, B], p)
    novo = _salvar(cliente, [A], p)
    copia = cliente.get(f"/api/extratos/{novo}").json["lancamentos"][0]["id"]
    cliente.put(f"/api/extratos/{novo}/correcoes", json={"correcoes": {copia: "Lazer"}})
    outro = [l for l in cliente.get(f"/api/paginas/{p}/lancamentos").json["lancamentos"] if l["descricao"] == "MERCADO"][0]
    cliente.put(f"/api/paginas/{p}/correcoes", json={"correcoes": {outro["id"]: "Saúde"}})
    assert cliente.get(f"/api/extratos/{novo}").json["correcoes"] == {copia: "Lazer"}
