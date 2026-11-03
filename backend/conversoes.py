"""Conversão dos dados de bancos criados por versões antigas do site.

Roda quando o servidor liga (ver banco.criar_tabelas), uma vez só por
banco (ver VERSAO). Antes de mexer nos dados, guarda uma cópia de
segurança do banco.
"""
import json
import re
import sqlite3
from datetime import datetime
from pathlib import Path

from categorizacao import CODIGOS_ANTIGOS, REGRAS, normalizar

# Nomes das categorias padrão de antes da lista única que mudaram de nome
# (os outros continuam iguais aos de REGRAS).
NOMES_ANTIGOS = {
    "pf": {"moradia": "Moradia", "casa": "Contas da casa", "transporte": "Transporte"},
    "empresa": {"aluguel": "Aluguel", "contas": "Água, luz e internet", "combustivel": "Combustível e entregas"},
}
# Categorias de empresa que viraram uma só com a de pessoa física.
CODIGO_NOVO = {"aluguel": "moradia", "contas": "casa", "combustivel": "transporte"}

_REGRA = {codigo: (nome, palavras) for codigo, nome, palavras in REGRAS}


# Versão dos dados, guardada no próprio banco (PRAGMA user_version).
# 1 = sem perfil; 2 = movimento interno ("Investimentos e reservas").
# Cada conversão roda uma vez só por banco: nomes que o cliente escolher
# depois (mesmo iguais aos antigos) ficam como estão.
VERSAO = 2


def converter(con, caminho_banco):
    versao = con.execute("PRAGMA user_version").fetchone()[0]
    if versao < 1:
        _converter_tipos_de_conta(con)
        if _ha_algo_para_converter(con):
            _copia_de_seguranca(con, caminho_banco, "sem-perfil")
        _converter_sem_perfil(con)
    if versao < 2:
        if _movimento_interno_tem_algo(con):
            _copia_de_seguranca(con, caminho_banco, "movimento-interno")
        _converter_movimento_interno(con)
    con.execute(f"PRAGMA user_version = {VERSAO}")


def _ha_algo_para_converter(con):
    perfis = "SELECT 1 FROM {} WHERE perfil IN ('pf', 'empresa') LIMIT 1"
    return bool(
        con.execute(perfis.format("paginas")).fetchone()
        or con.execute(perfis.format("extratos")).fetchone()
        or con.execute(
            "SELECT 1 FROM edicoes_padrao WHERE chave LIKE 'pf:%' OR chave LIKE 'empresa:%' LIMIT 1"
        ).fetchone()
    )


def _copia_de_seguranca(con, caminho_banco, motivo):
    """Copia o banco inteiro para um arquivo ao lado dele, com a data no nome."""
    if str(caminho_banco) == ":memory:":
        return
    con.commit()
    destino = Path(caminho_banco).with_name(f"painel-antes-{motivo}-{datetime.now():%Y%m%d-%H%M%S}.db")
    copia = sqlite3.connect(destino)
    try:
        con.backup(copia)
    finally:
        copia.close()


def _converter_tipos_de_conta(con):
    """O perfil MEI / PME ("pme") virou "empresa", e as edições das categorias
    padrão passaram a ser guardadas pelo código ("pf:mercado") em vez da
    posição ("pf:3"). Só encontra o que converter na primeira vez."""
    # edições: as de pf e empresa primeiro, para a de Empresa vencer a de MEI
    antigas = [
        (r[0], r[1], m.group(1), int(m.group(2)))
        for r in con.execute("SELECT usuario_id, chave FROM edicoes_padrao")
        for m in [re.fullmatch(r"(pf|empresa|pme):(\d+)", r[1])] if m
    ]
    antigas.sort(key=lambda x: x[2] == "pme")
    for usuario_id, chave, perfil, pos in antigas:
        codigos = CODIGOS_ANTIGOS[perfil]
        codigo = codigos[pos] if pos < len(codigos) else None
        nova = f"{'pf' if perfil == 'pf' else 'empresa'}:{codigo}"
        ja_existe = con.execute(
            "SELECT 1 FROM edicoes_padrao WHERE usuario_id = ? AND chave = ?", (usuario_id, nova)
        ).fetchone()
        if codigo is None or ja_existe:
            con.execute("DELETE FROM edicoes_padrao WHERE usuario_id = ? AND chave = ?", (usuario_id, chave))
        else:
            con.execute("UPDATE edicoes_padrao SET chave = ? WHERE usuario_id = ? AND chave = ?", (nova, usuario_id, chave))

    # subpastas de MEI vão para Empresa; nome repetido ganha " (MEI)"
    for pid, usuario_id, nome, tipo in con.execute(
        "SELECT id, usuario_id, nome, tipo FROM paginas WHERE perfil = 'pme'"
    ).fetchall():
        repetido = any(
            normalizar(r[0]) == normalizar(nome)
            for r in con.execute(
                "SELECT nome FROM paginas WHERE usuario_id = ? AND tipo = ? AND perfil = 'empresa'", (usuario_id, tipo)
            )
        )
        con.execute(
            "UPDATE paginas SET nome = ?, perfil = 'empresa' WHERE id = ?",
            (nome + " (MEI)" if repetido else nome, pid),
        )

    con.execute("UPDATE extratos SET perfil = 'empresa' WHERE perfil = 'pme'")

    for usuario_id, valor in con.execute("SELECT usuario_id, valor FROM preferencias WHERE chave = 'config'").fetchall():
        config = json.loads(valor)
        if isinstance(config, dict) and config.get("perfil") == "pme":
            config["perfil"] = "empresa"
            con.execute(
                "UPDATE preferencias SET valor = ? WHERE usuario_id = ? AND chave = 'config'",
                (json.dumps(config, ensure_ascii=False), usuario_id),
            )


def _converter_sem_perfil(con):
    """Os perfis (Pessoa física, Empresa ou MEI) deixaram de existir: as
    categorias viraram uma lista só e as pastas passaram a ser livres."""
    _renomear_categorias_com_nome_padrao(con)
    for (usuario_id,) in con.execute("SELECT id FROM usuarios").fetchall():
        _unir_edicoes(con, usuario_id)
        _pastas_sem_perfil(con, usuario_id)
    for tabela in ("paginas", "extratos"):
        con.execute(f"UPDATE {tabela} SET perfil = 'unico' WHERE perfil IN ('pf', 'empresa')")


def _renomear_em_tudo(con, usuario_id, antigo, novo):
    con.execute("UPDATE regras SET categoria = ? WHERE usuario_id = ? AND categoria = ?", (novo, usuario_id, antigo))
    con.execute(
        "UPDATE correcoes SET categoria = ? WHERE categoria = ? AND lancamento_id IN ("
        "SELECT l.id FROM lancamentos l JOIN extratos e ON e.id = l.extrato_id WHERE e.usuario_id = ?)",
        (novo, antigo, usuario_id),
    )


def _renomear_categorias_com_nome_padrao(con):
    """Categoria criada pelo cliente com o nome de uma categoria padrão (ex.: ele
    criou "Fornecedores" quando era pessoa física): a dele ganha " (sua)", e as
    regras e correções que apontavam para ela vão junto."""
    padrao = {normalizar(nome) for _, nome, _ in REGRAS}
    for cid, usuario_id, nome in con.execute("SELECT id, usuario_id, nome FROM categorias").fetchall():
        if normalizar(nome) in padrao:
            novo = nome + " (sua)"
            con.execute("UPDATE categorias SET nome = ? WHERE id = ?", (novo, cid))
            _renomear_em_tudo(con, usuario_id, nome, novo)


def _unir_edicoes(con, usuario_id):
    """"pf:x" e "empresa:x" viram "padrao:x". Se as duas categorias que viraram
    uma só foram editadas, ficam o nome e o tipo da de pessoa física e as
    palavras das duas. Regras e correções passam para o nome final."""
    antigas = {}
    for chave, nome, tipo, palavras in con.execute(
        "SELECT chave, nome, tipo, palavras FROM edicoes_padrao WHERE usuario_id = ? "
        "AND (chave LIKE 'pf:%' OR chave LIKE 'empresa:%')", (usuario_id,)
    ).fetchall():
        perfil, codigo = chave.split(":", 1)
        antigas[(perfil, codigo)] = (nome, tipo, json.loads(palavras) if palavras is not None else None)

    novas = {}
    for perfil in ("pf", "empresa"):  # pf primeiro: o nome e o tipo dela vencem
        for (p, codigo), (nome, tipo, palavras) in antigas.items():
            if p != perfil:
                continue
            novo = CODIGO_NOVO.get(codigo, codigo) if perfil == "empresa" else codigo
            if novo not in _REGRA:
                continue
            if novo not in novas:
                novas[novo] = [nome, tipo, palavras]
            elif novas[novo][2] is not None or palavras is not None:
                originais = [x.strip() for x in _REGRA[novo][1]]
                soma = (novas[novo][2] or originais) + (palavras or originais)
                novas[novo][2] = list(dict.fromkeys(soma))

    # nome de cada categoria antiga (o editado ou o original) → nome final
    trocas = {}
    pares = set(antigas) | {(p, c) for p, nomes in NOMES_ANTIGOS.items() for c in nomes}
    for perfil, codigo in pares:
        novo = CODIGO_NOVO.get(codigo, codigo) if perfil == "empresa" else codigo
        if novo not in _REGRA:
            continue
        antigo = antigas[(perfil, codigo)][0] if (perfil, codigo) in antigas else (
            NOMES_ANTIGOS.get(perfil, {}).get(codigo) or _REGRA[novo][0])
        final = novas[novo][0] if novo in novas else _REGRA[novo][0]
        if antigo != final:
            trocas[antigo] = final

    con.execute(
        "DELETE FROM edicoes_padrao WHERE usuario_id = ? AND (chave LIKE 'pf:%' OR chave LIKE 'empresa:%')", (usuario_id,)
    )
    for codigo, (nome, tipo, palavras) in novas.items():
        con.execute(
            "INSERT OR IGNORE INTO edicoes_padrao (usuario_id, chave, nome, tipo, palavras) VALUES (?, ?, ?, ?, ?)",
            (usuario_id, f"padrao:{codigo}", nome, tipo,
             None if palavras is None else json.dumps(palavras, ensure_ascii=False)),
        )
    for antigo, final in trocas.items():
        _renomear_em_tudo(con, usuario_id, antigo, final)


def _pastas_sem_perfil(con, usuario_id):
    """As subpastas viram pastas. Nome repetido entre as duas pastas principais:
    a de Empresa ganha " (Empresa)". Extratos de Empresa que estavam soltos
    vão para a pasta "Empresa" (criada se ainda não existir)."""
    def nomes_pf():
        return {normalizar(r[0]) for r in con.execute(
            "SELECT nome FROM paginas WHERE usuario_id = ? AND tipo = 'despesas' AND perfil = 'pf'", (usuario_id,))}

    repetidos = nomes_pf()
    for pid, nome in con.execute(
        "SELECT id, nome FROM paginas WHERE usuario_id = ? AND tipo = 'despesas' AND perfil = 'empresa'", (usuario_id,)
    ).fetchall():
        if normalizar(nome) in repetidos:
            con.execute("UPDATE paginas SET nome = ? WHERE id = ?", (nome + " (Empresa)", pid))

    soltos = [r[0] for r in con.execute(
        "SELECT id FROM extratos WHERE usuario_id = ? AND tipo = 'despesas' AND perfil = 'empresa' AND pagina_id IS NULL",
        (usuario_id,),
    )]
    if not soltos:
        return
    pasta = next((pid for pid, nome in con.execute(
        "SELECT id, nome FROM paginas WHERE usuario_id = ? AND tipo = 'despesas' ORDER BY id", (usuario_id,)
    ) if normalizar(nome) == normalizar("Empresa")), None)
    if pasta is None:
        pasta = con.execute(
            "INSERT INTO paginas (usuario_id, nome, tipo, perfil, criado_em) VALUES (?, 'Empresa', 'despesas', 'unico', ?)",
            (usuario_id, datetime.now().isoformat(timespec="seconds")),
        ).lastrowid
    con.executemany("UPDATE extratos SET pagina_id = ? WHERE id = ?", [(pasta, i) for i in soltos])


# ---------- versão 2: movimento interno ----------

NOMES_INTERNOS = ("Investimentos e reservas", "Transferências entre suas contas")


def _movimento_interno_tem_algo(con):
    internas = {normalizar(n) for n in NOMES_INTERNOS}
    return bool(
        any(normalizar(r[0]) in internas for r in con.execute("SELECT nome FROM categorias"))
        or con.execute("SELECT 1 FROM regras WHERE categoria = 'Investimentos' LIMIT 1").fetchone()
        or con.execute("SELECT 1 FROM correcoes WHERE categoria = 'Investimentos' LIMIT 1").fetchone()
    )


def _converter_movimento_interno(con):
    """"Investimentos" virou "Investimentos e reservas" (agora inclui cofrinho e
    reservas) e surgiu "Transferências entre suas contas". Regras e correções
    passam ao nome novo, a menos que o cliente tenha renomeado a categoria."""
    internas = {normalizar(n) for n in NOMES_INTERNOS}
    for cid, usuario_id, nome in con.execute("SELECT id, usuario_id, nome FROM categorias").fetchall():
        if normalizar(nome) in internas:
            novo = nome + " (sua)"
            con.execute("UPDATE categorias SET nome = ? WHERE id = ?", (novo, cid))
            _renomear_em_tudo(con, usuario_id, nome, novo)
    for (usuario_id,) in con.execute("SELECT id FROM usuarios").fetchall():
        editada = con.execute(
            "SELECT 1 FROM edicoes_padrao WHERE usuario_id = ? AND chave = 'padrao:investimentos'", (usuario_id,)
        ).fetchone()
        if not editada:
            _renomear_em_tudo(con, usuario_id, "Investimentos", "Investimentos e reservas")
