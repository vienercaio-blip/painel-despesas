(function(){
'use strict';



/* Painel de Despesas: telas.
   Os dados (extratos, categorias, regras, páginas, preferências) ficam no
   servidor e chegam pela API (js/api.js). A leitura dos arquivos e a
   categorização automática também são feitas no servidor. */
var OTHER = 'Outros (revisar)';
/* Categorias padrão de cada perfil: preenchido com o que vem de /api/estado. */
var PROFILES = {};
function validPerfil(v){ return PROFILES[v] ? v : 'pf'; }
function curPerfil(){ return validPerfil(state.perfil); }
function curRules(){ return PROFILES[curPerfil()].rules; }
function baseFixed(){ return PROFILES[curPerfil()].fixed; }
function bKey(i){ return curPerfil()+':'+i; }
/* tipo de conta escolhido nas configurações (vale para os extratos enviados) */
function chosenPerfil(){ return validPerfil(cfg.perfil); }
function builtinDefs(){
  var ed = state.bEdits || {}, fx = baseFixed();
  return curRules().map(function(r,i){
    var e = ed[bKey(i)];
    return { id:'b'+i, idx:i, builtin:true, edited:!!e,
      name: (e && e.name) || r[0],
      type: (e && e.type) || (fx.indexOf(r[0])!==-1 ? 'fixo' : 'variavel'),
      kws: (e && e.kws) ? e.kws : r[1].map(function(k){ return k.trim(); }),
      raw: (e && e.kws) ? null : r[1] };
  });
}
function customDefs(){ return (state.custom||[]).map(function(c){ return {id:c.id, builtin:false, name:c.name, type:c.type, kws:c.kws||[]}; }); }
function allDefs(){ return builtinDefs().concat(customDefs()); }
function allCats(){ return allDefs().map(function(d){ return d.name; }).concat([OTHER]); }
function feesName(){ return builtinDefs()[0].name; }
function renameCat(orig, name){
  if (orig===name) return;
  Object.keys(state.rules).forEach(function(k){ if (state.rules[k].cat===orig) state.rules[k].cat = name; });
  Object.keys(state.overrides).forEach(function(k){ if (state.overrides[k]===orig) state.overrides[k] = name; });
  if (state.cat===orig) state.cat = name;
  if (state.fcat===orig) state.fcat = name;
}
function parseKws(txt){ return String(txt||'').split(',').map(function(k){ return norm(k).trim(); }).filter(function(k){ return k.length>=2; }); }

var state = { perfil: 'pf', rules: {}, tx: [], overrides: {}, filter: 'out', q: '', source: 'sample', fileName: '', p: {y:'all', m:'all', w:'all'} };
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
function cur(){ return state.tx.filter(function(t){ return inP(t, state.p); }); }
function prevP(){
  var p = state.p;
  if (p.w!=='all'){ var d = keyDate(p.w); d.setDate(d.getDate()-7); var k = weekKey(d); return {p:{y:'all',m:'all',w:k}, label:'semana anterior'}; }
  if (p.m!=='all'){ var y=+p.y, m=+p.m-1; if (m<0){m=11;y--;} return {p:{y:String(y),m:String(m),w:'all'}, label:'mês anterior'}; }
  if (p.y!=='all') return {p:{y:String(+p.y-1),m:'all',w:'all'}, label:'ano anterior'};
  return null;
}
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

function catOf(tx){
  if (state.overrides[tx.id]) return state.overrides[tx.id];
  if (tx.value<0 && state.rules && state.rules[tx.origin]) return state.rules[tx.origin].cat;
  return tx.auto;
}
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
    var n = state.tx.filter(function(t){return t.value<0 && t.origin===k;}).length;
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
  return { date:keyDate(l.data), desc:l.descricao, value:l.valor, auto:l.categoria_auto, kw:l.palavra, origin:l.origem, dbId:l.id||null };
}
function load(list, source, name){
  list.sort(function(a,b){return a.date-b.date;});
  state.raw = list; state.savedId = null; state.loaded = true; state.fcat = 'all'; state.filter = 'out'; state.q = '';
  $('q').value = ''; document.querySelectorAll('.table-tools .seg button').forEach(function(x){ x.setAttribute('aria-pressed', x.dataset.f==='out' ? 'true':'false'); });
  refreshTabs();
  state.tx = list.map(function(t,i){
    return {id:i, dbId:t.dbId||null, date:t.date, desc:t.desc, value:t.value, auto:t.value<0 ? t.auto : null, kw:t.value<0 ? t.kw : null, origin:t.origin};
  });
  state.overrides = {}; state.source = source; state.fileName = name||''; state.cat = null; state.p = {y:'all', m:'all', w:'all'};
  refreshFixed();  /* custos fixos do perfil deste extrato (antes ficava sempre o de pessoa física) */
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
  showMsg('Enviando '+(files.length===1?'o arquivo':files.length+' arquivos')+' para leitura…', false);
  var perfil = chosenPerfil();
  API.lerArquivos(files, perfil).then(function(resp){
    var results = resp.arquivos;
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
    $('upFiles').innerHTML = results.map(function(r){
      return '<li class="'+(r.erro?'bad':'')+'"><span class="fn">'+esc(r.nome)+'</span><span class="fc">'+(r.erro ? esc(r.erro) : r.lancamentos.length+' lançamentos')+'</span></li>';
    }).join('');
    if (!good.length){
      $('upResult').hidden = false; $('upResTitle').textContent = 'Não foi possível ler o extrato';
      $('upSum').textContent = 'Confira o formato do arquivo e tente de novo.';
      $('upResult').querySelector('.drop-actions').hidden = true;
      $('msg').hidden = true;
      return;
    }
    var nome = good.map(function(r){return r.nome;}).join(', ');
    state.perfil = perfil;
    var salvar = $('saveMode').checked;
    /* salvar só guarda o extrato: as telas do painel abrem quando o usuário
       escolhe um extrato em "Extratos salvos" (ou envia sem salvar) */
    var pronto = salvar
      ? API.salvarExtrato({ tipo:'despesas', nome:nome.slice(0,120), perfil:perfil, pagina_id:$('savePage').value || null, lancamentos:combined })
          .then(function(){ fecharExtrato(); return recarregarSalvos().then(function(){ return true; }); },
                function(e){ load(combined.map(doServidor), 'file', nome); toast(e.message); return false; })
      : Promise.resolve(load(combined.map(doServidor), 'file', nome)).then(function(){ return null; });
    pronto.then(function(saved){
      var lista = combined.map(doServidor).sort(function(x,y){ return x.date-y.date; });
      var a = lista[0].date, b = lista[lista.length-1].date;
      var months = {}; lista.forEach(function(t){ months[t.date.getFullYear()+'-'+t.date.getMonth()] = 1; });
      var nm = Object.keys(months).length;
      $('upResTitle').textContent = 'Últimos extratos';
      $('upSum').textContent = lista.length+' lançamentos de '+fmtDate(a)+' a '+fmtDate(b)+' ('+nm+(nm===1?' mês':' meses')+')'+(dup?'. '+dup+(dup===1?' lançamento repetido foi ignorado':' lançamentos repetidos foram ignorados'):'')+'.'+
        (saved===true ? ' Salvo em Extratos salvos. Abra o extrato na lista para ver o painel.' : saved===false ? ' Não foi possível salvar, mas você pode ver o painel agora.' : '');
      $('upResult').querySelector('.drop-actions').hidden = saved===true;
      $('upResult').hidden = false;
      $('msg').hidden = true;
      /* extrato salvo: leva o usuário direto para a lista de salvos */
      if (saved===true){
        showPanel('salvos');
        $('panelSalvos').scrollIntoView({behavior:'smooth', block:'start'});
        toast('Extrato salvo: '+lista.length+' lançamentos'+(dup ? ' ('+dup+' repetidos ignorados)' : '')+'. Clique nele para abrir o painel.');
      }
    });
  }).catch(function(e){ showMsg(e.message, true); });
}
function showMsg(t, err){ var m=$('msg'); m.textContent=t; m.className='msg'+(err?' error':''); m.hidden=false; }

/* ---------- rendering ---------- */
function sums(list){
  var ins = 0, outs = 0;
  list.forEach(function(t){ if (t.value>0) ins += t.value; else outs -= t.value; });
  return {ins:ins, outs:outs};
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
  return { id:m.id, name:m.nome, page:m.pagina_id, perfil:m.perfil, savedAt:m.salvo_em, n:m.quantidade, first:m.inicio, last:m.fim };
}
function getSaved(){ return savedCache[kindNow()] || []; }
function getPages(){ return pagesCache[kindNow()] || []; }
function recarregarSalvos(){
  var k = kindNow();
  return Promise.all([API.listarExtratos(k), API.listarPaginas(k)]).then(function(r){
    savedCache[k] = r[0].map(metaLocal);
    pagesCache[k] = r[1].map(function(p){ return {id:p.id, name:p.nome, at:p.criado_em}; });
    renderSaved();
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
  if (MODE==='vendas' || !state.savedId) return;
  var map = mapaCorrecoes(), s = JSON.stringify(map);
  if (s===lastOv) return;
  lastOv = s;
  API.salvarCorrecoes(state.savedId, map).catch(falhou);
}
/* busca o extrato salvo no servidor e mostra nas telas */
function carregarSalvo(id){
  return API.abrirExtrato(id).then(function(x){
    state.perfil = validPerfil(x.perfil);
    load(x.lancamentos.map(doServidor), 'file', x.nome);
    var porDb = {};
    state.tx.forEach(function(t){ if (t.dbId) porDb[t.dbId] = t.id; });
    state.overrides = {};
    Object.keys(x.correcoes || {}).forEach(function(dbId){ if (porDb[dbId]!==undefined) state.overrides[porDb[dbId]] = x.correcoes[dbId]; });
    state.savedId = id;
    lastOv = JSON.stringify(mapaCorrecoes());
    render(); renderSaved();
  });
}
function openSaved(id){
  if (MODE==='vendas'){ openSavedSales(id); return; }
  carregarSalvo(id).then(function(){
    $('upResult').hidden = true;
    location.hash = 'dashboard';
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
    if (location.hash==='#dashboard') setView(); else location.hash = 'dashboard';
  }).catch(falhou);
}
var ICON_GEAR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path></svg>';
var ICON_PEN = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
var ICON_FOLDER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M12 11v5M9.5 13.5 12 16l2.5-2.5"></path></svg>';
var ICON_TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"></path></svg>';
var ICON_FOLDER_S = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>';
function renderSaved(){
  var a = getSaved(), pages = getPages();
  var W = MODE==='vendas' ? ['planilha','planilhas','vendas'] : ['extrato','extratos','lançamentos'];
  $('svTitle').textContent = MODE==='vendas' ? 'Planilhas de vendas salvas' : 'Extratos salvos';
  if (state.page && state.page!=='none' && !pages.some(function(p){ return p.id===state.page; })) state.page = null;
  var cur = state.page || null;
  $('savedCount').textContent = a.length ? a.length+(a.length===1?' '+W[0]+' salvo':' '+W[1]+' salvos')+(pages.length ? ' em '+pages.length+(pages.length===1?' página':' páginas') : '') : 'Nenhum '+W[0]+' salvo ainda';

  var cnt = function(pid){ return a.filter(function(x){ return pid==='none' ? !x.page || !pages.some(function(p){return p.id===x.page;}) : x.page===pid; }).length; };
  var tab = function(id, label, n){ var on = (cur||'all')===id; return '<button type="button" role="tab" class="ptab" data-page="'+esc(id)+'" aria-selected="'+on+'">'+(id==='all'||id==='none'?'':ICON_FOLDER_S)+'<span class="pn">'+esc(label)+'</span><span class="cnt">'+n+'</span></button>'; };
  $('pagesBar').innerHTML = tab('all','Todos',a.length) + pages.map(function(p){ return tab(p.id, p.name, cnt(p.id)); }).join('') + (pages.length ? tab('none','Sem página',cnt('none')) : '');

  var ph = $('pageHead');
  if (cur && cur!=='none'){
    var pg = pages.filter(function(p){ return p.id===cur; })[0];
    ph.hidden = false;
    ph.innerHTML = state.editingPage===cur
      ? '<form class="inline-form" id="renPageForm" novalidate><label for="renPageName">Novo nome da página</label><div class="inline-row"><input id="renPageName" maxlength="40" autocomplete="off" value="'+esc(pg.name)+'"><button type="submit" class="btn primary">Salvar nome</button><button type="button" class="btn ghost" data-pcancel="1">Cancelar</button></div><p class="form-err" id="renPageErr" role="alert" hidden></p></form>'
      : '<span class="ph-name">Página <b>'+esc(pg.name)+'</b></span><span class="sva"><button type="button" class="btn" data-pren="1">Renomear página</button><button type="button" class="btn" data-pdel="1">Excluir página</button></span>';
  } else { ph.hidden = true; ph.innerHTML = ''; }

  var shown = a.filter(function(x){
    if (!cur) return true;
    var valid = x.page && pages.some(function(p){ return p.id===x.page; });
    return cur==='none' ? !valid : x.page===cur;
  });
  $('savedEmpty').hidden = shown.length>0;
  $('savedEmpty').textContent = a.length ? 'Nenhum extrato nesta página. Use "Mover para" em um extrato para colocá-lo aqui.' : 'Nenhum '+W[0]+' salvo ainda. Envie '+(MODE==='vendas'?'uma planilha':'um extrato')+' com a opção "Salvar para acessar depois" marcada e ele aparece aqui.';
  var popts = function(sel){ return '<option value=""'+(!sel?' selected':'')+'>Sem página</option>'+pages.map(function(p){ return '<option value="'+esc(p.id)+'"'+(p.id===sel?' selected':'')+'>'+esc(p.name)+'</option>'; }).join(''); };
  $('savedList').innerHTML = shown.map(function(x){
    var f = x.first ? keyDate(x.first) : null, l = x.last ? keyDate(x.last) : null;
    var pn = x.page ? pageName(x.page) : null;
    var moveBlock = state.movingSaved===x.id
      ? '<form class="inline-form move-form" data-id="'+esc(x.id)+'" novalidate><label for="mvX">Mover para a página</label><div class="inline-row"><select id="mvX">'+popts(pn ? x.page : '')+'</select><button type="submit" class="btn primary">Mover</button><button type="button" class="btn ghost" data-mcancel="1">Cancelar</button></div></form>' : '';
    var open = state.menuFor===x.id;
    var menu = open ? '<div class="menu" role="menu" aria-label="Opções do extrato">'+
        '<button type="button" role="menuitem" data-xren="'+esc(x.id)+'">'+ICON_PEN+'Renomear</button>'+
        '<button type="button" role="menuitem" data-xmove="'+esc(x.id)+'"'+(pages.length?'':' disabled')+'>'+ICON_FOLDER+'Mover para outra página'+(pages.length?'':'<small>Crie uma página primeiro</small>')+'</button>'+
        '<button type="button" role="menuitem" class="danger-item" data-del="'+esc(x.id)+'">'+ICON_TRASH+'Excluir</button>'+
      '</div>' : '';
    var pick = MERGE_ON ? '<label class="sv-pick"><input type="checkbox" class="mg-check" data-mg="'+esc(x.id)+'"'+(MERGE_SEL.indexOf(x.id)!==-1?' checked':'')+' aria-label="Mesclar '+esc(x.name||'extrato')+'"></label>' : '';
    var nameBlock = state.editingSaved===x.id
      ? '<form class="inline-form ren-x" data-id="'+esc(x.id)+'" novalidate><label for="renX">Nome do extrato</label><div class="inline-row"><input id="renX" maxlength="80" autocomplete="off" value="'+esc(x.name||'')+'"><button type="submit" class="btn primary">Salvar nome</button><button type="button" class="btn ghost" data-xcancel="1">Cancelar</button></div><p class="form-err" id="renXErr" role="alert" hidden></p></form>'
      : '<strong>'+esc(x.name||'Extrato')+'</strong>';
    return '<li class="sv">'+pick+'<div class="svi">'+nameBlock+
      '<span>'+(f?fmtDate(f)+' a '+fmtDate(l)+' · ':'')+x.n+' '+(MODE==='vendas'?'vendas':'lançamentos')+' · '+(MODE==='vendas'?'':esc(perfilLabel(perfilOf(x)))+' · ')+'salvo em '+fmtDate(new Date(x.savedAt))+(pn && !cur ? ' · página '+esc(pn) : '')+'</span>'+
      (x.id===state.savedId?'<span class="open-now">Aberto agora</span>':'')+moveBlock+'</div>'+
      '<div class="sva sva-x"><button type="button" class="btn primary" data-open="'+esc(x.id)+'">Abrir</button>'+
      '<div class="menu-wrap"><button type="button" class="btn icon-btn" data-menu="'+esc(x.id)+'" aria-haspopup="menu" aria-expanded="'+open+'" aria-label="Configurações do extrato '+esc(x.name||'')+'">'+ICON_GEAR+'</button>'+menu+'</div>'+
      '</div></li>';
  }).join('');

  posicionarMenu();

  var sp = $('savePage'), keep = sp.value;
  sp.innerHTML = popts(null);
  if (keep && pages.some(function(p){ return p.id===keep; })) sp.value = keep;
  else if (cur && cur!=='none') sp.value = cur;
  sp.parentNode.hidden = !pages.length;
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
function showPanel(p){
  $('panelNovo').hidden = p!=='novo' || MODE!=='despesas';
  $('panelVendas').hidden = p!=='novo' || MODE!=='vendas';
  $('panelSalvos').hidden = p!=='salvos';
  document.querySelectorAll('.choice[data-panel]').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.panel===p ? 'true':'false'); });
}

function render(){
  persistOverrides();
  var all = state.tx;
  var tx = cur();
  if (!tx.length){ state.p = {y:'all', m:'all', w:'all'}; tx = all; }
  var ins = 0, outs = 0, byCat = {}, biggest = null;
  tx.forEach(function(t){
    if (t.value>0) ins += t.value;
    else { var a=-t.value; outs += a; var c=catOf(t); byCat[c]=(byCat[c]||0)+a; if(!biggest||a>-biggest.value) biggest=t; }
  });
  var res = ins - outs;
  var first = all[0].date, last = all[all.length-1].date;

  var pp = prevP(), prev = null;
  if (pp){ var pl = all.filter(function(t){ return inP(t, pp.p); }); if (pl.length){ prev = sums(pl); prev.label = pp.label; } }

  $('srcBadge').textContent = state.source==='sample' ? 'Exemplo · dados fictícios' : 'Seu extrato';
  $('srcBadge').className = 'badge' + (state.source==='sample' ? '' : ' real');
  var isSample = state.source==='sample';
  $('pageTitle').textContent = isSample ? 'Para onde vai o seu dinheiro' : 'Extrato de '+fmtDate(first)+' a '+fmtDate(last)+', a partir do arquivo "'+state.fileName+'".';
  $('pageTitle').className = isSample ? '' : 'extrato-title';
  $('srcText').textContent = isSample ? 'Este é um extrato de exemplo, de agosto a outubro de 2026. Envie o extrato do seu banco para ver os seus números.' : '';

  renderPeriod(tx);

  var nIn = tx.filter(function(t){return t.value>0;}).length, nOut = tx.length-nIn;
  $('kIn').textContent = brl.format(ins);  $('kInSub').innerHTML = nIn+' lançamentos'+(prev?deltaTxt(ins, prev.ins, prev.label):'');
  $('kOut').textContent = brl.format(outs); $('kOutSub').innerHTML = nOut+' lançamentos'+(prev?deltaTxt(outs, prev.outs, prev.label):'');
  $('kRes').textContent = brl.format(res);
  var pill = $('kResPill');
  pill.className = 'pill ' + (res>=0?'pos':'neg');
  pill.innerHTML = (res>=0
    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>Sobrou dinheiro'
    : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"></path></svg>Gastou mais do que entrou');

  var cats = Object.keys(byCat).map(function(k){return {name:k, v:byCat[k]};}).sort(function(a,b){
    if (a.name===OTHER) return 1; if (b.name===OTHER) return -1; return b.v-a.v; });
  var top = cats.filter(function(c){return c.name!==OTHER;})[0] || cats[0];
  $('kTop').textContent = top ? top.name : '—';
  $('kTopSub').textContent = top ? brl.format(top.v)+' · '+pct.format(outs?top.v/outs:0)+' das saídas' : '';

  var maxC = Math.max.apply(null, cats.map(function(c){return c.v;}).concat([1]));
  $('catHint').textContent = 'Total: '+brl.format(outs);
  $('cats').innerHTML = cats.map(function(c){
    var share = outs ? c.v/outs : 0;
    return '<li class="cat'+(c.name===OTHER?' other':'')+'"><button type="button" class="catbtn" data-cat="'+esc(c.name)+'" aria-label="Ver detalhes de '+esc(c.name)+'" data-tip="<b>'+esc(c.name)+'</b><br>'+brl.format(c.v)+' · '+pct.format(share)+' das saídas<br>Clique para ver de onde veio">'+
      '<span class="name">'+esc(c.name)+'</span><span class="amt num">'+brl0.format(c.v)+' · '+pct.format(share)+'</span>'+
      '<span class="track"><span class="bar" style="display:block;width:'+(c.v/maxC*100).toFixed(1)+'%"></span></span></button></li>';
  }).join('');
  $('catHint').textContent = 'Total: '+brl.format(outs)+' · clique para detalhar';

  state.catSummary = {cats:cats, outs:outs};
  if (!state.cat || !byCat[state.cat]) state.cat = top ? top.name : null;

  var p = state.p, mode;
  if (p.w!=='all') mode = 'day';
  else if (p.m!=='all') mode = 'week';
  else if (p.y!=='all') mode = 'month';
  else {
    var span = (tx[tx.length-1].date - tx[0].date)/864e5;
    mode = span > 730 ? 'year' : span > 40 ? 'month' : 'week';
  }
  renderFlow(tx, mode);
  renderInsights(ins, outs, res, cats, biggest, byCat, tx, prev);
  renderTable();
  renderCategorias();
  renderRules();
  renderCustom();
  renderDashboard();
}

function renderPeriod(tx){
  var all = state.tx, p = state.p;
  var years = []; all.forEach(function(t){ var y = String(t.date.getFullYear()); if (years.indexOf(y)===-1) years.push(y); });
  years.sort();
  $('pY').innerHTML = '<option value="all">Todos</option>'+years.map(function(y){return '<option value="'+y+'"'+(y===p.y?' selected':'')+'>'+y+'</option>';}).join('');

  var months = [];
  if (p.y!=='all') all.forEach(function(t){ if (t.date.getFullYear()===+p.y){ var m = String(t.date.getMonth()); if (months.indexOf(m)===-1) months.push(m); } });
  months.sort(function(a,b){return a-b;});
  $('pM').innerHTML = '<option value="all">'+(p.y==='all'?'Escolha o ano':'Todos')+'</option>'+months.map(function(m){return '<option value="'+m+'"'+(m===p.m?' selected':'')+'>'+MESES[+m].charAt(0).toUpperCase()+MESES[+m].slice(1)+'</option>';}).join('');
  $('pM').disabled = p.y==='all';

  var weeks = [];
  if (p.m!=='all') all.forEach(function(t){ if (t.date.getFullYear()===+p.y && t.date.getMonth()===+p.m){ var k = weekKey(t.date); if (weeks.indexOf(k)===-1) weeks.push(k); } });
  weeks.sort();
  $('pW').innerHTML = '<option value="all">'+(p.m==='all'?'Escolha o mês':'Todas')+'</option>'+weeks.map(function(k){return '<option value="'+k+'"'+(k===p.w?' selected':'')+'>'+weekLabel(k)+'</option>';}).join('');
  $('pW').disabled = p.m==='all';
  $('pClear').hidden = p.y==='all';

  $('pSum').textContent = 'Mostrando '+periodName(p)+' · '+tx.length+' lançamentos';

  var mm = {}, order = [];
  all.forEach(function(t){
    if (p.y!=='all' && t.date.getFullYear()!==+p.y) return;
    var k = t.date.getFullYear()+'-'+String(t.date.getMonth()).padStart(2,'0');
    if (!mm[k]){ mm[k] = {y:String(t.date.getFullYear()), m:String(t.date.getMonth()), res:0}; order.push(k); }
    mm[k].res += t.value;
  });
  order.sort();
  var mh = order.map(function(k){
    var o = mm[k], on = p.m===o.m && p.y===o.y && p.w==='all';
    var lab = MESES[+o.m].slice(0,3)+'/'+o.y.slice(2);
    return '<button type="button" class="mchip" data-y="'+o.y+'" data-m="'+o.m+'" aria-pressed="'+on+'" aria-label="'+MESES[+o.m]+' de '+o.y+', resultado '+brl.format(o.res)+'">'+
      '<span class="ml">'+lab+'</span><span class="mv '+(o.res>=0?'pos':'neg')+'">'+(o.res>=0?'+':'')+brl0.format(o.res)+'</span></button>';
  }).join('');
  /* esteira: repete a lista para o loop ser contínuo */
  $('pMonths').innerHTML = mh + mh.replace(/<button type="button" class="mchip"/g, '<button type="button" tabindex="-1" aria-hidden="true" class="mchip"');
  var half = $('pMonths').scrollWidth/2;
  $('pMonths').style.setProperty('--dur', Math.max(213, half/1.5).toFixed(1)+'s');
}

function renderCategorias(){
  var base = state.tx, outs = 0, byC = {};
  base.forEach(function(t){ if (t.value<0){ outs -= t.value; var c = catOf(t); byC[c] = (byC[c]||0) - t.value; } });
  var S = { outs: outs, cats: Object.keys(byC).map(function(k){return {name:k, v:byC[k]};}).sort(function(a,b){
    if (a.name===OTHER) return 1; if (b.name===OTHER) return -1; return b.v-a.v; }) };
  if (!state.cat || !byC[state.cat]) state.cat = S.cats.length ? S.cats[0].name : null;
  var span = base.length ? 'Todo o extrato, de '+fmtDate(base[0].date)+' a '+fmtDate(base[base.length-1].date) : '';
  $('catList').innerHTML = S.cats.map(function(c){
    var n = base.filter(function(t){return t.value<0 && catOf(t)===c.name;}).length;
    return '<button type="button" class="cat-item" data-cat="'+esc(c.name)+'" aria-current="'+(c.name===state.cat)+'">'+
      '<span class="n">'+esc(c.name)+'</span><span class="m"><span class="num">'+brl0.format(c.v)+'</span><br>'+n+(n===1?' lançamento':' lançamentos')+'</span></button>';
  }).join('') || '<p class="empty">Nenhuma despesa no extrato.</p>';

  var name = state.cat;
  var list = base.filter(function(t){return t.value<0 && catOf(t)===name;});
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

  var opts = function(sel){ return allCats().map(function(c){return '<option'+(c===sel?' selected':'')+'>'+esc(c)+'</option>';}).join(''); };
  $('origins').innerHTML = origins.map(function(o){
    return '<li class="origin"><div class="who"><strong>'+esc(o.label)+'</strong>'+
      '<span class="meta"><span class="num">'+brl.format(o.v)+'</span> · '+o.n+(o.n===1?' pagamento':' pagamentos')+' · último em '+fmtDate(o.last)+' · '+pct.format(o.v/total)+' da categoria</span>'+
      '<span class="track"><span class="bar" style="width:'+(o.v/maxO*100).toFixed(1)+'%"></span></span></div>'+
      '<label>Mover todos para <select data-origin="'+esc(o.key)+'" aria-label="Mover todos os pagamentos de '+esc(o.label)+'">'+opts(name)+'</select></label></li>';
  }).join('');

  $('cdRows').innerHTML = list.map(function(t){
    var why = state.overrides[t.id] ? '<span class="why manual">Só neste extrato</span>'
      : state.rules[t.origin] ? '<span class="why manual">Sua regra</span>'
      : t.kw ? '<span class="why">palavra "'+esc(t.kw)+'"</span>' : '<span class="why none">Nenhuma regra</span>';
    return '<tr><td class="num">'+fmtDate(t.date)+'</td><td>'+esc(t.desc)+'</td><td>'+why+'</td>'+
      '<td class="rule-cell"><select data-id="'+t.id+'" aria-label="Categoria de '+esc(t.desc)+'">'+opts(catOf(t))+'</select></td>'+
      '<td class="r num">'+brl.format(t.value)+'</td></tr>';
  }).join('');
}

/* ---------- dashboard ---------- */
var BASE_FIXED = ['Aluguel','Folha de pagamento','Água, luz e internet','Impostos e encargos','Tarifas bancárias'];
var FIXED = BASE_FIXED.slice();
function refreshFixed(){ FIXED = allDefs().filter(function(d){ return d.type==='fixo'; }).map(function(d){ return d.name; }); }
/* refaz a categoria automática dos lançamentos (no servidor) depois de mudar categorias */
function reclassify(){
  var uniq = [];
  state.tx.forEach(function(t){ if (t.value<0 && uniq.indexOf(t.desc)===-1) uniq.push(t.desc); });
  if (!uniq.length) return Promise.resolve();
  return API.categorizar(curPerfil(), uniq).then(function(r){
    var porDesc = {};
    uniq.forEach(function(d,i){ porDesc[d] = r.resultados[i]; });
    state.tx.forEach(function(t){ if (t.value<0){ var a = porDesc[t.desc]; t.auto = a.categoria; t.kw = a.palavra; } });
  });
}
function categoriaLocal(c){ return { id:c.id, name:c.nome, type:c.tipo, kws:c.palavras||[], at:c.criada_em }; }
function renderCustom(){
  var defs = allDefs();
  $('customEmpty').hidden = true;
  $('cntCustom').textContent = defs.length+1;
  var row = function(d){
    var n = state.tx.filter(function(t){ return t.value<0 && catOf(t)===d.name; }).length;
    if (state.editingCat===d.id){
      return '<li class="sv editing"><form class="ncform ec-form" data-id="'+esc(d.id)+'" novalidate>'+
        '<div class="nfield"><label for="ecName">Nome da categoria</label><input id="ecName" maxlength="40" autocomplete="off" value="'+esc(d.name)+'"></div>'+
        '<fieldset class="nfield"><legend>Tipo de custo</legend>'+
          '<label class="radio"><input type="radio" name="ecType" id="ecVar" value="variavel"'+(d.type!=='fixo'?' checked':'')+'> <span><b>Variável</b>, acompanha o movimento</span></label>'+
          '<label class="radio"><input type="radio" name="ecType" id="ecFix" value="fixo"'+(d.type==='fixo'?' checked':'')+'> <span><b>Fixo</b>, pago todo mês</span></label></fieldset>'+
        '<div class="nfield"><label for="ecKw">Palavras-chave <span class="opt">(opcional)</span></label><input id="ecKw" autocomplete="off" value="'+esc(d.kws.join(', '))+'"><span class="help">Separe por vírgula.</span></div>'+
        '<p class="form-err" id="ecErr" role="alert" hidden></p>'+
        '<div class="sva"><button type="submit" class="btn primary">Salvar alterações</button><button type="button" class="btn" data-ccancel="1">Cancelar</button></div>'+
      '</form></li>';
    }
    var tag = d.builtin ? (d.edited ? '<span class="ctag">Padrão, editada</span>' : '<span class="ctag">Padrão</span>') : '<span class="ctag mine">Criada por você</span>';
    var kw = d.kws.length ? 'palavras: '+esc(d.kws.slice(0,8).join(', '))+(d.kws.length>8?' e mais '+(d.kws.length-8):'') : 'sem palavras-chave';
    return '<li class="sv"><div class="svi"><strong>'+esc(d.name)+' '+tag+'</strong>'+
      '<span>'+(d.type==='fixo'?'Custo fixo':'Custo variável')+' · '+kw+' · '+n+(n===1?' lançamento':' lançamentos')+' neste extrato</span></div>'+
      '<div class="sva"><button type="button" class="btn" data-cedit="'+esc(d.id)+'">Editar</button>'+
      (d.builtin ? (d.edited ? '<button type="button" class="btn" data-creset="'+esc(d.id)+'">Restaurar padrão</button>' : '')
                 : '<button type="button" class="btn" data-cdel="'+esc(d.id)+'">Excluir</button>')+'</div></li>';
  };
  var nO = state.tx.filter(function(t){ return t.value<0 && catOf(t)===OTHER; }).length;
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
  var hits = state.tx.filter(function(t){ if (t.value>=0) return false; var d = norm(t.desc); return kws.some(function(k){ return d.indexOf(' '+k)!==-1; }); });
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
  var fo = op ? '" fill-opacity="'+op : '';
  var up = y1<y0, top = Math.min(y0,y1), h = Math.abs(y1-y0);
  if (h<0.5) return '';
  var r = Math.min(4, h, w/2);
  if (up) return '<path fill="'+fill+fo+'" d="M'+x.toFixed(1)+' '+y0.toFixed(1)+'V'+(top+r).toFixed(1)+'Q'+x.toFixed(1)+' '+top.toFixed(1)+' '+(x+r).toFixed(1)+' '+top.toFixed(1)+'H'+(x+w-r).toFixed(1)+'Q'+(x+w).toFixed(1)+' '+top.toFixed(1)+' '+(x+w).toFixed(1)+' '+(top+r).toFixed(1)+'V'+y0.toFixed(1)+'Z"></path>';
  var bot = y1;
  return '<path fill="'+fill+fo+'" d="M'+x.toFixed(1)+' '+y0.toFixed(1)+'V'+(bot-r).toFixed(1)+'Q'+x.toFixed(1)+' '+bot.toFixed(1)+' '+(x+r).toFixed(1)+' '+bot.toFixed(1)+'H'+(x+w-r).toFixed(1)+'Q'+(x+w).toFixed(1)+' '+bot.toFixed(1)+' '+(x+w).toFixed(1)+' '+(bot-r).toFixed(1)+'V'+y0.toFixed(1)+'Z"></path>';
}
/* data: [{label, v, tip, fill, mark}] ; o: {labelEvery, valueLabels, minW} */
function barSVG(data, o){
  o = o || {};
  var big = o && o.big, W=640, H=240, mL=big ? 100 : 76, mR=8, mT=22, mB=big ? 38 : 30, iw=W-mL-mR, ih=H-mT-mB;
  var vals = data.map(function(d){return d.v;});
  var sc = scaleFor(Math.min.apply(null, vals.concat([0])), Math.max.apply(null, vals.concat([0])));
  var y = function(v){ return mT + (sc.hi-v)/(sc.hi-sc.lo)*ih; };
  var s = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.aria||'Gráfico de barras')+'"'+(o.big?' class="big"':'')+' style="min-width:'+(o.minW||420)+'px">' + axisY(sc, y, mL, W, mR);
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
function lineSVG(pts, o){
  var W=900, H=260, mL=84, mR=16, mT=24, mB=30, iw=W-mL-mR, ih=H-mT-mB;
  var ys = pts.map(function(p){return p.y;});
  var sc = scaleFor(Math.min.apply(null, ys), Math.max.apply(null, ys));
  var x = function(i){ return mL + (pts.length<2 ? iw/2 : i/(pts.length-1)*iw); };
  var y = function(v){ return mT + (sc.hi-v)/(sc.hi-sc.lo)*ih; };
  var s = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.aria)+'" style="min-width:560px">' + axisY(sc, y, mL, W, mR);
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
function renderDashboard(){
  var tx = cur(); if (!tx.length) tx = state.tx; if (!tx.length) return;
  var isWeek = state.p.w!=='all';
  var first = tx[0].date, last = tx[tx.length-1].date;
  $('dSpan').textContent = (periodName(state.p)==='todo o período' ? 'Todo o extrato' : 'Período: '+periodName(state.p))+', de '+fmtDate(first)+' a '+fmtDate(last);

  /* por mês */
  function groupMonths(list){
    var M = {}, mk = [];
    list.forEach(function(t){
      var k = t.date.getFullYear()+'-'+String(t.date.getMonth()).padStart(2,'0');
      if (!M[k]){ M[k] = {k:k, y:t.date.getFullYear(), m:t.date.getMonth(), ins:0, outs:0, cat:{}}; mk.push(k); }
      var o = M[k];
      if (t.value>0) o.ins += t.value; else { o.outs -= t.value; var c = catOf(t); o.cat[c] = (o.cat[c]||0) - t.value; }
    });
    mk.sort();
    return mk.map(function(k){ var o = M[k]; o.res = o.ins-o.outs; o.label = MESES[o.m].slice(0,3)+'/'+String(o.y).slice(2); o.name = MESES[o.m]+' de '+o.y; return o; });
  }
  var months = groupMonths(tx), allMonths = groupMonths(state.tx);
  var nM = months.length;
  var T = sums(tx), res = T.ins - T.outs, margin = T.ins ? res/T.ins : 0;

  /* fixos e variáveis */
  var fixed = 0, byCat = {};
  tx.forEach(function(t){ if (t.value<0){ var c = catOf(t); byCat[c] = (byCat[c]||0) - t.value; if (FIXED.indexOf(c)!==-1) fixed -= t.value; } });
  var variable = T.outs - fixed, fixedM = fixed/nM, varM = variable/nM;
  var fees = byCat[feesName()] || 0;

  /* dias */
  var nDays = Math.round((last-first)/864e5)+1;
  var dowCount = [0,0,0,0,0,0,0], dowIns = [0,0,0,0,0,0,0];
  for (var i=0;i<nDays;i++){ var d = new Date(first); d.setDate(d.getDate()+i); dowCount[(d.getDay()+6)%7]++; }
  var domOut = []; for (var j=0;j<31;j++) domOut.push(0);
  tx.forEach(function(t){
    if (t.value>0) dowIns[(t.date.getDay()+6)%7] += t.value;
    else domOut[t.date.getDate()-1] -= t.value;
  });
  var dowAvg = dowIns.map(function(v,i){ return dowCount[i] ? v/dowCount[i] : 0; });
  var domAvg = domOut.map(function(v){ return v/nM; });
  var dailyIns = T.ins/nDays;
  function topOrigins(list, n, div){
    var g = {};
    list.forEach(function(t){ var k = t.origin; if (!g[k]) g[k] = {l:t.desc, v:0, c:0}; g[k].v += Math.abs(t.value); g[k].c++; });
    return Object.keys(g).map(function(k){return g[k];}).sort(function(a,b){return b.v-a.v;}).slice(0,n)
      .map(function(o){ return {l:o.l, v:o.v/(div||1), c:o.c}; });
  }
  function moreHTML(title, rows, note){
    return '<b class="tm-t">'+esc(title)+'</b>'+
      (rows.length ? '<ul class="tm-l">'+rows.map(function(r){ return '<li><span>'+esc(r[0])+'</span><span class="num">'+esc(r[1])+'</span></li>'; }).join('')+'</ul>' : '')+
      (note ? '<p class="tm-n">'+esc(note)+'</p>' : '');
  }
  var monthTx = {}, dayTx = {}, dowTx = [[],[],[],[],[],[],[]], domTx = [];
  for (var q=0;q<31;q++) domTx.push([]);
  tx.forEach(function(t){
    var mkk = t.date.getFullYear()+'-'+String(t.date.getMonth()).padStart(2,'0');
    (monthTx[mkk] = monthTx[mkk] || []).push(t);
    var dk = isoD(t.date); (dayTx[dk] = dayTx[dk] || []).push(t);
    if (t.value>0) dowTx[(t.date.getDay()+6)%7].push(t); else domTx[t.date.getDate()-1].push(t);
  });
  var avgRes = months.reduce(function(s,o){return s+o.res;},0)/nM;
  var feeTx = tx.filter(function(t){ return t.value<0 && catOf(t)===feesName(); });

  /* KPIs */
  var k = [
    {l: isWeek ? 'Resultado da semana' : nM===1 ? 'Resultado do mês' : 'Resultado médio por mês', v:brl.format(res/nM), s:(nM===1?'1 mês no extrato':nM+' meses no extrato'), pill: res>=0 ? ['pos','Lucro no período'] : ['neg','Prejuízo no período'],
      m: moreHTML('Resultado de cada mês', months.map(function(o){return [o.name, brl.format(o.res)];}), 'É tudo o que entrou menos tudo o que saiu, dividido pelo número de meses do extrato.')},
    {l:'Margem', v:pct.format(margin), s:'De cada R$ 100 que entram, '+(margin>=0?'sobram ':'faltam ')+brl.format(Math.abs(margin*100)),
      m: moreHTML('Margem de cada mês', months.map(function(o){return [o.name, pct.format(o.ins?o.res/o.ins:0)];}), 'Margem = resultado dividido pelas entradas. Quanto maior, mais folga no caixaio tem para imprevistos.')},
    {l: isWeek ? 'Custos fixos na semana' : 'Custos fixos por mês', v:brl.format(fixedM), s:pct.format(T.outs?fixed/T.outs:0)+' das saídas',
      m: moreHTML('O que forma os custos fixos', FIXED.filter(function(c){return byCat[c];}).map(function(c){return [c, brl.format(byCat[c]/nM)+'/mês'];}), 'Equivalem a cerca de '+Math.round(dailyIns ? fixedM/dailyIns : 0)+' dias de entradas. Reduzir um custo fixo melhora o resultado de todos os meses seguintes.')},
    {l:'Taxas de cartão e apps', v:pct.format(T.ins?fees/T.ins:0), s:brl.format(fees/nM)+(isWeek?' na semana':' por mês')+', sobre as entradas',
      m: moreHTML('De onde vêm as taxas', topOrigins(feeTx, 5, nM).map(function(o){return [o.l, brl.format(o.v)+'/mês'];}), 'Percentual calculado sobre tudo o que entrou na conta no período.')}
  ];
  $('dKpis').innerHTML = k.map(function(x){
    return '<div class="kpi hoverable" data-tip="'+esc('<b>'+esc(x.l)+'</b>')+'" data-more="'+esc(x.m)+'"><span class="label">'+esc(x.l)+'</span><span class="value num">'+esc(x.v)+'</span>'+
      (x.pill?'<span class="pill '+x.pill[0]+'">'+x.pill[1]+'</span>':'')+'<span class="sub">'+esc(x.s)+'</span></div>';
  }).join('');

  /* gráfico: resultado por mês */
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
  $('dRes').innerHTML = barSVG(chartM.map(function(o){
    return {label:o.label, v:o.res, fill: o.res>=0 ? 'var(--good)' : 'var(--bad)',
      tip:'<b>'+esc(o.name)+'</b><br>Entradas: '+brl.format(o.ins)+'<br>Saídas: '+brl.format(o.outs)+'<br>Resultado: '+brl.format(o.res)+'<br>Margem: '+pct.format(o.ins?o.res/o.ins:0),
      more: moreHTML('Maiores saídas do mês', Object.keys(o.cat).sort(function(a,b){return o.cat[b]-o.cat[a];}).slice(0,4).map(function(c){return [c, brl.format(o.cat[c])];}),
        nM>1 ? 'Resultado '+(o.res>=avgRes?'acima':'abaixo')+' da média dos meses em '+brl.format(Math.abs(o.res-avgRes))+'.' : '')};
  }), {valueLabels: chartM.length<=8, labelEvery: chartM.length>18 ? 3 : chartM.length>8 ? 2 : 1, big:true, aria:'Resultado por mês'});

  /* fixos x variáveis */
  var fp = T.outs ? fixed/T.outs*100 : 0;
  var fixList = FIXED.filter(function(c){return byCat[c];}).map(function(c){ return '<li><span>'+esc(c)+'</span><span class="num">'+brl.format(byCat[c]/nM)+'</span></li>'; }).join('');
  var varCats = Object.keys(byCat).filter(function(c){return FIXED.indexOf(c)===-1;}).sort(function(a,b){return byCat[b]-byCat[a];});
  var varList = varCats.map(function(c){ return '<li><span>'+esc(c)+'</span><span class="num">'+brl.format(byCat[c]/nM)+'</span></li>'; }).join('');
  $('dFix').innerHTML =
    '<div class="stack" role="img" aria-label="Fixos '+pct.format(fp/100)+', variáveis '+pct.format(1-fp/100)+'">'+
      '<span style="width:'+fp.toFixed(1)+'%;background:var(--s1)" data-tip="<b>Custos fixos</b><br>'+brl.format(fixedM)+' por mês" data-more="'+esc(moreHTML('Custos fixos por mês', FIXED.filter(function(c){return byCat[c];}).map(function(c){return [c, brl.format(byCat[c]/nM)];}), 'São pagos todo mês, com ou sem movimento. É o mínimo que o negócio precisa faturar.'))+'"></span>'+
      '<span style="width:'+(100-fp).toFixed(1)+'%;background:var(--s2)" data-tip="<b>Custos variáveis</b><br>'+brl.format(varM)+' por mês" data-more="'+esc(moreHTML('Custos variáveis por mês', varCats.slice(0,5).map(function(c){return [c, brl.format(byCat[c]/nM)];}), 'Sobem e descem com o movimento. Compare com as entradas para ver se estão crescendo no mesmo ritmo.'))+'"></span></div>'+
    '<div class="fv-cols">'+
      '<div><p class="fv-h"><i class="sw" style="background:var(--s1)"></i>Fixos <b class="num">'+brl.format(fixedM)+'</b> · '+pct.format(fp/100)+'</p><p class="fv-d">Pagos todo mês, vendendo ou não</p><ul class="fv-list">'+fixList+'</ul></div>'+
      '<div><p class="fv-h"><i class="sw" style="background:var(--s2)"></i>Variáveis <b class="num">'+brl.format(varM)+'</b> · '+pct.format(1-fp/100)+'</p><p class="fv-d">Acompanham o movimento</p><ul class="fv-list">'+varList+'</ul></div>'+
    '</div>';

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
  $('dCum').innerHTML = lineSVG(pts, {aria:'Caixa acumulado ao longo do extrato', marks:marks});

  /* dia da semana */
  var bestD = 0, worstD = 0;
  dowAvg.forEach(function(v,i){ if (v>dowAvg[bestD]) bestD = i; if (v<dowAvg[worstD]) worstD = i; });
  $('dWeek').innerHTML = barSVG(dowAvg.map(function(v,i){
    return {label:DOW[i].slice(0,3), v:v, fill:'var(--s1)', op: i===bestD ? null : 0.5, mark: i===bestD,
      tip:'<b>'+DOW[i]+'</b><br>Média de entradas: '+brl.format(v),
      more: moreHTML('O que entra às '+DOW[i].toLowerCase()+'s (média por dia)', topOrigins(dowTx[i], 3, dowCount[i]).map(function(o){return [o.l, brl.format(o.v)];}),
        'Considera '+dowCount[i]+' '+DOW[i].toLowerCase()+'s do extrato e representa '+pct.format(T.ins?dowIns[i]/T.ins:0)+' de tudo o que entrou.')};
  }), {aria:'Entradas médias por dia da semana', minW:360});

  /* dia do mês */
  var order = domAvg.map(function(v,i){return i;}).sort(function(a,b){return domAvg[b]-domAvg[a];});
  var top3 = order.slice(0,3), top3sum = top3.reduce(function(s,i){return s+domAvg[i];},0);
  $('dDom').innerHTML = barSVG(domAvg.map(function(v,i){
    var hot = top3.indexOf(i)!==-1;
    return {label:String(i+1), v:v, fill:'var(--s2)', op: hot ? null : 0.45, mark: hot,
      tip:'<b>Dia '+(i+1)+'</b><br>Saída média: '+brl.format(v),
      more: moreHTML(domTx[i].length ? 'O que costuma sair no dia '+(i+1)+' (média por mês)' : 'Nada costuma sair neste dia', topOrigins(domTx[i], 4, nM).map(function(o){return [o.l, brl.format(o.v)];}),
        domTx[i].length ? pct.format(T.outs?domOut[i]/T.outs:0)+' de todas as saídas do extrato.' : '')};
  }), {labelEvery:5, aria:'Saídas médias por dia do mês', minW:460});

  /* categorias que mais mudaram */
  var chg = [], cmpA = null, cmpB = null;
  if (nM>=2){ cmpA = months[nM-2]; cmpB = months[nM-1]; }
  else if (!isWeek){
    var only = months[0], pm = only.m-1, py = only.y; if (pm<0){ pm = 11; py--; }
    var pk = py+'-'+String(pm).padStart(2,'0');
    var prevM = allMonths.filter(function(o){return o.k===pk;})[0];
    if (prevM){ cmpA = prevM; cmpB = only; monthTx[pk] = state.tx.filter(function(t){ return t.date.getFullYear()===py && t.date.getMonth()===pm; }); }
  }
  if (cmpA){
    var A = cmpA, B = cmpB;
    $('dChgA').textContent = A.label; $('dChgB').textContent = B.label;
    $('dChgHint').textContent = 'Comparando '+A.name+' com '+B.name;
    var cs = {}; Object.keys(A.cat).concat(Object.keys(B.cat)).forEach(function(c){ cs[c]=1; });
    chg = Object.keys(cs).map(function(c){ var a = A.cat[c]||0, b = B.cat[c]||0; return {c:c, a:a, b:b, d:b-a, p: a ? (b-a)/a : null}; })
      .sort(function(x,y){ return Math.abs(y.d)-Math.abs(x.d); }).slice(0,6);
    $('dChg').innerHTML = chg.map(function(r){
      var up = r.d>0;
      var txt = r.p===null ? 'nova' : (up?'+':'')+pct.format(r.p);
      var ga = {}, gb = {};
      (monthTx[A.k]||[]).forEach(function(t){ if (t.value<0 && catOf(t)===r.c){ (ga[t.origin] = ga[t.origin] || {l:t.desc, v:0}).v -= t.value; } });
      (monthTx[B.k]||[]).forEach(function(t){ if (t.value<0 && catOf(t)===r.c){ (gb[t.origin] = gb[t.origin] || {l:t.desc, v:0}).v -= t.value; } });
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
  $('dProj').innerHTML =
    '<div class="kpi hoverable" data-tip="<b>Entradas esperadas</b>" data-more="'+projBase('ins','Entradas dos meses usados')+'"><span class="label">Entradas esperadas</span><span class="value num">'+brl.format(pIns)+'</span></div>'+
    '<div class="kpi hoverable" data-tip="<b>Saídas esperadas</b>" data-more="'+projBase('outs','Saídas dos meses usados')+'"><span class="label">Saídas esperadas</span><span class="value num">'+brl.format(pOut)+'</span></div>'+
    '<div class="kpi hoverable" data-tip="<b>Resultado esperado</b>" data-more="'+projBase('res','Resultado dos meses usados')+'"><span class="label">Resultado esperado</span><span class="value num">'+brl.format(pRes)+'</span><span class="pill '+(pRes>=0?'pos':'neg')+'">'+(pRes>=0?'Deve sobrar dinheiro':'Atenção: deve faltar dinheiro')+'</span></div>';

  /* conclusões */
  var L = [];
  L.push({w: margin<0.05, t:'De cada R$ 100 que entram, '+(margin>=0?'sobram ':'faltam ')+brl.format(Math.abs(margin*100))+'. '+(margin<0.05?'É uma margem apertada: qualquer imprevisto pode virar prejuízo.':'')});
  if (dailyIns>0 && !isWeek) { var dd2 = fixedM/dailyIns; L.push({w:false, t:'Os custos fixos ('+brl.format(fixedM)+' por mês) equivalem a cerca de '+Math.round(dd2)+' dias de entradas. Ou seja, o que entra nos primeiros '+Math.round(dd2)+' dias do mês serve só para pagar os custos fixos.'}); }
  if (!isWeek) L.push({w:true, t:'As saídas se concentram nos dias '+top3.map(function(i){return i+1;}).sort(function(a,b){return a-b;}).join(', ').replace(/, (\d+)$/,' e $1')+': juntos, somam em média '+brl.format(top3sum)+' por mês ('+pct.format(T.outs?top3sum/(T.outs/nM):0)+' das saídas). Deixe dinheiro reservado para essas datas.'});
  if (dowAvg[bestD]>0) L.push({w:false, t:DOW[bestD]+' é o dia em que mais entra dinheiro na conta (média de '+brl.format(dowAvg[bestD])+')'+(dowAvg[worstD]>0 ? ', e '+DOW[worstD].toLowerCase()+' é o mais fraco ('+brl.format(dowAvg[worstD])+').' : ', e '+DOW[worstD].toLowerCase()+' não tem entradas.')+' Lembre que repasses de cartão e aplicativos costumam cair dias depois da venda.'});
  if (nM>=2){
    var best = months.slice().sort(function(a,b){return b.res-a.res;})[0], worst = months.slice().sort(function(a,b){return a.res-b.res;})[0];
    L.push({w:false, t:'O melhor mês foi '+best.name+' (resultado de '+brl.format(best.res)+') e o mais fraco, '+worst.name+' ('+brl.format(worst.res)+').'});
  }
  var rise = chg.filter(function(r){return r.d>0 && r.p!==null && r.p>0.1;})[0];
  if (rise) L.push({w:true, t:'A categoria '+rise.c+' subiu '+pct.format(rise.p)+' em '+cmpB.name+' ('+brl.format(rise.d)+' a mais que em '+cmpA.name+'). Vale entender o motivo antes que vire o novo normal.'});
  if (T.ins && fees/T.ins>0.03) L.push({w:true, t:'Taxas de cartão, antecipação e aplicativos levam '+pct.format(fees/T.ins)+' de tudo o que entra ('+brl.format(fees/nM)+' por mês). Negociar a taxa da maquininha é dinheiro direto no resultado.'});
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
  var kpis = all('#dKpis .kpi').map(function(k){ return {l: txt(k.querySelector('.label')), v: txt(k.querySelector('.value'))}; });
  var ins = all('#dIns li').map(txt);
  var months = all('#pMonths .mchip').map(function(c){ return {l: txt(c.querySelector('.ml')), v: txt(c.querySelector('.mv'))}; });
  var cats = all('#cats li').map(txt);
  var now = new Date();
  var doc = makePdf();
  doc.line('Relatório de despesas', 18, true, 4);
  doc.line('Extrato: '+pdfText(file), 10);
  doc.line('Período: '+periodName(state.p)+(txt($('dSpan')) ? ' · '+txt($('dSpan')) : ''), 10);
  doc.line('Gerado em '+fmtDate(now)+' às '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'), 9, false, 6);
  doc.rule();
  doc.line('Indicadores', 13, true, 4);
  kpis.forEach(function(k){ doc.kv(k.l, k.v); });
  doc.gap(10);
  doc.line('Principais conclusões', 13, true, 4);
  ins.forEach(function(t){ doc.para('- '+t, 10, false, 92); doc.gap(3); });
  doc.gap(8);
  if (months.length){
    doc.line('Resultado por mês', 13, true, 4);
    months.forEach(function(m){ doc.kv(m.l, m.v); });
    doc.gap(10);
  }
  if (cats.length){
    doc.line('Despesas por categoria', 13, true, 4);
    cats.forEach(function(c){ doc.para(c, 10, false, 92); doc.gap(2); });
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
  state.loaded = false; state.savedId = null; state.raw = []; state.tx = []; state.overrides = {};
  refreshTabs(); setView(); renderSaved();
}
function refreshTabs(){
  document.querySelectorAll('a.dash-tab').forEach(function(a){
    var v = a.dataset.view;
    a.hidden = MODE==='vendas' ? !(v==='dashboard' && sales.length>0) : !(MODE==='despesas' && state.loaded);
  });
  var d = document.querySelector('a.tab[data-view="dashboard"]');
  if (d) d.textContent = MODE==='vendas' ? 'Análise de vendas' : 'Dashboard';
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
  var okHash = isV ? h==='dashboard' : (isD && (h==='dashboard'||h==='despesas'||h==='categorias'||h==='lancamentos'));
  var v = (ok && okHash) ? h : 'inicio';
  if (v==='inicio' && h && h!=='inicio'){ location.hash = 'inicio'; return; }
  $('viewEnviar').hidden = v!=='inicio';
  $('viewDash').hidden = !(v==='dashboard' && isD);
  $('viewVendas').hidden = !(v==='dashboard' && isV);
  $('viewDespesas').hidden = v!=='despesas';
  $('viewCategorias').hidden = v!=='categorias';
  $('viewLanc').hidden = v!=='lancamentos';
  $('introSec').hidden = v==='inicio' || isV;
  $('periodSec').hidden = !((v==='dashboard' && isD) || v==='despesas' || v==='lancamentos');
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
  $('upDesc').textContent = isV ? 'Envie a planilha de vendas. O painel mostra faturamento, produtos, horários e formas de pagamento.' : (isD ? 'Envie um extrato novo ou abra um que você já salvou. O painel separa suas despesas por categoria, por período e por origem.' : 'O que você quer analisar?');
  $('modoName').textContent = isV ? 'Vendas' : 'Despesas';
  $('ctNovo').textContent = isV ? 'Enviar nova planilha' : 'Enviar novo extrato';
  $('cdNovo').textContent = isV ? 'CSV com as colunas do modelo' : 'OFX ou CSV, um ou vários arquivos';
  $('ctSalvos').textContent = isV ? 'Planilhas salvas' : 'Extratos salvos';
  showPanel('novo');
  renderSaved();
  recarregarSalvos().catch(falhou);
  refreshTabs();
  setView();
}

function renderFlow(tx, mode){
  var titles = {year:'por ano', month:'por mês', week:'por semana', day:'por dia'};
  $('flowTitle').textContent = 'Entradas e saídas '+titles[mode];
  var groups = {}, order = [];
  function add(key, label){ if (!groups[key]){ groups[key]={label:label,inn:0,out:0}; order.push(key); } return groups[key]; }
  if (mode==='day'){
    var d0 = keyDate(state.p.w);
    var DIAS = ['seg','ter','qua','qui','sex','sáb','dom'];
    for (var i=0;i<7;i++){ var dd = new Date(d0); dd.setDate(dd.getDate()+i); add(weekKey(dd)+'-'+i, DIAS[i]+' '+shortDate(dd)); }
  }
  tx.forEach(function(t){
    var d = t.date, g;
    if (mode==='year') g = add(String(d.getFullYear()), String(d.getFullYear()));
    else if (mode==='month') g = add(d.getFullYear()+'-'+String(d.getMonth()).padStart(2,'0'), MESES[d.getMonth()].slice(0,3)+'/'+String(d.getFullYear()).slice(2));
    else if (mode==='week'){ var k = weekKey(d); g = add(k, 'sem. '+shortDate(keyDate(k))); }
    else g = add(weekKey(d)+'-'+((d.getDay()+6)%7), '');
    if (t.value>0) g.inn += t.value; else g.out -= t.value;
  });
  order.sort();
  var data = order.map(function(k){return groups[k];});
  var W=640,H=260,mL=82,mR=8,mT=12,mB=30, iw=W-mL-mR, ih=H-mT-mB;
  var lblStep = data.length>18 ? 3 : data.length>9 ? 2 : 1;
  var max = Math.max.apply(null, data.map(function(g){return Math.max(g.inn,g.out);}).concat([1]));
  var raw = max/4, mag = Math.pow(10,Math.floor(Math.log10(raw))), n = raw/mag;
  var step = (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*mag, top = Math.ceil(max/step)*step;
  var y = function(v){return mT + ih - v/top*ih;};
  var s = '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Gráfico de barras de entradas e saídas">';
  for (var v=0; v<=top+1e-6; v+=step){
    var yy = y(v).toFixed(1);
    s += '<line class="'+(v===0?'base':'gl')+'" x1="'+mL+'" x2="'+(W-mR)+'" y1="'+yy+'" y2="'+yy+'"></line>';
    s += '<text x="'+(mL-8)+'" y="'+yy+'" dy="0.32em" text-anchor="end">'+(v>=1000? 'R$ '+(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil' : 'R$ '+v)+'</text>';
  }
  var gw = iw/data.length, bw = Math.min(28, (gw*0.7-2)/2);
  data.forEach(function(g,i){
    var cx = mL + gw*i + gw/2;
    s += bar(cx-bw-1, g.inn, 'var(--s1)') + bar(cx+1, g.out, 'var(--s2)');
    if (i % lblStep === 0) s += '<text x="'+cx.toFixed(1)+'" y="'+(H-10)+'" text-anchor="middle">'+esc(g.label)+'</text>';
    var tip = '<b>'+esc(g.label)+'</b><br>Entradas: '+brl.format(g.inn)+'<br>Saídas: '+brl.format(g.out)+'<br>Saldo: '+brl.format(g.inn-g.out);
    s += '<rect class="hit" x="'+(mL+gw*i).toFixed(1)+'" y="'+mT+'" width="'+gw.toFixed(1)+'" height="'+ih+'" data-tip="'+esc(tip)+'"></rect>';
  });
  function bar(x, val, fill){
    if (val<=0) return '';
    var h = Math.max(1, val/top*ih), yb = mT+ih, yt = yb-h, r = Math.min(4,h,bw/2);
    return '<path fill="'+fill+'" d="M'+x.toFixed(1)+' '+yb+'V'+(yt+r).toFixed(1)+'Q'+x.toFixed(1)+' '+yt.toFixed(1)+' '+(x+r).toFixed(1)+' '+yt.toFixed(1)+
      'H'+(x+bw-r).toFixed(1)+'Q'+(x+bw).toFixed(1)+' '+yt.toFixed(1)+' '+(x+bw).toFixed(1)+' '+(yt+r).toFixed(1)+'V'+yb+'Z"></path>';
  }
  $('flow').innerHTML = s + '</svg>';
}

var ICON_INFO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7.5v.01"></path></svg>';
var ICON_WARN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"></path><path d="M12 10v4M12 17v.01"></path></svg>';
function renderInsights(ins, outs, res, cats, biggest, byCat, tx, prev){
  var L = [];
  if (prev && prev.ins && prev.outs){
    var di = (ins-prev.ins)/prev.ins, dout = (outs-prev.outs)/prev.outs;
    var worse = dout > di + 0.02;
    L.push({w:worse, t:'Em relação ao '+prev.label+', as entradas '+(di>=0?'subiram ':'caíram ')+pct.format(Math.abs(di))+' e as saídas '+(dout>=0?'subiram ':'caíram ')+pct.format(Math.abs(dout))+'.'+(worse?' Os gastos estão crescendo mais rápido que o faturamento.':'')});
  }
  if (res<0) L.push({w:true, t:'No período, as saídas superaram as entradas em '+brl.format(-res)+'. Vale olhar primeiro as maiores categorias abaixo.'});
  else L.push({w:false, t:'Sobraram '+brl.format(res)+' no período, ou '+pct.format(ins?res/ins:0)+' de tudo o que entrou.'});
  var top = cats.filter(function(c){return c.name!==OTHER;})[0];
  if (top) L.push({w:false, t:'A maior despesa é '+top.name.toLowerCase()+': '+brl.format(top.v)+', o que representa '+pct.format(top.v/outs)+' de todas as saídas.'});
  var fees = byCat[feesName()];
  if (fees && ins) L.push({w: fees/ins>0.05, t:'Taxas de cartão, antecipação e aplicativos levaram '+brl.format(fees)+', o equivalente a '+pct.format(fees/ins)+' do que entrou. Compare as taxas da sua maquininha e evite antecipar recebíveis quando puder.'});
  var oth = byCat[OTHER];
  if (oth){
    var n = tx.filter(function(t){return t.value<0 && catOf(t)===OTHER;}).length;
    L.push({w:true, t:n+(n===1?' despesa ficou':' despesas ficaram')+' sem categoria ('+brl.format(oth)+'). Classifique na página Categorias para o painel ficar mais preciso.'});
  }
  if (biggest) L.push({w:false, t:'O maior pagamento individual foi "'+biggest.desc+'", de '+brl.format(-biggest.value)+', em '+fmtDate(biggest.date)+'.'});
  $('insights').innerHTML = L.map(function(i){ return '<li class="'+(i.w?'warn':'')+'">'+(i.w?ICON_WARN:ICON_INFO)+'<p>'+esc(i.t)+'</p></li>'; }).join('');
}

function renderTable(){
  var q = norm(state.q).trim();
  var fc = state.fcat || 'all';
  var opts = '<option value="all">Todas</option><option value="__in">Entradas</option>'+allCats().map(function(c){return '<option'+(c===fc?' selected':'')+'>'+esc(c)+'</option>';}).join('');
  $('fCat').innerHTML = opts; $('fCat').value = fc;
  var list = cur().filter(function(t){
    if (fc==='__in' && t.value<0) return false;
    if (fc!=='all' && fc!=='__in' && (t.value>0 || catOf(t)!==fc)) return false;
    if (state.filter==='out' && t.value>0) return false;
    if (state.filter==='in' && t.value<0) return false;
    return !q || norm(t.desc).indexOf(q)!==-1;
  });
  var LIMIT = 300, shown = list.slice(0,LIMIT);
  $('rows').innerHTML = shown.map(function(t){
    var c = t.value>0 ? null : catOf(t);
    var catCell = t.value>0 ? '<span class="in">Entrada</span>' :
      '<span class="why'+(c===OTHER?' none':'')+'">'+esc(c)+'</span>';
    return '<tr><td class="num">'+fmtDate(t.date)+'</td><td>'+esc(t.desc)+'</td><td>'+catCell+'</td><td class="r num">'+brl.format(t.value)+'</td></tr>';
  }).join('') || '<tr><td colspan="4">Nenhum lançamento encontrado.</td></tr>';
  var tot = list.reduce(function(s,t){return s+t.value;},0);
  $('foot').textContent = (list.length>LIMIT ? 'Mostrando os primeiros '+LIMIT+' de '+list.length+' lançamentos. Use a busca para encontrar outros.' : list.length+(list.length===1?' lançamento':' lançamentos'))+' · soma: '+brl.format(tot)+' · '+periodName(state.p)+'.';
}

/* ---------- events ---------- */
$('file').addEventListener('change', function(e){ readFiles(e.target.files); e.target.value=''; });
var drop = $('drop');
['dragenter','dragover'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add('over'); }); });
['dragleave','drop'].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove('over'); }); });
drop.addEventListener('drop', function(e){ if (e.dataTransfer && e.dataTransfer.files.length) readFiles(e.dataTransfer.files); });
document.querySelectorAll('.table-tools .seg button').forEach(function(b){
  b.addEventListener('click', function(){
    state.filter = b.dataset.f;
    document.querySelectorAll('.table-tools .seg button').forEach(function(x){ x.setAttribute('aria-pressed', x===b ? 'true':'false'); });
    renderTable();
  });
});
$('q').addEventListener('input', function(e){ state.q = e.target.value; renderTable(); });
$('fCat').addEventListener('change', function(e){
  state.fcat = e.target.value;
  if (state.fcat==='__in'){ state.filter='all'; }
  else if (state.fcat!=='all'){ state.filter='out'; }
  document.querySelectorAll('.table-tools .seg button').forEach(function(x){ x.setAttribute('aria-pressed', x.dataset.f===state.filter ? 'true':'false'); });
  renderTable();
});
$('cats').addEventListener('click', function(e){
  var b = e.target.closest('[data-cat]'); if (!b) return;
  state.cat = b.dataset.cat; renderCategorias(); tip.hidden = true;
  keepScroll(function(){ location.hash = 'categorias'; setView(); });
});
$('catList').addEventListener('click', function(e){
  var b = e.target.closest('[data-cat]'); if (!b) return;
  keepScroll(function(){ state.cat = b.dataset.cat; renderCategorias(); });
});
var askState = null;
var KIND_LABEL = {'criar-pagina':'criar página', 'renomear-pagina':'renomear página', 'excluir-pagina':'excluir página', 'mover-extrato':'mover extrato de página', 'renomear-extrato':'renomear extrato', reclass:'mudar a categoria de lançamentos', criar:'criar categoria', editar:'editar categoria', 'excluir-categoria':'excluir categoria', restaurar:'restaurar categoria padrão', 'excluir-regra':'excluir regra', 'excluir-extrato':'excluir extrato salvo', 'excluir-vendas':'remover vendas da planilha', 'apagar-dados':'apagar todos os seus dados'};
function savePrefs(){ API.salvarPreferencia('confirmacoes', state.askPrefs).catch(falhou); }
var toastTimer = null;
function toast(t){ var el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function(){ el.hidden = true; }, 6000); }
function renderPrefNotes(){
  var keys = Object.keys(state.askPrefs || {});
  document.querySelectorAll('.pref-note-slot').forEach(function(pn){
    if (!keys.length){ pn.hidden = true; pn.innerHTML = ''; return; }
    pn.hidden = false;
    var list = keys.map(function(k){ return KIND_LABEL[k] || k; }).join(', ');
    var rc = state.askPrefs.reclass ? ' Mudanças de categoria estão sendo aplicadas como <b>'+(state.askPrefs.reclass==='yes' ? 'regra para os próximos extratos' : 'só neste extrato')+'</b>.' : '';
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
  if (pref==='yes' || (pref==='no' && o.onNo)){
    if (pref==='yes') o.onYes(); else o.onNo();
    toast('Feito sem confirmação, como você escolheu. Para voltar a confirmar, use Configurações, no topo da página.');
    return;
  }
  $('askT').textContent = o.title; $('askD').textContent = o.text;
  $('askYes').textContent = o.yes; $('askYes').className = 'btn '+(o.danger ? 'danger-solid' : 'primary');
  $('askNo').hidden = !o.no; if (o.no) $('askNo').textContent = o.no;
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
  if ((choice==='yes' || choice==='no') && $('askSkip').checked){ state.askPrefs[a.o.kind] = choice; savePrefs(); renderPrefNotes(); }
  if (choice==='yes') a.o.onYes(); else if (choice==='no') a.o.onNo(); else if (a.o.onCancel) a.o.onCancel();
  if (a.back && a.back.focus && document.body.contains(a.back)) a.back.focus({preventScroll:true});
}
$('askYes').addEventListener('click', function(){ closeAsk('yes'); });
$('askNo').addEventListener('click', function(){ closeAsk('no'); });
$('askCancel').addEventListener('click', function(){ closeAsk('cancel'); });
$('askSkip').addEventListener('change', function(e){ $('askSkipHelp').hidden = !e.target.checked; });
$('askBg').addEventListener('click', function(e){ if (e.target===$('askBg')) closeAsk('cancel'); });
document.addEventListener('keydown', function(e){
  if (!askState) return;
  if (e.key==='Escape'){ e.preventDefault(); closeAsk('cancel'); return; }
  if (e.key==='Tab'){
    var f = [$('askYes'), $('askNo'), $('askCancel'), $('askSkip')].filter(function(x){ return !x.hidden; });
    var i = f.indexOf(document.activeElement);
    e.preventDefault(); f[(i + (e.shiftKey ? f.length-1 : 1) + f.length) % f.length].focus();
  }
});
var RECLASS_HELP = 'As próximas mudanças de categoria vão usar esta mesma resposta automaticamente, sem confirmação. Isso pode criar regras sem você perceber.';
$('cdRows').addEventListener('change', function(e){
  var s = e.target.closest('select'); if (!s) return;
  var t = state.tx[+s.dataset.id], to = s.value;
  askX({ kind:'reclass', title:'Manter esta mudança nos próximos extratos?',
    text:'Você mudou "'+t.desc+'" para '+to+'. Se manter, sempre que essa origem aparecer em um extrato novo ela já vem como '+to+'.',
    yes:'Sim, manter nos próximos extratos', no:'Não, só neste extrato', cancel:'Cancelar mudança', skipHelp:RECLASS_HELP, back:s,
    onYes:function(){ setRule(t.origin, t.desc, to).then(render, function(e){ falhou(e); render(); }); },
    onNo:function(){ state.overrides[t.id] = to; ruleMsg('"'+t.desc+'" mudou para '+to+' só neste extrato.'); render(); },
    onCancel:render });
});
$('origins').addEventListener('change', function(e){
  var s = e.target.closest('select'); if (!s) return;
  var key = s.dataset.origin, from = state.cat, to = s.value;
  var sample = state.tx.filter(function(t){return t.origin===key;})[0], label = sample ? sample.desc : key;
  askX({ kind:'reclass', title:'Manter esta mudança nos próximos extratos?',
    text:'Você moveu todos os pagamentos de "'+label+'" para '+to+'. Se manter, os próximos extratos também vão classificar essa origem como '+to+'.',
    yes:'Sim, manter nos próximos extratos', no:'Não, só neste extrato', cancel:'Cancelar mudança', skipHelp:RECLASS_HELP, back:s,
    onYes:function(){ setRule(key, label, to).then(render, function(e){ falhou(e); render(); }); },
    onNo:function(){
      state.tx.forEach(function(t){ if (t.value<0 && t.origin===key && catOf(t)===from) state.overrides[t.id] = to; });
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
    var n = state.tx.filter(function(t){ return t.value<0 && catOf(t)===name; }).length;
    $('ncName').value = ''; $('ncKw').value = ''; $('ncTypeVar').checked = true; $('ncPreview').textContent = '';
    ruleMsg('Categoria "'+name+'" criada.'+(kws.length ? ' '+n+(n===1?' lançamento foi classificado':' lançamentos foram classificados')+' nela pelas palavras-chave.' : ' Use "Mover para" ou a tabela de lançamentos para colocar despesas nela.'));
    render();
    showNc('list');
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
  var type = $('ecFix').checked ? 'fixo' : 'variavel';
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
    var prev = state.bEdits[bKey(d.idx)] || {};
    var kwsChanged = kwTxt.trim() !== d.kws.join(', ');
    var ed = { name:name, type:type, kws: kwsChanged ? parseKws(kwTxt) : (prev.kws || null) };
    pedido = API.editarPadrao(curPerfil(), d.idx, { nome:ed.name, tipo:ed.type, palavras:ed.kws })
      .then(function(){ state.bEdits[bKey(d.idx)] = ed; });
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
    var cur = bd.name, def = curRules()[bd.idx][0];
    if (norm(cur)!==norm(def) && allCats().some(function(c){ return c!==cur && norm(c)===norm(def); })){ ruleMsg('Não dá para restaurar: já existe outra categoria chamada "'+def+'".'); return; }
    askX({ kind:'restaurar', title:'Restaurar "'+cur+'" ao padrão?', text:'O nome volta a ser "'+def+'", e o tipo de custo e as palavras-chave voltam aos originais do sistema.',
      yes:'Restaurar padrão', back:rs, onYes:function(){
        API.restaurarPadrao(curPerfil(), bd.idx).then(function(){
          delete state.bEdits[bKey(bd.idx)];
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
  var nL = state.tx.filter(function(t){ return t.value<0 && catOf(t)===name; }).length;
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
$('pY').addEventListener('change', function(e){ state.p = {y:e.target.value, m:'all', w:'all'}; render(); });
$('pM').addEventListener('change', function(e){ state.p = {y:state.p.y, m:e.target.value, w:'all'}; render(); });
$('pW').addEventListener('change', function(e){ state.p.w = e.target.value; render(); });
$('pClear').addEventListener('click', function(){ state.p = {y:'all', m:'all', w:'all'}; render(); });
$('rPeriod').addEventListener('change', function(){ resRange = this.value; renderDashboard(); });
/* ---------- configurações do site ---------- */
var cfg = {};
function saveCfg(){ API.salvarPreferencia('config', cfg).catch(falhou); }
function applyCfg(){
  document.documentElement.classList.toggle('texto-grande', !!cfg.textoGrande);
  document.documentElement.classList.toggle('sem-esteira', cfg.esteira===false);
}
function openCfg(){
  document.querySelectorAll('input[name="cfgPerfil"]').forEach(function(r){ r.checked = r.value===validPerfil(cfg.perfil); });
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
document.querySelectorAll('input[name="cfgPerfil"]').forEach(function(r){ r.addEventListener('change', function(){ cfg.perfil = this.value; saveCfg(); applyCfg(); }); });
$('cfgTexto').addEventListener('change', function(){ cfg.textoGrande = this.checked; saveCfg(); applyCfg(); });
$('cfgEsteira').addEventListener('change', function(){ cfg.esteira = this.checked; saveCfg(); applyCfg(); });
$('cfgClear').addEventListener('click', function(){
  closeCfg();
  askX({ kind:'apagar-dados', danger:true, title:'Apagar todos os seus dados?', text:'Extratos salvos, páginas, categorias, regras e configurações serão apagados da sua conta. O seu login continua existindo. Isso não pode ser desfeito.', yes:'Apagar tudo', cancel:'Cancelar', back:$('cfgBtn'),
    onYes:function(){ API.apagarTudo().then(function(){ location.reload(); }).catch(falhou); } });
});
/* ---------- mesclar extratos salvos ---------- */
var MERGE_ON = false, MERGE_SEL = [];
function perfilOf(x){ return validPerfil(x.perfil==='cafe' ? 'empresa' : x.perfil); }
function perfilLabel(p){ return PROFILES[p] ? PROFILES[p].label : p; }
function updateMergeBar(){
  var n = MERGE_SEL.length;
  var all = getSaved().filter(function(x){ return MERGE_SEL.indexOf(x.id)!==-1; });
  var perfis = all.map(function(x){ return perfilOf(x); });
  var uniq = perfis.filter(function(p,i){ return perfis.indexOf(p)===i; });
  var mixed = uniq.length>1;
  var txt = n ? n+(n===1?' extrato marcado':' extratos marcados')+(n<2?' (marque mais um)':'') : 'Marque os extratos que quer mesclar (mínimo 2).';
  if (mixed) txt = 'Só é possível mesclar extratos do mesmo perfil. Desmarque os de '+uniq.slice(1).map(perfilLabel).join(' ou ')+'.';
  $('mergeCount').textContent = txt;
  $('mergeGo').disabled = n<2 || mixed;
}
function setMerge(on){
  MERGE_ON = on; if (!on) MERGE_SEL = [];
  $('mergeBar').hidden = !on; $('mergeBtn').hidden = on;
  renderSaved(); updateMergeBar();
}
$('mergeBtn').addEventListener('click', function(){ setMerge(true); });
$('mergeCancel').addEventListener('click', function(){ setMerge(false); });
$('mergeGo').addEventListener('click', openMerge);
$('savedList').addEventListener('change', function(e){
  var c = e.target.closest && e.target.closest('.mg-check'); if (!c) return;
  var id = c.dataset.mg;
  MERGE_SEL = c.checked ? MERGE_SEL.concat([id]) : MERGE_SEL.filter(function(x){ return x!==id; });
  updateMergeBar();
});
function openMerge(){
  var sel = getSaved().filter(function(x){ return MERGE_SEL.indexOf(x.id)!==-1; });
  $('mgList').innerHTML = sel.map(function(x){ return '<li>'+esc(x.name||'Extrato')+' · '+esc(perfilLabel(perfilOf(x)))+'</li>'; }).join('');
  $('mgErr').hidden = true;
  document.querySelector('input[name="mgDel"][value="nao"]').checked = true;
  $('mgName').value = 'Mesclado: '+sel.map(function(x){ return x.name||'Extrato'; }).join(' + ');
  $('mgName').classList.add('is-suggest');
  $('mergeBg').style.display = 'flex';
  mgRefresh();
}
function mgRefresh(){
  var sel = getSaved().filter(function(x){ return MERGE_SEL.indexOf(x.id)!==-1; });
  var perfis = sel.map(function(x){ return perfilOf(x); });
  var uniq = perfis.filter(function(p,i){ return perfis.indexOf(p)===i; });
  var mixed = uniq.length>1;
  $('mgWarn').hidden = !mixed;
  $('mgWarnText').textContent = mixed ? 'Não é possível mesclar extratos de perfis diferentes ('+uniq.map(perfilLabel).join(' e ')+'). Desmarque os extratos de um dos perfis para continuar.' : '';
  $('mgGo').disabled = !(sel.length>=2 && !mixed);
}
$('mgName').addEventListener('input', function(){ this.classList.remove('is-suggest'); });
$('mgClose').addEventListener('click', function(){ $('mergeBg').style.display = 'none'; });
$('mergeBg').addEventListener('click', function(e){ if (e.target===$('mergeBg')) $('mergeBg').style.display = 'none'; });
$('mgGo').addEventListener('click', function(){
  if ($('mgGo').disabled) return;
  var sel = getSaved().filter(function(x){ return MERGE_SEL.indexOf(x.id)!==-1; });
  var nomes = $('mgName').value.trim() || ('Mesclado: '+sel.map(function(x){ return x.name||'Extrato'; }).join(' + '));
  var excluir = document.querySelector('input[name="mgDel"]:checked').value==='sim';
  $('mgGo').disabled = true;
  API.mesclar(sel.map(function(x){ return x.id; }), nomes.slice(0,120), excluir).then(function(meta){
    $('mergeBg').style.display = 'none';
    setMerge(false);
    toast('Extratos mesclados: '+meta.quantidade+' lançamentos'+(meta.repetidos ? ' ('+meta.repetidos+' repetidos foram ignorados)' : '')+'.');
    return recarregarSalvos().then(function(){ openSaved(meta.id); });
  }).catch(function(e){ $('mgErr').textContent = e.message; $('mgErr').hidden = false; $('mgGo').disabled = false; });
});
$('pMonths').addEventListener('click', function(e){
  var b = e.target.closest('.mchip'); if (!b) return;
  var on = b.getAttribute('aria-pressed')==='true';
  state.p = on ? {y:b.dataset.y, m:'all', w:'all'} : {y:b.dataset.y, m:b.dataset.m, w:'all'};
  render();
});
document.querySelectorAll('.choice[data-panel]').forEach(function(b){ b.addEventListener('click', function(){ keepScroll(function(){ showPanel(b.dataset.panel); }); }); });
$('pagesBar').addEventListener('click', function(e){
  var b = e.target.closest('[data-page]'); if (!b) return;
  keepScroll(function(){ state.page = b.dataset.page==='all' ? null : b.dataset.page; state.editingPage = null; renderSaved(); });
});
$('newPageBtn').addEventListener('click', function(){ $('newPageForm').hidden = false; $('newPageErr').hidden = true; $('newPageName').value = ''; $('newPageName').focus(); });
$('newPageCancel').addEventListener('click', function(){ $('newPageForm').hidden = true; });
$('newPageForm').addEventListener('submit', function(e){
  e.preventDefault();
  var name = $('newPageName').value.replace(/\s+/g,' ').trim(), err = $('newPageErr');
  if (!name){ err.textContent = 'Dê um nome para a página.'; err.hidden = false; $('newPageName').focus(); return; }
  if (pageNameTaken(name)){ err.textContent = 'Já existe uma página chamada "'+name+'".'; err.hidden = false; $('newPageName').focus(); return; }
  err.hidden = true;
  askX({ kind:'criar-pagina', title:'Criar a página "'+name+'"?', text:'Depois é só usar "Mover para" em cada extrato para colocá-lo nesta página.', yes:'Criar página', cancel:'Voltar', onYes:function(){
    API.criarPagina(name, kindNow()).then(function(pg){
      $('newPageForm').hidden = true; state.page = pg.id;
      return recarregarSalvos().then(function(){ toast('Página "'+name+'" criada.'); });
    }).catch(falhou);
  } });
});
$('pageHead').addEventListener('click', function(e){
  var pid = state.page, pg = getPages().filter(function(p){ return p.id===pid; })[0]; if (!pg) return;
  if (e.target.closest('[data-pren]')){ state.editingPage = pid; renderSaved(); var i = $('renPageName'); if (i){ i.focus(); i.select(); } return; }
  if (e.target.closest('[data-pcancel]')){ state.editingPage = null; renderSaved(); return; }
  var del = e.target.closest('[data-pdel]');
  if (del){
    var n = getSaved().filter(function(x){ return x.page===pid; }).length;
    askX({ kind:'excluir-pagina', danger:true, title:'Excluir a página "'+pg.name+'"?', text:(n ? 'Os '+n+' extratos dela não serão apagados: eles passam para "Sem página". ' : 'A página está vazia. ')+'Isso não pode ser desfeito.', yes:'Excluir página', back:del, onYes:function(){
      API.excluirPagina(pid).then(function(){
        state.page = null;
        return recarregarSalvos().then(function(){ toast('Página "'+pg.name+'" excluída.'); });
      }).catch(falhou);
    } });
  }
});
$('pageHead').addEventListener('submit', function(e){
  e.preventDefault();
  var pid = state.page, pg = getPages().filter(function(p){ return p.id===pid; })[0]; if (!pg) return;
  var name = $('renPageName').value.replace(/\s+/g,' ').trim(), err = $('renPageErr');
  if (!name){ err.textContent = 'Dê um nome para a página.'; err.hidden = false; return; }
  if (name===pg.name){ state.editingPage = null; renderSaved(); return; }
  if (pageNameTaken(name, pid)){ err.textContent = 'Já existe uma página chamada "'+name+'".'; err.hidden = false; return; }
  askX({ kind:'renomear-pagina', title:'Renomear a página?', text:'"'+pg.name+'" passa a se chamar "'+name+'".', yes:'Salvar nome', cancel:'Continuar editando', onYes:function(){
    API.renomearPagina(pid, name).then(function(){
      state.editingPage = null;
      return recarregarSalvos().then(function(){ toast('Página renomeada para "'+name+'".'); });
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
    var dest = to ? pageName(to) : 'Sem página';
    askX({ kind:'mover-extrato', title:'Mover o extrato?', text:'"'+(mx.name||'Extrato')+'" vai para '+(to ? 'a página "'+dest+'"' : '"Sem página"')+'.', yes:'Mover extrato', cancel:'Voltar',
      onYes:function(){
        API.alterarExtrato(id, {pagina_id: to}).then(function(){
          state.movingSaved = null;
          return recarregarSalvos().then(function(){ toast('Extrato movido para '+(to ? '"'+dest+'"' : '"Sem página"')+'.'); });
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
      API.excluirExtrato(id).then(function(){
        if (state.savedId===id){ if (MODE==='vendas'){ state.savedId = null; sales = []; salesFile = ''; renderSales(); refreshTabs(); } else fecharExtrato(); }
        return recarregarSalvos().then(function(){ toast('Extrato excluído.'); });
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
window.addEventListener('hashchange', function(){ keepScroll(setView); });
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

/* ---------- inicialização: busca tudo no servidor ---------- */
state.rules = {}; state.askPrefs = {}; state.custom = []; state.bEdits = {};
API.estado().then(function(e){
  Object.keys(e.perfis).forEach(function(k){
    var p = e.perfis[k];
    PROFILES[k] = { label:p.rotulo, rules:p.regras, fixed:p.fixas };
  });
  OTHER = e.outros || OTHER;
  state.custom = e.categorias.map(categoriaLocal);
  Object.keys(e.edicoes).forEach(function(k){ var x = e.edicoes[k]; state.bEdits[k] = { name:x.nome, type:x.tipo, kws:x.palavras }; });
  Object.keys(e.regras).forEach(function(k){ var r = e.regras[k]; state.rules[k] = { cat:r.categoria, label:r.rotulo, at:r.criada_em }; });
  state.askPrefs = e.preferencias.confirmacoes || {};
  cfg = e.preferencias.config || {};
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
