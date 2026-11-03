"""Regras de categorização dos lançamentos.

Aqui ficam as categorias padrão (uma lista só, para pessoas e empresas)
e a lógica que decide em qual categoria cada despesa cai.

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
# O código nunca muda: as edições do cliente são guardadas por ele ("padrao:mercado").
# Atenção: alguns termos têm espaço no início/fim de propósito
# (ex.: " taxa", " iof "), para não pegar pedaços de outras palavras.
REGRAS = [
    ("dividas", "Dívidas e juros", ["juros", "emprestimo", "financiamento", "fatura", "cartao de credito", "multa", "rotativo", "cheque especial", "consignado"]),
    ("tarifas", "Tarifas bancárias", ["tarifa", "pacote servicos", "pacote de servicos", "cesta de servicos", "cesta servicos", " iof ", "anuidade", "manutencao de conta"]),
    # só taxas de cartão e maquininha: "taxa" sozinha (condomínio, matrícula) e o nome
    # da maquininha numa compra comum ("STONE PADARIA") são gastos de outras categorias
    ("taxas", "Taxas de cartão e apps", ["taxa cartao", "taxa de cartao", "taxa maquin", "maquininha", " mdr ", "antecipacao", "comissao",
                                         "aluguel pos", "aluguel de maquin", "mpago taxa", "stone taxa", "taxa stone", "cielo taxa", "taxa cielo",
                                         "getnet taxa", "taxa getnet", "pagseguro taxa", "taxa pagseguro", "sumup taxa", "taxa sumup", " rede taxa", "taxa rede "]),
    ("impostos", "Impostos e encargos", ["das mei", "pgmei", "simples nacional", " darf", " gps ", " inss", " fgts", " icms", " iss ", "imposto"]),
    ("folha", "Folha de pagamento", ["salario", "folha pag", "folha de pag", "folha salario", " pro labore", "prolabore", "vale transporte", "vale refeicao", "adiantamento", "rescisao"]),
    ("moradia", "Moradia e aluguel", ["aluguel", "condominio", "iptu", "imobiliaria"]),
    ("casa", "Água, luz e internet", ["energia", "coelba", "enel", "cemig", "copel", " light ", "agua", "embasa", "sabesp", "compesa", " gas ", "internet", " vivo ", " claro ", " tim ", " oi "]),
    ("seguros", "Seguros", [" seguro auto", " seguro de vida", " seguro vida", " seguro resid", " seguro empresarial", " seguro celular", " seguro viagem", "seguradora", "apolice", "porto seguro", "mapfre", "allianz", "tokio marine", "sulamerica"]),
    ("delivery", "Delivery", ["ifood", " ifd ", "rappi", "ze delivery", "99food", " 99 food", "keeta", "aiqfome", "james delivery", "daki", "uber eats", "delivery"]),
    ("assinaturas", "Assinaturas", ["assinatura", "netflix", "spotify", "deezer", "prime video", "amazon prime", "amazonprime", "youtube", "apple", "google one", "icloud", "disney", " max ", "globoplay"]),
    ("contabilidade", "Contabilidade e sistemas", ["contabil", "contador", "sistema", "software", "nuvem", "certificado digital"]),
    ("compras", "Compras online", ["shopee", "mercado livre", "mercadolivre", " amazon ", "magalu", "magazine luiza", "shein", "aliexpress", "temu"]),
    ("mercado", "Mercado", ["mercado", "supermerc", "atacad", "assai", "makro", "carrefour", "hortifruti", "acougue", "feira", "padaria"]),
    ("fornecedores", "Fornecedores", ["fornecedor", "distribuidora", "atacadista", "insumo", "nota fiscal", " nfe ", "laticinio", "torrefacao", "embalage", "material de limpeza", "material limpeza"]),
    ("transporte", "Transporte e combustível", ["uber", "99app", " 99 pop", "combustivel", " posto ", "gasolina", "diesel", "etanol", "estacionamento", "pedagio", "onibus", "metro", "passagem", "ipva", "licenciamento", "detran", "bilhete unico", "motoboy", "frete", "correios", "loggi", "lalamove"]),
    ("manutencao", "Manutenção", ["manutencao", "conserto", "reparo", "assistencia tecnica"]),
    ("marketing", "Marketing", ["anuncio", "google ads", "meta ads", "facebook", "instagram", "impulsionamento", "marketing", "panfleto", "grafica"]),
    ("pets", "Pets", ["pet shop", "petshop", "petz", "cobasi", "veterin", "racao"]),
    ("saude", "Saúde", ["farmacia", "drogaria", "drogasil", " raia ", "droga raia", "pague menos", "hospital", "clinica", "consulta", "plano de saude", "unimed", "dentista", "odonto", "exame", "laboratorio"]),
    ("academia", "Academia e bem-estar", ["academia", "smart fit", "smartfit", "pilates", "salao", "barbearia"]),
    ("educacao", "Educação", ["escola", "faculdade", "curso", "mensalidade", "livro", "udemy", "alura"]),
    ("lazer", "Lazer", ["cinema", "restaurante", " bar ", "show", "viagem", "hotel", "ingresso", "lanchonete"]),
    ("presentes", "Presentes", ["presente", "floricultura"]),
    ("investimentos", "Investimentos e reservas", ["investimento", "aplicacao", "tesouro", "cdb", "corretora", "poupanca", "fundo", "cofrinho", "caixinha", "reserva por", "reserva de emergencia", "reserva emergencia", " rdb "]),
    ("entre_contas", "Transferências entre suas contas", []),  # sem palavras: só o que o cliente marcar
    ("transferencias", "Transferências para pessoas", ["pix enviado", "pix transf", "transferencia", " transf ", " ted ", " doc "]),
]

# Categorias de movimento interno: dinheiro guardado (aplicação, resgate, cofrinho)
# e transferências entre as contas do próprio cliente. Não contam como entrada
# nem como saída no painel.
INTERNAS = {"investimentos", "entre_contas"}

FIXAS = {"dividas", "tarifas", "impostos", "folha", "moradia", "casa", "contabilidade", "seguros", "assinaturas", "educacao"}

# Versões antigas guardavam as edições pela posição na lista ("pf:3").
# Este mapa converte posição → código (None = a categoria deixou de existir).
# O antigo perfil "pme" (MEI / PME) virou "empresa".
CODIGOS_ANTIGOS = {
    "pf": ["dividas", "moradia", "casa", "mercado", "transporte", "saude", "educacao", "lazer", "assinaturas", "investimentos"],
    "empresa": ["taxas", "tarifas", "aluguel", "folha", "impostos", "contas", None, "manutencao"],
    "pme": ["taxas", "tarifas", "aluguel", "folha", "impostos", "contas", "fornecedores", "manutencao", "marketing", "contabilidade"],
}


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


def definicoes_padrao(edicoes):
    """Categorias padrão, já com os ajustes que o cliente fez.

    `edicoes` é um dicionário {"padrao:código": {"nome", "tipo", "palavras"}}.
    """
    defs = []
    for codigo, nome, palavras in REGRAS:
        ed = edicoes.get(f"padrao:{codigo}")
        defs.append({
            "id": f"b:{codigo}",
            "codigo": codigo,
            "padrao": True,
            "editada": bool(ed),
            "nome": (ed and ed.get("nome")) or nome,
            "tipo": (ed and ed.get("tipo")) or ("fixo" if codigo in FIXAS else "variavel"),
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

    def __init__(self, categorias_cliente, edicoes):
        self.personalizadas = categorias_cliente  # [{"nome", "palavras": [...]}]
        self.padrao = definicoes_padrao(edicoes)

    def nome_por_codigo(self, codigo):
        """Nome atual (editado pelo cliente ou original) da categoria padrão."""
        return next(c["nome"] for c in self.padrao if c["codigo"] == codigo)

    def categorizar(self, descricao):
        # "Mercado Pago" é a carteira, não um mercado: vira "mpago" (sem "mercado" dentro)
        t = normalizar(descricao).replace(" mercado pago ", " mpago ")
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


def carregar_categorizador(banco, usuario_id):
    """Monta o categorizador com o que o cliente tem salvo no banco."""
    cats = [
        {"nome": r["nome"], "palavras": json.loads(r["palavras"] or "[]")}
        for r in banco.execute(
            "SELECT nome, palavras FROM categorias WHERE usuario_id = ? ORDER BY id", (usuario_id,)
        )
    ]
    return Categorizador(cats, carregar_edicoes(banco, usuario_id))


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


# Entrada com uma destas palavras é dinheiro de volta de uma despesa (estorno,
# devolução, reembolso): em vez de contar como renda, desconta da categoria.
PALAVRAS_ESTORNO = ["estorno", "estornad", "devolucao", "devolvid", "reembolso", "chargeback"]


def eh_estorno(descricao, valor):
    t = normalizar(descricao)
    return valor > 0 and any(" " + p in t for p in PALAVRAS_ESTORNO)


# Entrada com uma destas palavras é dinheiro guardado voltando (resgate de
# aplicação, retirada do cofrinho): vai para "Investimentos e reservas".
# Rendimento (juros) não está aqui: é dinheiro novo e conta como entrada.
PALAVRAS_RESGATE = ["resgate", "resg ", "dinheiro retirado"]
# ...mas resgate de pontos, milhas, seguro ou cashback é dinheiro novo
NAO_E_RESGATE = ["pontos", "milhas", "seguro", "cashback"]


def eh_resgate(descricao, valor):
    t = normalizar(descricao)
    return (valor > 0 and any(" " + p in t for p in PALAVRAS_RESGATE)
            and not any(" " + p in t for p in NAO_E_RESGATE))


def preparar_lancamentos(lancamentos, categorizador):
    """Acrescenta a cada lançamento a categoria automática, a palavra que
    decidiu a categoria e a chave de origem. Entradas (valor positivo) não
    recebem categoria, exceto os estornos, que vão para a categoria da
    despesa (ou "Outros (revisar)", para o cliente classificar), e os
    resgates, que vão para "Investimentos e reservas"."""
    saida = []
    for lanc in lancamentos:
        item = dict(lanc)
        item["estorno"] = eh_estorno(item["descricao"], item["valor"])
        if item["valor"] < 0 or item["estorno"]:
            cat, palavra = categorizador.categorizar(item["descricao"])
        elif eh_resgate(item["descricao"], item["valor"]):
            t = normalizar(item["descricao"])
            cat = categorizador.nome_por_codigo("investimentos")
            palavra = next(p for p in PALAVRAS_RESGATE if " " + p in t).strip()
        else:
            cat, palavra = None, None
        item["categoria_auto"] = cat
        item["palavra"] = palavra
        item["origem"] = chave_origem(item["descricao"])
        saida.append(item)
    return saida
