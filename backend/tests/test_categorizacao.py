"""Testes das categorias padrão e da classificação automática."""
import json
from pathlib import Path

import pytest

from categorizacao import FIXAS, REGRAS, Categorizador, definicoes_padrao

DADOS = Path(__file__).parent / "dados"

CASOS = [
    ("IFD*PIZZARIA BELLA", "Delivery"),
    ("UBER TRIP", "Transporte e combustível"),
    ("UBER EATS", "Delivery"),
    ("MERCADO LIVRE", "Compras online"),
    ("AMAZON PRIME", "Assinaturas"),
    ("CLINICA VETERINARIA", "Pets"),
    ("SMART FIT", "Academia e bem-estar"),
    ("PIX ENVIADO MARIA SILVA", "Transferências para pessoas"),
    ("PIX ENVIADO MARIA CONTABILIDADE", "Contabilidade e sistemas"),
    ("DAS MEI", "Impostos e encargos"),
    ("PAGTO IMPOSTO", "Impostos e encargos"),
    ("TARIFA PACOTE SERVICOS", "Tarifas bancárias"),
    ("CESTA BASICA SUPERMERCADO", "Mercado"),
    # muitos bancos começam as compras no débito com "COMPRA CARTAO"
    ("COMPRA CARTAO DEB POSTO IPIRANGA", "Transporte e combustível"),
    ("COMPRA CARTAO GRAFICA RAPIDA", "Marketing"),
]


def _cat(descricao):
    return Categorizador([], {}).categorizar(descricao)[0]


@pytest.mark.parametrize("descricao, esperado", CASOS)
def test_categoria_de_descricoes_reais(descricao, esperado):
    assert _cat(descricao) == esperado


def test_transferencias_e_sempre_a_ultima():
    assert REGRAS[-1][0] == "transferencias"


def test_codigos_unicos_e_contagem():
    cods = [r[0] for r in REGRAS]
    assert len(REGRAS) == 25 and len(cods) == len(set(cods))
    assert FIXAS <= set(cods)


@pytest.mark.parametrize("descricao, esperado", [
    ("PAG ALUGUEL SALA", "Moradia e aluguel"),
    ("CONDOMINIO EDIF", "Moradia e aluguel"),
    ("COELBA ENERGIA", "Água, luz e internet"),
    ("POSTO SHELL GASOLINA", "Transporte e combustível"),
    ("MOTOBOY ENTREGA", "Transporte e combustível"),
    ("UBER TRIP", "Transporte e combustível"),
])
def test_categorias_unidas_reconhecem_as_duas_origens(descricao, esperado):
    assert _cat(descricao) == esperado


@pytest.mark.parametrize("descricao, esperado", [
    ("PIX ENVIADO MARIA DAS DORES", "Transferências para pessoas"),
    ("IFOOD *PEDIDO", "Delivery"),
    ("PIX ENVIADO MERCADO PAGO", "Mercado"),  # colisão conhecida, igual à de antes
    ("PAGAMENTO DAS MEI", "Impostos e encargos"),
])
def test_palavras_de_empresa_nao_roubam_gastos_pessoais(descricao, esperado):
    assert _cat(descricao) == esperado


def test_nfe_so_como_palavra_inteira():
    """ "nfe" não pode casar dentro de "confeitaria"."""
    assert _cat("EMPORIO DOCE MEL CONFEITARIA") == "Outros (revisar)"
    assert _cat("PAGTO NFE 123 DISTRIB") == "Fornecedores"


def test_mercado_vence_fornecedores():
    assert _cat("SUPERMERCADO BOM PRECO") == "Mercado"
    assert _cat("PADARIA PAO QUENTE") == "Mercado"
    assert _cat("DISTRIBUIDORA DE BEBIDAS") == "Fornecedores"


# Categorias que viraram uma só: o nome antigo vira o novo.
TROCAS = {
    "Moradia": "Moradia e aluguel", "Aluguel": "Moradia e aluguel",
    "Contas da casa": "Água, luz e internet",
    "Transporte": "Transporte e combustível", "Combustível e entregas": "Transporte e combustível",
}
# Mudanças esperadas com a lista única: descrição → (antes, depois, motivo).
_EMPRESA = "gasto de empresa que antes caía em Outros para quem era pessoa física"
_TAXA = "taxa de maquininha ou app, que antes caía em outra categoria"
_MERCADO = "compra em atacado, feira ou padaria vai para Mercado para todos"
EXCECOES = {
    "ADIANTAMENTO SALARIAL": ("Outros (revisar)", "Folha de pagamento", _EMPRESA),
    "DAS SIMPLES NACIONAL": ("Outros (revisar)", "Impostos e encargos", _EMPRESA),
    "FGTS": ("Outros (revisar)", "Impostos e encargos", _EMPRESA),
    "FOLHA SALARIO FUNCIONARIO": ("Outros (revisar)", "Folha de pagamento", _EMPRESA),
    "FORNECEDOR CAFE GRAOS LTDA": ("Outros (revisar)", "Fornecedores", _EMPRESA),
    "FORNECEDOR CAFE TORREFACAO": ("Outros (revisar)", "Fornecedores", _EMPRESA),
    "IMPULSIONAMENTO META ADS": ("Outros (revisar)", "Marketing", _EMPRESA),
    "LATICINIOS BOA VISTA": ("Outros (revisar)", "Fornecedores", _EMPRESA),
    "MANUTENCAO CONSERTO ELETRICO": ("Outros (revisar)", "Manutenção", _EMPRESA),
    "MENSALIDADE SISTEMA CONTABIL": ("Educação", "Contabilidade e sistemas", _EMPRESA),
    "PIX ENVIADO MARIA CONTABILIDADE 15/12": ("Transferências para pessoas", "Contabilidade e sistemas", _EMPRESA),
    "PRO LABORE SOCIOS": ("Outros (revisar)", "Folha de pagamento", _EMPRESA),
    "SALARIO FUNCIONARIOS": ("Outros (revisar)", "Folha de pagamento", _EMPRESA),
    "SEGURO EMPRESARIAL": ("Outros (revisar)", "Seguros", _EMPRESA),
    "SEGURO EMPRESARIAL PORTO": ("Outros (revisar)", "Seguros", _EMPRESA),
    "VALE TRANSPORTE": ("Outros (revisar)", "Folha de pagamento", _EMPRESA),
    "VALE TRANSPORTE VALE REFEICAO": ("Outros (revisar)", "Folha de pagamento", _EMPRESA),
    "IFOOD COMISSAO E TAXAS": ("Delivery", "Taxas de cartão e apps", _TAXA),
    "MERCADO PAGO TAXA": ("Mercado", "Taxas de cartão e apps", _TAXA),
    "STONE TAXA ALUGUEL POS": ("Moradia", "Taxas de cartão e apps", _TAXA),
    "SUMUP *BARRACA DO ZE": ("Outros (revisar)", "Taxas de cartão e apps", _TAXA),
    "ATACADO ASSAI": ("Fornecedores", "Mercado", _MERCADO),
    "ATACADO MAKRO": ("Fornecedores", "Mercado", _MERCADO),
    "COMPRA ASSAI ATACADISTA": ("Fornecedores", "Mercado", _MERCADO),
    "COMPRA ATACADAO DISTRIBUIDOR": ("Fornecedores", "Mercado", _MERCADO),
    "FEIRA HORTIFRUTI": ("Fornecedores", "Mercado", _MERCADO),
    "HORTIFRUTI SAO JOAQUIM": ("Fornecedores", "Mercado", _MERCADO),
    "MERCADO ATACADO ASSAI": ("Fornecedores", "Mercado", _MERCADO),
    "PADARIA PAO DOURADO FORNECEDOR": ("Fornecedores", "Mercado", _MERCADO),
    "MERCADO LIVRE COMPRAS": ("Fornecedores", "Compras online", "compra no Mercado Livre é Compras online"),
}


@pytest.mark.parametrize("arquivo", ["categorias_antes_pf.json", "categorias_antes_empresa.json"])
def test_categorizacao_igual_a_de_antes(arquivo):
    antes = json.loads((DADOS / arquivo).read_text(encoding="utf-8"))
    diferentes = {}
    for desc, cat in antes.items():
        esperado = EXCECOES[desc][1] if desc in EXCECOES else TROCAS.get(cat, cat)
        if _cat(desc) != esperado:
            diferentes[desc] = (cat, _cat(desc))
    assert diferentes == {}


def test_edicao_por_codigo():
    d = {x["codigo"]: x for x in definicoes_padrao({"padrao:mercado": {"nome": "Feira", "tipo": "variavel", "palavras": None}})}
    assert d["mercado"]["nome"] == "Feira" and d["mercado"]["id"] == "b:mercado" and d["mercado"]["editada"]
    assert d["dividas"]["tipo"] == "fixo" and d["lazer"]["tipo"] == "variavel"
    assert d["moradia"]["nome"] == "Moradia e aluguel" and d["moradia"]["tipo"] == "fixo"


def _preparar(descricao, valor):
    from categorizacao import preparar_lancamentos
    lanc = [{"data": "2026-01-10", "descricao": descricao, "valor": valor}]
    return preparar_lancamentos(lanc, Categorizador([], {}))[0]


@pytest.mark.parametrize("descricao, categoria", [
    ("ESTORNO COMPRA SHOPEE", "Compras online"),
    ("ESTORNO TARIFA PACOTE SERVICOS", "Tarifas bancárias"),
    ("REEMBOLSO UNIMED CONSULTA", "Saúde"),
    ("DEVOLUCAO PIX MAGAZINE LUIZA", "Compras online"),
    ("ESTORNO DEBITO 99812", "Outros (revisar)"),  # sem categoria: o cliente classifica
])
def test_estorno_desconta_da_categoria_da_despesa(descricao, categoria):
    item = _preparar(descricao, 80.0)
    assert item["estorno"] is True and item["categoria_auto"] == categoria


@pytest.mark.parametrize("descricao", ["CRED SALARIO ALFA SERVICOS LTDA", "PIX RECEBIDO 123 JOAO", "CASHBACK CARTAO CREDITO"])
def test_entrada_comum_nao_e_estorno(descricao):
    item = _preparar(descricao, 80.0)
    assert item["estorno"] is False and item["categoria_auto"] is None


def test_saida_com_palavra_estorno_continua_saida():
    item = _preparar("TARIFA ESTORNO DEVOLVIDO", -5.0)
    assert item["estorno"] is False and item["categoria_auto"] == "Tarifas bancárias"


@pytest.mark.parametrize("descricao", ["Pix enviado devolvido UBER DO BRASIL", "Pix-Envio devolvido 99 TECNOLOGIA"])
def test_pix_devolvido_e_estorno(descricao):
    assert _preparar(descricao, 25.0)["estorno"] is True
