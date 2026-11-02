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
