// Testes da escolha de aparência (tema). Para rodar: node --test frontend/tests
const test = require('node:test');
const assert = require('node:assert');
const Tema = require('../js/tema.js');

test('aparência clara e escura viram o atributo data-theme', () => {
  assert.equal(Tema.atributo('claro'), 'light');
  assert.equal(Tema.atributo('escuro'), 'dark');
});

test('automática (ou valor desconhecido) segue o aparelho: sem atributo', () => {
  assert.equal(Tema.atributo('auto'), null);
  assert.equal(Tema.atributo(undefined), null);
  assert.equal(Tema.atributo('xyz'), null);
});

test('chave do localStorage', () => {
  assert.equal(Tema.CHAVE, 'sobrou-tema');
});
