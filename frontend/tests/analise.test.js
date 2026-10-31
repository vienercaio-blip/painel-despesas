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

// ---------- ações ("O que fazer agora") ----------

const N = {delivery:'Delivery', tarifas:'Tarifas bancárias', assinaturas:'Assinaturas', compras:'Compras online',
  dividas:'Dívidas e juros', taxas:'Taxas de cartão e apps'};
const ids = r => r.lista.map(a => a.id);

test('delivery acima de 8% das saídas, economia metade', () => {
  const sim = Analise.acoes(ctx({ins:2000, outs:1000, byCat:{Delivery:81}, nomes:N}));
  assert.deepEqual(ids(sim), ['delivery']);
  assert.equal(sim.lista[0].economia, 40.5);
  assert.equal(sim.lista[0].titulo, 'Pedir delivery metade das vezes');
  assert.equal(sim.lista[0].motivo, 'Você gastou R$ 81.00 neste mês com Delivery, 8% de tudo que saiu.');
  assert.deepEqual(ids(Analise.acoes(ctx({ins:2000, outs:1000, byCat:{Delivery:80}, nomes:N}))), []);
});

test('tarifas (pf): qualquer valor, economia total', () => {
  const r = Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Tarifas bancárias':30}, nomes:N}));
  assert.deepEqual(ids(r), ['tarifas']);
  assert.equal(r.lista[0].titulo, 'Trocar para uma conta sem tarifa');
  assert.equal(r.lista[0].economia, 30);
});

test('assinaturas acima de R$ 100 por mês, economia 1/3', () => {
  const r = Analise.acoes(ctx({ins:5000, outs:3000, nM:2, byCat:{Assinaturas:201}, nomes:N}));
  assert.deepEqual(ids(r), ['assinaturas']);
  assert.equal(r.lista[0].economia, 33.5);
  assert.deepEqual(ids(Analise.acoes(ctx({ins:5000, outs:3000, nM:2, byCat:{Assinaturas:200}, nomes:N}))), []);
});

test('compras online acima de 10% das saídas, economia 30%', () => {
  const r = Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Compras online':110}, nomes:N}));
  assert.deepEqual(ids(r), ['compras']);
  assert.equal(r.lista[0].titulo, 'Esperar 24 h antes de comprar online');
  assert.equal(Math.round(r.lista[0].economia * 100) / 100, 33);
  assert.deepEqual(ids(Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Compras online':100}, nomes:N}))), []);
});

test('dívidas acima de 15%, sem estimativa', () => {
  const r = Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Dívidas e juros':151}, nomes:N}));
  assert.deepEqual(ids(r), ['dividas']);
  assert.equal(r.lista[0].economia, null);
  assert.deepEqual(ids(Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Dívidas e juros':150}, nomes:N}))), []);
});

test('empresa: maquininha usa % das entradas, economia 1/4', () => {
  const r = Analise.acoes(ctx({perfil:'empresa', ins:1000, outs:500, byCat:{'Taxas de cartão e apps':31}, nomes:N}));
  assert.deepEqual(ids(r), ['taxas']);
  assert.equal(r.lista[0].titulo, 'Negociar a taxa da maquininha');
  assert.equal(r.lista[0].economia, 7.75);
  assert.equal(r.lista[0].motivo, 'Taxas de cartão e apps levaram R$ 31.00 neste mês, 3% do que entrou.');
  assert.deepEqual(ids(Analise.acoes(ctx({perfil:'empresa', ins:1000, outs:500, byCat:{'Taxas de cartão e apps':30}, nomes:N}))), []);
});

test('empresa: tarifas e contratos fixos', () => {
  const r = Analise.acoes(ctx({perfil:'empresa', ins:2000, outs:1000, byCat:{'Tarifas bancárias':20, Aluguel:600}, fixas:['Tarifas bancárias', 'Aluguel'], nomes:N}));
  assert.deepEqual(ids(r), ['tarifasEmpresa', 'fixos']);   // fixos 62%, sem estimativa: por último
  assert.equal(r.lista[0].titulo, 'Negociar o pacote do banco');
  assert.equal(r.lista[1].titulo, 'Revisar contratos fixos');
  const pouco = Analise.acoes(ctx({perfil:'empresa', ins:2000, outs:1000, byCat:{Aluguel:600}, fixas:['Aluguel'], nomes:N}));
  assert.deepEqual(ids(pouco), []);   // exatamente 60%: não aparece
});

test('ações de pf não aparecem em empresa e vice-versa', () => {
  assert.deepEqual(ids(Analise.acoes(ctx({perfil:'empresa', ins:2000, outs:1000, byCat:{Delivery:500}, nomes:N}))), []);
  assert.deepEqual(ids(Analise.acoes(ctx({ins:1000, outs:500, byCat:{'Taxas de cartão e apps':100}, nomes:N}))), []);
});

test('volta ao normal: 3+ meses, +20% e +R$ 50, só a maior', () => {
  const meses = vals => vals.map((v, i) => ({name:'m' + i, cat:v}));
  const r = Analise.acoes(ctx({ins:9000, outs:3000, nM:3, byCat:{Mercado:390, Lazer:300},
    meses:meses([{Mercado:100, Lazer:50}, {Mercado:100, Lazer:50}, {Mercado:190, Lazer:200}]), nomes:N}));
  assert.deepEqual(ids(r), ['normal']);
  assert.equal(r.lista[0].titulo, 'Trazer Lazer de volta ao normal');   // +150 > +90
  assert.equal(r.lista[0].economia, 150);
  const pouco = Analise.acoes(ctx({ins:9000, outs:3000, nM:3, byCat:{Mercado:340},
    meses:meses([{Mercado:100}, {Mercado:100}, {Mercado:140}]), nomes:N}));
  assert.deepEqual(ids(pouco), []);   // +40%, mas só R$ 40
  const doisMeses = Analise.acoes(ctx({ins:9000, outs:3000, nM:2, byCat:{Mercado:400},
    meses:meses([{Mercado:100}, {Mercado:300}]), nomes:N}));
  assert.deepEqual(ids(doisMeses), []);
});

test('Outros acima de 10%, com link para Organizar', () => {
  const r = Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Outros (revisar)':101}, nomes:N}));
  assert.deepEqual(ids(r), ['outros']);
  assert.equal(r.lista[0].link, 'organizar');
  assert.equal(r.lista[0].economia, null);
  assert.deepEqual(ids(Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Outros (revisar)':100}, nomes:N}))), []);
});

test('ordem por economia, sem estimativa por último, no máximo 3', () => {
  const r = Analise.acoes(ctx({ins:9000, outs:1000, nomes:N, byCat:{
    'Dívidas e juros':200, Delivery:100, 'Tarifas bancárias':80, Assinaturas:150, 'Compras online':300}}));
  // economias: compras 90, tarifas 80, delivery 50, assinaturas 50 (empate: ordem da tabela), dívidas sem estimativa
  assert.deepEqual(ids(r), ['compras', 'tarifas', 'delivery']);
});

test('nome renomeado: usa ctx.nomes', () => {
  const r = Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Comida em casa':200}, nomes:Object.assign({}, N, {delivery:'Comida em casa'})}));
  assert.deepEqual(ids(r), ['delivery']);
  assert.match(r.lista[0].motivo, /com Comida em casa/);
});

test('categoria que não existe (nome null) não quebra', () => {
  assert.doesNotThrow(() => Analise.acoes(ctx({ins:2000, outs:1000, byCat:{X:1}})));
});

test('semana não sugere nada; sem ações, mensagem verde', () => {
  assert.equal(Analise.acoes(ctx({escopo:'semana', ins:100, outs:1000, byCat:{Delivery:500}, nomes:N})).vazio,
    'Escolha um mês ou mais para ver sugestões.');
  assert.equal(Analise.acoes(ctx({ins:2000, outs:1000, nomes:N})).vazio, 'Nada urgente: seus gastos estão sob controle.');
  assert.equal(Analise.acoes(ctx({perfil:'empresa', ins:2000, outs:1000, nomes:N})).vazio, 'Nada urgente: seus custos estão sob controle.');
  assert.equal(Analise.acoes(ctx({ins:2000, outs:1000, byCat:{Delivery:500}, nomes:N})).vazio, null);
});
