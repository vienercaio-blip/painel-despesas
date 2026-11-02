"""Gera PDFs inventados para os testes da leitura de PDF.

Escreve um PDF mínimo à mão (Helvetica, WinAnsiEncoding), com cada texto na
posição e na cor escolhidas, para imitar o layout de cada banco sem usar
extratos reais. Com senha, criptografa usando o pypdf.
"""
import io

A4 = (595, 842)


def _texto_pdf(texto):
    b = texto.encode("cp1252", errors="replace")
    return b.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def _conteudo(itens):
    partes = []
    for item in itens:
        x, y, texto = item[:3]
        cor = item[3] if len(item) > 3 else (0, 0, 0)
        partes.append(b"%.3f %.3f %.3f rg BT /F1 9 Tf %.2f %.2f Td (" % (*cor, x, A4[1] - y) + _texto_pdf(texto) + b") Tj ET")
    return b"\n".join(partes)


def pdf(paginas, senha=None):
    """paginas: lista de páginas; cada página é uma lista de (x, y, texto) ou
    (x, y, texto, (r, g, b)), com y medido a partir do topo."""
    objetos = [b"<< /Type /Catalog /Pages 2 0 R >>", None,
               b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"]
    filhos = []
    for itens in paginas:
        conteudo = _conteudo(itens)
        objetos.append(b"<< /Length %d >>\nstream\n" % len(conteudo) + conteudo + b"\nendstream")
        n_conteudo = len(objetos)
        objetos.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>"
                       % (A4[0], A4[1], n_conteudo))
        filhos.append(len(objetos))
    objetos[1] = b"<< /Type /Pages /Kids [" + b" ".join(b"%d 0 R" % n for n in filhos) + b"] /Count %d >>" % len(filhos)

    saida = io.BytesIO()
    saida.write(b"%PDF-1.4\n")
    posicoes = []
    for i, obj in enumerate(objetos, 1):
        posicoes.append(saida.tell())
        saida.write(b"%d 0 obj\n" % i + obj + b"\nendobj\n")
    xref = saida.tell()
    saida.write(b"xref\n0 %d\n0000000000 65535 f \n" % (len(objetos) + 1))
    for p in posicoes:
        saida.write(b"%010d 00000 n \n" % p)
    saida.write(b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objetos) + 1, xref))
    dados = saida.getvalue()
    if senha is None:
        return dados

    from pypdf import PdfReader, PdfWriter
    escritor = PdfWriter(clone_from=PdfReader(io.BytesIO(dados)))
    escritor.encrypt(senha, algorithm="AES-128")
    out = io.BytesIO()
    escritor.write(out)
    return out.getvalue()


def pdf_linhas(paginas, senha=None, x=40, topo=50, passo=14):
    """Atalho: cada página é uma lista de linhas de texto, de cima para baixo."""
    return pdf([[(x, topo + i * passo, l) for i, l in enumerate(linhas)] for linhas in paginas], senha=senha)
