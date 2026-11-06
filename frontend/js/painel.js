(function(){
'use strict';



/* sobrou.: telas.
   Os dados (extratos, categorias, regras, páginas, preferências) ficam no
   servidor e chegam pela API (js/api.js). A leitura dos arquivos e a
   categorização automática também são feitas no servidor. */
var OTHER = 'Outros (revisar)';
/* Categorias padrão (uma lista só): preenchido com o que vem de /api/estado. */
var REGRAS_PADRAO = [];
function curRules(){ return REGRAS_PADRAO; }
function bKey(codigo){ return 'padrao:'+codigo; }
function builtinDefs(){
  var ed = state.bEdits || {};
  return curRules().map(function(r){
    var e = ed[bKey(r.codigo)];
    return { id:'b:'+r.codigo, codigo:r.codigo, builtin:true, edited:!!e, interna:!!r.interna,
      name: (e && e.name) || r.nome,
      type: (e && e.type) || (r.fixa ? 'fixo' : 'variavel'),
      kws: (e && e.kws) ? e.kws : r.palavras.map(function(k){ return k.trim(); }),
      raw: (e && e.kws) ? null : r.palavras };
  });
}
function customDefs(){ return (state.custom||[]).map(function(c){ return {id:c.id, builtin:false, name:c.name, type:c.type, kws:c.kws||[]}; }); }
function allDefs(){ return builtinDefs().concat(customDefs()); }
function allCats(){ return allDefs().map(function(d){ return d.name; }).concat([OTHER]); }
/* lista de categorias para um seletor; inclui a escolhida mesmo que ela não exista
   mais (ex.: regra antiga apontando para uma categoria que foi excluída) */
function catsCom(sel){ var l = allCats(); if (sel && l.indexOf(sel)===-1) l.push(sel); return l; }
/* nome atual de uma categoria padrão, pelo código (null se não existir) */
function catByCode(codigo){ var d = builtinDefs().filter(function(x){ return x.codigo===codigo; })[0]; return d ? d.name : null; }
function feesName(){ return catByCode('taxas'); }
function renameCat(orig, name){
  if (orig===name) return;
  state.tx.forEach(function(t){ if (t.auto===orig) t.auto = name; });
  Object.keys(state.rules).forEach(function(k){ if (state.rules[k].cat===orig) state.rules[k].cat = name; });
  Object.keys(state.overrides).forEach(function(k){ if (state.overrides[k]===orig) state.overrides[k] = name; });
  if (state.cat===orig) state.cat = name;
  if (state.fcat===orig) state.fcat = name;
  if (state.dashCats) state.dashCats = state.dashCats.map(function(c){ return c===orig ? name : c; });
}
function parseKws(txt){ return String(txt||'').split(',').map(function(k){ return norm(k).trim(); }).filter(function(k){ return k.length>=2; }); }

var state = { rules: {}, tx: [], overrides: {}, filter: 'out', q: '', source: 'sample', fileName: '', p: {y:'all', m:'all', w:'all'} };
var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function weekStart(d){ var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); x.setDate(x.getDate()-((x.getDay()+6)%7)); return x; }
function weekKey(d){ var w = weekStart(d); return w.getFullYear()+'-'+String(w.getMonth()+1).padStart(2,'0')+'-'+String(w.getDate()).padStart(2,'0'); }
function keyDate(k){ var a = k.split('-'); return new Date(+a[0], +a[1]-1, +a[2], 12); }
function weekLabel(k){ var a = keyDate(k), b = new Date(a); b.setDate(b.getDate()+6); return shortDate(a)+' a '+shortDate(b); }
function inP(t, p){
  if (p.w!=='all') return weekKey(t.date)===p.w;
  if (p.y!=='all' && t.date.getFullYear()!==+p.y) return false;
  if (p.m!=='all' && t.date.getMonth()!==+p.m) return false;
  return true;
}
function cur(){ return state.tx.filter(function(t){ return Periodo.contem(t.date, state.p); }); }
/* primeiro e último dia (ISO) com lançamentos no extrato */
function extratoLimites(){
  var a = null, b = null;
  state.tx.forEach(function(t){ var d = Periodo.iso(t.date); if (!a || d<a) a = d; if (!b || d>b) b = d; });
  return {inicio:a, fim:b};
}
/* o extrato cobre o período inteiro? (para não comparar com um período pela metade) */
function cobreInteiro(p){ var L = extratoLimites(); return !!L.inicio && !Periodo.cobertura(p, L.inicio, L.fim).parcial; }
/* chaves 'AAAA-MM' dos meses do extrato, em ordem */
function mesesDoExtrato(){ var k = {}; state.tx.forEach(function(t){ k[Periodo.chaveDe(t.date)] = 1; }); return Object.keys(k).sort(); }
/* escolher um período (atalho, mês, semana, Personalizado): sai da comparação */
function escolherPeriodo(p){ state.p = p; state.cmp = null; render(); }
/* inP e periodName no formato antigo {y,m,w}: só a análise de Vendas usa */
function periodName(p){
  if (p.w!=='all') return 'semana de '+weekLabel(p.w);
  if (p.m!=='all') return MESES[+p.m]+' de '+p.y;
  if (p.y!=='all') return 'ano de '+p.y;
  return 'todo o período';
}

var brl = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
var brl0 = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
var pct = new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});
function $(id){return document.getElementById(id);}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function norm(s){return ' '+String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' ';}
function fmtDate(d){return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}
function shortDate(d){return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');}

/* Entrada = dinheiro que entrou. Estorno, devolução e reembolso têm valor
   positivo, mas contam como saída negativa: descontam da categoria da despesa. */
/* direção do lançamento (entrada de dinheiro ou saída). Para as contas do
   painel use entraNaConta / saiDaConta, que deixam de fora o movimento interno */
function ehEntrada(t){ return t.value>0 && !t.estorno; }
function ehSaida(t){ return !ehEntrada(t); }
function catOf(tx){
  if (state.overrides[tx.id]) return state.overrides[tx.id];
  var r = state.rules && state.rules[tx.origin];
  if (r){
    /* regra de despesa nunca muda uma entrada; regra "Entrada" nunca muda uma despesa */
    if (ehSaida(tx) && r.cat!==ENTRADA) return r.cat;
    if (ehEntrada(tx) && (r.cat===ENTRADA || INTERNOS.indexOf(r.cat)!==-1)) return r.cat;
  }
  return tx.auto;
}
/* movimento interno: dinheiro guardado e transferências entre as contas do cliente.
   Fica fora de Entrou e Saiu (mas entra no saldo acumulado) */
var ENTRADA = 'Entrada', INTERNOS = [];
function ehInterno(t){ var c = catOf(t); return !!c && INTERNOS.indexOf(c)!==-1; }
function entraNaConta(t){ return ehEntrada(t) && !ehInterno(t); }
function saiDaConta(t){ return ehSaida(t) && !ehInterno(t); }
function ruleMsg(t){ var m = $('ruleMsg'); m.textContent = t; m.hidden = false; }
function setRule(origin, label, cat){
  return API.salvarRegra(origin, cat, label).then(function(r){
    state.rules[origin] = { cat:r.categoria, label:r.rotulo, at:r.criada_em };
    state.tx.forEach(function(t){ if (t.origin===origin) delete state.overrides[t.id]; });
    ruleMsg('Regra salva: "'+label+'" agora é sempre '+cat+', neste e nos próximos extratos.');
  });
}
function renderRules(){
  renderPrefNotes();
  var keys = Object.keys(state.rules).sort(function(a,b){ return (state.rules[b].at||'').localeCompare(state.rules[a].at||''); });
  $('rulesEmpty').hidden = keys.length>0;
  $('cntRegras').textContent = keys.length ? keys.length : '';
  $('rulesList').innerHTML = keys.map(function(k){
    var r = state.rules[k];
    var n = state.tx.filter(function(t){return t.origin===k;}).length;
    return '<li class="sv"><div class="svi"><strong>'+esc(r.label)+'</strong>'+
      '<span>Sempre <b>'+esc(r.cat)+'</b> · '+(n ? n+(n===1?' lançamento':' lançamentos')+' neste extrato' : 'nenhum lançamento neste extrato')+(r.at?' · criada em '+fmtDate(new Date(r.at)):'')+'</span></div>'+
      '<div class="sva"><button type="button" class="btn" data-rdel="'+esc(k)+'">Excluir</button></div></li>';
  }).join('');
}

/* ---------- leitura local: usada só pela planilha de vendas (recurso em pausa).
   Extratos bancários são lidos no servidor (/api/leitura). ---------- */
function parseValor(raw){
  if (raw==null) return NaN;
  var s = String(raw).trim();
  if (!s) return NaN;
  var neg = /^\(.*\)$/.test(s) || /-/.test(s) || /\sD$/i.test(s);
  s = s.replace(/[^\d.,]/g,'');
  if (!s) return NaN;
  var c = s.lastIndexOf(','), p = s.lastIndexOf('.');
  if (c>-1 && p>-1){ s = c>p ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,''); }
  else if (c>-1){ s = s.replace(/\./g,'').replace(',','.'); }
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)){ s = s.replace(/\./g,''); }
  var v = parseFloat(s);
  return isNaN(v) ? NaN : (neg ? -Math.abs(v) : v);
}
function parseData(raw){
  var s = String(raw||'').trim(), m;
  if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/))){
    var y = +m[3]; if (y<100) y += 2000;
    return mk(y, +m[2], +m[1]);
  }
  if ((m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/))) return mk(+m[1], +m[2], +m[3]);
  return null;
  function mk(y,mo,d){ if (mo<1||mo>12||d<1||d>31) return null; return new Date(y,mo-1,d,12); }
}
function splitLine(line, d){
  var out=[], cur='', q=false;
  for (var i=0;i<line.length;i++){
    var ch=line[i];
    if (ch==='"'){ if (q && line[i+1]==='"'){cur+='"';i++;} else q=!q; }
    else if (ch===d && !q){ out.push(cur); cur=''; }
    else cur+=ch;
  }
  out.push(cur);
  return out.map(function(x){return x.trim();});
}
/* lançamento como vem da API -> formato usado nas telas */
function doServidor(l){
  return { date:keyDate(l.data), desc:l.descricao, value:l.valor, estorno:!!l.estorno, auto:l.categoria_auto, kw:l.palavra, origin:l.origem, dbId:l.id||null };
}
function load(list, source, name){
  list.sort(function(a,b){return a.date-b.date;});
  state.raw = list; state.savedId = null; state.pastaId = null; state.loaded = true;
  if (typeof esquecerCriacao==='function' && CRIAR_PARA) esquecerCriacao();
  $('dAvisoPasta').hidden = true;
  $('dAvisoLeitura').hidden = true; state.fcat = 'all'; state.filter = 'out'; state.q = '';
  state.editLanc = false; state.txPor = 10; state.dashCats = null; state.dashDet = false; state.dashTodas = false;
  $('q').value = ''; document.querySelectorAll('.table-tools .seg button').forEach(function(x){ x.setAttribute('aria-pressed', x.dataset.f==='out' ? 'true':'false'); });
  refreshTabs();
  state.tx = list.map(function(t,i){
    return {id:i, dbId:t.dbId||null, date:t.date, desc:t.desc, value:t.value, estorno:!!t.estorno, auto:t.auto||null, kw:t.kw||null, origin:t.origin};
  });
  state.overrides = {}; state.source = source; state.fileName = name||''; state.cat = null; state.p = {tipo:'tudo'}; state.cmp = null;
  refreshFixed();
  render();
}
function readText(f, enc){
  return new Promise(function(ok, fail){
    var r = new FileReader();
    r.onload = function(){ ok(r.result); };
    r.onerror = function(){ fail(new Error('Não consegui abrir o arquivo. Tente exportar de novo pelo site do banco.')); };
    r.readAsText(f, enc);
  });
}
function xlsxToCsv(f){
  return f.arrayBuffer().then(function(buf){
    if (!window.XLSX) throw new Error('Não consegui carregar o leitor de Excel. Confira a conexão e tente de novo, ou salve como CSV.');
    var wb = XLSX.read(buf, {type:'array'});
    var first = null, parts = [];
    wb.SheetNames.forEach(function(n){
      var csv = XLSX.utils.sheet_to_csv(wb.Sheets[n], {FS:';', blankrows:false}).replace(/\s+$/,'');
      if (!csv.trim()) return;
      var lines = csv.split(/\r?\n/);
      if (first === null){ first = lines[0]; parts.push(csv); }
      else parts.push(lines[0]===first ? lines.slice(1).join('\n') : csv);
    });
    if (!parts.length) throw new Error('A planilha Excel está vazia.');
    return parts.join('\n');
  });
}
function readFiles(files){
  files = Array.prototype.slice.call(files);
  if (!files.length) return;
  $('msg').hidden = true;
  state.leitura = null;   /* um envio novo anula caixinhas de senha pendentes do anterior */
  var envio = state.envioId = (state.envioId || 0) + 1;
  state.envioEscolha = state.escolhaManual || 0;   /* se a pessoa abrir outro extrato no meio, ela manda */
  estadoEnvio('lendo', {n: files.length});
  API.lerArquivos(files).then(function(resp){
    if (envio !== state.envioId) return;   /* outro envio começou depois deste */
    state.leitura = { envio: envio, itens: resp.arquivos.map(function(r, i){ return { file: files[i], r: r }; }) };
    seguirLeitura();
  }).catch(function(e){ if (envio !== state.envioId) return; estadoEnvio('normal'); showMsg(e.message, true); });
}
/* estado da área de envio: 'normal', 'lendo' (esperando o servidor), 'senha'
   (falta a senha de um PDF) ou 'erro' (nenhum arquivo pôde ser lido) */
function estadoEnvio(qual, dados){
  var d = $('drop'), n = dados && dados.n || 1;
  d.classList.toggle('lendo', qual!=='normal');
  $('upLendo').hidden = qual==='normal';
  $('upErro').hidden = qual!=='erro';
  $('upLendoT').textContent = qual==='lendo' ? (n===1 ? 'Lendo 1 arquivo…' : 'Lendo '+n+' arquivos…')
    : qual==='senha' ? (n===1 ? 'Falta a senha de um arquivo' : 'Falta a senha de '+n+' arquivos')
    : qual==='erro' ? 'Não foi possível ler o extrato' : '';
  $('upConta').parentNode.hidden = true;   /* o número só aparece quando a leitura chega */
  d.querySelector('.up-bar').hidden = qual==='erro';
  var barra = d.querySelector('.up-bar');
  barra.classList.toggle('indet', qual==='lendo' || qual==='senha');   /* esperando: o brilho corre, sem fingir porcentagem */
  if (qual==='lendo'){ $('upFiles').innerHTML = ''; $('upConta').textContent = '0'; $('upOk').textContent = ''; $('upOk').className = 'up-ok'; $('upBar').style.width = ''; }
  $('viewEnviar').classList.remove('saindo');   /* o Início nunca fica invisível */
  if (qual==='normal') $('upFiles').innerHTML = '';
}
/* número que sobe contando até o total, desacelerando no fim */
function contarAte(el, total, ms, vivo){
  var fmt = function(n){ return n.toLocaleString('pt-BR'); };
  vivo = vivo || function(){ return true; };
  if (semMovimento() || !window.requestAnimationFrame){ if (vivo()) el.textContent = fmt(total); return Promise.resolve(); }
  return new Promise(function(ok){
    var ini = null;
    var passo = function(t){
      if (!vivo()){ ok(); return; }   /* outro envio começou: para de escrever */
      if (ini===null) ini = t;
      var p = Math.min(1, (t-ini)/ms);
      el.textContent = fmt(Math.round(total*(1-Math.pow(1-p, 3))));
      if (p<1) requestAnimationFrame(passo); else ok();
    };
    requestAnimationFrame(passo);
  });
}
/* a leitura chegou: completa a barra, conta os lançamentos e mostra o selo.
   vivo() diz se este ainda é o envio atual; um envio antigo não escreve na caixa do novo */
function concluirProgresso(total, selo, vivo){
  var barra = $('drop').querySelector('.up-bar'), ok = $('upOk');
  if (!vivo()) return Promise.resolve();
  barra.classList.remove('indet');
  $('upBar').style.width = '100%';
  $('upConta').parentNode.hidden = false;
  ok.textContent = selo.texto;
  ok.className = 'up-ok'+(selo.aviso ? ' aviso' : '');
  var espera = function(ms){ return new Promise(function(r){ setTimeout(r, semMovimento() ? 0 : ms); }); };
  return espera(400).then(function(){ return contarAte($('upConta'), total, 600, vivo); })
    .then(function(){ if (vivo()) ok.classList.add('mostra'); return espera(500); });
}
/* o Início sai para a esquerda e o Dashboard entra pela direita (só depois de um envio).
   Só translate e opacity: os gráficos do Dashboard medem a largura real dos cartões */
function passarParaDashboard(){
  if (semMovimento()){ irPara('dashboard'); return Promise.resolve(); }
  var vi = $('viewEnviar'), vd = $('viewDash');
  vi.classList.add('saindo');
  return new Promise(function(ok){
    setTimeout(function(){
      irPara('dashboard');
      vd.classList.remove('entrando'); void vd.offsetWidth; vd.classList.add('entrando');
      setTimeout(function(){ vd.classList.remove('entrando'); ok(); }, 350);
    }, 250);
  });
}
/* ---------- movimentos do Início ----------
   Todos respeitam o "reduzir movimento" do aparelho: nesse caso o estado
   final aparece na hora. */
var REDUZIR = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
function semMovimento(){ return REDUZIR.matches; }
/* cascata ao entrar no Início: só na chegada, não a cada redesenho da lista */
var entradaTimer = null;
function animarEntrada(){
  if (semMovimento()) return;
  var v = $('viewEnviar');
  v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra');
  clearTimeout(entradaTimer);
  entradaTimer = setTimeout(function(){ v.classList.remove('entra'); }, 1300);
}
/* a marcação dourada das etiquetas de pasta desliza até a escolhida */
function posicionarPilula(animar){
  var w = document.querySelector('.chips-wrap'), p = $('ptabPill');
  var on = $('pagesBar').querySelector('[aria-selected="true"]');
  if (!w || !on || !on.offsetWidth){ if (w) w.classList.remove('com-pilula'); return; }
  w.classList.toggle('sem-trans', !animar || !w.classList.contains('com-pilula'));
  p.style.left = on.offsetLeft+'px'; p.style.top = on.offsetTop+'px';
  p.style.width = on.offsetWidth+'px'; p.style.height = on.offsetHeight+'px';
  w.classList.add('com-pilula');
}
window.addEventListener('resize', function(){ posicionarPilula(false); });
function trocarPasta(novo){
  var lista = $('savedList');
  var comFoco = $('pagesBar').contains(document.activeElement);
  clearTimeout(trocaTimer);
  var aplicar = function(){
    keepScroll(function(){ state.page = novo; state.editingPage = null; renderSaved(); });
    lista.classList.remove('trocando');
    /* as etiquetas são redesenhadas: o foco volta para a escolhida */
    if (comFoco){ var b = $('pagesBar').querySelector('[data-page="'+(novo===null ? 'all' : novo)+'"]'); if (b) b.focus({preventScroll:true}); }
  };
  if (semMovimento()){ aplicar(); return; }
  $('pagesBar').querySelectorAll('[role=tab]').forEach(function(b){ b.setAttribute('aria-selected', b.dataset.page===(novo===null ? 'all' : novo) ? 'true' : 'false'); });
  posicionarPilula(true);
  lista.classList.add('trocando');
  trocaTimer = setTimeout(aplicar, 120);
}
var trocaTimer = null;
/* setas, Home e End trocam de etiqueta (padrão de abas) */
$('pagesBar').addEventListener('keydown', function(e){
  if (MODE==='vendas') return;
  var tabs = Array.prototype.slice.call($('pagesBar').querySelectorAll('[role=tab]'));
  var i = tabs.indexOf(document.activeElement); if (i===-1) return;
  var j = e.key==='ArrowRight' ? (i+1)%tabs.length : e.key==='ArrowLeft' ? (i-1+tabs.length)%tabs.length
    : e.key==='Home' ? 0 : e.key==='End' ? tabs.length-1 : -1;
  if (j===-1) return;
  e.preventDefault();
  tabs[j].focus();
  trocarPasta(tabs[j].dataset.page==='all' ? null : tabs[j].dataset.page);
});
/* extrato excluído: a linha encolhe e some antes de a lista ser redesenhada */
function sumirLinha(id){
  var li = document.querySelector('#savedList [data-sv="'+(window.CSS && CSS.escape ? CSS.escape(id) : id)+'"]');
  if (!li || semMovimento()) return Promise.resolve();
  li.style.maxHeight = li.offsetHeight+'px';
  li.classList.add('sv-saindo');
  return new Promise(function(ok){ setTimeout(ok, 300); });
}
/* depois do envio: abre o extrato (abrir devolve uma promessa) e vai para o Dashboard */
function abrirDepoisDoEnvio(abrir, envio, total, selo){
  var vivo = function(){ return envio === state.envioId; };
  if (!vivo()) return Promise.resolve();
  /* abre o extrato só depois da contagem e só se ninguém enviou outro no meio:
     assim um envio antigo nunca troca o extrato que está na tela */
  return concluirProgresso(total, selo, vivo).then(function(){
    if (!vivo()) return;
    if ((state.escolhaManual || 0) !== state.envioEscolha){ estadoEnvio('normal'); return 'outro'; }
    return abrir().then(function(){
      if (!vivo()) return;
      return passarParaDashboard().then(function(){ if (vivo()) estadoEnvio('normal'); });
    });
  });
}
/* PDFs com senha: cada um ganha uma caixinha na lista de arquivos. A leitura
   só conclui quando não sobra nenhum pendente (senha informada ou pulado).
   A senha vai só no reenvio daquele arquivo e não é guardada. */
function seguirLeitura(){
  var L = state.leitura; if (!L) return;
  var pendentes = L.itens.filter(function(it){ return it.r.codigo; });
  if (pendentes.length){
    $('msg').hidden = true;
    estadoEnvio('senha', {n: pendentes.length});
    $('upFiles').innerHTML = L.itens.map(function(it, i){ return linhaArquivo(it.r, i); }).join('');
    var campo = $('upFiles').querySelector('.pdf-senha input'); if (campo) campo.focus();
    return;
  }
  state.leitura = null;
  if (!L.itens.length){ estadoEnvio('normal'); showMsg('Você pulou todos os arquivos. Nada foi lido.', false); return; }
  concluirLeitura(L.itens.map(function(it){ return it.r; }), L.envio);
}
function linhaArquivo(r, i){
  var html = '<li class="'+(r.erro?'bad':'')+'"><span class="fn">'+esc(r.nome)+'</span><span class="fc">'+
    (r.erro ? esc(r.erro) : r.lancamentos.length+' lançamentos'+(r.aviso ? ' · ⚠ '+esc(r.aviso) : ''))+'</span>';
  if (r.codigo) html += '<form class="pdf-senha" data-i="'+i+'" novalidate><label class="sr-only" for="pdfSenha'+i+'">Senha do PDF</label>'+
    '<input type="password" id="pdfSenha'+i+'" autocomplete="off" placeholder="Senha do PDF">'+
    '<button type="submit" class="btn btn-sm primary">Abrir</button><button type="button" class="btn btn-sm ghost" data-pular="'+i+'">Pular este arquivo</button></form>';
  return html + '</li>';
}
$('upFiles').addEventListener('submit', function(e){
  var f = e.target.closest('.pdf-senha'); if (!f) return;
  e.preventDefault();
  var L = state.leitura, it = L && L.itens[+f.dataset.i];
  var senha = f.querySelector('input').value;
  if (!it) return;
  if (!senha){ f.querySelector('input').focus(); return; }
  f.querySelector('button[type=submit]').disabled = true;
  API.lerArquivos([it.file], senha).then(function(resp){
    if (state.leitura !== L) return;   /* outro envio começou enquanto a senha ia ao servidor */
    it.r = resp.arquivos[0];
    seguirLeitura();
  }).catch(function(err){ if (state.leitura !== L) return; f.querySelector('button[type=submit]').disabled = false; showMsg(err.message, true); });
});
$('upFiles').addEventListener('click', function(e){
  var b = e.target.closest('[data-pular]'); if (!b || !state.leitura) return;
  state.leitura.itens.splice(+b.dataset.pular, 1);
  seguirLeitura();
});
function concluirLeitura(results, envio){
  var good = results.filter(function(r){return !r.erro;});
  /* lançamentos iguais são contados por arquivo: dois cafés de R$ 5 no mesmo
     dia ficam os dois; o mesmo período enviado em dois arquivos não duplica */
  var combined = [], seen = {}, dup = 0;
  good.forEach(function(r){
    var noArquivo = {};
    r.lancamentos.forEach(function(l){
      var k = l.data+'|'+l.descricao+'|'+l.valor;
      noArquivo[k] = (noArquivo[k] || 0) + 1;
      if (noArquivo[k] <= (seen[k] || 0)){ dup++; return; }
      seen[k] = noArquivo[k]; combined.push(l);
    });
  });
  $('upFiles').innerHTML = results.map(function(r){ return linhaArquivo(r); }).join('');
  if (!good.length){ estadoEnvio('erro'); $('upFiles').innerHTML = results.map(function(r){ return linhaArquivo(r); }).join(''); return; }
  var nome = good.map(function(r){return r.nome;}).join(', ');
  var avisosL = good.filter(function(r){ return r.aviso; }).map(function(r){ return {nome:r.nome, aviso:r.aviso}; });
  /* um arquivo: só o aviso; vários: o nome de cada arquivo junto (guardado com o extrato) */
  var textoAv = avisosL.length===1 && good.length===1 ? avisosL[0].aviso
    : avisosL.map(function(a){ return a.nome+': '+a.aviso; }).join(' ') || null;
  var total = combined.length;
  var soVer = function(){ load(combined.map(doServidor), 'file', nome); if (textoAv) mostrarAvisoLeitura([{nome:nome, aviso:textoAv}]); return Promise.resolve(); };
  var repetidos = dup ? ' ('+dup+(dup===1 ? ' repetido ignorado' : ' repetidos ignorados')+')' : '';
  var selo = Pastas.seloLeitura(good.map(function(r){ return {nome:r.nome, aviso:r.aviso}; }));
  var atual = function(){ return envio === state.envioId; };
  /* salvar (padrão): guarda na pasta escolhida, abre o extrato salvo e vai para o Dashboard */
  if (!$('soVer').checked){
    API.salvarExtrato({ tipo:'despesas', nome:nome.slice(0,120), pagina_id:Pastas.destino(state.page, getPages()), lancamentos:combined, aviso:textoAv })
      .then(function(meta){
        state.novoId = meta.id;
        if (!atual()) return recarregarSalvos();   /* outro envio começou: este só entra na lista */
        return recarregarSalvos().then(function(){
          return abrirDepoisDoEnvio(function(){ lembrarAberto('extrato', meta.id); return carregarSalvo(meta.id); }, envio, total, selo);
        }).then(function(como){
          if (atual()) toast('Extrato salvo: '+total+' lançamentos'+repetidos+'.'+(como==='outro' ? ' Ele está na lista.' : ''));
        }, function(){
          if (atual()){ estadoEnvio('normal'); toast('Extrato salvo, mas não foi possível abrir agora. Ele está na lista.'); }
        });
      }, function(e){
        if (!atual()) return;
        return abrirDepoisDoEnvio(soVer, envio, total, selo).then(function(como){
          if (!atual()) return;
          toast(como==='outro' ? 'Não foi possível salvar o extrato ('+e.message+') e ele não foi aberto, porque você abriu outro. Envie de novo para ver.'
            : 'Não foi possível salvar o extrato ('+e.message+'). Você está vendo sem salvar: ele não vai aparecer na lista.');
        });
      }).catch(function(e){ if (atual()) estadoEnvio('normal'); falhou(e); });
    return;
  }
  abrirDepoisDoEnvio(soVer, envio, total, selo).then(function(como){
    if (como==='outro' && atual()){ toast('O extrato enviado não foi aberto, porque você abriu outro. Como estava em "Só ver agora", ele não foi guardado: envie de novo para ver.'); return; }
    if (dup && atual()) toast(dup+(dup===1 ? ' lançamento repetido foi ignorado.' : ' lançamentos repetidos foram ignorados.'));
  }).catch(function(e){ if (atual()) estadoEnvio('normal'); falhou(e); });
}
function showMsg(t, err){ var m=$('msg'); m.textContent=t; m.className='msg'+(err?' error':''); m.hidden=false; }

/* ---------- rendering ---------- */
function sums(list){
  var ins = 0, outs = 0;
  list.forEach(function(t){ if (entraNaConta(t)) ins += t.value; else if (saiDaConta(t)) outs -= t.value; });
  return Analise.ajustarEstornos({ins:ins, outs:outs});
}
function deltaTxt(now, before, label){
  if (!before) return '';
  var d = (now-before)/before;
  return ' · <span class="delta">'+(d>=0?'+':'')+pct.format(d)+'</span> vs. '+label;
}
/* ---------- extratos salvos (no servidor) ----------
   As listas ficam guardadas aqui (cache) para as telas serem desenhadas na hora;
   recarregarSalvos() busca de novo no servidor depois de cada mudança. */
var savedCache = {despesas:[], vendas:[]}, pagesCache = {despesas:[], vendas:[]};
function falhou(e){ toast(e && e.message ? e.message : 'Não foi possível falar com o servidor.'); }
function metaLocal(m){
  return { id:m.id, name:m.nome, page:m.pagina_id, aviso:m.aviso||null, savedAt:m.salvo_em, n:m.quantidade, first:m.inicio, last:m.fim };
}
function getSaved(){ return savedCache[kindNow()] || []; }
function getPages(){ return pagesCache[kindNow()] || []; }
function recarregarSalvos(){
  var k = kindNow();
  return Promise.all([API.listarExtratos(k), API.listarPaginas(k)]).then(function(r){
    savedCache[k] = r[0].map(metaLocal);
    pagesCache[k] = r[1].map(function(p){ return {id:p.id, name:p.nome, at:p.criado_em}; });
    var primeira = !state.salvosProntos;
    state.salvosProntos = true;
    renderSaved();
    if (primeira && !$('viewEnviar').hidden) animarEntrada();
    if (primeira) reabrirUltimo();
  });
}
function isoD(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function pageName(id){ var p = getPages().filter(function(x){ return x.id===id; })[0]; return p ? p.name : null; }
function pageNameTaken(name, exceptId){ return getPages().some(function(p){ return p.id!==exceptId && norm(p.name)===norm(name); }); }

/* correções "só neste extrato": mandadas ao servidor quando mudam */
var lastOv = null;
function mapaCorrecoes(){
  var map = {};
  Object.keys(state.overrides).forEach(function(i){ var t = state.tx[+i]; if (t && t.dbId) map[t.dbId] = state.overrides[i]; });
  return map;
}
function persistOverrides(){
  if (MODE==='vendas' || (!state.savedId && !state.pastaId)) return;
  var map = mapaCorrecoes(), s = JSON.stringify(map);
  if (s===lastOv) return;
  lastOv = s;
  (state.pastaId ? API.salvarCorrecoesPasta(state.pastaId, map) : API.salvarCorrecoes(state.savedId, map)).catch(falhou);
}
/* as correções que vieram do servidor ({id no banco: categoria}) viram state.overrides */
function aplicarCorrecoes(correcoes){
  var porDb = {};
  state.tx.forEach(function(t){ if (t.dbId) porDb[t.dbId] = t.id; });
  state.overrides = {};
  Object.keys(correcoes || {}).forEach(function(dbId){ if (porDb[dbId]!==undefined) state.overrides[porDb[dbId]] = correcoes[dbId]; });
  lastOv = JSON.stringify(mapaCorrecoes());
}
/* busca o extrato salvo no servidor e mostra nas telas */
function carregarSalvo(id, ainda){
  return API.abrirExtrato(id).then(function(x){
    if (ainda && !ainda()) return;   /* a pessoa escolheu outra coisa enquanto carregava */
    load(x.lancamentos.map(doServidor), 'file', x.nome);
    state.savedId = id;
    aplicarCorrecoes(x.correcoes);
    if (x.aviso) mostrarAvisoLeitura([{nome:x.nome, aviso:x.aviso}]);
    render(); renderSaved();
  });
}
/* busca a pasta inteira (os extratos dela somados, sem os repetidos) e mostra nas telas */
function carregarPasta(id, ainda){
  return API.abrirPasta(id).then(function(x){
    if (ainda && !ainda()) return;
    load(x.lancamentos.map(doServidor), 'file', x.nome);
    state.pastaId = id;
    aplicarCorrecoes(x.correcoes);
    var aviso = Pastas.avisoRepetidos(x.repetidos);
    $('dAvisoPasta').textContent = aviso || '';
    $('dAvisoPasta').hidden = !aviso;
    mostrarAvisoLeitura(x.avisos || []);
    render(); renderSaved();
  });
}
/* aviso da conferência da leitura (ex.: PDF lido pelo formato geral), em cima do painel */
function mostrarAvisoLeitura(avisos){
  var t = Pastas.textoAvisos(avisos);
  $('dAvisoLeitura').textContent = t || '';
  $('dAvisoLeitura').hidden = !t;
}
function lembrarAberto(tipo, id){ cfg.ultimoAberto = {tipo:tipo, id:id}; saveCfg(); }
/* a pasta aberta mudou (extrato saiu, entrou ou foi excluído; pasta renomeada ou
   excluída): recarrega os totais para o resumo e o painel não mostrarem números velhos */
function atualizarPastaAberta(){
  if (!state.pastaId) return Promise.resolve();
  var pg = getPages().filter(function(p){ return p.id===state.pastaId; })[0];
  if (!pg){ fecharExtrato(); return Promise.resolve(); }
  return carregarPasta(state.pastaId).catch(falhou);
}
function escolheuAbrir(){ state.escolhaManual = (state.escolhaManual || 0) + 1; }
function openPasta(id){
  lembrarAberto('pasta', id); escolheuAbrir();
  carregarPasta(id).then(function(){
    irPara('dashboard');
  }).catch(falhou);
}
function openSaved(id){
  if (MODE==='vendas'){ openSavedSales(id); return; }
  lembrarAberto('extrato', id); escolheuAbrir();
  carregarSalvo(id).then(function(){
    irPara('dashboard');
  }).catch(falhou);
}
function saveCurrentSales(name, pg){
  return API.salvarExtrato({ tipo:'vendas', nome:name, pagina_id:pg||null,
    linhas: sales.map(function(r){ return [isoD(r.date), r.hour, r.prod, r.cat, r.qty, r.unit, r.total, r.pay]; }) })
    .then(function(meta){ return recarregarSalvos().then(function(){ return meta.id; }); });
}
function openSavedSales(id){
  API.abrirExtrato(id).then(function(x){
    sales = (x.linhas||[]).map(function(r){ return {date:keyDate(r[0]), hour:r[1], prod:r[2], cat:r[3], qty:r[4], unit:r[5], total:r[6], pay:r[7]}; });
    salesFile = x.nome || 'Planilha'; salesP = {y:'all', m:'all', w:'all'};
    state.savedId = id;
    renderSales(); renderSaved(); refreshTabs();
    irPara('dashboard');
  }).catch(falhou);
}
var ICON_GEAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path></svg>';
var ICON_PEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
var ICON_FOLDER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M12 11v5M9.5 13.5 12 16l2.5-2.5"></path></svg>';
var ICON_TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"></path></svg>';
var ICON_FOLDER_S ='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>';
/* Extratos: pastas livres, todas no mesmo nível, criadas pelo cliente.
   state.page = null (Todos), 'none' (Sem pasta) ou o id da pasta escolhida.
   Sem extrato salvo, o Início mostra a área grande de envio e o passo a passo;
   com extratos, a faixa de envio, as etiquetas de pasta e a lista.
   Vendas (em pausa) continua com a lista simples de páginas. */
function renderSaved(){
  var desp = MODE!=='vendas';
  var todos = getSaved(), pages = getPages(), a = todos;
  var PG = desp ? 'pasta' : 'página';
  $('svTitle').textContent = desp ? 'Extratos salvos' : 'Planilhas de vendas salvas';
  var naRaiz = function(x){ return !x.page || !pages.some(function(p){ return p.id===x.page; }); };
  var cnt = function(pid){ return a.filter(function(x){ return pid==='none' ? naRaiz(x) : x.page===pid; }).length; };
  var tab = function(id, label, n, on){ return '<button type="button" role="tab" class="ptab" data-page="'+esc(id)+'" aria-selected="'+on+'" tabindex="'+(on ? 0 : -1)+'">'+(id==='all'||id==='none'?'':ICON_FOLDER_S)+'<span class="pn">'+esc(label)+'</span><span class="cnt">'+n+'</span></button>'; };
  var cur, shown;
  if (desp){
    state.page = Pastas.atualValida(state.page, pages, todos);
    cur = state.page;
    $('newPageBtn').textContent = '+ Nova pasta';
    var grande = !!state.salvosProntos && !todos.length;
    var ini = $('inicioDesp');
    ini.classList.toggle('grande', grande); ini.classList.toggle('faixa', !grande);
    $('drop').classList.toggle('drop-big', grande); $('drop').classList.toggle('drop-faixa', !grande);
    if (grande && !state.eraGrande) $('ajuda').open = true;   /* só ao entrar na primeira visita: depois a pessoa decide */
    else if (state.eraGrande) $('ajuda').open = false;   /* acabou de sair da primeira visita */
    state.eraGrande = grande;
    sincronizarPilulas();
    $('upTitle').textContent = !state.salvosProntos ? 'Início' : grande ? 'Comece pelo seu extrato' : 'Seus extratos';
    /* até a lista chegar do servidor, nada aparece (para não piscar a primeira visita) */
    $('panelSalvos').hidden = !state.salvosProntos || grande;
    ini.style.visibility = state.salvosProntos ? '' : 'hidden';
    var dest = Pastas.destino(cur, pages);
    $('dropDestino').innerHTML = dest ? ' · vai para a pasta <b>'+esc(pageName(dest))+'</b>' : '';
    $('pagesBar').innerHTML = Pastas.etiquetas(pages, todos, cur).map(function(e){ return tab(e.id, e.nome, e.n, e.marcada); }).join('');
    var sug = Pastas.sugerir(pages.map(function(p){ return p.name; }), cfg.sugestaoPastas==='dispensada');
    $('pastaSug').hidden = !sug.length;
    $('pastaSug').innerHTML = sug.length ? '<p>Tem empresa ou MEI? Crie as pastas Pessoal e Empresa com um toque.</p>'+
      '<div class="inline-row"><button type="button" class="btn btn-sm primary" data-sug="1">Criar '+(sug.length>1 ? 'as pastas' : 'a pasta '+esc(sug[0]))+'</button>'+
      '<button type="button" class="btn btn-sm ghost" data-sugno="1">Agora não</button></div>' : '';
    shown = Pastas.filtrar(todos, pages, cur);
    desenharLembrete(grande ? [] : shown);
    /* busca: só a partir de 10 extratos; vale dentro da etiqueta escolhida */
    var comBusca = todos.length>=10;
    $('svBusca').hidden = !comBusca;
    if (!comBusca) state.busca = '';
    if (comBusca && $('svBusca').value!==(state.busca||'')) $('svBusca').value = state.busca||'';
    shown = Pastas.buscar(shown, state.busca);
  } else {
    if (state.page && state.page!=='none' && !pages.some(function(p){ return p.id===state.page; })) state.page = null;
    cur = state.page || null;
    $('panelSalvos').hidden = false;
    $('pastaSug').hidden = true;
    $('newPageBtn').textContent = '+ Nova página';
    $('pagesBar').innerHTML = tab('all','Todos',a.length,!cur) + pages.map(function(p){ return tab(p.id, p.name, cnt(p.id), cur===p.id); }).join('') + (pages.length ? tab('none','Sem página',cnt('none'),cur==='none') : '');
    shown = a.filter(function(x){ if (!cur) return true; return cur==='none' ? naRaiz(x) : x.page===cur; });
  }

  var ph = $('pageHead');
  if (cur && cur!=='none'){
    var pg = pages.filter(function(p){ return p.id===cur; })[0];
    ph.hidden = false;
    ph.innerHTML = state.editingPage===cur
      ? '<form class="inline-form" id="renPageForm" novalidate><label for="renPageName">Novo nome da '+PG+'</label><div class="inline-row"><input id="renPageName" maxlength="40" autocomplete="off" value="'+esc(pg.name)+'"><button type="submit" class="btn primary">Salvar nome</button><button type="button" class="btn ghost" data-pcancel="1">Cancelar</button></div><p class="form-err" id="renPageErr" role="alert" hidden></p></form>'
      : '<span class="ph-name">'+(desp ? 'Pasta ' : 'Página ')+'<b>'+esc(pg.name)+'</b></span><span class="sva">'+
        (desp && cnt(cur) ? '<button type="button" class="btn primary" data-pver="1">Ver a pasta inteira</button>' : '')+
        '<button type="button" class="btn" data-pren="1">Renomear '+PG+'</button><button type="button" class="btn" data-pdel="1">Excluir '+PG+'</button></span>';
  } else { ph.hidden = true; ph.innerHTML = ''; }

  $('savedEmpty').hidden = shown.length>0;
  $('savedEmpty').textContent = desp
    ? (state.busca && String(state.busca).trim() ? 'Nenhum extrato com "'+String(state.busca).trim()+'".' : cur && cur!=='none' ? 'Esta pasta ainda não tem extratos.' : 'Nenhum extrato aqui.')
    : (a.length ? 'Nenhuma planilha nesta página. Use "Mover para" no menu de uma planilha para colocá-la aqui.'
                : 'Nenhuma planilha salva ainda. Envie uma planilha com a opção "Salvar para acessar depois" marcada e ela aparece aqui.');
  var raizLabel = desp ? 'Sem pasta' : 'Sem página';
  var popts = function(sel){ return '<option value=""'+(!sel?' selected':'')+'>'+esc(raizLabel)+'</option>'+pages.map(function(p){ return '<option value="'+esc(p.id)+'"'+(p.id===sel?' selected':'')+'>'+esc(p.name)+'</option>'; }).join(''); };
  $('savedList').innerHTML = shown.map(function(x){
    var f = x.first ? keyDate(x.first) : null, l = x.last ? keyDate(x.last) : null;
    var pn = x.page ? pageName(x.page) : null;
    var moveBlock = state.movingSaved===x.id
      ? '<form class="inline-form move-form" data-id="'+esc(x.id)+'" novalidate><label for="mvX">Mover para</label><div class="inline-row"><select id="mvX">'+popts(pn ? x.page : '')+'</select><button type="submit" class="btn primary">Mover</button><button type="button" class="btn ghost" data-mcancel="1">Cancelar</button></div></form>' : '';
    var open = state.menuFor===x.id;
    var menu = open ? '<div class="menu" role="menu" aria-label="Opções do extrato">'+
        '<button type="button" role="menuitem" data-xren="'+esc(x.id)+'">'+ICON_PEN+'Renomear</button>'+
        '<button type="button" role="menuitem" data-xmove="'+esc(x.id)+'"'+(pages.length?'':' disabled')+'>'+ICON_FOLDER+'Mover para outra '+PG+(pages.length?'':'<small>Crie uma '+PG+' primeiro</small>')+'</button>'+
        '<button type="button" role="menuitem" class="danger-item" data-del="'+esc(x.id)+'">'+ICON_TRASH+'Excluir</button>'+
      '</div>' : '';
    var nameBlock = state.editingSaved===x.id
      ? '<form class="inline-form ren-x" data-id="'+esc(x.id)+'" novalidate><label for="renX">Nome do extrato</label><div class="inline-row"><input id="renX" maxlength="80" autocomplete="off" value="'+esc(x.name||'')+'"><button type="submit" class="btn primary">Salvar nome</button><button type="button" class="btn ghost" data-xcancel="1">Cancelar</button></div><p class="form-err" id="renXErr" role="alert" hidden></p></form>'
      : '<strong>'+esc(x.name||'Extrato')+'</strong>'+(x.aviso ? ' <span class="why estorno" data-tip="'+esc(x.aviso)+'">⚠ Confira</span>' : '');
    var naPasta = pn && !cur ? (desp ? ' · <span class="pasta-nome">Pasta '+esc(pn)+'</span>' : ' · página '+esc(pn)) : '';
    var arrasta = desp && state.editingSaved!==x.id && state.movingSaved!==x.id;
    return '<li class="sv'+(desp && x.id===state.novoId ? ' sv-novo' : '')+'" data-sv="'+esc(x.id)+'"'+(arrasta ? ' draggable="true"' : '')+'><div class="svi">'+
      (arrasta ? '<span class="sv-alca" title="Arraste para uma pasta" aria-hidden="true">⠿</span>' : '')+nameBlock+
      '<span>'+(f?fmtDate(f)+' a '+fmtDate(l)+' · ':'')+x.n+' '+(desp?'lançamentos':'vendas')+' · '+(desp?'enviado em ':'salvo em ')+fmtDate(new Date(x.savedAt))+naPasta+'</span>'+
      (x.id===state.savedId?'<span class="open-now">Aberto agora</span>':'')+moveBlock+'</div>'+
      '<div class="sva sva-x"><button type="button" class="btn primary" data-open="'+esc(x.id)+'">Abrir</button>'+
      '<div class="menu-wrap"><button type="button" class="btn icon-btn" data-menu="'+esc(x.id)+'" aria-haspopup="menu" aria-expanded="'+open+'" aria-label="Configurações do extrato '+esc(x.name||'')+'">'+ICON_GEAR+'</button>'+menu+'</div>'+
      '</div></li>';
  }).join('');

  posicionarMenu();
  posicionarPilula(false);
  desenharResumo();
  if (desp) return;
  var ssp = $('sSavePage'), keep2 = ssp.value;
  ssp.innerHTML = popts(null);
  if (keep2 && pages.some(function(p){ return p.id===keep2; })) ssp.value = keep2;
  else if (cur && cur!=='none') ssp.value = cur;
  ssp.parentNode.hidden = !pages.length;
}
/* o menu de um extrato salvo flutua sobre a página (position:fixed), para não
   fazer a lista rolar; abre para cima quando não cabe embaixo do botão */
function posicionarMenu(){
  var m = document.querySelector('#savedList .menu');
  if (!m) return;
  var b = m.parentNode.querySelector('[data-menu]').getBoundingClientRect();
  m.style.position = 'fixed';
  m.style.right = (document.documentElement.clientWidth - b.right)+'px';
  var h = m.offsetHeight;
  m.style.top = (b.bottom + 6 + h > window.innerHeight && b.top - 6 - h > 0 ? b.top - 6 - h : b.bottom + 6)+'px';
}
window.addEventListener('scroll', posicionarMenu, true);
window.addEventListener('resize', posicionarMenu);
var wrapEl = document.querySelector('.wrap');
function keepScroll(fn){
  var y = window.scrollY || window.pageYOffset || 0;
  if (wrapEl) wrapEl.style.minHeight = '';
  fn();
  var need = y + window.innerHeight;
  var have = document.documentElement.scrollHeight;
  if (wrapEl && have < need) wrapEl.style.minHeight = (wrapEl.offsetHeight + need - have) + 'px';
  window.scrollTo(0, y);
  requestAnimationFrame(function(){ if (Math.abs((window.scrollY||0) - y) > 1) window.scrollTo(0, y); });
}
function mostrarInicio(){
  $('inicioDesp').hidden = MODE!=='despesas';
  $('panelVendas').hidden = MODE!=='vendas';
}

function render(){
  persistOverrides();
  var all = state.tx;
  var tx = cur();
  if (!tx.length){ state.p = {tipo:'tudo'}; state.cmp = null; tx = all; }
  var ins = 0, outs = 0, byCat = {}, biggest = null;
  tx.forEach(function(t){
    if (ehInterno(t)) return;
    if (ehEntrada(t)) ins += t.value;
    else { var a=-t.value; outs += a; var c=catOf(t); byCat[c]=(byCat[c]||0)+a; if(!biggest||a>-biggest.value) biggest=t; }
  });
  var aj = Analise.ajustarEstornos({ins:ins, outs:outs}); ins = aj.ins; outs = aj.outs;
  var res = ins - outs;
  var first = all[0].date, last = all[all.length-1].date;

  var pAnt = Periodo.anterior(state.p), prev = null;
  if (pAnt && cobreInteiro(pAnt)){ var pl = all.filter(function(t){ return Periodo.contem(t.date, pAnt); }); if (pl.length){ prev = sums(pl); prev.label = Periodo.nomeAnterior(state.p); } }

  $('srcBadge').textContent = state.source==='sample' ? 'Exemplo · dados fictícios' : 'Seu extrato';
  $('srcBadge').className = 'badge' + (state.source==='sample' ? '' : ' real');
  var isSample = state.source==='sample';
  /* o título da página é o nome dela (setView); o período e o arquivo ficam na linha de baixo */
  $('srcText').textContent = isSample ? 'Este é um extrato de exemplo, de '+fmtDate(first)+' a '+fmtDate(last)+'. Envie o extrato do seu banco para ver os seus números.'
    : state.pastaId ? 'Pasta "'+state.fileName+'": todos os extratos somados, de '+fmtDate(first)+' a '+fmtDate(last)+'.'
    : 'Extrato de '+fmtDate(first)+' a '+fmtDate(last)+', a partir do arquivo "'+state.fileName+'".';

  renderPeriod(tx);

  var cats = Object.keys(byCat).map(function(k){return {name:k, v:byCat[k]};}).sort(function(a,b){
    if (a.name===OTHER) return 1; if (b.name===OTHER) return -1; return b.v-a.v; });
  var top = cats.filter(function(c){return c.name!==OTHER;})[0] || cats[0];
  if (!state.cat || !byCat[state.cat]) state.cat = top ? top.name : null;
  renderDespesas(tx, prev);
  renderTable();
  renderCategorias();
  renderRules();
  renderCustom();
  renderDashboard();
  desenharResumo();
}

function renderPeriod(tx){
  var all = state.tx, p = state.p, meses = mesesDoExtrato();
  /* atalhos (contam a partir do último mês do extrato) */
  var ats = Periodo.atalhos(meses);
  /* na linha: Todo o extrato e Último mês; os outros atalhos ficam dentro do Personalizado… */
  var naLinha = function(a){ return a.id==='tudo' || a.id==='ult1'; };
  var botao = function(a){
    var on = !state.cmp && (p.tipo==='tudo' ? a.id==='tudo' : !!p.rotulo && p.rotulo===a.rotulo);
    return '<button type="button" class="ptab ini-pilula p-atalho" data-atalho="'+a.id+'" aria-pressed="'+on+'">'+esc(a.rotulo)+'</button>';
  };
  var dentroAtivo = !state.cmp && !!p.rotulo && ats.some(function(a){ return !naLinha(a) && a.rotulo===p.rotulo; });
  $('pPersRapidos').innerHTML = ats.filter(function(a){ return !naLinha(a); }).map(botao).join('');
  $('pPersRapidos').hidden = !$('pPersRapidos').innerHTML;
  $('pAtalhos').innerHTML = ats.filter(naLinha).map(botao).join('')+'<button type="button" class="ptab ini-pilula p-atalho" id="pPersBtn" data-acao="pers" aria-haspopup="dialog" aria-controls="pPers" aria-pressed="'+(!state.cmp && (p.rotulo==='Personalizado' || dentroAtivo))+'">Personalizado…</button>'+
    (meses.length>=2 ? '<button type="button" class="ptab ini-pilula p-atalho" id="pCmpBtn" data-acao="cmp" aria-haspopup="dialog" aria-controls="pCmp" aria-pressed="'+!!state.cmp+'">Comparar…</button>' : '');
  state.atalhos = ats;
  /* semana: só com um mês escolhido */
  var temMes = !state.cmp && (p.tipo==='mes' || p.tipo==='semana');
  $('pW').closest('.field').hidden = !temMes;
  if (temMes){
    var weeks = [];
    all.forEach(function(t){ if (t.date.getFullYear()===p.y && t.date.getMonth()===p.m){ var k = weekKey(t.date); if (weeks.indexOf(k)===-1) weeks.push(k); } });
    weeks.sort();
    $('pW').innerHTML = '<option value="all">Todas</option>'+weeks.map(function(k){return '<option value="'+k+'"'+(p.tipo==='semana' && k===p.w?' selected':'')+'>'+weekLabel(k)+'</option>';}).join('');
  }
  /* resumo */
  var nome = Periodo.nome(p), extra = '';
  if (p.tipo==='intervalo'){
    var fm = Periodo.fatorMes(p, 0);
    if (fm.dias) extra = ' · '+fm.dias+' dias';
    else { var nm = meses.filter(function(k){ return k>=p.de.slice(0,7) && k<=p.ate.slice(0,7); }).length; extra = ' · '+nm+(nm===1 ? ' mês' : ' meses'); }
    if (!/^ano de /.test(nome)) nome = 'de '+nome;
  }
  $('pSum').textContent = state.cmp ? 'Comparando '+Periodo.curto(state.cmp.a)+' × '+Periodo.curto(state.cmp.b) : 'Mostrando '+nome+extra+' · '+tx.length+' lançamentos';

  var mm = {}, order = [];
  all.forEach(function(t){
    var k = t.date.getFullYear()+'-'+String(t.date.getMonth()).padStart(2,'0');
    if (!mm[k]){ mm[k] = {y:t.date.getFullYear(), m:t.date.getMonth(), res:0}; order.push(k); }
    mm[k].res += t.value;
  });
  order.sort();
  var mh = order.map(function(k){
    var o = mm[k], on = p.tipo==='mes' && p.y===o.y && p.m===o.m;
    var dentro = p.tipo==='intervalo' && Periodo.contem(new Date(o.y, o.m, 15), p);
    var lab = MESES[o.m].slice(0,3)+'/'+String(o.y).slice(2);
    return '<button type="button" class="mchip'+(dentro ? ' no-intervalo' : '')+'" data-y="'+o.y+'" data-m="'+o.m+'" aria-pressed="'+on+'" aria-label="'+MESES[o.m]+' de '+o.y+', resultado '+brl.format(o.res)+'">'+
      '<span class="ml">'+lab+'</span><span class="mv '+(o.res>=0?'pos':'neg')+'">'+(o.res>=0?'+':'')+brl0.format(o.res)+'</span></button>';
  }).join('');
  /* esteira: repete a lista para o loop ser contínuo */
  $('pMonths').innerHTML = mh + mh.replace(/<button type="button" class="mchip"/g, '<button type="button" tabindex="-1" aria-hidden="true" class="mchip"');
  ajustarEsteira();
}
/* a esteira só se move quando os meses não cabem na tela; se couberem, fica
   parada e sem a cópia repetida (senão apareceria "Ago Set Out Ago Set Out") */
function ajustarEsteira(){
  var faixa = $('pMonths'), caixa = faixa.parentNode;
  if (!caixa.clientWidth) return;  /* escondida: mede quando aparecer */
  caixa.classList.remove('parada');
  var half = faixa.scrollWidth/2;
  caixa.classList.toggle('parada', half <= caixa.clientWidth);
  faixa.style.setProperty('--dur', (Math.max(213, half/1.5)/1.07/1.10).toFixed(1)+'s');   /* 7% e depois mais 10% mais rápida */
}
window.addEventListener('resize', function(){ if (state.loaded) ajustarEsteira(); });
var redesenhoTimer = null;
window.addEventListener('resize', function(){
  clearTimeout(redesenhoTimer);
  redesenhoTimer = setTimeout(function(){ if (state.loaded && !$('viewDash').hidden) renderDashboard(); }, 150);
});

function renderCategorias(){
  var base = state.tx, outs = 0, byC = {};
  base.forEach(function(t){ if (saiDaConta(t)){ outs -= t.value; var c = catOf(t); byC[c] = (byC[c]||0) - t.value; } });
  var S = { outs: outs, cats: Object.keys(byC).map(function(k){return {name:k, v:byC[k]};}).sort(function(a,b){
    if (a.name===OTHER) return 1; if (b.name===OTHER) return -1; return b.v-a.v; }) };
  if (!state.cat || !byC[state.cat]) state.cat = S.cats.length ? S.cats[0].name : null;
  var span = base.length ? 'Todo o extrato, de '+fmtDate(base[0].date)+' a '+fmtDate(base[base.length-1].date) : '';
  $('catList').innerHTML = S.cats.map(function(c){
    var n = base.filter(function(t){return ehSaida(t) && catOf(t)===c.name;}).length;
    return '<button type="button" class="cat-item" data-cat="'+esc(c.name)+'" aria-current="'+(c.name===state.cat)+'">'+
      '<span class="n">'+esc(c.name)+'</span><span class="m"><span class="num">'+brl0.format(c.v)+'</span><br>'+n+(n===1?' lançamento':' lançamentos')+'</span></button>';
  }).join('') || '<p class="empty">Nenhuma despesa no extrato.</p>';

  var name = state.cat;
  var list = base.filter(function(t){return ehSaida(t) && catOf(t)===name;});
  if (!name || !list.length){ $('cdName').textContent='Nenhuma categoria'; $('cdFacts').innerHTML=''; $('origins').innerHTML=''; $('cdRows').innerHTML=''; return; }
  var total = list.reduce(function(s,t){return s-t.value;},0);
  $('cntLanc').textContent = list.length;
  var byO = {}, oOrder = [];
  list.forEach(function(t){
    if (!byO[t.origin]){ byO[t.origin]={key:t.origin, label:t.desc, v:0, n:0, last:t.date}; oOrder.push(t.origin); }
    var o = byO[t.origin]; o.v -= t.value; o.n++; if (t.date>o.last) o.last=t.date;
  });
  var origins = oOrder.map(function(k){return byO[k];}).sort(function(a,b){return b.v-a.v;});
  var maxO = origins[0].v;

  $('cdName').textContent = name;
  $('cdFacts').innerHTML =
    '<span style="flex-basis:100%">'+span+'</span>'+
    '<span>Total <b>'+brl.format(total)+'</b></span>'+
    '<span><b>'+pct.format(outs?total/outs:0)+'</b> das saídas</span>'+
    '<span><b>'+list.length+'</b> '+(list.length===1?'lançamento':'lançamentos')+'</span>'+
    '<span><b>'+origins.length+'</b> '+(origins.length===1?'origem':'origens diferentes')+'</span>'+
    '<span>Média <b>'+brl.format(total/list.length)+'</b></span>';

  var opts = function(sel){ return catsCom(sel).map(function(c){return '<option'+(c===sel?' selected':'')+'>'+esc(c)+'</option>';}).join(''); };
  $('origins').innerHTML = origins.map(function(o){
    return '<li class="origin"><div class="who"><strong>'+esc(o.label)+'</strong>'+
      '<span class="meta"><span class="num">'+brl.format(o.v)+'</span> · '+o.n+(o.n===1?' pagamento':' pagamentos')+' · último em '+fmtDate(o.last)+' · '+pct.format(o.v/total)+' da categoria</span>'+
      '<span class="track"><span class="bar" style="width:'+Math.max(0, maxO>0 ? o.v/maxO*100 : 0).toFixed(1)+'%"></span></span></div>'+
      '<label>Mover todos para <select data-origin="'+esc(o.key)+'" aria-label="Mover todos os pagamentos de '+esc(o.label)+'">'+opts(name)+'</select></label></li>';
  }).join('');

  $('cdRows').innerHTML = list.map(function(t){
    var why = (t.estorno ? '<span class="why estorno" data-tip="Dinheiro de volta de uma despesa: desconta do total da categoria">estorno</span> ' : '')+
      (state.overrides[t.id] ? '<span class="why manual">Só neste extrato</span>'
      : state.rules[t.origin] ? '<span class="why manual">Sua regra</span>'
      : t.kw ? '<span class="why">palavra "'+esc(t.kw)+'"</span>' : '<span class="why none">Nenhuma regra</span>');
    return '<tr><td class="num">'+fmtDate(t.date)+'</td><td>'+esc(t.desc)+'</td><td>'+why+'</td>'+
      '<td class="rule-cell"><select data-id="'+t.id+'" aria-label="Categoria de '+esc(t.desc)+'">'+opts(catOf(t))+'</select></td>'+
      '<td class="r num">'+brl.format(t.value)+'</td></tr>';
  }).join('');
}

/* ---------- dashboard ---------- */
var FIXED = [];
function refreshFixed(){
  FIXED = allDefs().filter(function(d){ return d.type==='fixo'; }).map(function(d){ return d.name; });
  INTERNOS = builtinDefs().filter(function(d){ return d.interna; }).map(function(d){ return d.name; });
}
/* refaz a categoria automática dos lançamentos (no servidor) depois de mudar categorias */
function reclassify(){
  var uniq = [];
  state.tx.forEach(function(t){ if (ehSaida(t) && uniq.indexOf(t.desc)===-1) uniq.push(t.desc); });
  if (!uniq.length) return Promise.resolve();
  return API.categorizar(uniq).then(function(r){
    var porDesc = {};
    uniq.forEach(function(d,i){ porDesc[d] = r.resultados[i]; });
    state.tx.forEach(function(t){ if (ehSaida(t)){ var a = porDesc[t.desc]; t.auto = a.categoria; t.kw = a.palavra; } });
  });
}
function categoriaLocal(c){ return { id:c.id, name:c.nome, type:c.tipo, kws:c.palavras||[], at:c.criada_em }; }
function renderCustom(){
  var defs = allDefs();
  $('customEmpty').hidden = true;
  $('cntCustom').textContent = defs.length+1;
  var row = function(d){
    var n = state.tx.filter(function(t){ return (d.interna || ehSaida(t)) && catOf(t)===d.name; }).length;
    if (state.editingCat===d.id){
      return '<li class="sv editing"><form class="ncform ec-form" data-id="'+esc(d.id)+'" novalidate>'+
        '<div class="nfield"><label for="ecName">Nome da categoria</label><input id="ecName" maxlength="40" autocomplete="off" value="'+esc(d.name)+'"></div>'+
        (d.interna ? '' : '<fieldset class="nfield"><legend>Tipo de custo</legend>'+
          '<label class="radio"><input type="radio" name="ecType" id="ecVar" value="variavel"'+(d.type!=='fixo'?' checked':'')+'> <span><b>Variável</b>, acompanha o movimento</span></label>'+
          '<label class="radio"><input type="radio" name="ecType" id="ecFix" value="fixo"'+(d.type==='fixo'?' checked':'')+'> <span><b>Fixo</b>, pago todo mês</span></label></fieldset>')+
        '<div class="nfield"><label for="ecKw">Palavras-chave <span class="opt">(opcional)</span></label><input id="ecKw" autocomplete="off" value="'+esc(d.kws.join(', '))+'"><span class="help">Separe por vírgula.</span></div>'+
        '<p class="form-err" id="ecErr" role="alert" hidden></p>'+
        '<div class="sva"><button type="submit" class="btn primary">Salvar alterações</button><button type="button" class="btn" data-ccancel="1">Cancelar</button></div>'+
      '</form></li>';
    }
    var tag = d.builtin ? (d.edited ? '<span class="ctag">Padrão, editada</span>' : '<span class="ctag">Padrão</span>') : '<span class="ctag mine">Criada por você</span>';
    var kw = d.kws.length ? 'palavras: '+esc(d.kws.slice(0,8).join(', '))+(d.kws.length>8?' e mais '+(d.kws.length-8):'') : 'sem palavras-chave';
    return '<li class="sv"><div class="svi"><strong>'+esc(d.name)+' '+tag+'</strong>'+
      '<span>'+(d.interna ? 'não conta como entrada nem saída' : d.type==='fixo'?'Custo fixo':'Custo variável')+' · '+kw+' · '+n+(n===1?' lançamento':' lançamentos')+' neste extrato</span></div>'+
      '<div class="sva"><button type="button" class="btn" data-cedit="'+esc(d.id)+'">Editar</button>'+
      (d.builtin ? (d.edited ? '<button type="button" class="btn" data-creset="'+esc(d.id)+'">Restaurar padrão</button>' : '')
                 : '<button type="button" class="btn" data-cdel="'+esc(d.id)+'">Excluir</button>')+'</div></li>';
  };
  var nO = state.tx.filter(function(t){ return ehSaida(t) && catOf(t)===OTHER; }).length;
  var q = norm(state.catQ||'').trim();
  var match = function(name, kws){ return !q || norm(name).indexOf(q)!==-1 || kws.some(function(k){ return norm(k).indexOf(q)!==-1; }); };
  var shown = defs.filter(function(d){ return d.id===state.editingCat || match(d.name, d.kws); });
  var showOther = match(OTHER, []);
  var total = defs.length+1, count = shown.length+(showOther?1:0);
  $('catQInfo').textContent = q ? (count ? count+' de '+total+' categorias encontradas.' : 'Nenhuma categoria encontrada para "'+(state.catQ||'').trim()+'".') : '';
  $('customList').innerHTML = shown.map(row).join('') + (showOther ?
    '<li class="sv"><div class="svi"><strong>'+esc(OTHER)+' <span class="ctag">Sistema</span></strong><span>Recebe o que não foi identificado. Não pode ser editada · '+nO+(nO===1?' lançamento':' lançamentos')+' neste extrato</span></div></li>' : '');
}
function previewKws(){
  var kws = parseKws($('ncKw').value);
  if (!kws.length || !state.tx.length){ $('ncPreview').textContent = ''; return; }
  var hits = state.tx.filter(function(t){ if (ehEntrada(t)) return false; var d = norm(t.desc); return kws.some(function(k){ return d.indexOf(' '+k)!==-1; }); });
  $('ncPreview').textContent = hits.length ? hits.length+(hits.length===1?' lançamento':' lançamentos')+' deste extrato entraria'+(hits.length===1?'':'m')+' nesta categoria, por exemplo "'+hits[0].desc+'".' : 'Nenhum lançamento deste extrato tem essas palavras.';
}
var DOW = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
function fmtK(v){
  var a = Math.abs(v), s = v<0 ? '-' : '';
  if (a>=1000) return s+'R$ '+(a/1000).toLocaleString('pt-BR',{maximumFractionDigits:a>=10000?0:1})+' mil';
  return s+'R$ '+Math.round(a);
}
function niceStep(range, n){
  var raw = range/n || 1, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw/mag;
  return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*mag;
}
function scaleFor(lo, hi){
  lo = Math.min(0, lo); hi = Math.max(0, hi);
  if (lo===hi) hi = 1;
  var step = niceStep(hi-lo, 4);
  return {lo: Math.floor(lo/step)*step, hi: Math.ceil(hi/step)*step, step: step};
}
function axisY(sc, y, mL, W, mR){
  var s = '';
  for (var v=sc.lo; v<=sc.hi+sc.step/1e6; v+=sc.step){
    var yy = y(v).toFixed(1), z = Math.abs(v)<sc.step/1e6;
    s += '<line class="'+(z?'base':'gl')+'" x1="'+mL+'" x2="'+(W-mR)+'" y1="'+yy+'" y2="'+yy+'"></line>';
    s += '<text class="ax" x="'+(mL-8)+'" y="'+yy+'" dy="0.32em" text-anchor="end">'+fmtK(z?0:v)+'</text>';
  }
  return s;
}
function roundedBar(x, y0, y1, w, fill, op){
  /* as barras para cima crescem de baixo; as para baixo (negativas), de cima */
  var fo = op ? '" fill-opacity="'+op : '';
  var up = y1<y0, top = Math.min(y0,y1), h = Math.abs(y1-y0);
  if (h<0.5) return '';
  var r = Math.min(4, h, w/2);
  if (up) return '<path class="bar-up" fill="'+fill+fo+'" d="M'+x.toFixed(1)+' '+y0.toFixed(1)+'V'+(top+r).toFixed(1)+'Q'+x.toFixed(1)+' '+top.toFixed(1)+' '+(x+r).toFixed(1)+' '+top.toFixed(1)+'H'+(x+w-r).toFixed(1)+'Q'+(x+w).toFixed(1)+' '+top.toFixed(1)+' '+(x+w).toFixed(1)+' '+(top+r).toFixed(1)+'V'+y0.toFixed(1)+'Z"></path>';
  var bot = y1;
  return '<path fill="'+fill+fo+'" d="M'+x.toFixed(1)+' '+y0.toFixed(1)+'V'+(bot-r).toFixed(1)+'Q'+x.toFixed(1)+' '+bot.toFixed(1)+' '+(x+r).toFixed(1)+' '+bot.toFixed(1)+'H'+(x+w-r).toFixed(1)+'Q'+(x+w).toFixed(1)+' '+bot.toFixed(1)+' '+(x+w).toFixed(1)+' '+(bot-r).toFixed(1)+'V'+y0.toFixed(1)+'Z"></path>';
}
/* data: [{label, v, tip, fill, mark}] ; o: {labelEvery, valueLabels, minW} */
function barSVG(data, o){
  o = o || {};
  var big = o && o.big && !o.altura, W=o.largura||640, H=o.altura||240, mL=big ? 100 : 64, mR=8, mT=big ? 22 : 16, mB=big ? 38 : 26, iw=W-mL-mR, ih=H-mT-mB;
  var vals = data.map(function(d){return d.v;});
  var sc = scaleFor(Math.min.apply(null, vals.concat([0])), Math.max.apply(null, vals.concat([0])));
  var y = function(v){ return mT + (sc.hi-v)/(sc.hi-sc.lo)*ih; };
  var s = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.aria||'Gráfico de barras')+'"'+(big?' class="big"':'')+(o.altura ? '' : ' style="min-width:'+(o.minW||420)+'px"')+'>' + axisY(sc, y, mL, W, mR);
  var gw = iw/data.length, bw = Math.max(2, Math.min(44, gw*0.7));
  data.forEach(function(d,i){
    var x = mL + gw*i + (gw-bw)/2, cx = mL + gw*i + gw/2;
    s += roundedBar(x, y(0), y(d.v), bw, d.fill, d.op);
    if (!o.labelEvery || i % o.labelEvery === 0 || d.mark) s += '<text x="'+cx.toFixed(1)+'" y="'+(H-(big?12:10))+'" text-anchor="middle">'+esc(d.label)+'</text>';
    if (o.valueLabels || d.mark){
      var vy = d.v>=0 ? y(d.v)-6 : y(d.v)+14;
      s += '<text x="'+cx.toFixed(1)+'" y="'+vy.toFixed(1)+'" text-anchor="middle" class="vl">'+fmtK(d.v)+'</text>';
    }
    s += '<rect class="hit" x="'+(mL+gw*i).toFixed(1)+'" y="'+mT+'" width="'+gw.toFixed(1)+'" height="'+ih+'" data-tip="'+esc(d.tip)+'"'+(d.more?' data-more="'+esc(d.more)+'"':'')+'></rect>';
  });
  return s + '</svg>';
}
/* largura real (em px) do lugar do gráfico: o desenho usa a mesma escala da tela,
   então o texto fica sempre do tamanho certo. Escondido (ex.: detalhes fechados): 520 */
function larguraDe(id){ var w = $(id).clientWidth; return w>0 ? Math.max(320, Math.round(w)) : 520; }
/* minigráfico dos três números: só a linha, sem eixos; dica (mês e valor) em cada ponto */
function sparkSVG(valores, cor, dicas){
  if (!valores.length) return '';
  var lo = Math.min.apply(null, valores), hi = Math.max.apply(null, valores), n = valores.length;
  if (hi===lo){ hi += 1; lo -= 1; }
  var x = function(i){ return n<2 ? 50 : i/(n-1)*100; }, y = function(v){ return 2 + (hi-v)/(hi-lo)*24; };
  var d = valores.map(function(v,i){ return (i?'L':'M')+x(i).toFixed(2)+' '+y(v).toFixed(2); }).join('');
  var s = '<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" role="img" aria-label="Evolução mês a mês">'+
    '<path d="'+d+'" fill="none" stroke="'+cor+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"></path>';
  var w = 100/Math.max(1, n-1);
  valores.forEach(function(v,i){ s += '<rect class="hit" x="'+Math.max(0, x(i)-w/2).toFixed(2)+'" y="0" width="'+w.toFixed(2)+'" height="28" data-tip="'+esc(dicas[i])+'"></rect>'; });
  return s+'</svg>';
}
function lineSVG(pts, o){
  var W=o.largura||900, H=o.altura||260, mL=o.altura ? 64 : 84, mR=16, mT=o.altura ? 18 : 24, mB=30, iw=W-mL-mR, ih=H-mT-mB;
  var ys = pts.map(function(p){return p.y;});
  var sc = scaleFor(Math.min.apply(null, ys), Math.max.apply(null, ys));
  var x = function(i){ return mL + (pts.length<2 ? iw/2 : i/(pts.length-1)*iw); };
  var y = function(v){ return mT + (sc.hi-v)/(sc.hi-sc.lo)*ih; };
  var s = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.aria)+'"'+(o.altura ? '' : ' style="min-width:560px"')+'>' + axisY(sc, y, mL, W, mR);
  var d = pts.map(function(p,i){ return (i?'L':'M')+x(i).toFixed(1)+' '+y(p.y).toFixed(1); }).join('');
  s += '<path d="'+d+'L'+x(pts.length-1).toFixed(1)+' '+y(0).toFixed(1)+'L'+x(0).toFixed(1)+' '+y(0).toFixed(1)+'Z" fill="var(--s1)" fill-opacity="0.12"></path>';
  s += '<path d="'+d+'" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"></path>';
  var mStarts = [], lastK = -1;
  pts.forEach(function(p,i){ var k = p.date.getFullYear()*12+p.date.getMonth(); if (k!==lastK){ lastK = k; mStarts.push(i); } });
  var mStep = mStarts.length>18 ? 3 : mStarts.length>9 ? 2 : 1;
  mStarts.forEach(function(i,j){
    if (j % mStep) return;
    var p = pts[i], m = p.date.getMonth();
    s += '<text x="'+x(i).toFixed(1)+'" y="'+(H-10)+'" text-anchor="'+(i===0?'start':'middle')+'">'+MESES[m].slice(0,3)+'/'+String(p.date.getFullYear()).slice(2)+'</text>';
  });
  (o.marks||[]).forEach(function(mk){
    var i = mk.i, px = x(i), py = y(pts[i].y);
    s += '<circle cx="'+px.toFixed(1)+'" cy="'+py.toFixed(1)+'" r="5" fill="var(--s1)" stroke="var(--surface)" stroke-width="2"></circle>';
    var anchor = px > W-140 ? 'end' : px < mL+60 ? 'start' : 'middle';
    s += '<text x="'+px.toFixed(1)+'" y="'+(mk.below ? py+20 : py-12).toFixed(1)+'" text-anchor="'+anchor+'" class="vl">'+esc(mk.text)+'</text>';
  });
  var sw = iw/Math.max(1, pts.length-1);
  pts.forEach(function(p,i){
    s += '<rect class="hit" x="'+(x(i)-sw/2).toFixed(1)+'" y="'+mT+'" width="'+sw.toFixed(1)+'" height="'+ih+'" data-tip="'+esc(p.tip)+'"'+(p.more?' data-more="'+esc(p.more)+'"':'')+'></rect>';
  });
  return s + '</svg>';
}

var resRange = 'ult12';
/* Textos do dashboard que mudam conforme o tipo de conta. */
var TEXTOS = {
  diasEntradas:function(n, fixedM){ return 'Suas contas fixas ('+brl.format(fixedM)+' por mês) equivalem a cerca de '+n+' dias de renda. Ou seja, o salário dos primeiros '+n+' dias do mês vai só para as contas fixas.'; },
  caixaTitulo:'Saldo'
};
function textos(){ return TEXTOS; }

function agruparMeses(list){
  var M = {}, mk = [];
  list.forEach(function(t){
    var k = t.date.getFullYear()+'-'+String(t.date.getMonth()).padStart(2,'0');
    if (!M[k]){ M[k] = {k:k, y:t.date.getFullYear(), m:t.date.getMonth(), ins:0, outs:0, cat:{}}; mk.push(k); }
    var o = M[k];
    if (ehInterno(t)) return;
    if (ehEntrada(t)) o.ins += t.value; else { o.outs -= t.value; var c = catOf(t); o.cat[c] = (o.cat[c]||0) - t.value; }
  });
  mk.sort();
  return mk.map(function(k){ var o = M[k], aj = Analise.ajustarEstornos(o); o.ins = aj.ins; o.outs = aj.outs; o.res = o.ins-o.outs; o.label = MESES[o.m].slice(0,3)+'/'+String(o.y).slice(2); o.name = MESES[o.m]+' de '+o.y; return o; });
}
/* o par de meses comparado (Dashboard e Despesas): os dois últimos meses do período,
   ou o mês escolhido e o anterior; com "(até dd/mm)"/"(desde dd/mm)" quando o extrato corta.
   Semana ou dias exatos: sem par. */
function parMeses(tx){
  if (state.p.tipo==='semana' || (state.p.tipo==='intervalo' && state.p.dias) || !tx.length) return null;
  var months = agruparMeses(tx), cmpA = null, cmpB = null, txA = null;
  if (months.length>=2){ cmpA = months[months.length-2]; cmpB = months[months.length-1]; }
  else {
    var only = months[0], pm = only.m-1, py = only.y; if (pm<0){ pm = 11; py--; }
    var pk = py+'-'+String(pm).padStart(2,'0');
    var prevM = agruparMeses(state.tx).filter(function(o){return o.k===pk;})[0];
    if (prevM){ cmpA = prevM; cmpB = only; txA = state.tx.filter(function(t){ return t.date.getFullYear()===py && t.date.getMonth()===pm; }); }
  }
  if (!cmpA) return null;
  var dIni = null, dFim = null;
  state.tx.forEach(function(t){ if (!dIni || t.date<dIni) dIni = t.date; if (!dFim || t.date>dFim) dFim = t.date; });
  var ddmm = function(d){ return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); };
  var com = function(o, nome, rot){ var c = {}; for (var kk in o) c[kk] = o[kk]; c.name = nome; c.label = rot; return c; };
  if (dFim && dFim.getFullYear()===cmpB.y && dFim.getMonth()===cmpB.m && dFim.getDate()<new Date(cmpB.y, cmpB.m+1, 0).getDate()) cmpB = com(cmpB, cmpB.name+' (até '+ddmm(dFim)+')', cmpB.label+' (até '+ddmm(dFim)+')');
  if (dIni && dIni.getFullYear()===cmpA.y && dIni.getMonth()===cmpA.m && dIni.getDate()>1) cmpA = com(cmpA, cmpA.name+' (desde '+ddmm(dIni)+')', cmpA.label+' (desde '+ddmm(dIni)+')');
  return {A:cmpA, B:cmpB, txA:txA};
}
function renderDashboard(){
  var X = textos();
  /* despesas analisadas (null = todas). Não muda veredito, números, ações, saldo nem projeção */
  var sel = state.dashCats;
  function noFiltro(t){ return !sel || sel.indexOf(catOf(t))!==-1; }
  var tx = cur(); if (!tx.length) tx = state.tx; if (!tx.length) return;
  var isWeek = state.p.tipo==='semana';
  var first = tx[0].date, last = tx[tx.length-1].date;
  $('dSpan').textContent = (state.p.tipo==='tudo' ? 'Todo o extrato' : 'Período: '+Periodo.nome(state.p))+', de '+fmtDate(first)+' a '+fmtDate(last);

  /* por mês */
  var months = agruparMeses(tx), allMonths = agruparMeses(state.tx);
  var fmes = Periodo.fatorMes(state.p, months.length);
  var nM = isWeek ? 1 : fmes.divisor;  /* semana: valores da semana inteira; dias exatos: média de 30 dias */
  var T = sums(tx), res = T.ins - T.outs;

  /* fixos e variáveis */
  var fixed = 0, byCat = {};
  tx.forEach(function(t){ if (saiDaConta(t)){ var c = catOf(t); byCat[c] = (byCat[c]||0) - t.value; if (FIXED.indexOf(c)!==-1) fixed -= t.value; } });
  var variable = T.outs - fixed, fixedM = fixed/nM, varM = variable/nM;
  /* filtro sem nenhuma categoria com gasto neste período: mostra todas e avisa */
  var selVazio = !!sel && !sel.some(function(c){ return byCat[c]; });
  if (selVazio) sel = null;

  /* dias */
  var nDays = Math.round((last-first)/864e5)+1;
  var domOut = []; for (var j=0;j<31;j++) domOut.push(0);
  tx.forEach(function(t){ if (saiDaConta(t) && noFiltro(t)) domOut[t.date.getDate()-1] -= t.value; });
  var domAvg = domOut.map(function(v){ return v/nM; });
  var dailyIns = T.ins/nDays;
  function topOrigins(list, n, div){
    var g = {};
    list.forEach(function(t){ var k = t.origin; if (!g[k]) g[k] = {l:t.desc, v:0, c:0}; g[k].v += ehSaida(t) ? -t.value : t.value; g[k].c++;  /* estorno desconta */ });
    return Object.keys(g).map(function(k){return g[k];}).sort(function(a,b){return b.v-a.v;}).slice(0,n)
      .map(function(o){ return {l:o.l, v:o.v/(div||1), c:o.c}; });
  }
  function moreHTML(title, rows, note){
    return '<b class="tm-t">'+esc(title)+'</b>'+
      (rows.length ? '<ul class="tm-l">'+rows.map(function(r){ return '<li><span>'+esc(r[0])+'</span><span class="num">'+esc(r[1])+'</span></li>'; }).join('')+'</ul>' : '')+
      (note ? '<p class="tm-n">'+esc(note)+'</p>' : '');
  }
  var monthTx = {}, dayTx = {};
  tx.forEach(function(t){
    var mkk = t.date.getFullYear()+'-'+String(t.date.getMonth()).padStart(2,'0');
    (monthTx[mkk] = monthTx[mkk] || []).push(t);
    var dk = isoD(t.date); (dayTx[dk] = dayTx[dk] || []).push(t);
  });
  var avgRes = months.reduce(function(s,o){return s+o.res;},0)/nM;

  /* contexto para as contas do dashboard (js/analise.js) */
  var diasP = state.p.tipo==='intervalo' && !!state.p.dias;   /* dias exatos: meses das pontas podem estar cortados */
  var ctx = { escopo: isWeek ? 'semana' : state.p.tipo==='mes' ? 'mes' : (fmes.dias && !fmes.nota) ? 'dias' : 'meses', nM:nM, notaMes:fmes.nota, dias:fmes.dias,
    ins:T.ins, outs:T.outs, byCat:byCat, fixas:FIXED, outros:OTHER,
    meses: months.map(function(o){ return {name:o.name, cat:o.cat}; }),
    nomes: {delivery:catByCode('delivery'), tarifas:catByCode('tarifas'), assinaturas:catByCode('assinaturas'),
      compras:catByCode('compras'), dividas:catByCode('dividas'), taxas:catByCode('taxas')},
    brl:function(n){ return brl.format(n); }, pct:function(n){ return pct.format(n); } };

  /* Parte 1: veredito e os três números */
  var ver = Analise.veredito(ctx);
  /* o resumo do Início usa exatamente estes números */
  state.resumo = { ver:ver, ins:T.ins, outs:T.outs, nM:nM, periodo:Periodo.nome(state.p) };
  $('dVer').className = 'card verdict faixa '+ver.cor;
  $('dVerT').textContent = ver.titulo;
  $('dVerTx').textContent = ver.texto;
  $('dVerPesa').textContent = ver.pesa || '';
  var pAntD = Periodo.anterior(state.p), pp = pAntD && cobreInteiro(pAntD) ? {p:pAntD, label:Periodo.nomeAnterior(state.p)} : null, ant = null;
  if (pp && (isWeek || state.p.tipo==='mes')){  /* compara só mês com mês ou semana com semana */ var pl = state.tx.filter(function(t){ return Periodo.contem(t.date, pp.p); }); if (pl.length){ ant = sums(pl); ant.label = pp.label; } }
  var nums = Analise.numeros(ctx);
  if (ant){  /* comparação com o mês (ou a semana) anterior */
    nums[0].sub += deltaTxt(T.ins, ant.ins, ant.label);
    nums[1].sub += deltaTxt(T.outs, ant.outs, ant.label);
    nums[2].sub += ' · <span class="delta">'+(res-(ant.ins-ant.outs)>=0?'+':'-')+brl.format(Math.abs(res-(ant.ins-ant.outs)))+'</span> vs. '+ant.label;
  }
  var sparks = isWeek ? ['', '', ''] : [['ins','var(--good)'], ['outs','var(--ink-3)'], ['res','var(--s1)']].map(function(c){
    var serie = Analise.serieMeses(months, c[0]);
    return sparkSVG(serie, c[1], months.map(function(o, i){ return '<b>'+esc(o.name)+'</b><br>'+brl.format(serie[i]||0); }));
  });
  $('dNums').innerHTML = nums.map(function(x, i){
    return '<div class="kpi"><span class="label">'+x.rotulo+'</span><span class="value num'+(x.neg?' neg':'')+'">'+esc(x.valor)+'</span><span class="sub">'+x.sub+'</span>'+sparks[i]+'</div>';
  }).join('');
  contarNumeros();
  var nInv = catByCode('investimentos'), nEc = catByCode('entre_contas'), aplicado = 0, resgatado = 0, transferido = 0;
  tx.forEach(function(t){
    var c = catOf(t);
    if (c===nInv){ if (ehEntrada(t)) resgatado += t.value; else aplicado -= t.value; }
    else if (c===nEc) transferido += Math.abs(t.value);
  });
  var linhaI = Analise.linhaInterno({aplicado:aplicado, resgatado:resgatado, transferido:transferido, brl:function(n){ return brl.format(n); }});
  var catI = Math.abs(aplicado-resgatado)>0.005 ? nInv : nEc;
  $('dInterno').innerHTML = linhaI ? esc(linhaI)+' <a href="#lancamentos" data-interno="'+esc(catI)+'">Ver lançamentos</a>' : '';
  $('dInterno').hidden = !linhaI;
  $('dInterno').dataset.texto = linhaI || '';

  /* Parte 2: o que fazer agora */
  var ac = Analise.acoes(ctx);
  /* o PDF lista as dicas; a tela leva à página Economia */
  state.pdfAcoes = ac.lista.map(function(a){ return [a.titulo, a.motivo, a.economia ? '~'+brl0.format(a.economia)+'/mês' : '']; });
  state.pdfSemAcao = ac.vazio || '';

  /* a página Economia usa sempre o extrato inteiro (não tem quadro de Período):
     as mesmas contas do Dashboard com "Ver todo o período" */
  var Ta = sums(state.tx), nA = allMonths.length || 1, byCatA = {}, aplA = 0, resA = 0;
  state.tx.forEach(function(t){
    var c = catOf(t);
    if (saiDaConta(t)) byCatA[c] = (byCatA[c]||0) - t.value;
    if (c===nInv){ if (ehEntrada(t)) resA += t.value; else aplA -= t.value; }
  });
  var gastoCat = {}; Object.keys(byCatA).forEach(function(c){ if (byCatA[c]>0) gastoCat[c] = byCatA[c]/nA; });
  var mesesA = allMonths.map(function(o){ return {name:o.name, cat:o.cat}; });
  var rot = function(o){ return MESES[o.m].slice(0,3)+'/'+o.y; };
  state.eco = { semana:false, nM:nA, sobraMes:(Ta.ins-Ta.outs)/nA, gastoCat:gastoCat, guardado:aplA-resA, meses:mesesA,
    base: allMonths.length ? 'Com base em todo o extrato: '+rot(allMonths[0])+(allMonths.length>1 ? ' a '+rot(allMonths[allMonths.length-1]) : '')+' ('+(nA===1 ? '1 mês' : nA+' meses')+').' : '',
    ctx: { escopo: nA>1 ? 'meses' : 'mes', nM:nA, ins:Ta.ins, outs:Ta.outs, byCat:byCatA, fixas:FIXED, outros:OTHER, meses:mesesA,
      nomes:ctx.nomes, brl:ctx.brl, pct:ctx.pct } };
  if (!$('viewEconomia').hidden) renderEconomia();
  renderComparacao();
  /* faixa Dicas: atalho com o total que dá para economizar (com o limite por categoria) */
  var rz = resumoEconomia();
  $('dEcoAtalho').textContent = rz.n ? 'Dá para economizar ~'+brl0.format(rz.total)+'/mês em '+rz.n+(rz.n===1 ? ' item' : ' itens')+' →' : 'Veja onde dá para economizar →';

  /* Parte 3: para onde vai o dinheiro */
  var bar = Analise.barras(diasP ? Object.assign({}, ctx, {meses:[]}) : ctx, sel);   /* sem setas de "último mês" com meses cortados */
  var nTodas = Object.keys(byCat).filter(function(c){ return byCat[c]!==0; }).length;
  var maxV = bar.linhas.reduce(function(m,l){ return Math.max(m, l.mes); }, 0);
  /* as porcentagens vêm de Analise.fatias: a lista, o PDF e a legenda mostram os mesmos números */
  var pctCat = {}; Analise.fatias(bar.linhas).forEach(function(f){ pctCat[f.nome] = f.rotulo; });
  var pctDe = function(l){ return l.negativo ? '—' : pctCat[l.nome] || '0%'; };
  /* o PDF lista todas as categorias; a tela mostra as 5 maiores (ou todas) */
  state.pdfBarras = bar.linhas.map(function(l){ return {l:l.nome, v:brl.format(l.mes)+(nM>1?'/mês':'')+' · '+pctDe(l)}; });
  var vis = Analise.visiveis(bar.linhas, true, 5);
  var maisBarras = '';
  $('dBarras').innerHTML = vis.linhas.length ? vis.linhas.map(function(l){
    return '<li class="barra'+(l.outros?' outros':'')+(l.negativo?' neg':'')+'" data-cat="'+esc(l.nome)+'" role="link" tabindex="0" title="Ver os lançamentos de '+esc(l.nome)+'">'+
      '<span class="bn">'+esc(l.nome)+(l.fixa?'<span class="tag-fixa">fixa</span>':'')+
        (l.seta==='sobe'?'<span class="seta-sobe" title="Subiu no último mês">↑</span>':l.seta==='desce'?'<span class="seta-desce" title="Caiu no último mês">↓</span>':'')+'</span>'+
      '<span class="bt"><i style="width:'+(l.negativo || maxV<=0 ? 0 : Math.max(1, l.mes/maxV*100)).toFixed(1)+'%"></i></span>'+
      '<span class="bv"><span class="num">'+brl.format(l.mes)+(nM>1?'/mês':'')+'</span><small'+(l.negativo ? ' title="Os estornos foram maiores que os gastos"' : '')+'>'+pctDe(l)+'</small>'+
        (l.outros?' <a href="#categorias" data-classificar="1">classificar →</a>':'')+'</span></li>';
  }).join('') + maisBarras : '<li class="barras-vazio">Nenhuma saída neste período.</li>';
  /* barra fatiada: as 5 maiores + Outros, na mesma ordem e regra da lista */
  var fat = Analise.fatias(bar.linhas, 5);
  var corFatia = function(f, i){ return f.outros ? '' : 'color-mix(in srgb, var(--s1) '+[100, 78, 58, 40, 26][Math.min(i, 4)]+'%, var(--s2))'; };
  $('dFatias').innerHTML = fat.map(function(f, i){
    return '<button type="button" class="'+(f.outros ? 'outros' : '')+'" '+(f.demais ? 'data-demais="1"' : 'data-cat="'+esc(f.nome)+'"')+' data-flex="'+f.pct+'" style="flex-grow:'+f.pct+(f.outros ? '' : ';background:'+corFatia(f, i))+'" title="'+esc(f.nome)+' · '+f.rotulo+'" aria-label="'+esc(f.nome)+', '+f.rotulo+' dos gastos"></button>';
  }).join('');
  crescerFatias(fat.map(function(f){ return f.nome+':'+f.pct; }).join('|'));
  $('dLegenda').innerHTML = fat.map(function(f, i){
    return '<li><button type="button" '+(f.demais ? 'data-demais="1"' : 'data-cat="'+esc(f.nome)+'"')+'><i class="'+(f.outros ? 'outros' : '')+'" style="'+(f.outros ? 'background:var(--surface-2);border:1px dashed var(--line)' : 'background:'+corFatia(f, i))+'"></i>'+esc(f.nome)+' <b>'+f.rotulo+'</b></button></li>';
  }).join('');
  $('dBarras').hidden = !state.dashTodas;
  $('dTodasBtn').hidden = bar.linhas.length<=fat.filter(function(f){ return !f.demais; }).length && !state.dashTodas;   /* inclui a categoria só de estornos, que não vira fatia */
  $('dTodasBtn').textContent = state.dashTodas ? 'Ver menos' : 'Ver todas as '+bar.linhas.length+' categorias';
  $('dTodasBtn').setAttribute('aria-expanded', state.dashTodas ? 'true' : 'false');
  var fixAn = bar.linhas.filter(function(l){ return l.fixa; }).reduce(function(s2,l){ return s2+l.mes*nM; }, 0);
  $('dFixLinha').textContent = fixAn>0 ? 'Contas fixas: '+brl.format(fixAn/nM)+(nM>1?' por mês':'')+', '+pct.format(bar.total>0 ? fixAn/bar.total : 0)+' das saídas'+(sel?' analisadas':'')+'.' : '';
  var aviso = $('dFiltroAviso');
  aviso.hidden = !sel && !selVazio;
  if (selVazio) aviso.innerHTML = 'Nenhuma das categorias escolhidas tem gastos neste período, por isso estão aparecendo todas. · <button type="button" data-atalho="todas">Limpar a escolha</button>';
  else if (sel) aviso.innerHTML = 'Analisando '+bar.linhas.length+' de '+nTodas+' categorias: '+brl.format(bar.total/nM)+(nM>1?'/mês':'')+', '+pct.format(T.outs ? bar.total/T.outs : 0)+' das saídas · <button type="button" data-atalho="todas">Mostrar todas</button>';
  $('dFiltroBtn').textContent = (sel ? bar.linhas.length+' de '+nTodas+' categorias' : 'Todas as despesas ('+nTodas+')')+' ▾';
  var ordem = Object.keys(byCat).filter(function(c){ return byCat[c]!==0; }).sort(function(a,b){
    if (a===OTHER) return 1; if (b===OTHER) return -1; return byCat[b]-byCat[a]; });
  var marcadas = ordem.filter(function(c){ return !sel || sel.indexOf(c)!==-1; });
  $('dFiltroLista').innerHTML = ordem.map(function(c){
    var on = !sel || sel.indexOf(c)!==-1, trava = on && marcadas.length===1;
    return '<li><label><input type="checkbox" value="'+esc(c)+'"'+(on?' checked':'')+(trava?' disabled title="Deixe pelo menos uma categoria marcada"':'')+'> '+esc(c)+
      '<span class="num">'+brl.format(byCat[c]/nM)+(nM>1?'/mês':'')+'</span></label></li>';
  }).join('');
  $('dDet').open = !!state.dashDet;

  /* gráfico: resultado por mês (ou gastos das categorias escolhidas) */
  var rSel = $('rPeriod'), yrs = [];
  months.forEach(function(o){ if (yrs.indexOf(o.y)===-1) yrs.push(o.y); });
  var rOpts = [['ult6','Últimos 6 meses'],['ult12','Últimos 12 meses'],['all','Todos os meses']].concat(yrs.map(function(y){ return ['y:'+y, 'Ano de '+y]; }));
  if (rSel){
    rSel.innerHTML = rOpts.map(function(o){ return '<option value="'+o[0]+'">'+o[1]+'</option>'; }).join('');
    if (!rOpts.some(function(o){ return o[0]===resRange; })) resRange = 'ult12';
    rSel.value = resRange;
  }
  var chartM = months;
  if (resRange==='ult6') chartM = months.slice(-6);
  else if (resRange==='ult12') chartM = months.slice(-12);
  else if (resRange.indexOf('y:')===0) chartM = months.filter(function(o){ return 'y:'+o.y===resRange; });
  if (!chartM.length) chartM = months;
  /* o PDF imprime o mesmo mês a mês do gráfico (sem o dinheiro guardado e no mesmo intervalo) */
  state.pdfMeses = { titulo:'Resultado por mês', linhas: chartM.map(function(o){ return {l:o.name, v:brl.format(o.res)}; }) };
  if (sel){
    var selNomes = sel.filter(function(c){ return byCat[c]; });
    var gastosCom = selNomes.length<=2 ? 'Gastos com '+selNomes.join(' e ') : 'Gastos com as '+selNomes.length+' categorias escolhidas';
    $('dResT').textContent = 'Meses';
    $('dResH').textContent = gastosCom;
    state.pdfMeses = { titulo:gastosCom+', mês a mês', linhas: chartM.map(function(o){
      return {l:o.name, v:brl.format(sel.reduce(function(s2,c){ return s2+(o.cat[c]||0); }, 0))}; }) };
    $('dRes').innerHTML = barSVG(chartM.map(function(o){
      var v = sel.reduce(function(s2,c){ return s2+(o.cat[c]||0); }, 0);
      return {label:o.label, v:v, fill:'var(--accent)', tip:'<b>'+esc(o.name)+'</b><br>Gastos: '+brl.format(v),
        more: moreHTML('Neste mês', sel.filter(function(c){ return o.cat[c]; }).sort(function(a,b){ return o.cat[b]-o.cat[a]; }).map(function(c){ return [c, brl.format(o.cat[c])]; }), '')};
    }), {valueLabels: chartM.length<=6, labelEvery: chartM.length>18 ? 3 : chartM.length>8 ? 2 : 1, altura:alturaMeses(), largura:larguraDe('dRes'), aria:$('dResT').textContent});
  } else {
  $('dResT').textContent = 'Meses'; $('dResH').textContent = 'Entradas menos saídas';
  $('dRes').innerHTML = barSVG(chartM.map(function(o){
    return {label:o.label, v:o.res, fill: o.res>=0 ? 'var(--s1)' : 'var(--bad)',
      tip:'<b>'+esc(o.name)+'</b><br>Entradas: '+brl.format(o.ins)+'<br>Saídas: '+brl.format(o.outs)+'<br>Resultado: '+brl.format(o.res)+'<br>Margem: '+pct.format(o.ins?o.res/o.ins:0),
      more: moreHTML('Maiores saídas do mês', Object.keys(o.cat).sort(function(a,b){return o.cat[b]-o.cat[a];}).slice(0,4).map(function(c){return [c, brl.format(o.cat[c])];}),
        nM>1 && !diasP ? 'Resultado '+(o.res>=avgRes?'acima':'abaixo')+' da média dos meses em '+brl.format(Math.abs(o.res-avgRes))+'.' : '')};
  }), {valueLabels: chartM.length<=6, labelEvery: chartM.length>18 ? 3 : chartM.length>8 ? 2 : 1, altura:alturaMeses(), largura:larguraDe('dRes'), aria:'Resultado por mês'});
  }

  /* caixa acumulado */
  var byDay = {}; tx.forEach(function(t){ var kk = isoD(t.date); byDay[kk] = (byDay[kk]||0) + t.value; });
  var acc = 0, pts = [], minI = 0;
  for (var di=0; di<nDays; di++){
    var dd = new Date(first); dd.setDate(dd.getDate()+di);
    var net = byDay[isoD(dd)] || 0; acc += net;
    var dl = (dayTx[isoD(dd)]||[]).slice().sort(function(a,b){return Math.abs(b.value)-Math.abs(a.value);});
    pts.push({date:dd, y:acc, tip:'<b>'+fmtDate(dd)+'</b><br>No dia: '+brl.format(net)+'<br>Acumulado: '+brl.format(acc),
      more: moreHTML(dl.length ? 'Lançamentos deste dia' : 'Nenhum lançamento neste dia', dl.slice(0,5).map(function(t){return [t.desc, brl.format(t.value)];}),
        dl.length>5 ? 'E mais '+(dl.length-5)+' lançamentos menores.' : '')});
    if (acc < pts[minI].y) minI = di;
  }
  var marks = [{i:pts.length-1, text:'Hoje no extrato: '+fmtK(acc)}];
  if (minI>0 && minI<pts.length-1) marks.push({i:minI, text:'Menor ponto: '+fmtK(pts[minI].y)+' em '+shortDate(pts[minI].date), below:true});
  $('dCumT').textContent = X.caixaTitulo;
  $('dCum').innerHTML = lineSVG(pts, {aria:X.caixaTitulo+' ao longo do extrato', marks:marks, altura:180, largura:larguraDe('dCum')});

  /* dia do mês */
  var order = domAvg.map(function(v,i){return i;}).sort(function(a,b){return domAvg[b]-domAvg[a];});
  var top3 = order.slice(0,3), top3sum = top3.reduce(function(s,i){return s+domAvg[i];},0);
  /* categorias que mais mudaram */
  var chg = [], par = parMeses(tx), cmpA = par ? par.A : null, cmpB = par ? par.B : null;
  if (par && par.txA) monthTx[cmpA.k] = par.txA;
  if (cmpA){
    var A = cmpA, B = cmpB;
    $('dChgA').textContent = A.label; $('dChgB').textContent = B.label;
    $('dChgHint').textContent = 'Comparando '+A.name+' com '+B.name;
    var cs = {}; Object.keys(A.cat).concat(Object.keys(B.cat)).forEach(function(c){ if (!sel || sel.indexOf(c)!==-1) cs[c]=1; });
    chg = Object.keys(cs).map(function(c){ var a = A.cat[c]||0, b = B.cat[c]||0; return {c:c, a:a, b:b, d:b-a, p: a ? (b-a)/a : null}; })
      .sort(function(x,y){ return Math.abs(y.d)-Math.abs(x.d); }).slice(0,6);
    $('dChg').innerHTML = chg.map(function(r){
      var up = r.d>0;
      var txt = r.p===null ? 'nova' : (up?'+':'')+pct.format(r.p);
      var ga = {}, gb = {};
      (monthTx[A.k]||[]).forEach(function(t){ if (ehSaida(t) && catOf(t)===r.c){ (ga[t.origin] = ga[t.origin] || {l:t.desc, v:0}).v -= t.value; } });
      (monthTx[B.k]||[]).forEach(function(t){ if (ehSaida(t) && catOf(t)===r.c){ (gb[t.origin] = gb[t.origin] || {l:t.desc, v:0}).v -= t.value; } });
      var ks = {}; Object.keys(ga).concat(Object.keys(gb)).forEach(function(x){ ks[x]=1; });
      var drv = Object.keys(ks).map(function(x){ var a = ga[x] ? ga[x].v : 0, b = gb[x] ? gb[x].v : 0; return {l:(gb[x]||ga[x]).l, d:b-a}; })
        .filter(function(x){return Math.abs(x.d)>=0.01;}).sort(function(x,y){return Math.abs(y.d)-Math.abs(x.d);}).slice(0,4);
      var mo = moreHTML('O que mais mudou em '+r.c, drv.map(function(x){ return [x.l, (x.d>0?'+':'-')+brl.format(Math.abs(x.d))]; }), 'Diferença por origem entre '+A.name+' e '+B.name+'.');
      return '<tr class="hoverable" data-tip="'+esc('<b>'+esc(r.c)+'</b>')+'" data-more="'+esc(mo)+'"><td>'+esc(r.c)+'</td><td class="r num">'+brl.format(r.a)+'</td><td class="r num">'+brl.format(r.b)+'</td>'+
        '<td class="r"><span class="pill '+(up?'neg':'pos')+'">'+(up?'▲ subiu ':'▼ caiu ')+txt+' ('+(up?'+':'-')+brl0.format(Math.abs(r.d))+')</span></td></tr>';
    }).join('');
  }
  $('dChgBox').hidden = !cmpA; $('dChgEmpty').hidden = !!cmpA;
  if (!cmpA) $('dChgHint').textContent = '';

  /* projeção */
  var lastN = allMonths.slice(-3), pn = lastN.length;
  var pIns = lastN.reduce(function(s,o){return s+o.ins;},0)/pn, pOut = lastN.reduce(function(s,o){return s+o.outs;},0)/pn, pRes = pIns-pOut;
  $('dProjHint').textContent = 'Média '+(pn===1?'do último mês':'dos últimos '+pn+' meses')+' do extrato, independente do período escolhido';
  var projBase = function(key, title){ return esc(moreHTML(title, lastN.map(function(o){ return [o.name, brl.format(o[key])]; }), 'A projeção é a média desses meses.')); };
  /* faixa de previsão: uma linha */
  var rIns = Math.round(pIns), rOut = Math.round(pOut), rRes = rIns-rOut;   /* a conta da frase fecha com os números mostrados */
  $('dPrevTx').textContent = 'Próximo mês: entra ~'+brl0.format(rIns)+', sai ~'+brl0.format(rOut)+', '+(rRes>=0 ? 'sobra' : 'falta')+' ~'+brl0.format(Math.abs(rRes))+'.';

  /* faixa de comparação: o mesmo par de meses de "Mudanças" */
  if (cmpA && !isWeek){
    var cp = Analise.comparacao(cmpA, cmpB, function(n){ return brl.format(n); }, function(n){ return pct0.format(n); });
    var catBtn = function(x, cls){ return '<button type="button" class="cmp-cat" data-cat="'+esc(x.nome)+'">'+esc(x.nome)+'</button> <span class="'+cls+'">'+esc(x.txt)+'</span>'; };
    $('dCmpTx').innerHTML = esc(cp.frase)+(cp.alta ? ' <span>Maior alta: '+catBtn(cp.alta, 'cmp-alta')+'.</span>' : '')+(cp.queda ? ' <span>Maior queda: '+catBtn(cp.queda, 'cmp-queda')+'.</span>' : '');
  }
  $('dCmp').hidden = !cmpA || isWeek;

  /* faixa dos maiores gastos (lançamentos individuais, sem estornos nem dinheiro guardado/transferido entre contas) */
  var gastos = Analise.maioresGastos(tx.filter(function(t){ return saiDaConta(t) && !t.estorno; })
    .map(function(t){ return {data:t.date, desc:t.desc, valor:-t.value, chave:t.origin}; }), 3);
  $('dGastos').innerHTML = gastos.map(function(g){
    return '<li><button type="button" data-gasto="'+esc(g.desc)+'" title="Ver nos lançamentos"><span class="gdt">'+fmtDate(g.data)+'</span><span class="gd">'+esc(g.desc)+'</span><span class="gv">'+brl.format(g.valor)+'</span></button></li>';
  }).join('');
  $('dGastosSec').hidden = !gastos.length;

  /* outras informações (o que virou veredito ou ação já aparece no topo) */
  var L = [];
  if (months.length>=2 && !diasP){
    var best = months.slice().sort(function(a,b){return b.res-a.res;})[0], worst = months.slice().sort(function(a,b){return a.res-b.res;})[0];
    L.push({w:false, t:'O melhor mês foi '+best.name+' (resultado de '+brl.format(best.res)+') e o mais fraco, '+worst.name+' ('+brl.format(worst.res)+').'});
  }
  if (!isWeek && top3sum>0) L.push({w:false, t:'As saídas'+(sel?' analisadas':'')+' se concentram nos dias '+top3.map(function(i){return i+1;}).sort(function(a,b){return a-b;}).join(', ').replace(/, (\d+)$/,' e $1')+': juntos, somam em média '+brl.format(top3sum)+' por mês ('+pct.format(T.outs?top3sum/(T.outs/nM):0)+' das saídas). Deixe dinheiro reservado para essas datas.'});
  if (dailyIns>0 && !isWeek) { var dd2 = fixedM/dailyIns; L.push({w:false, t:X.diasEntradas(Math.round(dd2), fixedM)}); }
  $('dIns').innerHTML = L.map(function(i){ return '<li class="'+(i.w?'warn':'')+'">'+(i.w?ICON_WARN:ICON_INFO)+'<p>'+esc(i.t)+'</p></li>'; }).join('');
}

/* ===== Vendas (subpágina do dashboard) ===== */
var sales = [];
var salesFile = '';
var MODE = null;
var VENDAS_ATIVO = false; /* vendas em pausa: esta versão foca nas despesas */
var WD_NAMES = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
function sP2(n){ return String(n).padStart(2,'0'); }
function normH(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); }
function kindNow(){ return MODE || 'despesas'; }
function parseSales(text){
  var lines = text.split(/\r?\n/).filter(function(l){ return l.trim(); });
  if (lines.length < 2) throw new Error('A planilha precisa ter o cabeçalho e pelo menos uma venda.');
  var d = lines[0].split(';').length >= lines[0].split(',').length ? ';' : ',';
  var head = splitLine(lines[0], d).map(normH);
  function col(names){ for (var i=0;i<head.length;i++){ if (names.indexOf(head[i])!==-1) return i; } return -1; }
  var iD = col(['data','date']), iH = col(['hora','horario','hora da venda']);
  var iP = col(['produto','item','descricao','produto servico']), iC = col(['categoria','grupo']);
  var iQ = col(['quantidade','qtd','qtde']), iU = col(['valor unitario','preco unitario','preco','valor unit']);
  var iT = col(['valor total','total','valor']), iF = col(['forma de pagamento','pagamento','forma pagamento']);
  if (iD<0 || iP<0 || (iT<0 && iU<0)) throw new Error('Não encontrei as colunas Data, Produto e Valor. Baixe o modelo para conferir o formato.');
  var out = [], bad = 0;
  for (var k=1;k<lines.length;k++){
    var c = splitLine(lines[k], d);
    var date = parseData(c[iD]);
    var prod = (c[iP]||'').trim();
    var qty = iQ>=0 ? parseValor(c[iQ]) : 1; if (isNaN(qty) || qty<=0) qty = 1;
    var unit = iU>=0 ? parseValor(c[iU]) : NaN;
    var total = iT>=0 ? parseValor(c[iT]) : NaN;
    if (isNaN(total)) total = isNaN(unit) ? NaN : unit*qty;
    if (isNaN(unit) && !isNaN(total)) unit = total/qty;
    if (!date || !prod || isNaN(total)){ bad++; continue; }
    var hour = -1;
    if (iH>=0){ var m = String(c[iH]||'').match(/(\d{1,2})[:h](\d{2})/); if (m) hour = (+m[1])*60 + (+m[2]); }
    out.push({
      date: date, hour: hour, prod: prod,
      cat: (iC>=0 && c[iC]) ? c[iC].trim() : 'Sem categoria',
      qty: qty, unit: unit, total: total,
      pay: (iF>=0 && c[iF]) ? c[iF].trim() : 'Não informado'
    });
  }
  if (!out.length) throw new Error('Nenhuma venda válida encontrada. Confira a data e o valor de cada linha.');
  return {rows: out, bad: bad};
}
function salesStats(rows){
  var S = {total:0, n:rows.length, qty:0, days:{}, months:{}, wd:[0,0,0,0,0,0,0], hours:{}, prod:{}, cat:{}, pay:{}, first:null, last:null};
  rows.forEach(function(r){
    S.total += r.total; S.qty += r.qty;
    var dk = r.date.getFullYear()+'-'+sP2(r.date.getMonth()+1)+'-'+sP2(r.date.getDate());
    S.days[dk] = (S.days[dk]||0) + r.total;
    var mk = r.date.getFullYear()+'-'+sP2(r.date.getMonth()+1);
    if (!S.months[mk]) S.months[mk] = {t:0, n:0};
    S.months[mk].t += r.total; S.months[mk].n += 1;
    S.wd[r.date.getDay()] += r.total;
    if (r.hour>=0){ var h = Math.floor(r.hour/60); S.hours[h] = (S.hours[h]||0) + r.total; }
    var p = S.prod[r.prod] || (S.prod[r.prod] = {t:0, q:0});
    p.t += r.total; p.q += r.qty;
    S.cat[r.cat] = (S.cat[r.cat]||0) + r.total;
    S.pay[r.pay] = (S.pay[r.pay]||0) + r.total;
    if (!S.first || r.date<S.first) S.first = r.date;
    if (!S.last || r.date>S.last) S.last = r.date;
  });
  S.dayCount = Object.keys(S.days).length;
  S.wdDays = [0,0,0,0,0,0,0];
  Object.keys(S.days).forEach(function(k){ var p = k.split('-'); S.wdDays[new Date(+p[0], +p[1]-1, +p[2], 12).getDay()]++; });
  S.rangeDays = Math.round((new Date(S.last.getFullYear(), S.last.getMonth(), S.last.getDate()) - new Date(S.first.getFullYear(), S.first.getMonth(), S.first.getDate()))/86400000) + 1;
  return S;
}
function pctTxt(x){ return (x*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%'; }
function monthLabel(mk){ var p = mk.split('-'); return MESES[+p[1]-1].charAt(0).toUpperCase()+MESES[+p[1]-1].slice(1)+' de '+p[0]; }
function hbarHTML(items){
  var max = 0, total = 0; items.forEach(function(x){ if (x.value>max) max = x.value; total += x.value; });
  return '<div class="hbars">'+items.map(function(x){
    var w = max>0 ? (x.value/max*100) : 0;
    var tipTxt = '<b>'+esc(x.label)+'</b><br>'+esc(x.text);
    var more = pctTxt(total>0 ? x.value/total : 0)+' do total mostrado'+(x.more ? '. '+x.more : '');
    return '<div class="hbar hoverable" data-tip="'+esc(tipTxt)+'" data-more="'+esc(more)+'"><span class="lbl" title="'+esc(x.label)+'">'+esc(x.label)+'</span>'+
      '<span class="track" aria-hidden="true"><span class="fill" style="width:'+w.toFixed(1)+'%"></span></span>'+
      '<span class="val">'+esc(x.text)+'</span></div>';
  }).join('')+'</div>';
}
function salesMsg(t, err){ var m = $('sMsg'); m.textContent = t; m.className = 'msg'+(err?' error':''); m.hidden = false; }
function kpiHTML(label, value, sub, more){ return '<div class="kpi hoverable" data-tip="'+esc('<b>'+label+'</b><br>'+value)+'"'+(more?' data-more="'+esc(more)+'"':'')+'><span class="label">'+label+'</span><span class="value num">'+value+'</span><span class="sub">'+sub+'</span></div>'; }
var salesP = {y:'all', m:'all', w:'all'};
var salesTop = '10';
$('sTop').addEventListener('change', function(e){ salesTop = e.target.value; renderSales(); });
function salesCur(){ return sales.filter(function(r){ return inP(r, salesP); }); }
function renderSalesPeriod(){
  var all = sales, p = salesP;
  var years = []; all.forEach(function(r){ var y = String(r.date.getFullYear()); if (years.indexOf(y)===-1) years.push(y); });
  years.sort();
  $('sY').innerHTML = '<option value="all">Todos</option>'+years.map(function(y){ return '<option value="'+y+'"'+(y===p.y?' selected':'')+'>'+y+'</option>'; }).join('');
  var months = [];
  if (p.y!=='all') all.forEach(function(r){ if (r.date.getFullYear()===+p.y){ var m = String(r.date.getMonth()); if (months.indexOf(m)===-1) months.push(m); } });
  months.sort(function(a,b){ return a-b; });
  $('sM').innerHTML = '<option value="all">'+(p.y==='all'?'Escolha o ano':'Todos')+'</option>'+months.map(function(m){ return '<option value="'+m+'"'+(m===p.m?' selected':'')+'>'+MESES[+m].charAt(0).toUpperCase()+MESES[+m].slice(1)+'</option>'; }).join('');
  $('sM').disabled = p.y==='all';
  var weeks = [];
  if (p.m!=='all') all.forEach(function(r){ if (r.date.getFullYear()===+p.y && r.date.getMonth()===+p.m){ var k = weekKey(r.date); if (weeks.indexOf(k)===-1) weeks.push(k); } });
  weeks.sort();
  $('sW').innerHTML = '<option value="all">'+(p.m==='all'?'Escolha o mês':'Todas')+'</option>'+weeks.map(function(k){ return '<option value="'+k+'"'+(k===p.w?' selected':'')+'>'+weekLabel(k)+'</option>'; }).join('');
  $('sW').disabled = p.m==='all';
  $('sClearP').hidden = p.y==='all';
  $('sPSum').textContent = 'Mostrando '+periodName(p)+' · '+salesCur().length+' vendas';
}
$('sY').addEventListener('change', function(e){ salesP = {y:e.target.value, m:'all', w:'all'}; renderSales(); });
$('sM').addEventListener('change', function(e){ salesP = {y:salesP.y, m:e.target.value, w:'all'}; renderSales(); });
$('sW').addEventListener('change', function(e){ salesP = {y:salesP.y, m:salesP.m, w:e.target.value}; renderSales(); });
$('sClearP').addEventListener('click', function(){ salesP = {y:'all', m:'all', w:'all'}; renderSales(); });

function renderSales(){
  renderSalesPeriod();
  var has = sales.length>0, list = salesCur();
  $('sBody').hidden = !has || !list.length;
  $('sExp').disabled = !has;
  if (!has){ $('sSpan').textContent = 'Nenhuma planilha enviada'; return; }
  if (!list.length){ $('sSpan').textContent = (salesFile ? salesFile+' · ' : '')+'nenhuma venda em '+periodName(salesP); return; }
  var S = salesStats(list);
  var mKeys = Object.keys(S.months).sort();
  $('sSpan').textContent = (salesFile ? salesFile+' · ' : '')+fmtDate(S.first)+' a '+fmtDate(S.last);
  var ticket = S.total/S.n;
  $('sKpis').innerHTML =
    kpiHTML('Faturamento', brl.format(S.total), S.dayCount+' dias com venda', 'Soma de todas as vendas do período mostrado.') +
    kpiHTML('Vendas', S.n.toLocaleString('pt-BR'), (S.n/S.dayCount).toLocaleString('pt-BR',{maximumFractionDigits:1})+' por dia em média', 'Número de linhas de venda do período. Média de '+(S.n/S.dayCount).toLocaleString('pt-BR',{maximumFractionDigits:1})+' por dia com venda.') +
    kpiHTML('Ticket médio', brl.format(ticket), 'valor médio por venda', 'Faturamento dividido pelo número de vendas. Cada venda rende em média '+brl.format(ticket)+'.') +
    kpiHTML('Itens vendidos', S.qty.toLocaleString('pt-BR',{maximumFractionDigits:1}), 'quantidade total', 'Soma das quantidades. Em média, '+(S.qty/S.n).toLocaleString('pt-BR',{maximumFractionDigits:2})+' item(ns) por venda.') +
    kpiHTML('Faturamento médio por dia', brl.format(S.total/S.dayCount), 'nos dias com venda', 'Faturamento dividido pelos '+S.dayCount+' dias com venda. Dias sem venda não entram na conta.');

  /* conclusões */
  var ins = [];
  if (mKeys.length>=2){
    var a = S.months[mKeys[mKeys.length-2]].t, b = S.months[mKeys[mKeys.length-1]].t;
    var ch = a ? (b-a)/a : 0;
    ins.push({t:'Em '+monthLabel(mKeys[mKeys.length-1])+' o faturamento foi de '+brl.format(b)+', '+(ch>=0?'um aumento':'uma queda')+' de '+pctTxt(Math.abs(ch))+' em relação a '+monthLabel(mKeys[mKeys.length-2])+'.', warn: ch<0});
  }
  var wdAvg = S.wd.map(function(t,i){ return S.wdDays[i] ? t/S.wdDays[i] : null; });
  var order = [1,2,3,4,5,6,0].filter(function(i){ return wdAvg[i]!==null; });
  if (order.length>=2){
    var best = order.slice().sort(function(x,y){ return wdAvg[y]-wdAvg[x]; });
    ins.push({t:'Seu melhor dia é '+WD_NAMES[best[0]].toLowerCase()+'-feira, com média de '+brl.format(wdAvg[best[0]])+' por dia. O mais fraco é '+WD_NAMES[best[best.length-1]].toLowerCase()+', com '+brl.format(wdAvg[best[best.length-1]])+'. Vale reforçar equipe e estoque nos dias fortes.'});
  }
  var hk = Object.keys(S.hours).map(Number);
  if (hk.length){
    var top = hk.sort(function(x,y){ return S.hours[y]-S.hours[x]; })[0];
    var hTot = 0; hk.forEach(function(h){ hTot += S.hours[h]; });
    ins.push({t:'O horário de pico é entre '+top+'h e '+(top+1)+'h, com '+pctTxt(S.hours[top]/hTot)+' do faturamento que tem horário registrado. Planeje a equipe para esse intervalo.'});
  } else {
    ins.push({t:'A planilha não tem a coluna Hora. Com ela, o painel mostra os horários de pico e ajuda a dimensionar a equipe.', warn:true});
  }
  var pk = Object.keys(S.prod).sort(function(x,y){ return S.prod[y].t-S.prod[x].t; });
  var top3 = pk.slice(0,3).reduce(function(s,k){ return s+S.prod[k].t; },0);
  ins.push({t:'"'+pk[0]+'" é o produto que mais fatura: '+pctTxt(S.prod[pk[0]].t/S.total)+' do total. Os 3 primeiros somam '+pctTxt(top3/S.total)+'.', warn: top3/S.total>0.6});
  if (top3/S.total>0.6) ins.push({t:'Poucos produtos concentram a maior parte das vendas. Se algum deles faltar, o faturamento cai rápido: mantenha estoque e fornecedores de reserva para eles.', warn:true});
  var pay = Object.keys(S.pay).sort(function(x,y){ return S.pay[y]-S.pay[x]; });
  ins.push({t:'A forma de pagamento mais usada é '+pay[0]+', com '+pctTxt(S.pay[pay[0]]/S.total)+' das vendas.'});
  var card = pay.filter(function(k){ return /cart|credito|debito|maquin/i.test(k); }).reduce(function(s,k){ return s+S.pay[k]; },0);
  if (card>0) ins.push({t:'Cartões somam '+pctTxt(card/S.total)+' das vendas. Esse valor chega ao caixa descontado da taxa da operadora e em prazos diferentes: compare com o extrato bancário.'});
  var monthsN = mKeys.length || 1;
  ins.push({t:'Cada 10% de aumento no ticket médio (de '+brl.format(ticket)+' para '+brl.format(ticket*1.1)+') representaria cerca de '+brl.format(S.total/monthsN*0.1)+' a mais de faturamento por mês.'});
  if (S.rangeDays > S.dayCount){
    ins.push({t:'Há '+(S.rangeDays-S.dayCount)+' dia(s) sem vendas registradas entre '+fmtDate(S.first)+' e '+fmtDate(S.last)+'. Confira se a planilha está completa ou se a loja fechou nesses dias.', warn:true});
  }
  $('sIns').innerHTML = ins.map(function(x){
    return '<li'+(x.warn?' class="warn"':'')+'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><p>'+esc(x.t)+'</p></li>';
  }).join('');

  /* gráficos */
  $('sMonth').innerHTML = hbarHTML(mKeys.map(function(k){ return {label:monthLabel(k), value:S.months[k].t, text:brl0.format(S.months[k].t)}; }));
  $('sWeek').innerHTML = hbarHTML(order.map(function(i){ return {label:WD_NAMES[i], value:wdAvg[i], text:brl0.format(wdAvg[i])}; }));
  $('sHour').innerHTML = hk.length ? hbarHTML(hk.sort(function(x,y){ return x-y; }).map(function(h){ return {label:sP2(h)+'h às '+sP2(h+1)+'h', value:S.hours[h], text:brl0.format(S.hours[h])}; })) : '<p class="empty">Sem coluna Hora na planilha.</p>';
  $('sPay').innerHTML = hbarHTML(pay.map(function(k){ return {label:k, value:S.pay[k], text:brl0.format(S.pay[k])+' · '+pctTxt(S.pay[k]/S.total)}; }));
  var catK = Object.keys(S.cat).sort(function(x,y){ return S.cat[y]-S.cat[x]; });
  $('sCat').innerHTML = hbarHTML(catK.map(function(k){ return {label:k, value:S.cat[k], text:brl0.format(S.cat[k])+' · '+pctTxt(S.cat[k]/S.total)}; }));

  /* produtos */
  $('sProd').innerHTML = '<thead><tr><th scope="col">Produto</th><th scope="col" class="r">Quantidade</th><th scope="col" class="r">Faturamento</th><th scope="col" class="r">Participação</th></tr></thead><tbody>'+
    pk.slice(0, salesTop==='all' ? pk.length : +salesTop).map(function(k){
      var pr = S.prod[k], rank = pk.indexOf(k)+1;
      var tipP = '<b>'+esc(k)+'</b><br>'+brl.format(pr.t)+' em '+pr.q.toLocaleString('pt-BR',{maximumFractionDigits:1})+' itens';
      var moreP = '#'+rank+' em faturamento. Preço médio por item: '+brl.format(pr.t/pr.q)+'. '+pctTxt(pr.t/S.total)+' do total do período.';
      return '<tr class="hoverable" data-tip="'+esc(tipP)+'" data-more="'+esc(moreP)+'"><td>'+esc(k)+'</td><td class="r">'+pr.q.toLocaleString('pt-BR',{maximumFractionDigits:1})+'</td><td class="r">'+brl.format(pr.t)+'</td><td class="r">'+pctTxt(pr.t/S.total)+'</td></tr>';
    }).join('')+'</tbody>';

}
/* ===== Exportar relatório em PDF (gerado no navegador) ===== */
function pdfText(t){
  return String(t==null?'':t)
    .replace(/[–—]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/…/g,'...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g,'?');
}
function pdfLit(t){ return '('+pdfText(t).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')+')'; }
function wrapText(t, max){
  var words = pdfText(t).split(/\s+/), lines = [], line = '';
  words.forEach(function(w){
    if ((line+' '+w).trim().length > max){ if (line) lines.push(line); line = w; }
    else line = (line ? line+' ' : '')+w;
  });
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}
function makePdf(){
  var pages = [], ops = null, y = 0, M = 48, W = 595-96, BOTTOM = 60;
  function newPage(){ ops = []; pages.push(ops); y = 842-M; }
  function need(h){ if (y - h < BOTTOM) newPage(); }
  function put(x, yy, t, size, bold){ ops.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+x.toFixed(1)+' '+yy.toFixed(1)+' Td '+pdfLit(t)+' Tj ET'); }
  newPage();
  var doc = {
    line: function(t, size, bold, gap){
      size = size || 10; var lh = size*1.45; need(lh);
      put(M, y-size, t, size, bold); y -= lh + (gap||0);
    },
    para: function(t, size, bold, max){
      wrapText(t, max || 92).forEach(function(l){ doc.line(l, size||10, bold); });
    },
    kv: function(label, value){
      need(14.5);
      put(M, y-10, label, 10, false);
      var w = pdfText(value).length*5.2;
      put(M+W-w, y-10, value, 10, true);
      y -= 14.5;
    },
    rule: function(){ need(10); ops.push('0.6 w '+M+' '+(y-3).toFixed(1)+' m '+(M+W)+' '+(y-3).toFixed(1)+' l S'); y -= 12; },
    gap: function(h){ y -= h; },
    bytes: function(){
      var N = pages.length, objs = [], kids = [];
      for (var i=0;i<N;i++) kids.push((5+2*i)+' 0 R');
      objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
      objs[2] = '<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+N+' >>';
      objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
      objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
      pages.forEach(function(pg, i){
        var pid = 5+2*i, cid = 6+2*i;
        pg.push('BT /F1 8 Tf '+M+' 28 Td '+pdfLit('Página '+(i+1)+' de '+N)+' Tj ET');
        var content = pg.join('\n');
        objs[pid] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+cid+' 0 R >>';
        objs[cid] = '<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream';
      });
      var out = '%PDF-1.4\n', offs = [];
      for (var k=1;k<objs.length;k++){ offs[k] = out.length; out += k+' 0 obj\n'+objs[k]+'\nendobj\n'; }
      var xref = out.length;
      out += 'xref\n0 '+objs.length+'\n0000000000 65535 f \n';
      for (var j=1;j<objs.length;j++) out += String(offs[j]).padStart(10,'0')+' 00000 n \n';
      out += 'trailer\n<< /Size '+objs.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
      var b = new Uint8Array(out.length);
      for (var q=0;q<out.length;q++) b[q] = out.charCodeAt(q) & 255;
      return b;
    }
  };
  return doc;
}
function saveBytes(name, bytes, mime){
  return useDownloads().then(function(dl){
    if (!dl){
      if (window.claude) return 'unavailable';
      try{
        var url = URL.createObjectURL(new Blob([bytes], {type: mime}));
        var a = document.createElement('a'); a.href = url; a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1000);
        return 'saved';
      }catch(e){ return 'unavailable'; }
    }
    return dl.save({filename: name, data: bytes}).then(function(){ return 'saved'; }, function(err){
      return (err && err.code==='declined') ? 'declined' : 'unavailable';
    });
  }, function(){ return 'unavailable'; });
}
function exportPdf(){
  var all = function(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); };
  var txt = function(el){ return el ? el.textContent.replace(/\s+/g,' ').trim() : ''; };
  var file = state.fileName || 'Extrato';
  var nums = all('#dNums .kpi').map(function(k){ return {l: txt(k.querySelector('.label')), v: txt(k.querySelector('.value'))}; });
  var acoes = state.pdfAcoes || [];
  var semAcao = state.pdfSemAcao || '';
  var barras = state.pdfBarras || [];
  var ins = all('#dIns li').map(txt);
  var months = all('#pMonths .mchip:not([aria-hidden])').map(function(c){ return {l: txt(c.querySelector('.ml')), v: txt(c.querySelector('.mv'))}; });
  var now = new Date();
  var doc = makePdf();
  doc.line('sobrou. · Relatório de despesas', 18, true, 4);
  doc.line('Extrato: '+pdfText(file), 10);
  doc.line('Período: '+Periodo.nome(state.p)+(txt($('dSpan')) ? ' · '+txt($('dSpan')) : ''), 10);
  doc.line('Gerado em '+fmtDate(now)+' às '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'), 9, false, 6);
  doc.rule();
  doc.para(txt($('dVerT'))+' '+txt($('dVerTx')), 12, true, 80);
  if (txt($('dVerPesa'))) doc.para(txt($('dVerPesa')), 10, false, 92);
  doc.gap(4);
  nums.forEach(function(k){ doc.kv(k.l, k.v); });
  if ($('dInterno').dataset.texto) doc.para($('dInterno').dataset.texto, 10, false, 92);
  doc.gap(10);
  doc.line('O que fazer agora', 13, true, 4);
  if (acoes.length) acoes.forEach(function(a){ doc.para('- '+a[0]+': '+a[1]+(a[2] ? ' '+a[2] : ''), 10, false, 92); doc.gap(3); });
  else doc.para(semAcao, 10, false, 92);
  doc.gap(8);
  if (barras.length){
    doc.line('Para onde vai o dinheiro', 13, true, 4);
    if (state.dashCats) doc.para('Categorias analisadas: '+state.dashCats.join(', ')+'.', 9, false, 100);
    barras.forEach(function(b){ doc.kv(b.l, b.v); });
    doc.gap(10);
  }
  if (state.pdfMeses){
    doc.line(state.pdfMeses.titulo, 13, true, 4);
    state.pdfMeses.linhas.forEach(function(m){ doc.kv(m.l, m.v); });
    doc.gap(10);
  } else if (months.length){
    doc.line('Resultado por mês', 13, true, 4);
    months.forEach(function(m){ doc.kv(m.l, m.v); });
    doc.gap(10);
  }
  if (ins.length){
    doc.line('Outras informações', 13, true, 4);
    ins.forEach(function(t){ doc.para('- '+t, 10, false, 92); doc.gap(3); });
  }
  var name = 'relatorio-despesas-'+now.toISOString().slice(0,10)+'.pdf';
  return saveBytes(name, doc.bytes(), 'application/pdf');
}
$('pdfBtn').addEventListener('click', function(){
  exportPdf().then(function(res){ saveResultMsg(res, 'Relatório em PDF salvo.'); });
});

function csvCell(v){ var s = String(v==null?'':v); return /[";\n\r]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
function fallbackDownload(name, text){
  try{
    var blob = new Blob([text], {type:'text/csv;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1000);
    return true;
  }catch(e){ return false; }
}
function useDownloads(){
  try{ return (window.claude && window.claude.use) ? Promise.resolve(window.claude.use('downloads')) : Promise.resolve(null); }
  catch(e){ return Promise.resolve(null); }
}
function downloadCSV(name, rows){
  var text = '\uFEFF' + rows.map(function(r){ return r.map(csvCell).join(';'); }).join('\r\n');
  return useDownloads().then(function(dl){
    if (!dl) return window.claude ? 'unavailable' : (fallbackDownload(name, text) ? 'saved' : 'unavailable');
    return dl.save({filename: name, data: text}).then(function(){ return 'saved'; }, function(err){
      if (err && err.code==='declined') return 'declined';
      return 'unavailable';
    });
  }, function(){ return window.claude ? 'unavailable' : (fallbackDownload(name, text) ? 'saved' : 'unavailable'); });
}
function saveResultMsg(res, ok){
  if (res==='saved') toast(ok);
  else if (res==='declined') toast('Download cancelado.');
  else toast('O download não está liberado nesta visualização. Permita downloads para esta página ou use a cópia do painel que você baixou.');
}
function exportSalesTemplate(){
  downloadCSV('modelo-planilha-vendas.csv', [['Data','Hora','Produto','Categoria','Quantidade','Valor unitário','Valor total','Forma de pagamento']])
    .then(function(res){ saveResultMsg(res, 'Modelo salvo. Preencha uma linha por venda e envie a planilha aqui.'); });
}
function exportSalesAnalysis(){
  if (!sales.length) return;
  var S = salesStats(salesCur());
  var n = function(v){ return v.toFixed(2).replace('.',','); };
  var rows = [['Análise de vendas', salesFile || '', periodName(salesP), fmtDate(S.first)+' a '+fmtDate(S.last)], [],
    ['Resumo'], ['Faturamento', n(S.total)], ['Vendas', S.n], ['Itens', S.qty], ['Ticket médio', n(S.total/S.n)], ['Dias com venda', S.dayCount], [],
    ['Mês','Faturamento','Vendas']];
  Object.keys(S.months).sort().forEach(function(k){ rows.push([monthLabel(k), n(S.months[k].t), S.months[k].n]); });
  rows.push([], ['Dia da semana','Faturamento','Média por dia com venda']);
  [1,2,3,4,5,6,0].forEach(function(i){ if (S.wdDays[i]) rows.push([WD_NAMES[i], n(S.wd[i]), n(S.wd[i]/S.wdDays[i])]); });
  rows.push([], ['Produto','Quantidade','Faturamento','Participação']);
  Object.keys(S.prod).sort(function(x,y){ return S.prod[y].t-S.prod[x].t; }).forEach(function(k){
    rows.push([k, S.prod[k].q, n(S.prod[k].t), (S.prod[k].t/S.total*100).toFixed(1).replace('.',',')+'%']);
  });
  rows.push([], ['Forma de pagamento','Faturamento']);
  Object.keys(S.pay).forEach(function(k){ rows.push([k, n(S.pay[k])]); });
  rows.push([], ['Categoria','Faturamento']);
  Object.keys(S.cat).forEach(function(k){ rows.push([k, n(S.cat[k])]); });
  downloadCSV('analise-vendas-'+new Date().toISOString().slice(0,10)+'.csv', rows)
    .then(function(res){ saveResultMsg(res, 'Análise exportada em CSV.'); });
}
function readSalesFile(f){
  if (!f) return;
  if (/\.pdf$/i.test(f.name)){ salesMsg('PDF ainda não é aceito. Envie a planilha em CSV ou Excel.', true); return; }
  var isSheet = /\.(xlsx?|ods)$/i.test(f.name);
  var p = isSheet ? xlsxToCsv(f) : readText(f,'UTF-8').then(function(t){
    return t.indexOf(String.fromCharCode(0xFFFD))!==-1 ? readText(f,'ISO-8859-1') : t;
  });
  p.then(function(text){
    var r = parseSales(text);
    sales = r.rows; salesFile = f.name; salesP = {y:'all', m:'all', w:'all'};
    var msg = r.rows.length+' vendas lidas de '+f.name+'.'+(r.bad ? ' '+r.bad+' linha(s) ignorada(s) por falta de data, produto ou valor.' : '');
    if ($('sSave').checked){
      saveCurrentSales(f.name, $('sSavePage').value || null).then(function(id){ state.savedId = id; renderSaved(); },
        function(e){ $('sSum').textContent = msg+' Não foi possível salvar: '+e.message; });
    }
    renderSales(); renderSaved(); refreshTabs();
    $('sSum').textContent = msg;
    $('sMsg').hidden = true;
    $('sResult').hidden = false;
  }).catch(function(e){ salesMsg(e.message || 'Não foi possível ler a planilha.', true); });
}
/* nenhum extrato escolhido: esconde as abas do painel e volta ao Início */
function fecharExtrato(){
  state.loaded = false; state.savedId = null; state.raw = []; state.tx = []; state.overrides = {}; state.resumo = null; state.eco = null;
  refreshTabs(); setView(); renderSaved();
}
function refreshTabs(){
  document.querySelectorAll('a.dash-tab').forEach(function(a){
    var v = a.dataset.view;
    a.hidden = MODE==='vendas' ? !(v==='dashboard' && sales.length>0) : !(MODE==='despesas' && state.loaded);
  });
  var d = document.querySelector('a.tab[data-view="dashboard"]');
  if (d) d.querySelector('.tab-txt').textContent = MODE==='vendas' ? 'Análise de vendas' : 'Dashboard';  /* o ícone fica */
}
document.querySelectorAll('.modo-card').forEach(function(b){ b.addEventListener('click', function(){ setMode(b.dataset.modo); }); });
$('modoTrocar').addEventListener('click', function(){ setMode(null); });
$('sTpl').addEventListener('click', exportSalesTemplate);
$('sExp').addEventListener('click', exportSalesAnalysis);
$('sFile').addEventListener('change', function(e){ readSalesFile(e.target.files[0]); e.target.value=''; });

function setView(){
  var h = location.hash.slice(1);
  var isV = MODE==='vendas', isD = MODE==='despesas';
  var ok = isV ? sales.length>0 : (isD && state.loaded);
  var okHash = isV ? h==='dashboard' : (isD && (h==='dashboard'||h==='economia'||h==='despesas'||h==='categorias'||h==='lancamentos'));
  var v = (ok && okHash) ? h : 'inicio';
  if (v==='inicio' && h && h!=='inicio'){ location.hash = 'inicio'; return; }
  $('viewEnviar').hidden = v!=='inicio';
  $('viewDash').hidden = !(v==='dashboard' && isD);
  $('viewVendas').hidden = !(v==='dashboard' && isV);
  $('viewEconomia').hidden = !(v==='economia' && isD);
  var chegouDesp = v==='despesas' && $('viewDespesas').hidden;
  $('viewDespesas').hidden = v!=='despesas';
  if (chegouDesp && state.loaded){ $('xSaiu').dataset.alvo = ''; render(); }   /* chegar: desenha na largura real e com movimento */
  $('viewCategorias').hidden = v!=='categorias';
  $('viewLanc').hidden = v!=='lancamentos';
  if (v!=='lancamentos' && state.editLanc){ state.editLanc = false; if (state.loaded) renderTable(); }
  $('introSec').hidden = v==='inicio' || isV;
  $('pageTitle').textContent = {dashboard:'Dashboard', economia:'Economia', despesas:'Despesas', lancamentos:'Lançamentos', categorias:'Organizar'}[v] || '';
  $('periodSec').hidden = !((v==='dashboard' && isD) || v==='despesas' || v==='lancamentos');
  if ($('periodSec').hidden) $('pCmp').hidden = true;
  /* em Lançamentos o Período fica dentro do quadro dos lançamentos; nas outras, no lugar de sempre */
  var ps = $('periodSec'), ms = $('mesesSec');
  if (v==='lancamentos' && ps.parentNode!==$('lancPeriodo')){ $('lancPeriodo').appendChild(ps); $('lancPeriodo').appendChild(ms); ps.classList.add('embutido'); ms.classList.add('embutido'); }
  else if (v!=='lancamentos' && ps.parentNode===$('lancPeriodo')){ $('introSec').insertAdjacentElement('afterend', ps); ps.insertAdjacentElement('afterend', ms); ps.classList.remove('embutido'); ms.classList.remove('embutido'); }
  ms.hidden = ps.hidden;
  if (!$('periodSec').hidden) ajustarEsteira();
  $('tip').hidden = true;
  document.querySelectorAll('a.tab[data-view]').forEach(function(a){
    if (a.dataset.view===v) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current');
  });
}
function setMode(m){
  MODE = m || null;
  state.page = null; state.editingPage = null; state.menuFor = null; state.movingSaved = null; state.editingSaved = null; state.savedId = null;
  var isV = MODE==='vendas', isD = MODE==='despesas';
  $('modoSel').hidden = !!MODE || !VENDAS_ATIVO;
  $('modoTop').hidden = !MODE || !VENDAS_ATIVO;
  $('modeArea').hidden = !MODE;
  $('upTitle').textContent = isV ? 'Vendas' : 'Início';
  $('upDesc').textContent = isV ? 'Envie a planilha de vendas. O painel mostra faturamento, produtos, horários e formas de pagamento.' : (isD ? 'Descubra quanto sobra no fim do mês.' : 'O que você quer analisar?');
  $('modoName').textContent = isV ? 'Vendas' : 'Despesas';
  mostrarInicio();
  renderSaved();
  recarregarSalvos().catch(function(e){ state.salvosProntos = true; renderSaved(); falhou(e); });
  refreshTabs();
  setView();
}


var ICON_INFO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7.5v.01"></path></svg>';
var ICON_WARN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"></path><path d="M12 10v4M12 17v.01"></path></svg>';

function renderTable(){
  var q = norm(state.q).trim();
  var fc = state.fcat || 'all';
  var opts = '<option value="all">Todas</option><option value="__in">Entradas</option>'+catsCom(fc==='all'||fc==='__in' ? null : fc).map(function(c){return '<option'+(c===fc?' selected':'')+'>'+esc(c)+'</option>';}).join('');
  $('fCat').innerHTML = opts; $('fCat').value = fc;
  /* comparando: lançamentos de A ou de B, com o filtro "Os dois · A · B" */
  var cmp = state.cmp, per = cmp ? (state.txPer || 'ambos') : null, CA = null, CB = null;
  if (cmp){ CA = dadosPeriodo(cmp.a); CB = dadosPeriodo(cmp.b); }
  $('lCmpTopo').hidden = !cmp;
  $('txPerCmp').hidden = !cmp;
  document.querySelectorAll('#viewLanc .col-per').forEach(function(th){ th.hidden = !cmp; });
  if (cmp){
    $('lCmpTopo').innerHTML = htmlTopoComparacao(CA, CB);
    $('txPerCmp').innerHTML = [['ambos','Os dois'],['a',CA.nome],['b',CB.nome]].map(function(o){ return '<button type="button" data-per="'+o[0]+'" aria-pressed="'+(per===o[0])+'">'+esc(o[1])+'</button>'; }).join('');
  }
  var emA = function(t){ return Periodo.contem(t.date, cmp.a); }, emB = function(t){ return Periodo.contem(t.date, cmp.b); };
  var base = !cmp ? cur() : state.tx.filter(function(t){ return per==='a' ? emA(t) : per==='b' ? emB(t) : (emA(t) || emB(t)); });
  var list = base.filter(function(t){
    if (fc==='__in' && ehSaida(t)) return false;
    var fcInterna = INTERNOS.indexOf(fc)!==-1;  /* categoria interna: entradas (resgates) e saídas juntas */
    if (fc!=='all' && fc!=='__in' && ((ehEntrada(t) && !fcInterna) || catOf(t)!==fc)) return false;
    if (state.filter==='out' && ehEntrada(t) && !fcInterna) return false;
    if (state.filter==='in' && ehSaida(t)) return false;
    return !q || norm(t.desc).indexOf(q)!==-1;
  });
  /* editar a categoria aqui só depois de ligar "Editar categorias" */
  var ed = !!state.editLanc, eb = $('editLanc');
  eb.setAttribute('aria-pressed', ed ? 'true' : 'false');
  eb.textContent = ed ? 'Concluir edição' : 'Editar categorias';
  eb.classList.toggle('primary', ed);
  $('txHint').innerHTML = ed ? 'Edição ligada: escolha a nova categoria na coluna <b>Categoria</b>.' : 'Para corrigir uma categoria, clique em <b>Editar categorias</b>.';
  /* quantos lançamentos por vez; 0 = todos. Sempre começa em 10 */
  var por = [10,25,50,100,0].indexOf(state.txPor)!==-1 ? state.txPor : 10;
  $('txPor').value = String(por);
  var chave = [fc, state.filter, q, JSON.stringify(state.p), JSON.stringify(cmp), per, list.length].join('|');
  if (chave!==state.txChave){ state.txChave = chave; state.txPag = 0; }  /* filtro mudou: volta ao começo */
  var nPag = por ? Math.max(1, Math.ceil(list.length/por)) : 1;
  state.txPag = Math.min(state.txPag||0, nPag-1);
  var ini = por ? state.txPag*por : 0, shown = por ? list.slice(ini, ini+por) : list;
  $('txPrev').hidden = $('txNext').hidden = nPag<=1;
  $('txPrev').disabled = state.txPag===0; $('txNext').disabled = state.txPag>=nPag-1;
  $('rows').innerHTML = shown.map(function(t){
    var c = ehEntrada(t) ? null : catOf(t);
    var ci = ehInterno(t) ? catOf(t) : ENTRADA;
    var catCell = ehEntrada(t) ? (ed
      ? '<span class="rule-cell"><select data-id="'+t.id+'" aria-label="Categoria de '+esc(t.desc)+'">'+[ENTRADA].concat(INTERNOS).map(function(x){ return '<option'+(x===ci?' selected':'')+'>'+esc(x)+'</option>'; }).join('')+'</select></span>'
      : ci===ENTRADA ? '<span class="in">Entrada</span>' : '<span class="why">'+esc(ci)+'</span>') :
      ed ? '<span class="rule-cell"><select data-id="'+t.id+'" aria-label="Categoria de '+esc(t.desc)+'">'+catsCom(c).map(function(x){ return '<option'+(x===c?' selected':'')+'>'+esc(x)+'</option>'; }).join('')+'<option value="'+NOVA_CAT+'">+ Criar nova categoria…</option></select></span>' :
      '<span class="why'+(c===OTHER?' none':'')+'">'+esc(c)+'</span>';
    if (t.estorno) catCell += ' <span class="why estorno" data-tip="Dinheiro de volta de uma despesa: desconta do total da categoria">estorno</span>';
    var perCell = cmp ? '<td>'+(emA(t) ? '<span class="tag-per tag-per-a">'+esc(CA.nome)+'</span>' : '')+(emB(t) ? '<span class="tag-per tag-per-b">'+esc(CB.nome)+'</span>' : '')+'</td>' : '';
    return '<tr><td class="num">'+fmtDate(t.date)+'</td>'+perCell+'<td>'+esc(t.desc)+'</td><td>'+catCell+'</td><td class="r num">'+brl.format(t.value)+'</td></tr>';
  }).join('') || '<tr><td colspan="'+(cmp ? 5 : 4)+'">Nenhum lançamento encontrado.</td></tr>';
  var tot = list.reduce(function(s,t){return s+t.value;},0);
  if (cmp){
    /* rodapé comparando: soma de cada período (das linhas filtradas) e a diferença por mês */
    var la = list.filter(emA), lb = list.filter(emB);
    var sa = la.reduce(function(s2,t){ return s2+t.value; }, 0), sb = lb.reduce(function(s2,t){ return s2+t.value; }, 0);
    var dm = sa/CA.divisor - sb/CB.divisor;
    var partes = [];
    if (per!=='b') partes.push(CA.nome+': '+brl.format(sa)+' ('+la.length+')');
    if (per!=='a') partes.push(CB.nome+': '+brl.format(sb)+' ('+lb.length+')');
    if (per==='ambos') partes.push('por mês: '+(dm>=0.005 ? '+' : dm<=-0.005 ? '−' : '')+brl.format(Math.abs(dm)));
    $('foot').textContent = (nPag>1 ? 'Mostrando '+(ini+1)+' a '+(ini+shown.length)+' de '+list.length+' · ' : '')+partes.join(' · ');
    return;
  }
  $('foot').textContent = (nPag>1 ? 'Mostrando '+(ini+1)+' a '+(ini+shown.length)+' de '+list.length+' lançamentos' : list.length+(list.length===1?' lançamento':' lançamentos'))+' · soma: '+brl.format(tot)+' · '+Periodo.nome(state.p)+'.';
}

/* ---------- events ---------- */
$('file').addEventListener('change', function(e){ readFiles(e.target.files); e.target.value=''; });
var drop = $('drop');
/* só arquivos acendem a área: arrastar um extrato da lista não conta */
function temArquivos(e){ var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files')!==-1; }
['dragenter','dragover'].forEach(function(ev){ drop.addEventListener(ev, function(e){ if (!temArquivos(e)) return; e.preventDefault(); drop.classList.add('over'); }); });
['dragleave','drop'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); }); });
drop.addEventListener('drop', function(e){
  if (!temArquivos(e) || !e.dataTransfer.files.length) return;
  var files = Array.prototype.slice.call(e.dataTransfer.files);
  if (semMovimento()){ readFiles(files); return; }
  drop.classList.add('soltou');   /* o ícone desce e some, como se a área engolisse o arquivo */
  setTimeout(function(){ drop.classList.remove('soltou'); readFiles(files); }, 300);
});
document.querySelectorAll('.table-tools .seg:not(#txPerCmp) button').forEach(function(b){
  b.addEventListener('click', function(){
    state.filter = b.dataset.f;
    document.querySelectorAll('.table-tools .seg:not(#txPerCmp) button').forEach(function(x){ x.setAttribute('aria-pressed', x===b ? 'true':'false'); });
    renderTable();
  });
});
$('q').addEventListener('input', function(e){ state.q = e.target.value; renderTable(); });
$('fCat').addEventListener('change', function(e){
  state.fcat = e.target.value;
  if (state.fcat==='__in'){ state.filter='all'; }
  else if (state.fcat!=='all'){ state.filter='out'; }
  document.querySelectorAll('.table-tools .seg:not(#txPerCmp) button').forEach(function(x){ x.setAttribute('aria-pressed', x.dataset.f===state.filter ? 'true':'false'); });
  renderTable();
});
$('catList').addEventListener('click', function(e){
  var b = e.target.closest('[data-cat]'); if (!b) return;
  /* escolher uma categoria sempre mostra "De onde veio" */
  keepScroll(function(){ state.cat = b.dataset.cat; showSub('origem'); renderCategorias(); });
});
var askState = null;
var KIND_LABEL = {'criar-pagina':'criar página', 'renomear-pagina':'renomear página', 'excluir-pagina':'excluir página', 'mover-extrato':'mover extrato de página', 'renomear-extrato':'renomear extrato', 'reclass-local':'mudar a categoria só neste extrato', reclass:'mudar a categoria de lançamentos', criar:'criar categoria', editar:'editar categoria', 'excluir-categoria':'excluir categoria', restaurar:'restaurar categoria padrão', 'excluir-regra':'excluir regra', 'excluir-extrato':'excluir extrato salvo', 'excluir-vendas':'remover vendas da planilha', 'apagar-dados':'apagar todos os seus dados'};
function savePrefs(){ API.salvarPreferencia('confirmacoes', state.askPrefs).catch(falhou); }
var toastTimer = null;
function toast(t){ var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.hidden = true; }, 6000); }
function renderPrefNotes(){
  var keys = Object.keys(state.askPrefs || {});
  document.querySelectorAll('.pref-note-slot').forEach(function(pn){
    if (!keys.length){ pn.hidden = true; pn.innerHTML = ''; return; }
    pn.hidden = false;
    var list = keys.map(function(k){ return KIND_LABEL[k] || k; }).join(', ');
    var rc = state.askPrefs.reclass ? ' Mudanças de categoria estão sendo aplicadas como <b>'+({yes:'regra para os próximos extratos', alt:'todos da mesma origem, só neste extrato'}[state.askPrefs.reclass] || 'só neste extrato')+'</b>.' : '';
    pn.innerHTML = '<span><b>Confirmação desligada</b> para: '+esc(list)+'.'+rc+'</span><button type="button" class="btn" data-askreset="1">Voltar a perguntar</button>';
  });
}
document.addEventListener('click', function(e){
  if (!e.target.closest || !e.target.closest('[data-askreset]')) return;
  state.askPrefs = {}; savePrefs(); renderPrefNotes();
  toast('Pronto: o painel volta a pedir confirmação antes de cada alteração.');
});
/* o: kind, title, text, yes, no?, cancel?, danger?, skipHelp?, onYes, onNo?, onCancel?, back? */
function askX(o){
  var pref = state.askPrefs[o.kind];
  if (pref==='yes' || (pref==='no' && o.onNo) || (pref==='alt' && o.onAlt)){
    if (pref==='yes') o.onYes(); else if (pref==='alt') o.onAlt(); else o.onNo();
    toast('Feito sem confirmação, como você escolheu. Para voltar a confirmar, use Configurações, no topo da página.');
    return;
  }
  $('askT').textContent = o.title; $('askD').textContent = o.text;
  $('askYes').textContent = o.yes; $('askYes').className = 'btn '+(o.danger ? 'danger-solid' : 'primary');
  $('askNo').hidden = !o.no; if (o.no) $('askNo').textContent = o.no;
  $('askAlt').hidden = !o.alt; if (o.alt) $('askAlt').textContent = o.alt;
  $('askCancel').textContent = o.cancel || 'Cancelar';
  $('askSkip').checked = false; $('askSkipHelp').hidden = true;
  $('askSkipHelp').textContent = o.skipHelp || 'Da próxima vez, esta ação será feita direto, sem pedir confirmação. Dá para voltar a perguntar em Configurações, no topo da página.';
  askState = {o:o, back:o.back || document.activeElement};
  $('askBg').hidden = false; hideTip();
  $('askYes').focus({preventScroll:true});
}
function closeAsk(choice){
  var a = askState; if (!a) return;
  askState = null; $('askBg').hidden = true;
  if ((choice==='yes' || choice==='no' || choice==='alt') && $('askSkip').checked){ state.askPrefs[a.o.kind] = choice; savePrefs(); renderPrefNotes(); }
  if (choice==='yes') a.o.onYes(); else if (choice==='alt') a.o.onAlt(); else if (choice==='no') a.o.onNo(); else if (a.o.onCancel) a.o.onCancel();
  if (a.back && a.back.focus && document.body.contains(a.back)) a.back.focus({preventScroll:true});
}
$('askYes').addEventListener('click', function(){ closeAsk('yes'); });
$('askNo').addEventListener('click', function(){ closeAsk('no'); });
$('askAlt').addEventListener('click', function(){ closeAsk('alt'); });
$('askCancel').addEventListener('click', function(){ closeAsk('cancel'); });
$('askSkip').addEventListener('change', function(e){ $('askSkipHelp').hidden = !e.target.checked; });
$('askBg').addEventListener('click', function(e){ if (e.target===$('askBg')) closeAsk('cancel'); });
document.addEventListener('keydown', function(e){
  if (!askState) return;
  if (e.key==='Escape'){ e.preventDefault(); closeAsk('cancel'); return; }
  if (e.key==='Tab'){
    var f = [$('askYes'), $('askAlt'), $('askNo'), $('askCancel'), $('askSkip')].filter(function(x){ return !x.hidden; });
    var i = f.indexOf(document.activeElement);
    e.preventDefault(); f[(i + (e.shiftKey ? f.length-1 : 1) + f.length) % f.length].focus();
  }
});
var RECLASS_HELP = 'As próximas mudanças de categoria vão usar esta mesma resposta automaticamente, sem confirmação. Isso pode criar regras sem você perceber.';
/* troca a categoria de um lançamento (abas Organizar e Lançamentos) */
function mudarCategoria(e){
  var s = e.target.closest('select[data-id]'); if (!s) return;
  var t = state.tx[+s.dataset.id];
  if (s.value===NOVA_CAT){ irCriarCategoria(t); return; }
  perguntarMudanca(t, s.value, s);
}
/* pergunta se a categoria nova vale só para este lançamento, para a origem neste
   extrato ou também nos próximos; back = onde o foco volta ao fechar */
function perguntarMudanca(t, to, back){
  /* mesma origem = mesma descrição, ignorando números (datas, códigos) */
  var mesma = state.tx.filter(function(x){ return ehEntrada(x)===ehEntrada(t) && x.origin===t.origin; });
  var n = mesma.length;
  var regraAtual = state.rules[t.origin] ? state.rules[t.origin].cat : null;
  var pode = Analise.regraProximos({ entrada:ehEntrada(t), para:to, regraAtual:regraAtual, internos:INTERNOS,
    outroSentido: state.tx.some(function(x){ return x.origin===t.origin && ehEntrada(x)!==ehEntrada(t); }) });
  if (!pode){
    /* a regra mudaria (ou apagaria) a dos lançamentos do outro sentido: só neste extrato */
    var soEste = function(){ state.overrides[t.id] = to; ruleMsg('"'+t.desc+'" mudou para '+to+' só neste extrato.'); render(); };
    var todos = function(){ mesma.forEach(function(x){ state.overrides[x.id] = to; }); ruleMsg(n+' lançamentos de "'+t.desc+'" mudaram para '+to+' só neste extrato.'); render(); };
    askX({ kind:'reclass-local', title:'Mudar a categoria de quais lançamentos?',
      text:'Você mudou "'+t.desc+'" para '+to+'. Essa origem também tem '+(ehEntrada(t) ? 'saídas' : 'entradas')+', então a mudança vale só neste extrato, para não mudar as '+(ehEntrada(t) ? 'saídas' : 'entradas')+' sem você ver.',
      yes: n>1 ? 'Todos dessa origem, só neste extrato ('+n+')' : 'Só este lançamento',
      no: n>1 ? 'Só este lançamento' : null,
      cancel:'Cancelar mudança', back:back,
      onYes: n>1 ? todos : soEste, onNo: n>1 ? soEste : null, onCancel:render });
    return;
  }
  askX({ kind:'reclass', title:'Mudar a categoria de quais lançamentos?',
    text:'Você mudou "'+t.desc+'" para '+to+'.'+(n>1 ? ' Neste extrato há '+n+' lançamentos dessa mesma origem.' : '')+' Se escolher os próximos extratos, sempre que essa origem aparecer ela já vem como '+to+'.',
    yes:'Todos dessa origem, também nos próximos extratos',
    alt: n>1 ? 'Todos dessa origem, só neste extrato ('+n+')' : null,
    no:'Só este lançamento', cancel:'Cancelar mudança', skipHelp:RECLASS_HELP, back:back,
    onYes:function(){ setRule(t.origin, t.desc, to).then(render, function(e){ falhou(e); render(); }); },
    onAlt: n>1 ? function(){
      mesma.forEach(function(x){ state.overrides[x.id] = to; });
      ruleMsg(n+' lançamentos de "'+t.desc+'" mudaram para '+to+' só neste extrato.'); render();
    } : null,
    onNo:function(){ state.overrides[t.id] = to; ruleMsg('"'+t.desc+'" mudou para '+to+' só neste extrato.'); render(); },
    onCancel:render });
}
$('cdRows').addEventListener('change', mudarCategoria);
$('rows').addEventListener('change', mudarCategoria);
/* "+ Criar nova categoria…" em Lançamentos: vai para Organizar › Nova categoria e,
   depois de criar, volta para o mesmo lugar e aplica a categoria ao lançamento */
var NOVA_CAT = '__nova', CRIAR_PARA = null;
function irCriarCategoria(t){
  CRIAR_PARA = { id:t.id, pag:state.txPag, y:window.scrollY };
  renderTable();  /* o seletor volta para a categoria atual */
  $('ncPara').innerHTML = 'Criando uma categoria para "<b>'+esc(t.desc)+'</b>". Depois de criar, você volta para Lançamentos. '+
    '<button type="button" class="btn btn-sm ghost" data-ncvoltar="1">Cancelar e voltar</button>';
  $('ncPara').hidden = false;
  showSub('nova');  /* aba "Criar categoria" de Organizar */
  showNc('new');
  state.depois = function(){ $('ncPara').scrollIntoView({block:'center'}); $('ncName').focus({preventScroll:true}); };
  irPara('categorias');
}
function esquecerCriacao(){ CRIAR_PARA = null; $('ncPara').hidden = true; $('ncPara').innerHTML = ''; }
function voltarParaLancamentos(categoria){
  var p = CRIAR_PARA; esquecerCriacao();
  if (!p) return;
  state.txPag = p.pag;
  state.depois = function(){
    window.scrollTo(0, p.y);
    var t = state.tx[p.id], linha = document.querySelector('#rows select[data-id="'+p.id+'"]');
    if (categoria && t) perguntarMudanca(t, categoria, linha);
  };
  irPara('lancamentos');
}
$('ncPara').addEventListener('click', function(e){ if (e.target.closest('[data-ncvoltar]')) voltarParaLancamentos(null); });
$('editLanc').addEventListener('click', function(){ state.editLanc = !state.editLanc; renderTable(); });
$('txPor').addEventListener('change', function(){ state.txPor = +this.value; state.txPag = 0; renderTable(); });
$('txPrev').addEventListener('click', function(){ state.txPag--; renderTable(); $('txTitle').scrollIntoView({block:'start'}); });
$('txNext').addEventListener('click', function(){ state.txPag++; renderTable(); $('txTitle').scrollIntoView({block:'start'}); });
$('origins').addEventListener('change', function(e){
  var s = e.target.closest('select'); if (!s) return;
  var key = s.dataset.origin, from = state.cat, to = s.value;
  var sample = state.tx.filter(function(t){return t.origin===key;})[0], label = sample ? sample.desc : key;
  var podeO = Analise.regraProximos({ entrada:false, para:to, regraAtual: state.rules[key] ? state.rules[key].cat : null, internos:INTERNOS,
    outroSentido: state.tx.some(function(t){ return t.origin===key && ehEntrada(t); }) });
  if (!podeO){
    state.tx.forEach(function(t){ if (ehSaida(t) && t.origin===key && catOf(t)===from) state.overrides[t.id] = to; });
    ruleMsg('Pagamentos de "'+label+'" mudaram para '+to+' só neste extrato: essa origem também tem entradas, que não foram mudadas.'); render();
    return;
  }
  askX({ kind:'reclass', title:'Manter esta mudança nos próximos extratos?',
    text:'Você moveu todos os pagamentos de "'+label+'" para '+to+'. Se manter, os próximos extratos também vão classificar essa origem como '+to+'.',
    yes:'Sim, manter nos próximos extratos', no:'Não, só neste extrato', cancel:'Cancelar mudança', skipHelp:RECLASS_HELP, back:s,
    onYes:function(){ setRule(key, label, to).then(render, function(e){ falhou(e); render(); }); },
    onNo:function(){ this.onAlt(); },
    onAlt:function(){  /* aqui "só neste extrato" já é todos dessa origem */
      state.tx.forEach(function(t){ if (ehSaida(t) && t.origin===key && catOf(t)===from) state.overrides[t.id] = to; });
      ruleMsg('Pagamentos de "'+label+'" mudaram para '+to+' só neste extrato.'); render();
    },
    onCancel:render });
});
$('ncKw').addEventListener('input', previewKws);
$('catQ').addEventListener('input', function(e){ state.catQ = e.target.value; renderCustom(); });
function showNc(which){
  $('ncNew').hidden = which!=='new'; $('ncList').hidden = which!=='list';
  $('tabNcNew').setAttribute('aria-selected', which==='new' ? 'true':'false');
  $('tabNcList').setAttribute('aria-selected', which==='list' ? 'true':'false');
}
document.querySelector('.subseg').addEventListener('click', function(e){
  var b = e.target.closest('[data-nc]'); if (b) keepScroll(function(){ showNc(b.dataset.nc); });
});
$('ncForm').addEventListener('submit', function(e){
  e.preventDefault();
  var name = $('ncName').value.replace(/\s+/g,' ').trim();
  var err = $('ncErr');
  if (!name){ err.textContent = 'Dê um nome para a categoria.'; err.hidden = false; $('ncName').focus(); return; }
  if (norm(name)===norm(ENTRADA)){ err.textContent = '"Entrada" é um nome usado pelo sistema. Escolha outro nome.'; err.hidden = false; $('ncName').focus(); return; }
  var exists = allCats().some(function(c){ return norm(c)===norm(name); });
  if (exists){ err.textContent = 'Já existe uma categoria chamada "'+name+'". Escolha outro nome.'; err.hidden = false; $('ncName').focus(); return; }
  err.hidden = true;
  var kws = parseKws($('ncKw').value), type = $('ncTypeFix').checked ? 'fixo' : 'variavel';
  askX({ kind:'criar', title:'Criar a categoria "'+name+'"?',
    text:'Tipo: '+(type==='fixo'?'custo fixo':'custo variável')+'. '+(kws.length ? 'Palavras-chave: '+kws.join(', ')+'.' : 'Sem palavras-chave.')+' Ela ficará disponível em todos os extratos.',
    yes:'Criar categoria', cancel:'Voltar ao formulário', onYes:function(){ doCreate(name, type, kws); } });
});
function doCreate(name, type, kws){
  API.criarCategoria({ nome:name, tipo:type, palavras:kws }).then(function(c){
    state.custom.push(categoriaLocal(c));
    refreshFixed();
    return reclassify();
  }).then(function(){
    var n = state.tx.filter(function(t){ return ehSaida(t) && catOf(t)===name; }).length;
    $('ncName').value = ''; $('ncKw').value = ''; $('ncTypeVar').checked = true; $('ncPreview').textContent = '';
    ruleMsg('Categoria "'+name+'" criada.'+(kws.length ? ' '+n+(n===1?' lançamento foi classificado':' lançamentos foram classificados')+' nela pelas palavras-chave.' : ' Use "Mover para" ou a tabela de lançamentos para colocar despesas nela.'));
    render();
    showNc('list');
    if (CRIAR_PARA) voltarParaLancamentos(name);
  }).catch(falhou);
}
$('customList').addEventListener('submit', function(e){
  e.preventDefault();
  var f = e.target, id = f.dataset.id, err = $('ecErr');
  var d = allDefs().filter(function(x){ return x.id===id; })[0]; if (!d) return;
  var orig = d.name;
  var name = $('ecName').value.replace(/\s+/g,' ').trim();
  if (!name){ err.textContent = 'Dê um nome para a categoria.'; err.hidden = false; $('ecName').focus(); return; }
  var clash = allCats().some(function(c){ return c!==orig && norm(c)===norm(name); });
  if (clash){ err.textContent = 'Já existe uma categoria chamada "'+name+'". Escolha outro nome.'; err.hidden = false; $('ecName').focus(); return; }
  var type = $('ecFix') ? ($('ecFix').checked ? 'fixo' : 'variavel') : d.type;
  var kwTxt = $('ecKw').value;
  var changes = [];
  if (name!==orig) changes.push('nome: "'+orig+'" para "'+name+'"');
  if (type!==d.type) changes.push('tipo: '+(type==='fixo'?'custo fixo':'custo variável'));
  if (kwTxt.trim()!==d.kws.join(', ')) changes.push('palavras-chave alteradas');
  if (!changes.length){ state.editingCat = null; renderCustom(); return; }
  askX({ kind:'editar', title:'Salvar alterações em "'+orig+'"?', text:'Mudanças: '+changes.join('; ')+'. A classificação dos lançamentos será refeita.',
    yes:'Salvar alterações', cancel:'Continuar editando', onYes:function(){ doEdit(d, id, orig, name, type, kwTxt); } });
});
function doEdit(d, id, orig, name, type, kwTxt){
  var pedido;
  if (d.builtin){
    var prev = state.bEdits[bKey(d.codigo)] || {};
    var kwsChanged = kwTxt.trim() !== d.kws.join(', ');
    var ed = { name:name, type:type, kws: kwsChanged ? parseKws(kwTxt) : (prev.kws || null) };
    pedido = API.editarPadrao(d.codigo, { nome:ed.name, tipo:ed.type, palavras:ed.kws })
      .then(function(){ state.bEdits[bKey(d.codigo)] = ed; });
  } else {
    pedido = API.editarCategoria(id, { nome:name, tipo:type, palavras:parseKws(kwTxt) })
      .then(function(){ state.custom.forEach(function(c){ if (c.id===id){ c.name = name; c.type = type; c.kws = parseKws(kwTxt); } }); });
  }
  pedido.then(function(){
    renameCat(orig, name);
    refreshFixed();
    return reclassify();
  }).then(function(){
    state.editingCat = null;
    ruleMsg('Categoria "'+name+'" atualizada'+(name!==orig ? ' (antes "'+orig+'"). Regras e correções foram levadas para o novo nome.' : '.'));
    render();
  }).catch(falhou);
}
$('customList').addEventListener('click', function(e){
  var ed = e.target.closest('[data-cedit]');
  if (ed){ state.editingCat = ed.dataset.cedit; renderCustom(); var n = $('ecName'); if (n){ n.focus(); n.select(); } return; }
  if (e.target.closest('[data-ccancel]')){ state.editingCat = null; renderCustom(); return; }
  var rs = e.target.closest('[data-creset]');
  if (rs){
    var bd = allDefs().filter(function(x){ return x.id===rs.dataset.creset; })[0]; if (!bd) return;
    var cur = bd.name, def = curRules().filter(function(r){ return r.codigo===bd.codigo; })[0].nome;
    if (norm(cur)!==norm(def) && allCats().some(function(c){ return c!==cur && norm(c)===norm(def); })){ ruleMsg('Não dá para restaurar: já existe outra categoria chamada "'+def+'".'); return; }
    askX({ kind:'restaurar', title:'Restaurar "'+cur+'" ao padrão?', text:'O nome volta a ser "'+def+'", e o tipo de custo e as palavras-chave voltam aos originais do sistema.',
      yes:'Restaurar padrão', back:rs, onYes:function(){
        API.restaurarPadrao(bd.codigo).then(function(){
          delete state.bEdits[bKey(bd.codigo)];
          renameCat(cur, def); refreshFixed();
          return reclassify();
        }).then(function(){
          ruleMsg('Categoria "'+def+'" voltou ao padrão do sistema.');
          render();
        }).catch(falhou);
      } });
    return;
  }
  var d = e.target.closest('[data-cdel]'); if (!d) return;
  var cd = state.custom.filter(function(c){ return c.id===d.dataset.cdel; })[0]; if (!cd) return;
  var name = cd.name;
  var nL = state.tx.filter(function(t){ return ehSaida(t) && catOf(t)===name; }).length;
  var nR = Object.keys(state.rules).filter(function(k){ return state.rules[k].cat===name; }).length;
  askX({ kind:'excluir-categoria', danger:true, title:'Excluir a categoria "'+name+'"?',
    text:(nL ? nL+(nL===1?' lançamento volta':' lançamentos voltam')+' para a classificação automática. ' : '')+(nR ? nR+(nR===1?' regra ligada a ela também será excluída. ':' regras ligadas a ela também serão excluídas. ') : '')+'Isso não pode ser desfeito.',
    yes:'Excluir categoria', back:d, onYes:function(){
      API.excluirCategoria(cd.id).then(function(){
        state.custom = state.custom.filter(function(c){ return c.id!==cd.id; });
        Object.keys(state.rules).forEach(function(k){ if (state.rules[k].cat===name) delete state.rules[k]; });
        Object.keys(state.overrides).forEach(function(k){ if (state.overrides[k]===name) delete state.overrides[k]; });
        lastOv = JSON.stringify(mapaCorrecoes());  /* o servidor já apagou essas correções */
        refreshFixed();
        return reclassify();
      }).then(function(){
        ruleMsg('Categoria "'+name+'" excluída. Os lançamentos dela voltaram para a classificação automática.');
        render();
      }).catch(falhou);
    } });
});
function showSub(sub){
  state.sub = sub;
  [['origem','subOrigem','tabOrigem'],['lanc','subLanc','tabLanc'],['regras','subRegras','tabRegras'],['nova','subNova','tabNova']].forEach(function(x){
    $(x[1]).hidden = x[0]!==sub; $(x[2]).setAttribute('aria-selected', x[0]===sub ? 'true':'false');
  });
}
document.querySelector('.subnav').addEventListener('click', function(e){
  var b = e.target.closest('[data-sub]'); if (b) keepScroll(function(){ showSub(b.dataset.sub); });
});
$('rulesList').addEventListener('click', function(e){
  var d = e.target.closest('[data-rdel]'); if (!d) return;
  var r = state.rules[d.dataset.rdel]; if (!r) return;
  askX({ kind:'excluir-regra', danger:true, title:'Excluir esta regra?', text:'"'+r.label+'" deixa de ser classificado sempre como '+r.cat+' e volta para a classificação automática, neste e nos próximos extratos.',
    yes:'Excluir regra', back:d, onYes:function(){
      var origem = d.dataset.rdel;
      API.excluirRegra(origem).then(function(){
        delete state.rules[origem];
        ruleMsg('Regra excluída. Os lançamentos voltaram para a classificação automática.');
        render();
      }).catch(falhou);
    } });
});
$('pW').addEventListener('change', function(e){
  var v = e.target.value, p = state.p;
  escolherPeriodo(v==='all' ? {tipo:'mes', y:p.y, m:p.m} : {tipo:'semana', w:v, y:p.y, m:p.m});
});
$('pAtalhos').addEventListener('click', function(e){
  if (e.target.closest('[data-acao="cmp"]')){ if ($('pCmp').hidden) abrirComparar(); else fecharComparar(); return; }
  if (e.target.closest('[data-acao="pers"]')){ if ($('pPers').hidden) abrirPersonalizado(); else fecharPersonalizado(); return; }
  var b = e.target.closest('[data-atalho]'); if (!b) return;
  var a = (state.atalhos || []).filter(function(x){ return x.id===b.dataset.atalho; })[0];
  if (a) escolherPeriodo(JSON.parse(JSON.stringify(a.p)));
});
$('rPeriod').addEventListener('change', function(){ resRange = this.value; renderDashboard(); });
/* ---------- Período › Personalizado… (meses inteiros ou dias exatos) ---------- */
function persAba(aba){
  state.persAba = aba;
  $('pPersMeses').setAttribute('aria-selected', aba==='meses' ? 'true' : 'false');
  $('pPersDias').setAttribute('aria-selected', aba==='dias' ? 'true' : 'false');
  $('pPersPMeses').hidden = aba!=='meses'; $('pPersPDias').hidden = aba!=='dias';
}
function abrirPersonalizado(){
  var meses = mesesDoExtrato(), p = state.p;
  if (!meses.length) return;
  var opt = meses.map(function(k){ var a = k.split('-'); return '<option value="'+k+'">'+MESES[+a[1]-1].slice(0,3)+'/'+a[0]+'</option>'; }).join('');
  $('pDeM').innerHTML = opt; $('pAteM').innerHTML = opt;
  var deK = meses[Math.max(0, meses.length-3)], ateK = meses[meses.length-1];
  if (p.tipo==='intervalo'){ deK = p.de.slice(0,7); ateK = p.ate.slice(0,7); }
  else if (p.tipo==='mes' || p.tipo==='semana'){ deK = ateK = p.y+'-'+String(p.m+1).padStart(2,'0'); }
  $('pDeM').value = deK; $('pAteM').value = ateK;
  var datas = state.tx.map(function(t){ return Periodo.iso(t.date); }).sort();
  ['pDeD','pAteD'].forEach(function(id){ $(id).min = datas[0]; $(id).max = datas[datas.length-1]; });
  $('pDeD').value = p.tipo==='intervalo' && p.dias ? p.de : ''; $('pAteD').value = p.tipo==='intervalo' && p.dias ? p.ate : '';
  persAba(p.tipo==='intervalo' && p.dias ? 'dias' : 'meses');
  $('pPersErro').hidden = true;
  $('pPers').hidden = false;
  (state.persAba==='dias' ? $('pDeD') : $('pDeM')).focus();
}
function fecharPersonalizado(){ $('pPers').hidden = true; var b = $('pPersBtn'); if (b) b.focus(); }
$('pPersRapidos').addEventListener('click', function(e){
  var b = e.target.closest('[data-atalho]'); if (!b) return;
  var a = (state.atalhos || []).filter(function(x){ return x.id===b.dataset.atalho; })[0];
  if (!a) return;
  $('pPers').hidden = true;
  escolherPeriodo(JSON.parse(JSON.stringify(a.p)));
  var pb = $('pPersBtn'); if (pb) pb.focus();
});
$('pPersMeses').addEventListener('click', function(){ persAba('meses'); });
$('pPersDias').addEventListener('click', function(){ persAba('dias'); });
$('pPersCancelar').addEventListener('click', fecharPersonalizado);
$('pPers').addEventListener('keydown', function(e){ if (e.key==='Escape') fecharPersonalizado(); });
$('pPersAplicar').addEventListener('click', function(){
  var p, erro = null;
  if (state.persAba==='dias'){
    var de = Periodo.lerData($('pDeD').value), ate = Periodo.lerData($('pAteD').value);
    var Lx = extratoLimites();
    if (!de || !ate) erro = 'Digite as duas datas no formato dd/mm/aaaa (uma data que existe).';
    else if (de<Lx.inicio || ate>Lx.fim) erro = 'Escolha datas entre '+Periodo.ddmmaaaa(Lx.inicio)+' e '+Periodo.ddmmaaaa(Lx.fim)+'.';
    else p = Periodo.deDias(de, ate);
  } else p = Periodo.deMeses($('pDeM').value, $('pAteM').value);
  if (!erro && p.tipo==='intervalo' && !p.dias && $('pDeM').value>$('pAteM').value) erro = 'Escolha a data final depois da inicial.';
  if (!erro) erro = Periodo.validar(p, state.tx.filter(function(t){ return Periodo.contem(t.date, p); }).length);
  if (erro){ $('pPersErro').textContent = erro; $('pPersErro').hidden = false; return; }
  p.rotulo = 'Personalizado';
  $('pPers').hidden = true;
  escolherPeriodo(p);
  var b = $('pPersBtn'); if (b) b.focus();
});
/* ---------- Comparar dois períodos (só no Dashboard) ---------- */
/* números de um período, pelas mesmas contas do Dashboard (por mês) */
function dadosPeriodo(p){
  var tx = state.tx.filter(function(t){ return Periodo.contem(t.date, p); });
  var T = sums(tx), cat = {}, ms = {};
  tx.forEach(function(t){ ms[Periodo.chaveDe(t.date)] = 1; if (saiDaConta(t)){ var c = catOf(t); cat[c] = (cat[c]||0) - t.value; } });
  var nome = Periodo.curto(p), divisor = Periodo.fatorMes(p, Object.keys(ms).length).divisor, aviso = null;
  /* o extrato cobre só parte do período (começa ou termina no meio): por mês estimado pelos dias com dados */
  var L = extratoLimites(), cov = L.inicio ? Periodo.cobertura(p, L.inicio, L.fim) : null, lim = Periodo.limites(p);
  var estimado = false;
  if (cov && cov.parcial && cov.dias>0){
    var total = Periodo.cobertura(p, lim.de, lim.ate).dias;
    estimado = cov.dias/total < 0.8;   /* falta mais de 20% do período: estima o por mês pelos dias com dados */
    if (estimado) divisor = cov.dias/30;
    var ddmm = function(x){ return x.slice(8,10)+'/'+x.slice(5,7); };
    aviso = nome+' só tem dados '+(cov.de!==lim.de ? 'desde '+ddmm(cov.de)+(cov.ate!==lim.ate ? ' ' : '') : '')+(cov.ate!==lim.ate ? 'até '+ddmm(cov.ate) : '');
  }
  return { nome:nome, ins:T.ins, outs:T.outs, divisor:divisor, cat:cat, n:tx.length, aviso:aviso, estimado:estimado, dias: cov ? cov.dias : 0 };
}
/* avisos da comparação: mês incompleto e períodos que se sobrepõem */
function avisosComparacao(A, B){
  var av = [A, B].filter(function(d){ return d.aviso; }).map(function(d){ return d.aviso+(d.estimado ? ' (o valor por mês é uma estimativa a partir desses dias).' : '.'); });
  if (Periodo.sobrepoe(state.cmp.a, state.cmp.b)) av.push('Os períodos se sobrepõem.');
  return av;
}
/* a faixa "Comparando A × B · Sair" (Dashboard, Despesas e Lançamentos) */
function htmlTopoComparacao(A, B){
  var av = avisosComparacao(A, B);
  return 'Comparando <b class="cmp-p1">'+esc(A.nome)+'</b> × <b class="cmp-p2">'+esc(B.nome)+'</b> · <button type="button" class="link-btn" data-sair>Sair da comparação</button>'+
    (av.length ? '<span class="cmp-aviso">'+av.map(esc).join(' ')+'</span>' : '');
}
function maiorCat(cat){ var m = null; Object.keys(cat).forEach(function(c){ if (c!==OTHER && cat[c]>0 && (!m || cat[c]>cat[m])) m = c; }); return m; }
/* ---------- Despesas comparando: cada faixa com os dois períodos, sempre por mês ---------- */
function renderDespesasComparacao(){
  var A = dadosPeriodo(state.cmp.a), B = dadosPeriodo(state.cmp.b), r = Periodo.comparar(A, B);
  $('dCmpTopoDesp').innerHTML = htmlTopoComparacao(A, B);
  $('xVazio').hidden = true; $('xTopo').hidden = false; $('xCats').hidden = false;
  var ma = A.outs/A.divisor, mb = B.outs/B.divisor, d = ma-mb;
  contarAte($('xSaiu'), ma, function(v){ return 'Saiu '+brl.format(v)+' por mês'; });
  $('xSaiuSub').innerHTML = '<b class="cmp-p1">'+esc(A.nome)+'</b> · '+esc(B.nome)+': '+brl.format(mb)+' · <span class="'+(d>0.5 ? 'neg' : d<-0.5 ? 'pos' : '')+'">'+(d>=0.005 ? '+' : d<=-0.005 ? '−' : '')+brl.format(Math.abs(d))+'</span>';
  var da = Despesas.divisao(A.cat, FIXED, A.outs), db = Despesas.divisao(B.cat, FIXED, B.outs);
  $('xTopo').dataset.total = A.outs.toFixed(2);
  $('xDiv').innerHTML = '<i class="x-fix" style="width:'+da.pFixas+'%"></i><i class="x-dia" style="width:'+da.pDia+'%"></i>';
  $('xDivLeg').innerHTML = '<span data-fixas="'+da.fixas.toFixed(2)+'" data-pct="'+da.pFixas+'"><i class="sw x-fix"></i>Contas fixas '+brl.format(da.fixas/A.divisor)+'/mês ('+da.pFixas+'%) · '+esc(B.nome)+': '+db.pFixas+'%</span>'+
    '<span data-dia="'+da.dia.toFixed(2)+'" data-pct="'+da.pDia+'"><i class="sw x-dia"></i>Dia a dia '+brl.format(da.dia/A.divisor)+'/mês ('+da.pDia+'%) · '+esc(B.nome)+': '+db.pDia+'%</span>';
  /* categorias: barras duplas por mês, na ordem do Período 1; clicar leva aos lançamentos */
  var cats = r.categorias.slice().sort(function(x, y){ return (y.a-x.a) || (y.b-x.b); });
  var max = cats.reduce(function(m, c){ return Math.max(m, c.a, c.b); }, 0) || 1;
  $('xCatsH').textContent = 'Por mês, '+A.nome+' × '+B.nome+' · clique para ver os lançamentos';
  $('xCatList').innerHTML = cats.map(function(c){
    return '<li class="x-cat-li cat-cmp"><button type="button" class="x-cat" data-cat="'+esc(c.nome)+'" aria-label="Ver os lançamentos de '+esc(c.nome)+'">'+
      '<span class="name">'+esc(c.nome)+'</span><span class="amt num"><span class="cmp-p1">'+brl0.format(c.a)+'</span> · <span class="cmp-p2">'+brl0.format(c.b)+'</span> <b class="cmp-txt '+(c.dif>0 ? 'neg' : 'pos')+'">'+esc(c.txt)+'</b></span>'+
      '<span class="cmp-barra" aria-hidden="true"><i class="cmp-a" style="width:'+(c.a/max*100).toFixed(2)+'%"></i><i class="cmp-b" style="width:'+(c.b/max*100).toFixed(2)+'%"></i></span></button></li>';
  }).join('') || '<li class="cmp-vazio">Nenhuma saída nos dois períodos.</li>';
  $('xCatTodas').hidden = true;
  renderFluxoComparacao(A, B);
  /* o que mudou: Período 2 (antes) → Período 1, por mês */
  var pm = function(D){ var o = {}; Object.keys(D.cat).forEach(function(k){ o[k] = D.cat[k]/D.divisor; }); return o; };
  var mu = Despesas.mudancas(pm(B), pm(A), 2);
  $('xMudou').hidden = !(mu.subiram.length + mu.cairam.length);
  $('xMudouH').textContent = A.nome+' contra '+B.nome+', por mês';
  var pil = function(x, cls){ return '<button type="button" class="x-pil '+cls+'" data-cat="'+esc(x.nome)+'">'+esc(x.nome)+' <b>'+(x.d>0 ? '+' : '−')+brl0.format(Math.abs(x.d))+'/mês ('+esc(x.txt)+')</b></button>'; };
  $('xMudouL').innerHTML = mu.subiram.map(function(x){ return pil(x, 'sobe'); }).join('')+mu.cairam.map(function(x){ return pil(x, 'cai'); }).join('');
  /* maiores gastos: os 3 maiores de cada período, com a etiqueta */
  var top3 = function(per, cls, nome){
    return Analise.maioresGastos(state.tx.filter(function(t){ return saiDaConta(t) && !t.estorno && Periodo.contem(t.date, per); })
      .map(function(t){ return {data:t.date, desc:t.desc, valor:-t.value, chave:t.origin}; }), 3)
      .map(function(g){ return '<li><button type="button" data-gasto="'+esc(g.desc)+'" title="Ver nos lançamentos"><span class="gdt">'+fmtDate(g.data)+'</span><span class="gd"><span class="tag-per '+cls+'">'+esc(nome)+'</span> '+esc(g.desc)+'</span><span class="gv">'+brl.format(g.valor)+'</span></button></li>'; }).join('');
  };
  var gl = top3(state.cmp.a, 'tag-per-a', A.nome)+top3(state.cmp.b, 'tag-per-b', B.nome);
  $('xGastos').hidden = !gl; $('xGastosL').innerHTML = gl;
  /* resumo da comparação */
  var frases = Periodo.resumoComparacao(r, A, B, maiorCat(A.cat), maiorCat(B.cat)).map(function(t){ return {w:false, t:t}; })
    .concat(avisosComparacao(A, B).map(function(t){ return {w:true, t:t}; }));
  $('xResumo').hidden = !frases.length;
  $('xResumoL').innerHTML = frases.map(function(i){ return '<li class="'+(i.w?'warn':'')+'">'+(i.w?ICON_WARN:ICON_INFO)+'<p>'+esc(i.t)+'</p></li>'; }).join('');
}
/* Fluxo comparando: duas linhas de saídas alinhadas por posição (1º, 2º, 3º…) */
function renderFluxoComparacao(A, B){
  var pa = state.cmp.a, pb = state.cmp.b;
  var un = Periodo.posicoes(pa, 'mes').length>=2 && Periodo.posicoes(pb, 'mes').length>=2 ? 'mes'
    : (pa.tipo==='semana' || pb.tipo==='semana') ? 'dia' : 'semana';
  var serie = function(p){
    var pos = Periodo.posicoes(p, un), soma = {};
    state.tx.forEach(function(t){
      if (!saiDaConta(t) || !Periodo.contem(t.date, p)) return;
      var k = un==='mes' ? Periodo.chaveDe(t.date) : un==='semana' ? weekKey(t.date) : Periodo.iso(t.date);
      soma[k] = (soma[k]||0) - t.value;
    });
    /* cada unidade: coberta inteira pelo período e pelo extrato? (senão "parcial"; sem nenhum dia → "sem dados") */
    var L = extratoLimites(), lp = Periodo.limites(p);
    return pos.map(function(x){
      var de = un==='mes' ? x.chave+'-01' : x.chave, ate = un==='mes' ? Periodo.limites(Periodo.deMeses(x.chave, x.chave)).ate : un==='semana' ? Periodo.iso(new Date(+x.chave.slice(0,4), +x.chave.slice(5,7)-1, +x.chave.slice(8,10)+6)) : x.chave;
      var cde = [de, lp.de, L.inicio].sort()[2], cate = [ate, lp.ate, L.fim].sort()[0];
      if (cde>cate) return {rotulo:x.rotulo, v:null};
      return {rotulo:x.rotulo, v:soma[x.chave]||0, parcial: cde!==de || cate!==ate};
    });
  };
  var sa = serie(pa), sb = serie(pb), n = Math.max(sa.length, sb.length, 1);
  var W=Math.max(320, larguraDe('xCats')-34),H=240,mL=72,mR=12,mT=12,mB=30, iw=W-mL-mR, ih=H-mT-mB;
  var max = Math.max.apply(null, sa.concat(sb).map(function(x){ return x.v||0; }).concat([1]));
  var raw = max/4, mag = Math.pow(10,Math.floor(Math.log10(raw))), nn = raw/mag;
  var step = (nn<=1?1:nn<=2?2:nn<=2.5?2.5:nn<=5?5:10)*mag, top = Math.ceil(max/step)*step;
  var x = function(i){ return n===1 ? mL+iw/2 : mL + iw*i/(n-1); }, y = function(v){ return mT + ih - v/top*ih; };
  var s = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Saídas de '+esc(A.nome)+' e de '+esc(B.nome)+', lado a lado">';
  for (var v=0; v<=top+1e-6; v+=step){
    var yy = y(v).toFixed(1);
    s += '<line class="'+(v===0?'base':'gl')+'" x1="'+mL+'" x2="'+(W-mR)+'" y1="'+yy+'" y2="'+yy+'"></line>';
    s += '<text x="'+(mL-8)+'" y="'+yy+'" dy="0.32em" text-anchor="end">'+(v>=1000? 'R$ '+(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil' : 'R$ '+v)+'</text>';
  }
  /* a linha se interrompe onde não há dados */
  var linha = function(se, cls){
    var trechos = [[]];
    se.forEach(function(pt, i){ if (pt.v===null){ if (trechos[trechos.length-1].length) trechos.push([]); } else trechos[trechos.length-1].push(x(i).toFixed(1)+','+y(pt.v).toFixed(1)); });
    return trechos.filter(function(t){ return t.length; }).map(function(t){ return '<polyline class="'+cls+'" fill="none" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="'+t.join(' ')+'"></polyline>'; }).join('');
  };
  s += linha(sb, 'fluxo-b') + linha(sa, 'fluxo-a');
  var passo = n>18 ? 3 : n>9 ? 2 : 1, uni = un==='mes' ? 'mês' : un==='semana' ? 'semana' : 'dia';
  for (var i=0; i<n; i++){
    if (i % passo===0) s += '<text x="'+x(i).toFixed(1)+'" y="'+(H-10)+'" text-anchor="middle">'+(i+1)+'º</text>';
    var dica = function(pt, nome){ if (!pt) return esc(nome)+': —'; var r = (un==='semana' ? 'semana de ' : '')+pt.rotulo; return esc(r)+': '+(pt.v===null ? 'sem dados' : brl.format(pt.v)+(pt.parcial ? ' (parcial)' : '')); };
    var tip = '<b>'+(i+1)+'º '+uni+'</b><br>'+dica(sa[i], A.nome)+'<br>'+dica(sb[i], B.nome);
    var w = iw/n;
    s += '<rect class="hit" x="'+Math.max(mL, x(i)-w/2).toFixed(1)+'" y="'+mT+'" width="'+w.toFixed(1)+'" height="'+ih+'" data-tip="'+esc(tip)+'"></rect>';
  }
  $('xMesesG').innerHTML = s+'</svg>';
  $('xMesesT').textContent = {mes:'Gastos mês a mês', semana:'Gastos semana a semana', dia:'Gastos dia a dia'}[un];
  $('xMesesH').innerHTML = '<span class="x-leg-cmp"><i class="sw" style="background:var(--accent)"></i>'+esc(A.nome)+'</span> <span class="x-leg-cmp"><i class="sw" style="background:var(--s2)"></i>'+esc(B.nome)+'</span> · por posição (1º, 2º…)';
  $('xMeses').hidden = false;
}
function renderComparacao(){
  var on = !!state.cmp;
  $('dCmpModo').hidden = !on;
  $('dashBank').classList.toggle('comparando', on);
  $('pdfBtn').hidden = on;
  if (!on) return;
  var A = dadosPeriodo(state.cmp.a), B = dadosPeriodo(state.cmp.b), r = Periodo.comparar(A, B);
  $('dCmpTopo').innerHTML = htmlTopoComparacao(A, B);
  $('dCmpVer').className = 'card verdict faixa '+r.veredito.cor;
  $('dCmpVer').textContent = r.veredito.texto;
  $('dCmpA').textContent = A.nome; $('dCmpB').textContent = B.nome;
  var dif = function(l){ return (l.dif>=0.005 ? '+' : l.dif<=-0.005 ? '−' : '')+brl.format(Math.abs(l.dif)); };
  $('dCmpTab').tBodies[0].innerHTML = r.linhas.map(function(l){
    return '<tr><th scope="row">'+l.rotulo+'</th><td class="num" data-v="'+l.a+'">'+brl.format(l.a)+'</td><td class="num" data-v="'+l.b+'">'+brl.format(l.b)+'</td>'+
      '<td class="num '+(l.bom===true ? 'pos' : l.bom===false ? 'neg' : '')+'">'+dif(l)+'</td></tr>';
  }).join('');
  var cats = state.cmpTodas ? r.categorias : r.categorias.slice(0, 6);
  var max = r.categorias.reduce(function(m, c){ return Math.max(m, c.a, c.b); }, 0) || 1;
  $('dCmpCats').innerHTML = cats.length ? cats.map(function(c){
    return '<li><button type="button" class="cmp-cat-n" data-cat="'+esc(c.nome)+'" title="Ver os lançamentos no Período 1">'+esc(c.nome)+'</button>'+
      '<span class="cmp-barra" aria-hidden="true"><i class="cmp-a" data-w="'+(c.a/max*100).toFixed(2)+'" style="width:'+(c.a/max*100).toFixed(2)+'%"></i><i class="cmp-b" data-w="'+(c.b/max*100).toFixed(2)+'" style="width:'+(c.b/max*100).toFixed(2)+'%"></i></span>'+
      '<span class="cmp-vals"><span class="cmp-p1">'+brl0.format(c.a)+'</span> · <span class="cmp-p2">'+brl0.format(c.b)+'</span>/mês</span>'+
      '<span class="cmp-txt '+(c.dif>0 ? 'neg' : 'pos')+'">'+esc(c.txt)+'</span></li>';
  }).join('') : '<li class="cmp-vazio">Nenhuma saída nos dois períodos.</li>';
  $('dCmpTodas').hidden = r.categorias.length<=6;
  $('dCmpTodas').textContent = state.cmpTodas ? 'Ver menos' : 'Ver todas as '+r.categorias.length;
  var fmt = function(x){ return esc(x.nome)+' '+(x.dif>0 ? '+' : '−')+brl0.format(Math.abs(x.dif))+'/mês'; };
  var partes = [];
  if (r.mudou.altas.length) partes.push('<b>Subiu:</b> '+r.mudou.altas.map(fmt).join(' · '));
  if (r.mudou.quedas.length) partes.push('<b>Caiu:</b> '+r.mudou.quedas.map(fmt).join(' · '));
  $('dCmpMudou').innerHTML = '<b class="faixa-t">O que mais mudou</b> '+(partes.join(' &nbsp; ') || 'Nada mudou de um período para o outro.');
  if (state.cmpNovo){ state.cmpNovo = false; animarComparacao(); }
}
/* ao entrar na comparação: números contam do zero e as barras crescem */
function animarComparacao(){
  if (semMovimento()) return;
  var barras = Array.prototype.slice.call(document.querySelectorAll('#dCmpCats .cmp-barra i'));
  barras.forEach(function(b){ b.style.transition = 'none'; b.style.width = '0%'; });
  void $('dCmpCats').offsetWidth;
  barras.forEach(function(b, i){ b.style.transition = 'width .6s cubic-bezier(.2,.7,.2,1) '+(Math.floor(i/2)*40)+'ms'; b.style.width = b.dataset.w+'%'; });
  var cel = Array.prototype.slice.call(document.querySelectorAll('#dCmpTab td[data-v]'));
  var finais = cel.map(function(c){ return c.textContent; }), token = state.cmpToken = (state.cmpToken||0)+1, ini = null;
  if (!window.requestAnimationFrame) return;
  var passo = function(t){
    if (token!==state.cmpToken) return;
    if (ini===null) ini = t;
    var p = Math.min(1, (t-ini)/800), k = 1-Math.pow(1-p, 3);
    cel.forEach(function(c, i){ c.textContent = p<1 ? brl.format(+c.dataset.v*k) : finais[i]; });
    if (p<1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
function sairComparacao(){ if (!state.cmp) return; state.cmp = null; render(); }
$('dCmpModo').addEventListener('click', function(e){
  if (e.target.closest('[data-sair]')){ sairComparacao(); return; }
  var c = e.target.closest('[data-cat]');
  if (c) abrirLancamentos(c.dataset.cat);   /* continua comparando */
});
$('lCmpTopo').addEventListener('click', function(e){ if (e.target.closest('[data-sair]')) sairComparacao(); });
$('txPerCmp').addEventListener('click', function(e){ var b = e.target.closest('[data-per]'); if (!b) return; state.txPer = b.dataset.per; renderTable(); var nb = document.querySelector('#txPerCmp [data-per="'+state.txPer+'"]'); if (nb) nb.focus(); });
$('dCmpTopoDesp').addEventListener('click', function(e){ if (e.target.closest('[data-sair]')) sairComparacao(); });
$('dCmpTodas').addEventListener('click', function(){ state.cmpTodas = !state.cmpTodas; renderComparacao(); });
function cmpAba(aba){
  state.cmpAba = aba;
  $('pCmpMeses').setAttribute('aria-selected', aba==='meses' ? 'true' : 'false');
  $('pCmpDias').setAttribute('aria-selected', aba==='dias' ? 'true' : 'false');
  document.querySelectorAll('#pCmp .p-cmp-linha').forEach(function(l){ l.hidden = l.dataset.modo!==aba; });
}
function abrirComparar(){
  var meses = mesesDoExtrato(); if (meses.length<2) return;
  $('pPers').hidden = true;
  var opt = meses.map(function(k){ var a = k.split('-'); return '<option value="'+k+'">'+MESES[+a[1]-1].slice(0,3)+'/'+a[0]+'</option>'; }).join('');
  ['pC1De','pC1Ate','pC2De','pC2Ate'].forEach(function(id){ $(id).innerHTML = opt; });
  var U = meses.length-1, c = state.cmp;
  var chaveP = function(p, ini){ if (!p) return null; if (p.tipo==='intervalo') return ini ? p.de.slice(0,7) : p.ate.slice(0,7); if (p.tipo==='mes' || p.tipo==='semana') return p.y+'-'+String(p.m+1).padStart(2,'0'); return null; };
  $('pC1De').value = chaveP(c && c.a, true) || meses[U]; $('pC1Ate').value = chaveP(c && c.a, false) || meses[U];
  $('pC2De').value = chaveP(c && c.b, true) || meses[U-1]; $('pC2Ate').value = chaveP(c && c.b, false) || meses[U-1];
  var datas = state.tx.map(function(t){ return Periodo.iso(t.date); }).sort();
  ['pC1DeD','pC1AteD','pC2DeD','pC2AteD'].forEach(function(id){ $(id).min = datas[0]; $(id).max = datas[datas.length-1]; });
  $('pCmpAtalhos').innerHTML = Periodo.atalhosComparar(meses).map(function(a){ return '<button type="button" class="ptab ini-pilula" data-cmp="'+a.id+'">'+esc(a.rotulo)+'</button>'; }).join('');
  state.cmpAtalhos = Periodo.atalhosComparar(meses);
  cmpAba('meses');
  $('pCmpErro').hidden = true;
  $('pCmp').hidden = false;
  $('pC1De').focus();
}
function fecharComparar(){ $('pCmp').hidden = true; var b = $('pCmpBtn'); if (b) b.focus(); }
function iniciarComparacao(a, b){
  var erro = null;
  [a, b].some(function(p){ erro = Periodo.validar(p, state.tx.filter(function(t){ return Periodo.contem(t.date, p); }).length); return !!erro; });
  if (!erro && JSON.stringify(a)===JSON.stringify(b)) erro = 'Escolha dois períodos diferentes.';
  if (!erro) [a, b].some(function(p, i){ var d = dadosPeriodo(p); if (d.aviso && d.dias<7){ erro = 'O Período '+(i+1)+' tem só '+d.dias+(d.dias===1 ? ' dia' : ' dias')+' de dados no extrato; escolha um período maior.'; } return !!erro; });
  if (erro){ $('pCmpErro').textContent = erro; $('pCmpErro').hidden = false; return; }
  $('pCmp').hidden = true;
  state.p = JSON.parse(JSON.stringify(a)); state.cmp = {a:a, b:b}; state.cmpNovo = true; state.cmpTodas = false; state.txPer = 'ambos';
  render();
}
$('pCmpMeses').addEventListener('click', function(){ cmpAba('meses'); });
$('pCmpDias').addEventListener('click', function(){ cmpAba('dias'); });
$('pCmpCancelar').addEventListener('click', fecharComparar);
$('pCmp').addEventListener('keydown', function(e){ if (e.key==='Escape') fecharComparar(); });
$('pCmpAtalhos').addEventListener('click', function(e){
  var b = e.target.closest('[data-cmp]'); if (!b) return;
  var a = (state.cmpAtalhos || []).filter(function(x){ return x.id===b.dataset.cmp; })[0];
  if (a) iniciarComparacao(a.a, a.b);
});
$('pCmpOk').addEventListener('click', function(){
  var a, b;
  if (state.cmpAba==='dias'){
    var v = ['pC1DeD','pC1AteD','pC2DeD','pC2AteD'].map(function(id){ return Periodo.lerData($(id).value); });
    var Lc = extratoLimites();
    if (v.some(function(x){ return !x; })){ $('pCmpErro').textContent = 'Digite as quatro datas no formato dd/mm/aaaa (datas que existem).'; $('pCmpErro').hidden = false; return; }
    if (v.some(function(x){ return x<Lc.inicio || x>Lc.fim; })){ $('pCmpErro').textContent = 'Escolha datas entre '+Periodo.ddmmaaaa(Lc.inicio)+' e '+Periodo.ddmmaaaa(Lc.fim)+'.'; $('pCmpErro').hidden = false; return; }
    a = Periodo.deDias(v[0], v[1]); b = Periodo.deDias(v[2], v[3]);
  } else {
    if ($('pC1De').value>$('pC1Ate').value || $('pC2De').value>$('pC2Ate').value){ $('pCmpErro').textContent = 'Escolha a data final depois da inicial.'; $('pCmpErro').hidden = false; return; }
    a = Periodo.deMeses($('pC1De').value, $('pC1Ate').value); b = Periodo.deMeses($('pC2De').value, $('pC2Ate').value);
  }
  iniciarComparacao(a, b);
});
/* ---------- configurações do site ---------- */
var cfg = {};
function saveCfg(){ API.salvarPreferencia('config', cfg).catch(falhou); }
function applyCfg(){
  var at = Tema.atributo(cfg.tema);
  if (at) document.documentElement.setAttribute('data-theme', at); else document.documentElement.removeAttribute('data-theme');
  try { localStorage.setItem(Tema.CHAVE, cfg.tema || 'auto'); } catch (e) {}
  document.documentElement.classList.toggle('texto-grande', !!cfg.textoGrande);
  document.documentElement.classList.toggle('sem-esteira', cfg.esteira===false);
}
function openCfg(){
  $('cfgTema').value = Tema.atributo(cfg.tema) ? cfg.tema : 'auto';
  $('cfgTexto').checked = !!cfg.textoGrande;
  $('cfgEsteira').checked = cfg.esteira!==false;
  var keys = Object.keys(state.askPrefs || {});
  $('cfgConf').textContent = keys.length ? 'Confirmação desligada para: '+keys.map(function(k){ return KIND_LABEL[k]||k; }).join(', ')+'.' : 'Todas as confirmações estão ligadas.';
  $('cfgConfBtn').hidden = !keys.length;
  $('cfgBg').style.display = 'flex'; $('cfgClose').focus();
}
function closeCfg(){ $('cfgBg').style.display = 'none'; $('cfgBtn').focus(); }
$('cfgBtn').addEventListener('click', openCfg);$('cfgClose').addEventListener('click', closeCfg);
$('cfgBg').addEventListener('click', function(e){ if (e.target===$('cfgBg')) closeCfg(); });
document.addEventListener('keydown', function(e){ if (e.key==='Escape' && $('cfgBg').style.display!=='none') closeCfg(); });
$('cfgTexto').addEventListener('change', function(){ cfg.textoGrande = this.checked; saveCfg(); applyCfg(); });
$('cfgEsteira').addEventListener('change', function(){ cfg.esteira = this.checked; saveCfg(); applyCfg(); });
$('cfgTema').addEventListener('change', function(){ cfg.tema = this.value; saveCfg(); applyCfg(); });
$('cfgClear').addEventListener('click', function(){
  closeCfg();
  askX({ kind:'apagar-dados', danger:true, title:'Apagar todos os seus dados?', text:'Extratos salvos, páginas, categorias, regras e configurações serão apagados da sua conta. O seu login continua existindo. Isso não pode ser desfeito.', yes:'Apagar tudo', cancel:'Cancelar', back:$('cfgBtn'),
    onYes:function(){ API.apagarTudo().then(function(){ location.reload(); }).catch(falhou); } });
});
$('pMonths').addEventListener('click', function(e){
  var b = e.target.closest('.mchip'); if (!b) return;
  var on = b.getAttribute('aria-pressed')==='true';
  escolherPeriodo(on ? {tipo:'tudo'} : {tipo:'mes', y:+b.dataset.y, m:+b.dataset.m});
});
$('pagesBar').addEventListener('click', function(e){
  var b = e.target.closest('[data-page]'); if (!b) return;
  if (b.getAttribute('aria-selected')==='true') return;
  if (MODE==='vendas'){ keepScroll(function(){ state.page = b.dataset.page==='all' ? null : b.dataset.page; state.editingPage = null; renderSaved(); }); return; }
  trocarPasta(b.dataset.page==='all' ? null : b.dataset.page);
});
/* sugestão "Pessoal e Empresa": um toque cria as pastas que faltam */
$('pastaSug').addEventListener('click', function(e){
  if (e.target.closest('[data-sugno]')){ cfg.sugestaoPastas = 'dispensada'; saveCfg(); renderSaved(); return; }
  var b = e.target.closest('[data-sug]'); if (!b) return;
  b.disabled = true;
  var faltam = Pastas.sugerir(getPages().map(function(p){ return p.name; }), false);
  faltam.reduce(function(pr, nome){ return pr.then(function(){ return API.criarPagina(nome, 'despesas'); }); }, Promise.resolve())
    .then(recarregarSalvos)
    .then(function(){ toast('Pastas criadas. Use "Mover para", no menu de cada extrato, para guardar os extratos nelas.'); })
    .catch(function(err){ b.disabled = false; falhou(err); });
});
$('soVer').addEventListener('change', function(){ $('privNota').hidden = !$('soVer').checked; });
/* ---------- busca e arrastar o extrato para uma pasta ---------- */
$('svBusca').addEventListener('input', function(){ state.busca = this.value; renderSaved(); });
$('savedList').addEventListener('dragstart', function(e){
  var li = e.target.closest && e.target.closest('.sv[draggable="true"]'); if (!li) return;
  state.arrastando = li.dataset.sv;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/x-extrato', li.dataset.sv); } catch (er) { e.dataTransfer.setData('text', li.dataset.sv); }
  li.classList.add('arrastando');
});
function limparArrasto(){
  state.arrastando = null;
  document.querySelectorAll('.sv.arrastando').forEach(function(x){ x.classList.remove('arrastando'); });
  document.querySelectorAll('#pagesBar .alvo').forEach(function(x){ x.classList.remove('alvo'); });
}
$('savedList').addEventListener('dragend', limparArrasto);
document.addEventListener('dragend', limparArrasto);   /* a linha pode ter sido redesenhada no meio do arrasto */
function etiquetaAlvo(e){
  var tipos = e.dataTransfer && e.dataTransfer.types;
  if (!state.arrastando || !tipos || Array.prototype.indexOf.call(tipos, 'text/x-extrato')===-1) return null;
  var b = e.target.closest && e.target.closest('#pagesBar [data-page]');
  return b && b.dataset.page!=='all' ? b : null;
}
$('pagesBar').addEventListener('dragover', function(e){
  var b = etiquetaAlvo(e); if (!b) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('#pagesBar .alvo').forEach(function(x){ if (x!==b) x.classList.remove('alvo'); });
  b.classList.add('alvo');
});
$('pagesBar').addEventListener('dragleave', function(e){
  var b = etiquetaAlvo(e); if (b && !b.contains(e.relatedTarget)) b.classList.remove('alvo');
});
$('pagesBar').addEventListener('drop', function(e){
  var b = etiquetaAlvo(e); if (!b) return;
  e.preventDefault();
  var id = state.arrastando, para = b.dataset.page==='none' ? null : b.dataset.page;
  limparArrasto();
  var x = getSaved().filter(function(v){ return v.id===id; })[0]; if (!x) return;
  var naPasta = x.page && getPages().some(function(p){ return p.id===x.page; }) ? x.page : null;
  if (naPasta===para) return;
  var nomeDest = para ? 'a pasta "'+pageName(para)+'"' : '"Sem pasta"';
  API.alterarExtrato(id, {pagina_id: para})
    .then(function(){ return recarregarSalvos(); })
    .then(atualizarPastaAberta)
    .then(function(){ toast('Extrato movido para '+nomeDest+'.'); })
    .catch(falhou);
});
/* ---------- lembrete do mês que falta ----------
   window.__hoje existe só para os testes simularem outra data */
function HOJE(){ return window.__hoje ? new Date(window.__hoje) : new Date(); }
function mesDe(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function desenharLembrete(extratos){
  var hoje = HOJE(), ultima = null;
  extratos.forEach(function(x){ if (x.last && (!ultima || x.last > ultima)) ultima = x.last; });
  var texto = Pastas.textoLembrete(Pastas.mesesFaltando(ultima, hoje), hoje);
  var mostrar = MODE==='despesas' && !!texto && cfg.lembreteVisto!==mesDe(hoje);
  $('iniLembrete').hidden = !mostrar;
  if (mostrar) $('iniLembreteT').textContent = texto;
}
$('iniLembrete').addEventListener('click', function(e){
  if (!e.target.closest('[data-lemb-nao]')) return;
  cfg.lembreteVisto = mesDe(HOJE()); saveCfg();
  $('iniLembrete').hidden = true;
});
/* ---------- resumo do último extrato aberto (topo do Início) ----------
   Na entrada, o site reabre em segundo plano o último extrato (ou pasta) que a
   pessoa abriu. O cartão mostra o mesmo veredito e os mesmos números do Dashboard. */
function reabrirUltimo(){
  var u = cfg.ultimoAberto;
  if (MODE!=='despesas' || state.loaded || !u || !u.id) return;
  var existe = u.tipo==='pasta' ? getPages().some(function(p){ return p.id===u.id; })
                                : getSaved().some(function(x){ return x.id===u.id; });
  if (!existe) return;
  /* se a pessoa abrir outro extrato, o exemplo ou enviar um arquivo enquanto isto carrega, a escolha dela vale */
  var esc = state.escolhaManual || 0, env = state.envioId || 0;
  var ainda = function(){ return !state.loaded && (state.escolhaManual || 0)===esc && (state.envioId || 0)===env; };
  (u.tipo==='pasta' ? carregarPasta(u.id, ainda) : carregarSalvo(u.id, ainda)).catch(function(){ /* sem cartão; a lista continua */ });
}
function desenharResumo(){
  var card = $('iniResumo'), r = state.resumo;
  var mostrar = MODE==='despesas' && state.loaded && state.source!=='sample' && !!r && getSaved().length>0;
  card.hidden = !mostrar;
  if (!mostrar) return;
  var porMes = function(v){ return brl.format(v/(r.nM||1)); };
  card.className = 'card verdict ini-resumo ini-bloco '+r.ver.cor;
  $('iniResumoDe').textContent = (state.pastaId ? 'Última pasta aberta · ' : 'Último extrato aberto · ')+state.fileName+' · '+r.periodo;
  $('iniResumoTit').textContent = r.ver.titulo;
  $('iniResumoTx').textContent = r.ver.texto;
  var res = r.ins-r.outs;
  $('iniResumoN').innerHTML = [['Entrou', r.ins], ['Saiu', r.outs], [res>=0 ? 'Sobrou' : 'Faltou', Math.abs(res)]].map(function(c){
    return '<span>'+c[0]+(r.nM>1 ? ' por mês' : '')+'<b class="num">'+porMes(c[1])+'</b></span>';
  }).join('');
  $('iniResumoPesa').textContent = r.ver.pesa || '';
  $('iniResumoPesa').hidden = !r.ver.pesa;
}
$('iniResumoVer').addEventListener('click', function(){ irPara('dashboard'); });
/* extrato de exemplo: abre o painel com dados inventados, sem salvar nada */
function abrirExemplo(){
  escolheuAbrir();
  API.exemplo().then(function(r){
    load(r.lancamentos.map(doServidor), 'sample', r.nome);
    irPara('dashboard');
  }).catch(falhou);
}
document.querySelectorAll('[data-exemplo]').forEach(function(b){ b.addEventListener('click', abrirExemplo); });
/* pílulas Ajuda e Formatos: cada uma abre o seu quadro; abrir um fecha o outro */
function sincronizarPilulas(){
  document.querySelectorAll('[data-abre]').forEach(function(b){ b.setAttribute('aria-expanded', $(b.dataset.abre).open ? 'true' : 'false'); });
}
document.querySelectorAll('[data-abre]').forEach(function(b){
  b.addEventListener('click', function(){
    var d = $(b.dataset.abre), abrir = !d.open;
    document.querySelectorAll('[data-abre]').forEach(function(o){ $(o.dataset.abre).open = false; });
    d.open = abrir;
    sincronizarPilulas();
  });
});
['ajuda','formatos'].forEach(function(id){ $(id).addEventListener('toggle', sincronizarPilulas); });
$('newPageBtn').addEventListener('click', function(){ $('newPageForm').hidden = false; $('newPageErr').hidden = true; $('newPageName').value = ''; $('newPageName').focus(); });
$('newPageCancel').addEventListener('click', function(){ $('newPageForm').hidden = true; });
$('newPageForm').addEventListener('submit', function(e){
  e.preventDefault();
  var name = $('newPageName').value.replace(/\s+/g,' ').trim(), err = $('newPageErr');
  if (!name){ err.textContent = 'Dê um nome para a pasta.'; err.hidden = false; $('newPageName').focus(); return; }
  if (pageNameTaken(name)){ err.textContent = 'Já existe uma pasta chamada "'+name+'".'; err.hidden = false; $('newPageName').focus(); return; }
  err.hidden = true;
  askX({ kind:'criar-pagina', title:'Criar a pasta "'+name+'"?', text:'Depois é só usar "Mover para", no menu de cada extrato, para colocá-lo nesta pasta.', yes:'Criar pasta', cancel:'Voltar', onYes:function(){
    API.criarPagina(name, kindNow()).then(function(pg){
      $('newPageForm').hidden = true; state.page = pg.id;
      return recarregarSalvos().then(function(){ toast('Pasta "'+name+'" criada.'); });
    }).catch(falhou);
  } });
});
$('pageHead').addEventListener('click', function(e){
  var pid = state.page, pg = getPages().filter(function(p){ return p.id===pid; })[0]; if (!pg) return;
  if (e.target.closest('[data-pver]')){ openPasta(pid); return; }
  if (e.target.closest('[data-pren]')){ state.editingPage = pid; renderSaved(); var i = $('renPageName'); if (i){ i.focus(); i.select(); } return; }
  if (e.target.closest('[data-pcancel]')){ state.editingPage = null; renderSaved(); return; }
  var del = e.target.closest('[data-pdel]');
  if (del){
    var n = getSaved().filter(function(x){ return x.page===pid; }).length;
    var raiz = MODE==='vendas' ? '"Sem página"' : '"Sem pasta"';
    askX({ kind:'excluir-pagina', danger:true, title:'Excluir a pasta "'+pg.name+'"?', text:(n ? 'Os '+n+' extratos dela não serão apagados: eles voltam para '+raiz+'. ' : 'A pasta está vazia. ')+'Isso não pode ser desfeito.', yes:'Excluir pasta', back:del, onYes:function(){
      API.excluirPagina(pid).then(function(){
        state.page = null;
        return recarregarSalvos().then(atualizarPastaAberta).then(function(){ toast('Pasta "'+pg.name+'" excluída.'); });
      }).catch(falhou);
    } });
  }
});
$('pageHead').addEventListener('submit', function(e){
  e.preventDefault();
  var pid = state.page, pg = getPages().filter(function(p){ return p.id===pid; })[0]; if (!pg) return;
  var name = $('renPageName').value.replace(/\s+/g,' ').trim(), err = $('renPageErr');
  if (!name){ err.textContent = 'Dê um nome para a pasta.'; err.hidden = false; return; }
  if (name===pg.name){ state.editingPage = null; renderSaved(); return; }
  if (pageNameTaken(name, pid)){ err.textContent = 'Já existe uma pasta chamada "'+name+'".'; err.hidden = false; return; }
  askX({ kind:'renomear-pagina', title:'Renomear a pasta?', text:'"'+pg.name+'" passa a se chamar "'+name+'".', yes:'Salvar nome', cancel:'Continuar editando', onYes:function(){
    API.renomearPagina(pid, name).then(function(){
      state.editingPage = null;
      if (state.pastaId===pid){ state.fileName = name; if (state.loaded) render(); }
      return recarregarSalvos().then(function(){ toast('Pasta renomeada para "'+name+'".'); });
    }).catch(falhou);
  } });
});
$('savedList').addEventListener('submit', function(e){
  e.preventDefault();
  var f = e.target, id = f.dataset.id, err = $('renXErr');
  if (f.classList.contains('move-form')){
    var to = $('mvX').value || null;
    var mx = getSaved().filter(function(v){ return v.id===id; })[0]; if (!mx) return;
    if ((mx.page||null)===to){ state.movingSaved = null; renderSaved(); return; }
    var desp = MODE!=='vendas';
    var dest = to ? '"'+pageName(to)+'"' : (desp ? '"Sem pasta"' : '"Sem página"');
    var para = to ? (desp ? 'a pasta ' : 'a página ')+dest : dest;
    askX({ kind:'mover-extrato', title:'Mover o extrato?', text:'"'+(mx.name||'Extrato')+'" vai para '+para+'.', yes:'Mover extrato', cancel:'Voltar',
      onYes:function(){
        API.alterarExtrato(id, {pagina_id: to}).then(function(){
          state.movingSaved = null;
          return recarregarSalvos().then(atualizarPastaAberta).then(function(){ toast('Extrato movido para '+para+'.'); });
        }).catch(falhou);
      } });
    return;
  }
  var x = getSaved().filter(function(v){ return v.id===id; })[0]; if (!x) return;
  var name = $('renX').value.replace(/\s+/g,' ').trim();
  if (!name){ err.textContent = 'Dê um nome para o extrato.'; err.hidden = false; $('renX').focus(); return; }
  if (name===x.name){ state.editingSaved = null; renderSaved(); return; }
  askX({ kind:'renomear-extrato', title:'Renomear o extrato?', text:'"'+(x.name||'Extrato')+'" passa a se chamar "'+name+'".', yes:'Salvar nome', cancel:'Continuar editando', onYes:function(){
    API.alterarExtrato(id, {nome: name}).then(function(){
      if (state.savedId===id){ state.fileName = name; if (state.loaded) render(); }
      state.editingSaved = null;
      return recarregarSalvos().then(function(){ toast('Extrato renomeado para "'+name+'".'); });
    }).catch(falhou);
  } });
});
$('savedList').addEventListener('click', function(e){
  var o = e.target.closest('[data-open]');
  if (o){ openSaved(o.dataset.open); return; }
  var mb = e.target.closest('[data-menu]');
  if (mb){ state.menuFor = state.menuFor===mb.dataset.menu ? null : mb.dataset.menu; renderSaved();
    if (state.menuFor){ var first = document.querySelector('.menu [role=menuitem]'); if (first) first.focus({preventScroll:true}); } return; }
  var mv = e.target.closest('[data-xmove]');
  if (mv){ state.menuFor = null; state.editingSaved = null; state.movingSaved = mv.dataset.xmove; renderSaved(); var m = $('mvX'); if (m) m.focus(); return; }
  if (e.target.closest('[data-mcancel]')){ state.movingSaved = null; renderSaved(); return; }
  var rn = e.target.closest('[data-xren]');
  if (rn){ state.menuFor = null; state.movingSaved = null; state.editingSaved = rn.dataset.xren; renderSaved(); var i = $('renX'); if (i){ i.focus(); i.select(); } return; }
  if (e.target.closest('[data-xcancel]')){ state.editingSaved = null; renderSaved(); return; }
  var d = e.target.closest('[data-del]');
  if (!d) return;
  var id = d.dataset.del;
  var x = getSaved().filter(function(v){return v.id===id;})[0]; if (!x) return;
  state.menuFor = null; renderSaved(); d = document.querySelector('[data-menu="'+id+'"]') || d;
  askX({ kind:'excluir-extrato', danger:true, title:'Excluir o extrato salvo?', text:'"'+(x.name||'Extrato')+'" ('+x.n+' lançamentos) será apagado. As suas regras e categorias continuam valendo. Isso não pode ser desfeito.',
    yes:'Excluir extrato', back:d, onYes:function(){
      API.excluirExtrato(id).then(function(){ return sumirLinha(id); }).then(function(){
        if (state.savedId===id){ if (MODE==='vendas'){ state.savedId = null; sales = []; salesFile = ''; renderSales(); refreshTabs(); } else fecharExtrato(); }
        return recarregarSalvos().then(atualizarPastaAberta).then(function(){ toast('Extrato excluído.'); });
      }).catch(falhou);
    } });
});
document.addEventListener('click', function(e){
  if (!state.menuFor || (e.target.closest && e.target.closest('.menu-wrap'))) return;
  state.menuFor = null; renderSaved();
});
document.addEventListener('keydown', function(e){
  if (!state.menuFor || askState) return;
  var items = Array.prototype.slice.call(document.querySelectorAll('.menu [role=menuitem]:not([disabled])'));
  var i = items.indexOf(document.activeElement);
  if (e.key==='Escape'){ var id = state.menuFor; state.menuFor = null; renderSaved(); var b = document.querySelector('[data-menu="'+id+'"]'); if (b) b.focus(); }
  else if (e.key==='ArrowDown' && items.length){ e.preventDefault(); items[(i+1)%items.length].focus({preventScroll:true}); }
  else if (e.key==='ArrowUp' && items.length){ e.preventDefault(); items[(i-1+items.length)%items.length].focus({preventScroll:true}); }
});
/* mudar de página sempre abre no topo. state.depois roda logo depois (ex.: a volta
   da criação de categoria rola de novo até o lançamento de onde a pessoa saiu) */
function chegou(){
  setView();
  var noInicio = !$('viewEnviar').hidden;
  if (noInicio && state.vistaAntes!=='inicio'){
    posicionarPilula(false);
    if (state.salvosProntos) animarEntrada();
    if (state.novoId){ setTimeout(function(){ state.novoId = null; }, 2500); }
  }
  state.vistaAntes = noInicio ? 'inicio' : 'outra';
  /* o Dashboard é desenhado com a largura real dos cartões: redesenha já visível */
  var noDash = state.loaded && MODE==='despesas' && !$('viewDash').hidden;
  if (noDash && state.vistaDash!=='dashboard'){ state.numsAntes = null; state.fatiasAntes = null; }   /* na chegada, conta e enche do zero */
  if (noDash) renderDashboard();
  if (noDash && state.vistaDash!=='dashboard') animarDashboard();
  state.vistaDash = noDash ? 'dashboard' : 'outra';
  var noEco = state.loaded && MODE==='despesas' && !$('viewEconomia').hidden;
  if (noEco && state.vistaEco!=='economia'){ state.ecoAntes = null; state.ecoBrilhou = false; state.ecoPassou = undefined; }
  if (noEco) renderEconomia();
  if (noEco && state.vistaEco!=='economia') animarEconomia();
  state.vistaEco = noEco ? 'economia' : 'outra';
  window.scrollTo(0, 0);
  if (state.depois){ var f = state.depois; state.depois = null; f(); }
}
function irPara(v){
  if (location.hash==='#'+v) chegou();
  else location.hash = v;  /* o hashchange chama chegou() */
}
window.addEventListener('hashchange', chegou);
setView();
var tip = $('tip');
var tipEl = null, tipTimer = null, tipX = 0, tipY = 0, DWELL = 1500;
function placeTip(){
  var x = tipX + 14, y = tipY + 14, w = tip.offsetWidth, h = tip.offsetHeight;
  if (x + w > window.innerWidth - 8) x = Math.max(8, tipX - w - 14);
  if (y + h > window.innerHeight - 8) y = Math.max(8, tipY - h - 14);
  tip.style.left = x+'px'; tip.style.top = y+'px';
}
function hideTip(){ tip.hidden = true; tipEl = null; clearTimeout(tipTimer); }
document.addEventListener('mousemove', function(e){
  var el = e.target.closest && e.target.closest('[data-tip]');
  tipX = e.clientX; tipY = e.clientY;
  if (!el){ if (tipEl) hideTip(); return; }
  if (el !== tipEl){
    tipEl = el; clearTimeout(tipTimer);
    var more = el.getAttribute('data-more');
    tip.className = 'tip';
    tip.innerHTML = el.getAttribute('data-tip') + (more ? '<span class="tip-wait" aria-hidden="true"><i></i></span>' : '');
    tip.hidden = false;
    if (more) tipTimer = setTimeout(function(){
      if (tipEl !== el) return;
      tip.className = 'tip expanded';
      tip.innerHTML = el.getAttribute('data-tip') + '<div class="tip-more">' + more + '</div>';
      placeTip();
    }, DWELL);
  }
  placeTip();
});
document.addEventListener('mouseleave', hideTip);
window.addEventListener('scroll', hideTip, true);

/* ---------- dashboard em faixas: movimentos ----------
   Todos respeitam "reduzir movimento" (semMovimento): o estado final aparece na hora. */
var dashTimer = null;
function animarDashboard(){
  var v = $('viewDash');
  if (semMovimento()) return;
  v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra');
  /* meses: as barras sobem uma após a outra (no máximo 0,8 s no total) */
  var barras = v.querySelectorAll('#dRes path');
  var passo = barras.length>1 ? Math.min(40, 300/(barras.length-1)) : 0;
  Array.prototype.forEach.call(barras, function(b, i){ b.style.animationDelay = (i*passo)+'ms'; });
  /* aviso que pulsa uma vez, só em Atenção ou Alerta */
  var ver = $('dVer');
  ver.classList.remove('pulsa');
  if (/\b(amarelo|vermelho)\b/.test(ver.className)){ void ver.offsetWidth; ver.classList.add('pulsa'); }
  clearTimeout(dashTimer);
  dashTimer = setTimeout(function(){ v.classList.remove('entra'); ver.classList.remove('pulsa'); }, 1400);
}
/* Entrou, Saiu e Sobrou contam do valor anterior até o novo; o texto final é
   sempre o mesmo que o Dashboard escreveu (nunca para num número diferente) */
function numeroDe(txt){ var n = parseFloat(String(txt).replace(/[^\d,-]/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
function contarNumeros(){
  var els = Array.prototype.slice.call(document.querySelectorAll('#dNums .value'));
  var finais = els.map(function(e){ return e.textContent; });
  var antes = state.numsAntes || finais.map(function(){ return '0'; });
  state.numsAntes = finais;
  var token = state.contaToken = (state.contaToken || 0) + 1;
  if (semMovimento() || !window.requestAnimationFrame) return;
  els.forEach(function(el, i){
    var de = numeroDe(antes[i]), ate = numeroDe(finais[i]);
    if (Math.abs(de-ate) < 0.005) return;
    var ini = null;
    var passo = function(t){
      if (token !== state.contaToken){ return; }   /* um redesenho mais novo assumiu */
      if (ini===null) ini = t;
      var p = Math.min(1, (t-ini)/800), v = de + (ate-de)*(1-Math.pow(1-p, 3));
      el.textContent = p<1 ? brl.format(v) : finais[i];
      if (p<1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
}
/* a barra de categorias se enche cor por cor quando a divisão muda */
function crescerFatias(assinatura){
  var mudou = assinatura !== state.fatiasAntes;
  state.fatiasAntes = assinatura;
  if (!mudou || semMovimento()) return;
  var bs = Array.prototype.slice.call(document.querySelectorAll('#dFatias button'));
  bs.forEach(function(b){ b.style.transition = 'none'; b.style.flexGrow = '0'; });
  void $('dFatias').offsetWidth;
  bs.forEach(function(b, i){
    b.style.transition = 'flex-grow .7s cubic-bezier(.2,.7,.2,1) '+(i*80)+'ms';
    b.style.flexGrow = b.dataset.flex;
  });
}
/* ---------- dashboard em faixas: altura do gráfico e cliques das faixas ---------- */
function alturaMeses(){ return window.innerWidth < 560 ? 140 : 120; }
var pct0 = new Intl.NumberFormat('pt-BR', {style:'percent', maximumFractionDigits:0});
$('dTodasBtn').addEventListener('click', function(){ state.dashTodas = !state.dashTodas; renderDashboard(); $('dTodasBtn').focus(); });
$('dCmp').addEventListener('click', function(e){ var b = e.target.closest('[data-cat]'); if (b) abrirLancamentos(b.dataset.cat); });
$('dGastos').addEventListener('click', function(e){
  var b = e.target.closest('[data-gasto]'); if (!b) return;
  state.q = b.dataset.gasto; $('q').value = state.q;
  abrirLancamentos('all');
});
/* ---------- dashboard: filtro de despesas, barras e detalhes ---------- */
function abrirFiltro(abrir){
  $('dFiltro').hidden = !abrir; $('dFiltroBtn').setAttribute('aria-expanded', abrir ? 'true' : 'false');
}
$('dFiltroBtn').addEventListener('click', function(e){ e.stopPropagation(); abrirFiltro($('dFiltro').hidden); });
document.addEventListener('click', function(e){ if (!$('dFiltro').hidden && !e.target.closest('.filtro-wrap')) abrirFiltro(false); });
document.addEventListener('keydown', function(e){ if (e.key==='Escape' && !$('dFiltro').hidden){ abrirFiltro(false); $('dFiltroBtn').focus(); } });
$('dOnde').addEventListener('click', function(e){
  if (e.target.closest('[data-todas]')){ state.dashTodas = !state.dashTodas; renderDashboard(); var bt = document.querySelector('#dBarras [data-todas]'); if (bt) bt.focus(); return; }
  var at = e.target.closest('[data-atalho]');
  if (at){
    var tx = cur(), byCat = {};
    tx.forEach(function(t){ if (saiDaConta(t)){ var c = catOf(t); byCat[c] = (byCat[c]||0) - t.value; } });
    var esc2 = Analise.atalho(at.dataset.atalho, {byCat:byCat, fixas:FIXED, outros:OTHER});
    state.dashCats = esc2 && esc2.length ? esc2 : null;
    renderDashboard(); return;
  }
  if (e.target.closest('[data-classificar]')) return;  /* o link segue para a aba Organizar */
  if (e.target.closest('[data-demais]')){ state.dashTodas = true; renderDashboard(); return; }   /* "Outras categorias" abre a lista completa */
  var b = e.target.closest('.barra, #dFatias [data-cat], #dLegenda [data-cat]');
  if (b) abrirLancamentos(b.dataset.cat);
});
$('dOnde').addEventListener('keydown', function(e){
  if (e.target.closest('a')) return;
  var b = e.target.closest('.barra');
  if (b && (e.key==='Enter' || e.key===' ')){ e.preventDefault(); abrirLancamentos(b.dataset.cat); }
});
$('dFiltroLista').addEventListener('change', function(e){
  var todas = [], marcadas = [], foco = e.target.value;
  $('dFiltroLista').querySelectorAll('input[type=checkbox]').forEach(function(c){ todas.push(c.value); if (c.checked) marcadas.push(c.value); });
  /* categorias escolhidas que não têm gasto neste período continuam escolhidas */
  var escondidas = (state.dashCats||[]).filter(function(c){ return todas.indexOf(c)===-1; });
  state.dashCats = marcadas.length===todas.length && !escondidas.length ? null : marcadas.concat(escondidas);
  renderDashboard();
  $('dFiltroLista').querySelectorAll('input[type=checkbox]').forEach(function(c){ if (c.value===foco) c.focus(); });
});
$('dDet').addEventListener('toggle', function(){ state.dashDet = $('dDet').open; if (state.dashDet) renderDashboard(); });
/* no celular não existe "passar o mouse": tocar (ou Enter) num cartão de ação mostra as origens na hora */
/* "Ver lançamentos" da linha do dinheiro guardado: abre Lançamentos nessa categoria */
$('dInterno').addEventListener('click', function(e){
  var a = e.target.closest('[data-interno]'); if (!a) return;
  e.preventDefault(); abrirLancamentos(a.dataset.interno);
});
/* clicar numa barra: abre a aba Lançamentos já filtrada naquela categoria */
/* ---------- página Despesas: para onde foi o dinheiro ----------
   Contas em Despesas (despesas.js); aqui só o desenho. */
var CAT_VISIVEIS = 6;
/* unidade dos gráficos: semana → dia; um mês ou até 40 dias → semana; mais de 2 anos → ano; senão mês */
function unidadeDe(p){
  if (p.tipo==='semana') return 'dia';
  if (p.tipo==='mes') return 'semana';
  var L = extratoLimites(), c = Periodo.cobertura(p, L.inicio, L.fim);
  return c.dias<=40 ? 'semana' : c.dias>730 ? 'ano' : 'mes';
}
/* saídas por unidade do período (com filtro opcional), marcando unidades cortadas
   (parcial) e sem nenhum dia de dados (semDados) */
function unidadesSaida(p, un, filtro){
  var L = extratoLimites();
  var pp = p.tipo==='tudo' ? {tipo:'intervalo', de:L.inicio, ate:L.fim, dias:true} : p;
  var base = un==='ano' ? 'mes' : un;
  var pos = Periodo.posicoes(pp, base), soma = {}, lp = Periodo.limites(pp);
  state.tx.forEach(function(t){
    if (!saiDaConta(t) || !Periodo.contem(t.date, pp) || (filtro && !filtro(t))) return;
    var k = base==='mes' ? Periodo.chaveDe(t.date) : base==='semana' ? weekKey(t.date) : Periodo.iso(t.date);
    soma[k] = (soma[k]||0) - t.value;
  });
  var r = pos.map(function(x){
    var de = base==='mes' ? x.chave+'-01' : x.chave,
        ate = base==='mes' ? Periodo.limites(Periodo.deMeses(x.chave, x.chave)).ate : base==='semana' ? Periodo.iso(new Date(+x.chave.slice(0,4), +x.chave.slice(5,7)-1, +x.chave.slice(8,10)+6)) : x.chave;
    var cde = [de, lp.de, L.inicio].sort()[2], cate = [ate, lp.ate, L.fim].sort()[0];
    if (cde>cate) return {chave:x.chave, rotulo:x.rotulo, valor:0, semDados:true, parcial:true};
    var ddmm = function(z){ return z.slice(8,10)+'/'+z.slice(5,7); };
    var nota = cde!==de ? ' (desde '+ddmm(cde)+')' : cate!==ate ? ' (até '+ddmm(cate)+')' : '';
    return {chave:x.chave, rotulo:x.rotulo, valor:soma[x.chave]||0, parcial: cde!==de || cate!==ate, nota:nota};
  });
  if (un!=='ano') return r;
  return Despesas.anos(r, [lp.de, L.inicio].sort()[1], [lp.ate, L.fim].sort()[0]);
}
/* gráfico de barras de uma série (Despesas.serie): o maior em dourado com o valor em cima, média tracejada */
function svgBarras(un, unid, opt){
  var S = Despesas.serie(unid.filter(function(u){ return !u.semDados; })), bs = S.barras;
  if (!bs.length) return '';
  var W = opt.W||600, H = opt.H||150, mL = 8, mR = 8, mT = 22, mB = 22, iw = W-mL-mR, ih = H-mT-mB;
  var max = Math.max.apply(null, bs.map(function(b){ return b.valor; }).concat([1]));
  var gw = iw/bs.length, bw = Math.max(3, Math.min(34, gw*0.66));
  var passo = Math.max(1, Math.ceil(bs.length/(opt.rotulos||12)));
  var y = function(v){ return mT+ih-Math.max(0, v)/max*ih; };
  var s = '<svg class="'+opt.cls+'" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(opt.aria)+'">';
  bs.forEach(function(b, i){
    var x = mL+gw*i+(gw-bw)/2, yt = y(b.valor), h = mT+ih-yt;
    var tip = '<b>'+esc(b.rotulo+(b.nota||''))+'</b><br>'+brl.format(b.valor)+(b.parcial && !b.nota ? ' (parcial)' : '');
    s += '<g class="x-b'+(b.maior ? ' maior' : '')+(b.parcial ? ' parcial' : '')+'" data-tip="'+esc(tip)+'">'+
      '<rect class="hit" x="'+(mL+gw*i).toFixed(1)+'" y="'+mT+'" width="'+gw.toFixed(1)+'" height="'+ih+'"></rect>'+
      '<rect class="x-barra" x="'+x.toFixed(1)+'" y="'+yt.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(0, h).toFixed(1)+'" rx="'+Math.min(4, bw/2).toFixed(1)+'" style="--h:'+h.toFixed(1)+'px"></rect>'+
      (b.maior ? '<text class="x-maior-v" x="'+(x+bw/2).toFixed(1)+'" y="'+(yt-6).toFixed(1)+'" text-anchor="'+(i===0 ? 'start' : i===bs.length-1 ? 'end' : 'middle')+'">'+brl0.format(b.valor)+'</text>' : '')+
      (i%passo===0 ? '<text class="x-rot" x="'+(mL+gw*i+gw/2).toFixed(1)+'" y="'+(H-6)+'" text-anchor="middle">'+esc(b.rotulo)+'</text>' : '')+'</g>';
  });
  if (bs.length>1 && !S.soParciais) s += '<line class="x-media" x1="'+mL+'" x2="'+(W-mR)+'" y1="'+y(S.media).toFixed(1)+'" y2="'+y(S.media).toFixed(1)+'"></line>';
  return {svg: s+'</svg>', media:S.media, n:bs.length, soParciais:S.soParciais};
}
function renderDespesas(tx, prev){
  var p = state.p, isWeek = p.tipo==='semana';
  $('viewDespesas').classList.toggle('x-calmo', !!state.despCalmo);   /* redesenho sem mudar de período: nada cresce de novo */
  $('dCmpTopoDesp').hidden = !state.cmp;
  if (state.cmp){ renderDespesasComparacao(); return; }
  var months = {}; tx.forEach(function(t){ months[Periodo.chaveDe(t.date)] = 1; });
  var nMeses = Object.keys(months).length, fm = Periodo.fatorMes(p, nMeses), div = isWeek ? 1 : fm.divisor;
  var T = sums(tx), outs = T.outs, byCat = {}, nOut = 0;
  tx.forEach(function(t){ if (saiDaConta(t)){ nOut++; var c = catOf(t); byCat[c] = (byCat[c]||0) - t.value; } });
  var ehTotal = div===1 && !fm.nota;
  var quando = p.tipo==='tudo' ? 'em todo o extrato' : fm.dias && !fm.nota ? 'em '+fm.dias+' dias' : 'em '+Periodo.curto(p);
  var vm = function(v){ return ehTotal ? brl.format(v) : brl.format(v/div)+'/mês'; };
  /* topo */
  $('xVazio').hidden = outs>0;
  ['xCats','xTopo'].forEach(function(id){ $(id).hidden = !(outs>0); });
  if (!(outs>0)){ $('xCatList').innerHTML = ''; ['xMeses','xMudou','xGastos','xResumo'].forEach(function(id){ $(id).hidden = true; }); return; }
  contarAte($('xSaiu'), outs/div, function(v){ return 'Saiu '+brl.format(v)+(ehTotal ? ' '+quando : ' por mês'); });
  var sub = ehTotal ? nOut+' lançamentos'
    : brl.format(outs)+(fm.nota ? ' em '+fm.dias+' dias ('+fm.nota+')' : ' em '+nMeses+' meses')+' · '+nOut+' lançamentos';
  if (prev && prev.outs>0){ var d = (outs-prev.outs)/prev.outs; sub += ' · <span class="'+(d>0.005 ? 'neg' : d<-0.005 ? 'pos' : '')+'">'+(d>=0 ? '+' : '−')+pct0.format(Math.abs(d))+'</span> que '+esc(prev.label); }
  $('xSaiuSub').innerHTML = sub;
  var dv = Despesas.divisao(byCat, FIXED, outs);
  $('xTopo').dataset.total = outs.toFixed(2);
  $('xDiv').innerHTML = '<i class="x-fix" style="width:'+dv.pFixas+'%"></i><i class="x-dia" style="width:'+dv.pDia+'%"></i>';
  $('xDivLeg').innerHTML = '<span data-fixas="'+dv.fixas.toFixed(2)+'" data-pct="'+dv.pFixas+'"><i class="sw x-fix"></i>Contas fixas '+vm(dv.fixas)+' ('+dv.pFixas+'%)</span>'+
    '<span data-dia="'+dv.dia.toFixed(2)+'" data-pct="'+dv.pDia+'"><i class="sw x-dia"></i>Dia a dia '+vm(dv.dia)+' ('+dv.pDia+'%)</span>';
  /* categorias */
  var cats = Object.keys(byCat).filter(function(k){ return byCat[k]>0; }).map(function(k){ return {nome:k, v:byCat[k]}; })
    .sort(function(a, b){ if (a.nome===OTHER) return 1; if (b.nome===OTHER) return -1; return b.v-a.v; });
  if (state.despAberta && !(byCat[state.despAberta] > 0)) state.despAberta = null;
  var todas = !!state.despTodas || cats.length<=CAT_VISIVEIS + 1;
  var vis = todas ? cats : cats.slice(0, CAT_VISIVEIS);
  if (state.despAberta && vis.every(function(c){ return c.nome!==state.despAberta; })){ vis = cats; todas = true; }
  var maxC = cats.reduce(function(m, c){ return Math.max(m, c.v); }, 1);
  $('xCatsH').textContent = ehTotal ? 'Total: '+brl.format(outs)+' · clique para abrir' : 'Por mês · clique para abrir';
  $('xCatList').innerHTML = vis.map(function(c){
    var on = c.nome===state.despAberta;
    return '<li class="x-cat-li'+(c.nome===OTHER ? ' other' : '')+(on ? ' aberta' : '')+(on && state.despNova===c.nome ? ' x-nova' : '')+'"><button type="button" class="x-cat" data-cat="'+esc(c.nome)+'" aria-expanded="'+on+'">'+
      '<span class="name">'+esc(c.nome)+'</span><span class="amt num">'+vm(c.v)+' · '+pct.format(c.v/outs)+'</span>'+
      '<span class="track"><span class="bar" style="width:'+(c.v/maxC*100).toFixed(1)+'%"></span></span></button>'+
      (on ? detalheCategoria(c.nome, tx, isWeek) : '')+'</li>';
  }).join('');
  var bt = $('xCatTodas');
  bt.hidden = cats.length<=CAT_VISIVEIS + 1;
  bt.textContent = todas ? 'Mostrar menos' : 'Ver todas as '+cats.length+' categorias';
  bt.setAttribute('aria-expanded', String(todas));
  state.despTop = cats.slice(0, CAT_VISIVEIS).map(function(c){ return c.nome; });
  state.despLarg = $('xCats').clientWidth;
  /* gastos mês a mês */
  var un = unidadeDe(p), nomeUn = {dia:'dia', semana:'semana', mes:'mês', ano:'ano'}[un];
  var gm = svgBarras(un, unidadesSaida(p, un), {cls:'x-gm', aria:'Saídas por '+nomeUn, W:Math.max(300, larguraDe('xCats')-34), H:190, rotulos:Math.max(4, Math.floor((larguraDe('xCats')-34)/56))});
  $('xMeses').hidden = !(gm && gm.n>1);
  if (gm){ $('xMesesG').innerHTML = gm.svg; $('xMesesT').textContent = {dia:'Gastos dia a dia', semana:'Gastos semana a semana', mes:'Gastos mês a mês', ano:'Gastos ano a ano'}[un];
    var compl = {semana:'semanas completas', mes:'meses completos', ano:'anos completos'}[un];
    $('xMesesH').innerHTML = gm.soParciais ? 'Sem média: '+{semana:'nenhuma semana está completa', mes:'nenhum mês está completo', ano:'nenhum ano está completo', dia:'nenhum dia completo'}[un]+' no extrato'
      : '<span class="x-media-leg">- - -</span> média '+brl0.format(gm.media)+' por '+nomeUn+(un==='dia' ? '' : ' (só '+compl+')'); }
  /* o que mudou: o mesmo par de meses do Dashboard */
  var par = parMeses(tx);
  var mu = par ? Despesas.mudancas(par.A.cat, par.B.cat, 2) : null;
  $('xMudou').hidden = !mu || !(mu.subiram.length + mu.cairam.length);
  if (mu){
    $('xMudouH').textContent = par.B.label+' contra '+par.A.label;
    var pil = function(x, cls){ return '<button type="button" class="x-pil '+cls+'" data-cat="'+esc(x.nome)+'">'+esc(x.nome)+' <b>'+(x.d>0 ? '+' : '−')+brl0.format(Math.abs(x.d))+' ('+esc(x.txt)+')</b></button>'; };
    $('xMudouL').innerHTML = mu.subiram.map(function(x){ return pil(x, 'sobe'); }).join('')+mu.cairam.map(function(x){ return pil(x, 'cai'); }).join('');
  }
  /* maiores gastos: um por origem, sem estornos nem movimentos internos */
  var gastos = Analise.maioresGastos(tx.filter(function(t){ return saiDaConta(t) && !t.estorno; })
    .map(function(t){ return {data:t.date, desc:t.desc, valor:-t.value, chave:t.origin}; }), 5);
  $('xGastos').hidden = !gastos.length;
  $('xGastosL').innerHTML = gastos.map(function(g){
    return '<li><button type="button" data-gasto="'+esc(g.desc)+'" title="Ver nos lançamentos"><span class="gdt">'+fmtDate(g.data)+'</span><span class="gd">'+esc(g.desc)+'</span><span class="gv">'+brl.format(g.valor)+'</span></button></li>';
  }).join('');
  /* resumo em frases, só sobre gastos */
  var semCat = tx.filter(function(t){ return ehSaida(t) && catOf(t)===OTHER; });
  var nDias = Math.round((tx[tx.length-1].date - tx[0].date)/864e5)+1, insDia = T.ins/nDias, fixMes = dv.fixas/div;
  var fr = Despesas.frases({ semCat: byCat[OTHER] ? {n:semCat.length, v:byCat[OTHER]} : null,
    taxas: byCat[feesName()] ? {v:byCat[feesName()], ins:T.ins} : null,
    cats: cats.filter(function(c){ return c.nome!==OTHER; }).map(function(c){ return {nome:c.nome, v:c.v}; }), outs:outs,
    diasRenda: !isWeek && insDia>0 && fixMes>0 ? Math.round(fixMes/insDia) : null });
  $('xResumo').hidden = !fr.length;
  $('xResumoL').innerHTML = fr.map(function(i){ return '<li class="'+(i.w?'warn':'')+'">'+(i.w?ICON_WARN:ICON_INFO)+'<p>'+esc(i.t)+'</p></li>'; }).join('');
}
/* o detalhe da categoria aberta: mês a mês (gráfico B), onde foi o dinheiro e o atalho */
function detalheCategoria(nome, tx, isWeek){
  var lista = tx.filter(function(t){ return saiDaConta(t) && catOf(t)===nome; });
  var h = '<div class="x-aberta">';
  if (!isWeek){
    var un = unidadeDe(state.p);
    var larg = $('xCatList').clientWidth ? $('xCatList').clientWidth-30 : 600;
    var g = svgBarras(un, unidadesSaida(state.p, un, function(t){ return catOf(t)===nome; }), {cls:'x-mes', aria:nome+' por '+(un==='semana' ? 'semana' : un==='ano' ? 'ano' : 'mês'), W:Math.max(280, larg), H:150, rotulos:Math.max(4, Math.floor(larg/52))});
    if (g && g.n>1) h += '<p class="x-mini-t">'+(un==='semana' ? 'Semana a semana' : un==='ano' ? 'Ano a ano' : 'Mês a mês')+(g.soParciais ? '' : ' <span class="x-media-leg">- - - média '+brl0.format(g.media)+'</span>')+'</p>'+g.svg;
  }
  var o = Despesas.origens(lista.map(function(t){ return {chave:t.origin, rotulo:t.desc, valor:-t.value}; }), 3);
  h += '<p class="x-mini-t">Onde foi o dinheiro</p><ul class="x-orig">'+o.top.map(function(x){
    return '<li><span class="x-o-n">'+esc(x.rotulo)+'</span><span class="num">'+brl.format(x.valor)+' · '+pct.format(x.pct)+'</span></li>';
  }).join('')+(o.resto ? '<li class="x-resto"><span>+ '+o.resto.n+(o.resto.n===1 ? ' outra origem' : ' outras origens')+'</span><span class="num">'+brl.format(o.resto.valor)+'</span></li>' : '')+'</ul>';
  h += '<button type="button" class="link-btn x-lanc" data-lanc="'+esc(nome)+'">Ver '+(lista.length===1 ? 'o lançamento' : 'os '+lista.length+' lançamentos')+' →</button>';
  return h+'</div>';
}
/* o número do topo conta até o valor (sem movimento: direto) */
function contarAte(el, v, fmt){
  var chave = fmt(v);
  if (el.dataset.alvo===chave) return;
  el.dataset.alvo = chave;
  if (REDUZIR.matches || !el.dataset.visto){ el.dataset.visto = '1'; el.textContent = chave; if (REDUZIR.matches) return; }
  var ini = performance.now(), dur = 700;
  (function passo(agora){
    if (el.dataset.alvo!==chave) return;
    var k = Math.min(1, (agora-ini)/dur), e = 1-Math.pow(1-k, 3);
    el.textContent = k<1 ? fmt(v*e) : chave;
    if (k<1) requestAnimationFrame(passo);
  })(ini);
}
$('xCatList').addEventListener('click', function(e){
  var l = e.target.closest('[data-lanc]');
  if (l){ abrirLancamentos(l.dataset.lanc); return; }
  var b = e.target.closest('.x-cat'); if (!b) return;
  if (state.cmp){ abrirLancamentos(b.dataset.cat); return; }   /* comparando: vai aos lançamentos, ainda comparando */
  var nome = b.dataset.cat;
  state.despAberta = state.despAberta===nome ? null : nome;
  state.despNova = state.despAberta;   /* só a categoria recém-aberta desliza */
  despesasCalmo();
  state.despNova = null;
  var nb = document.querySelector('#xCatList .x-cat[data-cat="'+CSS.escape(nome)+'"]'); if (nb) nb.focus();
});
$('xMudouL').addEventListener('click', function(e){ var b = e.target.closest('[data-cat]'); if (b) abrirLancamentos(b.dataset.cat); });
$('xGastosL').addEventListener('click', function(e){ var b = e.target.closest('[data-gasto]'); if (!b) return; state.q = b.dataset.gasto; $('q').value = state.q; abrirLancamentos('all'); });
$('xCatTodas').addEventListener('click', function(){
  var expandida = this.getAttribute('aria-expanded')==='true';
  state.despTodas = !expandida;
  /* encolher fecha a categoria aberta que ficaria escondida */
  if (expandida && state.despAberta && (state.despTop||[]).indexOf(state.despAberta)===-1) state.despAberta = null;
  despesasCalmo();
});
function despesasCalmo(){ state.despCalmo = true; try { render(); } finally { state.despCalmo = false; } }
/* os gráficos de Despesas são desenhados na largura real: redesenha ao chegar na página e ao redimensionar */
var despTimer = null;
window.addEventListener('resize', function(){
  clearTimeout(despTimer);
  despTimer = setTimeout(function(){ if (state.loaded && !$('viewDespesas').hidden && $('xCats').clientWidth!==state.despLarg) despesasCalmo(); }, 150);
});

function abrirLancamentos(cat){
  state.fcat = cat; state.filter = 'out';
  document.querySelectorAll('.table-tools .seg button').forEach(function(x){ x.setAttribute('aria-pressed', x.dataset.f==='out' ? 'true':'false'); });
  renderTable();
  irPara('lancamentos');
}

/* ---------- página Economia ----------
   Lê só state.eco (gravado por renderDashboard com os números do período) e
   cfg.economia (meta, objetivo, itens marcados e valor fixo, salvos na conta). */
var numBR = new Intl.NumberFormat('pt-BR', {maximumFractionDigits:2});
/* "1.234,56", "500", "R$ 500" → número; vazio, zero, negativo ou texto → null */
function lerValor(txt){
  var s = String(txt==null ? '' : txt).replace(/R\$|\s/g, '');
  if (!s) return null;
  if (s.indexOf(',')!==-1) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  var n = Number(s);
  return isFinite(n) && n>0 ? n : null;
}
function ecoCfg(){
  var e = cfg.economia = cfg.economia || {};
  if (!e.marcados || typeof e.marcados!=='object') e.marcados = {};
  return e;
}
function mesesTxt(n){ return n===1 ? '1 mês' : n+' meses'; }
function prazoTxt(p){ var ok = Economia.lerPrazo(p); if (!ok) return '?'; var x = ok.split('-'); return MESES[+x[1]-1].slice(0,3)+'/'+x[0]; }
function itensEconomia(E){
  var essenciais = ['moradia','casa','impostos','dividas','educacao','folha','mercado','saude','transferencias','seguros'].map(catByCode).filter(Boolean);
  var saidas = state.tx.filter(function(t){ return saiDaConta(t) && !t.estorno; })
    .map(function(t){ return {data:t.date, desc:t.desc, valor:-t.value, origem:t.origin, cat:catOf(t)}; });
  var mesesExtrato = []; state.tx.forEach(function(t){ var k = t.date.getFullYear()+'-'+String(t.date.getMonth()+1).padStart(2,'0'); if (mesesExtrato.indexOf(k)===-1) mesesExtrato.push(k); });
  mesesExtrato.sort();
  var acima = Economia.acimaDoNormal(E.meses, OTHER), ult = E.meses[E.meses.length-1];
  var lista = Economia.itens({ dicas: Analise.acoes(E.ctx).lista, repetidos: Economia.repetidos(saidas, {essenciais:essenciais, minMeses:3, tolerancia:0.2, mesesExtrato:mesesExtrato}),
    acima: acima, gastoCat: E.gastoCat })
    .filter(function(it){ return it.tipo!=='cancelar' || E.gastoCat[it.cat]; });   /* sem gasto no período: nada a cancelar aqui */
  lista.forEach(function(it){
    var a = acima.filter(function(x){ return x.id===it.id; })[0];
    if (a) it.motivo = 'Em '+ult.name+' você gastou '+brl.format(a.agora)+' com '+a.cat+', '+brl.format(a.dif)+' acima da média.';
  });
  return lista;
}
/* o total de tudo que dá para economizar (cada item no valor sugerido), com o limite por categoria */
function resumoEconomia(){
  var E = state.eco;
  if (!E || E.semana) return {total:0, n:0};
  var lista = itensEconomia(E), todos = {};
  lista.forEach(function(it){ if (it.tipo!=='info') todos[it.id] = true; });
  return { total: Economia.simular(lista, todos, E.gastoCat).total, n: Object.keys(todos).length };
}
function renderEconomia(){
  var E = state.eco;
  if (!E) return;
  var C = ecoCfg();
  $('eSemana').hidden = !E.semana;
  $('eCorpo').hidden = !!E.semana;
  if (E.semana) return;
  $('eBase').textContent = E.base || '';
  var lista = state.ecoItens = itensEconomia(E);
  state.ecoResumo = resumoEconomia();
  $('eLista').innerHTML = lista.length ? lista.map(function(it){
    var marc = C.marcados[it.id], cat = it.tipo==='cancelar' ? '' : it.cat;
    var abre = it.tipo==='cancelar' ? ' data-abre-busca="'+esc(it.titulo.replace(/^Cancelar /, ''))+'"' : (cat ? ' data-abre-cat="'+esc(cat)+'"' : '');
    var corte = it.tipo==='categoria' && marc ? '<label class="eco-corte">Cortar <input type="range" min="10" max="100" step="10" value="'+Math.round((typeof marc==='number' ? marc : Economia.pctInicial(it))*100)+'" data-pct="'+esc(it.id)+'"> <b data-pctv="'+esc(it.id)+'"></b> de '+brl0.format(it.base)+'/mês</label>' : '';
    return '<li class="eco-item'+(marc ? ' marcado' : '')+(it.tipo==='info' ? ' info' : '')+'">'+
      (it.tipo==='info' ? '<span class="eco-ck-vazio" aria-hidden="true"></span>' : '<input type="checkbox" data-id="'+esc(it.id)+'"'+(marc ? ' checked' : '')+' aria-label="Topo fazer: '+esc(it.titulo)+'">')+
      '<div class="eco-txt">'+(abre ? '<button type="button" class="eco-tit"'+abre+' title="Ver os lançamentos">'+esc(it.titulo)+'</button>' : '<span class="eco-tit">'+esc(it.titulo)+'</span>')+
        ' <span class="eco-tag">'+esc(it.etiqueta)+'</span>'+(it.motivo ? '<span class="eco-motivo">'+esc(it.motivo)+'</span>' : '')+corte+'</div>'+
      '<span class="eco-val" data-val="'+esc(it.id)+'"></span></li>';
  }).join('') : '<li class="eco-vazio">Nada para sugerir neste período: os gastos estão dentro do normal.</li>';
  var ativo = document.activeElement;
  if (ativo!==$('eMetaIn')) $('eMetaIn').value = C.meta ? numBR.format(C.meta) : '';
  if (ativo!==$('eFixoIn')) $('eFixoIn').value = C.fixo ? numBR.format(C.fixo) : '';
  var g = E.guardado;
  $('eGuardou').hidden = !(g>0.005);
  $('eGuardou').textContent = g>0.005 ? 'Você guardou '+brl.format(g)+' em investimentos e reservas'+(E.nM>1 ? ' ('+brl.format(g/E.nM)+' por mês)' : '')+'.' : '';
  atualizarEconomia();
}
/* números que mudam ao marcar ou mexer num corte, sem redesenhar a lista */
function atualizarEconomia(){
  var E = state.eco, C = ecoCfg(), lista = state.ecoItens || [];
  if (!E || E.semana) return;
  var sim = state.ecoSim = Economia.simular(lista, C.marcados, E.gastoCat);
  lista.forEach(function(it){
    var el = document.querySelector('#eLista [data-val="'+cssEsc(it.id)+'"]');
    if (!el) return;
    var v = sim.porItem[it.id];
    el.textContent = it.economia==null ? 'sem valor estimado' : '~'+brl0.format(v!=null ? v : it.economia)+'/mês';
    if (sim.cortados.indexOf(it.id)!==-1) el.insertAdjacentHTML('beforeend', '<small class="eco-lim">já está no limite do que você gasta em '+esc(it.cat)+'</small>');
    var pv = document.querySelector('#eLista [data-pctv="'+cssEsc(it.id)+'"]');
    if (pv) pv.textContent = Math.round((typeof C.marcados[it.id]==='number' ? C.marcados[it.id] : it.economia/it.base)*100)+'%';
  });
  /* meta */
  var meta = C.meta, sobra = E.sobraMes, extra = sim.total, tx;
  var cheia = 0, clara = 0;
  if (!meta) tx = 'Defina quanto quer sobrar por mês.';
  else {
    var bm = Economia.barraMeta(sobra, extra, meta); cheia = bm.cheia; clara = bm.clara;
    if (sobra<0) tx = 'Faltou '+brl.format(-sobra)+' por mês no período';
    else if (sobra>=meta) tx = 'Meta batida: sobrou '+brl.format(sobra)+' de '+brl.format(meta);
    else tx = 'Sobrou '+brl.format(sobra)+' de '+brl.format(meta)+' · faltam '+brl.format(meta-sobra);
  }
  $('eMetaBarra').hidden = !meta;
  $('eMetaBarra').querySelector('.eco-cheia').style.width = cheia.toFixed(2)+'%';
  $('eMetaBarra').querySelector('.eco-extra').style.width = clara.toFixed(2)+'%';
  var comMarc = meta && extra>0.005 ? sobra+extra : null;
  $('eMetaTx').textContent = tx;
  if (comMarc!==null){
    $('eMetaTx').appendChild(document.createTextNode(' · com o que você marcou: '+(comMarc>=0 ? '' : 'ainda faltaria ')));
    var sp = document.createElement('span'); sp.className = 'eco-conta'; sp.textContent = brl.format(Math.abs(comMarc)); $('eMetaTx').appendChild(sp);
  }
  $('eMetaTx').dataset.extra = comMarc!==null ? (comMarc>=0 ? '' : 'ainda faltaria ')+brl.format(Math.abs(comMarc)) : '';
  contarEco(comMarc);
  /* brilho: a primeira vez nesta visita que o total passa da meta */
  var passou = meta && sobra+extra>=meta, antes = state.ecoPassou;
  state.ecoPassou = passou;
  if (passou && antes===false && !state.ecoBrilhou && !semMovimento()){
    state.ecoBrilhou = true;
    var bar = $('eMetaBarra'); bar.classList.remove('brilha'); void bar.offsetWidth; bar.classList.add('brilha');
    setTimeout(function(){ bar.classList.remove('brilha'); }, 1300);
  }
  /* objetivo */
  var o = C.objetivo, form = !!state.ecoObjForm;
  $('eObjForm').hidden = !form;
  $('eObjAbrir').hidden = !!o || form;
  $('eObjEditar').hidden = !o || form;
  $('eObjRemover').hidden = !o;
  $('eObjVer').hidden = !o || form;
  if (o){
    var r = Economia.objetivo(o, Math.max(0, sobra)+extra, C.fixo, HOJE());
    var t = esc(o.nome)+' · '+brl0.format(o.valor)+' até '+prazoTxt(o.prazo)+'. ';
    if (r.estado==='alcancado') t += 'Objetivo alcançado!';
    else if (r.estado==='prazo-passou') t += 'O prazo passou: escolha um novo.';
    else {
      t += 'Juntou '+brl0.format(o.tenho||0)+'. Faltam '+brl0.format(r.falta)+' · precisa de '+brl0.format(r.porMes)+'/mês até '+prazoTxt(o.prazo)+'. ';
      t += r.estado==='ok' ? 'No ritmo atual, chega em '+mesesTxt(r.meses)+'.' : r.estado==='nao-chega' ? 'Neste ritmo não chega no prazo.' : 'Neste ritmo não sobra nada para o objetivo.';
      if (r.mesesFixo) t += ' Guardando '+brl0.format(C.fixo)+'/mês, chega em '+mesesTxt(r.mesesFixo)+'.';
    }
    $('eObjTx').innerHTML = t;
    $('eObjBarra').querySelector('.eco-cheia').style.width = Math.min(100, (o.tenho||0)/o.valor*100).toFixed(2)+'%';
  }
  /* total */
  $('eTotal').textContent = extra>0.005 ? 'Com o que você marcou: ~'+brl0.format(extra)+'/mês · '+brl0.format(extra*12)+'/ano'
    : (state.ecoResumo && state.ecoResumo.n ? 'Tudo somado: ~'+brl0.format(state.ecoResumo.total)+'/mês' : '');
}
/* "com o que você marcou" conta do valor anterior até o novo; o texto final é o exato */
function contarEco(alvo){
  var de = state.ecoAntes; state.ecoAntes = alvo;
  var token = state.ecoToken = (state.ecoToken || 0) + 1;
  var sp = document.querySelector('#eMetaTx .eco-conta');
  if (!sp || alvo===null || de===null || de===undefined || Math.abs(de-alvo)<0.005 || semMovimento() || !window.requestAnimationFrame) return;
  var final = sp.textContent, ini = null;
  var passo = function(t){
    if (token!==state.ecoToken) return;
    if (ini===null) ini = t;
    var p = Math.min(1, (t-ini)/800), v = de + (alvo-de)*(1-Math.pow(1-p, 3));
    sp.textContent = p<1 ? brl.format(Math.abs(v)) : final;
    if (p<1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}
/* chegada: blocos em cascata e barras enchendo do zero */
var ecoTimer = null;
function animarEconomia(){
  var v = $('viewEconomia');
  if (semMovimento()) return;
  v.classList.remove('entra'); void v.offsetWidth; v.classList.add('entra');
  var barras = Array.prototype.slice.call(v.querySelectorAll('.eco-barra i'));
  var alvos = barras.map(function(b){ return b.style.width; });
  barras.forEach(function(b){ b.style.transition = 'none'; b.style.width = '0%'; });
  void v.offsetWidth;
  barras.forEach(function(b, i){ b.style.transition = ''; b.style.width = alvos[i]; });
  clearTimeout(ecoTimer);
  ecoTimer = setTimeout(function(){ v.classList.remove('entra'); }, 1400);
}
function cssEsc(s){ return String(s).replace(/["\\]/g, '\\$&'); }
function ecoItem(id){ return (state.ecoItens || []).filter(function(x){ return x.id===id; })[0]; }
$('eMetaIn').addEventListener('change', function(){ ecoCfg().meta = lerValor(this.value); saveCfg(); this.blur(); renderEconomia(); });
$('eFixoIn').addEventListener('change', function(){ ecoCfg().fixo = lerValor(this.value); saveCfg(); this.blur(); renderEconomia(); });
$('eLista').addEventListener('change', function(e){
  var C = ecoCfg();
  if (e.target.matches('input[type=checkbox][data-id]')){
    var it = ecoItem(e.target.dataset.id); if (!it) return;
    if (e.target.checked) C.marcados[it.id] = true;   /* vale a economia sugerida até a pessoa mexer no controle */
    else delete C.marcados[it.id];
    saveCfg(); renderEconomia();
    var volta = document.querySelector('#eLista input[data-id="'+cssEsc(it.id)+'"]'); if (volta) volta.focus();
  } else if (e.target.matches('input[type=range][data-pct]')) saveCfg();
});
$('eLista').addEventListener('input', function(e){
  if (!e.target.matches('input[type=range][data-pct]')) return;
  ecoCfg().marcados[e.target.dataset.pct] = (+e.target.value)/100;
  atualizarEconomia();
});
$('eLista').addEventListener('click', function(e){
  var b = e.target.closest('[data-abre-cat], [data-abre-busca]'); if (!b) return;
  if (b.dataset.abreCat) abrirLancamentos(b.dataset.abreCat);
  else { state.q = b.dataset.abreBusca; $('q').value = state.q; abrirLancamentos('all'); }
});
function abrirObjetivo(){
  var o = ecoCfg().objetivo || {};
  state.ecoObjForm = true;
  $('eObjNome').value = o.nome || ''; $('eObjValor').value = o.valor ? numBR.format(o.valor) : '';
  var h = HOJE(); $('eObjPrazo').min = h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0');
  $('eObjPrazo').value = Economia.lerPrazo(o.prazo) || ''; $('eObjTenho').value = o.tenho ? numBR.format(o.tenho) : '';
  $('eObjErro').hidden = true;
  atualizarEconomia(); $('eObjNome').focus();
}
$('eObjAbrir').addEventListener('click', abrirObjetivo);
$('eObjEditar').addEventListener('click', abrirObjetivo);
$('eObjSalvar').addEventListener('click', function(){
  var valor = lerValor($('eObjValor').value), prazo = Economia.lerPrazo($('eObjPrazo').value);
  if (!valor || !prazo){ $('eObjErro').textContent = 'Preencha quanto quer juntar e até quando (mês e ano, por exemplo 12/2027).'; $('eObjErro').hidden = false; return; }
  ecoCfg().objetivo = { nome: $('eObjNome').value.trim().slice(0, 40) || 'Objetivo', valor:valor, prazo:prazo, tenho: lerValor($('eObjTenho').value) || 0 };
  state.ecoObjForm = false; saveCfg(); atualizarEconomia(); $('eObjEditar').focus();
});
$('eObjRemover').addEventListener('click', function(){ ecoCfg().objetivo = null; state.ecoObjForm = false; saveCfg(); atualizarEconomia(); $('eObjAbrir').focus(); });

/* ---------- "Como funciona": a pílula de cada página abre e fecha a explicação dela ---------- */
function ajudaAbrir(btn, abrir){
  var q = $(btn.getAttribute('aria-controls'));
  q.hidden = !abrir;
  btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  if (abrir){ var h = q.querySelector('h2'); if (h) h.focus(); } else btn.focus();
}
document.addEventListener('click', function(e){
  var b = e.target.closest('.ajuda-btn');
  if (b){ if ($(b.getAttribute('aria-controls')).hidden) ajudaAbrir(b, true); return; }   /* fecha só no X */
  var f = e.target.closest('[data-ajuda-fechar]');
  if (f){ var q = f.closest('.ajuda-quadro'); ajudaAbrir(document.querySelector('.ajuda-btn[aria-controls="'+q.id+'"]'), false); }
});
document.addEventListener('keydown', function(e){
  var q = e.key==='Escape' && e.target.closest && e.target.closest('.ajuda-quadro');
  if (q) ajudaAbrir(document.querySelector('.ajuda-btn[aria-controls="'+q.id+'"]'), false);
});

/* ---------- inicialização: busca tudo no servidor ---------- */
state.rules = {}; state.askPrefs = {}; state.custom = []; state.bEdits = {};
API.estado().then(function(e){
  REGRAS_PADRAO = e.categorias_padrao;
  OTHER = e.outros || OTHER;
  state.custom = e.categorias.map(categoriaLocal);
  Object.keys(e.edicoes).forEach(function(k){ var x = e.edicoes[k]; state.bEdits[k] = { name:x.nome, type:x.tipo, kws:x.palavras }; });
  Object.keys(e.regras).forEach(function(k){ var r = e.regras[k]; state.rules[k] = { cat:r.categoria, label:r.rotulo, at:r.criada_em }; });
  state.askPrefs = e.preferencias.confirmacoes || {};
  cfg = e.preferencias.config || {};
  delete cfg.porPagina;  /* versão anterior guardava a quantidade por vez; agora sempre começa em 10 */
  var un = $('userName'); if (un) un.textContent = e.usuario.nome;
  applyCfg();
  renderSales();
  refreshFixed();
  renderPrefNotes();
  setMode(VENDAS_ATIVO ? null : 'despesas');
}).catch(function(e){
  var m = $('msg');
  if (m){ m.textContent = 'Não foi possível carregar o painel: '+e.message; m.className = 'msg error'; m.hidden = false; }
});
})();
