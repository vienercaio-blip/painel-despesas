"""Recebe arquivos de extrato e devolve os lançamentos lidos e categorizados.
Nada é salvo aqui: salvar é feito em /api/extratos."""
from flask import jsonify, request

from auth import login_obrigatorio
from banco import obter_banco
from categorizacao import carregar_categorizador, perfil_valido, preparar_lancamentos
from leitura import ErroLeitura, ler_arquivo
from rotas import api
from rotas.util import erro, uid

MAX_ARQUIVOS = 20


@api.post("/leitura")
@login_obrigatorio
def ler_arquivos():
    arquivos = request.files.getlist("arquivos")
    if not arquivos:
        erro("Nenhum arquivo recebido.")
    if len(arquivos) > MAX_ARQUIVOS:
        erro(f"Envie no máximo {MAX_ARQUIVOS} arquivos de uma vez.")
    perfil = perfil_valido(request.form.get("perfil"))
    categorizador = carregar_categorizador(obter_banco(), uid(), perfil)

    resultado = []
    for arq in arquivos:
        nome = arq.filename or "arquivo"
        try:
            lista = ler_arquivo(nome, arq.read())
            resultado.append({"nome": nome, "lancamentos": preparar_lancamentos(lista, categorizador)})
        except ErroLeitura as e:
            resultado.append({"nome": nome, "erro": str(e)})
        except Exception:
            resultado.append({"nome": nome, "erro": "Não consegui ler este arquivo. Tente exportar de novo pelo site do banco."})
    return jsonify(perfil=perfil, arquivos=resultado)
