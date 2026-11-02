"""Base da leitura de PDF: abrir (limites e senha), texto em linhas,
palavras com posição e cor, valores em reais e conferências."""
import io
import re
from dataclasses import dataclass, field

from leitura import ErroLeitura

LIMITE_BYTES = 15 * 1024 * 1024
LIMITE_PAGINAS = 300

MENSAGENS = {
    "sem_texto": "Não consegui ler os lançamentos deste PDF. Ele pode ser uma foto ou um formato que ainda não conhecemos. Exporte em OFX ou CSV.",
    "vazio": "Este extrato não tem lançamentos no período escolhido. Gere de novo no app do banco com um período maior.",
    "fatura": "Este PDF parece uma fatura de cartão de crédito. Por enquanto lemos só extratos da conta.",
    "grande": "Este PDF é grande demais (limite de 15 MB e 300 páginas). Gere um período menor.",
    "desconhecido": "Ainda não conhecemos este formato de PDF. Exporte em OFX ou CSV.",
    "confira": "Lemos este PDF pelo formato geral. Confira se o total de entradas e saídas bate com o seu extrato.",
    "nao_bateu": "A soma não bateu com os totais do banco (diferença de {diferenca} em {onde}). "
                 "Algum lançamento pode ter ficado de fora. Se puder, exporte em OFX.",
    "sem_conferencia": "Não encontramos no PDF os totais ou o saldo para conferir os valores. "
                       "Confira se o total de entradas e saídas bate com o seu extrato.",
    "linha_nao_lida": "Alguma linha de {onde} não foi lida. Confira se os valores batem com o seu extrato.",
    "senha": "Este PDF tem senha. Digite a senha que o banco informou.",
    "senha_incorreta": "Senha incorreta. Tente de novo.",
}


class SenhaNecessaria(ErroLeitura):
    """O PDF tem senha e ela não foi informada."""


class SenhaIncorreta(ErroLeitura):
    """A senha informada não abre o PDF."""


@dataclass
class Palavra:
    texto: str
    x0: float
    x1: float
    top: float
    bottom: float
    cor: tuple | None = None

    @property
    def centro_x(self):
        return (self.x0 + self.x1) / 2

    @property
    def centro_y(self):
        return (self.top + self.bottom) / 2


@dataclass
class Pagina:
    linhas: list = field(default_factory=list)
    palavras: list = field(default_factory=list)


@dataclass
class Doc:
    paginas: list = field(default_factory=list)

    @property
    def texto(self):
        return "\n".join("\n".join(p.linhas) for p in self.paginas)


def _cor(c):
    if isinstance(c, (list, tuple)) and len(c) == 3:
        return tuple(float(x) for x in c)
    return None


def abrir(conteudo, senha):
    """Abre o PDF e extrai linhas e palavras de cada página."""
    if len(conteudo) > LIMITE_BYTES:
        raise ErroLeitura(MENSAGENS["grande"])
    import pdfplumber
    from pdfplumber.utils.exceptions import PdfminerException

    try:
        pdf = pdfplumber.open(io.BytesIO(conteudo), password=senha or "")
        paginas = pdf.pages
    except PdfminerException as e:
        if "PasswordIncorrect" in repr(e):
            raise (SenhaIncorreta(MENSAGENS["senha_incorreta"]) if senha else SenhaNecessaria(MENSAGENS["senha"]))
        raise ErroLeitura(MENSAGENS["sem_texto"])
    except Exception:
        raise ErroLeitura(MENSAGENS["sem_texto"])
    try:
        if len(paginas) > LIMITE_PAGINAS:
            raise ErroLeitura(MENSAGENS["grande"])
        doc = Doc()
        for pg in paginas:
            texto = (pg.extract_text() or "").replace("\xa0", " ")
            linhas = [l.strip() for l in texto.split("\n") if l.strip()]
            palavras = [
                Palavra(w["text"].replace("\xa0", " "), w["x0"], w["x1"], w["top"], w["bottom"], _cor(w.get("non_stroking_color")))
                for w in pg.extract_words(extra_attrs=["non_stroking_color"])
            ]
            doc.paginas.append(Pagina(linhas, palavras))
        return doc
    except ErroLeitura:
        raise
    except Exception:
        raise ErroLeitura(MENSAGENS["sem_texto"])
    finally:
        pdf.close()


_NAO_NUMERO = re.compile(r"[^\d,.\-]")


def valor_br(texto):
    """'R$ 1.234,56' → 1234.56; '-R$ 3,00' → -3.0; '- 850,00' → -850.0."""
    t = _NAO_NUMERO.sub("", texto.replace("+", ""))
    negativo = t.startswith("-")
    t = t.lstrip("-").replace(".", "").replace(",", ".")
    v = float(t)
    return -v if negativo and v else v


def cadeia_quebras(itens):
    """itens: [(valor, saldo)] em ordem. Devolve os índices i ≥ 1 onde
    saldo anterior + valor não dá o saldo impresso (tolerância de meio centavo)."""
    return [i for i in range(1, len(itens)) if abs(itens[i - 1][1] + itens[i][0] - itens[i][1]) > 0.005]


_VALOR_NO_FIM = re.compile(r"^(.*?)\s*(-?R?\$?\s?[\d.]+,\d\d)$")


def ler_valor_no_topo(linhas, cabecalho, valor=None):
    """Jeito "valor no topo" (ex.: Nubank): a linha com valor no fim abre um
    lançamento, e as linhas sem valor que vêm depois continuam a descrição,
    até o próximo valor ou cabeçalho (inclusive passando de página).
    cabecalho(linha) devolve um contexto novo (dia, sinal…) ou None.
    valor: regex (descrição, valor) — o padrão aceita sinal; quem não usa
    sinal passa um regex sem ele, para não engolir um "-" da descrição.
    Devolve [[contexto, descricao, texto_do_valor]]."""
    valor = valor or _VALOR_NO_FIM
    saida, ctx = [], None
    for linha in linhas:
        novo = cabecalho(linha)
        if novo is not None:
            ctx = novo
            continue
        if ctx is None:
            continue
        m = valor.match(linha)
        if m:
            saida.append([ctx, m.group(1).strip(), m.group(2)])
        elif saida and saida[-1][0] is ctx:
            saida[-1][1] = (saida[-1][1] + " " + linha).strip()
    return saida


def agrupar_linhas(palavras, tolerancia=3.0):
    """Junta em linhas as palavras cujo centro vertical fica a até `tolerancia`
    pontos do centro da linha (arredondar a altura partia uma linha em duas
    quando a data ficava meio ponto acima dos números). Cada linha vem
    ordenada da esquerda para a direita."""
    linhas = []
    for p in sorted(palavras, key=lambda p: p.centro_y):
        if linhas and abs(p.centro_y - linhas[-1]["y"]) <= tolerancia:
            linhas[-1]["palavras"].append(p)
            ps = linhas[-1]["palavras"]
            linhas[-1]["y"] = sum(q.centro_y for q in ps) / len(ps)
        else:
            linhas.append({"y": p.centro_y, "palavras": [p]})
    return [sorted(l["palavras"], key=lambda p: p.x0) for l in linhas]


def ler_celulas(pagina, topo, base, eh_linha_valor, eh_texto):
    """Jeito "célula centralizada" (ex.: Bradesco, BB): o texto de cada célula
    fica centralizado na vertical, então parte do histórico sai acima e parte
    abaixo da linha do valor. As linhas aceitas por eh_linha_valor(palavras)
    viram registros; cada palavra aceita por eh_texto(palavra), da própria
    linha ou de outra, vai para o registro mais próximo na vertical.
    Devolve [{"y", "palavras", "texto"}] em ordem, com "texto" já montado."""
    registros, soltas = [], []
    for grupo in agrupar_linhas([p for p in pagina.palavras if topo < p.top < base]):
        if eh_linha_valor(grupo):
            registros.append({"y": sum(p.centro_y for p in grupo) / len(grupo), "palavras": grupo, "_txt": []})
        soltas.append(grupo)
    if not registros:
        return []
    for grupo in soltas:
        for p in grupo:
            if eh_texto(p):
                alvo = min(registros, key=lambda r: abs(r["y"] - p.centro_y))
                alvo["_txt"].append(p)
    for r in registros:
        r["texto"] = " ".join(p.texto for p in sorted(r.pop("_txt"), key=lambda p: (round(p.top), p.x0)))
    return registros


def formatar_reais(v):
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-R$ " if v < 0 else "R$ ") + s
