// Testes das contas do período. Para rodar: node --test frontend/tests
const test = require('node:test');
const assert = require('node:assert');
const P = require('../js/periodo.js');

const meses = (de, n) => { const r = []; let [a, m] = de.split('-').map(Number); for (let i = 0; i < n; i++) { r.push(a + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; a++; } } return r; };

test('contem: intervalo de dias inclui os dois limites inteiros', () => {
  const p = P.deDias('2026-03-10', '2026-08-25');
  assert.equal(P.contem(new Date(2026, 2, 10, 0, 1), p), true);
  assert.equal(P.contem(new Date(2026, 7, 25, 23, 59), p), true);
  assert.equal(P.contem(new Date(2026, 2, 9, 23, 59), p), false);
  assert.equal(P.contem(new Date(2026, 7, 26, 0, 0), p), false);
  assert.equal(P.contem(new Date(2026, 7, 15), {tipo: 'mes', y: 2026, m: 7}), true);
  assert.equal(P.contem(new Date(2026, 6, 31), {tipo: 'mes', y: 2026, m: 7}), false);
  assert.equal(P.contem(new Date(2001, 0, 1), {tipo: 'tudo'}), true);
  assert.equal(P.contem(new Date(2026, 9, 1, 12), {tipo: 'semana', w: '2026-09-28'}), true);
  assert.equal(P.contem(new Date(2026, 9, 5, 12), {tipo: 'semana', w: '2026-09-28'}), false);
});
test('anterior: mesmo tamanho logo antes', () => {
  const a = P.anterior(P.deMeses('2026-03', '2026-08'));
  assert.deepEqual([a.de, a.ate, a.dias], ['2025-09-01', '2026-02-28', false]);
  const b = P.anterior(P.deDias('2026-03-10', '2026-03-19'));
  assert.deepEqual([b.de, b.ate, b.dias], ['2026-02-28', '2026-03-09', true]);
  assert.deepEqual(P.anterior({tipo: 'mes', y: 2026, m: 0}), {tipo: 'mes', y: 2025, m: 11});
  assert.equal(P.anterior({tipo: 'semana', w: '2026-10-05', y: 2026, m: 9}).w, '2026-09-28');
  assert.equal(P.anterior({tipo: 'tudo'}), null);
  assert.equal(P.nomeAnterior({tipo: 'mes', y: 2026, m: 0}), 'mês anterior');
  assert.equal(P.nomeAnterior(P.deDias('2026-03-10', '2026-03-19')), 'período anterior');
});
test('nome e curto de cada tipo', () => {
  assert.equal(P.nome({tipo: 'tudo'}), 'todo o período');
  assert.equal(P.nome({tipo: 'mes', y: 2026, m: 7}), 'agosto de 2026');
  assert.equal(P.nome({tipo: 'semana', w: '2026-09-28'}), 'semana de 28/09 a 04/10');
  assert.equal(P.nome(P.deMeses('2026-03', '2026-08')), 'março a agosto de 2026');
  assert.equal(P.nome(P.deMeses('2025-11', '2026-10')), 'novembro de 2025 a outubro de 2026');
  assert.equal(P.nome(P.deMeses('2025-01', '2025-12')), 'ano de 2025');
  assert.equal(P.nome(P.deDias('2026-03-10', '2026-08-25')), '10/03/2026 a 25/08/2026');
  assert.equal(P.curto(P.deMeses('2026-01', '2026-06')), 'jan–jun/26');
  assert.equal(P.curto(P.deMeses('2025-07', '2026-06')), 'jul/25–jun/26');
  assert.equal(P.curto({tipo: 'mes', y: 2026, m: 7}), 'ago/26');
  assert.equal(P.curto(P.deDias('2026-03-10', '2026-08-25')), '10/03–25/08/26');
  assert.equal(P.curto({tipo: 'tudo'}), 'tudo');
});
test('deMeses de um mês só vira tipo mes', () => {
  assert.deepEqual(P.deMeses('2026-08', '2026-08'), {tipo: 'mes', y: 2026, m: 7});
  assert.equal(P.deMeses('2024-02', '2024-02').tipo, 'mes');
  assert.equal(P.deMeses('2024-01', '2024-02').ate, '2024-02-29');
});
test('atalhos: contam a partir do último mês do extrato e só aparecem quando cabem', () => {
  assert.deepEqual(P.atalhos(['2026-09', '2026-10']).map(a => a.id), ['tudo', 'ult1']);
  const L = P.atalhos(meses('2025-11', 12));
  assert.deepEqual(L.map(a => a.id), ['tudo', 'ult1', 'ult3', 'ult6', 'ano', 'a2025', 'a2026']);
  assert.deepEqual(L.map(a => a.rotulo), ['Todo o extrato', 'Último mês', 'Últimos 3 meses', 'Últimos 6 meses', 'Este ano', '2025', '2026']);
  const ult3 = L.find(a => a.id === 'ult3').p, ano = L.find(a => a.id === 'ano').p;
  assert.deepEqual([ult3.de, ult3.ate], ['2026-08-01', '2026-10-31']);
  assert.deepEqual([ano.de, ano.ate], ['2026-01-01', '2026-10-31']);
  assert.deepEqual(L.find(a => a.id === 'ult1').p, {tipo: 'mes', y: 2026, m: 9, rotulo: 'Último mês'});
  assert.equal(ult3.rotulo, 'Últimos 3 meses');
  assert.deepEqual(P.atalhos(meses('2026-01', 10)).map(a => a.id), ['tudo', 'ult1', 'ult3', 'ult6']);   // começa em janeiro: "Este ano" = tudo
});
test('atalhosComparar: só com os dois períodos inteiros no extrato', () => {
  assert.deepEqual(P.atalhosComparar(meses('2025-11', 12)).map(a => a.id), ['mes', 'tri']);
  const c = P.atalhosComparar(meses('2025-01', 22));
  const ano = c.find(a => a.id === 'ano');
  assert.ok(ano);
  assert.deepEqual([ano.a.de, ano.a.ate, ano.b.de, ano.b.ate], ['2026-01-01', '2026-10-31', '2025-01-01', '2025-10-31']);
  const mes = c.find(a => a.id === 'mes');
  assert.deepEqual([mes.a, mes.b], [{tipo: 'mes', y: 2026, m: 9}, {tipo: 'mes', y: 2026, m: 8}]);
  assert.deepEqual(P.atalhosComparar(['2026-10']), []);
});
test('lerData: aceita dd/mm/aaaa e ISO; recusa datas que não existem', () => {
  assert.equal(P.lerData('25/08/2026'), '2026-08-25');
  assert.equal(P.lerData('5/8/2026'), '2026-08-05');
  assert.equal(P.lerData('2026-08-25'), '2026-08-25');
  assert.equal(P.lerData('31/02/2026'), null);
  assert.equal(P.lerData('2026-13-01'), null);
  assert.equal(P.lerData('abc'), null);
  assert.equal(P.lerData(''), null);
});
test('validar: até antes de de, sem lançamentos, válido', () => {
  assert.equal(P.validar({tipo: 'intervalo', de: '2026-08-25', ate: '2026-03-10', dias: true}, 5), 'Escolha a data final depois da inicial.');
  assert.equal(P.validar(P.deDias('2026-03-10', '2026-08-25'), 0), 'Não há lançamentos entre 10/03 e 25/08.');
  assert.equal(P.validar({tipo: 'mes', y: 2026, m: 7}, 0), 'Não há lançamentos neste período.');
  assert.equal(P.validar(P.deDias('2026-03-10', '2026-08-25'), 3), null);
});
test('fatorMes: dias exatos viram média de 30 dias', () => {
  const f = P.fatorMes(P.deDias('2026-03-10', '2026-08-25'), 6);
  assert.equal(f.dias, 169);
  assert.ok(Math.abs(f.divisor - 169 / 30) < 1e-9);
  assert.equal(f.nota, 'média de 30 dias');
  assert.deepEqual(P.fatorMes(P.deMeses('2026-03', '2026-08'), 6), {divisor: 6, nota: null, dias: null});
  assert.deepEqual(P.fatorMes({tipo: 'semana', w: '2026-09-28'}, 2), {divisor: 1, nota: null, dias: null});
  assert.equal(P.fatorMes({tipo: 'tudo'}, 0).divisor, 1);
});
test('comparar: veredito, linhas, categorias e o que mais mudou', () => {
  const A = {nome: 'jan–jun/26', ins: 6000, outs: 4800, divisor: 6, cat: {Mercado: 1200, Delivery: 600, Lazer: 0, Compras: -60}};
  const B = {nome: 'jul–dez/25', ins: 6000, outs: 5400, divisor: 6, cat: {Mercado: 1800, Delivery: 360, Viagem: 300}};
  const r = P.comparar(A, B);
  assert.equal(r.veredito.cor, 'verde');
  assert.equal(r.veredito.texto.replace(/\s/g, ' '), 'Melhorou: sobrou R$ 100 a mais por mês que em jul–dez/25.');
  assert.deepEqual(r.linhas.map(l => [l.rotulo, l.a, l.b, l.dif, l.bom]), [['Entrou', 1000, 1000, 0, null], ['Saiu', 800, 900, -100, true], ['Sobrou', 200, 100, 100, true]]);
  assert.deepEqual(r.categorias.map(c => [c.nome, c.dif, c.txt]), [['Mercado', -100, '−33%'], ['Viagem', -50, 'sumiu'], ['Delivery', 40, '+67%']]);
  assert.deepEqual(r.mudou.altas.map(x => x.nome), ['Delivery']);
  assert.deepEqual(r.mudou.quedas.map(x => x.nome), ['Mercado', 'Viagem']);
  const ruim = P.comparar(B, A);
  assert.equal(ruim.veredito.cor, 'vermelho');
  assert.match(ruim.veredito.texto, /^Piorou: sobrou R\$\s100 a menos por mês que em jan–jun\/26\.$/);
  assert.equal(ruim.categorias.find(c => c.nome === 'Viagem').txt, 'nova');
  const igual = P.comparar({nome: 'a', ins: 1000, outs: 600, divisor: 1, cat: {}}, {nome: 'b', ins: 1000, outs: 600.4, divisor: 1, cat: {}});
  assert.equal(igual.veredito.cor, 'neutro');
  assert.equal(igual.veredito.texto, 'Igual: sobrou quase o mesmo por mês nos dois períodos.');
  const neg = P.comparar({nome: 'a', ins: 100, outs: 400, divisor: 1, cat: {}}, {nome: 'b', ins: 100, outs: 300, divisor: 1, cat: {}});
  assert.equal(neg.linhas[2].rotulo, 'Faltou');
  assert.match(neg.veredito.texto, /^Piorou: faltou R\$\s100 a mais por mês que em b\.$/);
});
