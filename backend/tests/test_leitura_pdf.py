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
        "Extrato exportado no dia 7 de janeiro de 2026 às 09:15",
        "Período • 1 de dezembro de 2025 até 31 de janeiro de 2026",
        f"Dezembro 2025 ( 01/12/2025 - 31/12/2025 ) Entradas: R$ 100,00 • Saídas: {saidas_dezembro}",
        "Data Data",
        "Tipo Descrição Valor",
        "lançamento contábil",
        "01/12 02/12 Saída PIX Pix enviado para AGUA E ESGOTO EXEMPLO -R$ 20,00",
        "02/12 02/12 Débito de Cartão ESTACIONAMENTO MODELO -R$ 10,00",
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
        ("2025-12-01", "Pix enviado para AGUA E ESGOTO EXEMPLO", -20.0),
        ("2025-12-02", "Débito de Cartão ESTACIONAMENTO MODELO", -10.0),
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
        "Solicitado em: 05/01/2026 - 08h30",
        "CPF/CNPJ: 000.000.000-00, Instituição: Banco Inter, Agência: 0001-9, Conta: 1-0",
        "Período: 01/03/2025 a 31/05/2025",
        "12 de Março de 2025 Saldo do dia: R$ 0,00 Valor Saldo por transação",
        'Aplicacao: "INVESTIMENTO EXEMPLO" -R$ 210,50 -R$ 210,00',
        'Pix recebido: "Cp :12345678-JOAO DA SILVA" R$ 210,00 -R$ 0,00',
        "20 de Abril de 2025 Saldo do dia: R$ 46,00",
        'Pix enviado: "Cp :87654321-LANCHONETE MODELO" -R$ 54,00 -R$ 54,00',
        "Fale com a gente",
        "SAC: 0800 000 0000",
    ], [
        f'Resgate: "INVESTIMENTO EXEMPLO" R$ 100,00 {saldo_resgate}',
        "Fale com a gente",
    ]])


def test_inter_com_saldos_certos():
    lanc, aviso = ler_pdf(_inter())
    assert aviso is None
    assert [(l["data"], l["descricao"], l["valor"]) for l in lanc] == [
        ("2025-03-12", "Aplicacao INVESTIMENTO EXEMPLO", -210.5),
        ("2025-03-12", "Pix recebido JOAO DA SILVA", 210.0),
        ("2025-04-20", "Pix enviado LANCHONETE MODELO", -54.0),
        ("2025-04-20", "Resgate INVESTIMENTO EXEMPLO", 100.0),
    ]


def test_inter_com_saldo_adulterado_avisa():
    lanc, aviso = ler_pdf(_inter(saldo_resgate="R$ 50,00"))
    assert len(lanc) == 4
    assert aviso and "20/04/2025" in aviso


# ---------- Nubank ----------

def _nubank(resumo_saidas="-80,00", total_secao="- 80,00"):
    def cab(y0):
        return [(390, y0, "Fulano de Tal"), (390, y0 + 12, "CPF •••.111.222-•• Agência 0001 Conta"), (450, y0 + 24, "10000001-0"),
                (40, y0 + 50, "01 DE MARÇO DE 2026 a 31 DE MARÇO DE 2026"), (470, y0 + 50, "VALORES EM R$")]

    def rodape(y0, pag):
        return [(40, y0, "Tem alguma dúvida? Mande uma mensagem para nosso time de atendimento pelo chat do app"),
                (40, y0 + 12, f"Extrato gerado dia 01 de abril de 2026 às 08:00 {pag} de 2")]

    p1 = cab(40) + [
        (300, 110, "Saldo inicial"), (500, 110, "7,10"),
        (300, 124, "Rendimento líquido"), (500, 124, "+0,00"),
        (40, 138, "Saldo final do período"),
        (40, 152, "R$ 27,10"), (300, 152, "Total de entradas"), (500, 152, "+100,00"),
        (300, 166, "Total de saídas"), (500, 166, resumo_saidas),
        (300, 180, "Saldo final do período"), (500, 180, "27,10"),
        (40, 200, "Movimentações"),
        (40, 220, "05 MAR 2026"), (110, 220, "Total de entradas"), (500, 220, "+ 100,00"),
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
        ("2026-03-05", "Transferência recebida pelo Pix LOJA EXEMPLO LTDA", 100.0),
        ("2026-03-05", "Transferência enviada pelo Pix MERCADINHO MODELO", -40.0),
        ("2026-03-05", "Transferência enviada pelo Pix PROVEDOR FICTICIO LTDA", -20.0),
        ("2026-03-05", "Pagamento de fatura", -20.0),
    ]


def test_nubank_com_resumo_adulterado_avisa():
    _, aviso = ler_pdf(_nubank(resumo_saidas="-90,00"))
    assert aviso and "R$ 10,00" in aviso


def test_nubank_com_total_da_secao_adulterado_avisa():
    _, aviso = ler_pdf(_nubank(total_secao="- 70,00"))
    assert aviso and "05/03/2026" in aviso


# ---------- Bradesco Celular (célula centralizada, sinal pela coluna, saldo pela cor) ----------

VERMELHO, AZUL = (1, 0, 0), (0, 0, 1)


def _bradesco(total_debito="22,30"):
    cab = [(40, 40, "Bradesco Celular"), (40, 55, "Data: 05/01/2026 - 09h00"), (40, 70, "Nome: FULANO DE TAL"),
           (40, 90, "Extrato de: Agência: 1234 | Conta: 99999-9 Folha: 1/1"),
           (40, 120, "Data"), (130, 120, "Histórico"), (300, 120, "Docto."),
           (380, 120, "Crédito (R$)"), (445, 120, "Débito (R$)"), (510, 120, "Saldo (R$)")]
    linhas = [
        (40, 150, "10/03/2026"), (130, 150, "TARIFA SEGURO CARTAO"), (300, 150, "1111111"), (455, 150, "7,50", VERMELHO), (520, 150, "4,20", VERMELHO),
        (130, 175, "JUROS CHEQUE ESPECIAL"), (300, 180, "2222222"), (455, 180, "2,80", VERMELHO), (520, 180, "7,00", VERMELHO),
        (130, 186, "TAXA - 05,00%"),
        (130, 205, "PIX QR CODE DINAMICO"), (300, 210, "3333333"), (452, 210, "12,00", VERMELHO), (515, 210, "19,00", VERMELHO),
        (130, 216, "DES: MERCADINHO MODELO 09/03"),
        (40, 240, "12/03/2026"), (130, 235, "PIX RECEBIDO"), (300, 240, "4444444"), (387, 240, "19,33", AZUL), (520, 240, "0,33", AZUL),
        (130, 246, "REM: FULANO DE TAL 12/03"),
        (40, 275, "Total"), (387, 275, "19,33", AZUL), (452, 275, total_debito, VERMELHO), (520, 275, "0,33", AZUL),
    ]
    return pdf([cab + linhas])


def test_bradesco_pelas_colunas_e_cor():
    lanc, aviso = ler_pdf(_bradesco())
    assert aviso is None
    assert [(l["data"], l["descricao"], l["valor"]) for l in lanc] == [
        ("2026-03-10", "TARIFA SEGURO CARTAO", -7.5),
        ("2026-03-10", "JUROS CHEQUE ESPECIAL TAXA - 05,00%", -2.8),
        ("2026-03-10", "PIX QR CODE DINAMICO DES: MERCADINHO MODELO 09/03", -12.0),
        ("2026-03-12", "PIX RECEBIDO REM: FULANO DE TAL 12/03", 19.33),
    ]


def test_bradesco_com_total_adulterado_avisa():
    lanc, aviso = ler_pdf(_bradesco(total_debito="30,00"))
    assert len(lanc) == 4 and aviso and "R$ 7,70" in aviso


# ---------- Banco do Brasil (célula centralizada, sinal (+)/(-), saldo do dia) ----------

def _bb(saldo_dia="999,20"):
    def cab():
        return [(40, 30, "Extrato de Conta Corrente"), (40, 42, "Cliente: FULANO DE TAL"),
                (40, 54, "Período: 01 a 31/03/2026 Agência: 1-0 Conta: 2-0"), (40, 66, "Lançamentos"),
                (40, 80, "Dia"), (110, 80, "Lote"), (160, 80, "Documento"), (280, 80, "Histórico"), (540, 80, "Valor")]
    p1 = cab() + [
        (40, 100, "28/02/2026"), (280, 100, "Saldo Anterior"), (500, 100, "31,20"), (535, 100, "(+)"),
        (280, 120, "Pix - Recebido"),
        (40, 125, "08/03/2026"), (110, 125, "10001"), (160, 125, "11111111111111"), (490, 125, "1.000,00"), (535, 125, "(+)"),
        (280, 131, "07/03 11:05 FULANO DE TAL"),
        (280, 141, "Pix Open Finance Envio"),
        (40, 150, "08/03/2026"), (110, 150, "10002"), (160, 150, "55555"), (280, 150, "08/03 15:40 LOJA EXEMPLO"), (500, 150, "32,00"), (535, 150, "(-)"),
        (280, 159, "E"),
    ]
    p2 = cab() + [
        (40, 100, "08/03/2026"), (110, 100, "10001"), (280, 100, "Saldo do dia"), (500, 100, saldo_dia), (535, 100, "(+)"),
        (40, 120, "31/03/2026"), (280, 120, "S A L D O"), (500, 120, saldo_dia), (535, 120, "(+)"),
        (40, 150, "Aplicações Financeiras"),
        (40, 165, "Poupança Exemplo"), (520, 165, "12,00"),
    ]
    return pdf([p1, p2])


def test_bb_pelo_historico_centralizado():
    lanc, aviso = ler_pdf(_bb())
    assert aviso is None
    assert [(l["data"], l["descricao"], l["valor"]) for l in lanc] == [
        ("2026-03-08", "Pix - Recebido 07/03 11:05 FULANO DE TAL", 1000.0),
        ("2026-03-08", "Pix Open Finance Envio 08/03 15:40 LOJA EXEMPLO E", -32.0),
    ]


def test_bb_com_saldo_do_dia_adulterado_avisa():
    lanc, aviso = ler_pdf(_bb(saldo_dia="900,00"))
    assert len(lanc) == 2 and aviso and "08/03/2026" in aviso


# ---------- genérico (bancos sem perfil próprio) ----------

def _valores(lanc):
    return [(l["data"], l["descricao"], l["valor"]) for l in lanc]


def test_generico_linha_com_sinais_explicitos_avisa_para_conferir():
    lanc, aviso = ler_pdf(pdf_linhas([["Banco Exemplo S.A. - Extrato", "Período: 01/08/2026 a 31/08/2026",
                                       "05/08 PIX JOAO 150,00-", "06/08 SALARIO EMPRESA 3.000,00 C", "07/08 TARIFA PACOTE 10,00 D"]]))
    assert _valores(lanc) == [("2026-08-05", "PIX JOAO", -150.0), ("2026-08-06", "SALARIO EMPRESA", 3000.0),
                              ("2026-08-07", "TARIFA PACOTE", -10.0)]
    assert aviso == MENSAGENS["confira"]


def test_generico_virada_de_ano_pelo_periodo():
    lanc, _ = ler_pdf(pdf_linhas([["Extrato", "Período de 15/12/2025 a 15/01/2026", "20/12 COMPRA LOJA -50,00", "05/01 COMPRA MERCADO -20,00"]]))
    assert [l["data"] for l in lanc] == ["2025-12-20", "2026-01-05"]


def test_generico_coluna_de_saldo_fechando_sem_aviso():
    lanc, aviso = ler_pdf(pdf_linhas([["Extrato", "Data Histórico Valor Saldo", "01/08/2026 Saldo anterior 100,00",
                                       "05/08/2026 PIX JOAO -50,00 50,00", "06/08/2026 DEPOSITO 200,00 250,00"]]))
    assert _valores(lanc) == [("2026-08-05", "PIX JOAO", -50.0), ("2026-08-06", "DEPOSITO", 200.0)]
    assert aviso is None


def test_generico_corrige_sinal_pela_cadeia():
    lanc, aviso = ler_pdf(pdf_linhas([["Extrato", "Data Histórico Valor Saldo", "05/08/2026 PIX JOAO -50,00 50,00",
                                       "06/08/2026 SAQUE 30,00 20,00", "07/08/2026 DEPOSITO 10,00 30,00"]]))
    assert [l["valor"] for l in lanc] == [-50.0, -30.0, 10.0] and aviso is None


@pytest.mark.parametrize("linhas", [
    ["Extrato", "Data Histórico Valor Saldo", "05/08/2026 PIX JOAO -50,00 50,00", "06/08/2026 SAQUE 30,00 99,00"],  # cadeia não fecha
    ["Extrato", "05/08/2026 PIX JOAO 150,00", "06/08/2026 COMPRA 20,00"],  # sem sinal e sem saldo
    ["Extrato", "05/08/2026 PIX JOAO -150,00", "06/08/2026 COMPRA -20,00", "07/08/2026 COMPRA 12,34 TEXTO DEPOIS"],  # sobra > 10%
])
def test_generico_recusa_quando_nao_da_para_conferir(linhas):
    with pytest.raises(ErroLeitura) as e:
        ler_pdf(pdf_linhas([linhas]))
    assert str(e.value) == MENSAGENS["desconhecido"]


def test_generico_por_colunas_credito_debito_saldo():
    cab = [(40, 40, "Banco Exemplo - Extrato de conta"), (40, 80, "Data"), (110, 80, "Lançamento"),
           (330, 80, "Crédito"), (400, 80, "Débito"), (480, 80, "Saldo")]
    linhas = [
        (40, 100, "01/08/2026"), (110, 100, "SALDO ANTERIOR"), (485, 100, "100,00"),
        (40, 120, "05/08/2026"), (110, 116, "PIX ENVIADO"), (405, 120, "40,00"), (485, 120, "60,00"),
        (110, 126, "FULANO DE TAL"),
        (110, 146, "DEPOSITO"), (335, 146, "15,00"), (485, 146, "75,00"),
    ]
    lanc, aviso = ler_pdf(pdf([cab + linhas]))
    assert _valores(lanc) == [("2026-08-05", "PIX ENVIADO FULANO DE TAL", -40.0), ("2026-08-05", "DEPOSITO", 15.0)]
    assert aviso is None


def _generico_com_saldos(saldo_final="125,00"):
    return pdf_linhas([["Extrato Exemplo", "Período: 01/09/2026 a 30/09/2026",
                        "31/08/2026 Saldo Anterior 100,00 (+)",
                        "08/09/2026 10001 55555 50,00 (+)", "08/09/2026 10002 55556 25,00 (-)",
                        "08/09/2026 Saldo do dia 125,00 (+)",
                        f"30/09/2026 S A L D O {saldo_final} (+)"]])


def test_generico_linha_confere_pelas_linhas_de_saldo():
    lanc, aviso = ler_pdf(_generico_com_saldos())
    assert [l["valor"] for l in lanc] == [50.0, -25.0]   # "S A L D O" não é lançamento
    assert aviso is None                                   # conferido pelo saldo do dia


def test_generico_linha_recusa_se_saldo_nao_bate():
    with pytest.raises(ErroLeitura) as e:
        ler_pdf(_generico_com_saldos(saldo_final="999,00"))
    assert str(e.value) == MENSAGENS["desconhecido"]


# ---------- revisão final: casos que não podem passar calados ----------

def test_generico_primeiro_valor_sem_sinal_e_sem_ancora_recusa():
    for linhas in (["Extrato", "Data Histórico Valor Saldo", "05/08/2026 PIX JOAO 150,00 850,00",
                    "06/08/2026 SALARIO 1.000,00 1.850,00", "07/08/2026 TARIFA 10,00 1.840,00"],):
        with pytest.raises(ErroLeitura) as e:
            ler_pdf(pdf_linhas([linhas]))
        assert str(e.value) == MENSAGENS["desconhecido"]


def test_generico_colunas_valor_sem_sinal_e_sem_ancora_recusa():
    cab = [(40, 40, "Banco Exemplo"), (40, 80, "Data"), (110, 80, "Histórico"), (400, 80, "Valor"), (480, 80, "Saldo")]
    linhas = [(40, 100, "05/08/2026"), (110, 100, "COMPRA"), (405, 100, "40,00"), (485, 100, "60,00"),
              (40, 120, "06/08/2026"), (110, 120, "DEPOSITO"), (405, 120, "15,00"), (485, 120, "75,00")]
    with pytest.raises(ErroLeitura):
        ler_pdf(pdf([cab + linhas]))


def test_generico_linha_nao_lida_depois_do_saldo_avisa():
    linhas = ["Extrato Exemplo", "Período: 01/08/2026 a 31/08/2026", "31/07/2026 Saldo anterior 100,00 (+)"]
    linhas += [f"{d:02d}/08/2026 PIX ENVIADO {d} 1,00 (-)" for d in range(1, 11)]
    linhas += ["10/08/2026 Saldo do dia 90,00 (+)", "12/08/2026 COMPRA GRANDE 5.000,00- REF 12"]
    lanc, aviso = ler_pdf(pdf_linhas([linhas]))
    assert len(lanc) == 10 and aviso == MENSAGENS["confira"]


def test_generico_lancamento_depois_do_ultimo_saldo_avisa():
    linhas = ["Extrato", "31/07/2026 Saldo anterior 100,00 (+)", "01/08/2026 PIX 10,00 (-)",
              "01/08/2026 Saldo do dia 90,00 (+)", "02/08/2026 COMPRA 5,00 (-)"]
    _, aviso = ler_pdf(pdf_linhas([linhas]))
    assert aviso == MENSAGENS["confira"]


def test_generico_linha_sem_data_com_valor_conta_como_nao_lida():
    with pytest.raises(ErroLeitura):
        ler_pdf(pdf_linhas([["Extrato", "Período: 01/08/2026 a 31/08/2026", "05/08 PIX JOAO 150,00-",
                             "PIX MARIA 500,00-", "TARIFA 10,00 D", "06/08 SALARIO 3.000,00 C"]]))


def test_generico_colunas_linhas_de_saldo_nao_sao_lancamentos():
    cab = [(40, 40, "Banco Exemplo"), (40, 80, "Data"), (110, 80, "Lançamento"), (330, 80, "Crédito"), (400, 80, "Débito")]
    linhas = [(40, 100, "01/08/2026"), (110, 100, "SALDO ANTERIOR"), (335, 100, "1.000,00"),
              (40, 120, "05/08/2026"), (110, 120, "PIX ENVIADO"), (405, 120, "40,00"),
              (40, 140, "31/08/2026"), (110, 140, "SALDO FINAL"), (335, 140, "960,00")]
    lanc, _ = ler_pdf(pdf([cab + linhas]))
    assert [l["valor"] for l in lanc] == [-40.0]


def test_bb_sem_nenhuma_conferencia_avisa():
    def cab():
        return [(40, 30, "Extrato de Conta Corrente"), (40, 80, "Dia"), (110, 80, "Lote"), (160, 80, "Documento"),
                (280, 80, "Histórico"), (540, 80, "Valor")]
    p = cab() + [(40, 100, "08/09/2026"), (110, 100, "10001"), (280, 100, "Pix - Recebido"), (490, 100, "1.000,00"), (535, 100, "(+)")]
    lanc, aviso = ler_pdf(pdf([p]))
    assert len(lanc) == 1 and aviso == MENSAGENS["sem_conferencia"]


def test_bb_palavra_aplicacoes_na_descricao_nao_corta_o_extrato():
    def cab():
        return [(40, 30, "Extrato de Conta Corrente"), (40, 80, "Dia"), (110, 80, "Lote"), (160, 80, "Documento"),
                (280, 80, "Histórico"), (540, 80, "Valor")]
    p = cab() + [
        (40, 100, "31/08/2026"), (280, 100, "Saldo Anterior"), (500, 100, "50,00"), (535, 100, "(+)"),
        (40, 120, "08/09/2026"), (110, 120, "10001"), (280, 120, "BB Aplicações Resgate"), (500, 120, "20,00"), (535, 120, "(+)"),
        (40, 140, "09/09/2026"), (110, 140, "10002"), (280, 140, "Pix - Enviado"), (500, 140, "5,00"), (535, 140, "(-)"),
        (40, 160, "30/09/2026"), (280, 160, "S A L D O"), (500, 160, "65,00"), (535, 160, "(+)"),
    ]
    lanc, aviso = ler_pdf(pdf([p]))
    assert [l["valor"] for l in lanc] == [20.0, -5.0] and aviso is None


def test_bb_continuacao_no_topo_da_pagina_nao_vira_lancamento():
    def cab():
        return [(40, 30, "Extrato de Conta Corrente"), (40, 80, "Dia"), (110, 80, "Lote"), (160, 80, "Documento"),
                (280, 80, "Histórico"), (540, 80, "Valor")]
    p1 = cab() + [(40, 100, "31/08/2026"), (280, 100, "Saldo Anterior"), (500, 100, "50,00"), (535, 100, "(+)"),
                  (40, 800, "08/09/2026"), (110, 800, "10001"), (280, 795, "Pix - Enviado"), (500, 800, "5,00"), (535, 800, "(-)"),
                  (280, 806, "08/09 10:00 LOJA")]
    p2 = cab() + [(280, 94, "EXEMPLO CONTINUA"),
                  (40, 100, "08/09/2026"), (110, 100, "10001"), (280, 100, "Saldo do dia"), (500, 100, "45,00"), (535, 100, "(+)")]
    lanc, aviso = ler_pdf(pdf([p1, p2]))
    assert [l["valor"] for l in lanc] == [-5.0] and aviso is None


def test_inter_dia_sem_lancamento_lido_avisa():
    lanc, aviso = ler_pdf(pdf_linhas([[
        "CPF/CNPJ: 000.000.000-00, Instituição: Banco Inter, Agência: 0001-9, Conta: 1-0",
        "10 de Agosto de 2025 Saldo do dia: R$ 20,00",
        'Pix recebido: "Cp :00000000-FULANO" R$ 20,00 R$ 20,00',
        "11 de Agosto de 2025 Saldo do dia: R$ 15,00",
        'Pix enviado: "Cp :00000000-LOJA COM NOME MUITO',
        'COMPRIDO" -R$ 5,00 R$ 15,00',
    ]]))
    assert aviso and "11/08/2025" in aviso


def _bradesco_sem_total(saldo_anterior=True):
    cab = [(40, 40, "Bradesco Celular"), (40, 120, "Data"), (130, 120, "Histórico"), (300, 120, "Docto."),
           (380, 120, "Crédito (R$)"), (445, 120, "Débito (R$)"), (510, 120, "Saldo (R$)")]
    linhas = [(40, 150, "01/09/2026"), (130, 150, "SALDO ANTERIOR"), (520, 150, "50,00", AZUL)] if saldo_anterior else []
    linhas += [(40, 170, "02/09/2026"), (130, 170, "PIX ENVIADO"), (300, 170, "1111111"), (455, 170, "10,00", VERMELHO),
               (40, 190, "03/09/2026"), (130, 190, "TARIFA"), (300, 190, "2222222"), (455, 190, "5,00", VERMELHO), (520, 190, "35,00", AZUL)]
    return pdf([cab + linhas])


def test_bradesco_saldo_anterior_confere_e_nao_entra_na_descricao():
    lanc, aviso = ler_pdf(_bradesco_sem_total())
    assert [l["descricao"] for l in lanc] == ["PIX ENVIADO", "TARIFA"] and aviso is None


def test_bradesco_sem_total_e_sem_saldo_suficiente_avisa():
    _, aviso = ler_pdf(_bradesco_sem_total(saldo_anterior=False))
    assert aviso == MENSAGENS["sem_conferencia"]


def test_bradesco_data_um_pouco_desalinhada_fica_na_linha_certa():
    cab = [(40, 40, "Bradesco Celular"), (40, 120, "Data"), (130, 120, "Histórico"), (300, 120, "Docto."),
           (380, 120, "Crédito (R$)"), (445, 120, "Débito (R$)"), (510, 120, "Saldo (R$)")]
    linhas = [(40, 150, "08/09/2026"), (130, 150, "COMPRA A"), (455, 150, "10,00", VERMELHO), (520, 150, "10,00", VERMELHO),
              (40, 182.5, "09/09/2026"), (130, 180, "COMPRA B"), (455, 180, "5,00", VERMELHO), (520, 180, "15,00", VERMELHO),
              (40, 210, "Total"), (455, 210, "15,00", VERMELHO)]
    lanc, _ = ler_pdf(pdf([cab + linhas]))
    assert [l["data"] for l in lanc] == ["2026-09-08", "2026-09-09"]


# ---------- Mercado Pago (célula centralizada, data com traço, resumo no topo) ----------

def _mercadopago(saidas="R$ -45,00", saldo_linha="R$ 80,00"):
    def cab_tabela(y):
        return [(40, y, "DDaattaa"), (89, y, "DDeessccrriiççããoo"), (197, y, "IIDD"), (305, y, "VVaalloorr"), (380, y, "SSaallddoo")]
    p1 = [(40, 30, "EXTRATO DE CONTA"), (40, 42, "Fulano de Tal"), (40, 54, "CPF/CNPJ: 00000000000 Agência: 1 Conta: 1234"),
          (40, 66, "Periodo: De 01-03-2026 al 31-03-2026"),
          (40, 90, "Saldo inicial: R$ 100,00"), (300, 84, "Entradas: R$ 20,00"), (300, 96, f"Saidas: {saidas}"), (450, 90, "Saldo final: R$ 75,00"),
          (200, 120, "DETALHE DOS MOVIMENTOS")] + cab_tabela(140) + [
        (40, 170, "01-03-2026"), (92, 170, "Rendimentos"), (197, 170, "111111111111"), (300, 170, "R$ 0,00"), (370, 170, "R$ 100,00"),
        (92, 194, "Pix recebido FULANO"), (40, 200, "02-03-2026"), (197, 200, "222222222222"), (300, 200, "R$ 20,00"), (370, 200, "R$ 120,00"),
        (92, 206, "DE TAL"),
        (40, 240, "03-03-2026"), (92, 234, "Pagamento com Pix LOJA"), (197, 240, "333333333333"), (300, 240, "R$ -40,00"), (370, 240, saldo_linha),
        (92, 246, "EXEMPLO LTDA"),
        (92, 300, "Reserva por gasto Cofrinho"),   # a célula continua na próxima página
        (520, 330, "1/2")]
    p2 = cab_tabela(40) + [
        (40, 70, "03-03-2026"), (92, 70, "Mercado Livre"), (197, 70, "444444444444"), (300, 70, "R$ -5,00"), (370, 70, "R$ 75,00"),
        (40, 300, "Data de geração: 01-04-2026"),
        (40, 312, "Você tem alguma dúvida? Conte com o nosso Portal de ajuda para encontrar informações"),
        (40, 330, "Mercado Pago Instituição de Pagamento Ltda. CNPJ n.º 00.000.000/0001-00."), (520, 340, "2/2")]
    return pdf([p1, p2])


def test_mercadopago_com_conferencias_certas():
    lanc, aviso = ler_pdf(_mercadopago())
    assert aviso is None
    assert _valores(lanc) == [
        ("2026-03-01", "Rendimentos", 0.0),
        ("2026-03-02", "Pix recebido FULANO DE TAL", 20.0),
        ("2026-03-03", "Pagamento com Pix LOJA EXEMPLO LTDA", -40.0),
        ("2026-03-03", "Reserva por gasto Cofrinho Mercado Livre", -5.0),
    ]


def test_mercadopago_com_total_adulterado_avisa():
    _, aviso = ler_pdf(_mercadopago(saidas="R$ -50,00"))
    assert aviso and "R$ 5,00" in aviso


def test_mercadopago_com_saldo_adulterado_avisa():
    _, aviso = ler_pdf(_mercadopago(saldo_linha="R$ 90,00"))
    assert aviso and "03/03/2026" in aviso
