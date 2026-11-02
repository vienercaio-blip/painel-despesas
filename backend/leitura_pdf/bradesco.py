"""Perfil Bradesco Celular: tabela com colunas Crédito/Débito (valores sem
sinal), saldo negativo só pela cor vermelha e histórico centralizado na
célula. Conferências: linha "Total" e cadeia de saldos."""
import re

from leitura_pdf.comum import MENSAGENS, formatar_reais, ler_celulas, valor_br

NUM = re.compile(r"^[\d.]+,\d\d$")
DATA = re.compile(r"^(\d\d)/(\d\d)/(\d{4})$")
VERMELHO = (1.0, 0.0, 0.0)


def reconhece(doc):
    t = doc.texto
    return "Bradesco Celular" in t and "Crédito (R$)" in t and "Débito (R$)" in t and "Saldo (R$)" in t


def _colunas(pagina):
    cab = {}
    for p in pagina.palavras:
        if p.texto in ("Histórico", "Docto.", "Crédito", "Débito", "Saldo") and p.texto not in cab:
            cab[p.texto] = p
    if len(cab) < 5:
        return None
    return cab


def ler(doc):
    lancamentos, saldos, total, data, ancora = [], [], None, None, None
    for pg in doc.paginas:
        cab = _colunas(pg)
        if not cab:
            continue
        centros = {k: cab[k].centro_x for k in ("Crédito", "Débito", "Saldo")}
        coluna = lambda p: min(centros, key=lambda k: abs(centros[k] - p.centro_x))
        x_valores = min(centros.values()) - 40
        numeros = lambda grupo: [p for p in grupo if NUM.match(p.texto) and p.x0 > x_valores]

        def eh_linha_valor(grupo):
            return grupo[0].texto != "Total" and bool(numeros(grupo))

        def eh_texto(p):
            return cab["Histórico"].x0 - 2 <= p.x0 < cab["Docto."].x0 - 2

        topo = cab["Histórico"].bottom
        for grupo in _linhas_total(pg, topo):
            total = {coluna(p): valor_br(p.texto) for p in numeros(grupo)}
        for r in ler_celulas(pg, topo, 1e9, eh_linha_valor, eh_texto):
            valor = saldo = None
            for p in numeros(r["palavras"]):
                c = coluna(p)
                if c == "Crédito":
                    valor = valor_br(p.texto)
                elif c == "Débito":
                    valor = -valor_br(p.texto)
                else:
                    saldo = -valor_br(p.texto) if p.cor == VERMELHO else valor_br(p.texto)
            # a data é a palavra de data mais próxima da linha, na coluna Data (tolerância de 6pt)
            perto = [p for p in pg.palavras if DATA.match(p.texto) and p.x0 < cab["Histórico"].x0 and abs(p.centro_y - r["y"]) <= 6]
            if perto:
                m = DATA.match(min(perto, key=lambda p: abs(p.centro_y - r["y"])).texto)
                data = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
            if valor is None:
                if saldo is not None and "SALDO" in r["texto"].upper():
                    ancora = saldo
                continue
            if data is None:
                continue
            lancamentos.append({"data": data, "descricao": r["texto"], "valor": valor})
            saldos.append(saldo)

    conferido = False
    if total and "Crédito" in total and "Débito" in total:
        cred = sum(l["valor"] for l in lancamentos if l["valor"] > 0)
        deb = -sum(l["valor"] for l in lancamentos if l["valor"] < 0)
        dif = max(abs(cred - total["Crédito"]), abs(deb - total["Débito"]))
        if dif > 0.005:
            return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(dif), onde="o total do extrato")
        conferido = True
    # cadeia de saldos: soma os valores entre as linhas que têm saldo
    corrente, pendente, conferencias = ancora, False, 0
    for l, s in zip(lancamentos, saldos):
        if corrente is not None:
            corrente += l["valor"]
        pendente = True
        if s is not None:
            if corrente is not None:
                if abs(corrente - s) > 0.005:
                    a, m, d = l["data"].split("-")
                    return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(abs(corrente - s)), onde=f"{d}/{m}/{a}")
                pendente = False
                conferencias += 1
            corrente = s
    if not conferido and (pendente or conferencias == 0):   # nem Total nem saldo conferiram até o fim
        return lancamentos, MENSAGENS["sem_conferencia"]
    return lancamentos, None


def _linhas_total(pagina, topo):
    linhas = {}
    for p in pagina.palavras:
        if p.top > topo:
            linhas.setdefault(round(p.top / 2), []).append(p)
    for chave in sorted(linhas):
        grupo = sorted(linhas[chave], key=lambda p: p.x0)
        if grupo[0].texto == "Total":
            yield grupo
