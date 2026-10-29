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
  // Размер виджета в масштабе, который он сам сообщает; нужен для пропорций и подгонки окна.
  var natural = null;

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
    if (!data || data.type !== "squidify:size") return;
    var w = Number(data.width);
    var h = Number(data.height);
    if (!(isFinite(w) && isFinite(h) && w > 0 && h > 0)) return;
    natural = { width: Math.ceil(w), height: Math.ceil(h) };
    if (state.autoSize) api.autoSize(natural.width, natural.height);
  });

  api.onFit(function () {
    if (natural) api.fit(natural.width, natural.height);
  });

  // Перемещение окна: тянем за любую точку виджета.
  var drag = document.getElementById("drag");
  var dragFrom = null;
  drag.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) return;
    dragFrom = { x: event.screenX, y: event.screenY };
    api.moveStart();
    drag.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  drag.addEventListener("pointermove", function (event) {
    if (dragFrom) api.move(event.screenX - dragFrom.x, event.screenY - dragFrom.y);
  });
  function endDrag(event) {
    if (!dragFrom) return;
    dragFrom = null;
    api.moveEnd();
    try {
      drag.releasePointerCapture(event.pointerId);
    } catch {
      /* указатель уже освобождён */
    }
  }
  drag.addEventListener("pointerup", endDrag);
  drag.addEventListener("pointercancel", endDrag);

  // Изменение размера за уголок: пропорции сохраняются, виджет масштабируется вместе с окном.
  var start = null;
  grip.addEventListener("pointerdown", function (event) {
    start = { x: event.screenX, y: event.screenY, w: window.innerWidth, h: window.innerHeight };
    grip.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  grip.addEventListener("pointermove", function (event) {
    if (!start) return;
    var w = start.w + event.screenX - start.x;
    var h = start.h + event.screenY - start.y;
    if (natural) {
      // Пропорции берём у виджета; ведущая сторона — та, что сдвинули сильнее.
      var ratio = natural.width / natural.height;
      var dw = Math.abs(w - start.w) / start.w;
      var dh = Math.abs(h - start.h) / start.h;
      if (dw >= dh) h = w / ratio;
      else w = h * ratio;
    }
    api.resize(w, h);
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
