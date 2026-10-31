"""Rotas da API. Cada arquivo cuida de um assunto:

- conta.py       estado inicial do painel, preferências, apagar dados
- leitura.py     receber arquivos e devolver os lançamentos lidos
- extratos.py    extratos salvos, lançamentos e correções
- paginas.py     páginas (pastas) dos extratos
- categorias.py  categorias, regras e recategorização
"""
from flask import Blueprint

api = Blueprint("api", __name__, url_prefix="/api")

# importados depois de criar o blueprint, para registrar as rotas nele
from rotas import conta, leitura, extratos, paginas, categorias  # noqa: E402,F401
