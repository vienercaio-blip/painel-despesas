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
