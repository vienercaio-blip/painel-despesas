// Testes das contas da página Economia. Para rodar: node --test frontend/tests
const test = require('node:test');
const assert = require('node:assert');
const Economia = require('../js/economia.js');

const d = (a, m, dia) => new Date(a, m - 1, dia);
const OP = {essenciais: ['Moradia e aluguel'], minMeses: 3, tolerancia: 0.2};

test('repetidos: 3 meses parecidos entram, com média e descrição mais recente', () => {
  const L = [{data: d(2026, 8, 5), desc: 'NETFLIX A', valor: 55.9, origem: 'netflix', cat: 'Assinaturas'},
    {data: d(2026, 9, 5), desc: 'NETFLIX B', valor: 55.9, origem: 'netflix', cat: 'Assinaturas'},
    {data: d(2026, 10, 5), desc: 'NETFLIX C', valor: 59.9, origem: 'netflix', cat: 'Assinaturas'}];
  const r = Economia.repetidos(L, OP);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, 'rep:netflix');
  assert.equal(r[0].desc, 'NETFLIX C');
  assert.equal(r[0].cat, 'Assinaturas');
  assert.equal(r[0].meses, 3);
  assert.ok(Math.abs(r[0].mensal - 57.2333) < 0.01);
});
test('repetidos: 2 meses, variação acima de 20% e categoria essencial ficam de fora', () => {
  const L = [];
  [8, 9].forEach(m => L.push({data: d(2026, m, 3), desc: 'A', valor: 50, origem: 'a', cat: 'Lazer'}));
  [[8, 100], [9, 100], [10, 200]].forEach(([m, v]) => L.push({data: d(2026, m, 3), desc: 'B', valor: v, origem: 'b', cat: 'Lazer'}));
  [8, 9, 10].forEach(m => L.push({data: d(2026, m, 1), desc: 'ALUGUEL', valor: 1500, origem: 'c', cat: 'Moradia e aluguel'}));
  assert.deepEqual(Economia.repetidos(L, OP), []);
});
test('repetidos: dois lançamentos no mesmo mês somam no total daquele mês', () => {
  const L = [{data: d(2026, 8, 3), desc: 'ACADEMIA', valor: 60, origem: 'ac', cat: 'Academia'}, {data: d(2026, 8, 20), desc: 'ACADEMIA', valor: 60, origem: 'ac', cat: 'Academia'},
    {data: d(2026, 9, 3), desc: 'ACADEMIA', valor: 120, origem: 'ac', cat: 'Academia'}, {data: d(2026, 10, 3), desc: 'ACADEMIA', valor: 120, origem: 'ac', cat: 'Academia'}];
  const r = Economia.repetidos(L, OP);
  assert.equal(r.length, 1);
  assert.equal(r[0].mensal, 120);
});
test('acimaDoNormal: regra de 20% e R$ 50; menos de 3 meses e Outros de fora', () => {
  const M = [{name: 'ago', cat: {Mercado: 400, Lazer: 100, Outros: 10}}, {name: 'set', cat: {Mercado: 400, Lazer: 100, Outros: 10}},
    {name: 'out', cat: {Mercado: 500, Lazer: 140, Outros: 200}}];
  const r = Economia.acimaDoNormal(M, 'Outros');
  assert.deepEqual(r.map(x => [x.id, x.cat, x.agora, x.media, x.dif]), [['cat:Mercado', 'Mercado', 500, 400, 100]]);
  assert.deepEqual(Economia.acimaDoNormal(M.slice(1), 'Outros'), []);
  const M2 = [{name: 'a', cat: {Mercado: 400}}, {name: 'b', cat: {Mercado: 400}}, {name: 'c', cat: {Mercado: 480}}];
  assert.deepEqual(Economia.acimaDoNormal(M2, 'Outros'), []);   // exatamente 20%: não entra
});
test('itens: junta as fontes, descarta a dica "normal", ordena e põe as sem valor no fim', () => {
  const r = Economia.itens({
    dicas: [{id: 'delivery', titulo: 'Pedir delivery metade das vezes', motivo: 'm1', economia: 210, cat: 'Delivery'},
      {id: 'dividas', titulo: 'Quitar dívidas', motivo: 'm2', economia: null, cat: 'Dívidas'},
      {id: 'normal', titulo: 'Trazer Saúde de volta', motivo: 'm3', economia: 105, cat: 'Saúde'}],
    repetidos: [{id: 'rep:netflix', origem: 'netflix', desc: 'NETFLIX', cat: 'Assinaturas', mensal: 56, meses: 3}],
    acima: [{id: 'cat:Saúde', cat: 'Saúde', agora: 305, media: 200, dif: 105}],
    gastoCat: {Delivery: 420, Assinaturas: 56, 'Saúde': 305, 'Dívidas': 800}
  });
  assert.deepEqual(r.map(x => x.id), ['dica:delivery', 'cat:Saúde', 'rep:netflix', 'dica:dividas']);
  assert.deepEqual(r.map(x => x.tipo), ['categoria', 'categoria', 'cancelar', 'info']);
  assert.deepEqual(r.map(x => x.etiqueta), ['dica', 'acima do normal', 'repete todo mês', 'dica']);
  assert.equal(r[0].base, 420);
  assert.equal(r[1].base, 105);
  assert.equal(r[1].titulo, 'Trazer Saúde de volta ao normal');
  assert.equal(r[2].titulo, 'Cancelar NETFLIX');
  assert.equal(r[2].motivo, 'Aparece em 3 meses do extrato.');
  assert.equal(r[3].economia, null);
});
test('pctInicial: arredonda para 10% e fica entre 10% e 100%', () => {
  assert.equal(Economia.pctInicial({economia: 50, base: 200}), 0.3);
  assert.equal(Economia.pctInicial({economia: 1, base: 200}), 0.1);
  assert.equal(Economia.pctInicial({economia: 300, base: 200}), 1);
});
test('simular: soma, corte em %, limite por categoria e ids desconhecidos', () => {
  const I = [{id: 'dica:assinaturas', tipo: 'categoria', cat: 'Assinaturas', base: 150}, {id: 'rep:netflix', tipo: 'cancelar', cat: 'Assinaturas', base: 56},
    {id: 'dica:tarifas', tipo: 'categoria', cat: 'Tarifas', base: 30}, {id: 'dica:dividas', tipo: 'info', cat: 'Dívidas', base: null}];
  const r = Economia.simular(I, {'dica:assinaturas': 1, 'rep:netflix': true, 'dica:tarifas': 0.5, 'x:sumiu': true, 'dica:dividas': true}, {Assinaturas: 180, Tarifas: 30});
  assert.equal(r.porItem['dica:assinaturas'], 150);
  assert.equal(r.porItem['rep:netflix'], 30);
  assert.deepEqual(r.cortados, ['rep:netflix']);
  assert.equal(r.porItem['dica:tarifas'], 15);
  assert.equal(r.porItem['dica:dividas'], undefined);
  assert.equal(r.total, 195);
  assert.deepEqual(Economia.simular(I, {}, {}), {total: 0, porItem: {}, cortados: []});
});
test('objetivo: por mês arredondado para cima e os estados', () => {
  const hoje = d(2026, 11, 6), O = {valor: 6000, prazo: '2027-12', tenho: 2050};
  let r = Economia.objetivo(O, 400, null, hoje);   // nov/26 a dez/27 = 14 meses
  assert.deepEqual([r.falta, r.porMes, r.meses, r.mesesFixo, r.estado], [3950, 283, 10, null, 'ok']);
  assert.equal(Economia.objetivo(O, 100, null, hoje).estado, 'nao-chega');
  r = Economia.objetivo(O, 0, null, hoje);
  assert.deepEqual([r.meses, r.estado], [null, 'sem-ritmo']);
  assert.equal(Economia.objetivo({valor: 6000, prazo: '2027-12', tenho: 6000}, 400, null, hoje).estado, 'alcancado');
  assert.equal(Economia.objetivo({valor: 6000, prazo: '2026-10', tenho: 0}, 400, null, hoje).estado, 'prazo-passou');
  assert.equal(Economia.objetivo({valor: 600, prazo: '2026-11', tenho: 0}, 600, null, hoje).porMes, 600);   // prazo no mês atual = 1 mês
  assert.equal(Economia.objetivo(O, 400, 500, hoje).mesesFixo, 8);
});
test('itens: gasto repetido de categoria que já tem dica com valor não entra de novo', () => {
  const r = Economia.itens({
    dicas: [{id: 'tarifas', titulo: 'Conta sem tarifa', motivo: 'm', economia: 30, cat: 'Tarifas'}],
    repetidos: [{id: 'rep:tarifa', origem: 'tarifa', desc: 'TARIFA', cat: 'Tarifas', mensal: 30, meses: 3},
      {id: 'rep:netflix', origem: 'netflix', desc: 'NETFLIX', cat: 'Assinaturas', mensal: 56, meses: 3}],
    acima: [], gastoCat: {Tarifas: 30, Assinaturas: 56}
  });
  assert.deepEqual(r.map(x => x.id), ['rep:netflix', 'dica:tarifas']);
});
test('itens: "acima do normal" nunca sugere economizar mais que o gasto médio da categoria', () => {
  const r = Economia.itens({dicas: [], repetidos: [], acima: [{id: 'cat:Delivery', cat: 'Delivery', agora: 520, media: 155, dif: 365}], gastoCat: {Delivery: 276.67}});
  assert.equal(r[0].economia, 276.67);
  assert.equal(r[0].base, 276.67);
});

// ---- correções da revisão ----
test('simular: item "cancelar" de categoria sem gasto no período não soma nada', () => {
  const I = [{id: 'rep:netflix', tipo: 'cancelar', cat: 'Assinaturas', base: 40}, {id: 'dica:tarifas', tipo: 'categoria', cat: 'Tarifas', base: 30, economia: 30}];
  const r = Economia.simular(I, {'rep:netflix': true, 'dica:tarifas': true}, {Tarifas: 30});
  assert.equal(r.porItem['rep:netflix'], 0);
  assert.equal(r.total, 30);
});
test('simular: dica marcada sem mexer no controle vale a economia sugerida, não a arredondada', () => {
  const I = [{id: 'dica:taxas', tipo: 'categoria', cat: 'Taxas', base: 100, economia: 25}];
  assert.equal(Economia.simular(I, {'dica:taxas': true}, {Taxas: 100}).total, 25);
  assert.equal(Economia.simular(I, {'dica:taxas': 0.5}, {Taxas: 100}).total, 50);
});
test('repetidos: precisa aparecer nos meses seguidos mais recentes do extrato', () => {
  const ms = ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06'];
  const L = [];
  // cancelada em março: não entra; espalhada (jan, mar, mai): não entra; seguida até o fim: entra
  [1, 2, 3].forEach(m => L.push({data: d(2026, m, 5), desc: 'NETFLIX', valor: 40, origem: 'nf', cat: 'Assinaturas'}));
  [1, 3, 5].forEach(m => L.push({data: d(2026, m, 5), desc: 'CURSO', valor: 100, origem: 'cu', cat: 'Lazer'}));
  [4, 5, 6].forEach(m => L.push({data: d(2026, m, 5), desc: 'SPOTIFY', valor: 22, origem: 'sp', cat: 'Assinaturas'}));
  // último mês do extrato incompleto: cobrança até o penúltimo mês ainda conta
  [3, 4, 5].forEach(m => L.push({data: d(2026, m, 20), desc: 'ACADEMIA', valor: 99, origem: 'ac', cat: 'Academia'}));
  const r = Economia.repetidos(L, {essenciais: [], minMeses: 3, tolerancia: 0.2, mesesExtrato: ms});
  assert.deepEqual(r.map(x => x.origem).sort(), ['ac', 'sp']);
});
test('lerPrazo: aceita AAAA-MM e MM/AAAA; recusa mês inválido', () => {
  assert.equal(Economia.lerPrazo('2027-12'), '2027-12');
  assert.equal(Economia.lerPrazo('12/2027'), '2027-12');
  assert.equal(Economia.lerPrazo('3/2027'), '2027-03');
  assert.equal(Economia.lerPrazo('2027-13'), null);
  assert.equal(Economia.lerPrazo('2027-00'), null);
  assert.equal(Economia.lerPrazo('abc'), null);
  assert.equal(Economia.lerPrazo(''), null);
});
test('barraMeta: o trecho claro só mostra o que de fato passa a sobrar', () => {
  assert.deepEqual(Economia.barraMeta(300, 100, 500), {cheia: 60, clara: 20});
  assert.deepEqual(Economia.barraMeta(-300, 200, 500), {cheia: 0, clara: 0});   // ainda faltaria R$ 100
  assert.deepEqual(Economia.barraMeta(-100, 300, 500), {cheia: 0, clara: 40});
  assert.deepEqual(Economia.barraMeta(450, 200, 500), {cheia: 90, clara: 10});
});
