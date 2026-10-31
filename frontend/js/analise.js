/* Contas e regras do dashboard: veredito, ações sugeridas, barras de
   categorias e atalhos do filtro. Não mexe na tela: recebe tudo pronto
   num "contexto" montado pelo painel.js e devolve dados para desenhar.

   Contexto: { perfil:'pf'|'empresa', escopo:'meses'|'mes'|'semana', nM,
     ins, outs, byCat:{nome:total}, meses:[{name, cat:{nome:total}}],
     fixas:[nome], nomes:{delivery, tarifas, assinaturas, compras, dividas, taxas},
     outros, brl(n), pct(n) }
   Testes: node --test frontend/tests */
var Analise = (function(){
'use strict';

function quando(c){
  if (c.nM>1) return 'por mês';
  return c.escopo==='semana' ? 'nesta semana' : 'neste mês';
}
function maiorCategoria(c){
  var nomes = Object.keys(c.byCat).filter(function(n){ return n!==c.outros && c.byCat[n]>0; });
  nomes.sort(function(a,b){ return c.byCat[b]-c.byCat[a]; });
  return nomes[0] || null;
}

/* ---------- Parte 1: veredito ---------- */
function veredito(c){
  var pf = c.perfil!=='empresa', q = quando(c);
  var res = c.ins - c.outs, mRes = Math.abs(res)/c.nM, sobra = c.ins ? res/c.ins : 0;
  var v;
  if (!c.ins && c.outs>0){
    v = { cor:'vermelho', titulo: pf ? 'Alerta:' : 'Sem faturamento:',
      texto:'saíram '+c.brl(c.outs)+' e não entrou nada neste período.' };
  } else if (res<0){
    v = { cor:'vermelho', titulo: pf ? 'Alerta:' : 'Prejuízo:',
      texto: pf ? 'você gasta '+c.brl(mRes)+' a mais do que ganha '+q+'.' : 'saem '+c.brl(mRes)+' a mais do que entram '+q+'.' };
  } else if (sobra<0.10 && c.outs>0){
    v = { cor:'amarelo', titulo: pf ? 'Atenção:' : 'Margem apertada:',
      texto: pf ? 'sobra pouco, '+c.brl(mRes)+' '+q+'. Um imprevisto já aperta.' : 'lucro de '+c.brl(mRes)+' '+q+', só '+c.pct(sobra)+' do faturamento.' };
  } else {
    v = { cor:'verde', titulo: pf ? 'Tudo certo:' : 'Lucro saudável:',
      texto: pf ? 'sobram '+c.brl(mRes)+' '+q+', '+c.pct(sobra)+' do que entra.' : c.brl(mRes)+' '+q+', '+c.pct(sobra)+' do faturamento.' };
  }
  var top = maiorCategoria(c);
  v.pesa = top && c.outs>0 ? 'O que mais pesa: '+top+', com '+c.pct(c.byCat[top]/c.outs)+' dos gastos.' : null;
  return v;
}

/* ---------- Parte 3: barras de "para onde vai o dinheiro" ---------- */
function seta(c, nome){
  if (c.meses.length<2) return null;
  var vals = c.meses.map(function(m){ return m.cat[nome]||0; });
  var media = vals.reduce(function(s,x){ return s+x; },0)/vals.length;
  if (media<=0) return null;
  var d = (vals[vals.length-1]-media)/media;
  return d>0.10 ? 'sobe' : d<-0.10 ? 'desce' : null;
}
function barras(c, selecionadas){
  var nomes = Object.keys(c.byCat).filter(function(n){
    return c.byCat[n]!==0 && (!selecionadas || selecionadas.indexOf(n)!==-1);
  });
  nomes.sort(function(a,b){
    if (a===c.outros) return 1; if (b===c.outros) return -1;
    return c.byCat[b]-c.byCat[a];
  });
  var total = nomes.reduce(function(s,n){ return s+c.byCat[n]; },0);
  return { total: total, linhas: nomes.map(function(n){
    var v = c.byCat[n];
    return { nome:n, mes:v/c.nM, pct: total>0 ? v/total : 0, fixa: c.fixas.indexOf(n)!==-1,
      seta: seta(c, n), negativo: v<0, outros: n===c.outros };
  }) };
}

/* ---------- atalhos do filtro de despesas ---------- */
function atalho(tipo, c){
  if (tipo==='todas') return null;
  var nomes = Object.keys(c.byCat).filter(function(n){ return c.byCat[n]!==0; });
  if (tipo==='semFixas') return nomes.filter(function(n){ return c.fixas.indexOf(n)===-1; })
    .sort(function(a,b){ if (a===c.outros) return 1; if (b===c.outros) return -1; return c.byCat[b]-c.byCat[a]; });
  var maiores = nomes.filter(function(n){ return n!==c.outros; }).sort(function(a,b){ return c.byCat[b]-c.byCat[a]; });
  return maiores.slice(0, tipo==='top3' ? 3 : 5);
}

return { veredito:veredito, barras:barras, atalho:atalho };
})();
if (typeof window!=='undefined') window.Analise = Analise;
if (typeof module!=='undefined') module.exports = Analise;
