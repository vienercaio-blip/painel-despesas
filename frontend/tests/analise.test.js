// Testes do módulo de análise do dashboard. Para rodar: node --test frontend/tests
const test = require('node:test');
const assert = require('node:assert');
const Analise = require('../js/analise.js');

function ctx(over){
  return Object.assign({
    escopo:'meses', nM:1, ins:0, outs:0, byCat:{}, meses:[], fixas:[],
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

test('veredito usa sempre textos de pessoa física', () => {
  assert.equal(Analise.veredito(ctx({ins:1000, outs:850})).titulo, 'Tudo certo:');
  assert.equal(Analise.veredito(ctx({ins:1000, outs:950})).titulo, 'Atenção:');
  assert.equal(Analise.veredito(ctx({ins:1000, outs:1200})).titulo, 'Alerta:');
  assert.equal(Analise.veredito(ctx({ins:0, outs:10})).titulo, 'Alerta:');
  // um "perfil" antigo vindo de fora não muda nada
  assert.equal(Analise.veredito(ctx({perfil:'empresa', ins:1000, outs:1200})).titulo, 'Alerta:');
});

test('frases da especificação', () => {
  assert.equal(Analise.veredito(ctx({ins:1000, outs:850, nM:1})).texto, 'sobram R$ 150.00 neste mês, 15% do que entra.');
  assert.equal(Analise.veredito(ctx({ins:1000, outs:1200})).texto, 'você gasta R$ 200.00 a mais do que ganha neste mês.');
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

test('taxas acima de 3% das entradas sugere negociar a maquininha', () => {
  const r = Analise.acoes(ctx({ins:1000, outs:500, byCat:{'Taxas de cartão e apps':31}, nomes:N}));
  assert.deepEqual(ids(r), ['taxas']);
  assert.equal(r.lista[0].titulo, 'Negociar a taxa da maquininha');
  assert.equal(r.lista[0].economia, 7.75);
  assert.equal(r.lista[0].motivo, 'Taxas de cartão e apps levaram R$ 31.00 neste mês, 3% do que entrou.');
  assert.deepEqual(ids(Analise.acoes(ctx({ins:1000, outs:500, byCat:{'Taxas de cartão e apps':30}, nomes:N}))), []);
});

test('fixos acima de 60% sugere revisar contratos', () => {
  const r = Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Moradia e aluguel':610}, fixas:['Moradia e aluguel'], nomes:N}));
  assert.deepEqual(ids(r), ['fixos']);
  assert.equal(r.lista[0].titulo, 'Revisar contratos fixos');
  assert.equal(r.lista[0].motivo, 'As contas fixas somam R$ 610.00 neste mês, 61% de tudo que saiu.');
  const pouco = Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Moradia e aluguel':600}, fixas:['Moradia e aluguel'], nomes:N}));
  assert.deepEqual(ids(pouco), []);   // exatamente 60%: não aparece
});

test('tarifas gera uma ação só', () => {
  const r = Analise.acoes(ctx({ins:2000, outs:1000, byCat:{'Tarifas bancárias':20, 'Taxas de cartão e apps':100}, nomes:N}));
  assert.deepEqual(ids(r).filter(i => i.indexOf('tarifas')===0), ['tarifas']);
  assert.deepEqual(ids(r).sort(), ['tarifas', 'taxas']);
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
  assert.equal(Analise.acoes(ctx({ins:2000, outs:1000, byCat:{Delivery:500}, nomes:N})).vazio, null);
});

test('barras: sem seta na visão de semana', () => {
  const c = ctx({escopo:'semana', nM:1, byCat:{A:400}, meses:[{name:'set', cat:{A:100}}, {name:'out', cat:{A:300}}]});
  assert.equal(Analise.barras(c, null).linhas[0].seta, null);
});

// ---------- os três números (Entrou, Saiu, Sobrou) ----------

test('números: total do período em destaque e média por mês embaixo', () => {
  const r = Analise.numeros(ctx({nM:2, ins:24609.88, outs:22459.10}));
  assert.deepEqual(r.map(n => n.rotulo), ['Entrou', 'Saiu', 'Sobrou']);
  assert.equal(r[0].valor, 'R$ 24609.88');
  assert.equal(r[0].sub, 'em 2 meses · R$ 12304.94 por mês');
  assert.equal(r[2].valor, 'R$ 2150.78');
  assert.equal(r[2].neg, false);
});

test('números: um mês ou uma semana mostram só o total', () => {
  assert.equal(Analise.numeros(ctx({nM:1, ins:100, outs:40}))[0].sub, 'neste mês');
  assert.equal(Analise.numeros(ctx({escopo:'semana', nM:1, ins:100, outs:40}))[1].sub, 'nesta semana');
});

test('números: gastou mais do que entrou vira Faltou', () => {
  const r = Analise.numeros(ctx({nM:1, ins:100, outs:150}));
  assert.equal(r[2].rotulo, 'Faltou');
  assert.equal(r[2].valor, 'R$ 50.00');
  assert.equal(r[2].neg, true);
});

// ---------- movimento interno: dinheiro guardado e transferências entre suas contas ----------

const brl = n => 'R$ ' + n.toFixed(2);

test('linha interna: guardou', () => {
  assert.equal(Analise.linhaInterno({aplicado:1000, resgatado:200, transferido:0, brl}),
    'Você guardou R$ 800.00 em investimentos e reservas.');
});

test('linha interna: tirou mais do que guardou', () => {
  assert.equal(Analise.linhaInterno({aplicado:100, resgatado:300, transferido:0, brl}),
    'Você tirou R$ 200.00 dos investimentos e reservas.');
});

test('linha interna: só transferências', () => {
  assert.equal(Analise.linhaInterno({aplicado:0, resgatado:0, transferido:500, brl}),
    'R$ 500.00 em transferências entre suas contas não contam como entrada nem saída.');
});

test('linha interna: guardado e transferências juntos', () => {
  assert.equal(Analise.linhaInterno({aplicado:300, resgatado:0, transferido:50, brl}),
    'Você guardou R$ 300.00 em investimentos e reservas. R$ 50.00 em transferências entre suas contas não contam como entrada nem saída.');
});

test('linha interna: nada a mostrar', () => {
  assert.equal(Analise.linhaInterno({aplicado:0, resgatado:0, transferido:0, brl}), null);
  assert.equal(Analise.linhaInterno({aplicado:100, resgatado:100, transferido:0, brl}), null);
});

// ---------- "também nos próximos": a regra vale para a origem nos dois sentidos ----------

const INT = ['Investimentos e reservas', 'Transferências entre suas contas'];
const regra = o => Analise.regraProximos(Object.assign({entrada:false, para:'Mercado', regraAtual:null, outroSentido:false, internos:INT}, o));

test('próximos: sem conflito, pode', () => {
  assert.equal(regra({}), true);
  assert.equal(regra({entrada:true, para:'Entrada'}), true);
  assert.equal(regra({entrada:true, para:'Entrada', outroSentido:true}), true);   // "Entrada" não muda saídas
});

test('próximos: categoria interna numa origem que tem o outro sentido não pode', () => {
  assert.equal(regra({entrada:true, para:INT[1], outroSentido:true}), false);
  assert.equal(regra({entrada:false, para:INT[0], outroSentido:true}), false);
  assert.equal(regra({entrada:true, para:INT[1]}), true);
});

test('próximos: não pode apagar a regra do outro sentido', () => {
  assert.equal(regra({entrada:true, para:INT[1], regraAtual:'Família'}), false);   // regra de despesa
  assert.equal(regra({entrada:true, para:'Entrada', regraAtual:'Família'}), false);
  assert.equal(regra({entrada:false, para:'Lazer', regraAtual:'Entrada'}), false);
  assert.equal(regra({entrada:false, para:'Lazer', regraAtual:INT[0]}), false);
  assert.equal(regra({entrada:false, para:'Lazer', regraAtual:'Mercado'}), true);   // mesmo sentido: troca normal
  assert.equal(regra({entrada:true, para:INT[0], regraAtual:INT[1]}), true);
});

// ---------- pendências do painel ----------

test('veredito sem nenhuma entrada nem saída: sem movimento, em cinza', () => {
  const v = Analise.veredito(ctx({ins:0, outs:0}));
  assert.equal(v.cor, 'neutro');
  assert.equal(v.titulo, 'Sem movimento:');
  assert.equal(v.texto, 'nenhuma entrada nem saída neste período.');
});

test('estornos maiores que os gastos: Saiu fica em zero e a sobra vira entrada', () => {
  assert.deepEqual(Analise.ajustarEstornos({ins:100, outs:-30}), {ins:130, outs:0});
  assert.deepEqual(Analise.ajustarEstornos({ins:100, outs:40}), {ins:100, outs:40});
});

test('restos de arredondamento não viram alerta: estornos que zeram os gastos', () => {
  const t = Analise.ajustarEstornos({ins:0, outs:10.10 + 20.20 - 30.30});
  assert.deepEqual(t, {ins:0, outs:0});
  assert.equal(Analise.veredito(ctx(t)).cor, 'neutro');
  assert.deepEqual(Analise.ajustarEstornos({ins:0.1 + 0.2, outs:-0.0000001}), {ins:0.3, outs:0});
});

// ---------- Dashboard em grade ----------

const linhasN = n => Array.from({length:n}, (_, i) => ({nome:'C'+i, mes:100-i, outros:false}));

test('visiveis: as 5 maiores e quantas ficaram de fora', () => {
  const r = Analise.visiveis(linhasN(8), false, 5);
  assert.deepEqual(r.linhas.map(l => l.nome), ['C0','C1','C2','C3','C4']);
  assert.equal(r.escondidas, 3);
});

test('visiveis: todas, ou menos de 5', () => {
  assert.deepEqual([Analise.visiveis(linhasN(8), true, 5).linhas.length, Analise.visiveis(linhasN(8), true, 5).escondidas], [8, 0]);
  assert.deepEqual([Analise.visiveis(linhasN(3), false, 5).linhas.length, Analise.visiveis(linhasN(3), false, 5).escondidas], [3, 0]);
});

test('visiveis: Outros entra quando o valor dele está entre os 5 maiores (sempre por último)', () => {
  const grande = linhasN(6).concat([{nome:'Outros (revisar)', mes:900, outros:true}]);
  const r = Analise.visiveis(grande, false, 5);
  assert.deepEqual(r.linhas.map(x => x.nome), ['C0','C1','C2','C3','Outros (revisar)']);
  assert.equal(r.escondidas, 2);
  const pequeno = linhasN(6).concat([{nome:'Outros (revisar)', mes:1, outros:true}]);
  const r2 = Analise.visiveis(pequeno, false, 5);
  assert.equal(r2.linhas.some(x => x.outros), false);
  assert.equal(r2.escondidas, 2);
});

test('serieMeses: valores em ordem, mês sem valor vale 0, um mês só não tem série', () => {
  const meses = [{ins:10, outs:4, res:6}, {ins:20, res:20}, {ins:5, outs:9, res:-4}];
  assert.deepEqual(Analise.serieMeses(meses, 'outs'), [4, 0, 9]);
  assert.deepEqual(Analise.serieMeses(meses, 'res'), [6, 20, -4]);
  assert.deepEqual(Analise.serieMeses([{ins:1}], 'ins'), []);
});

// ---------- Dashboard em faixas ----------
const brlT = n => 'R$ ' + n.toFixed(2), pctT = n => Math.round(n * 100) + '%';
const SET = {name:'setembro de 2026', outs:1000, cat:{Mercado:400, Moradia:600}};
test('comparação: saiu mais, maior alta pela variação em reais', () => {
  const r = Analise.comparacao(SET, {name:'outubro de 2026', outs:1120, cat:{Mercado:472, Moradia:600, Delivery:48}}, brlT, pctT);
  assert.equal(r.frase, 'Em outubro de 2026 saiu R$ 120.00 a mais que em setembro de 2026.');
  assert.deepEqual(r.alta, {nome:'Mercado', txt:'+18%'});
  assert.equal(r.queda, null);
});
test('comparação: saiu menos, com a maior queda', () => {
  const r = Analise.comparacao(SET, {name:'outubro de 2026', outs:900, cat:{Mercado:300, Moradia:600}}, brlT, pctT);
  assert.equal(r.frase, 'Em outubro de 2026 saiu R$ 100.00 a menos que em setembro de 2026.');
  assert.equal(r.alta, null);
  assert.deepEqual(r.queda, {nome:'Mercado', txt:'−25%'});
});
test('comparação: o mesmo e categoria nova', () => {
  const r = Analise.comparacao(SET, {name:'outubro de 2026', outs:1000.3, cat:{Mercado:300, Moradia:500, Pets:200.3}}, brlT, pctT);
  assert.equal(r.frase, 'Em outubro de 2026 saiu o mesmo que em setembro de 2026.');
  assert.deepEqual(r.alta, {nome:'Pets', txt:'nova'});
  assert.deepEqual(r.queda, {nome:'Mercado', txt:'−25%'});
});
test('maiores gastos: ordem, empate pela data mais recente e lista curta', () => {
  const d = (dia) => new Date(2026, 9, dia);
  const L = [{data:d(1), desc:'a', valor:50}, {data:d(5), desc:'b', valor:200}, {data:d(9), desc:'c', valor:50}, {data:d(3), desc:'e', valor:120}];
  assert.deepEqual(Analise.maioresGastos(L, 3).map(x => x.desc), ['b', 'e', 'c']);
  assert.equal(Analise.maioresGastos(L.slice(0, 2), 3).length, 2);
});
test('fatias: somam 100, negativos de fora, Outros por último', () => {
  const f = Analise.fatias([{nome:'A', pct:.333}, {nome:'B', pct:.333}, {nome:'Outros', pct:.334, outros:true}, {nome:'N', pct:-.1, negativo:true}]);
  assert.equal(f.reduce((s, x) => s + x.pct, 0), 100);
  assert.deepEqual(f.map(x => x.nome), ['A', 'B', 'Outros']);
  assert.equal(f[2].outros, true);
});
test('comparação: categoria com estornos maiores que os gastos fica de fora', () => {
  const r = Analise.comparacao(SET, {name:'outubro de 2026', outs:950, cat:{Mercado:400, Moradia:600, Compras:-50}}, brlT, pctT);
  assert.equal(r.queda, null);
  assert.equal(r.alta, null);
});
test('maiores gastos: um por origem (o maior de cada)', () => {
  const d = (dia) => new Date(2026, 9, dia);
  const L = [{data:d(5), desc:'ALUGUEL', valor:1650, chave:'aluguel'}, {data:d(7), desc:'ALUGUEL', valor:1650, chave:'aluguel'}, {data:d(2), desc:'TV', valor:900, chave:'tv'}, {data:d(3), desc:'PNEUS', valor:700, chave:'pneus'}];
  assert.deepEqual(Analise.maioresGastos(L, 3).map(x => x.desc), ['ALUGUEL', 'TV', 'PNEUS']);
});
test('fatias com n: as n maiores e o resto somado em "Outras categorias", em % do total', () => {
  const L = [{nome:'A', pct:.27}, {nome:'B', pct:.20}, {nome:'C', pct:.14}, {nome:'D', pct:.08}, {nome:'E', pct:.06}, {nome:'F', pct:.15}, {nome:'G', pct:.10}];
  const f = Analise.fatias(L, 5);
  assert.deepEqual(f.map(x => [x.nome, x.pct]), [['A', 27], ['B', 20], ['F', 15], ['C', 14], ['G', 10], ['Outras categorias', 14]]);
  assert.equal(f[5].demais, true);
});

test('fatias: com n, as porcentagens nomeadas são as mesmas da lista completa', () => {
  const L = [{nome:'A', pct:.40}, {nome:'B', pct:.30}, {nome:'C', pct:.20}, {nome:'D', pct:.04}, {nome:'E', pct:.03}, {nome:'F', pct:.015}, {nome:'G', pct:.015}];
  const todas = {}; Analise.fatias(L).forEach(x => { todas[x.nome] = x.pct; });
  assert.equal(Object.values(todas).reduce((s, v) => s + v, 0), 100);
  const f = Analise.fatias(L, 5);
  f.filter(x => !x.demais).forEach(x => assert.equal(x.pct, todas[x.nome], x.nome));
  assert.equal(f.reduce((s, x) => s + x.pct, 0), 100);
});
test('fatias: categoria pequena aparece como "<1%" e nunca "0%"', () => {
  const f = Analise.fatias([{nome:'A', pct:.993}, {nome:'B', pct:.004}, {nome:'C', pct:.003}]);
  assert.deepEqual(f.map(x => x.rotulo), ['99%', '<1%', '<1%']);
  f.forEach(x => assert.ok(x.pct >= 0));
});

test('dias exatos: "por mês" vira média de 30 dias nos números e no veredito', () => {
  const c = ctx({ins: 6000, outs: 3000, nM: 169 / 30, notaMes: 'média de 30 dias', dias: 169, escopo: 'meses'});
  const n = Analise.numeros(c);
  assert.match(n[0].sub, /^em 169 dias · R\$\s[\d.,]+ por mês \(média de 30 dias\)$/);
  assert.match(Analise.veredito(c).texto, /por mês \(média de 30 dias\)/);
});
