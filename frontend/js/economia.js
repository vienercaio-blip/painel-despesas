/* Contas da página Economia: puras, sem tela (testadas em frontend/tests/economia.test.js).
   Regra de ouro: nada inventado e nada contado duas vezes. */
var Economia = (function(){
'use strict';

function chaveMes(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function mediana(v){ var s = v.slice().sort(function(a, b){ return a-b; }), m = Math.floor(s.length/2); return s.length%2 ? s[m] : (s[m-1]+s[m])/2; }

/* gastos que se repetem: a mesma origem em minMeses meses ou mais, com o total de
   cada mês perto da mediana (tolerância), fora das categorias essenciais */
function repetidos(lista, op){
  var g = {};
  lista.forEach(function(t){
    var o = g[t.origem] = g[t.origem] || {meses:{}, ult:null};
    var k = chaveMes(t.data); o.meses[k] = (o.meses[k]||0) + t.valor;
    if (!o.ult || t.data>=o.ult.data) o.ult = t;
  });
  var r = [];
  Object.keys(g).forEach(function(origem){
    var o = g[origem], tot = Object.keys(o.meses).map(function(k){ return o.meses[k]; });
    if (tot.length<op.minMeses || op.essenciais.indexOf(o.ult.cat)!==-1) return;
    var med = mediana(tot);
    if (!(med>0) || tot.some(function(v){ return Math.abs(v-med) > med*op.tolerancia + 1e-9; })) return;
    r.push({ id:'rep:'+origem, origem:origem, desc:o.ult.desc, cat:o.ult.cat,
      mensal: tot.reduce(function(s, v){ return s+v; }, 0)/tot.length, meses:tot.length });
  });
  return r.sort(function(a, b){ return b.mensal-a.mensal; });
}

/* categorias do último mês acima da média dos meses anteriores (>20% e >= R$ 50) */
function acimaDoNormal(meses, outros){
  if (meses.length<3) return [];
  var ult = meses[meses.length-1], ant = meses.slice(0, -1), r = [];
  Object.keys(ult.cat).forEach(function(n){
    if (n===outros) return;
    var media = ant.reduce(function(s, m){ return s+(m.cat[n]||0); }, 0)/ant.length, agora = ult.cat[n]||0;
    if (media>0 && agora>media*1.2 && agora-media>=50) r.push({ id:'cat:'+n, cat:n, agora:agora, media:media, dif:agora-media });
  });
  return r.sort(function(a, b){ return b.dif-a.dif; });
}

/* a lista única da página: maior economia primeiro, as sem valor no fim */
function itens(f){
  var L = [];
  (f.dicas||[]).forEach(function(a){
    if (a.id==='normal') return;   /* coberta por "acima do normal" */
    if (a.economia) L.push({ id:'dica:'+a.id, tipo:'categoria', titulo:a.titulo, motivo:a.motivo, etiqueta:'dica', cat:a.cat, economia:a.economia, base:(a.cat && f.gastoCat[a.cat]) || a.economia });
    else L.push({ id:'dica:'+a.id, tipo:'info', titulo:a.titulo, motivo:a.motivo, etiqueta:'dica', cat:a.cat, economia:null, base:null });
  });
  (f.acima||[]).forEach(function(x){
    var v = Math.min(x.dif, f.gastoCat[x.cat]!=null ? f.gastoCat[x.cat] : x.dif);   /* nunca mais que o gasto médio da categoria */
    L.push({ id:x.id, tipo:'categoria', titulo:'Trazer '+x.cat+' de volta ao normal', motivo:'', etiqueta:'acima do normal', cat:x.cat, economia:v, base:v });
  });
  /* categoria que já tem dica com valor: a dica cobre, o gasto repetido não entra de novo */
  var comDica = (f.dicas||[]).filter(function(a){ return a.economia && a.cat && a.id!=='normal'; }).map(function(a){ return a.cat; });
  (f.repetidos||[]).forEach(function(r){
    if (comDica.indexOf(r.cat)!==-1) return;
    L.push({ id:r.id, tipo:'cancelar', titulo:'Cancelar '+r.desc, motivo:'Aparece em '+r.meses+' meses do extrato.', etiqueta:'repete todo mês', cat:r.cat, economia:r.mensal, base:r.mensal, origem:r.origem });
  });
  var com = L.filter(function(x){ return x.economia; }).sort(function(a, b){ return b.economia-a.economia; });
  return com.concat(L.filter(function(x){ return !x.economia; }));
}

function pctInicial(item){ return Math.min(1, Math.max(0.1, Math.round(item.economia/item.base*10)/10)); }

/* soma dos itens marcados; o total de uma categoria nunca passa do gasto mensal dela */
function simular(lista, marcados, gastoCat){
  var porItem = {}, cortados = [], usado = {}, total = 0;
  lista.forEach(function(it){
    var m = marcados[it.id];
    if (!m || it.tipo==='info') return;
    var v = it.tipo==='cancelar' ? it.base : (typeof m==='number' ? m : pctInicial(it))*it.base;
    var lim = gastoCat[it.cat];
    if (lim!=null){
      var livre = Math.max(0, lim-(usado[it.cat]||0));
      if (v>livre+1e-9){ v = livre; cortados.push(it.id); }
      usado[it.cat] = (usado[it.cat]||0) + v;
    }
    porItem[it.id] = v; total += v;
  });
  return { total:total, porItem:porItem, cortados:cortados };
}

/* objetivo com prazo: quanto falta, quanto por mês e em quantos meses chega */
function objetivo(o, ritmo, fixo, hoje){
  var p = String(o.prazo).split('-'), mesesAte = (+p[0]-hoje.getFullYear())*12 + (+p[1]-1-hoje.getMonth()) + 1;
  var falta = Math.max(0, o.valor-(o.tenho||0));
  var meses = ritmo>0 ? Math.ceil(falta/ritmo) : null, mesesFixo = fixo>0 ? Math.ceil(falta/fixo) : null;
  var estado = falta<=0 ? 'alcancado' : mesesAte<1 ? 'prazo-passou' : !(ritmo>0) ? 'sem-ritmo' : meses>mesesAte ? 'nao-chega' : 'ok';
  return { falta:falta, porMes: mesesAte>=1 ? Math.ceil(falta/mesesAte) : falta, meses:meses, mesesFixo:mesesFixo, mesesAte:mesesAte, estado:estado };
}

return { repetidos:repetidos, acimaDoNormal:acimaDoNormal, itens:itens, pctInicial:pctInicial, simular:simular, objetivo:objetivo };
})();
if (typeof window!=='undefined') window.Economia = Economia;
if (typeof module!=='undefined') module.exports = Economia;
