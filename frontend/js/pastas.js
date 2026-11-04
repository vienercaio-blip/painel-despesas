/* Regras das pastas de extratos: a sugestão "Pessoal e Empresa", o aviso
   de lançamentos repetidos da pasta inteira e as etiquetas do Início
   (quais aparecem, que extratos cada uma mostra e para onde vai o envio).
   "atual" vale null (Todos), 'none' (Sem pasta) ou o id de uma pasta.
   Não mexe na tela.
   Testes: node --test frontend/tests */
var Pastas = (function(){
'use strict';

var SUGERIDAS = ['Pessoal', 'Empresa'];

function chave(nome){
  return String(nome||'').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/* pastas sugeridas que a pessoa ainda não tem ([] se ela dispensou a sugestão) */
function sugerir(nomes, dispensada){
  if (dispensada) return [];
  var tem = nomes.map(chave);
  return SUGERIDAS.filter(function(n){ return tem.indexOf(chave(n))===-1; });
}

function avisoRepetidos(n){
  if (!n) return null;
  return 'Encontramos '+n+(n===1 ? ' lançamento repetido' : ' lançamentos repetidos')+
    ' entre os extratos desta pasta e contamos cada um uma vez só.';
}

/* avisos da conferência da leitura (ex.: PDF lido pelo formato geral).
   avisos = [{nome, aviso}]; todos aparecem, com o nome do extrato quando são vários */
function textoAvisos(avisos){
  if (!avisos.length) return null;
  if (avisos.length===1) return 'Atenção: '+avisos[0].aviso;
  return avisos.map(function(a, i){ return (i ? 'No extrato' : 'Atenção, no extrato')+' "'+a.nome+'": '+a.aviso; }).join(' ');
}

function existe(id, pastas){ return pastas.some(function(p){ return p.id===id; }); }
/* extrato sem pasta: page vazio ou de uma pasta que não existe mais */
function semPasta(x, pastas){ return !x.page || !existe(x.page, pastas); }

/* a etiqueta escolhida, ou null (Todos) se ela não aparece mais */
function atualValida(atual, pastas, extratos){
  if (atual==='none') return pastas.length && extratos.some(function(x){ return semPasta(x, pastas); }) ? 'none' : null;
  return atual && existe(atual, pastas) ? atual : null;
}

function etiquetas(pastas, extratos, atual){
  var cur = atualValida(atual, pastas, extratos);
  var lista = [{id:'all', nome:'Todos', n:extratos.length, marcada:cur===null}];
  pastas.forEach(function(p){
    lista.push({id:p.id, nome:p.name, n:extratos.filter(function(x){ return x.page===p.id; }).length, marcada:cur===p.id});
  });
  var soltos = extratos.filter(function(x){ return semPasta(x, pastas); }).length;
  if (pastas.length && soltos) lista.push({id:'none', nome:'Sem pasta', n:soltos, marcada:cur==='none'});
  return lista;
}

/* extratos da etiqueta, do enviado mais recente para o mais antigo */
function filtrar(extratos, pastas, atual){
  var cur = atualValida(atual, pastas, extratos);
  return extratos.filter(function(x){
    return cur===null ? true : cur==='none' ? semPasta(x, pastas) : x.page===cur;
  }).sort(function(a, b){ return a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0; });
}

/* pasta que recebe o próximo envio (null = sem pasta) */
function destino(atual, pastas){ return atual && atual!=='none' && existe(atual, pastas) ? atual : null; }

return { atualValida:atualValida, etiquetas:etiquetas, filtrar:filtrar, destino:destino, sugerir:sugerir, avisoRepetidos:avisoRepetidos, textoAvisos:textoAvisos };
})();
if (typeof window!=='undefined') window.Pastas = Pastas;
if (typeof module!=='undefined') module.exports = Pastas;
