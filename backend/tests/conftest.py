import sys
from pathlib import Path

import pytest

PASTA = Path(__file__).parent
sys.path.insert(0, str(PASTA.parent))

from app import create_app  # noqa: E402
from auth import criar_usuario  # noqa: E402
from banco import obter_banco  # noqa: E402


@pytest.fixture
def app(tmp_path):
    app = create_app({"BANCO": str(tmp_path / "teste.db"), "SECRET_KEY": "teste", "TESTING": True})
    with app.app_context():
        criar_usuario(obter_banco(), "ana@exemplo.com", "Ana", "senha-segura-1")
        criar_usuario(obter_banco(), "bruno@exemplo.com", "Bruno", "senha-segura-2")
    return app


def _entrar(app, email, senha):
    c = app.test_client()
    r = c.post("/entrar", data={"email": email, "senha": senha})
    assert r.status_code == 302, "login falhou"
    return c


@pytest.fixture
def cliente(app):
    return _entrar(app, "ana@exemplo.com", "senha-segura-1")


@pytest.fixture
def outro_cliente(app):
    return _entrar(app, "bruno@exemplo.com", "senha-segura-2")


@pytest.fixture
def arquivo():
    def abrir(nome):
        return (PASTA / "dados" / nome).read_bytes()
    return abrir
