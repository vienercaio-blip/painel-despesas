// Testes do módulo de análise do dashboard. Para rodar: node --test frontend/tests
const test = require('node:test');
const assert = require('node:assert');
const Analise = require('../js/analise.js');

function ctx(over){
  return Object.assign({
    perfil:'pf', escopo:'meses', nM:1, ins:0, outs:0, byCat:{}, meses:[], fixas:[],
    nomes:{delivery:null, tarifas:null, assinaturas:null, compras:null, dividas:null, taxas:null},
    outros:'Outros (revisar)',
    brl: n => 'R$ ' + n.toFixed(2),
    pct: n => Math.round(n * 100) + '%'
  }, over);
}

// ---------- veredito ----------

test('veredito verde, amarelo, vermelho e sem entradas (pf)', () => {
  assert.equal(Analise.veredito(ctx({ins:1000, outs:850})).cor, 'verde');
  assert.equal(Analise.veredito(ctx({ins:1000, outs:950})).cor, 'amarelo');
  assert.equal(Analise.veredito(ctx({ins:1000, outs:1200})).cor, 'vermelho');
  const v = Analise.veredito(ctx({ins:0, outs:300}));
  assert.equal(v.cor, 'vermelho');
  assert.match(v.texto, /não entrou nada neste período/);
});

test('limite de 10% é verde', () => {
  assert.equal(Analise.veredito(ctx({ins:1000, outs:900})).cor, 'verde');
});

test('textos de pf e empresa', () => {
  assert.equal(Analise.veredito(ctx({ins:1000, outs:850})).titulo, 'Tudo certo:');
  assert.equal(Analise.veredito(ctx({ins:1000, outs:950})).titulo, 'Atenção:');
  assert.equal(Analise.veredito(ctx({ins:1000, outs:1200})).titulo, 'Alerta:');
  assert.equal(Analise.veredito(ctx({perfil:'empresa', ins:1000, outs:850})).titulo, 'Lucro saudável:');
  assert.equal(Analise.veredito(ctx({perfil:'empresa', ins:1000, outs:950})).titulo, 'Margem apertada:');
  assert.equal(Analise.veredito(ctx({perfil:'empresa', ins:1000, outs:1200})).titulo, 'Prejuízo:');
  assert.equal(Analise.veredito(ctx({perfil:'empresa', ins:0, outs:10})).titulo, 'Sem faturamento:');
});

test('frases da especificação', () => {
  assert.equal(Analise.veredito(ctx({ins:1000, outs:850, nM:1})).texto, 'sobram R$ 150.00 neste mês, 15% do que entra.');
  assert.equal(Analise.veredito(ctx({ins:1000, outs:1200})).texto, 'você gasta R$ 200.00 a mais do que ganha neste mês.');
  assert.equal(Analise.veredito(ctx({perfil:'empresa', ins:1000, outs:950})).texto, 'lucro de R$ 50.00 neste mês, só 5% do faturamento.');
});

test('por mês / neste mês / nesta semana', () => {
  assert.match(Analise.veredito(ctx({ins:2000, outs:1700, nM:2})).texto, /R\$ 150\.00 por mês/);
  assert.match(Analise.veredito(ctx({ins:1000, outs:850, escopo:'mes'})).texto, /neste mês/);
  assert.match(Analise.veredito(ctx({ins:1000, outs:850, escopo:'semana'})).texto, /nesta semana/);
});

test('o que mais pesa ignora Outros', () => {
  const v = Analise.veredito(ctx({ins:1000, outs:500, byCat:{'Outros (revisar)':300, 'Mercado':200}}));
  assert.equal(v.pesa, 'O que mais pesa: Mercado, com 40% dos gastos.');
  assert.equal(Analise.veredito(ctx({ins:1000, outs:500, byCat:{'Outros (revisar)':500}})).pesa, null);
});

test('veredito sem nada não lança erro', () => {
  assert.doesNotThrow(() => Analise.veredito(ctx({ins:0, outs:0})));
});

test('período só com entradas é verde', () => {
  assert.equal(Analise.veredito(ctx({ins:1000, outs:0})).cor, 'verde');
});

// ---------- barras ----------

test('barras: ordem, Outros por último, negativo e seta', () => {
  const c = ctx({nM:2, byCat:{'Mercado':400, 'Outros (revisar)':900, 'Compras online':-20, 'Moradia':1000},
    meses:[{name:'set', cat:{'Mercado':100}}, {name:'out', cat:{'Mercado':300}}], fixas:['Moradia']});
  const b = Analise.barras(c, null);
  assert.deepEqual(b.linhas.map(l => l.nome), ['Moradia', 'Mercado', 'Compras online', 'Outros (revisar)']);
  assert.equal(b.linhas[0].fixa, true);
  assert.equal(b.linhas[0].mes, 500);
  assert.equal(b.linhas[1].seta, 'sobe');
  assert.equal(b.linhas[2].negativo, true);
  assert.equal(b.linhas[3].outros, true);
  assert.equal(b.total, 2280);
});

test('barras: seta só com 2 meses ou mais e variação acima de 10%', () => {
  const um = ctx({byCat:{A:100}, meses:[{name:'out', cat:{A:100}}]});
  assert.equal(Analise.barras(um, null).linhas[0].seta, null);
  const estavel = ctx({nM:2, byCat:{A:210}, meses:[{name:'set', cat:{A:100}}, {name:'out', cat:{A:110}}]});
  assert.equal(Analise.barras(estavel, null).linhas[0].seta, null);  // 110 vs média 105: +4,8%
  const caiu = ctx({nM:2, byCat:{A:300}, meses:[{name:'set', cat:{A:200}}, {name:'out', cat:{A:100}}]});
  assert.equal(Analise.barras(caiu, null).linhas[0].seta, 'desce');
});

test('barras respeitam a seleção e ignoram categoria sem valor', () => {
  const c = ctx({byCat:{A:3, B:2, C:1}});
  assert.deepEqual(Analise.barras(c, ['C', 'A', 'Sumiu']).linhas.map(l => l.nome), ['A', 'C']);
  assert.equal(Analise.barras(c, ['C', 'A']).total, 4);
});

// ---------- atalhos do filtro ----------

test('atalhos', () => {
  const c = ctx({byCat:{A:5, B:4, C:3, D:2, E:1, F:0.5, 'Outros (revisar)':9}, fixas:['A']});
  assert.equal(Analise.atalho('todas', c), null);
  assert.deepEqual(Analise.atalho('top3', c), ['A', 'B', 'C']);
  assert.equal(Analise.atalho('top5', c).length, 5);
  assert.deepEqual(Analise.atalho('semFixas', c), ['B', 'C', 'D', 'E', 'F', 'Outros (revisar)']);
});
