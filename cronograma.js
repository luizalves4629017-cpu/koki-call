/* Cronograma semanal da Ágatha — transcrito da planilha cronograma_meu_bem.xlsx.
   Progresso salvo localmente por data, sem alterar os dados originais da planilha. */
(function () {
  "use strict";
  var UI = window.UI;
  if (!UI) return;

  var DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  var TIMES = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00","21:00","22:00","23:00"];
  var PLAN = [
    ["Trabalho","Trabalho","Trabalho","Trabalho","Trabalho","Livre","Descanso"],
    ["Trabalho","Trabalho","Trabalho","Trabalho","Trabalho","Livre","Descanso"],
    ["Trabalho","Trabalho","Trabalho","Trabalho","Trabalho","Correção","Descanso"],
    ["Trabalho","Trabalho","Trabalho","Trabalho","Trabalho","Correção","Descanso"],
    ["Trabalho","Trabalho","Trabalho","Trabalho","Trabalho","Correção","Descanso"],
    ["Trabalho","Trabalho","Trabalho","Trabalho","Trabalho","Almoço","Descanso"],
    ["Almoço","Almoço","Almoço","Almoço","Almoço","Almoço","Descanso"],
    ["Matemática","Redação","Física","Geografia","Simulado","Filo/Sociologia","Descanso"],
    ["Matemática","Redação","Física","Geografia","Simulado","Química","Descanso"],
    ["Geografia","História","Literatura","Filo/Sociologia","Simulado","Química","Descanso"],
    ["Livre","História","Livre","Filo/Sociologia","Simulado","Livre","Descanso"],
    ["Física","Livre","Química","Livre","Redação","História","Descanso"],
    ["Física","Livre","Química","Livre","Livre","História","Descanso"],
    ["Livre","Química","Gramática","Biologia","Livre","Livre","Descanso"],
    ["Biologia","Química","Matemática","Biologia","Livre","Livre","Descanso"],
    ["Biologia","Matemática","Matemática","Matemática","Livre","Livre","Descanso"],
    ["Livre","Livre","Livre","Livre","Livre","Livre","Descanso"]
  ];
  var KEY = "agatha-cronograma-concluido-v1";
  var weekOffset = 0;
  var selectedDay = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function dateKey(d) { return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate()); }
  function monday(offset) {
    var d = new Date();
    d.setHours(12,0,0,0);
    var dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
    return d;
  }
  function readProgress() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeProgress(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); }
    catch (e) { alert("Não foi possível salvar o progresso neste navegador."); }
  }
  function isStudy(item) {
    return ["Matemática","Redação","Física","Geografia","Simulado","Filo/Sociologia","Química","História","Literatura","Gramática","Biologia"].indexOf(item) >= 0;
  }
  function kind(item) {
    if (isStudy(item)) return "study";
    if (item === "Trabalho") return "work";
    if (item === "Almoço") return "meal";
    if (item === "Correção") return "review";
    if (item === "Descanso") return "rest";
    return "free";
  }
  function dateLabel(d) { return pad(d.getDate())+"/"+pad(d.getMonth()+1); }
  function render() {
    var start = monday(weekOffset);
    var dates = DAYS.map(function (_, i) { var d = new Date(start); d.setDate(start.getDate()+i); return d; });
    var today = dateKey(new Date());
    var chosen = dates[selectedDay];
    var key = dateKey(chosen);
    var progress = readProgress();
    var done = progress[key] || {};
    var items = TIMES.map(function (time, i) {
      var subject = PLAN[i][selectedDay];
      return {time:time,subject:subject,index:i,study:isStudy(subject),kind:kind(subject),done:!!done[i]};
    });
    var studyItems = items.filter(function (x) { return x.study; });
    var completed = studyItems.filter(function (x) { return x.done; }).length;
    var pct = studyItems.length ? Math.round(completed / studyItems.length * 100) : 0;
    var first = dateLabel(dates[0]), last = dateLabel(dates[6]);
    var html = '<div class="ag-plan">'
      + '<div class="ag-plan-head"><div><span class="ag-eyebrow">SEU RITMO, UM DIA DE CADA VEZ</span><h2>Meu cronograma</h2><p>Uma rotina possível, sem cobrança de perfeição. 💜</p></div><div class="ag-week-nav"><button type="button" aria-label="Semana anterior" onclick="AGPLAN.shift(-1)">‹</button><button type="button" aria-label="Próxima semana" onclick="AGPLAN.shift(1)">›</button></div></div>'
      + '<div class="ag-week-label">Semana de '+first+' a '+last+'</div>'
      + '<div class="ag-days" role="tablist" aria-label="Dias da semana">'
      + dates.map(function (d,i) { return '<button type="button" role="tab" aria-selected="'+(i===selectedDay)+'" class="ag-day'+(i===selectedDay?' active':'')+'" onclick="AGPLAN.day('+i+')"><span>'+DAYS[i].slice(0,3)+'</span><b>'+pad(d.getDate())+'</b>'+(dateKey(d)===today?'<i>hoje</i>':'')+'</button>'; }).join("")
      + '</div>'
      + '<section class="ag-day-summary"><div><span class="ag-eyebrow">'+DAYS[selectedDay].toUpperCase()+' · '+dateLabel(chosen)+'</span><h3>'+ (studyItems.length ? completed+' de '+studyItems.length+' blocos de estudo concluídos' : 'Um dia para descansar') +'</h3></div><div class="ag-ring" style="--progress:'+pct+'%"><b>'+pct+'%</b></div></section>'
      + '<div class="ag-progress"><span style="width:'+pct+'%"></span></div>'
      + '<div class="ag-agenda">'+items.map(function (item) {
        var label = item.study ? (item.done ? "Concluído" : "Marcar como feito") : (item.subject === "Livre" ? "Tempo livre" : item.subject);
        return '<article class="ag-slot '+item.kind+(item.done?' completed':'')+'">'
          + '<time>'+item.time+'</time><div class="ag-slot-main"><b>'+esc(item.subject)+'</b><small>'+esc(label)+'</small></div>'
          + (item.study ? '<button type="button" class="ag-check" aria-label="'+(item.done?'Desmarcar':'Concluir')+' '+esc(item.subject)+' às '+item.time+'" aria-pressed="'+item.done+'" onclick="AGPLAN.toggle(\''+key+'\','+item.index+')">'+(item.done?'✓':'○')+'</button>' : '<span class="ag-slot-mark">'+(item.kind==="work"?"•":item.kind==="rest"?"☾":item.kind==="meal"?"⌁":"—")+'</span>')
          + '</article>';
      }).join("")+'</div>'
      + '<p class="ag-plan-note">Os horários seguem a planilha que você enviou. Marcar um bloco como concluído salva o progresso neste aparelho.</p>'
      + '</div>';
    UI._show(html, "home");
    try { window.scrollTo(0,0); } catch (e) {}
  }
  var AGPLAN = window.AGPLAN = {
    day: function (i) { selectedDay = Math.max(0, Math.min(6, +i)); render(); },
    shift: function (n) { weekOffset += n; render(); },
    toggle: function (date, index) {
      var p = readProgress();
      p[date] = p[date] || {};
      if (p[date][index]) delete p[date][index]; else p[date][index] = true;
      writeProgress(p);
      render();
    }
  };
  UI.cronograma = render;

  var nav = document.querySelector(".k-nav");
  if (nav && !document.getElementById("ag-plan-nav")) {
    var button = document.createElement("button");
    button.type = "button";
    button.id = "ag-plan-nav";
    button.className = "k-nb";
    button.setAttribute("data-kn", "cronograma");
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h3"/></svg><span>Meu cronograma</span>';
    button.addEventListener("click", function () {
      if (window.KUI) window.KUI.drawer(0);
      render();
    });
    nav.insertBefore(button, nav.children[1] || null);
  }

  var style = document.createElement("style");
  style.textContent = [
    ".ag-plan{max-width:900px;margin:0 auto;padding:4px 0 32px;color:var(--text-primary,#292532)}",
    ".ag-plan-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:8px 0 18px}",
    ".ag-eyebrow{font-size:10px;letter-spacing:.13em;font-weight:700;color:#9275aa}",
    ".ag-plan h2{font-size:clamp(25px,4vw,32px);letter-spacing:-.04em;margin:7px 0 5px}",
    ".ag-plan-head p{margin:0;color:var(--text-secondary,#777);font-size:14px}",
    ".ag-week-nav{display:flex;gap:7px}",
    ".ag-week-nav button{width:38px;height:38px;border:1px solid var(--stroke-primary,#ddd);border-radius:13px;background:var(--mat-regular,#fff);color:inherit;font-size:23px;cursor:pointer}",
    ".ag-week-label{font-size:12px;color:var(--text-secondary,#777);margin-bottom:9px}",
    ".ag-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px;margin-bottom:16px}",
    ".ag-day{min-width:0;border:1px solid var(--stroke-primary,#ddd);border-radius:15px;background:var(--mat-regular,#fff);padding:10px 3px 8px;color:inherit;display:flex;align-items:center;flex-direction:column;gap:4px;cursor:pointer}",
    ".ag-day span{font-size:10px;color:var(--text-secondary,#777)}.ag-day b{font-size:17px;font-weight:600}.ag-day i{font-style:normal;font-size:9px;color:#8b69a5;min-height:11px}",
    ".ag-day.active{background:#f2eafa;border-color:#cdb9df;color:#543c68;box-shadow:0 3px 12px #70518a12}",
    ".ag-day-summary{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:17px 18px;border:1px solid var(--stroke-primary,#ddd);border-radius:18px;background:var(--mat-regular,#fff);margin:0 0 9px}",
    ".ag-day-summary h3{font-size:15px;margin:6px 0 0;font-weight:600}",
    ".ag-ring{width:52px;height:52px;flex:none;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#9c7bb6 var(--progress),#eee 0);position:relative}",
    ".ag-ring:before{content:'';position:absolute;inset:5px;background:var(--mat-agent,#fff);border-radius:50%}.ag-ring b{position:relative;font-size:12px}",
    ".ag-progress{height:5px;background:var(--fill-tertiary,#eee);border-radius:10px;overflow:hidden;margin:0 2px 15px}.ag-progress span{display:block;height:100%;background:#9c7bb6;border-radius:10px;transition:width .2s}",
    ".ag-agenda{display:grid;gap:7px}",
    ".ag-slot{display:grid;grid-template-columns:58px minmax(0,1fr) 38px;align-items:center;gap:10px;padding:11px 12px;border:1px solid var(--stroke-secondary,#eee);border-radius:14px;background:var(--mat-regular,#fff);min-height:61px}",
    ".ag-slot time{font-size:12px;font-variant-numeric:tabular-nums;color:var(--text-secondary,#777)}",
    ".ag-slot-main{display:grid;gap:3px;min-width:0}.ag-slot-main b{font-size:13px;font-weight:600}.ag-slot-main small{font-size:11px;color:var(--text-secondary,#777)}",
    ".ag-slot.study{border-left:3px solid #ad91c5}.ag-slot.work,.ag-slot.meal{background:var(--hover-wash,#fafafa)}.ag-slot.rest{opacity:.72}.ag-slot.completed .ag-slot-main b{text-decoration:line-through;color:var(--text-secondary,#777)}",
    ".ag-check{width:32px;height:32px;border-radius:50%;border:1px solid #cdb9df;background:#f7f1fb;color:#765692;font-size:18px;cursor:pointer}.ag-check[aria-pressed=true]{background:#765692;color:white}",
    ".ag-slot-mark{justify-self:center;color:var(--text-tertiary,#aaa);font-size:17px}",
    ".ag-plan-note{font-size:11px;line-height:1.55;color:var(--text-secondary,#777);margin:14px 3px 0}",
    "@media(max-width:520px){.ag-plan{padding:0 0 28px}.ag-days{gap:4px}.ag-day{border-radius:12px;padding:9px 1px 7px}.ag-day span{font-size:9px}.ag-day b{font-size:15px}.ag-slot{grid-template-columns:49px minmax(0,1fr) 34px;padding:10px 9px}.ag-day-summary{padding:14px}}",
    "@media(prefers-reduced-motion:reduce){.ag-progress span{transition:none}}"
  ].join("");
  document.head.appendChild(style);
})();