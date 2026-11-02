"""Perfil Mercado Pago (conta): tabela Data · Descrição · ID da operação ·
Valor · Saldo, data com traço (01-10-2026), valor com sinal depois do "R$"
e descrição centralizada na célula (às vezes continuando na página
seguinte). Conferências: cadeia de saldos a partir do saldo inicial,
totais de entradas e saídas e saldo final do resumo."""
import re

from leitura_pdf.comum import MENSAGENS, formatar_reais, ler_celulas, valor_br

DATA = re.compile(r"^(\d\d)-(\d\d)-(\d{4})$")
NUM = re.compile(r"^-?[\d.]+,\d\d$")
ID = re.compile(r"^\d{11,14}$")
DISTANCIA_MAX = 22   # texto mais longe que isso da última linha da página continua na próxima


def reconhece(doc):
    t = doc.texto
    return "Mercado Pago" in t and "DETALHE DOS MOVIMENTOS" in t


def _sem_duplicadas(texto):
    """O cabeçalho vem em "negrito" com letras repetidas ("DDaattaa")."""
    if len(texto) % 2 == 0 and all(texto[i] == texto[i + 1] for i in range(0, len(texto), 2)):
        return texto[::2]
    return texto


def _resumo(doc):
    t = "\n".join(doc.paginas[0].linhas)
    achar = lambda rx: (lambda m: valor_br(m.group(1)) if m else None)(re.search(rx, t))
    return {"inicial": achar(r"Saldo inicial: R\$ ?(-?[\d.]+,\d\d)"), "entradas": achar(r"Entradas: R\$ ?(-?[\d.]+,\d\d)"),
            "saidas": achar(r"Saidas: R\$ ?(-?[\d.]+,\d\d)"), "final": achar(r"Saldo final: R\$ ?(-?[\d.]+,\d\d)")}


def ler(doc):
    registros, carregado, x_desc = [], [], None
    for n, pg in enumerate(doc.paginas):
        cab = next((p for p in pg.palavras if _sem_duplicadas(p.texto) == "Descrição"), None)
        if cab is not None:
            x_desc, topo = cab.x0, cab.bottom
        elif x_desc is not None:
            topo = 0   # nem toda página repete o cabeçalho: usa as colunas da anterior
        else:
            continue
        # valor e saldo ficam bem à direita da descrição (a data e o ID não têm vírgula)
        numeros = lambda grupo: sorted((p for p in grupo if NUM.match(p.texto) and p.x0 > x_desc + 150), key=lambda p: p.x0)

        def eh_linha_valor(grupo):
            return DATA.match(grupo[0].texto) is not None and grupo[0].x0 < x_desc and len(numeros(grupo)) >= 2

        linhas = ler_celulas(pg, topo, 1e9, eh_linha_valor, lambda p: False)
        if not linhas:
            continue
        ultima = linhas[-1]["y"]
        # a coluna "ID da operação" é achada nas próprias linhas de lançamento (o CPF do topo também tem 11 dígitos)
        ids = [p.x0 for r in linhas for p in r["palavras"] if ID.match(p.texto)]
        x_id = min(ids) if ids else x_desc + 105
        na_coluna = lambda p: x_desc - 2 <= p.x0 < x_id - 2
        eh_texto = lambda p: na_coluna(p) and p.centro_y <= ultima + DISTANCIA_MAX
        for i, r in enumerate(ler_celulas(pg, topo, 1e9, eh_linha_valor, eh_texto)):
            texto = r["texto"]
            if i == 0 and carregado:   # começo de célula que veio da página anterior
                texto = " ".join(carregado + [texto]).strip()
                carregado = []
            m = DATA.match(r["palavras"][0].texto)
            nums = numeros(r["palavras"])
            registros.append((f"{m.group(3)}-{m.group(2)}-{m.group(1)}", texto, valor_br(nums[0].texto), valor_br(nums[-1].texto)))
        if n + 1 < len(doc.paginas):
            sobra = sorted((p for p in pg.palavras if na_coluna(p) and p.centro_y > ultima + DISTANCIA_MAX), key=lambda p: (round(p.top), p.x0))
            carregado = [p.texto for p in sobra]

    lancamentos = [{"data": d, "descricao": t, "valor": v} for d, t, v, _ in registros]
    r = _resumo(doc)
    conferiu = False
    corrente = r["inicial"]
    for d, _, v, s in registros:
        if corrente is not None:
            if abs(corrente + v - s) > 0.005:
                a, m, dia = d.split("-")
                return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(abs(corrente + v - s)), onde=f"{dia}/{m}/{a}")
            conferiu = True
        corrente = s
    if r["entradas"] is not None and r["saidas"] is not None:
        ent = sum(l["valor"] for l in lancamentos if l["valor"] > 0)
        sai = -sum(l["valor"] for l in lancamentos if l["valor"] < 0)
        dif = max(abs(ent - r["entradas"]), abs(sai - abs(r["saidas"])))
        if dif > 0.005:
            return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(dif), onde="o resumo do período")
        conferiu = True
    if r["final"] is not None and registros and abs(registros[-1][3] - r["final"]) > 0.005:
        return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(abs(registros[-1][3] - r["final"])), onde="o saldo final")
    return lancamentos, (None if conferiu else MENSAGENS["sem_conferencia"])
