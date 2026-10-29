"use strict";
// Окно настроек. Доступ к главному процессу — только через window.squidifySettings.

(function () {
  var api = window.squidifySettings;
  var $ = function (id) {
    return document.getElementById(id);
  };
  var toggles = ["alwaysOnTop", "locked", "clickThrough", "autoSize", "openAtLogin"];
  var pendingHotkey = null;

  function message(id, text, ok) {
    var el = $(id);
    el.textContent = text || "";
    el.className = "message " + (ok ? "ok" : text ? "error" : "");
  }

  function render(s) {
    $("version").textContent = s.version;
    if (document.activeElement !== $("url")) $("url").value = s.widgetUrl || "";
    toggles.forEach(function (key) {
      $(key).checked = Boolean(s[key]);
    });
    $("clickThrough").disabled = !s.locked;
    if (s.windowSize) {
      if (document.activeElement !== $("width")) $("width").value = s.windowSize[0];
      if (document.activeElement !== $("height")) $("height").value = s.windowSize[1];
    }
    if (pendingHotkey === null) $("hotkey").value = s.hotkey;
    message("hotkey-message", s.hotkeyError || "", false);
  }

  function update(patch, messageId, okText) {
    return api.update(patch).then(function (res) {
      if (!res.ok) {
        message(messageId, res.error, false);
        return;
      }
      if (okText) message(messageId, okText, true);
      render(res.settings);
    });
  }

  $("save-url").addEventListener("click", function () {
    update({ widgetUrl: $("url").value.trim() }, "url-message", "Сохранено. Виджет открыт в окне.");
  });

  $("toggle-url").addEventListener("click", function () {
    var input = $("url");
    var hidden = input.type === "password";
    input.type = hidden ? "text" : "password";
    $("toggle-url").textContent = hidden ? "Скрыть" : "Показать";
  });

  $("open-site").addEventListener("click", function () {
    api.action("open-site");
  });
  $("reload").addEventListener("click", function () {
    api.action("reload");
  });
  $("toggle-visible").addEventListener("click", function () {
    api.action("toggle");
  });
  $("quit").addEventListener("click", function () {
    api.action("quit");
  });

  toggles.forEach(function (key) {
    $(key).addEventListener("change", function (event) {
      var patch = {};
      patch[key] = event.target.checked;
      update(patch, "url-message");
    });
  });

  $("apply-size").addEventListener("click", function () {
    var w = Number($("width").value);
    var h = Number($("height").value);
    if (!(w > 0 && h > 0)) return;
    update({ autoSize: false, width: w, height: h }, "url-message", "Размер применён");
  });

  // Запись сочетания клавиш в формате Electron Accelerator.
  $("hotkey").addEventListener("keydown", function (event) {
    event.preventDefault();
    var key = event.key;
    if (["Control", "Shift", "Alt", "Meta"].indexOf(key) !== -1) return;
    var parts = [];
    if (event.ctrlKey) parts.push("CommandOrControl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    if (event.metaKey) parts.push("Super");
    if (key === " ") key = "Space";
    if (/^[a-z]$/i.test(key)) key = key.toUpperCase();
    else if (/^Digit[0-9]$/.test(event.code)) key = event.code.slice(5);
    else if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
    parts.push(key);
    pendingHotkey = parts.join("+");
    $("hotkey").value = pendingHotkey;
  });

  $("save-hotkey").addEventListener("click", function () {
    if (!pendingHotkey) return;
    update({ hotkey: pendingHotkey }, "hotkey-message", "Сочетание сохранено").then(function () {
      pendingHotkey = null;
    });
  });

  api.onChange(render);
  api.get().then(render);
})();
