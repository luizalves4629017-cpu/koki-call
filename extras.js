(function(){var UI=window.UI;if(!UI)return;
var D=window.GAME_DATA||{};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var nl=function(s){return esc(s).replace(/\n/g,'<br>')};
var get=function(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
var put=function(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}};
var app=function(){return document.getElementById('app')};
var go=function(h,nav){(UI._show||function(x){app().innerHTML=x})(h,nav);window.scrollTo(0,0)};
var LET='ABCDE';

/* ---------- 1. Salvamento ---------- */
try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
var KEYS=['uece-quiz-progresso','agatha-exercicios','redacao-agatha','agatha-provas','agatha-timer','fundo-i','hark-theme'];
var okStore=put('agatha-teste',1);
UI.backup=function(){var o={app:'agatha',v:1,em:new Date().toISOString(),d:{}};
  KEYS.forEach(function(k){var v=localStorage.getItem(k);if(v!=null)o.d[k]=v});
  var b=new Blob([JSON.stringify(o)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download='progresso-agatha-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);put('agatha-ultimo-backup',Date.now())};
UI.restaurar=function(inp){var f=inp.files&&inp.files[0];if(!f)return;var r=new FileReader();
  r.onload=function(){try{var o=JSON.parse(r.result);if(!o.d)throw 0;Object.keys(o.d).forEach(function(k){if(KEYS.indexOf(k)>-1)localStorage.setItem(k,o.d[k])});
    alert('Progresso restaurado! O app vai recarregar. 💗');location.reload()}catch(e){alert('Esse arquivo não é um backup do app.')}};r.readAsText(f)};
UI.salvar=function(){var n=0;KEYS.forEach(function(k){if(localStorage.getItem(k)!=null)n++});
  var ex=get('agatha-exercicios',{}),feitos=0;Object.keys(ex).forEach(function(k){feitos+=Object.keys(ex[k]).length});
  var pv=get('agatha-provas',{}),np=Object.keys(pv).length;
  go('<button class="x-b x-back" onclick="UI.home()">← Início</button><h2>💾 Seu progresso</h2>'
  +(okStore?'<div class="x-card"><p>✅ Tudo que você faz é salvo automaticamente <b>neste aparelho</b>: assuntos marcados, exercícios respondidos ('+feitos+'), provas ('+np+'), redações e cronômetro.</p>'
   +'<p class="x-mut">Para não perder: abra sempre pelo ícone na tela inicial (ou pelo Chrome/Safari). Se abrir pelo link dentro do WhatsApp ou do Instagram, o celular pode apagar tudo ao fechar.</p></div>'
   :'<div class="x-card" style="border:2px solid #e57"><p>⚠️ Este navegador não está deixando salvar (talvez aba anônima ou navegador do WhatsApp). Abra o link no Chrome ou Safari e adicione à tela inicial.</p></div>')
  +'<div class="x-card"><h3 style="margin-top:0">Cópia de segurança</h3><p class="x-mut">Guarde um arquivo com todo o progresso. Serve pra trocar de celular ou se algo for apagado.</p>'
  +'<div class="x-row"><button class="x-b x-p" onclick="UI.backup()">⬇️ Baixar backup</button>'
  +'<label class="x-b" style="cursor:pointer">⬆️ Restaurar<input type="file" accept="application/json,.json" style="display:none" onchange="UI.restaurar(this)"></label></div></div>','home')};

/* ---------- 2. Cronômetro ---------- */
var TK='agatha-timer',TM=get(TK,{dur:50*60,end:0,rest:50*60,run:false,modo:'down',lbl:''});
function dur(m){m=+m||0;var h=Math.floor(m/60),x=m%60;return h?(h+'h'+(x?String(x).padStart(2,'0'):'')):x+' min'}
function tLeft(){return TM.run?Math.round((TM.end-Date.now())/1000):TM.rest}
function fmt(s){var neg=s<0;s=Math.abs(s);var h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;return(neg?'-':'')+(h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0')}
var fab=document.createElement('button');fab.className='x-tfab';fab.setAttribute('aria-label','Cronômetro');fab.onclick=function(){UI.timer()};document.body.appendChild(fab);
var avisou=false;
function beep(){try{var c=new (window.AudioContext||window.webkitAudioContext)();[0,.35,.7].forEach(function(t){var o=c.createOscillator(),g=c.createGain();o.frequency.value=880;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(.25,c.currentTime+t);o.start(c.currentTime+t);o.stop(c.currentTime+t+.25)})}catch(e){}try{navigator.vibrate&&navigator.vibrate([300,150,300,150,300])}catch(e){}}
function tick(){var l=tLeft();fab.innerHTML='⏱ <b>'+fmt(Math.max(l,0))+'</b>'+(TM.run?'':' <small>⏸</small>');
  fab.classList.toggle('on',TM.run);fab.classList.toggle('fim',TM.run&&l<=0);
  var big=document.getElementById('x-tbig');if(big)big.textContent=fmt(Math.max(l,0));
  if(TM.run&&l<=0&&!avisou){avisou=true;beep();setTimeout(function(){alert('⏰ Tempo esgotado'+(TM.lbl?' · '+TM.lbl:'')+'! Respira, você foi muito bem. 💗')},50)}}
setInterval(tick,1000);tick();
function tsave(){put(TK,TM);tick()}
UI.tStart=function(){if(TM.run)return;TM.end=Date.now()+TM.rest*1000;TM.run=true;avisou=false;tsave();UI.timer(true)};
UI.tPause=function(){if(!TM.run)return;TM.rest=Math.max(0,tLeft());TM.run=false;tsave();UI.timer(true)};
UI.tReset=function(){TM.run=false;TM.rest=TM.dur;avisou=false;tsave();UI.timer(true)};
UI.tSet=function(min,lbl){min=Math.max(1,Math.min(600,Math.round(+min||0)));TM.dur=min*60;TM.rest=TM.dur;TM.run=false;TM.lbl=lbl||'';avisou=false;tsave();UI.timer(true)};
UI.tAdd=function(m){if(TM.run)TM.end+=m*60000;else TM.rest=Math.max(0,TM.rest+m*60);tsave()};
UI.tSetHM=function(){var h=+document.getElementById('x-th').value||0,m=+document.getElementById('x-tm').value||0;UI.tSet(h*60+m,'')};
UI.timer=function(keep){var pre=[['25 min · foco',25],['50 min · estudo',50],['1h30 · bloco',90],['3h · simulado curto',180],['4h · 1ª fase UECE',240],['5h30 · ENEM 1º dia',330],['5h · ENEM 2º dia',300]];
  var h='<div class="x-tpanel" role="dialog" aria-label="Cronômetro"><div class="x-row" style="justify-content:space-between"><b>⏱ Cronômetro</b><button class="x-b" onclick="UI.tClose()">Fechar ✕</button></div>'
  +'<div id="x-tbig" class="x-tbig">'+fmt(Math.max(tLeft(),0))+'</div>'+(TM.lbl?'<p class="x-mut" style="text-align:center;margin:0">'+esc(TM.lbl)+'</p>':'')
  +'<div class="x-row" style="justify-content:center">'+(TM.run?'<button class="x-b x-p" onclick="UI.tPause()">⏸ Pausar</button>':'<button class="x-b x-p" onclick="UI.tStart()">▶️ Começar</button>')
  +'<button class="x-b" onclick="UI.tReset()">↺ Zerar</button><button class="x-b" onclick="UI.tAdd(5)">+5 min</button><button class="x-b" onclick="UI.tAdd(-5)">−5 min</button></div>'
  +'<p class="x-mut" style="margin:12px 0 4px">Escolher o tempo</p><div class="x-row" style="align-items:center"><input id="x-th" class="x-in" type="number" min="0" max="10" value="'+Math.floor(TM.dur/3600)+'" style="width:70px" aria-label="Horas"> h <input id="x-tm" class="x-in" type="number" min="0" max="59" value="'+Math.floor(TM.dur%3600/60)+'" style="width:70px" aria-label="Minutos"> min <button class="x-b" onclick="UI.tSetHM()">Definir</button></div>'
  +'<div class="x-tpre">'+pre.map(function(p){return'<button class="x-b" onclick="UI.tSet('+p[1]+',\''+p[0]+'\')">'+p[0]+'</button>'}).join('')+'</div></div>';
  var o=document.getElementById('x-tov');if(!o){o=document.createElement('div');o.id='x-tov';o.className='x-tov';o.onclick=function(e){if(e.target===o)UI.tClose()};document.body.appendChild(o)}
  o.innerHTML=h;o.style.display='flex'};
UI.tClose=function(){var o=document.getElementById('x-tov');if(o)o.style.display='none'};

/* ---------- 3. Provas reais ---------- */
var PK='agatha-provas',PR=get(PK,{}),IDX=null;
function psave(){put(PK,PR)}
var PB=window.PROVAS_BASE||'';
var official=function(p){return p.exame==='ENEM'?'https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos':'https://www.cev.uece.br/'};

function loadIdx(cb){if(IDX)return cb(IDX);if(window.PROVAS_IDX){IDX=window.PROVAS_IDX;return cb(IDX)}fetch('provas/index.json').then(function(r){return r.json()}).then(function(j){IDX=j;cb(j)}).catch(function(){cb([])})}
function pv(id){return(IDX||[]).find(function(p){return p.id===id})}
function score(p,st){var ok=0,tot=0,pm={};(p.materias||[{nome:'Geral',de:1,ate:p.questoes}]).forEach(function(m){pm[m.nome]={ok:0,tot:0}});
  var R=rng(p);for(var q=R[0];q<=R[1];q++){var g=p.gabarito[q];if(!g||(p.anuladas||[]).indexOf(String(q))>-1)continue;tot++;var m=matOf(p,q);
    if(m)pm[m].tot++;if(st.r[q]===g){ok++;if(m)pm[m].ok++}}return{ok:ok,tot:tot,pm:pm}}
function rng(p){var M=p.materias||[];return M.length?[M[0].de,M[M.length-1].ate]:[1,p.questoes]}
function matOf(p,q){var m=(p.materias||[]).find(function(m){return q>=m.de&&q<=m.ate});return m?m.nome:null}
UI.provas=function(){loadIdx(function(L){var by={};L.forEach(function(p){(by[p.exame]=by[p.exame]||[]).push(p)});
  var h='<h2>📄 Provas reais</h2><p class="x-mut">As provas oficiais, do jeitinho que caem: textos, imagens e gráficos. Marque no cartão-resposta, use o cronômetro e corrija com o gabarito oficial. Tudo fica salvo.</p>';
  if(!L.length)h+='<div class="x-card"><p>Não consegui carregar as provas agora. Confira a internet e abra de novo.</p></div>';
  Object.keys(by).forEach(function(ex){h+='<h3>'+(ex==='UECE'?'🏫 UECE':'📘 ENEM')+'</h3>';
    by[ex].forEach(function(p){var st=PR[p.id],n=st?Object.keys(st.r||{}).length:0,s=st&&st.fim?score(p,st):null;
      h+='<div class="x-card x-pv"><div><b>'+esc(p.nome)+'</b><p class="x-mut" style="margin:4px 0">'+p.questoes+' questões · '+dur(p.tempo_min)+(s?' · <b>'+s.ok+'/'+s.tot+' acertos</b>':n?' · '+n+' respondidas':'')+'</p></div>'
      +'<div class="x-row"><button class="x-b x-p" onclick="UI.prova(\''+p.id+'\')">'+(n&&!s?'Continuar':s?'Ver resultado':'Fazer prova')+'</button><a class="x-b" href="'+esc(official(p))+'" target="_blank" rel="noopener">📄 Prova oficial</a></div></div>'})});
  h+='<h3>🖨️ Listas pra imprimir</h3><p class="x-mut">Exercícios de cada matéria com gabarito no final. Toque, depois em Imprimir (ou Salvar como PDF).</p><div class="x-tpre">'
   +(D.worlds||[]).map(function(w){return'<button class="x-b" onclick="UI.imprimir(\''+w.id+'\')">'+(w.icone||'')+' '+esc(w.nome)+'</button>'}).join('')+'</div>';
  go(h,'prov')})};
UI.prova=function(id,mat){loadIdx(function(){var p=pv(id);if(!p)return UI.provas();var st=PR[id]=PR[id]||{r:{},ini:Date.now()};psave();
  if(st.fim)return UI.provaRes(id);
  var M=p.materias||[],m=mat!=null?M[mat]:null,R=rng(p),de=m?m.de:R[0],ate=m?m.ate:R[1];
  var p1=m?(p.q2p[de]||1):1,p2=m&&ate<R[1]?(p.q2p[ate+1]||p.paginas):p.paginas;
  var h='<button class="x-b x-back" onclick="UI.provas()">← Provas</button><h2>'+esc(p.nome)+'</h2>'
   +'<div class="x-row"><button class="x-b" onclick="UI.tSet('+(m?Math.max(10,Math.round((p.tempo_min||240)*(ate-de+1)/p.questoes)):(p.tempo_min||240))+',\''+esc(p.nome).replace(/'/g,'')+'\');UI.tStart()">⏱ Iniciar tempo '+(m?'da parte':'oficial')+'</button><a class="x-b" href="'+esc(official(p))+'" target="_blank" rel="noopener">📄 Consultar PDF oficial</a></div>'
   +(M.length>1?'<div class="x-tpre" style="margin-top:10px"><button class="x-b'+(m?'':' x-p')+'" onclick="UI.prova(\''+id+'\')">Prova inteira</button>'+M.map(function(x,k){return'<button class="x-b'+(mat===k?' x-p':'')+'" onclick="UI.prova(\''+id+'\','+k+')">'+esc(x.nome)+' ('+x.de+'–'+x.ate+')</button>'}).join('')+'</div>':'')
   +'<div class="x-card" style="margin:14px 0;background:#fff;color:#29232d"><h3 style="color:#392c44">📄 Páginas da prova oficial</h3><p>Leia as questões abaixo e marque as respostas no cartão. '+(m?'Páginas correspondentes à matéria selecionada.':'Caderno completo.')+'</p>'+(p.fonte_prova?'<div class="x-official-pages"><iframe title="Caderno oficial da prova" loading="lazy" src="'+esc(p.fonte_prova)+'#page='+p1+'&toolbar=1" style="width:100%;height:640px;border:1px solid #d6cbd9;border-radius:12px;background:#f7f5f8"></iframe><p><a class="x-b x-p" target="_blank" rel="noopener" href="'+esc(p.fonte_prova)+'#page='+p1+'">📄 Abrir prova oficial na página '+p1+' ↗</a></p>'+(m?'<p style="font-size:13px">Esta matéria ocupa aproximadamente as páginas '+p1+' a '+p2+'. Use a navegação do PDF para avançar.</p>':'')+'</div>':'<p>Este caderno ainda não tem um endereço direto de PDF verificado. Use o portal oficial.</p>')+'<p style="font-size:13px">Se o PDF não aparecer dentro do aplicativo, toque em abrir prova oficial. As respostas continuam sendo marcadas aqui.</p></div>';
  h+='<div class="x-cr"><div class="x-row" style="justify-content:space-between"><b>📝 Cartão-resposta'+(m?' · '+esc(m.nome):'')+'</b><span class="x-mut" id="x-crn"></span></div><div class="x-crg">';
  for(var q=de;q<=ate;q++){h+='<div class="x-crq"><span>'+q+'</span>';for(var a=0;a<(p.alts||5);a++)h+='<button data-q="'+q+'" data-a="'+LET[a]+'" class="'+(st.r[q]===LET[a]?'on':'')+'" onclick="UI.pMark(\''+id+'\','+q+',\''+LET[a]+'\',this)">'+LET[a]+'</button>';h+='</div>'}
  h+='</div><div class="x-row x-mt"><button class="x-b x-p" onclick="UI.pFim(\''+id+'\')">✅ Terminar e corrigir</button><button class="x-b" onclick="UI.pZerar(\''+id+'\')">↺ Recomeçar</button></div></div>';
  go(h,'prov');cnt(id)})};
function cnt(id){var e=document.getElementById('x-crn'),p=pv(id);if(e&&p)e.textContent=Object.keys(PR[id].r).length+'/'+p.questoes+' marcadas'}
UI.pMark=function(id,q,a,b){var st=PR[id];if(st.r[q]===a)delete st.r[q];else st.r[q]=a;psave();
  b.parentNode.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',st.r[q]===x.dataset.a)});cnt(id)};
UI.pZerar=function(id){if(confirm('Apagar as respostas desta prova e recomeçar?')){PR[id]={r:{},ini:Date.now()};psave();UI.prova(id)}};
UI.pFim=function(id){var p=pv(id),n=Object.keys(PR[id].r).length;if(n<p.questoes&&!confirm('Faltam '+(p.questoes-n)+' questões sem marcar. Corrigir mesmo assim?'))return;
  PR[id].fim=Date.now();psave();if(TM.run)UI.tPause();UI.provaRes(id)};
UI.provaRes=function(id){loadIdx(function(){var p=pv(id),st=PR[id],s=score(p,st);
  var h='<button class="x-b x-back" onclick="UI.provas()">← Provas</button><h2>Resultado · '+esc(p.nome)+'</h2>'
   +'<div class="x-card x-as-placar" style="text-align:center"><div style="font-size:34px;font-weight:800">'+s.ok+' / '+s.tot+'</div><p>'+Math.round(100*s.ok/Math.max(1,s.tot))+'% de acertos '+(s.ok/s.tot>=.7?'🌸 arrasou!':s.ok/s.tot>=.5?'💗 bom caminho!':'🌱 cada erro é um assunto pra revisar')+'</p></div>'
   +'<h3>Por matéria</h3><div class="x-card">'+Object.keys(s.pm).map(function(k){var v=s.pm[k],pc=v.tot?Math.round(100*v.ok/v.tot):0;return'<div class="x-pm"><span>'+esc(k)+'</span><div class="x-bar"><i style="width:'+pc+'%"></i></div><b>'+v.ok+'/'+v.tot+'</b></div>'}).join('')+'</div>'
   +'<h3>Questão por questão</h3><div class="x-crg">';
  var R=rng(p);for(var q=R[0];q<=R[1];q++){var g=p.gabarito[q],r=st.r[q],an=(p.anuladas||[]).indexOf(String(q))>-1;
    h+='<button class="x-rq '+(an?'an':r===g?'ok':'bad')+'" onclick="window.open(\''+PB+'provas/'+id+'/p'+(p.q2p[q]||1)+'.jpg\',\'_blank\')" title="Ver página da questão"><b>'+q+'</b> '+(an?'anulada':(r||'–')+(r===g?' ✓':' → '+g))+'</button>'}
  h+='</div><p class="x-mut">Toque numa questão para abrir a página dela na prova.</p><div class="x-row x-mt"><button class="x-b" onclick="UI.pZerar(\''+id+'\')">↺ Refazer prova</button><a class="x-b" href="'+esc(p.fonte_gabarito||p.pdf)+'" target="_blank" rel="noopener">Gabarito oficial ↗</a></div>';
  go(h,'prov')})};

UI._pIdx=loadIdx;
/* ---------- 4. Listas pra imprimir ---------- */
UI.imprimir=function(id){var w=(D.worlds||[]).find(function(x){return x.id===id}),C=(window.CONT||{})[id]||[],T=(D.programa||{})[id]||[];
  var n=0,gab=[],h='<div class="x-noprint x-row"><button class="x-b x-back" onclick="UI.provas()">← Voltar</button><button class="x-b x-p" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button></div>'
   +'<div class="x-print"><h1>'+esc(w?w.nome:id)+' · Lista de exercícios</h1><p>Nome: ______________________________  Data: ___/___/______</p>';
  C.forEach(function(c,i){if(!c||!c.exercicios)return;h+='<h2>'+esc(T[i]||'')+'</h2>';
    c.exercicios.forEach(function(e){n++;gab.push(n+') '+LET[e.c]);h+='<div class="x-pq"><p><b>'+n+'.</b> '+nl(e.q)+'</p><ol type="A">'+e.a.map(function(a){return'<li>'+esc(a)+'</li>'}).join('')+'</ol></div>'})});
  h+='<div class="x-pgab"><h2>Gabarito</h2><p>'+gab.join(' · ')+'</p></div></div>';go(h,'prov')};


var NM={port:['portugu','linguagens, c'],filo:['filosof','humanas'],socio:['sociolog','humanas'],mat:['matem'],bio:['biolog','natureza'],fis:['físic','natureza'],qui:['químic','natureza'],geo:['geograf','humanas'],hist:['hist','humanas'],ing:['ingl'],edf:['educação f','linguagens, c'],artes:['linguagens, c']};
var oa=UI.assunto;UI.assunto=function(id,i,tab){oa.apply(this,arguments);if(tab!==3)return;var key=NM[id];if(!key)return;
  loadIdx(function(L){var a=app();if(!a)return;var bs=[];L.forEach(function(p){(p.materias||[]).forEach(function(m,k){var n=m.nome.toLowerCase();if(key.some(function(k){return n.indexOf(k)>-1})&&!(id==='edf'&&n.indexOf('física')>-1&&n.indexOf('educa')<0)&&!(id==='fis'&&n.indexOf('educa')>-1))bs.push('<button class="x-b" onclick="UI.prova(\''+p.id+'\','+k+')">'+esc(p.nome)+' · '+esc(m.nome)+' ('+m.de+'–'+m.ate+')</button>')})});
    if(!bs.length)return;var t=a.querySelector('.x-as-tabs');if(t)t.insertAdjacentHTML('afterend','<div class="x-card"><h3 style="margin-top:0">📄 Questões reais desta matéria</h3><p class="x-mut">Como caem de verdade, com textos e imagens, gabarito oficial.</p><div class="x-tpre">'+bs.join('')+'</div></div>')})};
/* ---------- 5. Atalhos ---------- */
var oh=UI.home;UI.home=function(){oh.apply(this,arguments);var a=app();if(!a)return;
  a.insertAdjacentHTML('beforeend','<div class="x-row x-mt" style="justify-content:center"><button class="x-b" onclick="UI.provas()">📄 Provas reais</button><button class="x-b" onclick="UI.timer()">⏱ Cronômetro</button><button class="x-b" onclick="UI.salvar()">💾 Meu progresso</button></div>')};
var os=UI.subj;UI.subj=function(id){os.apply(this,arguments);var a=app(),t=a&&a.querySelector('.x-tabs');if(t)t.insertAdjacentHTML('beforebegin','<div class="x-row" style="margin:6px 0 10px"><button class="x-b" onclick="UI.imprimir(\''+id+'\')">🖨️ Lista pra imprimir</button></div>')};
UI.home();
})();
