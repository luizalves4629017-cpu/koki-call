(function(){
if(!window.UI||!UI.topic)return;
var prior=UI.topic;
var names={mat:'Matemática',port:'Português',hist:'História',geo:'Geografia',bio:'Biologia',fis:'Física',qui:'Química',filo:'Filosofia',socio:'Sociologia',ing:'Inglês',edf:'Educação Física',artes:'Artes'};
function text(s){return String(s||'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function subject(id){return names[id]||id}
function url(q){return 'https://www.youtube.com/results?search_query='+encodeURIComponent(q)}
function query(q){return 'https://www.google.com/search?q='+encodeURIComponent(q)}
function enhance(id,fi,step){
var root=document.getElementById('app');if(!root)return;
var title=(root.querySelector('.x-tag')||{}).textContent||'';
var nm=subject(id),label=title+' '+nm;
if(step===0){
var card=root.querySelector('.x-card');if(!card||card.classList.contains('mb-paper'))return;
var para=card.querySelector('#x-les');
if(para){
var lesson=para.textContent.trim();
card.classList.add('all-lesson');
var intro=document.createElement('div');intro.className='all-intro';intro.innerHTML='<small>📖 AULA GUIADA · '+text(nm)+'</small><h3>'+text(title)+'</h3><p>Vamos estudar por partes. Leia a explicação abaixo e avance para as próximas lições. Se surgir uma palavra desconhecida, anote e pesquise antes de continuar.</p>';
card.insertBefore(intro,para);
var block=document.createElement('div');block.className='all-explanation';block.innerHTML='<h4>Entenda a ideia</h4><p>'+text(lesson)+'</p>';
para.style.display='none';card.appendChild(block);
var hint=document.createElement('div');hint.className='all-tip';hint.innerHTML='<b>✏️ Como estudar este trecho</b><p>1. Identifique a ideia principal. 2. Crie um exemplo com suas palavras. 3. Explique em voz alta como se estivesse ensinando outra pessoa. 4. Só avance quando entender.</p>';
card.appendChild(hint);
}
var links=document.createElement('section');links.className='all-resources';links.innerHTML='<h3>🎥 Videoaulas sobre este conteúdo</h3><p>Escolha uma aula para acompanhar com calma. Os links levam a buscas de vídeos; ainda não há correspondência verificada entre vídeos e exercícios do aplicativo.</p><a target="_blank" rel="noopener" href="'+url(label+' aula completa exemplos resolvidos')+'">▶ Procurar videoaula completa</a><a target="_blank" rel="noopener" href="'+url(label+' exercícios resolvidos ENEM UECE')+'">▶ Procurar questões resolvidas em vídeo</a><h3>📄 Provas e exercícios</h3><p>Consulte cadernos oficiais para reconhecer como o assunto aparece em avaliações reais.</p><a target="_blank" rel="noopener" href="https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos">ENEM — provas e gabaritos oficiais</a><a target="_blank" rel="noopener" href="https://www.cev.uece.br/">UECE — portal oficial de vestibulares</a><a target="_blank" rel="noopener" href="'+query('questões '+label+' ENEM UECE resolvidas')+'">Pesquisar questões deste assunto</a><p class="all-disclaimer">As provas são externas. Não afirmamos que uma questão foi resolvida em um vídeo sem verificar essa correspondência.</p>';
root.appendChild(links);
}
if(step===2){
var q=root.querySelector('.x-q');if(q){var pre=document.createElement('div');pre.className='all-exercise-note';pre.innerHTML='<b>📝 Prática orientada</b><p>Leia o enunciado inteiro, destaque os dados e tente resolver antes de marcar. Depois confira a explicação. Estes exercícios são autorais; para provas oficiais, consulte os cadernos da UECE e do ENEM.</p>';q.parentNode.insertBefore(pre,q);}
}
}
UI.topic=function(id,fi,step,i){
var result=prior.apply(this,arguments);
if(id==='mat'&&fi===0)return result;
try{enhance(id,fi,step===undefined?0:step)}catch(e){console.warn('Aula guiada:',e)}
return result;
};
var style=document.createElement('style');style.textContent='.all-lesson,.all-resources{background:#fff!important;color:#2b2430!important;border-radius:18px!important;padding:clamp(18px,3vw,30px)!important;margin:14px 0!important;border:1px solid #e8deeb!important}.all-lesson h3,.all-resources h3{color:#432d57!important;font-size:23px!important;margin:12px 0!important}.all-lesson p,.all-resources p{color:#3a3240!important;font-size:16px!important;line-height:1.8!important}.all-lesson small{color:#694b7c!important;font-weight:700}.all-explanation{background:#f7f3f9;padding:18px;border-radius:14px;margin:16px 0}.all-explanation h4{color:#4c3260!important;font-size:19px!important;margin:0 0 8px}.all-tip,.all-exercise-note{background:#f4edf7;color:#30263a;border-left:4px solid #8a63a3;padding:15px;border-radius:10px;margin:15px 0}.all-resources a{display:block;border:1px solid #d9cde0;padding:12px 14px;border-radius:10px;color:#4a3260!important;text-decoration:none!important;margin:9px 0;font-weight:650}.all-resources a:hover{background:#f5eef8}.all-resources .all-disclaimer{font-size:13px!important;color:#675c6c!important}.all-exercise-note p{font-size:15px;line-height:1.6}@media(max-width:600px){.all-lesson p,.all-resources p{font-size:15px!important}}';document.head.appendChild(style);
})();