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
        base = _inicio_aplicacoes(pg)
        fim = base < 1e9
        x_hist = cab["Histórico"].x0 - 2

        def eh_linha_valor(grupo):
            return DATA.match(grupo[0].texto) is not None and grupo[0].x0 < x_hist and _valor(grupo) is not None

        def eh_texto(p):
            return p.x0 >= x_hist and not NUM.match(p.texto) and p.texto not in SINAIS

        for r in ler_celulas(pg, cab["Histórico"].bottom, base, eh_linha_valor, eh_texto):
            m = DATA.match(r["palavras"][0].texto)
            # o tipo da linha vem das palavras da própria linha do valor: um texto que
            # sobrou da página anterior não pode transformar um saldo em lançamento
            linha = " ".join(p.texto for p in r["palavras"])
            registros.append((f"{m.group(3)}-{m.group(2)}-{m.group(1)}", r["texto"], _valor(r["palavras"]), linha))

    lancamentos, corrente, aviso, pendente = [], None, None, False
    for data, texto, valor, linha in registros:
        if "Saldo Anterior" in linha:
            corrente = valor
        elif "Saldo do dia" in linha or "S A L D O" in linha:
            if corrente is not None:
                if aviso is None and abs(corrente - valor) > 0.005:
                    a, m, d = data.split("-")
                    aviso = MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(abs(corrente - valor)), onde=f"{d}/{m}/{a}")
                pendente = False
        else:
            lancamentos.append({"data": data, "descricao": texto, "valor": valor})
            pendente = True
            if corrente is not None:
                corrente += valor
    if aviso is None and (corrente is None or pendente):
        aviso = MENSAGENS["sem_conferencia"]   # nenhum saldo conferiu o fim do extrato
    return lancamentos, aviso


def _inicio_aplicacoes(pagina):
    """Topo da seção "Aplicações Financeiras" (não é lançamento), ou 1e9."""
    palavras = sorted(pagina.palavras, key=lambda p: (round(p.top), p.x0))
    for a, b in zip(palavras, palavras[1:]):
        if a.texto == "Aplicações" and b.texto == "Financeiras" and abs(a.top - b.top) < 3:
            return a.top
    return 1e9
