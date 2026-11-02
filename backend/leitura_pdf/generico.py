"""Perfil genérico, para bancos sem perfil próprio. Tenta ler por colunas
(Crédito/Débito/Valor/Saldo) e depois linha a linha. Só aceita o que dá
para conferir: com coluna de saldo, a cadeia precisa fechar (um sinal
invertido é corrigido); sem saldo, todo valor precisa ter sinal explícito,
e o cliente recebe o aviso de "confira"."""
import re
from datetime import date

from leitura import ErroLeitura
from leitura_pdf.comum import MENSAGENS, ler_celulas, valor_br

MESES = {m: i for i, m in enumerate("jan fev mar abr mai jun jul ago set out nov dez".split(), 1)}
NUM = r"-?R?\$?\s?-?[\d.]+,\d\d"
SINAL = r"-|\(\+\)|\(-\)|D|C"
LINHA = re.compile(r"^(\d{2})/(\d{2})(?:/(\d{2,4}))?\s+(.+?)\s+(" + NUM + r")\s*(" + SINAL + r")?(?:\s+(" + NUM + r")\s*(" + SINAL + r")?)?$")
DATA_INICIO = re.compile(r"^(\d{2})/(\d{2})(?:/(\d{2,4}))?\b")
NUM_PALAVRA = re.compile(r"^-?R?\$?-?[\d.]+,\d\d-?$")
PERIODO = re.compile(r"(\d\d)/(\d\d)/(\d{4})\s+(?:a|até)\s+(\d\d)/(\d\d)/(\d{4})")
MES_ANO = re.compile(r"\b(" + "|".join(MESES) + r")[a-zç]*\.?\s+(?:de\s+)?(\d{4})\b", re.I)
DATA_COMPLETA = re.compile(r"\b\d\d/\d\d/(\d{4})\b")


def reconhece(doc):
    return True


def _resolvedor_de_ano(texto):
    m = PERIODO.search(texto)
    if m:
        ini = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        fim = date(int(m.group(6)), int(m.group(5)), int(m.group(4)))
        return lambda mes: ini.year if ini.year == fim.year or mes >= ini.month else fim.year
    m = MES_ANO.search(texto) or DATA_COMPLETA.search(texto)
    if m:
        ano = int(m.group(2) if m.re is MES_ANO else m.group(1))
        return lambda mes: ano
    return None


def _data(dia, mes, ano, ano_de):
    if ano:
        a = int(ano) + (2000 if len(ano) == 2 else 0)
    elif ano_de:
        a = ano_de(int(mes))
    else:
        return None
    return f"{a:04d}-{int(mes):02d}-{int(dia):02d}"


def _com_sinal(texto, sufixo):
    """Valor e se o sinal é explícito."""
    t = texto.replace(" ", "")
    v = abs(valor_br(t.rstrip("-")))
    if t.startswith("-") or t.startswith("R$-") or t.endswith("-") or sufixo in ("-", "(-)", "D"):
        return -v, True
    return v, sufixo in ("(+)", "C")


def _conferir(itens, ancora, saldo_verificado=False):
    """itens: [[valor, saldo|None, explicito]]. Devolve o aviso (None ou
    "confira") ou levanta ErroLeitura se não der para confiar.
    saldo_verificado: as linhas de saldo conferiram a soma até o último lançamento."""
    if itens and all(i[1] is not None for i in itens):
        if ancora is None and not itens[0][2]:
            raise ErroLeitura(MENSAGENS["desconhecido"])  # o 1º valor não tem com o que ser conferido
        anterior = ancora
        for i in itens:
            if anterior is not None and abs(anterior + i[0] - i[1]) > 0.005:
                if abs(anterior - i[0] - i[1]) <= 0.005:
                    i[0] = -i[0]  # sinal invertido: a cadeia de saldos manda
                else:
                    raise ErroLeitura(MENSAGENS["desconhecido"])
            anterior = i[1]
        return None
    if itens and all(i[2] for i in itens):
        return None if saldo_verificado else MENSAGENS["confira"]
    raise ErroLeitura(MENSAGENS["desconhecido"])


def _eh_saldo(texto):
    return re.search("saldo", texto.replace(" ", ""), re.I) is not None  # pega também "S A L D O"


class _Saldos:
    """Linhas de saldo ("Saldo anterior", "Saldo do dia", "S A L D O")
    conferindo a soma dos lançamentos entre elas."""

    def __init__(self):
        self.ancora = self.corrente = None
        self.pendente = False   # houve lançamento depois da última conferência

    def saldo(self, valor):
        if self.ancora is None:
            self.ancora = self.corrente = valor
        elif self.corrente is not None:
            if abs(self.corrente - valor) > 0.005:
                raise ErroLeitura(MENSAGENS["desconhecido"])
            self.pendente = False

    def lancamento(self, valor):
        if self.corrente is not None:
            self.corrente += valor
        self.pendente = True

    @property
    def verificado(self):
        return self.ancora is not None and not self.pendente


# ---------- jeito "linha" ----------

VALOR_NO_FIM = re.compile(r"\d,\d\d\s*(?:-|D|C|\(\+\)|\(-\))?$")


def _por_linhas(doc, ano_de):
    itens, lancamentos, datadas, sobras = [], [], 0, 0
    saldos = _Saldos()
    for linha in doc.texto.split(chr(10)):
        if not DATA_INICIO.match(linha):
            # linha com valor no fim e sem data, depois do primeiro lançamento: não foi lida
            if lancamentos and VALOR_NO_FIM.search(linha) and not _eh_saldo(linha):
                datadas += 1
                sobras += 1
            continue
        if not re.search(r"\d,\d\d", linha):
            continue
        datadas += 1
        m = LINHA.match(linha)
        if not m:
            sobras += 1
            continue
        data = _data(m.group(1), m.group(2), m.group(3), ano_de)
        desc = m.group(4).strip()
        v, explicito = _com_sinal(m.group(5), m.group(6))
        saldo = _com_sinal(m.group(7), m.group(8))[0] if m.group(7) else None
        if _eh_saldo(desc):
            saldos.saldo(saldo if saldo is not None else v)
            continue
        if data is None:
            sobras += 1
            continue
        lancamentos.append({"data": data, "descricao": desc, "valor": v})
        itens.append([v, saldo, explicito])
        saldos.lancamento(v)
    if not lancamentos or sobras > 0.10 * datadas:
        raise ErroLeitura(MENSAGENS["desconhecido"])
    aviso = _conferir(itens, saldos.ancora, saldos.verificado)
    if sobras and aviso is None:
        aviso = MENSAGENS["confira"]   # alguma linha ficou de fora: nunca dizer que está tudo certo
    for l, i in zip(lancamentos, itens):
        l["valor"] = i[0]
    return lancamentos, aviso


# ---------- jeito "colunas" (célula centralizada) ----------

def _por_colunas(doc, ano_de):
    itens, lancamentos, data = [], [], None
    saldos = _Saldos()
    achou = False
    for pg in doc.paginas:
        cab = {}
        for p in pg.palavras:
            if p.texto in ("Crédito", "Débito", "Valor", "Saldo", "Data", "Dia", "Histórico", "Lançamento", "Lançamentos", "Descrição") and p.texto not in cab:
                cab[p.texto] = p
        colunas = {k: cab[k].centro_x for k in ("Crédito", "Débito", "Valor", "Saldo") if k in cab}
        if not (("Crédito" in colunas and "Débito" in colunas) or "Saldo" in colunas) or not ({"Data", "Dia"} & set(cab)):
            continue
        texto_cab = next((cab[k] for k in ("Histórico", "Lançamento", "Lançamentos", "Descrição") if k in cab), None)
        if texto_cab is None:
            continue
        achou = True
        x_texto, x_valores = texto_cab.x0 - 2, min(cab[k].x0 for k in colunas) - 10
        topo = max(cab[k].bottom for k in colunas)
        coluna = lambda p: min(colunas, key=lambda k: abs(colunas[k] - p.centro_x))

        def numeros(grupo):
            return [p for p in grupo if NUM_PALAVRA.match(p.texto) and p.x0 >= x_valores]

        def eh_linha_valor(grupo):
            return bool(numeros(grupo))

        def eh_texto(p):
            return x_texto <= p.x0 < x_valores and not re.match(r"^\d{5,}$", p.texto)

        for r in ler_celulas(pg, topo, 1e9, eh_linha_valor, eh_texto):
            grupo = r["palavras"]
            m = next((DATA_INICIO.match(p.texto) for p in grupo if p.x0 < x_texto and DATA_INICIO.match(p.texto)), None)
            if m:
                data = _data(m.group(1), m.group(2), m.group(3), ano_de)
            valor = saldo = None
            explicito = False
            for p in numeros(grupo):
                seguinte = next((q.texto for q in grupo if q.x0 > p.x1 and q.x0 - p.x1 < 12), None)
                sufixo = seguinte if seguinte in ("D", "C", "(+)", "(-)") else None
                c = coluna(p)
                if c == "Saldo":
                    s, _ = _com_sinal(p.texto, sufixo)
                    saldo = -abs(s) if p.cor == (1.0, 0.0, 0.0) else s
                elif c == "Crédito":
                    valor, explicito = abs(valor_br(p.texto)), True
                elif c == "Débito":
                    valor, explicito = -abs(valor_br(p.texto)), True
                else:
                    valor, explicito = _com_sinal(p.texto, sufixo)
            if _eh_saldo(r["texto"]):
                saldos.saldo(saldo if saldo is not None else abs(valor) if valor is not None else 0.0)
                continue
            if valor is None:
                continue
            if data is None:
                raise ErroLeitura(MENSAGENS["desconhecido"])
            lancamentos.append({"data": data, "descricao": r["texto"], "valor": valor})
            itens.append([valor, saldo, explicito])
            saldos.lancamento(valor)
    if not achou or not lancamentos:
        return None
    aviso = _conferir(itens, saldos.ancora, saldos.verificado)
    for l, i in zip(lancamentos, itens):
        l["valor"] = i[0]
    return lancamentos, aviso


def ler(doc):
    ano_de = _resolvedor_de_ano(doc.texto)
    try:
        resultado = _por_colunas(doc, ano_de)
        if resultado:
            return resultado
    except ErroLeitura:
        pass  # as colunas não fecharam: tenta linha a linha
    return _por_linhas(doc, ano_de)
