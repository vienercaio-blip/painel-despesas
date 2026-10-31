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

/* ---------- Parte 2: o que fazer agora ---------- */
function acoes(c){
  var pf = c.perfil!=='empresa';
  if (c.escopo==='semana') return { lista:[], vazio:'Escolha um mês ou mais para ver sugestões.' };
  var q = quando(c), L = [];
  function val(cod){ var n = c.nomes && c.nomes[cod]; return n ? (c.byCat[n]||0) : 0; }
  function nome(cod){ return c.nomes[cod]; }
  function deSaidas(v){ return c.outs>0 ? v/c.outs : 0; }
  function gastou(v, n){
    return pf ? 'Você gastou '+c.brl(v/c.nM)+' '+q+' com '+n+', '+c.pct(deSaidas(v))+' de tudo que saiu.'
              : 'Saíram '+c.brl(v/c.nM)+' '+q+' com '+n+', '+c.pct(deSaidas(v))+' das saídas.';
  }
  function add(id, titulo, motivo, economia, cat, link){
    L.push({ id:id, titulo:titulo, motivo:motivo, economia:economia, cat:cat||null, link:link||null });
  }
  var v;
  if (pf){
    v = val('delivery');
    if (deSaidas(v)>0.08) add('delivery', 'Pedir delivery metade das vezes', gastou(v, nome('delivery')), v/c.nM*0.5, nome('delivery'));
    v = val('tarifas');
    if (v>0) add('tarifas', 'Trocar para uma conta sem tarifa', gastou(v, nome('tarifas')), v/c.nM, nome('tarifas'));
    v = val('assinaturas');
    if (v/c.nM>100) add('assinaturas', 'Cancelar assinaturas que não usa', gastou(v, nome('assinaturas')), v/c.nM/3, nome('assinaturas'));
    v = val('compras');
    if (deSaidas(v)>0.10) add('compras', 'Esperar 24 h antes de comprar online', gastou(v, nome('compras')), v/c.nM*0.3, nome('compras'));
    v = val('dividas');
    if (deSaidas(v)>0.15) add('dividas', 'Quitar primeiro as dívidas com juros',
      'Você pagou '+c.brl(v/c.nM)+' '+q+' em '+nome('dividas')+', '+c.pct(deSaidas(v))+' de tudo que saiu.', null, nome('dividas'));
  } else {
    v = val('taxas');
    if (c.ins>0 && v/c.ins>0.03) add('taxas', 'Negociar a taxa da maquininha',
      nome('taxas')+' levaram '+c.brl(v/c.nM)+' '+q+', '+c.pct(v/c.ins)+' do que entrou.', v/c.nM*0.25, nome('taxas'));
    v = val('tarifas');
    if (v>0) add('tarifasEmpresa', 'Negociar o pacote do banco', gastou(v, nome('tarifas')), v/c.nM, nome('tarifas'));
    var fixos = c.fixas.reduce(function(s,n){ return s+(c.byCat[n]||0); },0);
    if (deSaidas(fixos)>0.60) add('fixos', 'Revisar contratos fixos',
      'Os custos fixos somam '+c.brl(fixos/c.nM)+' '+q+', '+c.pct(deSaidas(fixos))+' das saídas.', null, null);
  }
  /* categoria que subiu no último mês em relação à média dos anteriores */
  if (c.meses.length>=3){
    var ult = c.meses[c.meses.length-1], ant = c.meses.slice(0,-1), melhor = null;
    Object.keys(c.byCat).forEach(function(n){
      if (n===c.outros) return;
      var media = ant.reduce(function(s,m){ return s+(m.cat[n]||0); },0)/ant.length, agora = ult.cat[n]||0;
      if (media>0 && agora>media*1.2 && agora-media>=50 && (!melhor || agora-media>melhor.d)) melhor = {n:n, d:agora-media, agora:agora};
    });
    if (melhor) add('normal', 'Trazer '+melhor.n+' de volta ao normal',
      (pf ? 'Em '+ult.name+' você gastou ' : 'Em '+ult.name+' saíram ')+c.brl(melhor.agora)+' com '+melhor.n+', '+c.brl(melhor.d)+' acima da média.',
      melhor.d, melhor.n);
  }
  v = c.byCat[c.outros]||0;
  if (deSaidas(v)>0.10) add('outros', 'Classificar despesas sem categoria',
    c.pct(deSaidas(v))+' das saídas estão sem categoria. Classificar deixa o painel mais preciso.', null, c.outros, 'organizar');
  /* maior economia primeiro; sem estimativa por último (sort estável: empate mantém a ordem) */
  L = L.map(function(a,i){ return {a:a, i:i}; }).sort(function(x,y){
    var ex = x.a.economia, ey = y.a.economia;
    if (ex===null && ey===null) return x.i-y.i;
    if (ex===null) return 1; if (ey===null) return -1;
    return ey-ex || x.i-y.i;
  }).map(function(x){ return x.a; }).slice(0,3);
  return { lista:L, vazio: L.length ? null : 'Nada urgente: seus '+(pf ? 'gastos' : 'custos')+' estão sob controle.' };
}

/* ---------- Parte 3: barras de "para onde vai o dinheiro" ---------- */
function seta(c, nome){
  if (c.escopo==='semana' || c.meses.length<2) return null;
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

return { veredito:veredito, acoes:acoes, barras:barras, atalho:atalho };
})();
if (typeof window!=='undefined') window.Analise = Analise;
if (typeof module!=='undefined') module.exports = Analise;
