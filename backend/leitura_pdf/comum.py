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


def formatar_reais(v):
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("-R$ " if v < 0 else "R$ ") + s
