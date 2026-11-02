"""Perfil Nubank (conta): cabeçalho por dia, sinal pela seção ("Total de
entradas" / "Total de saídas"), valor na primeira linha da descrição.
Conferências: soma de cada seção, resumo do topo e saldo inicial/final."""
import re

from leitura_pdf.comum import MENSAGENS, formatar_reais, ler_valor_no_topo, valor_br

NUM = r"[\d.]+,\d\d"
MESES = {m: i for i, m in enumerate("JAN FEV MAR ABR MAI JUN JUL AGO SET OUT NOV DEZ".split(), 1)}
DIA = re.compile(r"^(\d\d) (" + "|".join(MESES) + r") (\d{4}) Total de (entradas|saídas) ([+-]) ?(" + NUM + ")$")
SECAO = re.compile(r"^Total de (entradas|saídas) ([+-]) ?(" + NUM + ")$")
RODAPE = ("Tem alguma dúvida", "metropolitanas)", "Caso a solução", "disponíveis em nubank", "Extrato gerado dia",
          "O saldo líquido", "Não nos responsabilizamos", "Asseguramos a autenticidade", "Nu Financeira", "Investimento",
          "Nu Pagamentos S.A.", "CNPJ: 30.680", "CNPJ: 18.236")
# corta a descrição no CPF/CNPJ (com ou sem o " - " na frente): o resto é
# banco, agência e conta de destino. O CNPJ pode vir quebrado entre linhas.
CORTE = re.compile(r"(?: -)? (?:•••\.\d{3}\.\d{3}-••|\d{2}\.\d{3}\.\d{3}\s*/\s*\d{4}\s*-?\s*\d{2}|\d{2}\.\d{3}\.\d{3}\s*$).*$")
# no Nubank o valor nunca tem sinal (o sinal vem da seção)
VALOR = re.compile(r"^(.*?)\s+(" + NUM + ")$")


def reconhece(doc):
    t = doc.texto
    return ("Nu Pagamentos" in t or "Nu Financeira" in t) and "VALORES EM R$" in t


def _linhas_do_extrato(doc):
    linhas = []
    for i, pg in enumerate(doc.paginas):
        corpo = pg.linhas
        for k, l in enumerate(corpo):
            if l.endswith("VALORES EM R$"):
                corpo = corpo[k + 1:]
                break
        if i == 0 and "Movimentações" in corpo:
            corpo = corpo[corpo.index("Movimentações") + 1:]
        linhas += [l for l in corpo if not l.startswith(RODAPE) and l != "Pagamento"]
    return linhas


def _resumo(doc):
    topo = doc.paginas[0].linhas
    if "Movimentações" in topo:
        topo = topo[:topo.index("Movimentações")]
    t = "\n".join(topo)
    achar = lambda rx: (lambda m: valor_br(m.group(1)) if m else None)(re.search(rx, t))
    return {"inicial": achar(r"Saldo inicial\s+(-?" + NUM + ")"), "rendimento": achar(r"Rendimento líquido\s+([+-]?" + NUM + ")") or 0.0,
            "entradas": achar(r"Total de entradas\s+\+?(" + NUM + ")"), "saidas": achar(r"Total de saídas\s+-?(" + NUM + ")"),
            "final": achar(r"Saldo final do período\s+(-?" + NUM + ")")}


def ler(doc):
    estado = {"data": None}
    secoes = []

    def cabecalho(linha):
        m = DIA.match(linha)
        if m:
            estado["data"] = f"{m.group(3)}-{MESES[m.group(2)]:02d}-{int(m.group(1)):02d}"
            s = {"data": estado["data"], "sinal": 1 if m.group(4) == "entradas" else -1, "total": valor_br(m.group(6)), "soma": 0.0}
            secoes.append(s)
            return s
        m = SECAO.match(linha)
        if m and estado["data"]:
            s = {"data": estado["data"], "sinal": 1 if m.group(1) == "entradas" else -1, "total": valor_br(m.group(3)), "soma": 0.0}
            secoes.append(s)
            return s
        return None

    lancamentos = []
    for secao, desc, valor in ler_valor_no_topo(_linhas_do_extrato(doc), cabecalho, VALOR):
        v = abs(valor_br(valor))
        secao["soma"] += v
        lancamentos.append({"data": secao["data"], "descricao": CORTE.sub("", desc).strip(), "valor": secao["sinal"] * v})

    for s in secoes:
        if abs(s["soma"] - s["total"]) > 0.005:
            a, m, d = s["data"].split("-")
            return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(abs(s["soma"] - s["total"])), onde=f"{d}/{m}/{a}")
    r = _resumo(doc)
    ent = sum(l["valor"] for l in lancamentos if l["valor"] > 0)
    sai = -sum(l["valor"] for l in lancamentos if l["valor"] < 0)
    if r["entradas"] is not None and r["saidas"] is not None:
        dif = max(abs(ent - r["entradas"]), abs(sai - r["saidas"]))
        if dif > 0.005:
            return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(dif), onde="o resumo do período")
    if r["inicial"] is not None and r["final"] is not None:
        dif = abs(r["inicial"] + r["rendimento"] + ent - sai - r["final"])
        if dif > 0.005:
            return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(dif), onde="o saldo final")
    return lancamentos, None
