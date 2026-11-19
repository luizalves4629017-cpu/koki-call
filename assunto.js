(function(){
var UI=window.UI;if(!UI)return;
var D=window.GAME_DATA,PG=D.programa||{};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var nl=function(s){return esc(s).replace(/\n/g,'<br>')};
var LS='uece-quiz-progresso';
function P(){try{return JSON.parse(localStorage.getItem(LS))||{}}catch(e){return{}}}
var EXK='agatha-exercicios',ST={};try{ST=JSON.parse(localStorage.getItem(EXK))||{}}catch(e){}
function stSave(){try{localStorage.setItem(EXK,JSON.stringify(ST))}catch(e){}}
function W(id){return(D.worlds||[]).find(function(w){return w.id===id})}
function exOf(id,i){var c=cont(id,i);if(c&&c.exercicios&&c.exercicios.length)return c.exercicios;var w=W(id),ex=[];(w&&w.fases||[]).forEach(function(f){ex=ex.concat((f.questions||[]).map(function(q){return{q:q.q,a:q.a,c:q.c,res:q.exp}}))});return ex.slice(0,8)}
function cont(id,i){var c=(window.CONT||{})[id];return c&&c[i]?c[i]:null}
var yt=function(q){return'https://www.youtube.com/results?search_query='+encodeURIComponent(q)};
var gg=function(q){return'https://www.google.com/search?q='+encodeURIComponent(q)};
var LET='ABCDE';
UI.assunto=function(id,i,tab){tab=tab||0;var w=W(id),t=(PG[id]||[])[i]||'',c=cont(id,i);
  var key=id+':'+i,pp=window.UI._P?window.UI._P():null,on=pp?!!pp.t[key]:false;
  var tabs=['📖 Aula','📝 Exercícios','🎥 Vídeos','📄 Provas'];
  var h='<button class="x-b x-back" onclick="UI.subj(\''+id+'\')">← '+esc(w?w.nome:'Voltar')+'</button>'
   +'<h2 style="margin-top:10px">'+esc(t)+'</h2>'
   +'<button class="x-b x-as-ok'+(on?' on':'')+'" onclick="UI.asTick(\''+id+'\','+i+',this)">'+(on?'✓ Estudado':'Marcar como estudado')+'</button>'
   +'<div class="x-tabs x-as-tabs" role="tablist">'+tabs.map(function(n,k){return'<button role="tab" class="x-tab" aria-selected="'+(k===tab)+'" onclick="UI.assunto(\''+id+'\','+i+','+k+')">'+n+'</button>'}).join('')+'</div>';
  var busca=(c&&c.busca)||('aula '+t+' '+(w?w.nome:'')+' ENEM');
  if(tab===0){
    if(c){h+='<div class="x-card x-as-aula">'+c.aula.map(function(p){return'<p>'+nl(p)+'</p>'}).join('')+'</div>'
      +'<h3>📌 Resumo pra revisar</h3><ul class="x-card x-as-res">'+c.resumo.map(function(p){return'<li>'+nl(p)+'</li>'}).join('')+'</ul>';
      if(c.exemplo)h+='<h3>✏️ Exemplo resolvido</h3><div class="x-card"><p><b>'+nl(c.exemplo.q)+'</b></p><details><summary>Ver resolução</summary><p>'+nl(c.exemplo.res)+'</p></details></div>';
    }else{var ls=[];(w&&w.fases||[]).forEach(function(f){ls=ls.concat(f.lessons||[])});
      h+='<div class="x-card x-as-aula">'+(ls.length?ls.map(function(p){return'<p>'+nl(p)+'</p>'}).join(''):'<p>Conteúdo em preparação. Use as videoaulas enquanto isso.</p>')+'</div>'}
    h+='<div class="x-row x-mt"><button class="x-b x-p" onclick="UI.assunto(\''+id+'\','+i+',1)">Fazer exercícios →</button><a class="x-b" href="'+yt(busca)+'" target="_blank" rel="noopener">🎥 Ver videoaula ↗</a></div>';
  }else if(tab===1){var ex=exOf(id,i);ST[key]=ST[key]||{};
    var ok=0,feito=0;Object.keys(ST[key]).forEach(function(k){feito++;if(ST[key][k]===ex[k].c)ok++});
    h+='<p class="x-mut">'+ex.length+' questões no estilo UECE/ENEM, com resolução. Toque na alternativa.</p>'
     +(feito?'<div class="x-card x-as-placar"><b>'+ok+' de '+feito+'</b> certas até agora'+(feito===ex.length?(ok===ex.length?' · gabaritou! 🌸':' · '+(ok/feito>=.6?'muito bem! 💗':'revise a aula e tente de novo 🌱')):'')+'</div>':'');
    ex.forEach(function(q,k){var r=ST[key][k];
      h+='<div class="x-card x-as-q"><p><b>'+(k+1)+'.</b> '+nl(q.q)+'</p><div class="x-as-alts">'
       +q.a.map(function(a,j){var cls='';if(r!=null){if(j===q.c)cls=' ok';else if(j===r)cls=' bad'}
         return'<button class="x-as-alt'+cls+'"'+(r!=null?' disabled':'')+' onclick="UI.asResp(\''+id+'\','+i+','+k+','+j+')"><span>'+LET[j]+'</span>'+esc(a)+'</button>'}).join('')+'</div>'
       +(r!=null?'<div class="x-as-exp '+(r===q.c?'ok':'bad')+'"><b>'+(r===q.c?'✅ Acertou!':'❌ Resposta certa: '+LET[q.c])+'</b><p>'+nl(q.res||'')+'</p></div>':'')+'</div>'});
    if(c && c.resumo && c.resumo.length){
      var tips=c.resumo.slice(),start=(new Date().getDate()+i)%tips.length;
      tips=tips.slice(start).concat(tips.slice(0,start)).slice(0,Math.min(5,tips.length));
      h+='<section class="ag-active-recall"><div class="ag-recall-head"><span>🌱 REVISÃO ATIVA</span><h3>Mais um jeito de fixar o conteúdo</h3><p>Antes de revelar, tente explicar a ideia com suas próprias palavras. São desafios extras, além das questões de múltipla escolha.</p></div>'
       +tips.map(function(t,k){return '<details class="ag-recall-card"><summary><b>Desafio '+(k+1)+'</b><span>Explique esta ideia sem consultar a aula</span></summary><p>'+nl(t)+'</p></details>'}).join('')
       +'</section>';
    }
    h+='<div class="x-row x-mt"><button class="x-b" onclick="UI.asReset(\''+id+'\','+i+')">↺ Refazer</button><button class="x-b" onclick="UI.assunto(\''+id+'\','+i+',0)">📖 Rever a aula</button></div>';
  }else if(tab===2){
    h+='<p class="x-mut">Abre no YouTube com a busca pronta. Dica: assista em 1,25x e pause para anotar.</p><div class="x-list">'
     +[['🎥 Videoaula do assunto',busca],['🎯 Revisão rápida',t+' resumo revisão'],['🧩 Exercícios resolvidos em vídeo',t+' exercícios resolvidos vestibular'],['🏫 Questões da UECE resolvidas',t+' questão UECE resolvida']]
       .map(function(x){return'<a class="x-sc" href="'+yt(x[1])+'" target="_blank" rel="noopener"><span class="x-sn">'+x[0]+' ↗</span><span class="x-mut">'+esc(x[1])+'</span></a>'}).join('')
     +'<a class="x-sc" href="https://pt.khanacademy.org/" target="_blank" rel="noopener"><span class="x-sn">📚 Khan Academy (grátis) ↗</span><span class="x-mut">Aulas e exercícios em português</span></a></div>';
  }else{
    h+='<p class="x-mut">Provas oficiais com gabarito. Na UECE, '+esc(w?w.nome:'esta matéria')+' cai na prova de Conhecimentos Gerais (1ª fase); a redação é na 2ª fase.</p><div class="x-list">'
     +'<a class="x-sc" href="'+gg('questões vestibular UECE "'+t+'" gabarito comentado')+'" target="_blank" rel="noopener"><span class="x-sn">🔎 Questões de provas sobre este assunto ↗</span><span class="x-mut">UECE e ENEM, com gabarito comentado</span></a>'
     +'<a class="x-sc" href="https://www.cev.uece.br/vestibular20261" target="_blank" rel="noopener"><span class="x-sn">🏫 Provas da UECE 2026.1 ↗</span><span class="x-mut">Site oficial da CEV/UECE</span></a>'
     +'<a class="x-sc" href="https://www.cev.uece.br/home/home/concursos-servicos/downloads/" target="_blank" rel="noopener"><span class="x-sn">🗂️ Provas antigas da UECE ↗</span><span class="x-mut">Vestibulares desde 2011, com gabaritos</span></a>'
     +'<a class="x-sc" href="https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos" target="_blank" rel="noopener"><span class="x-sn">📘 Provas do ENEM (INEP) ↗</span><span class="x-mut">De 1998 a 2025, com gabaritos</span></a></div>'
     +'<div class="x-row x-mt"><button class="x-b x-p" onclick="UI.sim()">📝 Fazer um simulado no app</button></div>';
  }
  window.UI._show(h,'home');try{window.scrollTo(0,0)}catch(e){}
};
UI.asResp=function(id,i,k,j){var key=id+':'+i;ST[key]=ST[key]||{};if(ST[key][k]!=null)return;ST[key][k]=j;stSave();
  var q=exOf(id,i)[k];if(window.UI._score&&q)window.UI._score(j===q.c);
  var y=window.scrollY;UI.assunto(id,i,1);window.scrollTo(0,y)};
UI.asReset=function(id,i){ST[id+':'+i]={};stSave();UI.assunto(id,i,1)};
UI.asTick=function(id,i,el){if(!window.UI._tickKey)return;var on=window.UI._tickKey(id+':'+i);el.classList.toggle('on',on);el.textContent=on?'✓ Estudado':'Marcar como estudado'};
})();

/* Revisão ativa complementar — respeita os cartões e tokens visuais existentes. */
(function(){
 var s=document.createElement('style');
 s.textContent='.ag-active-recall{margin:22px 0}.ag-recall-head{margin:0 0 10px}.ag-recall-head>span{font-size:10px;letter-spacing:.13em;font-weight:700;color:#9275aa}.ag-recall-head h3{margin:5px 0;font-size:17px}.ag-recall-head p{margin:0;color:var(--text-secondary,#777);font-size:13px;line-height:1.55}.ag-recall-card{margin:8px 0;border:1px solid var(--stroke-primary,#ddd);border-radius:14px;background:var(--mat-regular,#fff);padding:13px 15px}.ag-recall-card summary{cursor:pointer;list-style:none;display:grid;gap:4px}.ag-recall-card summary::-webkit-details-marker{display:none}.ag-recall-card summary b{font-size:13px}.ag-recall-card summary span{font-size:12px;color:var(--text-secondary,#777)}.ag-recall-card[open]{border-color:#cdb9df}.ag-recall-card p{font-size:13px;line-height:1.65;margin:12px 0 2px;color:var(--text-primary,#333)}';
 document.head.appendChild(s);
})();
(function(){var UI=window.UI;if(!UI)return;
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var MAP={red:'red',redenem:'redenem'};
function bloco(p,nome){if(!p)return'';var fr={'muito alta':'🔥🔥🔥','alta':'🔥🔥','média':'🔥'};
  return'<div class="x-mc-p"><h4>'+nome+'</h4>'+(p.estilo?'<p class="x-mut">'+esc(p.estilo)+'</p>':'')
  +((p.top||[]).length?'<ol class="x-mc-l">'+p.top.map(function(t){var f=String(t.f||'');var ic=fr[f.toLowerCase()]||(/%/.test(f)?'🔥🔥🔥':'🔥');
    return'<li><div><b>'+esc(t.a)+'</b> <span class="x-mc-f" title="'+esc(f)+'">'+ic+' '+esc(f)+'</span></div><span class="x-mut">'+esc(t.d||'')+'</span></li>'}).join('')+'</ol>':'')
  +(p.dica?'<p class="x-mc-d">💡 '+esc(p.dica)+'</p>':'')+'</div>'}
function html(id,open){var M=window.MC||{},m=M[id];if(!m)return'';
  return'<details class="x-card x-mc"'+(open?' open':'')+'><summary>🎯 O que mais cai: UECE e ENEM</summary>'+bloco(m.uece,'🏫 Na UECE')+bloco(m.enem,'📘 No ENEM')+'</details>'}
UI._mcHTML=html;
var os=UI.subj;UI.subj=function(id,tab){os.apply(this,arguments);var M=window.MC||{};if(!M[id])return;var a=document.getElementById('app'),t=a&&a.querySelector('.x-tabs');if(!t)return;
  t.insertAdjacentHTML('beforebegin',html(id,false))};
var om=UI.metodos;if(om)UI.metodos=function(){om.apply(this,arguments);var M=window.MC||{};var a=document.getElementById('app');if(!a||!Object.keys(M).length)return;
  var ws=(window.GAME_DATA.worlds||[]).filter(function(w){return M[w.id]});
  var s='<h2>🎯 O que mais cai em cada matéria</h2><p class="x-mut">Em ordem de importância, separado entre UECE e ENEM. Toque na matéria para abrir.</p>'
   +ws.map(function(w){return html(w.id,false).replace('🎯 O que mais cai: UECE e ENEM',(w.icone||'')+' '+esc(w.nome))}).join('')
   +((M.fontes||[]).length?'<p class="x-mut" style="font-size:12px">Fontes: '+M.fontes.map(function(f){return'<a href="'+esc(f.url)+'" target="_blank" rel="noopener">'+esc(f.nome)+'</a>'}).join(' · ')+'</p>':'');
  a.insertAdjacentHTML('afterbegin','<div style="height:0"></div>');var h2=a.querySelector('h2');
  if(h2&&h2.nextSibling){var d=document.createElement('div');d.innerHTML=s;a.appendChild(d)}else a.insertAdjacentHTML('beforeend',s)};
})();
