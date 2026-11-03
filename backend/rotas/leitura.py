"""Recebe arquivos de extrato e devolve os lançamentos lidos e categorizados.
Nada é salvo aqui: salvar é feito em /api/extratos."""
from flask import jsonify, request

from auth import login_obrigatorio
from banco import obter_banco
from categorizacao import carregar_categorizador, preparar_lancamentos
from leitura import ErroLeitura, ler_arquivo_com_aviso
from leitura_pdf.comum import SenhaIncorreta, SenhaNecessaria
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
    senha = request.form.get("senha") or None  # só para abrir PDFs protegidos; nunca é guardada
    categorizador = carregar_categorizador(obter_banco(), uid())

    resultado = []
    for arq in arquivos:
        nome = arq.filename or "arquivo"
        try:
            lista, aviso = ler_arquivo_com_aviso(nome, arq.read(), senha)
            item = {"nome": nome, "lancamentos": preparar_lancamentos(lista, categorizador)}
            if aviso:
                item["aviso"] = aviso
            resultado.append(item)
        except SenhaNecessaria as e:
            resultado.append({"nome": nome, "erro": str(e), "codigo": "senha"})
        except SenhaIncorreta as e:
            resultado.append({"nome": nome, "erro": str(e), "codigo": "senha_incorreta"})
        except ErroLeitura as e:
            resultado.append({"nome": nome, "erro": str(e)})
        except Exception:
            resultado.append({"nome": nome, "erro": "Não consegui ler este arquivo. Tente exportar de novo pelo site do banco."})
    return jsonify(arquivos=resultado)
