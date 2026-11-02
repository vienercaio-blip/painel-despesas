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


# ---------- Nubank ----------

def _nubank(resumo_saidas="-80,00", total_secao="- 80,00"):
    def cab(y0):
        return [(390, y0, "Fulano de Tal"), (390, y0 + 12, "CPF •••.111.222-•• Agência 0001 Conta"), (450, y0 + 24, "10000001-0"),
                (40, y0 + 50, "01 DE OUTUBRO DE 2026 a 31 DE OUTUBRO DE 2026"), (470, y0 + 50, "VALORES EM R$")]

    def rodape(y0, pag):
        return [(40, y0, "Tem alguma dúvida? Mande uma mensagem para nosso time de atendimento pelo chat do app"),
                (40, y0 + 12, f"Extrato gerado dia 02 de novembro de 2026 às 10:30 {pag} de 2")]

    p1 = cab(40) + [
        (300, 110, "Saldo inicial"), (500, 110, "4,66"),
        (300, 124, "Rendimento líquido"), (500, 124, "+0,00"),
        (40, 138, "Saldo final do período"),
        (40, 152, "R$ 24,66"), (300, 152, "Total de entradas"), (500, 152, "+100,00"),
        (300, 166, "Total de saídas"), (500, 166, resumo_saidas),
        (300, 180, "Saldo final do período"), (500, 180, "24,66"),
        (40, 200, "Movimentações"),
        (40, 220, "05 OUT 2026"), (110, 220, "Total de entradas"), (500, 220, "+ 100,00"),
        (110, 236, "Transferência recebida pelo Pix"), (260, 236, "LOJA EXEMPLO LTDA - 11.222.333/0001-81 - BCO"), (500, 236, "100,00"),
        (260, 250, "C6 S.A. (0336) Agência: 1 Conta: 1234567-8"),
        (110, 270, "Total de saídas"), (500, 270, total_secao),
        # o traço antes do CNPJ fica no fim da linha do valor, e o CNPJ quebra no meio
        (110, 286, "Transferência enviada pelo Pix"), (260, 286, "MERCADINHO MODELO -"), (500, 286, "40,00"),
        (260, 300, "22.333.444/0001-"),
        (260, 314, "55 - STONE IP S.A. (0197) Agência: 1 Conta: 7654321-0"),
        (110, 330, "Transferência enviada pelo Pix"), (260, 330, "PROVEDOR FICTICIO LTDA - 33.444.555"), (500, 330, "20,00"),
    ] + rodape(780, 1)
    p2 = cab(40) + [
        (260, 110, "/0001-66 - COOPERATIVA EXEMPLO"),
        (110, 126, "Pagamento de fatura"), (500, 126, "20,00"),
        (40, 160, "Nu Financeira S.A. - Sociedade de Credito, Financiamento e"), (300, 160, "Nu Pagamentos S.A. - Instituição de"),
        (40, 172, "Investimento"), (300, 172, "Pagamento"),
        (40, 184, "CNPJ: 30.680.829/0001-43"), (300, 184, "CNPJ: 18.236.120/0001-58"),
    ] + rodape(780, 2)
    return pdf([p1, p2])


def test_nubank_com_totais_certos():
    lanc, aviso = ler_pdf(_nubank())
    assert aviso is None
    assert [(l["data"], l["descricao"], l["valor"]) for l in lanc] == [
        ("2026-10-05", "Transferência recebida pelo Pix LOJA EXEMPLO LTDA", 100.0),
        ("2026-10-05", "Transferência enviada pelo Pix MERCADINHO MODELO", -40.0),
        ("2026-10-05", "Transferência enviada pelo Pix PROVEDOR FICTICIO LTDA", -20.0),
        ("2026-10-05", "Pagamento de fatura", -20.0),
    ]


def test_nubank_com_resumo_adulterado_avisa():
    _, aviso = ler_pdf(_nubank(resumo_saidas="-90,00"))
    assert aviso and "R$ 10,00" in aviso


def test_nubank_com_total_da_secao_adulterado_avisa():
    _, aviso = ler_pdf(_nubank(total_secao="- 70,00"))
    assert aviso and "05/10/2026" in aviso


# ---------- Bradesco Celular (célula centralizada, sinal pela coluna, saldo pela cor) ----------

VERMELHO, AZUL = (1, 0, 0), (0, 0, 1)


def _bradesco(total_debito="26,41"):
    cab = [(40, 40, "Bradesco Celular"), (40, 55, "Data: 02/11/2026 - 10h58"), (40, 70, "Nome: FULANO DE TAL"),
           (40, 90, "Extrato de: Agência: 1234 | Conta: 99999-9 Folha: 1/1"),
           (40, 120, "Data"), (130, 120, "Histórico"), (300, 120, "Docto."),
           (380, 120, "Crédito (R$)"), (445, 120, "Débito (R$)"), (510, 120, "Saldo (R$)")]
    linhas = [
        (40, 150, "08/09/2026"), (130, 150, "SERVICO CARTAO PROTEGIDO"), (300, 150, "1111111"), (455, 150, "9,99", VERMELHO), (520, 150, "6,54", VERMELHO),
        (130, 175, "ENCARGOS LIMITE DE CRED"), (300, 180, "2222222"), (455, 180, "4,42", VERMELHO), (515, 180, "10,96", VERMELHO),
        (130, 186, "ENCARGO - 08,00%"),
        (130, 205, "PIX QR CODE DINAMICO"), (300, 210, "3333333"), (452, 210, "12,00", VERMELHO), (515, 210, "22,96", VERMELHO),
        (130, 216, "DES: MERCADINHO MODELO 06/09"),
        (40, 240, "11/09/2026"), (130, 235, "PIX RECEBIDO"), (300, 240, "4444444"), (387, 240, "23,29", AZUL), (520, 240, "0,33", AZUL),
        (130, 246, "REM: FULANO DE TAL 11/09"),
        (40, 275, "Total"), (387, 275, "23,29", AZUL), (452, 275, total_debito, VERMELHO), (520, 275, "0,33", AZUL),
    ]
    return pdf([cab + linhas])


def test_bradesco_pelas_colunas_e_cor():
    lanc, aviso = ler_pdf(_bradesco())
    assert aviso is None
    assert [(l["data"], l["descricao"], l["valor"]) for l in lanc] == [
        ("2026-09-08", "SERVICO CARTAO PROTEGIDO", -9.99),
        ("2026-09-08", "ENCARGOS LIMITE DE CRED ENCARGO - 08,00%", -4.42),
        ("2026-09-08", "PIX QR CODE DINAMICO DES: MERCADINHO MODELO 06/09", -12.0),
        ("2026-09-11", "PIX RECEBIDO REM: FULANO DE TAL 11/09", 23.29),
    ]


def test_bradesco_com_total_adulterado_avisa():
    lanc, aviso = ler_pdf(_bradesco(total_debito="30,00"))
    assert len(lanc) == 4 and aviso and "R$ 3,59" in aviso


# ---------- Banco do Brasil (célula centralizada, sinal (+)/(-), saldo do dia) ----------

def _bb(saldo_dia="991,66"):
    def cab():
        return [(40, 30, "Extrato de Conta Corrente"), (40, 42, "Cliente: FULANO DE TAL"),
                (40, 54, "Período: 01 a 30/09/2026 Agência: 1-0 Conta: 2-0"), (40, 66, "Lançamentos"),
                (40, 80, "Dia"), (110, 80, "Lote"), (160, 80, "Documento"), (280, 80, "Histórico"), (540, 80, "Valor")]
    p1 = cab() + [
        (40, 100, "31/08/2026"), (280, 100, "Saldo Anterior"), (500, 100, "23,66"), (535, 100, "(+)"),
        (280, 120, "Pix - Recebido"),
        (40, 125, "08/09/2026"), (110, 125, "10001"), (160, 125, "11111111111111"), (490, 125, "1.000,00"), (535, 125, "(+)"),
        (280, 131, "05/09 09:23 FULANO DE TAL"),
        (280, 141, "Pix Open Finance Envio"),
        (40, 150, "08/09/2026"), (110, 150, "10002"), (160, 150, "55555"), (280, 150, "08/09 10:16 LOJA EXEMPLO"), (500, 150, "32,00"), (535, 150, "(-)"),
        (280, 159, "E"),
    ]
    p2 = cab() + [
        (40, 100, "08/09/2026"), (110, 100, "10001"), (280, 100, "Saldo do dia"), (500, 100, saldo_dia), (535, 100, "(+)"),
        (40, 120, "30/09/2026"), (280, 120, "S A L D O"), (500, 120, saldo_dia), (535, 120, "(+)"),
        (40, 150, "Aplicações Financeiras"),
        (40, 165, "BB Reserva Cofrinho"), (520, 165, "40,21"),
    ]
    return pdf([p1, p2])


def test_bb_pelo_historico_centralizado():
    lanc, aviso = ler_pdf(_bb())
    assert aviso is None
    assert [(l["data"], l["descricao"], l["valor"]) for l in lanc] == [
        ("2026-09-08", "Pix - Recebido 05/09 09:23 FULANO DE TAL", 1000.0),
        ("2026-09-08", "Pix Open Finance Envio 08/09 10:16 LOJA EXEMPLO E", -32.0),
    ]


def test_bb_com_saldo_do_dia_adulterado_avisa():
    lanc, aviso = ler_pdf(_bb(saldo_dia="900,00"))
    assert len(lanc) == 2 and aviso and "08/09/2026" in aviso
