"""Perfil Banco Inter: cabeçalho por dia, valor e saldo em cada linha.
Conferência pela cadeia de saldos e pelo "Saldo do dia"."""
import re

from leitura_pdf.comum import MENSAGENS, cadeia_quebras, formatar_reais, valor_br

MESES = {m: i for i, m in enumerate(["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
                                     "agosto", "setembro", "outubro", "novembro", "dezembro"], 1)}
VALOR = r"-?R\$ ?[\d.]+,\d\d"
DIA = re.compile(r"^(\d{1,2}) de (\w+) de (\d{4}) Saldo do dia: (" + VALOR + ")")
LINHA = re.compile(r'^(.+?): "(.*)" (' + VALOR + r") (" + VALOR + ")$")
PREFIXO = re.compile(r"^Cp ?:\d+-")


def reconhece(doc):
    return "Instituição: Banco Inter" in doc.texto


def ler(doc):
    lancamentos, saldos, dias, data = [], [], {}, None
    for linha in doc.texto.split("\n"):
        m = DIA.match(linha)
        if m and m.group(2).lower() in MESES:
            data = f"{m.group(3)}-{MESES[m.group(2).lower()]:02d}-{int(m.group(1)):02d}"
            dias[data] = valor_br(m.group(4))
            continue
        m = LINHA.match(linha)
        if m and data:
            texto = PREFIXO.sub("", m.group(2).strip())
            lancamentos.append({"data": data, "descricao": f"{m.group(1)} {texto}".strip(), "valor": valor_br(m.group(3))})
            saldos.append(valor_br(m.group(4)))
    itens = [(l["valor"], s) for l, s in zip(lancamentos, saldos)]
    quebras = cadeia_quebras(itens)
    if quebras:
        i = quebras[0]
        dif = abs(itens[i - 1][1] + itens[i][0] - itens[i][1])
        return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(dif), onde=_br(lancamentos[i]["data"]))
    ultimo = {}
    for l, s in zip(lancamentos, saldos):
        ultimo[l["data"]] = s
    sem_lancamento = [d for d in dias if d not in ultimo]
    if sem_lancamento:   # todo dia do extrato tem ao menos um lançamento: algo ficou sem ler
        return lancamentos, MENSAGENS["linha_nao_lida"].format(onde=_br(sem_lancamento[0]))
    for d, s in ultimo.items():
        if abs(s - dias[d]) > 0.005:
            return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(abs(s - dias[d])), onde=_br(d))
    return lancamentos, None


def _br(data_iso):
    a, m, d = data_iso.split("-")
    return f"{d}/{m}/{a}"
