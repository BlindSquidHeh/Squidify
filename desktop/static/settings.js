"use strict";
// Окно настроек. Доступ к главному процессу — только через window.squidifySettings.

(function () {
  var api = window.squidifySettings;
  var $ = function (id) {
    return document.getElementById(id);
  };
  var toggles = ["alwaysOnTop", "locked", "clickThrough", "autoSize", "openAtLogin"];
  var pendingHotkey = null;
  var cards = {};

  function message(id, text, ok) {
    var el = $(id);
    el.textContent = text || "";
    el.className = "message " + (ok ? "ok" : text ? "error" : "");
  }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      if (key === "text") node.textContent = props[key];
      else if (key === "class") node.className = props[key];
      else node[key] = props[key];
    });
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function button(text, cls, onClick) {
    var b = el("button", { type: "button", text: text, class: cls || "" });
    b.addEventListener("click", onClick);
    return b;
  }

  function sync(input, value) {
    if (document.activeElement !== input) input.value = value;
  }

  function buildCard(w) {
    var id = w.id;
    var name = el("input", { type: "text", maxLength: 40, class: "name", spellcheck: false });
    var url = el("input", { type: "password", placeholder: "https://…/w/#…", spellcheck: false, autocomplete: "off" });
    var showUrl = button("Показать", "ghost", function () {
      var hidden = url.type === "password";
      url.type = hidden ? "text" : "password";
      showUrl.textContent = hidden ? "Скрыть" : "Показать";
    });
    var msg = el("p", { class: "message", role: "status" });
    var width = el("input", { type: "number", min: 80, max: 3840 });
    var height = el("input", { type: "number", min: 40, max: 2160 });
    var visibleBtn = button("Скрыть", "", function () {
      api.action("toggle", id).then(render);
    });
    var removeBtn = button("Удалить", "danger", function () {
      api.removeWidget(id).then(function (res) {
        if (!res.ok) message("widgets-message", res.error, false);
        else render(res.settings);
      });
    });

    function save(patch, okText) {
      api.updateWidget(id, patch).then(function (res) {
        if (!res.ok) {
          msg.textContent = res.error;
          msg.className = "message error";
          return;
        }
        msg.textContent = okText || "";
        msg.className = "message ok";
        render(res.settings);
      });
    }

    name.addEventListener("change", function () {
      save({ name: name.value });
    });

    var node = el("div", { class: "widget-card" }, [
      el("div", { class: "row" }, [name, removeBtn]),
      el("div", { class: "row" }, [url, showUrl]),
      el("div", { class: "row" }, [
        button("Сохранить ссылку", "primary", function () {
          save({ url: url.value.trim() }, "Сохранено. Виджет открыт в окне.");
        }),
        visibleBtn,
        button("Открыть сайт", "", function () {
          api.action("open-site", id);
        }),
        button("Обновить", "", function () {
          api.action("reload", id);
        }),
      ]),
      el("div", { class: "row size" }, [
        el("label", { text: "Ширина " }, [width]),
        el("label", { text: "Высота " }, [height]),
        button("Применить размер", "", function () {
          var w = Number(width.value);
          var h = Number(height.value);
          if (!(w > 0 && h > 0)) return;
          api.update({ autoSize: false }).then(function () {
            save({ width: w, height: h }, "Размер применён. Автоподгонка выключена.");
          });
        }),
        button("Подогнать под виджет", "", function () {
          api.action("fit-window", id);
        }),
      ]),
      msg,
    ]);
    return { node: node, name: name, url: url, width: width, height: height, visibleBtn: visibleBtn, removeBtn: removeBtn };
  }

  function renderWidgets(s) {
    var list = $("widgets");
    var ids = s.widgets.map(function (w) {
      return w.id;
    });
    Object.keys(cards).forEach(function (id) {
      if (ids.indexOf(id) === -1) {
        cards[id].node.remove();
        delete cards[id];
      }
    });
    s.widgets.forEach(function (w) {
      var card = cards[w.id];
      if (!card) {
        card = buildCard(w);
        cards[w.id] = card;
      }
      list.appendChild(card.node); // порядок как в настройках
      sync(card.name, w.name);
      sync(card.url, w.url || "");
      if (w.windowSize) {
        sync(card.width, w.windowSize[0]);
        sync(card.height, w.windowSize[1]);
      }
      card.visibleBtn.textContent = w.visible ? "Скрыть" : "Показать";
      card.visibleBtn.disabled = !w.url;
      card.removeBtn.disabled = s.widgets.length <= 1;
    });
  }

  function render(s) {
    $("version").textContent = s.version;
    renderWidgets(s);
    toggles.forEach(function (key) {
      $(key).checked = Boolean(s[key]);
    });
    $("clickThrough").disabled = !s.locked;
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

  $("add-widget").addEventListener("click", function () {
    api.addWidget().then(function (res) {
      if (!res.ok) message("widgets-message", res.error, false);
      else {
        message("widgets-message", "Карточка добавлена: вставьте в неё ссылку виджета.", true);
        render(res.settings);
      }
    });
  });
  $("toggle-visible").addEventListener("click", function () {
    api.action("toggle").then(render);
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
