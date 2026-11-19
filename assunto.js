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
function resolutionBlocks(text){
  var value=String(text||'');
  var matches=value.match(/(?:Passo\s+\\d+|Etapa\s+\\d+)\s*:/gi);
  if(!matches || !matches.length) return '<p>'+nl(value)+'</p>';
  var parts=value.split(/(?=(?:Passo\s+\\d+|Etapa\s+\\d+)\s*:)/i).filter(Boolean);
  return '<ol class="ag-solution-steps">'+parts.map(function(part){var m=part.match(/^((?:Passo|Etapa)\s+\\d+)\s*:\s*/i);return '<li><b>'+esc(m?m[1]:'Explicação')+'</b><p>'+nl(m?part.slice(m[0].length):part)+'</p></li>'}).join('')+'</ol>';
}
function lessonBlock(text,index){
  return '<article class="ag-lesson-paragraph"><span class="ag-lesson-number">'+String(index+1).padStart(2,'0')+'</span><div>'+nl(text)+'</div></article>';
}
UI.assunto=function(id,i,tab){tab=tab||0;var w=W(id),t=(PG[id]||[])[i]||'',c=cont(id,i);
  var key=id+':'+i,pp=window.UI._P?window.UI._P():null,on=pp?!!pp.t[key]:false;
  var tabs=['📖 Aula','📝 Exercícios','🎥 Vídeos','📄 Provas'];
  var h='<button class="x-b x-back" onclick="UI.subj(\''+id+'\')">← '+esc(w?w.nome:'Voltar')+'</button>'
   +'<h2 style="margin-top:10px">'+esc(t)+'</h2>'
   +'<button class="x-b x-as-ok'+(on?' on':'')+'" onclick="UI.asTick(\''+id+'\','+i+',this)">'+(on?'✓ Estudado':'Marcar como estudado')+'</button>'
   +'<div class="x-tabs x-as-tabs" role="tablist">'+tabs.map(function(n,k){return'<button role="tab" class="x-tab" aria-selected="'+(k===tab)+'" onclick="UI.assunto(\''+id+'\','+i+','+k+')">'+n+'</button>'}).join('')+'</div>';
  var busca=(c&&c.busca)||('aula '+t+' '+(w?w.nome:'')+' ENEM');
  if(tab===0){
    if(c && /conjuntos/i.test(t) && /matem/i.test(w?w.nome:'')){h+='<section class="ag-deep-lesson"><div class="ag-kicker">MATEMÁTICA • DO ZERO</div><h3>Conjuntos: entenda antes de decorar</h3><p>Imagine duas listas de convidados: a lista A tem Ana, Bia e Caio; a lista B tem Bia, Caio e Davi. Um <b>conjunto</b> é apenas uma coleção de elementos. Usamos chaves para mostrar quem faz parte dela.</p><div class="ag-visual"><div class="ag-venn"><div class="ag-circle ag-a">A</div><div class="ag-circle ag-b">B</div><span class="ag-only-a">Ana</span><span class="ag-both">Bia<br>Caio</span><span class="ag-only-b">Davi</span></div><small>Diagrama ilustrativo: a região do meio contém quem aparece nas duas listas.</small></div><h4>1. Interseção (∩): quem está nas duas listas?</h4><p>Bia e Caio aparecem em A <b>e</b> em B. Logo, A ∩ B = {Bia, Caio}. A palavra-chave é <b>e</b>: só entram os elementos em comum.</p><h4>2. União (∪): quem está em pelo menos uma lista?</h4><p>Reunimos todos, sem repetir ninguém: A ∪ B = {Ana, Bia, Caio, Davi}. A palavra-chave é <b>ou</b>: basta pertencer a uma das listas.</p><h4>3. Diferença (−): quem está só em A?</h4><p>A − B = {Ana}, porque Ana está em A, mas não em B. Atenção: A − B pode ser diferente de B − A.</p><div class="ag-worked"><b>📝 Questão resolvida, passo a passo</b><p>Em uma turma de 100 alunos, 60 gostam de futebol, 50 gostam de vôlei e 20 gostam dos dois. Quantos não gostam de nenhum?</p><ol><li><b>Passo 1:</b> some os grupos: 60 + 50 = 110.</li><li><b>Passo 2:</b> os 20 que gostam dos dois foram contados duas vezes. Retire uma contagem: 110 − 20 = 90.</li><li><b>Passo 3:</b> 90 gostam de pelo menos um esporte. Então 100 − 90 = <b>10 alunos</b> não gostam de nenhum.</li></ol><p><b>Resposta: 10.</b> Fórmula: n(A ∪ B) = n(A) + n(B) − n(A ∩ B).</p></div><details class="ag-check"><summary>💡 Confira se entendeu: se A = {1, 2, 3} e B = {3, 4}, qual é A ∩ B?</summary><p>A interseção é <b>{3}</b>, porque 3 é o único elemento presente nos dois conjuntos.</p></details><p class="ag-note">Este é um exemplo didático criado para a aula, não uma reprodução de prova oficial.</p></section>';} 
    if(c){h+='<section class="ag-lesson-intro"><span>GUIA DE ESTUDO</span><h3>Vamos por partes</h3><p>Leia com calma. Cada bloco apresenta uma ideia; depois, use o resumo e o exemplo para fixar.</p></section>'
      +'<div class="ag-lesson-flow">'+c.aula.map(function(p,k){return lessonBlock(p,k)}).join('')+'</div>'
      +'<h3 class="ag-section-title">📌 O que vale guardar</h3><ul class="x-card x-as-res">'+c.resumo.map(function(p){return'<li>'+nl(p)+'</li>'}).join('')+'</ul>';
      if(c.exemplo)h+='<h3 class="ag-section-title">✏️ Exemplo resolvido</h3><div class="x-card ag-example-card"><p class="ag-example-question"><b>'+nl(c.exemplo.q)+'</b></p><details class="ag-solution"><summary>Ver resolução passo a passo</summary>'+resolutionBlocks(c.exemplo.res)+'</details></div>';
    }else{var ls=[];(w&&w.fases||[]).forEach(function(f){ls=ls.concat(f.lessons||[])});
      h+='<div class="x-card x-as-aula">'+(ls.length?ls.map(function(p){return'<p>'+nl(p)+'</p>'}).join(''):'<p>Conteúdo em preparação. Use as videoaulas enquanto isso.</p>')+'</div>'}
    h+='<div class="x-row x-mt"><button class="x-b x-p" onclick="UI.assunto(\''+id+'\','+i+',1)">Fazer exercícios →</button><a class="x-b" href="'+yt(busca)+'" target="_blank" rel="noopener">🎥 Ver videoaula ↗</a></div>';
  }else if(tab===1){var ex=exOf(id,i);ST[key]=ST[key]||{};
    var ok=0,feito=0;Object.keys(ST[key]).forEach(function(k){feito++;if(ST[key][k]===ex[k].c)ok++});
    h+='<section class="ag-exercise-intro"><span>PRATIQUE SEM PRESSA</span><h3>Uma questão de cada vez</h3><p>'+ex.length+' questões disponíveis neste conteúdo. Leia o enunciado, identifique o que ele pede e só então escolha uma alternativa. A explicação aparece depois da resposta.</p></section>'
     +(feito?'<div class="x-card x-as-placar"><b>'+ok+' de '+feito+'</b> certas até agora'+(feito===ex.length?(ok===ex.length?' · gabaritou! 🌸':' · '+(ok/feito>=.6?'muito bem! 💗':'revise a aula e tente de novo 🌱')):'')+'</div>':'');
    ex.forEach(function(q,k){var r=ST[key][k];
      h+='<article class="x-card x-as-q ag-question-card"><div class="ag-question-meta"><span>QUESTÃO '+String(k+1).padStart(2,'0')+'</span><span>'+esc(w?w.nome:'Exercício')+'</span></div><p class="ag-question-prompt"><b>'+nl(q.q)+'</b></p><div class="ag-answer-hint">💡 <span>Antes de marcar, tente explicar por que as outras alternativas não respondem ao enunciado.</span></div><div class="x-as-alts">'
       +q.a.map(function(a,j){var cls='';if(r!=null){if(j===q.c)cls=' ok';else if(j===r)cls=' bad'}
         return'<button class="x-as-alt'+cls+'"'+(r!=null?' disabled':'')+' onclick="UI.asResp(\''+id+'\','+i+','+k+','+j+')"><span>'+LET[j]+'</span>'+esc(a)+'</button>'}).join('')+'</div>'
       +(r!=null?'<div class="x-as-exp '+(r===q.c?'ok':'bad')+'"><b>'+(r===q.c?'✅ Acertou!':'❌ Resposta certa: '+LET[q.c])+'</b><div class="ag-resolution-label">Entenda o raciocínio</div>'+resolutionBlocks(q.res||'')+'</div>':'')+'</article>'});
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

/* Leitura guiada, questões mais confortáveis e resoluções estruturadas. */
(function(){
 var s=document.createElement('style');
 s.textContent='.ag-lesson-intro,.ag-exercise-intro{padding:19px 20px;margin:16px 0 14px;border:1px solid var(--stroke-primary,#e9e4ed);border-radius:18px;background:linear-gradient(135deg,#fbf8ff,#fff)}.ag-lesson-intro>span,.ag-exercise-intro>span{font-size:10px;letter-spacing:.14em;font-weight:700;color:#9275aa}.ag-lesson-intro h3,.ag-exercise-intro h3{font-size:19px;margin:6px 0}.ag-lesson-intro p,.ag-exercise-intro p{font-size:13px;line-height:1.65;color:var(--text-secondary,#777);margin:0}.ag-lesson-flow{display:grid;gap:10px;margin:12px 0 22px}.ag-lesson-paragraph{display:grid;grid-template-columns:34px minmax(0,1fr);gap:12px;align-items:start;padding:16px 17px;border:1px solid var(--stroke-secondary,#eee);border-radius:16px;background:var(--mat-regular,#fff)}.ag-lesson-number{display:grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#f3edf8;color:#806398;font-size:11px;font-weight:700}.ag-lesson-paragraph>div{font-size:14px;line-height:1.8;color:var(--text-primary,#39333f)}.ag-section-title{margin:22px 0 10px;font-size:17px}.ag-example-card{padding:17px}.ag-example-question{font-size:14px;line-height:1.7}.ag-solution{margin-top:13px;border-top:1px solid var(--stroke-secondary,#eee);padding-top:12px}.ag-solution summary{cursor:pointer;font-size:13px;font-weight:650;color:#806398}.ag-solution-steps{padding:0 0 0 22px;margin:13px 0;display:grid;gap:12px}.ag-solution-steps li{padding-left:4px}.ag-solution-steps li::marker{color:#9275aa;font-weight:700}.ag-solution-steps li b{font-size:12px;color:#806398}.ag-solution-steps p,.ag-solution>p{font-size:13px;line-height:1.75;margin:4px 0 0}.ag-question-card{padding:17px;margin:12px 0}.ag-question-meta{display:flex;justify-content:space-between;gap:8px;margin-bottom:12px;color:#9275aa;font-size:10px;letter-spacing:.1em;font-weight:700}.ag-question-prompt{font-size:15px;line-height:1.75;margin:0 0 14px}.ag-answer-hint{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:#faf7fc;color:#756481;font-size:12px;line-height:1.55;margin:0 0 13px}.ag-resolution-label{margin:12px 0 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.8}.x-as-exp .ag-solution-steps{margin-bottom:3px}.x-as-exp .ag-solution-steps p{line-height:1.75}@media(max-width:520px){.ag-lesson-paragraph{padding:13px;grid-template-columns:29px minmax(0,1fr);gap:9px}.ag-lesson-number{width:27px;height:27px}.ag-lesson-paragraph>div{font-size:13px}.ag-question-card{padding:14px}.ag-question-prompt{font-size:14px}}';
 document.head.appendChild(s);
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

(function(){var st=document.createElement('style');st.textContent=`
.ag-lesson-intro,.ag-exercise-intro{background:#fff!important;color:#24212a!important}
.ag-lesson-intro h3,.ag-exercise-intro h3{color:#37283b!important}
.ag-lesson-intro p,.ag-exercise-intro p{color:#4e4654!important;font-size:15px!important}
.ag-lesson-paragraph{background:#f8f5fa!important;border-color:#e5dce9!important}
.ag-lesson-paragraph>div{color:#29232e!important;font-size:16px!important;line-height:1.8!important}
.ag-lesson-number{color:#51336a!important}
.ag-question-card{background:#30212d!important;color:#fff!important}
.ag-question-prompt{font-size:17px!important}
.ag-question-meta{color:#f4c8e5!important}
.ag-answer-hint{background:#fff!important;color:#3d3041!important;font-size:14px!important}
.ag-deep-lesson{background:#fff;color:#29232e;padding:clamp(18px,3vw,30px);border-radius:20px;margin:14px 0;border:1px solid #e8deea}
.ag-deep-lesson h3{font-size:26px;color:#3d2850;margin:8px 0 14px}
.ag-deep-lesson h4{font-size:19px;color:#4a2c60;margin:22px 0 9px}
.ag-deep-lesson p,.ag-deep-lesson li{font-size:16px;line-height:1.85}
.ag-kicker{font-size:12px;letter-spacing:.12em;color:#715080;font-weight:700}
.ag-visual{background:#f7f1fa;border-radius:16px;padding:20px;margin:20px 0;text-align:center}
.ag-visual small{display:block;color:#54475d;margin-top:12px;font-size:13px}
.ag-venn{position:relative;height:230px;max-width:440px;margin:auto}
.ag-circle{position:absolute;top:12px;width:215px;height:205px;border:3px solid #7c5aa0;border-radius:50%;display:flex;align-items:flex-start;justify-content:center;padding-top:16px;font-size:19px;font-weight:bold;background:#aa88d333;color:#442b5e}
.ag-a{left:4%}.ag-b{right:4%;border-color:#d36d91;background:#ed98b833;color:#79344d}
.ag-only-a,.ag-only-b,.ag-both{position:absolute;top:105px;z-index:2;font-size:15px;font-weight:700;color:#302239}
.ag-only-a{left:18%}.ag-only-b{right:18%}.ag-both{left:50%;transform:translateX(-50%);top:93px}
.ag-worked{background:#f4edf9;border-left:5px solid #8d64a9;padding:18px;border-radius:12px;margin:20px 0}
.ag-worked ol{padding-left:24px}
.ag-check{border:1px solid #b9a1cc;border-radius:12px;padding:15px;margin:18px 0}
.ag-check summary{cursor:pointer;font-weight:700;display:list-item!important;position:static!important;float:none!important;width:auto!important;max-width:100%!important;overflow-wrap:anywhere!important;white-space:normal!important;line-height:1.6!important;color:#382a40!important}.ag-check{clear:both;display:block;overflow:visible!important}.ag-check p{color:#382a40!important}
.ag-note{font-size:12px!important;color:#716677}
@media(max-width:480px){.ag-circle{width:56%;height:180px}.ag-venn{height:205px}.ag-only-a{left:13%}.ag-only-b{right:13%}.ag-both{top:82px}.ag-only-a,.ag-only-b{top:95px;font-size:12px}.ag-deep-lesson p,.ag-deep-lesson li{font-size:15px}}
`;document.head.appendChild(st)})();
