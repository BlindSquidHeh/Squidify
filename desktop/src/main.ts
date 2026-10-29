// Главный процесс Squidify Desktop.
//
// Каждый виджет — отдельное прозрачное окно (можно добавить несколько). Окно виджета — прозрачное, без рамки, поверх других окон. Оно загружает
// локальную страницу-оболочку (static/shell.html), а уже она показывает
// страницу виджета с сайта во встроенном iframe. У удалённой страницы нет
// preload-скрипта и доступа к Node.js или Electron API: включены
// contextIsolation и sandbox, переходы на чужие адреса и всплывающие окна
// запрещены, ссылки на Spotify открываются в системном браузере.

import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  powerMonitor,
  screen,
  session,
  shell,
  Tray,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type MenuItemConstructorOptions,
  type Rectangle,
  type WebContents,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadSettings, saveSettings } from "./store";
import {
  clampSize,
  defaultBounds,
  defaultWidgetName,
  ensureVisible,
  isValidHotkey,
  MAX_WIDGETS,
  newWidgetId,
  type Bounds,
  type Settings,
  type WidgetEntry,
} from "./settings";
import { isAllowedExternalUrl, parseProtocolUrl, parseWidgetUrl, sameOrigin, type WidgetLocation } from "./url";

const PROTOCOL = "squidify";
const STATIC_DIR = path.join(__dirname, "..", "static");
const BUILD_DIR = path.join(__dirname, "..", "build");
const SHELL_URL = pathToFileURL(path.join(STATIC_DIR, "shell.html")).toString();
const SETTINGS_URL = pathToFileURL(path.join(STATIC_DIR, "settings.html")).toString();
const WIDGET_PARTITION = "persist:squidify-widget";

let settings: Settings;
/** Окна виджетов по id записи в настройках. */
const windows = new Map<string, BrowserWindow>();
const drags = new Map<string, Rectangle>();
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let registeredHotkey: string | null = null;
let hotkeyError: string | null = null;

// ---------------------------------------------------------------------------
// Один экземпляр приложения и протокол squidify://
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (link) void handleProtocolLink(link);
    else showSettings();
  });
}

if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  void handleProtocolLink(url);
});

async function handleProtocolLink(link: string) {
  const location = parseProtocolUrl(link);
  if (!location) {
    await dialog.showMessageBox({
      type: "warning",
      title: "Squidify",
      message: "Ссылка не похожа на ссылку виджета Squidify.",
    });
    return;
  }
  const existing = settings.widgets.find((w) => w.url === location.href);
  if (existing) {
    setVisible(existing.id, true);
    return;
  }
  const { response } = await dialog.showMessageBox({
    type: "question",
    title: "Squidify",
    message: "Добавить этот виджет на рабочий стол?",
    detail: `${location.origin}\n\nУже добавленные виджеты останутся на месте.`,
    buttons: ["Добавить", "Отмена"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) {
    const result = addWidget(location);
    if (!result.ok) await dialog.showMessageBox({ type: "warning", title: "Squidify", message: result.error });
  }
}

// ---------------------------------------------------------------------------
// Безопасность WebContents
// ---------------------------------------------------------------------------

function widgetLocations(): WidgetLocation[] {
  const list: WidgetLocation[] = [];
  for (const w of settings.widgets) {
    const location = w.url ? parseWidgetUrl(w.url) : null;
    if (location) list.push(location);
  }
  return list;
}

function hardenSession() {
  for (const ses of [session.defaultSession, session.fromPartition(WIDGET_PARTITION)]) {
    // Ни камера, ни микрофон, ни уведомления, ни геолокация виджету не нужны.
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    ses.setDevicePermissionHandler(() => false);
  }
}

/** Общие ограничения для всех окон приложения. */
function hardenWebContents(contents: WebContents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  contents.on("will-frame-navigate", (event) => {
    const url = event.url;
    if (event.isMainFrame) {
      // Главный фрейм всегда остаётся локальной страницей приложения.
      if (url !== SHELL_URL && url !== SETTINGS_URL) event.preventDefault();
      return;
    }
    // Вложенный фрейм может открывать только страницу виджета с сайта одного из виджетов.
    if (!widgetLocations().some((widget) => sameOrigin(url, widget.origin))) {
      event.preventDefault();
      if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    }
  });

  contents.on("will-attach-webview", (event) => event.preventDefault());
}

app.on("web-contents-created", (_event, contents) => hardenWebContents(contents));

function isTrustedSettings(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return Boolean(
    settingsWindow &&
      !settingsWindow.isDestroyed() &&
      event.sender === settingsWindow.webContents &&
      event.senderFrame?.url === SETTINGS_URL,
  );
}

/** id виджета, окно оболочки которого прислало сообщение; null для чужих отправителей. */
function shellSenderId(event: IpcMainEvent): string | null {
  if (event.senderFrame?.url !== SHELL_URL) return null;
  for (const [id, win] of windows) {
    if (!win.isDestroyed() && win.webContents === event.sender) return id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Окна виджетов
// ---------------------------------------------------------------------------

function entryOf(id: string): WidgetEntry | undefined {
  return settings.widgets.find((w) => w.id === id);
}

function windowOf(id: string): BrowserWindow | null {
  const win = windows.get(id);
  return win && !win.isDestroyed() ? win : null;
}

function initialBounds(entry: WidgetEntry): Bounds {
  const primary = screen.getPrimaryDisplay().workArea;
  if (entry.bounds) {
    return ensureVisible(
      entry.bounds,
      screen.getAllDisplays().map((d) => d.workArea),
      primary,
    );
  }
  // Новые окна располагаем лесенкой, чтобы они не лежали друг на друге.
  const index = Math.max(0, settings.widgets.findIndex((w) => w.id === entry.id));
  const base = defaultBounds(primary);
  const step = 150;
  const rows = Math.max(1, Math.floor((primary.height - 48) / step));
  return { ...base, y: base.y + (index % rows) * step, x: base.x - Math.floor(index / rows) * 40 };
}

function createWidgetWindow(entry: WidgetEntry) {
  const bounds = initialBounds(entry);
  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: settings.alwaysOnTop,
    show: false,
    title: "Squidify",
    icon: appIcon(),
    webPreferences: {
      preload: path.join(__dirname, "preload-shell.js"),
      partition: WIDGET_PARTITION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged,
      backgroundThrottling: false,
    },
  });
  windows.set(entry.id, win);

  applyWindowFlags(entry.id);
  void win.loadURL(SHELL_URL);

  win.once("ready-to-show", () => {
    const current = entryOf(entry.id);
    if (current?.visible && current.url) win.showInactive();
  });

  let saveTimer: NodeJS.Timeout | undefined;
  const persistBounds = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      updateEntry(entry.id, { bounds: win.getBounds() }, false);
    }, 400);
  };
  win.on("moved", persistBounds);
  win.on("resized", persistBounds);
  win.on("move", persistBounds);

  win.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      setVisible(entry.id, false);
    }
  });
  win.on("show", rebuildTrayMenu);
  win.on("hide", rebuildTrayMenu);
  win.on("closed", () => {
    windows.delete(entry.id);
    drags.delete(entry.id);
  });
}

function applyWindowFlags(id?: string) {
  for (const [wid, win] of windows) {
    if (win.isDestroyed() || (id && wid !== id)) continue;
    // Уровень screen-saver держит окно поверх полноэкранных окон в оконном режиме.
    win.setAlwaysOnTop(settings.alwaysOnTop, "screen-saver");
    win.setVisibleOnAllWorkspaces(settings.alwaysOnTop, { visibleOnFullScreen: true });
    win.setMovable(!settings.locked);
    win.setIgnoreMouseEvents(settings.locked && settings.clickThrough, { forward: true });
    sendShellState(wid);
  }
}

function sendShellState(id: string) {
  const win = windowOf(id);
  const entry = entryOf(id);
  if (!win || !entry) return;
  win.webContents.send("shell:state", {
    url: entry.url,
    locked: settings.locked,
    autoSize: settings.autoSize,
  });
}

function setVisible(id: string, visible: boolean) {
  const win = windowOf(id);
  const entry = entryOf(id);
  if (!win || !entry) return;
  if (visible) {
    if (!entry.url) {
      showSettings();
      return;
    }
    win.showInactive();
  } else {
    win.hide();
  }
  updateEntry(id, { visible }, false);
}

/** Горячая клавиша и клик по трею: если что-то видно, прячем всё, иначе показываем всё. */
function toggleAll() {
  const anyVisible = [...windows.values()].some((w) => !w.isDestroyed() && w.isVisible());
  const targets = settings.widgets.filter((w) => w.url);
  if (targets.length === 0) {
    showSettings();
    return;
  }
  for (const w of targets) setVisible(w.id, !anyVisible);
}

function resizeWidget(id: string, width: number, height: number) {
  const win = windowOf(id);
  if (!win) return;
  const size = clampSize(width, height);
  const [x, y] = win.getPosition();
  win.setBounds({ x, y, ...size });
}

type AddResult = { ok: true; id: string } | { ok: false; error: string };

/** Добавляет виджет: заполняет первое пустое окно или создаёт новое. */
function addWidget(location: WidgetLocation | null, name?: string): AddResult {
  const empty = location ? settings.widgets.find((w) => !w.url) : undefined;
  if (empty && location) {
    updateEntry(empty.id, { url: location.href, ...(name ? { name } : {}) });
    setVisible(empty.id, true);
    return { ok: true, id: empty.id };
  }
  if (settings.widgets.length >= MAX_WIDGETS) {
    return { ok: false, error: `Можно добавить не больше ${MAX_WIDGETS} виджетов.` };
  }
  const entry: WidgetEntry = {
    id: newWidgetId(),
    name: name?.trim() ? name.trim().slice(0, 40) : defaultWidgetName(settings.widgets.length),
    url: location ? location.href : null,
    bounds: null,
    visible: true,
  };
  settings = { ...settings, widgets: [...settings.widgets, entry] };
  saveSettings(settings);
  createWidgetWindow(entry);
  rebuildTrayMenu();
  notifySettings();
  return { ok: true, id: entry.id };
}

function removeWidget(id: string): boolean {
  if (settings.widgets.length <= 1 || !entryOf(id)) return false;
  settings = { ...settings, widgets: settings.widgets.filter((w) => w.id !== id) };
  saveSettings(settings);
  windows.get(id)?.destroy();
  windows.delete(id);
  rebuildTrayMenu();
  notifySettings();
  return true;
}

// ---------------------------------------------------------------------------
// Настройки
// ---------------------------------------------------------------------------

function updateEntry(id: string, patch: Partial<WidgetEntry>, refresh = true) {
  settings = { ...settings, widgets: settings.widgets.map((w) => (w.id === id ? { ...w, ...patch } : w)) };
  saveSettings(settings);
  if (refresh) {
    if ("url" in patch) sendShellState(id);
    rebuildTrayMenu();
    notifySettings();
  }
}

function updateSettings(patch: Partial<Omit<Settings, "widgets">>, refresh = true) {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  if (refresh) {
    if ("alwaysOnTop" in patch || "locked" in patch || "clickThrough" in patch) applyWindowFlags();
    else if ("autoSize" in patch) for (const id of windows.keys()) sendShellState(id);
    if ("hotkey" in patch) registerHotkey();
    if ("openAtLogin" in patch) app.setLoginItemSettings({ openAtLogin: settings.openAtLogin });
    rebuildTrayMenu();
    notifySettings();
  }
}

function notifySettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("settings:changed", publicSettings());
  }
}

function publicSettings() {
  return {
    ...settings,
    widgets: settings.widgets.map((w) => {
      const win = windowOf(w.id);
      return { ...w, visible: win ? win.isVisible() : false, windowSize: win ? win.getSize() : null };
    }),
    hotkeyError,
    version: app.getVersion(),
  };
}

function showSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 760,
    minWidth: 460,
    minHeight: 520,
    title: "Squidify — настройки",
    icon: appIcon(),
    backgroundColor: "#0b0b10",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload-settings.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  settingsWindow.removeMenu();
  void settingsWindow.loadURL(SETTINGS_URL);
  settingsWindow.once("ready-to-show", () => settingsWindow?.show());
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function registerHotkey() {
  if (registeredHotkey) globalShortcut.unregister(registeredHotkey);
  registeredHotkey = null;
  hotkeyError = null;
  try {
    if (globalShortcut.register(settings.hotkey, toggleAll)) {
      registeredHotkey = settings.hotkey;
    } else {
      hotkeyError = "Сочетание уже занято другой программой";
    }
  } catch {
    hotkeyError = "Некорректное сочетание клавиш";
  }
}

// ---------------------------------------------------------------------------
// Трей
// ---------------------------------------------------------------------------

function appIcon() {
  return nativeImage.createFromPath(path.join(BUILD_DIR, "icon.png"));
}

function createTray() {
  const image = nativeImage.createFromPath(path.join(BUILD_DIR, "tray.png"));
  tray = new Tray(image.isEmpty() ? appIcon().resize({ width: 16, height: 16 }) : image);
  tray.setToolTip("Squidify — виджет Spotify");
  tray.on("click", toggleAll);
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray) return;
  const anyVisible = [...windows.values()].some((w) => !w.isDestroyed() && w.isVisible());
  const widgetItems: MenuItemConstructorOptions[] =
    settings.widgets.length > 1
      ? settings.widgets.map((w) => ({
          label: w.name,
          type: "checkbox" as const,
          checked: windowOf(w.id)?.isVisible() ?? false,
          enabled: Boolean(w.url),
          click: (item) => setVisible(w.id, item.checked),
        }))
      : [];
  const template: MenuItemConstructorOptions[] = [
    {
      label: anyVisible ? "Скрыть все виджеты" : "Показать все виджеты",
      click: toggleAll,
      accelerator: registeredHotkey ?? undefined,
    },
    ...widgetItems,
    { type: "separator" },
    {
      label: "Поверх всех окон",
      type: "checkbox",
      checked: settings.alwaysOnTop,
      click: (item) => updateSettings({ alwaysOnTop: item.checked }),
    },
    {
      label: "Зафиксировать положение",
      type: "checkbox",
      checked: settings.locked,
      click: (item) => updateSettings({ locked: item.checked }),
    },
    {
      label: "Пропускать клики сквозь виджеты",
      type: "checkbox",
      checked: settings.clickThrough,
      enabled: settings.locked,
      click: (item) => updateSettings({ clickThrough: item.checked }),
    },
    { type: "separator" },
    { label: "Обновить виджеты", click: () => reloadWidgets() },
    {
      label: "Вернуть окна на экран",
      click: () => {
        const primary = screen.getPrimaryDisplay().workArea;
        settings.widgets.forEach((w, index) => {
          const win = windowOf(w.id);
          if (!win) return;
          const [width, height] = win.getSize();
          const b = defaultBounds(primary, width, height);
          b.y += (index * 150) % Math.max(1, primary.height - 48);
          win.setBounds(b);
          updateEntry(w.id, { bounds: b }, false);
        });
      },
    },
    { label: "Настройки…", click: showSettings },
    { type: "separator" },
    {
      label: "Выход",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function reloadWidgets(id?: string) {
  for (const [wid, win] of windows) {
    if (!win.isDestroyed() && (typeof id !== "string" || wid === id)) win.webContents.send("shell:reload");
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function readSize(size: unknown): { width: number; height: number } | null {
  const s = size as { width?: unknown; height?: unknown };
  return typeof s?.width === "number" && typeof s?.height === "number" ? { width: s.width, height: s.height } : null;
}

function registerIpc() {
  ipcMain.on("shell:resize", (event, size: unknown) => {
    const id = shellSenderId(event);
    const s = readSize(size);
    if (!id || !s || settings.locked) return;
    // Ручное изменение размера отключает автоподбор.
    if (settings.autoSize) updateSettings({ autoSize: false });
    resizeWidget(id, s.width, s.height);
  });

  ipcMain.on("shell:auto-size", (event, size: unknown) => {
    const id = shellSenderId(event);
    const s = readSize(size);
    if (!id || !s || !settings.autoSize) return;
    resizeWidget(id, s.width, s.height);
  });

  // Перетаскивание окна делаем сами: -webkit-app-region ненадёжно работает после смены размера.
  ipcMain.on("shell:move-start", (event) => {
    const id = shellSenderId(event);
    const win = id ? windowOf(id) : null;
    if (!id || !win || settings.locked) return;
    drags.set(id, win.getBounds());
  });
  ipcMain.on("shell:move", (event, delta: unknown) => {
    const id = shellSenderId(event);
    const win = id ? windowOf(id) : null;
    const start = id ? drags.get(id) : undefined;
    if (!win || !start || settings.locked) return;
    const d = delta as { dx?: unknown; dy?: unknown };
    if (typeof d?.dx !== "number" || typeof d?.dy !== "number") return;
    // Размер задаём явно: при дробном масштабе Windows setPosition может его сдвигать.
    win.setBounds({
      x: Math.round(start.x + d.dx),
      y: Math.round(start.y + d.dy),
      width: start.width,
      height: start.height,
    });
  });
  ipcMain.on("shell:move-end", (event) => {
    const id = shellSenderId(event);
    if (id) drags.delete(id);
  });

  // Разовая подгонка окна под виджет по просьбе пользователя, без включения автоподбора.
  ipcMain.on("shell:fit-size", (event, size: unknown) => {
    const id = shellSenderId(event);
    const s = readSize(size);
    if (!id || !s || settings.locked) return;
    resizeWidget(id, s.width, s.height);
  });

  ipcMain.on("shell:ready", (event) => {
    const id = shellSenderId(event);
    if (id) sendShellState(id);
  });

  ipcMain.handle("settings:get", (event) => {
    if (!isTrustedSettings(event)) throw new Error("forbidden");
    return publicSettings();
  });

  ipcMain.handle("settings:update", (event, patch: unknown) => {
    if (!isTrustedSettings(event)) throw new Error("forbidden");
    const p = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
    const next: Partial<Omit<Settings, "widgets">> = {};
    for (const key of ["alwaysOnTop", "locked", "clickThrough", "autoSize", "openAtLogin"] as const) {
      if (typeof p[key] === "boolean") next[key] = p[key] as boolean;
    }
    if ("hotkey" in p) {
      if (!isValidHotkey(p.hotkey)) return { ok: false, error: "Некорректное сочетание клавиш" };
      next.hotkey = p.hotkey;
    }
    updateSettings(next);
    return { ok: true, settings: publicSettings() };
  });

  ipcMain.handle("widgets:add", (event) => {
    if (!isTrustedSettings(event)) throw new Error("forbidden");
    const result = addWidget(null);
    return result.ok ? { ok: true, settings: publicSettings() } : result;
  });

  ipcMain.handle("widgets:remove", (event, id: unknown) => {
    if (!isTrustedSettings(event)) throw new Error("forbidden");
    if (typeof id !== "string" || !removeWidget(id)) return { ok: false, error: "Последний виджет удалить нельзя." };
    return { ok: true, settings: publicSettings() };
  });

  ipcMain.handle("widgets:update", (event, id: unknown, patch: unknown) => {
    if (!isTrustedSettings(event)) throw new Error("forbidden");
    if (typeof id !== "string" || !entryOf(id)) return { ok: false, error: "Такого виджета нет." };
    const p = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
    const next: Partial<WidgetEntry> = {};
    if ("url" in p) {
      if (p.url === null || p.url === "") {
        next.url = null;
      } else {
        const location = typeof p.url === "string" ? parseWidgetUrl(p.url) : null;
        if (!location) return { ok: false, error: "Это не ссылка на виджет Squidify. Скопируйте её на сайте." };
        next.url = location.href;
      }
    }
    if (typeof p.name === "string" && p.name.trim()) next.name = p.name.trim().slice(0, 40);
    updateEntry(id, next);
    if (next.url) setVisible(id, true);
    if (typeof p.width === "number" && typeof p.height === "number") resizeWidget(id, p.width, p.height);
    return { ok: true, settings: publicSettings() };
  });

  ipcMain.handle("settings:action", (event, action: unknown, id: unknown) => {
    if (!isTrustedSettings(event)) throw new Error("forbidden");
    const wid = typeof id === "string" && entryOf(id) ? id : undefined;
    switch (action) {
      case "toggle":
        if (wid) setVisible(wid, !(windowOf(wid)?.isVisible() ?? false));
        else toggleAll();
        break;
      case "reload":
        reloadWidgets(wid);
        break;
      case "fit-window":
        if (wid) windowOf(wid)?.webContents.send("shell:fit");
        break;
      case "open-site": {
        const entry = (wid ? entryOf(wid) : undefined) ?? settings.widgets.find((w) => w.url);
        const widget = entry?.url ? parseWidgetUrl(entry.url) : null;
        if (widget) {
          const site = new URL(widget.href);
          site.hash = "";
          site.pathname = site.pathname.replace(/w\/?$/, "app/");
          void shell.openExternal(site.toString());
        }
        break;
      }
      case "quit":
        quitting = true;
        app.quit();
        break;
    }
    return publicSettings();
  });
}

// ---------------------------------------------------------------------------
// Запуск
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  settings = loadSettings();
  Menu.setApplicationMenu(null);
  hardenSession();
  registerIpc();
  for (const entry of settings.widgets) createWidgetWindow(entry);
  createTray();
  registerHotkey();
  rebuildTrayMenu();

  // Окна «поверх всех» Windows иногда опускает под соседнее окно, особенно после клика сквозь виджет.
  // moveTop не забирает фокус, поэтому можно безопасно поднимать окна раз в пару секунд.
  setInterval(() => {
    if (!settings.alwaysOnTop) return;
    for (const win of windows.values()) {
      if (!win.isDestroyed() && win.isVisible()) win.moveTop();
    }
  }, 2000);

  // После сна связь могла пропасть — обновляем страницы виджетов.
  powerMonitor.on("resume", () => reloadWidgets());

  const link = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (link) void handleProtocolLink(link);
  else if (!settings.widgets.some((w) => w.url)) showSettings();
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("will-quit", () => globalShortcut.unregisterAll());

// Приложение живёт в трее и не закрывается вместе с окнами.
app.on("window-all-closed", () => undefined);
