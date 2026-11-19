/* Experiência de estudo: aulas em blocos, exemplos guiados e resoluções legíveis.
   Usa somente os textos e explicações já existentes em conteudo.js; não inventa gabaritos. */
(function () {
  "use strict";
  var UI = window.UI;
  if (!UI || !UI.assunto) return;

  var original = UI.assunto;
  var style = document.createElement("style");
  style.textContent = [
    ".ag-learning{display:grid;gap:12px;margin:16px 0}",
    ".ag-lesson-part{position:relative;padding:18px 18px 18px 58px;border:1px solid var(--stroke-primary,#e8e4eb);border-radius:17px;background:var(--mat-regular,#fff);box-shadow:0 4px 18px rgba(40,25,55,.035)}",
    ".ag-lesson-part:before{content:attr(data-part);position:absolute;left:16px;top:17px;width:28px;height:28px;display:grid;place-items:center;border-radius:10px;background:#f1eaf7;color:#74558e;font-size:12px;font-weight:700}",
    ".ag-lesson-part p{margin:0;font-size:14px;line-height:1.8;color:var(--text-primary,#34303a)}",
    ".ag-lesson-heading{margin:22px 0 9px;font-size:17px;letter-spacing:-.02em}",
    ".ag-lesson-intro{margin:0 0 12px;color:var(--text-secondary,#777);font-size:13px;line-height:1.6}",
    ".ag-example-card{padding:18px;border:1px solid #e6dced;border-radius:17px;background:linear-gradient(145deg,#fff,#faf7fc)}",
    ".ag-example-card .ag-label,.ag-resolution .ag-label{font-size:10px;letter-spacing:.13em;font-weight:800;color:#8a6aa4;text-transform:uppercase}",
    ".ag-example-card .ag-problem{font-size:14px;line-height:1.7;margin:9px 0 12px;font-weight:600}",
    ".ag-example-card details,.ag-resolution details{border-top:1px solid #eee6f2;padding-top:11px}",
    ".ag-example-card summary,.ag-resolution summary{cursor:pointer;color:#765692;font-size:13px;font-weight:700}",
    ".ag-example-card details p{font-size:13px;line-height:1.8;margin:12px 0 0;color:var(--text-primary,#403747)}",
    ".ag-solution-steps{display:grid;gap:9px;margin:12px 0 0;padding:0;list-style:none;counter-reset:agstep}",
    ".ag-solution-steps li{counter-increment:agstep;position:relative;padding:12px 13px 12px 44px;border-radius:12px;background:rgba(246,241,249,.8);font-size:13px;line-height:1.75;color:#49414f}",
    ".ag-solution-steps li:before{content:counter(agstep);position:absolute;left:12px;top:12px;width:22px;height:22px;border-radius:8px;background:#e9def1;color:#674b81;display:grid;place-items:center;font-size:11px;font-weight:800}",
    ".ag-study-route{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:16px 0}",
    ".ag-study-route div{padding:12px 9px;text-align:center;border:1px solid var(--stroke-primary,#e8e4eb);border-radius:13px;background:var(--mat-regular,#fff)}",
    ".ag-study-route b{display:block;font-size:12px;margin-bottom:4px}.ag-study-route span{font-size:10px;line-height:1.4;color:var(--text-secondary,#777)}",
    ".ag-question-card{overflow:hidden;border:1px solid var(--stroke-primary,#e8e4eb);border-radius:17px;background:var(--mat-regular,#fff);box-shadow:0 4px 18px rgba(40,25,55,.035)}",
    ".ag-question-card>.x-as-q>p,.ag-question-card .ag-question-body{font-size:14px;line-height:1.8}",
    ".ag-question-card .ag-question-kicker{display:flex;align-items:center;gap:7px;margin:0 0 9px;color:#8a6aa4;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}",
    ".ag-question-card .x-as-exp{margin-top:14px;padding:15px;border-radius:13px;background:#f7f4f9;border:1px solid #e9e0ef}",
    ".ag-question-card .x-as-exp p{font-size:13px;line-height:1.8;margin:10px 0 0}",
    ".ag-resolution{margin-top:12px;padding:14px;border:1px solid #e8e0ed;border-radius:13px;background:#fbf9fc}",
    ".ag-resolution .ag-solution-steps{margin-top:10px}",
    ".ag-study-tip{padding:14px 16px;border-radius:14px;background:#f7f4fa;color:#62566b;font-size:12px;line-height:1.65;margin:14px 0}",
    "@media(max-width:520px){.ag-lesson-part{padding:15px 14px 15px 50px}.ag-lesson-part:before{left:12px;top:14px}.ag-lesson-part p{font-size:13px;line-height:1.75}.ag-study-route{gap:6px}.ag-study-route div{padding:10px 5px}.ag-study-route b{font-size:11px}.ag-study-route span{font-size:9px}}",
    "@media(prefers-reduced-motion:no-preference){.ag-lesson-part,.ag-question-card{transition:box-shadow .18s ease,border-color .18s ease}.ag-lesson-part:hover,.ag-question-card:hover{box-shadow:0 8px 24px rgba(40,25,55,.07)}}"
  ].join("");
  document.head.appendChild(style);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  function paragraphs(text) {
    var s = String(text || "").trim();
    if (!s) return [];
    var explicit = s.split(/(?=Passo\s+\d+\s*:|Etapa\s+\d+\s*:)/i).map(function (x) { return x.trim(); }).filter(Boolean);
    if (explicit.length > 1 || /^Passo\s+\d+\s*:/i.test(s)) return explicit;
    return s.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [s];
  }
  function stepList(text) {
    return '<ol class="ag-solution-steps">' + paragraphs(text).map(function (p) {
      return '<li>' + esc(p.trim()) + '</li>';
    }).join("") + '</ol>';
  }
  function enhance(id, index, tab) {
    var app = document.getElementById("app");
    if (!app) return;
    var content = window.CONT && window.CONT[id] && window.CONT[id][index];
    if (!content) return;

    if (tab === 0) {
      var lesson = app.querySelector(".x-as-aula");
      if (lesson && !lesson.dataset.enhanced) {
        var ps = content.aula || [];
        lesson.innerHTML = '<div class="ag-learning">' + ps.map(function (p, i) {
          return '<article class="ag-lesson-part" data-part="' + (i + 1) + '"><p>' + esc(p) + '</p></article>';
        }).join("") + '</div>';
        lesson.dataset.enhanced = "1";
      }
      var summary = app.querySelector(".x-as-res");
      if (summary && !summary.dataset.enhanced) {
        summary.dataset.enhanced = "1";
        summary.style.lineHeight = "1.8";
      }
      var example = app.querySelector(".x-as-aula");
      if (content.exemplo && example && !app.querySelector(".ag-example-card")) {
        var block = document.createElement("section");
        block.className = "ag-example-card";
        block.innerHTML = '<div class="ag-label">✏️ Exemplo trabalhado</div><p class="ag-problem">' + esc(content.exemplo.q) + '</p><details><summary>Ver explicação passo a passo</summary>' + stepList(content.exemplo.res) + '</details>';
        var headings = app.querySelectorAll("h3");
        var target = Array.prototype.find.call(headings, function (h) { return /Exemplo resolvido/i.test(h.textContent); });
        if (target) {
          target.textContent = "✏️ Vamos resolver juntos";
          target.insertAdjacentElement("afterend", block);
          var old = target.nextElementSibling;
          if (old && old !== block && old.classList.contains("x-card")) old.remove();
        }
      }
      if (!app.querySelector(".ag-study-route")) {
        var route = document.createElement("div");
        route.className = "ag-study-route";
        route.innerHTML = '<div><b>① Entenda</b><span>Leia a aula com calma</span></div><div><b>② Pratique</b><span>Resolva sem olhar o resumo</span></div><div><b>③ Revise</b><span>Confira onde errou</span></div>';
        var tabs = app.querySelector(".x-as-tabs");
        if (tabs) tabs.insertAdjacentElement("afterend", route);
      }
      var lessonHeading = Array.prototype.find.call(app.querySelectorAll("h3"), function (h) { return /Resum/i.test(h.textContent); });
      if (lessonHeading && !lessonHeading.dataset.guided) {
        lessonHeading.dataset.guided = "1";
        lessonHeading.textContent = "📌 Resumo para revisar";
        var note = document.createElement("p");
        note.className = "ag-lesson-intro";
        note.textContent = "Use este resumo depois da aula, para conferir o que ficou claro e o que merece outra leitura.";
        lessonHeading.insertAdjacentElement("afterend", note);
      }
    }

    if (tab === 1) {
      app.querySelectorAll(".x-as-q").forEach(function (card, i) {
        if (card.dataset.enhanced) return;
        card.dataset.enhanced = "1";
        card.classList.add("ag-question-card");
        var prompt = card.querySelector(":scope > p");
        if (prompt) {
          var kicker = document.createElement("div");
          kicker.className = "ag-question-kicker";
          kicker.textContent = "📝 Questão " + String(i + 1).padStart(2, "0") + " · Estilo vestibular";
          prompt.insertAdjacentElement("beforebegin", kicker);
          prompt.classList.add("ag-question-body");
        }
        var explanation = card.querySelector(".x-as-exp p");
        if (explanation && !card.querySelector(".ag-resolution")) {
          var panel = document.createElement("section");
          panel.className = "ag-resolution";
          panel.innerHTML = '<div class="ag-label">🔎 Entenda o raciocínio</div>' + stepList(explanation.textContent);
          explanation.replaceWith(panel);
        }
      });
      var intro = app.querySelector(".x-mut");
      if (intro && !intro.dataset.enhanced) {
        intro.dataset.enhanced = "1";
        intro.textContent = "Leia o enunciado até o fim, identifique o que a questão pede e só então escolha uma alternativa. A explicação aparece depois da resposta.";
      }
    }
  }

  UI.assunto = function (id, index, tab) {
    var result = original.apply(this, arguments);
    enhance(id, index, tab || 0);
    return result;
  };
})();