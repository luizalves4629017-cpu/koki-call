(function(){
'use strict';
if(!window.UI)return;
var root=document.getElementById('app'), oldHome=UI.home;
var clock={left:25*60,running:false,handle:null};
function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function nav(){return '<nav class="ag-nav" aria-label="Navegação principal"><button onclick="UI.home()">⌂<small>Início</small></button><button onclick="UI.agMaterias()">▤<small>Matérias</small></button><button onclick="UI.provas()">▣<small>Provas</small></button><button onclick="UI.redacao()">✎<small>Redação</small></button><button onclick="UI.timer()">◷<small>Foco</small></button></nav>'}
UI.agMaterias=function(){oldHome();var a=document.getElementById('app');var cards=Array.from(a.querySelectorAll('button.x-sc[onclick*="UI.subj"]'));var tabs=a.querySelector('.x-seg');var nodes=cards.map(function(c){return c.outerHTML}).join('');a.innerHTML='<section class="ag-home"><h2>Suas matérias 📚</h2><p>Escolha uma matéria para continuar os estudos.</p>'+(tabs?tabs.outerHTML:'')+'<div class="ag-subjects">'+nodes+'</div></section>'+nav()};
UI.home=function(){
 oldHome();
 var a=document.getElementById('app'),cards=Array.from(a.querySelectorAll('button.x-sc[onclick*="UI.subj"]'));var seen={};cards=cards.filter(function(b){var key=b.getAttribute('onclick');if(seen[key])return false;seen[key]=true;return true});
 var subjects=cards.slice(0,4).map(function(c){return c.outerHTML}).join('');
 var now=new Date(),exam=new Date('2026-12-06T08:00:00-03:00'),days=Math.max(0,Math.ceil((exam-now)/86400000));
 var title=now<exam?'Faltam <b>'+days+' dias</b> para a UECE':'Seu caminho de estudos continua';
 a.innerHTML='<section class="ag-home"><div class="ag-welcome"><h2>Oi, Ágatha 🌸</h2><button class="ag-avatar" onclick="UI.salvar()" aria-label="Meu progresso">🌷</button></div><div class="ag-countdown"><span>'+title+'<small>2ª fase · 6 de dezembro de 2026</small></span><span class="ag-countdown-flower">✿</span></div><h3>Seu ritmo de estudos</h3><div class="ag-week"><span>Seg 🔥</span><span>Ter 🔥</span><span>Qua 🔥</span><span>Qui 🔥</span><span>Sex 🔥</span></div><article class="ag-today"><small>SEU MOMENTO DE ESTUDAR</small><h3>Vamos estudar hoje?</h3><p>Escolha uma matéria ou comece uma sessão de concentração.</p><button onclick="UI.agMaterias()">Começar a estudar</button></article><div class="ag-section-title"><h3>Matérias</h3><button onclick="UI.agMaterias()">Ver todas →</button></div><div class="ag-subjects">'+subjects+'</div><button class="ag-focus-shortcut" onclick="UI.timer()">◷ Iniciar modo foco · 25 minutos</button></section>'+nav();
};
function fmt(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function drawClock(){var t=document.getElementById('ag-clock');if(!t)return;t.textContent=fmt(clock.left);var ring=document.getElementById('ag-ring');if(ring)ring.style.setProperty('--progress',(100*(1-clock.left/1500))+'%');var b=document.getElementById('ag-clock-toggle');if(b)b.textContent=clock.running?'Pausar':'Começar'}
UI.agClockToggle=function(){clock.running=!clock.running;if(clock.handle)clearInterval(clock.handle);if(clock.running)clock.handle=setInterval(function(){if(clock.left>0)clock.left--;else{clock.running=false;clearInterval(clock.handle)}drawClock()},1000);drawClock()};
UI.agClockAdd=function(){clock.left+=300;drawClock()};
UI.agClockReset=function(){clock.running=false;if(clock.handle)clearInterval(clock.handle);clock.left=1500;drawClock()};
UI.timer=function(){
 root.innerHTML='<section class="ag-focus-screen"><button class="ag-focus-back" onclick="UI.home()">← Início</button><h2>Modo foco</h2><div class="ag-clock-ring" id="ag-ring"><strong id="ag-clock">25:00</strong></div><div class="ag-clock-actions"><button id="ag-clock-toggle" onclick="UI.agClockToggle()">Começar</button><button onclick="UI.agClockAdd()">+5 min</button></div><article class="ag-focus-card"><b>Agora: seu momento de concentração</b><p>Estude uma matéria por vez, sem distrações.</p><div class="ag-focus-bar"><i></i></div></article><article class="ag-focus-card"><b>Próxima etapa</b><p>Resolva exercícios ou faça uma prova.</p><button onclick="UI.provas()">Abrir provas →</button></article><button class="ag-reset" onclick="UI.agClockReset()">Reiniciar cronômetro</button></section>'+nav();drawClock();
};
var css=document.createElement('style');css.textContent=`
html:not(.ag-ready) #app{visibility:hidden}
html.ag-ready #app{visibility:visible}
.x-head,.x-ics,.foot,.k-side,.k-top,.k-bnav,.k-ov{display:none!important}.k-mainw,.page,.wrap,main,.main{margin-left:0!important;width:100%!important;max-width:none!important;min-width:0!important}.k-mainw{display:block!important}.page{padding:0!important}body{background:#f9edf0!important}#app{width:100%!important}
#app{max-width:900px;margin:0 auto;padding-bottom:94px}
.ag-home{max-width:680px;margin:0 auto;padding:16px 4px 30px;color:#4a253a}
.ag-welcome{display:flex;justify-content:space-between;align-items:center}
.ag-welcome h2{font-size:clamp(24px,4vw,32px);margin:12px 0 18px;color:#4b2037}
.ag-avatar{border:0;background:#f8e4e8;border-radius:50%;width:46px;height:46px;font-size:23px}
.ag-countdown{background:linear-gradient(120deg,#bd7c8d,#d7a1a5);color:white;padding:24px;border-radius:24px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 10px 22px #8a536338;font-size:23px;line-height:1.25}
.ag-countdown small{display:block;font-size:12px;margin-top:9px;opacity:.95}
.ag-countdown-flower{font-size:64px;opacity:.7}
.ag-home h3{font-size:17px;margin:22px 0 12px;color:#50273e}
.ag-week{display:flex;gap:7px;justify-content:space-between}
.ag-week span{flex:1;text-align:center;padding:12px 4px;background:#f5e3e6;border-radius:14px;color:#573044;font-size:13px}
.ag-today{background:#fff;border-radius:22px;padding:22px;margin-top:20px;box-shadow:0 4px 18px #7a50621c;color:#382936}
.ag-today small{color:#a66b90;font-size:11px;letter-spacing:.1em}
.ag-today h3{margin:9px 0}
.ag-today p{color:#665665}
.ag-today button,.ag-focus-shortcut{border:0;border-radius:12px;padding:13px;background:#69314d;color:white;width:100%;font-weight:700}
.ag-section-title{display:flex;justify-content:space-between;align-items:center}
.ag-section-title button{border:0;background:none;color:#9d5175}
.ag-subjects{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.ag-subjects .x-sc{margin:0!important;width:100%;min-width:0;border:1px solid #eedce5!important;border-radius:15px!important;background:#fff!important;color:#513047!important;padding:14px!important;display:flex!important;flex-direction:column;align-items:flex-start;text-align:left;gap:8px}
.ag-subjects .x-sc .x-sn{color:#513047!important}
.ag-subjects .x-sc .x-bar{width:100%}
.ag-focus-shortcut{margin-top:20px;background:#805b9f}
.ag-nav{position:fixed;z-index:100;bottom:0;left:0;right:0;display:flex;justify-content:space-around;background:#fff;color:#64455b;border-top:1px solid #eadfe6;padding:8px 8px calc(8px + env(safe-area-inset-bottom));box-shadow:0 -5px 22px #0001}
.ag-nav button{border:0;background:transparent;color:#64455b;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:22px;min-width:55px}
.ag-nav small{font-size:11px}
.ag-focus-screen{background:#10152c;color:#fff;border-radius:24px;min-height:80vh;padding:24px 18px 110px;text-align:center;max-width:680px;margin:auto}
.ag-focus-screen h2{font-size:24px;color:#fff;margin:22px 0}
.ag-focus-back{display:block;background:none;border:0;color:#eee}
.ag-clock-ring{width:min(75vw,300px);height:min(75vw,300px);margin:30px auto;border-radius:50%;display:grid;place-items:center;background:radial-gradient(closest-side,#10152c 91%,transparent 92%),conic-gradient(#aa8cff var(--progress,0%),#343650 0);box-shadow:0 0 35px #8d73f04d}
.ag-clock-ring strong{font-size:clamp(40px,8vw,62px);font-variant-numeric:tabular-nums}
.ag-clock-actions{display:flex;justify-content:center;gap:10px;margin-bottom:28px}
.ag-clock-actions button{border:0;background:#ab90f5;color:#fff;border-radius:30px;padding:12px 22px}
.ag-clock-actions button+button{background:#c6a6c7;color:#292036}
.ag-focus-card{text-align:left;border:1px solid #54516c;background:#ffffff12;border-radius:18px;padding:18px;margin:15px 0}
.ag-focus-card p{color:#d7d5e1}
.ag-focus-card button{border:0;background:#a58de4;padding:10px;border-radius:10px}
.ag-focus-bar{height:12px;border-radius:10px;background:#5b536b;overflow:hidden}
.ag-focus-bar i{display:block;width:40%;height:100%;background:linear-gradient(90deg,#aa8cff,#f5b6cf)}
.ag-reset{background:none;border:0;color:#c9bde5;margin:15px}
@media(min-width:900px){.ag-nav{left:50%;transform:translateX(-50%);max-width:720px;border-radius:20px 20px 0 0}}
`;document.head.appendChild(css);
UI.dash=function(){UI.home()};
UI.home();document.documentElement.classList.add('ag-ready');
})();