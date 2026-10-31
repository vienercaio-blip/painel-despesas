"""Regras de categorização dos lançamentos.

Aqui ficam as categorias padrão de cada perfil (pessoa física e
empresa ou MEI) e a lógica que decide em qual categoria cada despesa cai.

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

# Cada categoria padrão: (código, nome, palavras-chave), na ordem de prioridade:
# a primeira categoria com uma palavra encontrada na descrição é a que vale.
# O código nunca muda: as edições do cliente são guardadas por ele ("pf:mercado").
# Atenção: alguns termos têm espaço no início/fim de propósito
# (ex.: " taxa", " das "), para não pegar pedaços de outras palavras.
TRANSFERENCIAS = ("transferencias", "Transferências para pessoas", ["pix enviado", "pix transf", "transferencia", " transf ", " ted ", " doc "])

REGRAS_PF = [
    ("dividas", "Dívidas e juros", ["juros", "parcela", "emprestimo", "financiamento", "fatura", "cartao de credito", "multa", "rotativo", "cheque especial", "consignado"]),
    ("tarifas", "Tarifas bancárias", ["tarifa", "pacote servicos", "pacote de servicos", "cesta de servicos", "cesta servicos", " iof ", "anuidade", "manutencao de conta"]),
    ("moradia", "Moradia", ["aluguel", "condominio", "iptu", "imobiliaria"]),
    ("casa", "Contas da casa", ["energia", "coelba", "enel", "cemig", "copel", " light ", "agua", "embasa", "sabesp", "compesa", " gas ", "internet", " vivo ", " claro ", " tim ", " oi "]),
    ("delivery", "Delivery", ["ifood", " ifd ", "rappi", "ze delivery", "99food", " 99 food", "keeta", "aiqfome", "james delivery", "daki", "uber eats", "delivery"]),
    ("assinaturas", "Assinaturas", ["assinatura", "netflix", "spotify", "deezer", "prime video", "amazon prime", "amazonprime", "youtube", "apple", "google one", "icloud", "disney", " max ", "globoplay"]),
    ("compras", "Compras online", ["shopee", "mercado livre", "mercadolivre", " amazon ", "magalu", "magazine luiza", "shein", "aliexpress", "temu"]),
    ("mercado", "Mercado", ["mercado", "supermerc", "atacad", "assai", "makro", "carrefour", "hortifruti", "acougue", "feira", "padaria"]),
    ("transporte", "Transporte", ["uber", "99app", " 99 pop", "combustivel", " posto ", "gasolina", "etanol", "estacionamento", "pedagio", "onibus", "metro", "passagem", "ipva", "licenciamento", "detran", "bilhete unico"]),
    ("pets", "Pets", ["pet shop", "petshop", "petz", "cobasi", "veterin", "racao"]),
    ("saude", "Saúde", ["farmacia", "drogaria", "drogasil", " raia ", "droga raia", "pague menos", "hospital", "clinica", "consulta", "plano de saude", "unimed", "dentista", "odonto", "exame", "laboratorio"]),
    ("academia", "Academia e bem-estar", ["academia", "smart fit", "smartfit", "pilates", "salao", "barbearia"]),
    ("educacao", "Educação", ["escola", "faculdade", "curso", "mensalidade", "livro", "udemy", "alura"]),
    ("lazer", "Lazer", ["cinema", "restaurante", " bar ", "show", "viagem", "hotel", "ingresso", "lanchonete"]),
    ("presentes", "Presentes", ["presente", "floricultura"]),
    ("investimentos", "Investimentos", ["investimento", "aplicacao", "tesouro", "cdb", "corretora", "poupanca", "fundo"]),
    TRANSFERENCIAS,
]

REGRAS_EMPRESA = [
    ("taxas", "Taxas de cartão e apps", [" taxa", " mdr ", "antecipacao", "comissao", " ifood ", " cielo ", " stone ", " getnet ", "pagseguro", " sumup ", " rede ", "mercado pago", "maquininha", "rappi"]),
    ("tarifas", "Tarifas bancárias", ["tarifa", "pacote servicos", "pacote de servicos", "cesta de servicos", " iof ", "juros", "anuidade", "manutencao de conta"]),
    ("impostos", "Impostos e encargos", [" das ", "das mei", "pgmei", "simples nacional", " darf", " gps ", " inss", " fgts", " iptu", " icms", " iss ", "imposto"]),
    ("folha", "Folha de pagamento", ["salario", "folha", " pro labore", "prolabore", "vale transporte", "vale refeicao", "adiantamento", "ferias", "rescisao"]),
    ("aluguel", "Aluguel", ["aluguel", "imobiliaria", "condominio"]),
    ("contas", "Água, luz e internet", ["energia", "coelba", " enel", "cemig", "copel", "light ", " agua", "embasa", "sabesp", "compesa", "internet", " vivo", " claro", " tim ", " oi ", " gas "]),
    ("contabilidade", "Contabilidade e sistemas", ["contabil", "contador", "sistema", "software", "nuvem", "certificado digital"]),
    ("seguros", "Seguros", ["seguro", "porto seguro", "mapfre", "allianz", "tokio marine", "sulamerica"]),
    ("fornecedores", "Fornecedores", ["fornecedor", "distribuidora", "atacadista", "insumo", "nota fiscal", "nfe", "compra", "mercado", "supermerc", "atacad", "assai", "makro", "carrefour", "hortifruti", "acougue", "padaria", "laticinio", "torrefacao", "embalage", "material de limpeza"]),
    ("combustivel", "Combustível e entregas", [" posto ", "gasolina", "diesel", "etanol", "combustivel", "motoboy", "frete", "correios", "loggi", "lalamove"]),
    ("manutencao", "Manutenção", ["manutencao", "conserto", "reparo", "assistencia tecnica"]),
    ("marketing", "Marketing", ["anuncio", "google ads", "meta ads", "facebook", "instagram", "impulsionamento", "marketing", "panfleto", "grafica"]),
    TRANSFERENCIAS,
]

PERFIS = {
    "pf": {
        "rotulo": "Pessoa física",
        "regras": REGRAS_PF,
        "fixas": {"dividas", "tarifas", "moradia", "casa", "assinaturas", "educacao"},
    },
    "empresa": {
        "rotulo": "Empresa ou MEI",
        "regras": REGRAS_EMPRESA,
        "fixas": {"tarifas", "impostos", "folha", "aluguel", "contas", "contabilidade", "seguros"},
    },
}

# Versões antigas guardavam as edições pela posição na lista ("pf:3").
# Este mapa converte posição → código (None = a categoria deixou de existir).
# O antigo perfil "pme" (MEI / PME) virou "empresa".
CODIGOS_ANTIGOS = {
    "pf": ["dividas", "moradia", "casa", "mercado", "transporte", "saude", "educacao", "lazer", "assinaturas", "investimentos"],
    "empresa": ["taxas", "tarifas", "aluguel", "folha", "impostos", "contas", None, "manutencao"],
    "pme": ["taxas", "tarifas", "aluguel", "folha", "impostos", "contas", "fornecedores", "manutencao", "marketing", "contabilidade"],
}


def perfil_valido(perfil):
    if perfil in ("pme", "cafe"):  # nomes antigos: MEI / PME e o protótipo
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

    `edicoes` é um dicionário {"perfil:código": {"nome", "tipo", "palavras"}}.
    """
    perfil = perfil_valido(perfil)
    fixas = PERFIS[perfil]["fixas"]
    defs = []
    for codigo, nome, palavras in PERFIS[perfil]["regras"]:
        ed = edicoes.get(f"{perfil}:{codigo}")
        defs.append({
            "id": f"b:{codigo}",
            "codigo": codigo,
            "padrao": True,
            "editada": bool(ed),
            "nome": (ed and ed.get("nome")) or nome,
            "tipo": (ed and ed.get("tipo")) or ("fixo" if codigo in fixas else "variavel"),
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
