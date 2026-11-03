/* Regras das pastas de extratos: a sugestão "Pessoal e Empresa" e o aviso
   de lançamentos repetidos da pasta inteira. Não mexe na tela.
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

return { sugerir:sugerir, avisoRepetidos:avisoRepetidos, textoAvisos:textoAvisos };
})();
if (typeof window!=='undefined') window.Pastas = Pastas;
if (typeof module!=='undefined') module.exports = Pastas;
