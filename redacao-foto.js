(function(){
'use strict';
if(!window.UI||!UI.redacao)return;
var old=UI.redacao;
UI.redacao=function(){
 old.apply(this,arguments);
 var textarea=document.getElementById('red-tx');if(!textarea)return;
 var card=textarea.closest('.x-card');if(!card||card.querySelector('.ag-photo-red'))return;
 var box=document.createElement('section');box.className='ag-photo-red';
 box.innerHTML='<h3>Como você quer fazer sua redação?</h3><p>Você pode escrever aqui ou fotografar sua redação feita no papel. A avaliação usa os mesmos cinco critérios em ambos os casos.</p><div class="ag-photo-actions"><label class="ag-photo-button">📷 Tirar foto<input id="ag-camera" type="file" accept="image/*" capture="environment" hidden></label><label class="ag-photo-button">🖼️ Enviar foto<input id="ag-gallery" type="file" accept="image/*" hidden></label></div><div id="ag-photo-preview" aria-live="polite"></div><p class="ag-photo-note">A foto será transcrita para texto. Confira a transcrição antes de corrigir: a leitura automática pode errar letras, acentos e parágrafos, especialmente em manuscritos.</p>';
 textarea.parentNode.insertBefore(box,textarea);
 box.querySelectorAll('input[type=file]').forEach(function(el){el.addEventListener('change',function(){if(el.files&&el.files[0])UI.agRedPhoto(el.files[0])})});
};
UI.agRedPhoto=async function(file){
 var preview=document.getElementById('ag-photo-preview'),tx=document.getElementById('red-tx');if(!preview||!tx)return;
 if(!file.type.startsWith('image/')){preview.textContent='Selecione uma imagem válida.';return}
 if(file.size>12*1024*1024){preview.textContent='A imagem deve ter até 12 MB.';return}
 var url=URL.createObjectURL(file);
 preview.innerHTML='<img alt="Foto da redação para conferência" class="ag-photo-img"><p id="ag-photo-status" role="status">Preparando leitura da redação...</p>';
 preview.querySelector('img').src=url;
 var status=preview.querySelector('#ag-photo-status');
 try{
  if(!window.Tesseract){
   await new Promise(function(resolve,reject){var script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.onload=resolve;script.onerror=reject;document.head.appendChild(script)});
  }
  status.textContent='Lendo a foto... Isso pode demorar um pouco.';
  var result=await Tesseract.recognize(file,'por');
  var text=(result.data&&result.data.text||'').trim();
  if(!text){status.textContent='Não foi possível identificar o texto. Tente uma foto mais nítida e bem iluminada.';return}
  tx.value=text;UI.redType(tx);
  status.textContent='Transcrição pronta. Revise o texto abaixo e depois toque em Corrigir. A mesma correção será aplicada ao texto transcrito.';
  tx.focus();
 }catch(e){status.textContent='Não foi possível ler a foto automaticamente. Verifique sua conexão ou digite o texto no campo abaixo. A foto não foi corrigida.'}
 finally{setTimeout(function(){URL.revokeObjectURL(url)},60000)}
};
var style=document.createElement('style');style.textContent='.ag-photo-red{background:#fff;border:1px solid #f0dce6;border-radius:18px;padding:18px;margin:14px 0;color:#3e2937}.ag-photo-red h3{margin:0 0 8px;color:#66334c}.ag-photo-red p{font-size:14px;line-height:1.6}.ag-photo-actions{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}.ag-photo-button{display:inline-flex;align-items:center;justify-content:center;cursor:pointer;background:#713a59;color:white;border-radius:12px;padding:13px 17px;font-weight:700}.ag-photo-img{display:block;max-width:100%;max-height:380px;margin:12px auto;border-radius:10px}.ag-photo-note{font-size:12px!important;color:#66535f}.x-red-tx{min-height:220px}';document.head.appendChild(style);
})();