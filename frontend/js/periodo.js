/* Contas do período (Dashboard, Despesas e Lançamentos): puras, sem tela
   (testadas em frontend/tests/periodo.test.js).
   Formatos: {tipo:'tudo'} · {tipo:'mes', y, m(0-11)} · {tipo:'semana', w:'AAAA-MM-DD' (segunda), y, m}
   · {tipo:'intervalo', de:'AAAA-MM-DD', ate:'AAAA-MM-DD', dias:bool}. Chaves de mês: 'AAAA-MM'. */
var Periodo = (function(){
'use strict';

var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
var brl0 = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL', maximumFractionDigits:0});
function p2(n){ return String(n).padStart(2, '0'); }
function iso(d){ return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()); }
function dataDe(s){ var a = s.split('-'); return new Date(+a[0], +a[1]-1, +a[2], 12); }
function somaDias(s, n){ var d = dataDe(s); d.setDate(d.getDate()+n); return iso(d); }
function diasEntre(de, ate){ var a = s2utc(de), b = s2utc(ate); return Math.round((b-a)/864e5)+1; }
function s2utc(s){ var a = s.split('-'); return Date.UTC(+a[0], +a[1]-1, +a[2]); }
function ultimoDia(y, m){ return new Date(y, m+1, 0).getDate(); }   /* m 0-11 */
function chave(y, m){ return y+'-'+p2(m+1); }
function deChave(k){ var a = k.split('-'); return {y:+a[0], m:+a[1]-1}; }
function somaMeses(k, n){ var c = deChave(k), t = c.y*12+c.m+n; return chave(Math.floor(t/12), t%12); }
function mesesEntre(deK, ateK){ var a = deChave(deK), b = deChave(ateK); return (b.y*12+b.m)-(a.y*12+a.m)+1; }
function semanaDe(d){ var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate()-((x.getDay()+6)%7)); return iso(x); }
function ddmm(s){ var a = s.split('-'); return a[2]+'/'+a[1]; }
function ddmmaaaa(s){ var a = s.split('-'); return a[2]+'/'+a[1]+'/'+a[0]; }
function abrev(y, m, comAno){ return MESES[m].slice(0,3)+(comAno ? '/'+String(y).slice(2) : ''); }

function deMeses(deK, ateK){
  var a = deChave(deK), b = deChave(ateK);
  if (deK===ateK) return {tipo:'mes', y:a.y, m:a.m};
  return {tipo:'intervalo', de:chave(a.y, a.m)+'-01', ate:chave(b.y, b.m)+'-'+p2(ultimoDia(b.y, b.m)), dias:false};
}
function deDias(de, ate){ return {tipo:'intervalo', de:de, ate:ate, dias:true}; }

function contem(data, p){
  if (!p || p.tipo==='tudo') return true;
  if (p.tipo==='mes') return data.getFullYear()===p.y && data.getMonth()===p.m;
  if (p.tipo==='semana') return semanaDe(data)===p.w;
  var s = iso(data);
  return s>=p.de && s<=p.ate;
}

function anterior(p){
  if (!p || p.tipo==='tudo') return null;
  if (p.tipo==='mes'){ var t = p.y*12+p.m-1; return {tipo:'mes', y:Math.floor(t/12), m:t%12}; }
  if (p.tipo==='semana'){ var w = somaDias(p.w, -7), d = dataDe(w); return {tipo:'semana', w:w, y:d.getFullYear(), m:d.getMonth()}; }
  if (!p.dias){
    var dk = p.de.slice(0,7), n = mesesEntre(dk, p.ate.slice(0,7));
    var r = deMeses(somaMeses(dk, -n), somaMeses(dk, -1));
    if (r.tipo==='intervalo') r.dias = false;
    return r;
  }
  var nd = diasEntre(p.de, p.ate);
  return deDias(somaDias(p.de, -nd), somaDias(p.de, -1));
}
function nomeAnterior(p){ return p.tipo==='mes' ? 'mês anterior' : p.tipo==='semana' ? 'semana anterior' : 'período anterior'; }

function nome(p){
  if (!p || p.tipo==='tudo') return 'todo o período';
  if (p.tipo==='mes') return MESES[p.m]+' de '+p.y;
  if (p.tipo==='semana') return 'semana de '+ddmm(p.w)+' a '+ddmm(somaDias(p.w, 6));
  if (p.dias) return ddmmaaaa(p.de)+' a '+ddmmaaaa(p.ate);
  var a = deChave(p.de.slice(0,7)), b = deChave(p.ate.slice(0,7));
  if (a.y===b.y && a.m===0 && b.m===11) return 'ano de '+a.y;
  if (a.y===b.y) return MESES[a.m]+' a '+MESES[b.m]+' de '+b.y;
  return MESES[a.m]+' de '+a.y+' a '+MESES[b.m]+' de '+b.y;
}
function curto(p){
  if (!p || p.tipo==='tudo') return 'tudo';
  if (p.tipo==='mes') return abrev(p.y, p.m, true);
  if (p.tipo==='semana'){ var f = somaDias(p.w, 6); return ddmm(p.w)+'–'+ddmm(f)+'/'+f.slice(2,4); }
  if (p.dias){
    return p.de.slice(0,4)===p.ate.slice(0,4) ? ddmm(p.de)+'–'+ddmm(p.ate)+'/'+p.ate.slice(2,4)
      : ddmm(p.de)+'/'+p.de.slice(2,4)+'–'+ddmm(p.ate)+'/'+p.ate.slice(2,4);
  }
  var a = deChave(p.de.slice(0,7)), b = deChave(p.ate.slice(0,7));
  return a.y===b.y ? abrev(a.y, a.m)+'–'+abrev(b.y, b.m, true) : abrev(a.y, a.m, true)+'–'+abrev(b.y, b.m, true);
}

/* atalhos contam a partir do último mês do extrato (U), nunca da data de hoje */
function atalhos(meses){
  if (!meses.length) return [];
  var U = meses[meses.length-1], u = deChave(U), L = [];
  function add(id, rotulo, p){ p.rotulo = rotulo; L.push({id:id, rotulo:rotulo, p:p}); }
  add('tudo', 'Todo o extrato', {tipo:'tudo'});
  add('ult1', 'Último mês', {tipo:'mes', y:u.y, m:u.m});
  if (meses.length>=3) add('ult3', 'Últimos 3 meses', deMeses(somaMeses(U, -2), U));
  if (meses.length>=6) add('ult6', 'Últimos 6 meses', deMeses(somaMeses(U, -5), U));
  var anos = []; meses.forEach(function(k){ var y = +k.slice(0,4); if (anos.indexOf(y)===-1) anos.push(y); });
  if (meses[0] < chave(u.y, 0)) add('ano', 'Este ano', deMeses(chave(u.y, 0), U));
  if (anos.length>1) anos.forEach(function(y){
    var doAno = meses.filter(function(k){ return +k.slice(0,4)===y; });
    add('a'+y, String(y), deMeses(doAno[0], doAno[doAno.length-1]));
  });
  return L;
}
function atalhosComparar(meses){
  var r = [];
  if (meses.length<2) return r;
  var U = meses[meses.length-1], u = deChave(U), tem = function(k){ return meses.indexOf(k)!==-1; };
  function todos(deK, ateK){ for (var k = deK; k<=ateK; k = somaMeses(k, 1)){ if (!tem(k)) return false; } return true; }
  var ant = deChave(somaMeses(U, -1));
  if (tem(somaMeses(U, -1))) r.push({id:'mes', rotulo:'Este mês × mês passado', a:{tipo:'mes', y:u.y, m:u.m}, b:{tipo:'mes', y:ant.y, m:ant.m}});
  if (todos(somaMeses(U, -5), U)) r.push({id:'tri', rotulo:'Últimos 3 meses × 3 anteriores', a:deMeses(somaMeses(U, -2), U), b:deMeses(somaMeses(U, -5), somaMeses(U, -3))});
  var jan = chave(u.y, 0), janA = chave(u.y-1, 0), UA = chave(u.y-1, u.m);
  if (todos(janA, UA)) r.push({id:'ano', rotulo:'Este ano × ano passado', a: jan===U ? {tipo:'mes', y:u.y, m:0} : deMeses(jan, U), b: janA===UA ? {tipo:'mes', y:u.y-1, m:0} : deMeses(janA, UA)});
  return r;
}

function lerData(txt){
  var t = String(txt==null ? '' : txt).trim(), m, y, mo, d;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))){ y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t))){ d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  if (y<1900 || y>2100 || mo<1 || mo>12 || d<1 || d>ultimoDia(y, mo-1)) return null;
  return y+'-'+p2(mo)+'-'+p2(d);
}
function validar(p, n){
  if (p.tipo==='intervalo' && p.de>p.ate) return 'Escolha a data final depois da inicial.';
  if (!n) return p.tipo==='intervalo' ? 'Não há lançamentos entre '+ddmm(p.de)+' e '+ddmm(p.ate)+'.' : 'Não há lançamentos neste período.';
  return null;
}
function fatorMes(p, mesesComDados){
  if (p && p.tipo==='intervalo' && p.dias){
    var d = diasEntre(p.de, p.ate);
    /* menos de 30 dias: nunca multiplica; mostra o total "em N dias" */
    return d<30 ? {divisor:1, nota:null, dias:d} : {divisor:d/30, nota:'média de 30 dias', dias:d};
  }
  if (p && p.tipo==='semana') return {divisor:1, nota:null, dias:null};
  return {divisor:Math.max(1, mesesComDados||0), nota:null, dias:null};
}

/* começo e fim (ISO) de um período; tudo → null */
function limites(p){
  if (!p || p.tipo==='tudo') return null;
  if (p.tipo==='mes') return {de:chave(p.y, p.m)+'-01', ate:chave(p.y, p.m)+'-'+p2(ultimoDia(p.y, p.m))};
  if (p.tipo==='semana') return {de:p.w, ate:somaDias(p.w, 6)};
  return {de:p.de, ate:p.ate};
}
/* quanto do período o extrato (inicio..fim, ISO) cobre de fato */
function cobertura(p, inicio, fim){
  var l = limites(p) || {de:inicio, ate:fim};
  var de = l.de>inicio ? l.de : inicio, ate = l.ate<fim ? l.ate : fim;
  if (de>ate) return {de:de, ate:ate, dias:0, parcial:true};
  return {de:de, ate:ate, dias:diasEntre(de, ate), parcial: de!==l.de || ate!==l.ate};
}
function sobrepoe(a, b){ var x = limites(a), y = limites(b); return !x || !y || (x.de<=y.ate && y.de<=x.ate); }

/* comparação de dois períodos, sempre por mês */
function comparar(A, B){
  var a = {ins:A.ins/A.divisor, outs:A.outs/A.divisor}, b = {ins:B.ins/B.divisor, outs:B.outs/B.divisor};
  a.res = a.ins-a.outs; b.res = b.ins-b.outs;
  var negativos = a.res<0 && b.res<0, d = a.res-b.res, ver;
  var v = function(x){ return brl0.format(Math.abs(x)); };
  if (d>=1) ver = {cor:'verde', texto:'Melhorou: '+(negativos ? 'faltou '+v(d)+' a menos' : 'sobrou '+v(d)+' a mais')+' por mês que em '+B.nome+'.'};
  else if (d<=-1) ver = {cor:'vermelho', texto:'Piorou: '+(negativos ? 'faltou '+v(d)+' a mais' : 'sobrou '+v(d)+' a menos')+' por mês que em '+B.nome+'.'};
  else ver = {cor:'neutro', texto:'Igual: sobrou quase o mesmo por mês nos dois períodos.'};
  function linha(rot, x, y, maiorBom){ var dif = x-y; return {rotulo:rot, a:x, b:y, dif:dif, bom: Math.abs(dif)<0.5 ? null : (dif>0)===maiorBom}; }
  var linhas = [linha('Entrou', a.ins, b.ins, true), linha('Saiu', a.outs, b.outs, false), linha(negativos ? 'Faltou' : 'Sobrou', negativos ? -a.res : a.res, negativos ? -b.res : b.res, !negativos)];
  var nomes = {}; Object.keys(A.cat).concat(Object.keys(B.cat)).forEach(function(n){ nomes[n] = 1; });
  var cats = Object.keys(nomes).map(function(n){ return {nome:n, a:(A.cat[n]||0)/A.divisor, b:(B.cat[n]||0)/B.divisor}; })
    .filter(function(c){ return c.a>=0 && c.b>=0 && (c.a>0 || c.b>0); })
    .map(function(c){
      c.dif = c.a-c.b;
      c.txt = c.b===0 ? 'nova' : c.a===0 ? 'sumiu' : (c.dif>=0 ? '+' : '−')+Math.round(Math.abs(c.dif)/c.b*100)+'%';
      return c;
    })
    .sort(function(x, y){ return Math.abs(y.dif)-Math.abs(x.dif) || (x.nome<y.nome ? -1 : 1); });
  var altas = cats.filter(function(c){ return c.dif>0.005; }).slice(0, 3).map(function(c){ return {nome:c.nome, dif:c.dif}; });
  var quedas = cats.filter(function(c){ return c.dif<-0.005; }).slice(0, 3).map(function(c){ return {nome:c.nome, dif:c.dif}; });
  return {veredito:ver, linhas:linhas, categorias:cats, mudou:{altas:altas, quedas:quedas}};
}

return { contem:contem, anterior:anterior, nomeAnterior:nomeAnterior, nome:nome, curto:curto, deMeses:deMeses, deDias:deDias,
  atalhos:atalhos, atalhosComparar:atalhosComparar, limites:limites, cobertura:cobertura, sobrepoe:sobrepoe, ddmmaaaa:ddmmaaaa, lerData:lerData, validar:validar, fatorMes:fatorMes, comparar:comparar,
  chaveDe:function(d){ return chave(d.getFullYear(), d.getMonth()); }, iso:iso };
})();
if (typeof window!=='undefined') window.Periodo = Periodo;
if (typeof module!=='undefined') module.exports = Periodo;
