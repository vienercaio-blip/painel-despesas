// Testes das regras das pastas. Para rodar: node --test frontend/tests
const test = require('node:test');
const assert = require('node:assert');
const Pastas = require('../js/pastas.js');

test('sugere as pastas Pessoal e Empresa que faltam', () => {
  assert.deepEqual(Pastas.sugerir([], false), ['Pessoal', 'Empresa']);
  assert.deepEqual(Pastas.sugerir(['pessoal'], false), ['Empresa']);
  assert.deepEqual(Pastas.sugerir(['Pessoal', 'EMPRESA'], false), []);
  assert.deepEqual(Pastas.sugerir(['Nubank', 'Empresá'], false), ['Pessoal']);
});

test('sugestão dispensada não aparece', () => {
  assert.deepEqual(Pastas.sugerir([], true), []);
});

test('aviso de repetidos', () => {
  assert.equal(Pastas.avisoRepetidos(0), null);
  assert.equal(Pastas.avisoRepetidos(1), 'Encontramos 1 lançamento repetido entre os extratos desta pasta e contamos cada um uma vez só.');
  assert.equal(Pastas.avisoRepetidos(12), 'Encontramos 12 lançamentos repetidos entre os extratos desta pasta e contamos cada um uma vez só.');
});

test('texto dos avisos de conferência: todos aparecem', () => {
  assert.equal(Pastas.textoAvisos([]), null);
  assert.equal(Pastas.textoAvisos([{nome:'a.pdf', aviso:'Confira os totais.'}]), 'Atenção: Confira os totais.');
  assert.equal(Pastas.textoAvisos([{nome:'a.pdf', aviso:'Confira A.'}, {nome:'b.pdf', aviso:'Confira B.'}]),
    'Atenção, no extrato "a.pdf": Confira A. No extrato "b.pdf": Confira B.');
});

const P = [{id:'p1', name:'Casa'}, {id:'p2', name:'Empresa'}];
const X = [
  {id:'a', page:'p1', savedAt:'2026-10-01T10:00:00'},
  {id:'b', page:null, savedAt:'2026-11-02T09:00:00'},
  {id:'c', page:'p2', savedAt:'2026-10-20T08:00:00'},
  {id:'d', page:'apagada', savedAt:'2026-09-01T08:00:00'},
];
test('etiquetas: Todos, pastas e Sem pasta quando há extrato fora de pasta', () => {
  assert.deepEqual(Pastas.etiquetas(P, X, null), [
    {id:'all', nome:'Todos', n:4, marcada:true},
    {id:'p1', nome:'Casa', n:1, marcada:false},
    {id:'p2', nome:'Empresa', n:1, marcada:false},
    {id:'none', nome:'Sem pasta', n:2, marcada:false},
  ]);
});
test('etiquetas: sem pastas, só Todos', () => {
  assert.deepEqual(Pastas.etiquetas([], X, null), [{id:'all', nome:'Todos', n:4, marcada:true}]);
});
test('etiquetas: sem extrato fora de pasta, não há Sem pasta', () => {
  assert.deepEqual(Pastas.etiquetas(P, [X[0], X[2]], 'p2').map(e => [e.id, e.marcada]),
    [['all', false], ['p1', false], ['p2', true]]);
});
test('atualValida: pasta apagada ou Sem pasta vazia voltam para Todos', () => {
  assert.equal(Pastas.atualValida('sumiu', P, X), null);
  assert.equal(Pastas.atualValida('none', P, [X[0]]), null);
  assert.equal(Pastas.atualValida('none', [], X), null);
  assert.equal(Pastas.atualValida('none', P, X), 'none');
  assert.equal(Pastas.atualValida('p1', P, X), 'p1');
});
test('filtrar: mais recente primeiro, por etiqueta', () => {
  assert.deepEqual(Pastas.filtrar(X, P, null).map(x => x.id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(Pastas.filtrar(X, P, 'none').map(x => x.id), ['b', 'd']);
  assert.deepEqual(Pastas.filtrar(X, P, 'p2').map(x => x.id), ['c']);
  assert.deepEqual(Pastas.filtrar(X, P, 'sumiu').map(x => x.id), ['b', 'c', 'a', 'd']);
});
test('destino: só pasta que existe', () => {
  assert.equal(Pastas.destino('p1', P), 'p1');
  assert.equal(Pastas.destino(null, P), null);
  assert.equal(Pastas.destino('none', P), null);
  assert.equal(Pastas.destino('sumiu', P), null);
});

test('selo da leitura: conferido só para PDF sem aviso', () => {
  assert.deepEqual(Pastas.seloLeitura([{nome:'c6.pdf', aviso:null}]), {texto:'✓ conferido', aviso:false});
  assert.deepEqual(Pastas.seloLeitura([{nome:'a.PDF'}, {nome:'b.pdf'}]), {texto:'✓ conferido', aviso:false});
  assert.deepEqual(Pastas.seloLeitura([{nome:'extrato.ofx'}]), {texto:'✓ lido', aviso:false});
  assert.deepEqual(Pastas.seloLeitura([{nome:'a.pdf'}, {nome:'b.csv'}]), {texto:'✓ lido', aviso:false});
  assert.deepEqual(Pastas.seloLeitura([{nome:'a.pdf', aviso:'Confira os totais.'}]), {texto:'⚠ confira', aviso:true});
});

test('meses que faltam: só meses completos depois do último extrato', () => {
  assert.deepEqual(Pastas.mesesFaltando('2026-10-28', new Date(2026, 10, 4)), []);
  assert.deepEqual(Pastas.mesesFaltando('2026-10-28', new Date(2026, 11, 5)), [{ano:2026, mes:10}]);
  assert.deepEqual(Pastas.mesesFaltando('2026-10-28', new Date(2027, 1, 10)), [{ano:2026, mes:10}, {ano:2026, mes:11}, {ano:2027, mes:0}]);
  assert.deepEqual(Pastas.mesesFaltando(null, new Date(2026, 11, 5)), []);
  assert.deepEqual(Pastas.mesesFaltando('2026-12-31', new Date(2027, 0, 15)), []);
});
test('texto do lembrete', () => {
  const dez = new Date(2026, 11, 5), fev27 = new Date(2027, 1, 10);
  assert.equal(Pastas.textoLembrete([], dez), null);
  assert.equal(Pastas.textoLembrete([{ano:2026, mes:10}], dez), 'Falta o extrato de novembro.');
  assert.equal(Pastas.textoLembrete([{ano:2026, mes:10}, {ano:2026, mes:11}], new Date(2026, 11, 31)), 'Faltam os extratos de novembro e dezembro.');
  assert.equal(Pastas.textoLembrete([{ano:2026, mes:10}, {ano:2026, mes:11}, {ano:2027, mes:0}], fev27), 'Faltam os extratos desde novembro de 2026.');
  assert.equal(Pastas.textoLembrete([{ano:2026, mes:11}], new Date(2027, 0, 9)), 'Falta o extrato de dezembro de 2026.');
});
test('busca de extratos pelo nome, sem acento', () => {
  const L = [{name:'Extrato Março'}, {name:'Nubank'}, {name:null}];
  assert.deepEqual(Pastas.buscar(L, 'marco').map(x => x.name), ['Extrato Março']);
  assert.equal(Pastas.buscar(L, '').length, 3);
  assert.equal(Pastas.buscar(L, '  ').length, 3);
});
