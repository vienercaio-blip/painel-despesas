"""Testes das categorias padrão e da classificação automática."""
import pytest

from categorizacao import PERFIS, Categorizador, definicoes_padrao, perfil_valido

CASOS = [
    ("pf", "IFD*PIZZARIA BELLA", "Delivery"),
    ("pf", "UBER TRIP", "Transporte"),
    ("pf", "UBER EATS", "Delivery"),
    ("pf", "MERCADO LIVRE", "Compras online"),
    ("pf", "AMAZON PRIME", "Assinaturas"),
    ("pf", "CLINICA VETERINARIA", "Pets"),
    ("pf", "SMART FIT", "Academia e bem-estar"),
    ("pf", "PIX ENVIADO MARIA SILVA", "Transferências para pessoas"),
    ("empresa", "PIX ENVIADO MARIA SILVA", "Transferências para pessoas"),
    ("empresa", "PIX ENVIADO MARIA CONTABILIDADE", "Contabilidade e sistemas"),
    ("empresa", "DAS MEI", "Impostos e encargos"),
    ("empresa", "PAGTO IMPOSTO", "Impostos e encargos"),
    ("pf", "TARIFA PACOTE SERVICOS", "Tarifas bancárias"),
    ("empresa", "TARIFA PACOTE SERVICOS", "Tarifas bancárias"),
    ("pf", "CESTA BASICA SUPERMERCADO", "Mercado"),
    # muitos bancos começam as compras no débito com "COMPRA CARTAO"
    ("empresa", "COMPRA CARTAO DEB POSTO IPIRANGA", "Combustível e entregas"),
    ("empresa", "COMPRA CARTAO GRAFICA RAPIDA", "Marketing"),
]


@pytest.mark.parametrize("perfil, descricao, esperado", CASOS)
def test_categoria_de_descricoes_reais(perfil, descricao, esperado):
    assert Categorizador(perfil, [], {}).categorizar(descricao)[0] == esperado


def test_transferencias_e_sempre_a_ultima():
    for p in ("pf", "empresa"):
        assert PERFIS[p]["regras"][-1][0] == "transferencias"


def test_codigos_unicos_e_contagem():
    assert len(PERFIS["pf"]["regras"]) == 17 and len(PERFIS["empresa"]["regras"]) == 13
    for p in ("pf", "empresa"):
        cods = [r[0] for r in PERFIS[p]["regras"]]
        assert len(cods) == len(set(cods))


def test_pme_e_cafe_viram_empresa():
    assert perfil_valido("pme") == "empresa" and perfil_valido("cafe") == "empresa"
    assert perfil_valido("xyz") == "pf" and set(PERFIS) == {"pf", "empresa"}


def test_edicao_por_codigo():
    d = {x["codigo"]: x for x in definicoes_padrao("pf", {"pf:mercado": {"nome": "Feira", "tipo": "variavel", "palavras": None}})}
    assert d["mercado"]["nome"] == "Feira" and d["mercado"]["id"] == "b:mercado" and d["mercado"]["editada"]
    assert d["dividas"]["tipo"] == "fixo" and d["lazer"]["tipo"] == "variavel"


def _preparar(perfil, descricao, valor):
    from categorizacao import preparar_lancamentos
    lanc = [{"data": "2026-01-10", "descricao": descricao, "valor": valor}]
    return preparar_lancamentos(lanc, Categorizador(perfil, [], {}))[0]


@pytest.mark.parametrize("descricao, categoria", [
    ("ESTORNO COMPRA SHOPEE", "Compras online"),
    ("ESTORNO TARIFA PACOTE SERVICOS", "Tarifas bancárias"),
    ("REEMBOLSO UNIMED CONSULTA", "Saúde"),
    ("DEVOLUCAO PIX MAGAZINE LUIZA", "Compras online"),
    ("ESTORNO DEBITO 99812", "Outros (revisar)"),  # sem categoria: o cliente classifica
])
def test_estorno_desconta_da_categoria_da_despesa(descricao, categoria):
    item = _preparar("pf", descricao, 80.0)
    assert item["estorno"] is True and item["categoria_auto"] == categoria


@pytest.mark.parametrize("descricao", ["CRED SALARIO ALFA SERVICOS LTDA", "PIX RECEBIDO 123 JOAO", "CASHBACK CARTAO CREDITO"])
def test_entrada_comum_nao_e_estorno(descricao):
    item = _preparar("pf", descricao, 80.0)
    assert item["estorno"] is False and item["categoria_auto"] is None


def test_saida_com_palavra_estorno_continua_saida():
    item = _preparar("pf", "TARIFA ESTORNO DEVOLVIDO", -5.0)
    assert item["estorno"] is False and item["categoria_auto"] == "Tarifas bancárias"
