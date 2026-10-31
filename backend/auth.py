"""Login, logout e criação de usuários.

Cada cliente tem seu próprio login e só vê os próprios dados.
Para criar um usuário, rode no terminal (dentro da pasta backend):
    flask --app app criar-usuario
"""
import functools
import getpass

import click
from flask import Blueprint, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from banco import agora, obter_banco

bp = Blueprint("auth", __name__, cli_group=None)


@bp.before_app_request
def carregar_usuario():
    uid = session.get("usuario_id")
    g.usuario = None
    if uid is not None:
        g.usuario = obter_banco().execute(
            "SELECT id, email, nome FROM usuarios WHERE id = ?", (uid,)
        ).fetchone()


def login_obrigatorio(view):
    """Protege uma rota: a API responde 401; as páginas mandam para o login."""
    @functools.wraps(view)
    def protegida(*args, **kwargs):
        if g.usuario is None:
            if request.path.startswith("/api/"):
                return jsonify(erro="Sua sessão terminou. Entre de novo."), 401
            return redirect(url_for("auth.entrar"))
        return view(*args, **kwargs)
    return protegida


@bp.route("/entrar", methods=["GET", "POST"])
def entrar():
    erro = None
    email = ""
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        senha = request.form.get("senha", "")
        usuario = obter_banco().execute(
            "SELECT id, senha_hash FROM usuarios WHERE email = ?", (email,)
        ).fetchone()
        if usuario is None or not check_password_hash(usuario["senha_hash"], senha):
            erro = "E-mail ou senha incorretos."
        else:
            session.clear()
            session.permanent = True
            session["usuario_id"] = usuario["id"]
            return redirect("/")
    return render_template("entrar.html", erro=erro, email=email)


@bp.route("/sair", methods=["POST"])
def sair():
    session.clear()
    return redirect(url_for("auth.entrar"))


def criar_usuario(banco, email, nome, senha):
    email = email.strip().lower()
    if banco.execute("SELECT 1 FROM usuarios WHERE email = ?", (email,)).fetchone():
        raise ValueError(f"Já existe um usuário com o e-mail {email}.")
    if len(senha) < 8:
        raise ValueError("A senha precisa ter pelo menos 8 caracteres.")
    cur = banco.execute(
        "INSERT INTO usuarios (email, nome, senha_hash, criado_em) VALUES (?, ?, ?, ?)",
        (email, nome.strip(), generate_password_hash(senha), agora()),
    )
    banco.commit()
    return cur.lastrowid


@bp.cli.command("criar-usuario", help="Cria um login para um cliente.")
def comando_criar_usuario():
    email = click.prompt("E-mail")
    nome = click.prompt("Nome (como aparece no painel)")
    senha = getpass.getpass("Senha (mínimo 8 caracteres): ")
    try:
        criar_usuario(obter_banco(), email, nome, senha)
    except ValueError as e:
        raise click.ClickException(str(e))
    click.echo(f"Usuário {email} criado.")
