"""Perfil Banco do Brasil (Dia · Lote · Documento · Histórico · Valor):
sinal (+)/(-) depois do valor e histórico centralizado na célula.
Conferência: Saldo Anterior + lançamentos = cada "Saldo do dia" e o "S A L D O"."""
import re

from leitura_pdf.comum import MENSAGENS, formatar_reais, ler_celulas, valor_br

NUM = re.compile(r"^[\d.]+,\d\d$")
DATA = re.compile(r"^(\d\d)/(\d\d)/(\d{4})$")
SINAIS = ("(+)", "(-)")


def reconhece(doc):
    t = doc.texto
    return "Extrato de Conta Corrente" in t and re.search(r"Dia\s+Lote\s+Documento\s+Histórico\s+Valor", t) is not None


def _cabecalho(pagina):
    cab = {p.texto: p for p in pagina.palavras if p.texto in ("Dia", "Histórico", "Valor")}
    return cab if len(cab) == 3 else None


def _valor(grupo):
    for i, p in enumerate(grupo[:-1]):
        if NUM.match(p.texto) and grupo[i + 1].texto in SINAIS:
            v = valor_br(p.texto)
            return v if grupo[i + 1].texto == "(+)" else -v
    return None


def ler(doc):
    registros, fim = [], False
    for pg in doc.paginas:
        if fim:
            break
        cab = _cabecalho(pg)
        if not cab:
            continue
        base = next((p.top for p in pg.palavras if p.texto == "Aplicações"), 1e9)
        fim = base < 1e9
        x_hist = cab["Histórico"].x0 - 2

        def eh_linha_valor(grupo):
            return DATA.match(grupo[0].texto) is not None and grupo[0].x0 < x_hist and _valor(grupo) is not None

        def eh_texto(p):
            return p.x0 >= x_hist and not NUM.match(p.texto) and p.texto not in SINAIS

        for r in ler_celulas(pg, cab["Histórico"].bottom, base, eh_linha_valor, eh_texto):
            m = DATA.match(r["palavras"][0].texto)
            registros.append((f"{m.group(3)}-{m.group(2)}-{m.group(1)}", r["texto"], _valor(r["palavras"])))

    lancamentos, corrente, aviso = [], None, None
    for data, texto, valor in registros:
        if texto.startswith("Saldo Anterior"):
            corrente = valor
        elif texto.startswith(("Saldo do dia", "S A L D O")):
            if corrente is not None and aviso is None and abs(corrente - valor) > 0.005:
                a, m, d = data.split("-")
                aviso = MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(abs(corrente - valor)), onde=f"{d}/{m}/{a}")
        else:
            lancamentos.append({"data": data, "descricao": texto, "valor": valor})
            if corrente is not None:
                corrente += valor
    return lancamentos, aviso
