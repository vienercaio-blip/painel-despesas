"""Perfil C6 Bank: uma linha por lançamento, ano no cabeçalho do mês e
conferência pelos totais de entradas e saídas de cada mês."""
import re

from leitura_pdf.comum import MENSAGENS, formatar_reais, valor_br

VALOR = r"-?R\$ ?[\d.]+,\d\d"
CABECALHO = re.compile(r"^(\S+) (\d{4}) \( (\d\d)/(\d\d)/(\d{4}) - .*?Entradas: (" + VALOR + r") . Saídas: (" + VALOR + ")")
LINHA = re.compile(r"^(\d\d)/(\d\d) \d\d/\d\d (.+?) (" + VALOR + ")$")
TIPOS = ("Saída PIX", "Entrada PIX", "Débito de Cartão", "Pagamento", "Outros gastos", "Devolução PIX", "Entradas")


def reconhece(doc):
    return "C6 Bank" in doc.texto


def _descricao(meio):
    tipo = next((t for t in TIPOS if meio.startswith(t + " ")), "")
    desc = meio[len(tipo):].strip() if tipo else meio
    return desc if (not tipo or desc.startswith("Pix")) else f"{tipo} {desc}"


def ler(doc):
    lancamentos, meses, atual = [], [], None
    for linha in doc.texto.split("\n"):
        m = CABECALHO.match(linha)
        if m:
            atual = {"nome": f"{m.group(1)} {m.group(2)}", "ano": m.group(5),
                     "entradas": valor_br(m.group(6)), "saidas": valor_br(m.group(7)), "e": 0.0, "s": 0.0}
            meses.append(atual)
            continue
        m = LINHA.match(linha)
        if m and atual:
            v = valor_br(m.group(4))
            lancamentos.append({"data": f"{atual['ano']}-{m.group(2)}-{m.group(1)}", "descricao": _descricao(m.group(3)), "valor": v})
            if v > 0:
                atual["e"] += v
            else:
                atual["s"] -= v
    for mes in meses:
        dif = max(abs(mes["e"] - mes["entradas"]), abs(mes["s"] - mes["saidas"]))
        if dif > 0.005:
            return lancamentos, MENSAGENS["nao_bateu"].format(diferenca=formatar_reais(dif), onde=mes["nome"])
    return lancamentos, None
