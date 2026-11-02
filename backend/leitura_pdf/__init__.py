"""Leitura de extrato da conta em PDF.

Cada banco conhecido tem um perfil (reconhece/ler); o genérico é sempre o
último. Regra de ouro: nunca devolver números errados calado — todo perfil
confere a leitura (totais ou saldo) e avisa ou recusa quando não fecha.
"""
import re

from leitura import ErroLeitura
from leitura_pdf.comum import MENSAGENS, abrir

PERFIS = []

_FATURA = re.compile(r"vencimento", re.I)
_FATURA_2 = re.compile(r"pagamento m[íi]nimo|limite total", re.I)


def ler_pdf(conteudo, senha=None):
    """Devolve (lançamentos, aviso). Levanta ErroLeitura (ou SenhaNecessaria /
    SenhaIncorreta) com a mensagem pronta para o cliente."""
    doc = abrir(conteudo, senha)
    texto = doc.texto
    if not texto.strip():
        raise ErroLeitura(MENSAGENS["sem_texto"])
    if re.search(r"Não há transações no período", texto, re.I):
        raise ErroLeitura(MENSAGENS["vazio"])
    if _FATURA.search(texto) and _FATURA_2.search(texto):
        raise ErroLeitura(MENSAGENS["fatura"])
    for perfil in PERFIS:
        if perfil.reconhece(doc):
            lancamentos, aviso = perfil.ler(doc)
            if not lancamentos:
                raise ErroLeitura(MENSAGENS["desconhecido"])
            lancamentos.sort(key=lambda l: l["data"])
            return lancamentos, aviso
    raise ErroLeitura(MENSAGENS["desconhecido"])
