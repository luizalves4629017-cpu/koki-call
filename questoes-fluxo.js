/* ===== Fluxo de questões: uma por vez, com foto, resolução passo a passo e questões abertas =====
   Usa os exercícios de cada assunto (window.CONT) + questões abertas de questoes-fluxo-dados.js.
   Respostas de múltipla escolha continuam em "agatha-exercicios" ({"materia:assunto":{indice:alternativa}}),
   compatível com o backup e com o placar antigo. Rascunhos, posição e respostas escritas ficam em "agatha-questoes". */
(function(){
var UI=window.UI;if(!UI||!UI.assunto)return;
var DADOS=window.QF_DADOS||{img:{},abertas:[]};
var D=window.GAME_DATA||{},PG=D.programa||{};
var EXK='agatha-exercicios',QK='agatha-questoes',LET='ABCDE';
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var nl=function(s){return esc(s).replace(/\n/g,'<br>')};
function jget(k,d){try{var v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}}
function jput(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function store(){var s=jget(QK,{});if(!s||typeof s!=='object')s={};s.pos=s.pos||{};s.sel=s.sel||{};s.open=s.open||{};s.aberto=s.aberto||{};return s}
function W(id){return(D.worlds||[]).find(function(w){return w.id===id})}
function mcOf(id,i){var c=((window.CONT||{})[id]||[])[i];if(c&&c.exercicios&&c.exercicios.length)return c.exercicios;
  var w=W(id),ex=[];((w&&w.fases)||[]).forEach(function(f){ex=ex.concat((f.questions||[]).map(function(q){return{q:q.q,a:q.a,c:q.c,res:q.exp}}))});return ex.slice(0,8)}
function lista(id,i){var L=mcOf(id,i).map(function(q,k){return{tipo:'mc',k:k,q:q}});
  (DADOS.abertas||[]).forEach(function(a){if(a.w===id&&a.ti===i)L.push({tipo:'ab',a:a})});return L}
function imgOf(id,i,item){var k=item&&item.tipo==='ab'?item.a.img:(id+':'+i);return(DADOS.img||{})[k]||null}

/* separa "Leia: '...'" em texto-base + enunciado */
function textoBase(q){q=String(q||'');var m=q.match(/^(Leia(?:\s+(?:o|os|a|as)\s+[^:]{1,30})?\s*:)\s*/i);if(!m)return null;
  var rest=q.slice(m[0].length),o=rest.charAt(0),close={'"':'"',"'":"'",'“':'”','‘':'’'}[o];if(!close)return null;
  var re=new RegExp('\\'+close+'(?=[.,;:]?\\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])','g'),mm,end=-1;re.lastIndex=1;mm=re.exec(rest);if(mm)end=mm.index;
  if(end<0)return null;var base=rest.slice(1,end),enun=rest.slice(end+1).replace(/^[.,;:]?\s+/,'');
  if(base.length<15||enun.length<6)return null;return{base:base,q:enun}}

/* resolução em passos numerados, a partir da explicação do exercício */
var ABREV=/(?:\b(?:a\.C|d\.C|Sr|Sra|Dr|Dra|ex|p|etc|séc|aprox|nº|n|km|cm|min|vs|EUA|S\.A)\.)$/i;
function frases(t){t=String(t||'').replace(/\s+/g,' ').trim();if(!t)return[];
  if(/(?:Passo|Etapa)\s+\d+\s*:/i.test(t))return t.split(/(?=(?:Passo|Etapa)\s+\d+\s*:)/i).map(function(p){return p.replace(/^(?:Passo|Etapa)\s+\d+\s*:\s*/i,'').trim()}).filter(Boolean);
  var out=[],cur='',re=/[.!?](?=\s+["“(]?[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9])/g,last=0,m;
  while((m=re.exec(t))){var piece=t.slice(last,m.index+1);if(ABREV.test((cur+piece).trim())){cur+=piece;last=m.index+1;continue}
    out.push((cur+piece).trim());cur='';last=m.index+1}
  var tail=(cur+t.slice(last)).trim();if(tail)out.push(tail);return out}
function passosMC(q){var p=frases(q.res);p.push('Resposta: letra '+LET[q.c]+' — '+q.a[q.c]+'.');return p}

/* ---------- desenho ---------- */
function figura(img,tipo){if(!img)return'';
  var cred=img.svg?esc(img.cred):(esc(img.cred)+(img.lic?' · '+esc(img.lic):'')+' · <a href="'+esc(img.link)+'" target="_blank" rel="noopener">Wikimedia Commons</a>');
  return'<figure class="qf-fig'+(img.svg?' qf-svg':'')+'"><img src="'+esc(img.src)+'" alt="'+esc(img.alt)+'" width="'+(img.w||640)+'" height="'+(img.h||400)+'" loading="eager" decoding="async"><figcaption><b>'+(tipo==='ab'?'Figura':'Figura do assunto')+':</b> '+esc(img.alt)+'<small>'+cred+'</small></figcaption></figure>'}
function placar(id,i,L){var ST=jget(EXK,{})||{},r=ST[id+':'+i]||{},s=store(),ok=0,fe=0,ab=0,nab=0;
  L.forEach(function(it){if(it.tipo==='mc'){if(r[it.k]!=null){fe++;if(r[it.k]===it.q.c)ok++}}else{nab++;var o=s.open[it.a.id];if(o&&o.t&&o.t.trim())ab++}});
  return{ok:ok,fe:fe,mc:L.length-nab,ab:ab,nab:nab}}
function palavras(t){t=String(t||'').trim();return t?t.split(/\s+/).length:0}

function render(id,i){
  var w=W(id),t=(PG[id]||[])[i]||'',L=lista(id,i),key=id+':'+i,s=store();
  if(!L.length){UI._show('<div class="qf"><div class="qf-head"><button class="qf-back" onclick="UI.assunto(\''+id+'\','+i+',0)">← '+esc(w?w.nome:'')+' · '+esc(t)+'</button></div><div class="qf-card"><p>Ainda não há questões neste assunto.</p></div></div>','home');return}
  var n=Math.min(Math.max(0,+s.pos[key]||0),L.length-1),it=L[n],img=imgOf(id,i,it);
  var ST=jget(EXK,{})||{},resp=(ST[key]||{});
  var h='<div class="qf" data-qf="'+esc(key)+'"><span class="ag-return" style="display:none!important"></span>'
   +'<div class="qf-head"><button class="qf-back" onclick="UI.assunto(\''+id+'\','+i+',0)" aria-label="Voltar para a aula"><span aria-hidden="true">←</span> '+esc(w?w.nome:'')+' · '+esc(t)+'</button>'
   +'<div class="qf-prog"><div class="qf-bar"><i style="width:'+((n+1)/L.length*100).toFixed(1)+'%"></i></div><span class="qf-chip">'+(it.tipo==='ab'?'Questão aberta · ':'')+'Questão '+(n+1)+' de '+L.length+'</span></div>'
   +'<div class="qf-dots" role="tablist" aria-label="Ir para a questão">'+L.map(function(x,k){var st='';if(x.tipo==='mc'&&resp[x.k]!=null)st=resp[x.k]===x.q.c?' ok':' bad';if(x.tipo==='ab'){var o=s.open[x.a.id];if(o&&o.t&&o.t.trim())st=' ab'}
      return'<button class="qf-dot'+st+(k===n?' on':'')+'" aria-label="Questão '+(k+1)+(x.tipo==='ab'?' (aberta)':'')+'" onclick="QF.ir(\''+id+'\','+i+','+k+')">'+(x.tipo==='ab'?'✎':(k+1))+'</button>'}).join('')+'</div></div>';
  h+='<article class="qf-card">'+figura(img,it.tipo);
  if(it.tipo==='mc'){var q=it.q,tb=textoBase(q.q),r=resp[it.k],done=r!=null,sel=done?r:s.sel[key+':'+it.k];
    if(tb)h+='<div class="qf-base"><small>Texto-base</small><p>'+nl(tb.base)+'</p></div>';
    h+='<p class="qf-enun">'+nl(tb?tb.q:q.q)+'</p><div class="qf-alts" role="radiogroup" aria-label="Alternativas">'
     +q.a.map(function(a,j){var c='';if(done){if(j===q.c)c=' ok';else if(j===r)c=' bad'}else if(j===sel)c=' sel';
       return'<button class="qf-alt'+c+'" role="radio" aria-checked="'+(j===sel)+'"'+(done?' disabled':'')+' onclick="QF.marcar(\''+id+'\','+i+','+it.k+','+j+')"><b>'+LET[j]+')</b><span>'+esc(a)+'</span></button>'}).join('')+'</div>';
    if(!done)h+='<button class="qf-btn qf-confirm"'+(sel==null?' disabled':'')+' onclick="QF.confirmar(\''+id+'\','+i+','+it.k+')">Confirmar resposta</button>';
    else{var acert=r===q.c,aberto=s.aberto[key+':'+it.k]!==0;
      h+='<div class="qf-res '+(acert?'ok':'bad')+'" role="status"><div class="qf-res-t">'+(acert?'✓ Você acertou!':'✗ Não foi dessa vez')+'</div><div class="qf-res-b">'+(acert?'':'<span class="qf-pill bad">Sua resposta: '+LET[r]+')</span> ')+'<span class="qf-pill ok">Correta: '+LET[q.c]+') '+esc(q.a[q.c])+'</span></div></div>'
       +'<details class="qf-steps"'+(aberto?' open':'')+' ontoggle="QF.toggle(\''+key+':'+it.k+'\',this.open)"><summary>Resolução passo a passo</summary><ol>'+passosMC(q).map(function(p){return'<li>'+nl(p)+'</li>'}).join('')+'</ol></details>'
       +'<div class="qf-gab"><b>Gabarito:</b> '+LET[q.c]+' <small>(questão autoral do app, no estilo UECE/ENEM)</small></div>';}
  }else{var a=it.a,o=s.open[a.id]||{},txt=o.t||'';
    if(a.texto)h+='<div class="qf-base"><small>Texto-base</small><p>'+nl(a.texto)+'</p></div>';
    h+='<p class="qf-enun">'+nl(a.q)+'</p><label class="qf-lab" for="qf-txt">Sua resposta</label><textarea id="qf-txt" class="qf-txt" rows="7" placeholder="Escreva aqui com suas palavras..." oninput="QF.digitar(\''+esc(a.id)+'\',this.value)">'+esc(txt)+'</textarea>'
     +'<div class="qf-cnt"><span id="qf-salvo">'+(o.ts?'Salva em '+new Date(o.ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'')+'</span><span id="qf-pal">'+palavras(txt)+' palavra'+(palavras(txt)===1?'':'s')+'</span></div>'
     +'<div class="qf-row"><button class="qf-btn alt" onclick="QF.verRes(\''+esc(a.id)+'\')">'+(o.viu?'Ocultar resolução':'Ver resolução')+'</button><button class="qf-btn" onclick="QF.salvar(\''+esc(a.id)+'\')">Salvar resposta</button></div>';
    if(o.viu){h+='<details class="qf-steps" open><summary>Resolução passo a passo</summary><ol>'+a.passos.map(function(p){return'<li>'+nl(p)+'</li>'}).join('')+'</ol></details>'
      +'<div class="qf-modelo"><b>Resposta-modelo</b><p>'+nl(a.modelo)+'</p></div>'
      +'<div class="qf-crit"><b>Confira sua resposta</b>'+a.criterios.map(function(c,k){var on=o.c&&o.c[k];return'<label><input type="checkbox"'+(on?' checked':'')+' onchange="QF.crit(\''+esc(a.id)+'\','+k+',this.checked)"> '+esc(c)+'</label>'}).join('')+'</div>';}
  }
  h+='</article><div class="qf-nav"><button class="qf-btn alt"'+(n===0?' disabled':'')+' onclick="QF.ir(\''+id+'\','+i+','+(n-1)+')">Anterior</button><button class="qf-btn" onclick="QF.ir(\''+id+'\','+i+','+(n+1)+')"'+(n>=L.length-1?' disabled':'')+'>Próxima questão</button></div>';
  var p=placar(id,i,L);
  h+='<div class="qf-sum"><b>'+p.ok+' de '+p.fe+'</b> certas'+(p.fe?' ('+Math.round(100*p.ok/p.fe)+'%)':'')+' · '+p.fe+'/'+p.mc+' respondidas'+(p.nab?' · '+p.ab+'/'+p.nab+' aberta'+(p.nab>1?'s':'')+' escrita'+(p.nab>1?'s':''):'')+'<small>Tudo fica salvo neste aparelho, mesmo se fechar o app.</small></div>'
   +'<div class="qf-row qf-more"><button class="qf-btn alt" onclick="UI.assunto(\''+id+'\','+i+',0)">📖 Rever a aula</button><button class="qf-btn alt" onclick="UI.assunto(\''+id+'\','+i+',2)">🎥 Vídeos</button>'+(UI.qAssunto?'<button class="qf-btn alt" onclick="UI.qAssunto(\''+id+'\','+i+')">🏫 Provas oficiais</button>':'')+'<button class="qf-btn alt" onclick="QF.refazer(\''+id+'\','+i+')">↺ Refazer</button></div></div>';
  UI._show(h,'home');
}
var lastKey='';
function show(id,i,keep){var y=window.scrollY||0;render(id,i);try{window.scrollTo(0,keep?y:0)}catch(e){}}
var QF=window.QF={
  render:render,
  ir:function(id,i,k){var s=store(),L=lista(id,i);s.pos[id+':'+i]=Math.max(0,Math.min(L.length-1,k));jput(QK,s);show(id,i)},
  marcar:function(id,i,k,j){var ST=jget(EXK,{})||{};if((ST[id+':'+i]||{})[k]!=null)return;var s=store();s.sel[id+':'+i+':'+k]=j;jput(QK,s);show(id,i,1)},
  confirmar:function(id,i,k){var key=id+':'+i,s=store(),j=s.sel[key+':'+k];if(j==null)return;var ST=jget(EXK,{})||{};ST[key]=ST[key]||{};if(ST[key][k]!=null)return;
    ST[key][k]=j;jput(EXK,ST);delete s.sel[key+':'+k];jput(QK,s);var q=mcOf(id,i)[k];if(UI._score&&q)UI._score(j===q.c);show(id,i,1)},
  toggle:function(k,open){var s=store();s.aberto[k]=open?1:0;jput(QK,s)},
  digitar:function(aid,v){var s=store();s.open[aid]=s.open[aid]||{};s.open[aid].t=v;s.open[aid].ed=Date.now();jput(QK,s);
    var el=document.getElementById('qf-pal');if(el){var n=palavras(v);el.textContent=n+' palavra'+(n===1?'':'s')}var sv=document.getElementById('qf-salvo');if(sv)sv.textContent='Rascunho salvo automaticamente'},
  salvar:function(aid){var s=store(),ta=document.getElementById('qf-txt');s.open[aid]=s.open[aid]||{};if(ta)s.open[aid].t=ta.value;s.open[aid].ts=Date.now();jput(QK,s);
    var sv=document.getElementById('qf-salvo');if(sv)sv.textContent='Resposta salva ✓';},
  verRes:function(aid){var s=store(),ta=document.getElementById('qf-txt');s.open[aid]=s.open[aid]||{};if(ta)s.open[aid].t=ta.value;s.open[aid].viu=s.open[aid].viu?0:1;jput(QK,s);
    var a=(DADOS.abertas||[]).find(function(x){return x.id===aid});if(a)show(a.w,a.ti,1)},
  crit:function(aid,k,on){var s=store();s.open[aid]=s.open[aid]||{};s.open[aid].c=s.open[aid].c||[];s.open[aid].c[k]=on?1:0;jput(QK,s)},
  refazer:function(id,i){if(window.confirm&&!window.confirm('Apagar as respostas de múltipla escolha deste assunto e começar de novo? (As respostas escritas continuam salvas.)'))return;
    var key=id+':'+i,ST=jget(EXK,{})||{};ST[key]={};jput(EXK,ST);var s=store();s.pos[key]=0;Object.keys(s.sel).forEach(function(k){if(k.indexOf(key+':')===0)delete s.sel[k]});jput(QK,s);show(id,i)}
};
/* a aba "Exercícios" (tab 1) de cada assunto passa a usar o novo fluxo */
var prev=UI.assunto;
UI.assunto=function(id,i,tab){if(tab===1){try{render(id,i);try{window.scrollTo(0,0)}catch(e){}try{localStorage.setItem('agatha-ultimo-assunto',JSON.stringify({id:id,i:i}))}catch(e){}return}catch(e){console.warn('Fluxo de questões:',e)}}return prev.apply(this,arguments)};
UI.asMove=function(id,i,d){var s=store();QF.ir(id,i,(+s.pos[id+':'+i]||0)+d)};
UI.asResp=function(id,i,k,j){var s=store();s.sel[id+':'+i+':'+k]=j;jput(QK,s);QF.confirmar(id,i,k)};
UI.asReset=function(id,i){QF.refazer(id,i)};

var css=document.createElement('style');css.textContent=[
'.qf{--qf-w:#6e2346;--qf-wd:#561a37;--qf-pk:#f6e3ea;--qf-ink:#2f2433;max-width:680px;margin:0 auto;padding:0 10px;color:var(--qf-ink);font-size:16px;line-height:1.55}',
'.qf *{box-sizing:border-box}',
'.qf-head{background:linear-gradient(180deg,#efc9cf,#f6dde2);margin:0 -10px;padding:14px 14px 18px;border-radius:0 0 22px 22px}',
'.qf-back{display:flex;align-items:center;gap:8px;background:none;border:0;color:var(--qf-wd);font-weight:700;font-size:18px;padding:6px 2px;cursor:pointer;text-align:left;line-height:1.3;width:100%;overflow-wrap:anywhere}',
'.qf-back span{font-size:22px}',
'.qf-prog{display:flex;align-items:center;gap:10px;margin:10px 0 6px}',
'.qf-bar{flex:1;height:6px;border-radius:6px;background:#ffffffa8;overflow:hidden}.qf-bar i{display:block;height:100%;background:var(--qf-w);border-radius:6px}',
'.qf-chip{flex:none;background:#fff;color:var(--qf-wd);border-radius:999px;padding:5px 12px;font-size:13px;font-weight:700;box-shadow:0 2px 8px #6e234620;white-space:nowrap}',
'.qf-dots{display:flex;gap:6px;overflow-x:auto;padding:6px 2px 2px;scrollbar-width:none}.qf-dots::-webkit-scrollbar{display:none}',
'.qf-dot{flex:none;min-width:34px;height:34px;border-radius:50%;border:1.5px solid #d9aebe;background:#fff;color:var(--qf-wd);font-weight:700;font-size:13px;cursor:pointer}',
'.qf-dot.on{outline:3px solid var(--qf-w);outline-offset:1px}.qf-dot.ok{background:#2f8a4e;border-color:#2f8a4e;color:#fff}.qf-dot.bad{background:#c2413b;border-color:#c2413b;color:#fff}.qf-dot.ab{background:#f3d3df;border-color:var(--qf-w)}',
'.qf-card{background:#fff;border-radius:22px;box-shadow:0 6px 24px #6e234618;padding:14px;margin:-4px 0 14px;position:relative}',
'.qf-fig{margin:0 0 12px;border-radius:16px;overflow:hidden;background:#f7eef2}',
'.qf-fig img{display:block;width:100%;height:auto;max-height:46vh;object-fit:contain;background:#f7eef2}',
'.qf-svg img{background:#fff8fb}',
'.qf-fig figcaption{padding:8px 12px 10px;font-size:13px;color:#5b4a58;line-height:1.4}',
'.qf-fig figcaption small{display:block;margin-top:2px;font-size:11.5px;color:#8a7a86}.qf-fig figcaption a{color:#8a4a6a}',
'.qf-base{background:#fbf4f7;border-left:4px solid #d59ab4;border-radius:12px;padding:10px 14px;margin:0 0 12px}',
'.qf-base small{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a5a73;font-weight:700}.qf-base p{margin:4px 0 0;font-style:italic}',
'.qf-enun{font-size:17.5px;font-weight:600;margin:4px 2px 14px;overflow-wrap:anywhere}',
'.qf-alts{display:flex;flex-direction:column;gap:10px}',
'.qf-alt{display:flex;gap:8px;align-items:flex-start;width:100%;text-align:left;min-height:52px;padding:13px 16px;border-radius:26px;border:1.5px solid #ddcdd5;background:#fff;color:var(--qf-ink);font-size:16px;line-height:1.4;cursor:pointer;overflow-wrap:anywhere;transition:background .15s,border-color .15s}',
'.qf-alt b{flex:none}.qf-alt span{flex:1;min-width:0}',
'.qf-alt:hover:not([disabled]){border-color:var(--qf-w)}',
'.qf-alt.sel{background:var(--qf-w);border-color:var(--qf-w);color:#fff}',
'.qf-alt.ok{background:#e3f4e8;border-color:#2f8a4e;color:#1d5c33}.qf-alt.bad{background:#fbe6e4;border-color:#c2413b;color:#8d2a25}',
'.qf-alt[disabled]{cursor:default;opacity:1}',
'.qf-btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:12px 18px;border-radius:16px;border:1.5px solid var(--qf-w);background:var(--qf-w);color:#fff;font-weight:700;font-size:16px;cursor:pointer;line-height:1.2;text-align:center}',
'.qf-btn.alt{background:#fff;color:var(--qf-w)}.qf-btn[disabled]{opacity:.45;cursor:not-allowed}',
'.qf-confirm{width:100%;margin-top:16px;border-radius:26px}',
'.qf-res{margin-top:16px;border-radius:16px;overflow:hidden;border:1.5px solid}',
'.qf-res.ok{border-color:#2f8a4e}.qf-res.bad{border-color:#c2413b}',
'.qf-res-t{padding:11px 14px;color:#fff;font-weight:700;font-size:17px}.qf-res.ok .qf-res-t{background:#2f8a4e}.qf-res.bad .qf-res-t{background:#c2413b}',
'.qf-res-b{padding:10px 12px;display:flex;flex-wrap:wrap;gap:8px}.qf-res.ok .qf-res-b{background:#eef8f1}.qf-res.bad .qf-res-b{background:#fdf1f0}',
'.qf-pill{display:inline-block;border-radius:10px;padding:5px 10px;font-weight:600;font-size:14.5px;overflow-wrap:anywhere}.qf-pill.ok{background:#bfe5cb;color:#174d2b}.qf-pill.bad{background:#f6cbc7;color:#7d221e}',
'.qf-steps{margin-top:14px;background:#fff;border:1px solid #ecdde4;border-radius:16px;box-shadow:0 3px 12px #6e234612;padding:4px 14px}',
'.qf-steps summary{cursor:pointer;font-weight:700;color:var(--qf-wd);padding:12px 0;list-style:none;display:flex;justify-content:space-between;align-items:center}',
'.qf-steps summary::-webkit-details-marker{display:none}.qf-steps summary:after{content:"⌄";font-size:20px;line-height:1;transition:transform .2s}.qf-steps[open] summary:after{transform:rotate(180deg)}',
'.qf-steps ol{list-style:none;counter-reset:qf;margin:0 0 12px;padding:0}',
'.qf-steps li{counter-increment:qf;position:relative;padding:4px 0 8px 38px;overflow-wrap:anywhere}',
'.qf-steps li:before{content:counter(qf)".";position:absolute;left:0;top:3px;min-width:28px;height:26px;border-radius:7px;background:#2f8a4e;color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center}',
'.qf-gab{margin-top:12px;background:var(--qf-pk);border-radius:14px;padding:12px 14px;color:var(--qf-wd)}.qf-gab small{display:block;color:#8a6a7a;font-size:12px}',
'.qf-lab{display:block;font-weight:700;color:var(--qf-wd);margin:6px 2px 6px}',
'.qf-txt{display:block;width:100%;min-height:170px;border:1.5px solid #ddcdd5;border-radius:16px;padding:12px 14px;font:inherit;font-size:16px;line-height:28px;color:var(--qf-ink);resize:vertical;background:#fff repeating-linear-gradient(transparent 0 27px,#efe2e8 27px 28px);background-attachment:local}',
'.qf-txt:focus{outline:2px solid var(--qf-w);outline-offset:1px}',
'.qf-cnt{display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#7d6c78;margin:6px 2px 12px}',
'.qf-row{display:flex;gap:10px;flex-wrap:wrap}.qf-row .qf-btn{flex:1 1 140px}',
'.qf-modelo{margin-top:12px;background:#f4f8fd;border:1px solid #d4e2f2;border-radius:14px;padding:12px 14px}.qf-modelo p{margin:6px 0 0}',
'.qf-crit{margin-top:12px;background:var(--qf-pk);border-radius:14px;padding:12px 14px}.qf-crit label{display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:15px}.qf-crit input{margin-top:4px;width:18px;height:18px;flex:none;accent-color:#6e2346}',
'.qf-nav{display:flex;gap:10px;margin:0 0 12px}.qf-nav .qf-btn{flex:1}',
'.qf-sum{background:#fff;border-radius:16px;padding:12px 14px;margin-bottom:12px;font-size:15px}.qf-sum small{display:block;color:#7d6c78;font-size:12.5px;margin-top:2px}',
'.qf-more .qf-btn{font-size:14px;min-height:44px;flex:1 1 130px}',
'@media(max-width:420px){.qf{font-size:15.5px;padding:0 8px}.qf-card{padding:12px;border-radius:18px}.qf-enun{font-size:16.5px}.qf-back{font-size:16.5px}.qf-head{padding:10px 10px 16px;margin:0 -8px}.qf-fig img{max-height:38vh}}'
].join('\n');document.head.appendChild(css);
})();
