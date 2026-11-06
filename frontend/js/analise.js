/* Contas e regras do dashboard: veredito, ações sugeridas, barras de
   categorias e atalhos do filtro. Não mexe na tela: recebe tudo pronto
   num "contexto" montado pelo painel.js e devolve dados para desenhar.

   Contexto: { escopo:'meses'|'mes'|'semana', nM,
     ins, outs, byCat:{nome:total}, meses:[{name, cat:{nome:total}}],
     fixas:[nome], nomes:{delivery, tarifas, assinaturas, compras, dividas, taxas},
     outros, brl(n), pct(n) }
   Testes: node --test frontend/tests */
var Analise = (function(){
'use strict';

function quando(c){
  if (c.notaMes) return 'por mês ('+c.notaMes+')';   /* dias exatos: média de 30 dias */
  if (c.escopo==='dias') return 'nestes '+c.dias+' dias';
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
  var q = quando(c);
  var res = c.ins - c.outs, mRes = Math.abs(res)/c.nM, sobra = c.ins ? res/c.ins : 0;
  var v;
  if (!c.ins && !c.outs){
    v = { cor:'neutro', titulo:'Sem movimento:', texto:'nenhuma entrada nem saída neste período.' };
  } else if (!c.ins && c.outs>0){
    v = { cor:'vermelho', titulo:'Alerta:', texto:'saíram '+c.brl(c.outs)+' e não entrou nada neste período.' };
  } else if (res<0){
    v = { cor:'vermelho', titulo:'Alerta:', texto:'você gasta '+c.brl(mRes)+' a mais do que ganha '+q+'.' };
  } else if (sobra<0.10 && c.outs>0){
    v = { cor:'amarelo', titulo:'Atenção:', texto:'sobra pouco, '+c.brl(mRes)+' '+q+'. Um imprevisto já aperta.' };
  } else {
    v = { cor:'verde', titulo:'Tudo certo:', texto:'sobram '+c.brl(mRes)+' '+q+', '+c.pct(sobra)+' do que entra.' };
  }
  var top = maiorCategoria(c);
  v.pesa = top && c.outs>0 ? 'O que mais pesa: '+top+', com '+c.pct(c.byCat[top]/c.outs)+' dos gastos.' : null;
  return v;
}

/* estornos maiores que os gastos deixariam "Saiu" negativo: o Saiu fica em
   zero e a sobra conta como entrada (é dinheiro que voltou para a conta) */
function ajustarEstornos(t){
  /* arredonda para centavos: somas de reais deixam restos como 0,0000000000004,
     que viraria "Alerta: saíram R$ 0,00" */
  function cents(x){ return Math.round(x*100)/100 || 0; }
  var ins = cents(t.ins), outs = cents(t.outs);
  return outs<0 ? { ins:cents(ins-outs), outs:0 } : { ins:ins, outs:outs };
}

/* ---------- os três números: Entrou, Saiu e Sobrou (ou Faltou) ----------
   Em destaque, o total do período (bate com a soma que a pessoa faz de cabeça);
   com mais de um mês, a média por mês vai na linha de baixo. */
function numeros(c){
  var res = c.ins - c.outs;
  function sub(v){
    if (c.escopo==='semana') return 'nesta semana';
    if (c.escopo==='dias') return 'em '+c.dias+' dias';
    if (c.notaMes) return 'em '+c.dias+' dias · '+c.brl(v/c.nM)+' por mês ('+c.notaMes+')';
    return c.nM>1 ? 'em '+c.nM+' meses · '+c.brl(v/c.nM)+' por mês' : 'neste mês';
  }
  return [
    { rotulo:'Entrou', valor:c.brl(c.ins), sub:sub(c.ins), neg:false },
    { rotulo:'Saiu', valor:c.brl(c.outs), sub:sub(c.outs), neg:false },
    { rotulo: res>=0 ? 'Sobrou' : 'Faltou', valor:c.brl(Math.abs(res)), sub:sub(Math.abs(res)), neg: res<0 }
  ];
}

/* ---------- movimento interno: a linha embaixo dos três números ----------
   Dinheiro guardado (aplicado menos resgatado) e transferências entre as
   contas do cliente ficam fora de Entrou e Saiu; esta linha mostra para onde
   foram. Os nomes são fixos, mesmo que o cliente renomeie as categorias. */
function linhaInterno(c){
  var partes = [], guardado = c.aplicado - c.resgatado;
  if (guardado>0.005) partes.push('Você guardou '+c.brl(guardado)+' em investimentos e reservas.');
  else if (guardado<-0.005) partes.push('Você tirou '+c.brl(-guardado)+' dos investimentos e reservas.');
  if (c.transferido>0.005) partes.push(c.brl(c.transferido)+' em transferências entre suas contas não contam como entrada nem saída.');
  return partes.length ? partes.join(' ') : null;
}

/* ---------- "também nos próximos": pode criar a regra? ----------
   Uma regra vale para a origem inteira: despesas usam qualquer categoria (menos
   "Entrada"); entradas só usam "Entrada" ou uma categoria interna. Então a regra
   nova não pode mudar lançamentos do outro sentido, nem apagar a regra que eles
   usam. c = { entrada, para, regraAtual, outroSentido, internos } */
function regraProximos(c){
  function interna(x){ return c.internos.indexOf(x)!==-1; }
  if (interna(c.para) && c.outroSentido) return false;
  var a = c.regraAtual;
  if (a && a!==c.para){
    if (c.entrada && a!=='Entrada' && !interna(a)) return false;   /* apagaria a regra das despesas */
    if (!c.entrada && (a==='Entrada' || interna(a))) return false;  /* apagaria a regra das entradas */
  }
  return true;
}

/* ---------- Parte 2: o que fazer agora ---------- */
function acoes(c){
  if (c.escopo==='semana') return { lista:[], vazio:'Escolha um mês ou mais para ver sugestões.' };
  var q = quando(c), L = [];
  function val(cod){ var n = c.nomes && c.nomes[cod]; return n ? (c.byCat[n]||0) : 0; }
  function nome(cod){ return c.nomes[cod]; }
  function deSaidas(v){ return c.outs>0 ? v/c.outs : 0; }
  function gastou(v, n){
    return 'Você gastou '+c.brl(v/c.nM)+' '+q+' com '+n+', '+c.pct(deSaidas(v))+' de tudo que saiu.';
  }
  function add(id, titulo, motivo, economia, cat, link){
    L.push({ id:id, titulo:titulo, motivo:motivo, economia:economia, cat:cat||null, link:link||null });
  }
  var v = val('delivery');
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
  v = val('taxas');
  if (c.ins>0 && v/c.ins>0.03) add('taxas', 'Negociar a taxa da maquininha',
    nome('taxas')+' levaram '+c.brl(v/c.nM)+' '+q+', '+c.pct(v/c.ins)+' do que entrou.', v/c.nM*0.25, nome('taxas'));
  var fixos = c.fixas.reduce(function(s,n){ return s+(c.byCat[n]||0); },0);
  if (deSaidas(fixos)>0.60) add('fixos', 'Revisar contratos fixos',
    'As contas fixas somam '+c.brl(fixos/c.nM)+' '+q+', '+c.pct(deSaidas(fixos))+' de tudo que saiu.', null, null);
  /* categoria que subiu no último mês em relação à média dos anteriores */
  if (c.meses.length>=3){
    var ult = c.meses[c.meses.length-1], ant = c.meses.slice(0,-1), melhor = null;
    Object.keys(c.byCat).forEach(function(n){
      if (n===c.outros) return;
      var media = ant.reduce(function(s,m){ return s+(m.cat[n]||0); },0)/ant.length, agora = ult.cat[n]||0;
      if (media>0 && agora>media*1.2 && agora-media>=50 && (!melhor || agora-media>melhor.d)) melhor = {n:n, d:agora-media, agora:agora};
    });
    if (melhor) add('normal', 'Trazer '+melhor.n+' de volta ao normal',
      'Em '+ult.name+' você gastou '+c.brl(melhor.agora)+' com '+melhor.n+', '+c.brl(melhor.d)+' acima da média.',
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
  return { lista:L, vazio: L.length ? null : 'Nada urgente: seus gastos estão sob controle.' };
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

/* ---------- Dashboard em grade ----------
   "Para onde vai o dinheiro" mostra as n maiores (as linhas já vêm em ordem,
   com "Outros" por último); "todas" mostra a lista inteira */
function visiveis(linhas, todas, n){
  if (todas || linhas.length<=n) return { linhas:linhas, escondidas:0 };
  /* "Outros" (sempre por último) entra quando o VALOR dele está entre os n maiores:
     é justamente o que a pessoa precisa classificar */
  var outros = linhas.filter(function(l){ return l.outros; })[0];
  var resto = linhas.filter(function(l){ return !l.outros; });
  var maiores = resto.concat(outros ? [outros] : []).slice().sort(function(a,b){ return b.mes-a.mes; }).slice(0, n);
  var comOutros = !!outros && maiores.indexOf(outros)!==-1;
  var lista = resto.slice(0, comOutros ? n-1 : n).concat(comOutros ? [outros] : []);
  return { linhas:lista, escondidas:linhas.length-lista.length };
}
/* valores de um campo (ins, outs, res) mês a mês, para os minigráficos;
   com menos de 2 meses não há evolução para mostrar */
function serieMeses(meses, campo){
  if (meses.length<2) return [];
  return meses.map(function(m){ return m[campo] || 0; });
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

/* ---------- Dashboard em faixas ---------- */
/* compara o último mês (B) com o anterior (A): frase sobre o que saiu e as
   categorias que mais subiram e caíram, pela variação em reais */
function comparacao(A, B, brl, pct){
  var dif = B.outs - A.outs;
  var frase = Math.abs(dif) < 0.5 ? 'Em '+B.name+' saiu o mesmo que em '+A.name+'.'
    : 'Em '+B.name+' saiu '+brl(Math.abs(dif))+(dif>0 ? ' a mais' : ' a menos')+' que em '+A.name+'.';
  var nomes = {};
  Object.keys(A.cat).concat(Object.keys(B.cat)).forEach(function(n){ nomes[n] = 1; });
  /* categorias com estornos maiores que os gastos (valor negativo) não entram:
     dariam variações impossíveis, como "−109%" */
  var vars = Object.keys(nomes).map(function(n){ var a = A.cat[n]||0, b = B.cat[n]||0; return {nome:n, a:a, b:b, d:b-a}; })
    .filter(function(v){ return v.a >= 0 && v.b >= 0 && Math.abs(v.d) >= 0.01; })
    .sort(function(x, y){ return Math.abs(y.d)-Math.abs(x.d) || (x.nome < y.nome ? -1 : 1); });
  var txt = function(v){ return v.a<=0 ? 'nova' : (v.d>0 ? '+' : '−')+pct(Math.abs(v.d)/v.a); };
  var alta = vars.filter(function(v){ return v.d>0; })[0], queda = vars.filter(function(v){ return v.d<0; })[0];
  return { frase:frase, alta: alta ? {nome:alta.nome, txt:txt(alta)} : null, queda: queda ? {nome:queda.nome, txt:txt(queda)} : null };
}
/* as n maiores saídas (valor positivo), desempatando pela data mais recente;
   com "chave" (a origem), entra só a maior de cada origem: o aluguel não aparece três vezes */
function maioresGastos(lista, n){
  var vistos = {};
  return lista.slice().sort(function(a, b){ return b.valor-a.valor || b.data-a.data; })
    .filter(function(x){ if (!x.chave) return true; if (vistos[x.chave]) return false; vistos[x.chave] = 1; return true; })
    .slice(0, n);
}
/* pedaços da barra de categorias: porcentagens inteiras que somam 100,
   sem as categorias negativas (estornos maiores que os gastos) */
function fatias(linhas, n){
  var pos = linhas.filter(function(l){ return !l.negativo && l.pct>0; });
  var tot = pos.reduce(function(s, l){ return s+l.pct; }, 0);
  if (!tot) return [];
  /* porcentagens inteiras de TODAS as categorias, uma vez só (maiores restos):
     a legenda e a lista completa mostram sempre os mesmos números */
  var f = pos.map(function(l){ var b = l.pct/tot*100; return {nome:l.nome, bruto:b, pct:Math.floor(b), outros:!!l.outros, demais:false}; });
  var falta = 100 - f.reduce(function(s, x){ return s+x.pct; }, 0);
  f.slice().sort(function(a, b){ return (b.bruto-b.pct)-(a.bruto-a.pct) || b.bruto-a.bruto; })
    .slice(0, falta).forEach(function(x){ x.pct++; });
  /* com n: as n maiores e o resto somado numa fatia só (a soma das porcentagens dele) */
  if (n && f.length>n){
    var ord = f.slice().sort(function(a, b){ return b.bruto-a.bruto; });
    var resto = ord.slice(n);
    f = ord.slice(0, n).concat([{nome:'Outras categorias', demais:true, outros:true,
      bruto: resto.reduce(function(s, x){ return s+x.bruto; }, 0), pct: resto.reduce(function(s, x){ return s+x.pct; }, 0)}]);
  }
  f.forEach(function(x){ x.rotulo = x.bruto<1 ? '<1%' : x.pct+'%'; x.outros = x.outros || x.demais; delete x.bruto; });
  return f.filter(function(x){ return !x.outros; }).concat(f.filter(function(x){ return x.outros && !x.demais; }), f.filter(function(x){ return x.demais; }));
}

/* Lançamentos: ordena por data ou pelo tamanho do valor (|valor|); empate pela data
   mais nova; devolve uma lista nova */
function ordenarLancamentos(lista, col, dir){
  var sinal = dir==='asc' ? 1 : -1;
  return lista.map(function(t, i){ return {t:t, i:i}; }).sort(function(a, b){
    var d = col==='valor' ? (Math.abs(a.t.value)-Math.abs(b.t.value))*sinal : (a.t.date-b.t.date)*sinal;
    if (d) return d;
    return (b.t.date-a.t.date) || (a.i-b.i);
  }).map(function(x){ return x.t; });
}
/* quantos lançamentos precisam de revisão (o critério vem de fora) */
function paraRevisar(lista, ehOutro){ return lista.filter(ehOutro).length; }
return { ordenarLancamentos:ordenarLancamentos, paraRevisar:paraRevisar, comparacao:comparacao, maioresGastos:maioresGastos, fatias:fatias, visiveis:visiveis, serieMeses:serieMeses, veredito:veredito, ajustarEstornos:ajustarEstornos, numeros:numeros, linhaInterno:linhaInterno, regraProximos:regraProximos, acoes:acoes, barras:barras, atalho:atalho };
})();
if (typeof window!=='undefined') window.Analise = Analise;
if (typeof module!=='undefined') module.exports = Analise;
