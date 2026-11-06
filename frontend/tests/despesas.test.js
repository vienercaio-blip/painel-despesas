// Testes das contas da página Despesas. Para rodar: node --test frontend/tests
const test = require('node:test');
const assert = require('node:assert');
const D = require('../js/despesas.js');

test('divisao: fixas e dia a dia somam o total, % inteiras somam 100, categoria negativa não entra', () => {
  const r = D.divisao({Moradia: 300, Mercado: 200, Lazer: -50}, ['Moradia'], 450);
  assert.equal(r.fixas, 300); assert.equal(r.dia, 150);
  assert.equal(r.pFixas, 67); assert.equal(r.pDia, 33);
});
test('divisao: fixa negativa não soma; sem saídas tudo zero', () => {
  assert.equal(D.divisao({Moradia: -20, Mercado: 100}, ['Moradia'], 80).fixas, 0);
  assert.deepEqual(D.divisao({}, ['Moradia'], 0), {fixas: 0, dia: 0, pFixas: 0, pDia: 0});
});

test('origens: agrupa por chave, top n com % da categoria e o resto', () => {
  const L = [
    {chave: 'a', rotulo: 'ALUGUEL', valor: 1000}, {chave: 'a', rotulo: 'ALUGUEL 2', valor: 1000},
    {chave: 'b', rotulo: 'COND', valor: 500}, {chave: 'c', rotulo: 'GAS', valor: 300},
    {chave: 'd', rotulo: 'X', valor: 150}, {chave: 'e', rotulo: 'Y', valor: 50}];
  const r = D.origens(L, 3);
  assert.equal(r.total, 3000);
  assert.deepEqual(r.top.map(o => [o.rotulo, o.valor]), [['ALUGUEL', 2000], ['COND', 500], ['GAS', 300]]);
  assert.ok(Math.abs(r.top[0].pct - 2000 / 3000) < 1e-9);
  assert.deepEqual(r.resto, {n: 2, valor: 200});
  assert.equal(D.origens(L.slice(0, 3), 3).resto, null);
});

test('serie: marca o maior e a média ignora unidades parciais', () => {
  const r = D.serie([
    {chave: '1', rotulo: 'a', valor: 100, parcial: false},
    {chave: '2', rotulo: 'b', valor: 200, parcial: false},
    {chave: '3', rotulo: 'c', valor: 900, parcial: true}]);
  assert.deepEqual(r.barras.map(b => b.maior), [false, false, true]);
  assert.equal(r.media, 150);
});
test('serie: todas parciais → média de todas; vazia → 0', () => {
  assert.equal(D.serie([{valor: 10, parcial: true}, {valor: 30, parcial: true}]).media, 20);
  assert.equal(D.serie([]).media, 0);
});

test('mudancas: n subidas e quedas por reais, nova, negativas fora', () => {
  const r = D.mudancas({A: 100, B: 50, C: -5}, {A: 150, B: 0, D: 30}, 2);
  assert.deepEqual(r.subiram.map(x => [x.nome, x.d, x.txt]), [['A', 50, '+50%'], ['D', 30, 'nova']]);
  assert.deepEqual(r.cairam.map(x => [x.nome, x.d, x.txt]), [['B', -50, '−100%']]);
  assert.ok(!r.subiram.concat(r.cairam).some(x => x.nome === 'C'));
});

test('frases: nada → vazio', () => {
  assert.deepEqual(D.frases({semCat: null, taxas: null, cats: [], outs: 0, diasRenda: null}), []);
});
test('frases: sem categoria com aviso primeiro, taxas, 3 maiores e dias de renda', () => {
  const f = D.frases({semCat: {n: 17, v: 1311.03}, taxas: {v: 600, ins: 10000},
    cats: [{nome: 'a', v: 400}, {nome: 'b', v: 300}, {nome: 'c', v: 200}, {nome: 'd', v: 100}], outs: 1000, diasRenda: 14});
  assert.equal(f[0].w, true); assert.match(f[0].t, /17 despesas ficaram sem categoria/);
  assert.equal(f[1].w, true); assert.match(f[1].t, /Taxas/);
  assert.equal(f[2].w, false); assert.match(f[2].t, /As 3 maiores categorias levam 90% de tudo o que saiu\./);
  assert.match(f[3].t, /cerca de 14 dias de renda/);
});
test('frases: 3 maiores só com 4+ categorias; taxa baixa sem aviso; 1 despesa no singular', () => {
  const f = D.frases({semCat: {n: 1, v: 10}, taxas: {v: 100, ins: 10000}, cats: [{nome: 'a', v: 1}, {nome: 'b', v: 1}, {nome: 'c', v: 1}], outs: 3, diasRenda: null});
  assert.match(f[0].t, /^1 despesa ficou sem categoria/);
  assert.equal(f[1].w, false);
  assert.equal(f.length, 2);
});
