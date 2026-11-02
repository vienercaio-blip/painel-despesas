"""Testes da leitura de extrato em PDF. Usam só PDFs inventados (tests/pdf_falso.py)."""
import pytest

from leitura import ErroLeitura
from leitura_pdf import ler_pdf
from leitura_pdf.comum import MENSAGENS, SenhaIncorreta, SenhaNecessaria, abrir, cadeia_quebras, valor_br
from pdf_falso import pdf, pdf_linhas


# ---------- base ----------

def test_pdf_falso_e_lido():
    doc = abrir(pdf([[(40, 50, "Olá mundo 1,00"), (300, 80, "R$ 9,99", (1, 0, 0))]]), None)
    assert doc.paginas[0].linhas == ["Olá mundo 1,00", "R$ 9,99"]
    vermelha = [p for p in doc.paginas[0].palavras if p.texto == "9,99"][0]
    assert vermelha.cor == (1, 0, 0)


def test_senha():
    protegido = pdf_linhas([["Extrato 1,00"]], senha="123")
    with pytest.raises(SenhaNecessaria):
        abrir(protegido, None)
    with pytest.raises(SenhaNecessaria):
        abrir(protegido, "")
    with pytest.raises(SenhaIncorreta):
        abrir(protegido, "999")
    assert abrir(protegido, "123").paginas[0].linhas == ["Extrato 1,00"]
    assert issubclass(SenhaNecessaria, ErroLeitura) and issubclass(SenhaIncorreta, ErroLeitura)


def test_limites():
    with pytest.raises(ErroLeitura, match="grande demais"):
        abrir(b"x" * (15 * 1024 * 1024 + 1), None)
    with pytest.raises(ErroLeitura, match="grande demais"):
        abrir(pdf([[]] * 301), None)


@pytest.mark.parametrize("conteudo, chave", [
    (pdf([[]]), "sem_texto"),
    (b"%PDF", "sem_texto"),
    (b"nao sou pdf", "sem_texto"),
    (pdf_linhas([["Extrato da conta", "Não há transações no período selecionado."]]), "vazio"),
    (pdf_linhas([["Fatura do cartão", "Vencimento 10/11/2026", "Pagamento mínimo R$ 50,00"]]), "fatura"),
    (pdf_linhas([["Fatura", "Vencimento 10/11/2026", "Limite total R$ 5.000,00"]]), "fatura"),
])
def test_recusas(conteudo, chave):
    with pytest.raises(ErroLeitura) as e:
        ler_pdf(conteudo)
    assert str(e.value) == MENSAGENS[chave]


def test_sem_perfil_e_desconhecido():
    with pytest.raises(ErroLeitura) as e:
        ler_pdf(pdf_linhas([["Um texto qualquer sem lançamentos"]]))
    assert str(e.value) == MENSAGENS["desconhecido"]


@pytest.mark.parametrize("texto, esperado", [
    ("1.234,56", 1234.56), ("R$ 1.234,56", 1234.56), ("-R$ 3,00", -3.0), ("- 850,00", -850.0),
    ("+2.479,67", 2479.67), ("-R$ 0,00", 0.0), ("R$0,99", 0.99),
])
def test_valor_br(texto, esperado):
    assert valor_br(texto) == esperado


def test_cadeia_quebras():
    assert cadeia_quebras([(-334.82, -334.0), (334.0, -0.0), (10.0, 10.0)]) == []
    assert cadeia_quebras([(-10.0, -10.0), (5.0, -5.0), (5.0, 7.0), (1.0, 8.0)]) == [2]


# ---------- C6 ----------

def _c6(saidas_dezembro="R$ 30,00"):
    return pdf_linhas([[
        "Extrato exportado no dia 6 de janeiro de 2026 às 13:44",
        "Período • 1 de dezembro de 2025 até 31 de janeiro de 2026",
        f"Dezembro 2025 ( 01/12/2025 - 31/12/2025 ) Entradas: R$ 100,00 • Saídas: {saidas_dezembro}",
        "Data Data",
        "Tipo Descrição Valor",
        "lançamento contábil",
        "01/12 02/12 Saída PIX Pix enviado para EMBASA -R$ 20,00",
        "02/12 02/12 Débito de Cartão MOB PARKING SALVADOR BRA -R$ 10,00",
        "Saldo do dia 02/12/25 -R$ 30,00",
        "03/12 03/12 Entrada PIX Pix recebido de JOAO R$ 100,00",
    ], [
        "Janeiro 2026 ( 01/01/2026 - 31/01/2026 ) Entradas: R$ 0,00 • Saídas: R$ 5,00",
        "05/01 05/01 Outros gastos IOF CHEQUE ESPECIAL -R$ 5,00",
        "Atendimento 24 horas No app do C6 Bank",
    ]])


def test_c6_com_totais_certos():
    lanc, aviso = ler_pdf(_c6())
    assert aviso is None
    assert [(l["data"], l["descricao"], l["valor"]) for l in lanc] == [
        ("2025-12-01", "Pix enviado para EMBASA", -20.0),
        ("2025-12-02", "Débito de Cartão MOB PARKING SALVADOR BRA", -10.0),
        ("2025-12-03", "Pix recebido de JOAO", 100.0),
        ("2026-01-05", "Outros gastos IOF CHEQUE ESPECIAL", -5.0),
    ]


def test_c6_com_total_errado_avisa():
    lanc, aviso = ler_pdf(_c6(saidas_dezembro="R$ 40,00"))
    assert len(lanc) == 4
    assert aviso and "Dezembro 2025" in aviso and "R$ 10,00" in aviso


# ---------- Inter ----------

def _inter(saldo_resgate="R$ 46,00"):
    return pdf_linhas([[
        "Solicitado em: 02/11/2026 - 10h54",
        "CPF/CNPJ: 000.000.000-00, Instituição: Banco Inter, Agência: 0001-9, Conta: 1-0",
        "Período: 05/08/2025 a 02/11/2026",
        "11 de Agosto de 2025 Saldo do dia: R$ 0,00 Valor Saldo por transação",
        'Aplicacao: "CDB POS DI LIQ. BANCO INTER S A" -R$ 334,82 -R$ 334,00',
        'Pix recebido: "Cp :18236120-JOAO DA SILVA" R$ 334,00 -R$ 0,00',
        "17 de Setembro de 2025 Saldo do dia: R$ 46,00",
        'Pix enviado: "Cp :90400888-MC DONALDS" -R$ 54,00 -R$ 54,00',
        "Fale com a gente",
        "SAC: 0800 940 9999 (opção 09) Ouvidoria: 0800 940 7772",
    ], [
        f'Resgate: "CDB POS DI LIQ. BANCO INTER S A" R$ 100,00 {saldo_resgate}',
        "Fale com a gente",
    ]])


def test_inter_com_saldos_certos():
    lanc, aviso = ler_pdf(_inter())
    assert aviso is None
    assert [(l["data"], l["descricao"], l["valor"]) for l in lanc] == [
        ("2025-08-11", "Aplicacao CDB POS DI LIQ. BANCO INTER S A", -334.82),
        ("2025-08-11", "Pix recebido JOAO DA SILVA", 334.0),
        ("2025-09-17", "Pix enviado MC DONALDS", -54.0),
        ("2025-09-17", "Resgate CDB POS DI LIQ. BANCO INTER S A", 100.0),
    ]


def test_inter_com_saldo_adulterado_avisa():
    lanc, aviso = ler_pdf(_inter(saldo_resgate="R$ 50,00"))
    assert len(lanc) == 4
    assert aviso and "17/09/2025" in aviso
