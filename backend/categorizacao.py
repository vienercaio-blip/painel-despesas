"""Regras de categorização dos lançamentos.

Aqui ficam as categorias padrão de cada perfil (pessoa física, empresa,
MEI/PME) e a lógica que decide em qual categoria cada despesa cai.

Prioridade da classificação (da mais forte para a mais fraca):
  1. correção "só neste extrato"
  2. regra do cliente (origem → categoria)
  3. palavras-chave das categorias criadas pelo cliente
  4. palavras-chave das categorias padrão
"""
import json
import re
import unicodedata

OUTROS = "Outros (revisar)"

# Atenção: alguns termos têm espaço no início/fim de propósito
# (ex.: " taxa", " das "), para não pegar pedaços de outras palavras.
REGRAS_EMPRESA = [
    ["Taxas de cartão e apps", [" taxa", " mdr ", "antecipacao", "comissao", " ifood ", " cielo ", " stone ", " getnet ", "pagseguro", " sumup ", " rede ", "mercado pago", "maquininha"]],
    ["Tarifas bancárias", ["tarifa", "pacote servicos", " iof ", "juros", "anuidade"]],
    ["Aluguel", ["aluguel", "imobiliaria", "condominio"]],
    ["Folha de pagamento", ["salario", "folha", " pro labore", "prolabore", "vale transporte", "vale refeicao", "adiantamento", "ferias", "rescisao"]],
    ["Impostos e encargos", [" das ", "simples nacional", " darf", " gps ", " inss", " fgts", " iptu", " icms", " iss "]],
    ["Água, luz e internet", ["energia", "coelba", " enel", "cemig", "copel", "light ", " agua", "embasa", "sabesp", "compesa", "internet", " vivo", " claro", " tim ", " oi ", " gas "]],
    ["Mercado", ["mercado", "supermerc", "atacad", "assai", "makro", "carrefour", "hortifruti", "acougue", "feira", "padaria"]],
    ["Manutenção", ["manutencao", "conserto", "reparo", "assistencia tecnica"]],
]

REGRAS_PF = [
    ["Dívidas e juros", ["juros", "parcela", "emprestimo", "financiamento", "fatura", "cartao de credito", "iof", "multa", "anuidade"]],
    ["Moradia", ["aluguel", "condominio", "iptu", "imobiliaria"]],
    ["Contas da casa", ["energia", "coelba", "enel", "cemig", "copel", " light ", "agua", "embasa", "sabesp", "compesa", " gas ", "internet", " vivo ", " claro ", " tim ", " oi "]],
    ["Mercado", ["mercado", "supermerc", "atacad", "assai", "makro", "carrefour", "hortifruti", "acougue", "feira", "padaria"]],
    ["Transporte", ["uber", "99app", "combustivel", "posto", "gasolina", "estacionamento", "pedagio", "onibus", "metro", "passagem"]],
    ["Saúde", ["farmacia", "drogaria", "hospital", "clinica", "consulta", "plano de saude", "unimed", "dentista", "exame"]],
    ["Educação", ["escola", "faculdade", "curso", "mensalidade", "livro", "udemy", "alura"]],
    ["Lazer", ["cinema", "netflix", "spotify", "restaurante", " bar ", "show", "viagem", "hotel", "ifood"]],
    ["Assinaturas", ["assinatura", "prime video", "youtube", "apple", "google one", "icloud", "disney"]],
    ["Investimentos", ["investimento", "aplicacao", "tesouro", "cdb", "corretora", "poupanca", "fundo"]],
]

REGRAS_PME = REGRAS_EMPRESA[:6] + [
    ["Fornecedores", ["fornecedor", "distribuidora", "atacadista", "insumo", "nota fiscal", "nfe", "compra", "mercado", "atacad", "assai", "makro", "carrefour"]],
    REGRAS_EMPRESA[7],
    ["Marketing", ["anuncio", "google ads", "meta ads", "facebook", "instagram", "impulsionamento", "marketing", "panfleto", "grafica"]],
    ["Contabilidade e sistemas", ["contabil", "contador", "sistema", "software", "nuvem", "certificado digital"]],
]

PERFIS = {
    "pf": {
        "rotulo": "Pessoa física",
        "regras": REGRAS_PF,
        "fixas": ["Moradia", "Contas da casa", "Dívidas e juros"],
    },
    "empresa": {
        "rotulo": "Empresa",
        "regras": REGRAS_EMPRESA,
        "fixas": ["Aluguel", "Folha de pagamento", "Água, luz e internet", "Impostos e encargos", "Tarifas bancárias"],
    },
    "pme": {
        "rotulo": "MEI / PME",
        "regras": REGRAS_PME,
        "fixas": ["Aluguel", "Folha de pagamento", "Água, luz e internet", "Impostos e encargos", "Tarifas bancárias", "Contabilidade e sistemas"],
    },
}


def perfil_valido(perfil):
    if perfil == "cafe":  # nome antigo usado no protótipo
        return "empresa"
    return perfil if perfil in PERFIS else "pf"


_ACENTOS = re.compile(r"[̀-ͯ]")
_NAO_ALFANUM = re.compile(r"[^a-z0-9]+")


def normalizar(texto):
    """Deixa o texto em minúsculas, sem acentos e sem pontuação,
    com um espaço no começo e no fim (para buscar palavras inteiras)."""
    t = unicodedata.normalize("NFD", str(texto))
    t = _ACENTOS.sub("", t).lower()
    t = _NAO_ALFANUM.sub(" ", t).strip()
    return " " + t + " "


def chave_origem(descricao):
    """Identifica "de onde veio" o lançamento, ignorando números
    (datas, códigos de transação etc.). Ex.: 'PIX ENVIADO 123 JOAO' → 'pix enviado joao'."""
    t = normalizar(descricao)
    t = re.sub(r"\b\d+\b", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def separar_palavras(texto):
    """Transforma 'aluguel, condomínio' em ['aluguel', 'condominio']."""
    palavras = []
    for p in str(texto or "").split(","):
        p = normalizar(p).strip()
        if len(p) >= 2:
            palavras.append(p)
    return palavras


def definicoes_padrao(perfil, edicoes):
    """Categorias padrão do perfil, já com os ajustes que o cliente fez.

    `edicoes` é um dicionário {"perfil:posição": {"nome", "tipo", "palavras"}}.
    """
    perfil = perfil_valido(perfil)
    fixas = PERFIS[perfil]["fixas"]
    defs = []
    for i, (nome, palavras) in enumerate(PERFIS[perfil]["regras"]):
        ed = edicoes.get(f"{perfil}:{i}")
        defs.append({
            "id": f"b{i}",
            "posicao": i,
            "padrao": True,
            "editada": bool(ed),
            "nome": (ed and ed.get("nome")) or nome,
            "tipo": (ed and ed.get("tipo")) or ("fixo" if nome in fixas else "variavel"),
            # palavras editadas pelo cliente são comparadas como início de palavra;
            # as originais, exatamente como estão escritas (com os espaços).
            "palavras": ed["palavras"] if (ed and ed.get("palavras") is not None) else [p.strip() for p in palavras],
            "originais": None if (ed and ed.get("palavras") is not None) else palavras,
        })
    return defs


class Categorizador:
    """Decide a categoria automática de cada descrição.

    Monte uma vez (com as categorias e ajustes do cliente) e use
    `categorizar(descricao)` em quantos lançamentos quiser.
    """

    def __init__(self, perfil, categorias_cliente, edicoes):
        self.personalizadas = categorias_cliente  # [{"nome", "palavras": [...]}]
        self.padrao = definicoes_padrao(perfil, edicoes)

    def categorizar(self, descricao):
        t = normalizar(descricao)
        for cat in self.personalizadas:
            for p in cat["palavras"]:
                if " " + p in t:
                    return cat["nome"], p
        for cat in self.padrao:
            if cat["originais"] is not None:
                for p in cat["originais"]:
                    if p in t:
                        return cat["nome"], p.strip()
            else:
                for p in cat["palavras"]:
                    if " " + p in t:
                        return cat["nome"], p
        return OUTROS, None


def carregar_categorizador(banco, usuario_id, perfil):
    """Monta o categorizador com o que o cliente tem salvo no banco."""
    cats = [
        {"nome": r["nome"], "palavras": json.loads(r["palavras"] or "[]")}
        for r in banco.execute(
            "SELECT nome, palavras FROM categorias WHERE usuario_id = ? ORDER BY id", (usuario_id,)
        )
    ]
    return Categorizador(perfil, cats, carregar_edicoes(banco, usuario_id))


def carregar_edicoes(banco, usuario_id):
    edicoes = {}
    for r in banco.execute(
        "SELECT chave, nome, tipo, palavras FROM edicoes_padrao WHERE usuario_id = ?", (usuario_id,)
    ):
        edicoes[r["chave"]] = {
            "nome": r["nome"],
            "tipo": r["tipo"],
            "palavras": json.loads(r["palavras"]) if r["palavras"] is not None else None,
        }
    return edicoes


def preparar_lancamentos(lancamentos, categorizador):
    """Acrescenta a cada lançamento a categoria automática, a palavra que
    decidiu a categoria e a chave de origem. Entradas (valor positivo)
    não recebem categoria."""
    saida = []
    for lanc in lancamentos:
        item = dict(lanc)
        if item["valor"] < 0:
            cat, palavra = categorizador.categorizar(item["descricao"])
        else:
            cat, palavra = None, None
        item["categoria_auto"] = cat
        item["palavra"] = palavra
        item["origem"] = chave_origem(item["descricao"])
        saida.append(item)
    return saida
