/* Conversa com o backend.
   Todas as funções devolvem uma Promise com a resposta do servidor (JSON).
   Se der erro, a Promise é rejeitada com uma mensagem pronta para mostrar. */
var API = (function(){
  'use strict';
  var BASE = '/api';

  function pedir(metodo, caminho, corpo){
    var opcoes = { method: metodo, credentials: 'same-origin', headers: {} };
    if (corpo instanceof FormData){ opcoes.body = corpo; }
    else if (corpo !== undefined){ opcoes.headers['Content-Type'] = 'application/json'; opcoes.body = JSON.stringify(corpo); }
    return fetch(BASE + caminho, opcoes).then(function(resp){
      if (resp.status === 401){ location.href = '/entrar'; throw new Error('Sua sessão terminou. Entre de novo.'); }
      return resp.json().catch(function(){ return {}; }).then(function(dados){
        if (!resp.ok) throw new Error(dados.erro || 'O servidor não conseguiu concluir o pedido (erro ' + resp.status + ').');
        return dados;
      });
    }, function(){
      throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.');
    });
  }
  function q(obj){
    return '?' + Object.keys(obj).map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]); }).join('&');
  }

  return {
    /* tudo o que o painel precisa para abrir */
    estado: function(){ return pedir('GET', '/estado'); },
    salvarPreferencia: function(chave, valor){ return pedir('PUT', '/preferencias/' + chave, {valor: valor}); },
    apagarTudo: function(){ return pedir('DELETE', '/dados'); },

    /* arquivos de extrato: o servidor lê e devolve os lançamentos (não salva) */
    lerArquivos: function(arquivos, perfil){
      var fd = new FormData();
      fd.append('perfil', perfil);
      Array.prototype.forEach.call(arquivos, function(f){ fd.append('arquivos', f, f.name); });
      return pedir('POST', '/leitura', fd);
    },

    /* extratos salvos */
    listarExtratos: function(tipo){ return pedir('GET', '/extratos' + q({tipo: tipo})); },
    salvarExtrato: function(dados){ return pedir('POST', '/extratos', dados); },
    abrirExtrato: function(id){ return pedir('GET', '/extratos/' + id); },
    alterarExtrato: function(id, mudancas){ return pedir('PATCH', '/extratos/' + id, mudancas); },
    excluirExtrato: function(id){ return pedir('DELETE', '/extratos/' + id); },
    salvarCorrecoes: function(id, correcoes){ return pedir('PUT', '/extratos/' + id + '/correcoes', {correcoes: correcoes}); },
    mesclar: function(ids, nome, excluirOriginais){ return pedir('POST', '/extratos/mesclar', {ids: ids, nome: nome, excluir_originais: excluirOriginais}); },

    /* páginas */
    listarPaginas: function(tipo){ return pedir('GET', '/paginas' + q({tipo: tipo})); },
    criarPagina: function(nome, tipo, perfil){ return pedir('POST', '/paginas', {nome: nome, tipo: tipo, perfil: perfil}); },
    renomearPagina: function(id, nome){ return pedir('PATCH', '/paginas/' + id, {nome: nome}); },
    excluirPagina: function(id){ return pedir('DELETE', '/paginas/' + id); },

    /* categorias e regras */
    criarCategoria: function(c){ return pedir('POST', '/categorias', c); },
    editarCategoria: function(id, c){ return pedir('PATCH', '/categorias/' + id, c); },
    excluirCategoria: function(id){ return pedir('DELETE', '/categorias/' + id); },
    editarPadrao: function(perfil, posicao, c){ return pedir('PUT', '/categorias-padrao/' + perfil + '/' + posicao, c); },
    restaurarPadrao: function(perfil, posicao){ return pedir('DELETE', '/categorias-padrao/' + perfil + '/' + posicao); },
    salvarRegra: function(origem, categoria, rotulo){ return pedir('POST', '/regras', {origem: origem, categoria: categoria, rotulo: rotulo}); },
    excluirRegra: function(origem){ return pedir('DELETE', '/regras' + q({origem: origem})); },
    categorizar: function(perfil, descricoes){ return pedir('POST', '/categorizar', {perfil: perfil, descricoes: descricoes}); }
  };
})();
