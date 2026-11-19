/* Momentos especiais da Ágatha — avisos que ocupam a tela somente no dia da prova.
   Atualize os eventos abaixo quando Inep/CEV-UECE publicarem novos calendários oficiais. */
(function () {
  "use strict";

  var EVENTS = [
    {
      id: "uece-2027-1-fase-2-dia-1",
      date: "2026-12-06",
      exam: "UECE · Vestibular 2027.1",
      phase: "2ª fase · Conhecimentos específicos e redação",
      message: "Ágatha, chegou o momento de mostrar tudo o que você construiu. Respire fundo, confie na sua preparação e faça uma questão de cada vez. Independentemente do resultado, eu já tenho muito orgulho de você. Estou torcendo por você e acredito na sua capacidade. 💜"
    },
    {
      id: "uece-2027-1-fase-2-dia-2",
      date: "2026-12-07",
      exam: "UECE · Vestibular 2027.1",
      phase: "2ª fase · Conhecimentos específicos e redação",
      message: "Mais um dia, Ágatha. Você chegou até aqui com esforço, coragem e dedicação. Não deixe a ansiedade apagar tudo o que sabe. Leia com calma, confie em si mesma e dê o seu melhor. Seja qual for o resultado, meu orgulho por você não muda. 💜"
    }
  ];

  function localDate() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function wasSeen(id) {
    try { return localStorage.getItem("agatha-momento-visto-" + id) === "1"; }
    catch (e) { return false; }
  }

  function markSeen(id) {
    try { localStorage.setItem("agatha-momento-visto-" + id, "1"); }
    catch (e) {}
  }

  function showEvent(event) {
    if (document.getElementById("agatha-momento-especial")) return;

    var overlay = document.createElement("div");
    overlay.id = "agatha-momento-especial";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "agatha-momento-titulo");

    var style = document.createElement("style");
    style.textContent = [
      "#agatha-momento-especial{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 15% 10%,rgba(255,255,255,.96),rgba(246,237,255,.98) 48%,rgba(225,215,248,.99));font-family:Geist,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#382b48}",
      "#agatha-momento-especial *{box-sizing:border-box}",
      "#agatha-momento-especial .am-card{width:min(100%,520px);padding:clamp(26px,6vw,42px);border:1px solid rgba(255,255,255,.9);border-radius:28px;background:rgba(255,255,255,.82);box-shadow:0 24px 80px rgba(75,49,111,.16);text-align:center}",
      "#agatha-momento-especial .am-heart{font-size:38px;line-height:1.2;margin-bottom:14px}",
      "#agatha-momento-especial .am-kicker{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8567a5;font-weight:700}",
      "#agatha-momento-especial h1{font-size:clamp(25px,6vw,34px);line-height:1.15;margin:12px 0;color:#4b3563}",
      "#agatha-momento-especial .am-exam{font-size:14px;font-weight:700;color:#795b98;margin:0 0 4px}",
      "#agatha-momento-especial .am-phase{font-size:12px;color:#887b94;margin:0 0 22px}",
      "#agatha-momento-especial .am-message{font-size:16px;line-height:1.75;color:#51465b;margin:0 auto 26px;max-width:410px}",
      "#agatha-momento-especial .am-sign{font-size:13px;color:#8a719f;margin:0 0 22px}",
      "#agatha-momento-especial button{border:0;border-radius:999px;padding:14px 24px;background:#76539a;color:white;font:600 14px inherit;cursor:pointer;box-shadow:0 8px 22px rgba(118,83,154,.23)}",
      "#agatha-momento-especial button:focus-visible{outline:3px solid #c5a8e8;outline-offset:4px}",
      "@media(prefers-reduced-motion:no-preference){#agatha-momento-especial .am-card{animation:am-in .45s ease-out}@keyframes am-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}}"
    ].join("");
    document.head.appendChild(style);

    var card = document.createElement("section");
    card.className = "am-card";
    var heart = document.createElement("div");
    heart.className = "am-heart";
    heart.setAttribute("aria-hidden", "true");
    heart.textContent = "💜";
    var kicker = document.createElement("div");
    kicker.className = "am-kicker";
    kicker.textContent = "Um recado especial para você";
    var title = document.createElement("h1");
    title.id = "agatha-momento-titulo";
    title.textContent = "Hoje é seu dia, Ágatha!";
    var exam = document.createElement("p");
    exam.className = "am-exam";
    exam.textContent = event.exam;
    var phase = document.createElement("p");
    phase.className = "am-phase";
    phase.textContent = event.phase;
    var message = document.createElement("p");
    message.className = "am-message";
    message.textContent = event.message;
    var sign = document.createElement("p");
    sign.className = "am-sign";
    sign.textContent = "Com todo o meu carinho. ❤️";
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "Li sua mensagem · continuar";
    button.addEventListener("click", function () {
      markSeen(event.id);
      overlay.remove();
      style.remove();
    });
    card.append(heart, kicker, title, exam, phase, message, sign, button);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    button.focus();
  }

  function check() {
    var today = localDate();
    var event = EVENTS.find(function (item) {
      return item.date === today && !wasSeen(item.id);
    });
    if (event) showEvent(event);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", check, { once: true });
  } else {
    check();
  }
})();
