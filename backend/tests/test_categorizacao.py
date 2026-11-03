"""Testes das categorias padrão e da classificação automática."""
import json
from pathlib import Path

import pytest

from categorizacao import FIXAS, INTERNAS, REGRAS, Categorizador, definicoes_padrao, eh_resgate, preparar_lancamentos

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
    assert len(REGRAS) == 26 and len(cods) == len(set(cods))
    assert INTERNAS == {"investimentos", "entre_contas"} and INTERNAS <= set(cods)
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
    ("PIX ENVIADO MERCADO PAGO", "Transferências para pessoas"),  # Mercado Pago é a carteira, não um mercado
    ("PAGAMENTO DAS MEI", "Impostos e encargos"),
    ("TAXA CONDOMINIO RESIDENCIAL", "Moradia e aluguel"),
    ("TAXA DE MATRICULA ESCOLA", "Educação"),
    ("COMPRA CARTAO STONE PADARIA DO ZE", "Mercado"),
    ("PAGSEGURO *ACADEMIA FIT", "Academia e bem-estar"),
    ("GETNET *SALAO DA ANA", "Academia e bem-estar"),
    ("REDE DROGASIL", "Saúde"),
    ("ASSINATURA FOLHA DE S PAULO", "Assinaturas"),
    ("APPLE.COM/BILL ICLOUD NUVEM", "Assinaturas"),
    ("PIX ENVIADO FERIAS CASA PRAIA", "Transferências para pessoas"),
    # taxas de maquininha continuam reconhecidas
    ("STONE TAXA ALUGUEL POS", "Taxas de cartão e apps"),
    ("TAXA CARTAO CIELO", "Taxas de cartão e apps"),
    ("ANTECIPACAO DE RECEBIVEIS GETNET", "Taxas de cartão e apps"),
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
    "Investimentos": "Investimentos e reservas",
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
    "ATACADO ASSAI": ("Fornecedores", "Mercado", _MERCADO),
    "ATACADO MAKRO": ("Fornecedores", "Mercado", _MERCADO),
    "COMPRA ASSAI ATACADISTA": ("Fornecedores", "Mercado", _MERCADO),
    "COMPRA ATACADAO DISTRIBUIDOR": ("Fornecedores", "Mercado", _MERCADO),
    "FEIRA HORTIFRUTI": ("Fornecedores", "Mercado", _MERCADO),
    "HORTIFRUTI SAO JOAQUIM": ("Fornecedores", "Mercado", _MERCADO),
    "MERCADO ATACADO ASSAI": ("Fornecedores", "Mercado", _MERCADO),
    "PADARIA PAO DOURADO FORNECEDOR": ("Fornecedores", "Mercado", _MERCADO),
    "MERCADO LIVRE COMPRAS": ("Fornecedores", "Compras online", "compra no Mercado Livre é Compras online"),
    "13 SALARIO 2 PARCELA": ("Dívidas e juros", "Folha de pagamento", "\"parcela\" sozinha não é dívida; 13º salário é folha"),
    "IPTU PARCELA PREFEITURA": ("Dívidas e juros", "Moradia e aluguel", "IPTU é custo da casa, não dívida nem imposto da empresa"),
    "MATERIAL LIMPEZA PRO": ("Outros (revisar)", "Fornecedores", "material de limpeza é insumo"),
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


# ---------- movimento interno: dinheiro guardado e resgates ----------

@pytest.mark.parametrize("descricao, valor, esperado", [
    ("RESGATE TESOURO SELIC", 100.0, True),
    ("DINHEIRO RETIRADO COFRINHO", 50.0, True),
    ("RENDIMENTO POUPANCA", 3.0, False),  # juros ganhos: dinheiro novo
    ("RESGATE TESOURO", -100.0, False),
])
def test_resgate(descricao, valor, esperado):
    assert eh_resgate(descricao, valor) is esperado


@pytest.mark.parametrize("descricao, esperado", [
    ("RESERVA POR GASTO CHAO", "Investimentos e reservas"),
    ("APLICACAO CDB", "Investimentos e reservas"),
    ("COFRINHO", "Investimentos e reservas"),
    ("CAIXINHA TURBO", "Investimentos e reservas"),
    ("RESERVA HOTEL PRAIA", "Lazer"),
    ("RESERVA DE EMERGENCIA", "Investimentos e reservas"),
    ("BOOKING RESERVA 123", "Outros (revisar)"),  # reserva de viagem não é dinheiro guardado
])
def test_guardado_e_reservas(descricao, esperado):
    assert _cat(descricao) == esperado


def test_preparar_resgate_e_rendimento():
    lanc = [{"data": "2026-01-10", "descricao": "RESGATE TESOURO SELIC", "valor": 500.0},
            {"data": "2026-01-10", "descricao": "RENDIMENTO POUPANCA", "valor": 3.0}]
    resgate, rendimento = preparar_lancamentos(lanc, Categorizador([], {}))
    assert resgate["categoria_auto"] == "Investimentos e reservas" and resgate["palavra"] == "resgate"
    assert rendimento["categoria_auto"] is None
    editada = {"padrao:investimentos": {"nome": "Reserva", "tipo": "variavel", "palavras": None}}
    assert preparar_lancamentos(lanc[:1], Categorizador([], editada))[0]["categoria_auto"] == "Reserva"


# ---------- colisões de palavras-chave (pendências) ----------

@pytest.mark.parametrize("descricao, esperado", [
    ("IPTU PARCELA 3/10", "Moradia e aluguel"),
    ("COMPRA PARCELADA LOJA X 2/6", "Outros (revisar)"),
    ("PARCELA EMPRESTIMO PESSOAL", "Dívidas e juros"),
    ("PIX ENVIADO JOAO SEGURO", "Transferências para pessoas"),
    ("SEGURO AUTO PORTO", "Seguros"),
    ("PAGTO SEGURADORA LIDER", "Seguros"),
    ("PIX ENVIADO MERCADO PAGO", "Transferências para pessoas"),
    ("MERCADO PAGO TAXA", "Taxas de cartão e apps"),
    ("SUPERMERCADO BOM PRECO", "Mercado"),
    ("MATERIAL LIMPEZA", "Fornecedores"),
])
def test_colisoes_resolvidas(descricao, esperado):
    assert _cat(descricao) == esperado


@pytest.mark.parametrize("descricao", ["RESGATE PONTOS LIVELO", "RESGATE MILHAS SMILES", "RESGATE SEGURO VIDA"])
def test_resgate_de_pontos_e_seguro_e_dinheiro_novo(descricao):
    assert eh_resgate(descricao, 100.0) is False
