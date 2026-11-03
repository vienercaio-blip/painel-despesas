/* Aparência do site: automática (segue o aparelho), clara ou escura.
   A escolha fica nas preferências do cliente (cfg.tema) e, como atalho para
   não piscar a cor errada ao carregar, também no localStorage (CHAVE).
   Testes: node --test frontend/tests */
var Tema = (function(){
'use strict';

/* 'claro' → 'light', 'escuro' → 'dark'; automática (ou qualquer outro valor) → null,
   que deixa o CSS seguir o aparelho (prefers-color-scheme) */
function atributo(escolha){
  if (escolha==='claro') return 'light';
  if (escolha==='escuro') return 'dark';
  return null;
}

return { atributo:atributo, CHAVE:'sobrou-tema' };
})();
if (typeof window!=='undefined') window.Tema = Tema;
if (typeof module!=='undefined') module.exports = Tema;
