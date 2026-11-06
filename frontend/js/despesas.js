/* Contas da página Despesas ("para onde foi o dinheiro"): puras, sem tela
   (testadas em frontend/tests/despesas.test.js). Valores de saída sempre positivos. */
var Despesas = (function(){
'use strict';

var brl = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'});

/* contas fixas × dia a dia; dia a dia = o resto das saídas (inclui "sem categoria") */
function divisao(byCat, fixas, outs){
  if (!(outs > 0)) return { fixas:0, dia:0, pFixas:0, pDia:0 };
  var f = 0;
  fixas.forEach(function(n){ var v = byCat[n]; if (v > 0) f += v; });
  f = Math.min(f, outs);
  var pF = Math.round(f/outs*100);
  return { fixas:f, dia:outs-f, pFixas:pF, pDia:100-pF };
}

/* "onde foi o dinheiro": agrupa por origem, as n maiores e o resto */
function origens(lista, n){
  var por = {}, ordem = [], total = 0;
  lista.forEach(function(x){
    if (!por[x.chave]){ por[x.chave] = {rotulo:x.rotulo, valor:0}; ordem.push(x.chave); }
    por[x.chave].valor += x.valor; total += x.valor;
  });
  var todas = ordem.map(function(k){ return por[k]; }).sort(function(a, b){ return b.valor-a.valor; });
  var top = todas.slice(0, n).map(function(o){ return {rotulo:o.rotulo, valor:o.valor, pct: total>0 ? o.valor/total : 0}; });
  var resto = todas.slice(n);
  return { top:top, total:total,
    resto: resto.length ? { n:resto.length, valor:resto.reduce(function(s, o){ return s+o.valor; }, 0) } : null };
}

/* barras do gráfico: o maior marcado; média só das unidades completas */
function serie(unid){
  var maior = -1;
  unid.forEach(function(u, i){ if (maior<0 || u.valor>unid[maior].valor) maior = i; });
  var base = unid.filter(function(u){ return !u.parcial; });
  if (!base.length) base = unid;
  var media = base.length ? base.reduce(function(s, u){ return s+u.valor; }, 0)/base.length : 0;
  return { barras: unid.map(function(u, i){ var b = {}; for (var k in u) b[k] = u[k]; b.maior = i===maior; return b; }), media:media };
}

/* o que mudou de A (antes) para B (depois): as n maiores subidas e quedas em reais */
function mudancas(A, B, n){
  var nomes = {};
  Object.keys(A).concat(Object.keys(B)).forEach(function(k){ nomes[k] = 1; });
  var vs = Object.keys(nomes).map(function(k){ var a = A[k]||0, b = B[k]||0; return {nome:k, a:a, b:b, d:b-a}; })
    .filter(function(v){ return v.a>=0 && v.b>=0 && Math.abs(v.d)>=0.01; })
    .sort(function(x, y){ return Math.abs(y.d)-Math.abs(x.d) || (x.nome<y.nome ? -1 : 1); });
  vs.forEach(function(v){ v.txt = v.a<=0 ? 'nova' : (v.d>0 ? '+' : '−')+Math.round(Math.abs(v.d)/v.a*100)+'%'; });
  return { subiram: vs.filter(function(v){ return v.d>0; }).slice(0, n), cairam: vs.filter(function(v){ return v.d<0; }).slice(0, n) };
}

/* frases do Resumo, só sobre gastos */
function frases(c){
  var L = [];
  if (c.semCat && c.semCat.n>0) L.push({w:true, t:c.semCat.n+(c.semCat.n===1 ? ' despesa ficou' : ' despesas ficaram')+' sem categoria ('+brl.format(c.semCat.v)+'). Classifique na aba Organizar para o painel ficar mais preciso.'});
  if (c.taxas && c.taxas.v>0 && c.taxas.ins>0){
    var pt = c.taxas.v/c.taxas.ins;
    L.push({w: pt>0.05, t:'Taxas de cartão, antecipação e aplicativos levaram '+brl.format(c.taxas.v)+', o equivalente a '+Math.round(pt*100)+'% do que entrou. Compare as taxas da sua maquininha e evite antecipar recebíveis quando puder.'});
  }
  if (c.cats.length>=4 && c.outs>0){
    var t3 = c.cats.slice().sort(function(a, b){ return b.v-a.v; }).slice(0, 3).reduce(function(s, x){ return s+x.v; }, 0);
    L.push({w:false, t:'As 3 maiores categorias levam '+Math.round(t3/c.outs*100)+'% de tudo o que saiu.'});
  }
  if (c.diasRenda) L.push({w:false, t:'Suas contas fixas equivalem a cerca de '+c.diasRenda+' dias de renda.'});
  return L;
}

return { divisao:divisao, origens:origens, serie:serie, mudancas:mudancas, frases:frases };
})();
if (typeof window!=='undefined') window.Despesas = Despesas;
if (typeof module!=='undefined') module.exports = Despesas;
