(function(){
if(!window.UI)return;
var original=UI.prova;
var state={id:null,q:1,from:1,to:85,p:null,mat:null};
function render(){
 var host=document.getElementById('ag-focus-quiz');if(!host||!state.p)return;
 var p=state.p,q=state.q,selected=(JSON.parse(localStorage.getItem('agatha-provas')||'{}')[state.id]||{}).r||{};
 var letter='ABCDE',n=p.alts||4;
 host.innerHTML='<div class="ag-focus-top"><span>'+p.nome+' · Questão '+q+' de '+state.to+'</span><span>'+(Object.keys(selected).length)+'/'+p.questoes+' respondidas</span></div><div class="ag-focus-progress"><i style="width:'+Math.round(100*(q-state.from+1)/(state.to-state.from+1))+'%"></i></div><p class="ag-focus-help">Leia a questão na imagem do caderno acima e escolha sua resposta.</p><div class="ag-focus-options">'+letter.slice(0,n).split('').map(function(a){return '<button type="button" class="ag-focus-option'+(selected[q]===a?' chosen':'')+'" data-answer="'+a+'"><b>'+a+'</b><span>Alternativa '+a+'</span></button>'}).join('')+'</div><div class="ag-focus-nav"><button type="button" id="ag-prev">← Anterior</button><button type="button" id="ag-next">'+(q===state.to?'Ver respostas':'Próxima →')+'</button></div><button class="ag-focus-finish" type="button" id="ag-finish">Finalizar e corrigir</button>';
 host.querySelectorAll('[data-answer]').forEach(function(b){b.onclick=function(){var card=document.querySelector('.x-crq button[data-q="'+q+'"][data-a="'+b.dataset.answer+'"]');if(card){card.click()}else{var storage=JSON.parse(localStorage.getItem('agatha-provas')||'{}');storage[state.id]=storage[state.id]||{r:{},ini:Date.now()};storage[state.id].r[q]=b.dataset.answer;localStorage.setItem('agatha-provas',JSON.stringify(storage))}render()}});
 host.querySelector('#ag-prev').onclick=function(){move(-1)};
 host.querySelector('#ag-next').onclick=function(){if(q===state.to){document.querySelector('.x-cr')?.classList.toggle('ag-focus-hidden');return}move(1)};
 host.querySelector('#ag-finish').onclick=function(){UI.pFim(state.id)};
}
function move(d){state.q=Math.max(state.from,Math.min(state.to,state.q+d));var pg=state.p.q2p&&state.p.q2p[state.q];if(pg&&window.UI.provaPagina){var lbl=document.getElementById('x-page-label');var current=lbl&&parseInt((lbl.textContent.match(/\d+/)||[])[0],10);if(current&&current!==pg)UI.provaPagina(pg-current)}render();document.getElementById('x-page-image')?.scrollIntoView({behavior:'smooth',block:'start'})}
UI.prova=function(id,mat){
 original.apply(this,arguments);
 var attempts=0;function attach(){
 var grid=document.querySelector('#app .x-cr');var page=document.getElementById('x-page-image');
 if(!grid||!page){if(attempts++<45)setTimeout(attach,120);return}
 
 fetch('provas/index.json').then(function(r){return r.json()}).then(function(all){
 var p=all.find(function(v){return v.id===id});if(!p||!document.getElementById('x-page-image'))return;
 var m=mat!=null&&p.materias?p.materias[mat]:null;
 state={id:id,q:m?m.de:1,from:m?m.de:1,to:m?m.ate:p.questoes,p:p,mat:mat};
 grid.classList.add('ag-focus-hidden');var box=document.createElement('section');box.id='ag-focus-quiz';box.className='ag-focus-quiz';grid.parentNode.insertBefore(box,grid);render();
 }).catch(function(){});
 }attach();
};
var st=document.createElement('style');st.textContent='.ag-focus-hidden{display:none!important}.ag-focus-quiz{max-width:780px;margin:16px auto;padding:18px;background:#fff;color:#29232d;border-radius:20px;box-shadow:0 6px 24px #0002}.ag-focus-top{display:flex;justify-content:space-between;gap:12px;font-size:13px;font-weight:700}.ag-focus-progress{height:7px;background:#ece8ee;border-radius:20px;margin:14px 0 20px;overflow:hidden}.ag-focus-progress i{display:block;height:100%;background:#79d6b0}.ag-focus-help{font-size:15px;margin:12px 0 18px}.ag-focus-options{display:grid;gap:10px}.ag-focus-option{background:#fff;border:1px solid #dcd7df;border-radius:24px;padding:12px;display:flex;align-items:center;gap:14px;color:#29232d;text-align:left;font-size:15px}.ag-focus-option b{display:grid;place-items:center;border-radius:50%;width:32px;height:32px;background:#f2eff3}.ag-focus-option.chosen{border:2px solid #79d6b0;background:#e3f8ee}.ag-focus-option.chosen b{background:#79d6b0}.ag-focus-nav{display:flex;gap:10px;margin-top:20px}.ag-focus-nav button{flex:1;padding:13px;border:1px solid #888;border-radius:25px;background:white;color:#222;font-weight:700}.ag-focus-finish{display:block;width:100%;margin-top:12px;border:0;border-radius:22px;padding:13px;background:#ef7791;color:#fff;font-weight:700}.x-page-controls{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.x-page-controls .x-b{flex:1}@media(max-width:650px){.ag-focus-quiz{padding:14px}.x-official-pages img,#x-page-image img{width:100%}.x-cr{margin-top:12px}}';document.head.appendChild(st);
})();