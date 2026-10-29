"use strict";
// Скрипт локальной оболочки окна виджета. Работает в песочнице и общается
// с главным процессом только через window.squidifyShell из preload.

(function () {
  var api = window.squidifyShell;
  var frame = document.getElementById("widget");
  var empty = document.getElementById("empty");
  var grip = document.getElementById("grip");
  var state = { url: null, locked: false, autoSize: true };
  var origin = null;

  function setUrl(url) {
    if (url === frame.getAttribute("data-url")) return;
    frame.setAttribute("data-url", url || "");
    if (!url) {
      origin = null;
      frame.removeAttribute("src");
      empty.hidden = false;
      return;
    }
    origin = new URL(url).origin;
    empty.hidden = true;
    // Смена только #токена не перезагружает страницу, поэтому iframe создаётся заново.
    var fresh = frame.cloneNode(false);
    fresh.removeAttribute("src");
    fresh.setAttribute("data-url", url);
    frame.replaceWith(fresh);
    frame = fresh;
    frame.src = url;
  }

  api.onState(function (next) {
    state = next;
    document.body.classList.toggle("locked", Boolean(next.locked));
    document.body.classList.toggle("unlocked", !next.locked);
    setUrl(next.url);
  });

  api.onReload(function () {
    var url = frame.getAttribute("data-url");
    if (!url) return;
    frame.setAttribute("data-url", "");
    setUrl(url);
  });

  // Страница виджета сообщает свой рекомендуемый размер.
  window.addEventListener("message", function (event) {
    if (event.source !== frame.contentWindow || event.origin !== origin) return;
    var data = event.data;
    if (!data || data.type !== "squidify:size" || !state.autoSize) return;
    var w = Number(data.width);
    var h = Number(data.height);
    if (isFinite(w) && isFinite(h) && w > 0 && h > 0) api.autoSize(Math.ceil(w), Math.ceil(h));
  });

  // Изменение размера за уголок.
  var start = null;
  grip.addEventListener("pointerdown", function (event) {
    start = { x: event.screenX, y: event.screenY, w: window.innerWidth, h: window.innerHeight };
    grip.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  grip.addEventListener("pointermove", function (event) {
    if (!start) return;
    api.resize(start.w + event.screenX - start.x, start.h + event.screenY - start.y);
  });
  function stop(event) {
    if (!start) return;
    start = null;
    try {
      grip.releasePointerCapture(event.pointerId);
    } catch {
      /* указатель уже освобождён */
    }
  }
  grip.addEventListener("pointerup", stop);
  grip.addEventListener("pointercancel", stop);

  api.ready();
})();
