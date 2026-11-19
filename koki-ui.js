/* ===== Novo layout + Buscar questões por assunto (pedido da Ágatha) ===== */
(function(){
var UI=window.UI;if(!UI)return;
var D=window.GAME_DATA||{},W=D.worlds||[],PG=D.programa||{},TR=D.tracks||{};
var LS='uece-quiz-progresso',EXK='agatha-exercicios',LAST='agatha-ultimo-assunto';
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var nl=function(s){return esc(s).replace(/\n/g,'<br>')};
var jget=function(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}};
var byId=function(id){return W.find(function(w){return w.id===id})};
var P=function(){return UI._P?UI._P():(jget(LS,{})||{})};
var show=function(h,n){UI._show(h,n||'home');try{window.scrollTo(0,0)}catch(e){}};
var norm=function(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')};
var LET='ABCDE';
var gg=function(q){return'https://www.google.com/search?q='+encodeURIComponent(q)};
var yt=function(q){return'https://www.youtube.com/results?search_query='+encodeURIComponent(q)};
var track=function(){var t=(jget(LS,{})||{}).tr;return TR[t]?t:'uece'};
var trIds=function(t){var s=[];((TR[t]||{}).grupos||[]).forEach(function(g){g.ids.forEach(function(id){if(byId(id)&&s.indexOf(id)<0)s.push(id)})});return s};

/* ---------- ícones ---------- */
var I={
 home:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2 2.8 11a1 1 0 0 0 1.3 1.5l.9-.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-8.3l.9.8a1 1 0 1 0 1.3-1.5z"/></svg>',
 plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h5M8 17.5h8"/></svg>',
 book:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 6.5C10 4.9 7 4.5 3.5 5v13.6c3.4-.5 6.4 0 8.5 1.6 2.1-1.6 5.1-2.1 8.5-1.6V5C17 4.5 14 4.9 12 6.5zm-1 11.2c-1.8-.9-4-1.2-5.5-1.1V7c1.9-.1 4 .3 5.5 1.3zm8-1.1c-1.5-.1-3.7.2-5.5 1.1V8.3C15 7.3 17.1 6.9 19 7z"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16.2 9.5"/></svg>',
 list:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1.2" fill="currentColor"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1.2" fill="currentColor"/></svg>',
 doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
 pen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
 note:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/></svg>',
 bars:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3.5" y="12" width="4" height="8.5" rx="2"/><rect x="10" y="7" width="4" height="13.5" rx="2"/><rect x="16.5" y="3.5" width="4" height="17" rx="2"/></svg>',
 gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 0 0 2.6-1.5l2.4 1 2-3.4z"/></svg>',
 play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
 sq:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2.5" y="2.5" width="19" height="19" rx="5"/><path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
 bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
 menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
 cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle cx="16" cy="16" r="2.4" fill="currentColor"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
};
var AR=I.arrow;

/* ---------- navegação ---------- */
var NAV=[['inicio','Início','home','UI.dash()'],['plano','Meu Plano','plan','UI.metodos()'],['materias','Matérias','book','UI.home()'],['sim','Simulados','check','UI.sim()'],['quest','Questões','list','UI.questoes()'],['provas','Provas','doc','UI.provas()'],['red','Redação','pen','UI.redacao()'],['erros','Caderno de erros','note','UI.errors()'],['desemp','Desempenho','bars','UI.desempenho()']];
var BNAV=[['inicio','Início','home','UI.dash()'],['materias','Matérias','book','UI.home()'],['quest','Questões','list','UI.questoes()'],['provas','Provas','doc','UI.provas()'],['menu','Menu','menu','KUI.drawer(1)']];
var nb=function(n,cls){return'<button class="'+cls+'" data-kn="'+n[0]+'" onclick="KUI.drawer(0);'+n[3]+'">'+I[n[2]]+'<span>'+n[1]+'</span></button>'};
var side=document.createElement('aside');side.className='k-side';side.id='k-side';side.setAttribute('aria-label','Menu principal');
side.innerHTML='<button class="k-logo" onclick="KUI.drawer(0);UI.dash()"><img src="icon-192.png" alt=""><b>Seja feliz</b><small>com todas as suas escolhas e provas</small></button>'
 +'<nav class="k-nav">'+NAV.map(function(n){return nb(n,'k-nb')}).join('')+'</nav>'
 +'<div class="k-enc"><div class="t">🏆</div><p>Você está no caminho certo!</p><small>Como a Sakura: coragem e coração. Um passo de cada vez. 🌸</small><i></i></div>'
 +nb(['cfg','Configurações','gear','UI.config()'],'k-nb k-cfg');
var ov=document.createElement('div');ov.className='k-ov';ov.onclick=function(){KUI.drawer(0)};
var top=document.createElement('header');top.className='k-top';
top.innerHTML='<button class="k-ib k-ham" aria-label="Abrir menu" onclick="KUI.drawer(1)">'+I.menu+'</button>'
 +'<label class="k-search">'+I.search+'<input id="k-q" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Buscar por assunto ou prova..." aria-label="Buscar por assunto, questão ou prova"><button type="button" class="k-x" aria-label="Limpar busca" onclick="KUI.clr()">✕</button></label>'
 +'<button class="k-ib bell" aria-label="Avisos" onclick="UI.avisos()">'+I.bell+'<span class="k-dot" id="k-dot" hidden></span></button>'
 +'<button class="k-av" aria-label="Configurações e perfil" onclick="UI.config()">Á</button>';
var bnav=document.createElement('nav');bnav.className='k-bnav';bnav.setAttribute('aria-label','Menu');bnav.innerHTML=BNAV.map(function(n){return nb(n,'')}).join('');
var page=document.querySelector('.page');var mw=document.createElement('div');mw.className='k-mainw';
page.parentNode.insertBefore(mw,page);mw.appendChild(top);mw.appendChild(page);
document.body.insertBefore(ov,mw);document.body.insertBefore(side,ov);document.body.appendChild(bnav);
var CUR='inicio';
function mark(k){CUR=k;document.querySelectorAll('[data-kn]').forEach(function(b){if(b.dataset.kn===k)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});dot()}
var KUI=window.KUI={drawer:function(on){document.body.classList.toggle('k-dr',!!on)},clr:function(){var q=document.getElementById('k-q');q.value='';q.parentNode.classList.remove('has');q.focus()}};
function wrap(name,key,after){var f=UI[name];if(typeof f!=='function')return;UI[name]=function(){var r=f.apply(this,arguments);if(key)mark(key);if(after)try{after.apply(null,arguments)}catch(e){}return r}}
[['home','materias'],['subj','materias'],['topic','materias'],['hls','materias'],['myfc','materias'],['code','cfg'],['track','materias'],['metodos','plano'],['sim','sim'],['simGo','sim'],['provas','provas'],['prova','provas'],['provaRes','provas'],['imprimir','provas'],['errors','erros'],['revErr','erros'],['redacao','red'],['salvar','cfg']].forEach(function(x){wrap(x[0],x[1])});

/* ---------- avisos (sininho) ---------- */
function avisos(){var a=[],p=P(),e=(p.e||[]).length,b=+localStorage.getItem('agatha-ultimo-backup')||0,dias=b?Math.floor((Date.now()-b)/864e5):null;
  if(e)a.push(['📒',e+(e>1?' questões':' questão')+' no caderno de erros para revisar','UI.errors()']);
  if(dias==null||dias>=7)a.push(['💾',dias==null?'Você ainda não baixou uma cópia de segurança do progresso':'Seu último backup foi há '+dias+' dias','UI.salvar()']);
  var nx=next();if(nx)a.push(['📖','Próximo assunto: '+nx.t,'UI.assunto(\''+nx.id+'\','+nx.i+')']);return a}
function dot(){var d=document.getElementById('k-dot');if(d)d.hidden=!avisos().filter(function(x){return x[0]!=='📖'}).length}
UI.avisos=function(){var a=avisos();show('<h2>🔔 Avisos</h2><div class="k-res">'+a.map(function(x){return'<button class="k-ra" onclick="'+x[2]+'"><span class="ic">'+x[0]+'</span><span>'+esc(x[1])+'</span></button>'}).join('')+'</div>'+(a.length?'':'<p class="x-mut">Tudo em dia. 🌸</p>'));mark('')};

/* ---------- progresso e próximo assunto ---------- */
function EXN(){return track()==='enem'?'ENEM':'UECE'}function DAX(){return track()==='enem'?'do ENEM':'da UECE'}function stats(){var p=P(),t=track(),ids=trIds(t),tot=0,chk=0;ids.forEach(function(id){(PG[id]||[]).forEach(function(_,i){tot++;if(p.t&&p.t[id+':'+i])chk++})});
  return{tot:tot,chk:chk,pct:tot?Math.round(chk/tot*100):0,a:+p.a||0,r:+p.r||0,ac:p.a?Math.round(p.r/p.a*100):0,t:t}}
function next(){var p=P(),l=jget(LAST,null),done=function(id,i){return p.t&&p.t[id+':'+i]};
  if(l&&PG[l.id]&&PG[l.id][l.i]!=null&&!done(l.id,l.i))return{id:l.id,i:l.i,t:PG[l.id][l.i],cont:1};
  var ids=trIds(track());for(var k=0;k<ids.length;k++){var pg=PG[ids[k]]||[];for(var i=0;i<pg.length;i++)if(!done(ids[k],i))return{id:ids[k],i:i,t:pg[i]}}return null}
var IC=['ic1.jpg','ic2.jpg','ic3.jpg','ic4.jpg','ic5.jpg'];
function idx(cb){if(UI._pIdx)UI._pIdx(cb);else cb([])}

/* ---------- INÍCIO (painel) ---------- */
UI.dash=function(){var s=stats(),nx=next(),hoje=new Date(),dt=hoje.toLocaleDateString('pt-BR',{day:'numeric',month:'short'}).replace('.',''),w=nx?byId(nx.id):null;
  var h='<div class="k-dash">'
  +'<section class="k-hero"><img class="galho" src="galho.webp" alt="" aria-hidden="true"><div class="tx"><h1>Continue estudando!</h1><p>Um passo de cada vez. Você vai conseguir. 🌸</p>'
  +'<button class="k-btn" onclick="UI.metodos()">Ver meu plano '+AR+'</button>'
  +'<div class="ics">'+IC.map(function(src){return'<img src="'+src+'" alt="" onclick="UI.hug(this.parentNode)">'}).join('')+'</div></div>'
  +'<div class="imgs"><img class="fam" src="hero.webp" alt="Sasuke e Sakura com a filha, se abraçando" onclick="UI.hug(this.parentNode)"></div></section>'
  +'<div class="k-row4"><div class="k-card k-prog"><div class="k-ring" style="--p:'+s.pct+'" role="img" aria-label="'+s.pct+'% dos tópicos estudados"><b>'+s.pct+'%</b></div>'
  +'<div><h3>Seu progresso</h3><p>'+s.chk+' de '+s.tot+' tópicos oficiais '+(s.t==='enem'?'do ENEM':'da UECE')+' estudados</p><div class="mini"><span><b>'+s.a+'</b>respondidas</span><span><b>'+s.ac+'%</b>de acerto</span></div></div></div>'
  +'<button class="k-tile" onclick="UI.home()">'+I.play+'Aulas<small>Matérias e assuntos</small></button>'
  +'<button class="k-tile" onclick="UI.sim()">'+I.sq+'Simulados<small>Questões misturadas</small></button>'
  +'<button class="k-tile" onclick="UI.questoes()">'+I.list+'Questões<small>Por assunto</small></button></div>'
  +'<div class="k-sec"><h2>Seu plano de estudos</h2><button class="k-lnk" onclick="UI.metodos()">Ver cronograma →</button></div>'
  +'<div class="k-card k-plan"><div class="k-cal">'+I.cal+'</div><div class="d"><b>Hoje</b><span>'+esc(dt)+'</span></div>'
  +(nx?'<div class="s"><b>'+esc(w?w.nome:'')+'</b><span>'+esc(nx.t)+'</span></div><button class="k-btn" onclick="UI.assunto(\''+nx.id+'\','+nx.i+')">'+(nx.cont?'Continuar estudando':'Começar')+' '+AR+'</button>'
     :'<div class="s"><b>Tudo estudado! 🎉</b><span>Hora de revisar com simulados e provas.</span></div><button class="k-btn" onclick="UI.sim()">Fazer simulado '+AR+'</button>')+'</div>'
  +'<div class="k-sec"><h2>Provas</h2><button class="k-lnk" onclick="UI.provas()">Explorar mais →</button></div><div class="k-list" id="k-dpv"><p class="x-mut">Carregando provas…</p></div>'
  +'</div>';
  show(h,'home');mark('inicio');
  idx(function(L){var el=document.getElementById('k-dpv');if(!el)return;var pr=jget('agatha-provas',{});
    var pick=[L.find(function(p){return p.exame==='UECE'}),L.find(function(p){return p.exame!=='UECE'})].filter(Boolean);
    el.innerHTML=pick.length?pick.map(function(p,k){var st=pr[p.id],n=st?Object.keys(st.r||{}).length:0;
      return'<div class="k-card k-pv"><div class="th"><img src="'+IC[(k+3)%5]+'" alt=""></div><div class="tx"><b>Prova '+esc(p.nome)+'</b><p>'+p.questoes+' questões · gabarito oficial · '+(st&&st.fim?'já corrigida ✓':n?n+' marcadas, continue de onde parou':'faça no tempo real e corrija no app')+'</p></div><button class="k-btn alt" onclick="UI.prova(\''+p.id+'\')">Acessar prova '+AR+'</button></div>'}).join('')
      :'<div class="k-card k-pv"><div class="tx"><b>Provas oficiais</b><p>Abra a lista de provas da UECE e do ENEM.</p></div><button class="k-btn alt" onclick="UI.provas()">Ver provas '+AR+'</button></div>'})};

/* ---------- banco de questões ---------- */
var QB=null,TOP=null;
function build(){if(QB)return;QB=[];TOP=[];var seen={},C=window.CONT||{};
  W.forEach(function(w){(PG[w.id]||[]).forEach(function(t,i){TOP.push({id:w.id,i:i,t:t,w:w,n:norm(t+' '+w.nome)})});
    (w.fases||[]).forEach(function(f,fi){TOP.push({id:w.id,fi:fi,t:f.titulo,w:w,n:norm(f.titulo+' '+w.nome),pr:1})})});
  var add=function(o){var k=norm(o.q).replace(/\s+/g,' ').slice(0,160);if(seen[k])return;seen[k]=1;o.uid='q'+QB.length;o.n=norm(o.q+' '+o.a.join(' '));QB.push(o)};
  Object.keys(C).forEach(function(id){(C[id]||[]).forEach(function(c,i){(c&&c.exercicios||[]).forEach(function(e){add({q:e.q,a:e.a,c:e.c,res:e.res,w:id,ti:i,tt:(PG[id]||[])[i]||''})})})});
  W.forEach(function(w){(w.fases||[]).forEach(function(f,fi){(f.questions||[]).forEach(function(q){add({q:q.q,a:q.a,c:q.c,res:q.exp,w:w.id,fi:fi,tt:f.titulo})})})})}
var STOP=' para pelo pela como sobre entre com sem dos das nos nas uma uns umas que suas seus sua seu este esta isso aos the and estudo estudos conceito conceitos nocoes nocao introducao geral gerais tipos principais basico basicos aplicacoes aplicacao '; 
function kws(t){var o=[];norm(t).split(/[^a-z0-9]+/).forEach(function(x){if(x.length<4||STOP.indexOf(' '+x+' ')>-1)return;var k=x.length>6?x.slice(0,x.length>8?6:5):x;if(o.indexOf(k)<0)o.push(k)});return o}
var QA={};
function qVisual(o){
var q=norm(o.q||''),t=norm(o.tt||''),svg='',label='';
if(o.w==='mat'&&(/porcent|desconto|aumento percentual|[0-9]+%/.test(q))){label='Visualização didática: porcentagem';svg='<rect x="18" y="48" width="324" height="32" rx="8" fill="#ddd2e9"/><rect x="18" y="48" width="81" height="32" rx="8" fill="#8b64aa"/><text x="22" y="36" fill="#3b294d" font-size="16">100% = total</text><text x="22" y="104" fill="#3b294d" font-size="14">Exemplo: 25% é 1/4 do total</text>'}
else if(o.w==='mat'&&(/conjunt|interse|uni[aã]o/.test(q+' '+t))){label='Visualização didática: conjuntos';svg='<circle cx="143" cy="77" r="60" fill="#a9c5ee" fill-opacity=".7" stroke="#537eb4" stroke-width="3"/><circle cx="211" cy="77" r="60" fill="#eeb3ce" fill-opacity=".7" stroke="#bc6b98" stroke-width="3"/><text x="112" y="82" font-size="20" fill="#30253d">A</text><text x="178" y="82" font-size="20" fill="#30253d">A ∩ B</text><text x="236" y="82" font-size="20" fill="#30253d">B</text>'}
else if(o.w==='geo'&&/latitude|longitude|coordenad/.test(q)){label='Visualização didática: coordenadas';svg='<ellipse cx="180" cy="72" rx="110" ry="54" fill="#d8e7f5" stroke="#567eac" stroke-width="2"/><path d="M70 72H290 M180 18V126 M95 45H265 M95 99H265" stroke="#6088a6" stroke-width="2" fill="none"/><text x="185" y="20" fill="#294a69" font-size="13">N</text>'}
if(!svg)return '';
return '<figure class="k-diagram" aria-label="'+esc(label)+'"><svg role="img" aria-label="'+esc(label)+'" viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg"><rect width="360" height="140" rx="14" fill="#f8f3fb"/>'+svg+'</svg><figcaption>'+esc(label)+' · imagem autoral ilustrativa, não retirada de prova oficial</figcaption></figure>';
}
function qCard(o,hlw){if(hlw!==undefined)o._hl=hlw;else hlw=o._hl;var st=QA[o.uid],w=byId(o.w),ans=st!=null;
  var hl=function(s){var h=nl(s);(hlw||[]).forEach(function(k){if(k.length<3)return;try{h=h.replace(new RegExp('('+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark>$1</mark>')}catch(e){}});return h};
  var src=o.ti!=null?'Exercício do app':'Prática do app';
  return'<div class="k-card k-q" id="'+o.uid+'"><div class="hd"><span class="k-tag">'+(w?(w.icone||'')+' '+esc(w.nome):'')+'</span><span class="k-tag">'+esc(o.tt||'')+'</span><span class="k-tag" title="Questão escrita para o app, imitando o formato da UECE. Não é questão de prova oficial.">'+src+' · prática autoral (não oficial)</span></div>'
  +'<p class="qt">'+(hlw?hl(o.q):nl(o.q))+'</p>'+qVisual(o)+'<div class="al">'+o.a.map(function(a,j){var c='';if(ans){if(j===o.c)c=' ok';else if(j===st)c=' bad'}
    return'<button class="'+c.trim()+'"'+(ans?' disabled':'')+' onclick="KUI.ans(\''+o.uid+'\','+j+')"><span>'+LET[j]+'</span>'+esc(a)+'</button>'}).join('')+'</div>'
  +(ans?'<div class="ex"><b>'+(st===o.c?'✅ Isso mesmo! 💗':'❌ Resposta certa: '+LET[o.c])+'</b><br>'+nl(o.res||'')+'</div>':'')+'</div>'}
KUI.ans=function(uid,j){build();var o=QB.find(function(x){return x.uid===uid});if(!o||QA[uid]!=null)return;QA[uid]=j;if(UI._score)UI._score(j===o.c);
  var el=document.getElementById(uid);if(el)el.outerHTML=qCard(o)};

function related(id,text,own){build();var k0=kws(text),pool=QB.filter(function(o){return o.w===id}),k=k0.filter(function(x){var df=pool.filter(function(o){return o.n.indexOf(x)>-1}).length;return df<=Math.max(3,pool.length*.3)});if(!k.length)k=k0;var need=k.length>=4?2:1,out=[];
  QB.forEach(function(o){if(o.w!==id)return;if(own&&own(o))return;var sc=0;k.forEach(function(x){if(o.n.indexOf(x)>-1||norm(o.tt).indexOf(x)>-1)sc++});if(sc>=need)out.push([sc,o])});
  out.sort(function(a,b){return b[0]-a[0]});return{k:k,L:out.slice(0,30).map(function(x){return x[1]})}}
var NM={port:['portugu'],filo:['filosof'],socio:['sociolog'],mat:['matem'],bio:['biolog','natureza'],fis:['físic','natureza'],qui:['químic','natureza'],geo:['geograf','humanas'],hist:['hist','humanas'],ing:['ingl'],edf:['educação f','linguagens, c'],artes:['linguagens, c']};
function realHTML(id,cb){var key=NM[id];if(!key)return cb('');idx(function(L){var u=[],e=[];L.forEach(function(p){(p.materias||[]).forEach(function(m,k){var n=m.nome.toLowerCase();
  if(!key.some(function(x){return n.indexOf(x)>-1}))return;if(id==='edf'&&n.indexOf('física')>-1&&n.indexOf('educa')<0)return;if(id==='fis'&&n.indexOf('educa')>-1)return;
  if(p.exame==='UECE'&&n.indexOf('natureza')>-1)return;
  if((track()==='enem')!==(p.exame!=='UECE'))return;(p.exame==='UECE'?u:e).push('<button class="x-b" onclick="UI.prova(\''+p.id+'\','+k+')">'+esc(p.nome)+' · '+esc(m.nome)+' (questões '+m.de+'–'+m.ate+')</button>')})});
  if(!u.length&&!e.length)return cb('');
  cb('<h3>🏫 Questões reais de provas oficiais</h3><div class="k-note"><span class="k-tag real">Provas oficiais</span> As provas oficiais aqui estão organizadas por <b>matéria, não por tópico</b>. Você lê na prova, marca no cartão-resposta e corrige com o <b>gabarito oficial</b> (sem resolução comentada).</div>'
   +(u.length?'<p class="x-mut" style="margin:10px 0 6px">UECE</p><div class="k-prv">'+u.join('')+'</div>':'')+(e.length?'<p class="x-mut" style="margin:12px 0 6px">ENEM</p><div class="k-prv">'+e.join('')+'</div>':''))})}
function extHTML(t,w){var nm=w?w.nome:'';var searches=[['🏫 UECE — questões por assunto','questões UECE '+t+' '+nm+' resolução comentada'],['📘 ENEM — questões por assunto','questões ENEM '+t+' '+nm+' resolução comentada']];return '<h3>📚 Pratique para UECE e ENEM</h3><p class="x-mut">Escolha a prova desejada. Estes links pesquisam exercícios externos e não representam questões já verificadas ou incorporadas ao app.</p><div class="k-res">'+searches.map(function(x){return '<a class="k-ra" href="'+gg(x[1])+'" target="_blank" rel="noopener"><span class="ic">🔎</span><span>'+esc(x[0])+' ↗<span class="m">'+esc(t)+'</span></span></a>'}).join('')+'<a class="k-ra" href="'+yt(t+' questões UECE ENEM resolvidas')+'" target="_blank" rel="noopener"><span class="ic">🎥</span><span>Videoaulas com exercícios resolvidos ↗</span></a></div>'}
function qPage(id,t,back,own,head){build();var w=byId(id),r={k:[],L:[]},mine=own?QB.filter(own):[];KUI._hl=[];
  var h='<button class="x-b x-back" onclick="'+back+'">← Voltar</button><p class="x-tag" style="margin-top:10px">'+(w?(w.icone||'')+' '+esc(w.nome):'')+'</p><h2 style="margin-top:4px">Questões sobre: '+esc(t)+'</h2>'
  +'<div class="k-note">As questões desta seção são <b>autorais e vinculadas ao tópico selecionado</b>. Não são retiradas de provas oficiais. Para estudar para a UECE ou o ENEM, use as opções de busca e as provas oficiais abaixo. 💗</div>'
  +(head||'')+'<div id="k-real" style="margin-top:14px"></div>'
  +(mine.length?'<h3>📝 Questões deste assunto ('+mine.length+')</h3><div class="k-list">'+mine.map(function(o){return qCard(o)}).join('')+'</div>':'')
  +(r.L.length?'<h3>🧩 Mais questões relacionadas ('+r.L.length+')</h3><p class="x-mut">Encontradas em outras partes de '+esc(w?w.nome:'')+' pelas palavras-chave: '+r.k.map(esc).join(', ')+'</p><div class="k-list">'+r.L.map(function(o){return qCard(o,r.k)}).join('')+'</div>':'')
  +(!mine.length&&!r.L.length?'<div class="k-card k-q"><p>Ainda não há questões do app ligadas a este assunto. Use as provas oficiais e as buscas abaixo. 🌱</p></div>':'')
  +extHTML(t,w);
  show(h,'home');mark('quest');realHTML(id,function(x){var el=document.getElementById('k-real');if(el)el.innerHTML=x})}
UI.qAssunto=function(id,i){var t=(PG[id]||[])[i]||'';qPage(id,t,'UI.assunto(\''+id+'\','+i+')',function(o){return o.w===id&&o.ti===i})};
UI.qFase=function(id,fi){var w=byId(id),f=w&&w.fases[fi];if(!f)return;qPage(id,f.titulo,'UI.topic(\''+id+'\','+fi+')',function(o){return o.w===id&&o.fi===fi})};

/* ---------- botão no fim de cada assunto ---------- */
var qb=function(fn,t){return'<div class="k-qbtn"><div class="t"><b>🎯 Terminou este assunto?</b><small>Ache questões '+DAX()+' sobre “'+esc(t)+'”: do app (com resolução), das provas oficiais e na internet.</small></div><button class="k-btn" onclick="'+fn+'">Buscar questões '+DAX()+' sobre este assunto '+AR+'</button></div>'};
var app=function(){return document.getElementById('app')};
wrap('assunto','materias',function(id,i){try{localStorage.setItem(LAST,JSON.stringify({id:id,i:i}))}catch(e){}var a=app();if(a)a.insertAdjacentHTML('beforeend',qb('UI.qAssunto(\''+id+'\','+i+')',(PG[id]||[])[i]||''));
  var ok=a&&a.querySelector('.x-as-ok');if(ok&&ok.classList.contains('on'))ok.insertAdjacentHTML('afterend',' <button class="x-b k-asq" onclick="UI.qAssunto(\''+id+'\','+i+')">🎯 Buscar questões '+DAX()+'</button>')});
var _t=UI.topic;UI.topic=function(id,fi){var r=_t.apply(this,arguments);mark('materias');var w=byId(id),a=app();if(a&&w&&w.fases[fi])a.insertAdjacentHTML('beforeend',qb('UI.qFase(\''+id+'\','+fi+')',w.fases[fi].titulo));return r};
var toastEl=document.createElement('div');toastEl.className='k-toast';toastEl.setAttribute('role','status');document.body.appendChild(toastEl);var TT=0;
function toast(h){toastEl.innerHTML=h;toastEl.classList.add('on');clearTimeout(TT);TT=setTimeout(function(){toastEl.classList.remove('on')},7000)}
KUI.toastOff=function(){toastEl.classList.remove('on')};
function onDone(id,i){var p=P();if(!(p.t&&p.t[id+':'+i]))return;toast('<span>Assunto marcado como estudado! 💗</span><button onclick="KUI.toastOff();UI.qAssunto(\''+id+'\','+i+')">Buscar questões '+DAX()+'</button>')}
var _as=UI.asTick;if(_as)UI.asTick=function(id,i,el){var r=_as.apply(this,arguments);onDone(id,i);var a=app(),b=a&&a.querySelector('.k-asq');var p=P();
  if(p.t&&p.t[id+':'+i]){if(!b&&el)el.insertAdjacentHTML('afterend',' <button class="x-b k-asq" onclick="UI.qAssunto(\''+id+'\','+i+')">🎯 Buscar questões '+DAX()+'</button>')}else if(b)b.remove();return r};
var _tk=UI.tick;if(_tk)UI.tick=function(id,i){var r=_tk.apply(this,arguments);onDone(id,i);return r};

/* ---------- página Questões ---------- */
UI.questoes=function(){build();var t=track(),p=P();
  var h='<h2>📝 Questões</h2><p class="x-mut">Escolha um assunto para ver as questões dele, ou use a busca lá em cima.</p>'
  +'<div class="k-res">'+(p.e&&p.e.length?'<button class="k-ra" onclick="UI.errors()"><span class="ic">📒</span><span><b>Caderno de erros</b><span class="m">'+p.e.length+' para revisar</span></span></button>':'')
  +'<button class="k-ra" onclick="UI.provas()"><span class="ic">🏫</span><span><b>Questões reais: provas oficiais '+DAX()+'</b><span class="m">Com gabarito oficial</span></span></button>'
  +'<button class="k-ra" onclick="UI.sim()"><span class="ic">✅</span><span><b>Simulado misturado</b><span class="m">10, 20 ou 40 questões</span></span></button></div>'
  +'<h3>Por matéria e assunto</h3><div class="k-list">'+trIds(t).map(function(id){var w=byId(id),pg=PG[id]||[];if(!pg.length)return'';
    return'<details class="x-card"><summary style="cursor:pointer;font-weight:600">'+(w.icone||'')+' '+esc(w.nome)+' <span class="x-mut">· '+pg.length+' assuntos</span></summary><div class="k-res" style="margin-top:10px">'
    +pg.map(function(x,i){var n=QB.filter(function(o){return o.w===id&&o.ti===i}).length;return'<button class="k-ra" onclick="UI.qAssunto(\''+id+'\','+i+')"><span>'+esc(x)+'<span class="m">'+(n?n+' questões do app + provas oficiais':'provas oficiais e buscas')+'</span></span></button>'}).join('')+'</div></details>'}).join('')+'</div>';
  show(h,'home');mark('quest')};

/* ---------- BUSCA da barra de cima ---------- */
UI.busca=function(q){build();var qs=norm(q).split(/\s+/).filter(function(x){return x.length>=2});if(!qs.length)return;
  var m=function(n){return qs.every(function(x){return n.indexOf(x)>-1})};
  var A=TOP.filter(function(o){return m(o.n)}).slice(0,25);
  var Q=QB.filter(function(o){return m(o.n+' '+norm(o.tt))}).slice(0,40);
  idx(function(L){var PV=L.filter(function(p){return m(norm(p.nome+' '+p.exame+' '+p.ano+' prova'))});
    var h='<h2>Resultados para “'+esc(q)+'”</h2>'
    +'<h3>📚 Assuntos ('+A.length+')</h3>'+(A.length?'<div class="k-res">'+A.map(function(o){var fn=o.pr?'UI.topic(\''+o.id+'\','+o.fi+')':'UI.assunto(\''+o.id+'\','+o.i+')';
       return'<div class="k-ra" style="cursor:default"><span class="ic">'+(o.w.icone||'📖')+'</span><span style="flex:1"><button class="k-lnk" style="text-align:left;white-space:normal;padding:0;color:inherit;font-weight:600" onclick="'+fn+'">'+esc(o.t)+'</button><span class="m">'+esc(o.w.nome)+(o.pr?' · tópico de prática':' · conteúdo oficial')+'</span></span>'
       +(o.pr?'<button class="x-b" onclick="UI.qFase(\''+o.id+'\','+o.fi+')">Questões</button>':'<button class="x-b" onclick="UI.qAssunto(\''+o.id+'\','+o.i+')">Questões</button>')+'</div>'}).join('')+'</div>':'<p class="x-mut">Nenhum assunto com esse nome.</p>')
    +(PV.length?'<h3>📄 Provas ('+PV.length+')</h3><div class="k-res">'+PV.map(function(p){return'<button class="k-ra" onclick="UI.prova(\''+p.id+'\')"><span class="ic">📄</span><span><b>'+esc(p.nome)+'</b><span class="m">'+p.questoes+' questões · prova oficial com gabarito</span></span></button>'}).join('')+'</div>':'')
    +'<h3>📝 Questões ('+Q.length+(Q.length===40?'+':'')+')</h3><p class="x-mut">Questões do app, no estilo UECE, com resolução.</p>'+(Q.length?'<div class="k-list">'+Q.map(function(o){return qCard(o,qs)}).join('')+'</div>':'<p class="x-mut">Nenhuma questão do app com essas palavras.</p>')
    +extHTML(q,null);
    KUI._hl=qs;var inp=document.getElementById('k-q'),had=document.activeElement===inp;UI._show(h,'home');mark('quest');if(had)inp.focus()})};
var inp=document.getElementById('k-q'),DT=0;
inp.addEventListener('input',function(){inp.parentNode.classList.toggle('has',!!inp.value);clearTimeout(DT);var v=inp.value.trim();if(v.length<2)return;DT=setTimeout(function(){UI.busca(v)},300)});
inp.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();clearTimeout(DT);var v=inp.value.trim();if(v.length>=2)UI.busca(v);inp.blur()}});

/* ---------- Desempenho e Configurações ---------- */
UI.desempenho=function(){var s=stats(),p=P(),ex=jget(EXK,{}),fe=0,fo=0,pr=jget('agatha-provas',{}),np=0;
  Object.keys(ex).forEach(function(k){fe+=Object.keys(ex[k]).length});Object.keys(pr).forEach(function(k){if(pr[k]&&pr[k].fim)np++});
  var rows=trIds(s.t).map(function(id){var w=byId(id),pg=PG[id]||[],c=pg.filter(function(_,i){return p.t&&p.t[id+':'+i]}).length,pc=pg.length?Math.round(c/pg.length*100):0;
    return'<div class="x-pm" style="display:grid;grid-template-columns:minmax(0,1fr) 2fr auto;gap:10px;align-items:center;margin:8px 0"><span>'+(w.icone||'')+' '+esc(w.nome)+'</span><div class="x-bar"><i style="width:'+pc+'%"></i></div><b>'+c+'/'+pg.length+'</b></div>'}).join('');
  show('<h2>📊 Desempenho</h2><div class="k-row4" style="grid-template-columns:1.6fr 1fr 1fr 1fr"><div class="k-card k-prog"><div class="k-ring" style="--p:'+s.pct+'"><b>'+s.pct+'%</b></div><div><h3>Tópicos estudados</h3><p>'+s.chk+' de '+s.tot+' ('+(s.t==='enem'?'ENEM':'UECE')+')</p></div></div>'
   +'<div class="k-tile" style="cursor:default">'+s.a+'<small style="display:block">questões respondidas</small></div><div class="k-tile" style="cursor:default">'+s.ac+'%<small style="display:block">de acerto</small></div><div class="k-tile" style="cursor:default">'+np+'<small style="display:block">provas corrigidas</small></div></div>'
   +'<h3>Por matéria</h3><div class="x-card">'+rows+'</div><p class="x-mut">Exercícios por assunto respondidos: '+fe+'.</p>'
   +'<div class="x-row x-mt"><button class="x-b x-p" onclick="UI.errors()">📒 Caderno de erros ('+((p.e||[]).length)+')</button><button class="x-b" onclick="UI.salvar()">💾 Meu progresso e backup</button></div>','home');mark('desemp')};
UI.config=function(){var d=document.documentElement.dataset.theme==='dark';
  show('<h2>⚙️ Configurações</h2><div class="k-set">'
   +'<button class="k-ra" onclick="KUI.theme()"><span>'+(d?'☀️ Modo claro':'🌙 Modo escuro')+'</span><span class="m">Tema</span></button>'
   +'<button class="k-ra" onclick="UI.paz(1)"><span>🌸 Momento de paz</span><span class="m">Respira fundo</span></button>'
   +'<button class="k-ra" onclick="UI.timer()"><span>⏱ Cronômetro</span><span class="m">Foco e provas</span></button>'
   +'<button class="k-ra" onclick="UI.myfc(\'\')"><span>🗂️ Meus flashcards</span><span class="m">Todas as matérias</span></button>'
   +'<button class="k-ra" onclick="UI.salvar()"><span>💾 Meu progresso e backup</span><span class="m">Baixar ou restaurar</span></button>'
   +'<button class="k-ra" onclick="UI.code()"><span>🔑 Código de progresso</span><span class="m">Copiar ou carregar</span></button>'
   +'<div class="k-ra" style="cursor:default"><span>🎯 Trilha</span><span>'+Object.keys(TR).map(function(k){return'<button class="x-b" aria-pressed="'+(track()===k)+'" onclick="UI.track(\''+k+'\')">'+esc(TR[k].nome)+'</button>'}).join(' ')+'</span></div>'
   +'</div>','home');mark('cfg')};
KUI.theme=function(){if(UI.theme)UI.theme();try{localStorage.setItem('hark-theme',document.documentElement.dataset.theme)}catch(e){}UI.config()};
addEventListener('keydown',function(e){if(e.key==='Escape')KUI.drawer(0)});
UI.dash();
})();

(function(){var st=document.createElement('style');st.textContent='.k-diagram{background:#faf7fc;border:1px solid #e4d9e9;border-radius:14px;padding:10px;margin:14px 0}.k-diagram svg{display:block;width:100%;height:auto;max-height:220px}.k-diagram figcaption{color:#65576b;font-size:12px;line-height:1.5;margin:6px 2px 0}';document.head.appendChild(st)})();
