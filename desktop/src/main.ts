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
  clipboard,
  BrowserWindow,
  webFrameMain,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeTheme,
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
import { spawn, type ChildProcess } from "node:child_process";
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
  newWidgetEntry,
  newWidgetId,
  type Bounds,
  type Settings,
  type WidgetEntry,
} from "./settings";
import { isFullscreenOn, parseSnapshot, taskbarOnDisplay, WATCH_SCRIPT, type ShellSnapshot } from "./shellwatch";
import { isAllowedExternalUrl, parseProtocolUrl, parseWidgetUrl, sameOrigin, type WidgetLocation } from "./url";

const PROTOCOL = "squidify";
const STATIC_DIR = path.join(__dirname, "..", "static");
const BUILD_DIR = path.join(__dirname, "..", "build");
const SHELL_URL = pathToFileURL(path.join(STATIC_DIR, "shell.html")).toString();
const SETTINGS_URL = pathToFileURL(path.join(STATIC_DIR, "settings.html")).toString();
const WIDGET_PARTITION = "persist:squidify-widget";

let settings: Settings;
/** Окна виджетов по id записи в настройках. */
const TRANSPARENT_FRAME_SCRIPT = `(function () {
  var d = document;
  var root = d.documentElement;
  root.classList.add("widget-page");
  var meta = d.querySelector('meta[name="color-scheme"]');
  if (meta) meta.remove();
  var style = d.createElement("style");
  style.textContent = "html, body, #root { color-scheme: normal !important; background: transparent !important; }";
  (d.head || root).appendChild(style);
})();`;

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

// Прозрачные окна на видеокарте у части пользователей рисуются серыми и мигают, поэтому по умолчанию без неё.
// Менять можно в настройках, действует после перезапуска.
if (!loadSettings().gpu) app.disableHardwareAcceleration();

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
      // Полная область мониторов, а не рабочая: виджет на панели задач лежит вне workArea.
      screen.getAllDisplays().map((d) => d.bounds),
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
    alwaysOnTop: entry.alwaysOnTop,
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

  // Серая подложка вокруг виджета появляется, если страница виджета объявила тёмную color-scheme.
  // Страница сама это отключает, но подстраховываемся: приводим вложенную страницу к прозрачной.
  win.webContents.on("did-frame-finish-load", (_event, isMainFrame, processId, routingId) => {
    if (isMainFrame) return;
    webFrameMain.fromId(processId, routingId)?.executeJavaScript(TRANSPARENT_FRAME_SCRIPT).catch(() => undefined);
    refreshTransparency(win);
  });

  win.once("ready-to-show", () => {
    const current = entryOf(entry.id);
    if (current?.visible && current.url && current.placement === "desktop") win.showInactive();
    applyPlacementVisibility();
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
  win.on("move", applyPlacementVisibility);
  win.on("resize", applyPlacementVisibility);

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

/**
 * После перезапуска окно, показанное до первой отрисовки страницы, в Windows нередко остаётся с серой
 * непрозрачной подложкой, а любое изменение размера окна возвращает прозрачность. Поэтому после загрузки
 * страницы окно один раз «встряхивается» на 1 пиксель.
 */
function refreshTransparency(win: BrowserWindow) {
  for (const delay of [300, 1500]) {
    setTimeout(() => {
      if (win.isDestroyed() || !win.isVisible()) return;
      const b = win.getBounds();
      win.setBounds({ ...b, width: b.width + 1 });
      win.setBounds(b);
    }, delay);
  }
}

/**
 * Положение «поверх всех окон» трогаем только когда оно действительно менялось:
 * повторный вызов setAlwaysOnTop при фиксации окна в Windows сбрасывал уровень окна.
 */
function applyWindowFlags(id?: string, topmost = true) {
  for (const [wid, win] of windows) {
    const entry = entryOf(wid);
    if (win.isDestroyed() || !entry || (id && wid !== id)) continue;
    if (topmost) {
      // Уровень screen-saver держит окно поверх полноэкранных окон в оконном режиме.
      win.setAlwaysOnTop(entry.alwaysOnTop, "screen-saver");
      win.setVisibleOnAllWorkspaces(entry.alwaysOnTop, { visibleOnFullScreen: true });
    }
    win.setMovable(!entry.locked);
    win.setIgnoreMouseEvents(entry.locked && entry.clickThrough, { forward: true });
    if (entry.alwaysOnTop && win.isVisible()) win.moveTop();
    sendShellState(wid);
  }
}

function sendShellState(id: string) {
  const win = windowOf(id);
  const entry = entryOf(id);
  if (!win || !entry) return;
  win.webContents.send("shell:state", {
    url: entry.url,
    locked: entry.locked,
    autoSize: entry.autoSize,
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
    if (entry.placement === "desktop") win.showInactive();
  } else {
    win.hide();
  }
  updateEntry(id, { visible }, false);
  applyPlacementVisibility();
}

// ---------------------------------------------------------------------------
// Виджеты на панели задач: видны, только пока видна панель и нет полноэкранной программы
// ---------------------------------------------------------------------------

let shellSnapshot: ShellSnapshot | null = null;
let watcher: ChildProcess | null = null;
let watcherFailures = 0;

function startShellWatcher() {
  if (process.platform !== "win32" || watcher) return;
  const encoded = Buffer.from(WATCH_SCRIPT, "utf16le").toString("base64");
  const child = spawn(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded],
    { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
  );
  watcher = child;
  let buffer = "";
  child.stdout?.setEncoding("utf8");
  child.stdout?.on("data", (chunk: string) => {
    buffer += chunk;
    let index: number;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const snapshot = parseSnapshot(buffer.slice(0, index));
      buffer = buffer.slice(index + 1);
      if (!snapshot) continue;
      watcherFailures = 0;
      shellSnapshot = snapshot;
      applyPlacementVisibility();
    }
  });
  child.on("error", () => undefined);
  child.on("exit", () => {
    watcher = null;
    shellSnapshot = null;
    applyPlacementVisibility();
    // Несколько попыток перезапуска; если PowerShell недоступен, виджеты остаются видимыми всегда.
    if (!quitting && ++watcherFailures <= 3) setTimeout(startShellWatcher, 5000);
  });
}

/** Окно виджета на панели задач показывается только если панель видна и нет полноэкранной программы. */
function applyPlacementVisibility() {
  for (const entry of settings.widgets) {
    if (entry.placement !== "taskbar") continue;
    const win = windowOf(entry.id);
    if (!win) continue;
    const wanted = entry.visible && Boolean(entry.url);
    let show = wanted;
    if (wanted && shellSnapshot) {
      // Виден, пока видна панель того монитора, где стоит виджет (куда бы его ни перетащили).
      const display = screen.getDisplayMatching(win.getBounds());
      const dip = shellSnapshot.taskbars.map((r) => screen.screenToDipRect(null, r));
      const full = shellSnapshot.fullscreenAreas.map((r) => screen.screenToDipRect(null, r));
      show =
        !shellSnapshot.fullscreen &&
        !isFullscreenOn(display.bounds, full) &&
        taskbarOnDisplay(display.bounds, dip) !== null;
    }
    if (show && !win.isVisible()) win.showInactive();
    else if (!show && win.isVisible()) win.hide();
  }
}

/** При выборе «На панели задач» ставит окно на панель его монитора (слева от значков трея). */
function snapToTaskbar(win: BrowserWindow) {
  if (!shellSnapshot) return;
  const b = win.getBounds();
  const display = screen.getDisplayMatching(b);
  const dip = shellSnapshot.taskbars.map((r) => screen.screenToDipRect(null, r));
  const bar = taskbarOnDisplay(display.bounds, dip);
  if (!bar) return;
  const horizontal = bar.width >= bar.height;
  const x = horizontal
    ? Math.max(bar.x, bar.x + bar.width - b.width - 260)
    : bar.x + Math.round((bar.width - b.width) / 2);
  const y = horizontal
    ? bar.y + Math.round((bar.height - b.height) / 2)
    : Math.max(bar.y, bar.y + bar.height - b.height - 160);
  win.setBounds({ x, y, width: b.width, height: b.height });
}

/** Горячая клавиша и клик по трею: если что-то видно, прячем всё, иначе показываем всё. */
function wantsVisible(w: WidgetEntry): boolean {
  const win = windowOf(w.id);
  return w.placement === "taskbar" ? w.visible && Boolean(w.url) : Boolean(win?.isVisible());
}

function toggleAll() {
  const anyVisible = settings.widgets.some(wantsVisible);
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
  const entry = newWidgetEntry(
    newWidgetId(),
    name?.trim() ? name.trim().slice(0, 40) : defaultWidgetName(settings.widgets.length),
    location ? location.href : null,
  );
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
    if ("alwaysOnTop" in patch) applyWindowFlags(id, true);
    else if ("locked" in patch || "clickThrough" in patch) applyWindowFlags(id, false);
    else if ("autoSize" in patch) sendShellState(id);
    rebuildTrayMenu();
    notifySettings();
  }
}

function updateSettings(patch: Partial<Omit<Settings, "widgets">>, refresh = true) {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  if (refresh) {
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
      // Для виджета на панели задач «виден» — это желание пользователя: окно может быть скрыто вместе с панелью.
      const visible = w.placement === "taskbar" ? w.visible && Boolean(w.url) : win ? win.isVisible() : false;
      return { ...w, visible, windowSize: win ? win.getSize() : null };
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
  const anyVisible = settings.widgets.some(wantsVisible);
  const widgetItems: MenuItemConstructorOptions[] =
    settings.widgets.length > 1
      ? settings.widgets.map((w) => ({
          label: w.name,
          type: "checkbox" as const,
          checked: wantsVisible(w),
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

/** Страница виджета обновляется на сайте, поэтому старую копию из HTTP-кэша держать нельзя. */
function clearWidgetCache(): Promise<void> {
  return session.fromPartition(WIDGET_PARTITION).clearCache().catch(() => undefined);
}

async function reloadWidgets(id?: string) {
  await clearWidgetCache();
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
    const entry = id ? entryOf(id) : undefined;
    if (!id || !s || !entry || entry.locked) return;
    // Ручное изменение размера отключает автоподбор.
    if (entry.autoSize) updateEntry(id, { autoSize: false });
    resizeWidget(id, s.width, s.height);
  });

  ipcMain.on("shell:auto-size", (event, size: unknown) => {
    const id = shellSenderId(event);
    const s = readSize(size);
    if (!id || !s || !entryOf(id)?.autoSize) return;
    resizeWidget(id, s.width, s.height);
  });

  // Перетаскивание окна делаем сами: -webkit-app-region ненадёжно работает после смены размера.
  ipcMain.on("shell:move-start", (event) => {
    const id = shellSenderId(event);
    const win = id ? windowOf(id) : null;
    if (!id || !win || entryOf(id)?.locked) return;
    drags.set(id, win.getBounds());
  });
  ipcMain.on("shell:move", (event, delta: unknown) => {
    const id = shellSenderId(event);
    const win = id ? windowOf(id) : null;
    const start = id ? drags.get(id) : undefined;
    if (!id || !win || !start || entryOf(id)?.locked) return;
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
    if (!id || !s || entryOf(id)?.locked) return;
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
    if (typeof p.openAtLogin === "boolean") next.openAtLogin = p.openAtLogin;
    if (typeof p.gpu === "boolean") next.gpu = p.gpu;
    if ("hotkey" in p) {
      if (!isValidHotkey(p.hotkey)) return { ok: false, error: "Некорректное сочетание клавиш" };
      next.hotkey = p.hotkey;
    }
    updateSettings(next);
    return { ok: true, settings: publicSettings() };
  });

  // Сведения для разбора проблем с отображением: пользователь вставляет их в чат одним нажатием.
  ipcMain.handle("settings:diagnostics", async (event) => {
    if (!isTrustedSettings(event)) throw new Error("forbidden");
    const lines: string[] = [
      `Squidify ${app.getVersion()}, Electron ${process.versions.electron}, Chromium ${process.versions.chrome}`,
      `Windows ${process.getSystemVersion()}, тёмная тема системы: ${nativeTheme.shouldUseDarkColors}`,
      `Видеокарта в настройках: ${settings.gpu}; состояние: ${JSON.stringify(app.getGPUFeatureStatus())}`,
      `Мониторы: ${JSON.stringify(screen.getAllDisplays().map((d) => ({ b: d.bounds, f: d.scaleFactor })))}`,
    ];
    for (const entry of settings.widgets) {
      const win = windowOf(entry.id);
      lines.push(`Виджет ${entry.name}: ${entry.placement}, окно ${win ? JSON.stringify(win.getBounds()) : "нет"}, фон окна ${win?.getBackgroundColor()}`);
      if (!win) continue;
      for (const frame of win.webContents.mainFrame.frames) {
        try {
          const info = await frame.executeJavaScript(`(function () {
            var r = document.documentElement;
            var cs = getComputedStyle(r);
            return JSON.stringify({
              className: r.className,
              colorScheme: cs.colorScheme,
              htmlBg: cs.backgroundColor,
              bodyBg: getComputedStyle(document.body).backgroundColor,
              meta: !!document.querySelector('meta[name="color-scheme"]'),
              prefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
              size: innerWidth + "x" + innerHeight
            });
          })()`);
          lines.push(`  страница: ${info}`);
        } catch (error) {
          lines.push(`  страница: ошибка ${String(error)}`);
        }
      }
    }
    const text = lines.join("\n");
    clipboard.writeText(text);
    return text;
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
    if (p.placement === "desktop" || p.placement === "taskbar") next.placement = p.placement;
    for (const key of ["alwaysOnTop", "locked", "clickThrough", "autoSize"] as const) {
      if (typeof p[key] === "boolean") next[key] = p[key] as boolean;
    }
    updateEntry(id, next);
    if (next.placement) {
      // Переход с панели задач на рабочий стол возвращает окно, если оно было скрыто вместе с панелью.
      const entry = entryOf(id);
      const win = windowOf(id);
      if (entry && win && next.placement === "desktop" && entry.visible && entry.url) win.showInactive();
      if (win && next.placement === "taskbar") snapToTaskbar(win);
      applyPlacementVisibility();
    }
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

app.whenReady().then(async () => {
  settings = loadSettings();
  Menu.setApplicationMenu(null);
  hardenSession();
  registerIpc();
  // Без этого после обновления сайта окно могло показывать старую версию страницы до 10 минут.
  await clearWidgetCache();
  for (const entry of settings.widgets) createWidgetWindow(entry);
  createTray();
  registerHotkey();
  rebuildTrayMenu();
  startShellWatcher();

  // Окна «поверх всех» Windows иногда опускает под соседнее окно (панель задач, другое окно «поверх»).
  // moveTop не забирает фокус и для окна, которое уже наверху, ничего не меняет, поэтому его можно
  // вызывать часто: так виджет возвращается почти мгновенно, а не мигает раз в пару секунд.
  setInterval(() => {
    for (const [id, win] of windows) {
      if (!win.isDestroyed() && win.isVisible() && entryOf(id)?.alwaysOnTop) win.moveTop();
    }
  }, 150);

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
