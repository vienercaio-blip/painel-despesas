"""Ponto de partida do backend.

Para rodar (dentro da pasta backend):
    flask --app app run --debug
e abra http://127.0.0.1:5000 no navegador.
"""
import os
import secrets
from datetime import timedelta
from pathlib import Path

from flask import Flask, jsonify, send_from_directory

import banco
from auth import bp as auth_bp, login_obrigatorio
from rotas import api

PASTA_BACKEND = Path(__file__).parent
PASTA_FRONTEND = PASTA_BACKEND.parent / "frontend"
PASTA_DADOS = PASTA_BACKEND / "dados"

# Em modo --debug, a página pergunta ao servidor a cada segundo se algum
# arquivo mudou e, se mudou, recarrega sozinha.
_SCRIPT_RECARREGAR = """<script>
(function(){
  var atual = null;
  setInterval(function(){
    fetch('/_versao').then(function(r){ return r.json(); }).then(function(d){
      if (atual !== null && d.v !== atual) location.reload();
      atual = d.v;
    }).catch(function(){});
  }, 1000);
})();
</script>"""


def _chave_secreta():
    """Chave que protege os cookies de login. Fica guardada em dados/chave_secreta
    (não compartilhe esse arquivo). Em produção, use a variável SECRET_KEY."""
    if os.environ.get("SECRET_KEY"):
        return os.environ["SECRET_KEY"]
    arquivo = PASTA_DADOS / "chave_secreta"
    if not arquivo.exists():
        PASTA_DADOS.mkdir(parents=True, exist_ok=True)
        arquivo.write_text(secrets.token_hex(32))
    return arquivo.read_text().strip()


def create_app(config=None):
    app = Flask(__name__, static_folder=None)
    app.config.update(
        BANCO=os.environ.get("BANCO", str(PASTA_DADOS / "painel.db")),
        MAX_CONTENT_LENGTH=20 * 1024 * 1024,  # 20 MB por envio
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        PERMANENT_SESSION_LIFETIME=timedelta(days=14),
        JSON_SORT_KEYS=False,
    )
    if config:
        app.config.update(config)
    if not app.config.get("SECRET_KEY"):
        app.config["SECRET_KEY"] = _chave_secreta()
    app.json.ensure_ascii = False
    app.json.sort_keys = False

    banco.iniciar(app)
    app.register_blueprint(auth_bp)
    app.register_blueprint(api)

    # ----- frontend (as telas) -----
    @app.get("/")
    @login_obrigatorio
    def inicio():
        if app.debug:
            html = (PASTA_FRONTEND / "index.html").read_text(encoding="utf-8")
            return html.replace("</body>", _SCRIPT_RECARREGAR + "</body>")
        return send_from_directory(PASTA_FRONTEND, "index.html")

    # ----- só em modo --debug: recarrega a página quando um arquivo muda -----
    if app.debug:
        @app.get("/_versao")
        def versao():
            arquivos = [
                *PASTA_FRONTEND.rglob("*"),
                *PASTA_BACKEND.glob("*.py"),
                *(PASTA_BACKEND / "rotas").glob("*.py"),
                *(PASTA_BACKEND / "templates").glob("*"),
            ]
            return jsonify(v=max(a.stat().st_mtime for a in arquivos if a.is_file()))

    @app.get("/css/<path:arquivo>")
    def css(arquivo):
        return send_from_directory(PASTA_FRONTEND / "css", arquivo)

    @app.get("/js/<path:arquivo>")
    def js(arquivo):
        return send_from_directory(PASTA_FRONTEND / "js", arquivo)

    # ----- respostas de erro da API em JSON -----
    @app.errorhandler(413)
    def grande_demais(_e):
        return jsonify(erro="Arquivo grande demais (limite de 20 MB por envio)."), 413

    @app.after_request
    def cabecalhos(resp):
        resp.headers.setdefault("X-Content-Type-Options", "nosniff")
        resp.headers.setdefault("X-Frame-Options", "DENY")
        resp.headers.setdefault("Referrer-Policy", "same-origin")
        return resp

    return app
