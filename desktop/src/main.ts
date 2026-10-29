// Главный процесс Squidify Desktop.
//
// Окно виджета — прозрачное, без рамки, поверх других окон. Оно загружает
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
  type WebContents,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadSettings, saveSettings } from "./store";
import {
  clampSize,
  defaultBounds,
  ensureVisible,
  isValidHotkey,
  type Bounds,
  type Settings,
} from "./settings";
import { isAllowedExternalUrl, parseProtocolUrl, parseWidgetUrl, sameOrigin, type WidgetLocation } from "./url";

const PROTOCOL = "squidify";
const STATIC_DIR = path.join(__dirname, "..", "static");
const BUILD_DIR = path.join(__dirname, "..", "build");
const SHELL_URL = pathToFileURL(path.join(STATIC_DIR, "shell.html")).toString();
const SETTINGS_URL = pathToFileURL(path.join(STATIC_DIR, "settings.html")).toString();
const WIDGET_PARTITION = "persist:squidify-widget";

let settings: Settings;
let widgetWindow: BrowserWindow | null = null;
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
  const { response } = await dialog.showMessageBox({
    type: "question",
    title: "Squidify",
    message: "Открыть этот виджет в окне?",
    detail: `${location.origin}\n\nТекущий виджет в окне будет заменён.`,
    buttons: ["Открыть", "Отмена"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) setWidgetUrl(location);
}

// ---------------------------------------------------------------------------
// Безопасность WebContents
// ---------------------------------------------------------------------------

function currentWidget(): WidgetLocation | null {
  return settings.widgetUrl ? parseWidgetUrl(settings.widgetUrl) : null;
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
    // Вложенный фрейм может открывать только страницу виджета с того же сайта.
    const widget = currentWidget();
    if (!widget || !sameOrigin(url, widget.origin)) {
      event.preventDefault();
      if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    }
  });

  contents.on("will-attach-webview", (event) => event.preventDefault());
}

app.on("web-contents-created", (_event, contents) => hardenWebContents(contents));

function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent, win: BrowserWindow | null, url: string): boolean {
  return Boolean(win && !win.isDestroyed() && event.sender === win.webContents && event.senderFrame?.url === url);
}

// ---------------------------------------------------------------------------
// Окно виджета
// ---------------------------------------------------------------------------

function initialBounds(): Bounds {
  const primary = screen.getPrimaryDisplay().workArea;
  if (!settings.bounds) return defaultBounds(primary);
  return ensureVisible(
    settings.bounds,
    screen.getAllDisplays().map((d) => d.workArea),
    primary,
  );
}

function createWidgetWindow() {
  const bounds = initialBounds();
  widgetWindow = new BrowserWindow({
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

  applyWindowFlags();
  void widgetWindow.loadURL(SHELL_URL);

  widgetWindow.once("ready-to-show", () => {
    if (settings.visible && settings.widgetUrl) widgetWindow?.showInactive();
  });

  let saveTimer: NodeJS.Timeout | undefined;
  const persistBounds = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!widgetWindow || widgetWindow.isDestroyed()) return;
      updateSettings({ bounds: widgetWindow.getBounds() }, false);
    }, 400);
  };
  widgetWindow.on("moved", persistBounds);
  widgetWindow.on("resized", persistBounds);
  widgetWindow.on("move", persistBounds);

  widgetWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      setVisible(false);
    }
  });
  widgetWindow.on("closed", () => {
    widgetWindow = null;
  });
}

function applyWindowFlags() {
  if (!widgetWindow) return;
  // Уровень screen-saver держит окно поверх полноэкранных окон в оконном режиме.
  widgetWindow.setAlwaysOnTop(settings.alwaysOnTop, "screen-saver");
  widgetWindow.setVisibleOnAllWorkspaces(settings.alwaysOnTop, { visibleOnFullScreen: true });
  widgetWindow.setMovable(!settings.locked);
  widgetWindow.setIgnoreMouseEvents(settings.locked && settings.clickThrough, { forward: true });
  sendShellState();
}

function sendShellState() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  widgetWindow.webContents.send("shell:state", {
    url: settings.widgetUrl,
    locked: settings.locked,
    autoSize: settings.autoSize,
  });
}

function setVisible(visible: boolean) {
  if (!widgetWindow) return;
  if (visible) {
    if (!settings.widgetUrl) {
      showSettings();
      return;
    }
    widgetWindow.showInactive();
  } else {
    widgetWindow.hide();
  }
  updateSettings({ visible }, false);
}

function toggleVisible() {
  setVisible(!(widgetWindow?.isVisible() ?? false));
}

function setWidgetUrl(location: WidgetLocation | null) {
  updateSettings({ widgetUrl: location ? location.href : null });
  if (location) setVisible(true);
}

function resizeWidget(width: number, height: number) {
  if (!widgetWindow) return;
  const size = clampSize(width, height);
  const [x, y] = widgetWindow.getPosition();
  widgetWindow.setBounds({ x, y, ...size });
}

// ---------------------------------------------------------------------------
// Настройки
// ---------------------------------------------------------------------------

function updateSettings(patch: Partial<Settings>, refresh = true) {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  if (refresh) {
    if ("alwaysOnTop" in patch || "locked" in patch || "clickThrough" in patch) applyWindowFlags();
    else if ("widgetUrl" in patch || "autoSize" in patch) sendShellState();
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
    hotkeyError,
    version: app.getVersion(),
    windowSize: widgetWindow ? widgetWindow.getSize() : null,
  };
}

function showSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 560,
    height: 720,
    minWidth: 440,
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
    if (globalShortcut.register(settings.hotkey, toggleVisible)) {
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
  tray.on("click", toggleVisible);
  rebuildTrayMenu();
}

function rebuildTrayMenu() {
  if (!tray) return;
  const visible = widgetWindow?.isVisible() ?? false;
  const template: MenuItemConstructorOptions[] = [
    { label: visible ? "Скрыть виджет" : "Показать виджет", click: toggleVisible, accelerator: registeredHotkey ?? undefined },
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
      label: "Пропускать клики сквозь виджет",
      type: "checkbox",
      checked: settings.clickThrough,
      enabled: settings.locked,
      click: (item) => updateSettings({ clickThrough: item.checked }),
    },
    { type: "separator" },
    { label: "Обновить виджет", click: () => widgetWindow?.webContents.send("shell:reload") },
    {
      label: "Вернуть окно на экран",
      click: () => {
        const b = defaultBounds(screen.getPrimaryDisplay().workArea, ...(widgetWindow?.getSize() ?? [460, 140]));
        widgetWindow?.setBounds(b);
        updateSettings({ bounds: b }, false);
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

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

function registerIpc() {
  ipcMain.on("shell:resize", (event, size: unknown) => {
    if (!isTrustedSender(event, widgetWindow, SHELL_URL) || settings.locked) return;
    const s = size as { width?: unknown; height?: unknown };
    if (typeof s?.width !== "number" || typeof s?.height !== "number") return;
    // Ручное изменение размера отключает автоподбор.
    if (settings.autoSize) updateSettings({ autoSize: false });
    resizeWidget(s.width, s.height);
  });

  ipcMain.on("shell:auto-size", (event, size: unknown) => {
    if (!isTrustedSender(event, widgetWindow, SHELL_URL) || !settings.autoSize) return;
    const s = size as { width?: unknown; height?: unknown };
    if (typeof s?.width !== "number" || typeof s?.height !== "number") return;
    resizeWidget(s.width, s.height);
  });

  ipcMain.on("shell:ready", (event) => {
    if (isTrustedSender(event, widgetWindow, SHELL_URL)) sendShellState();
  });

  ipcMain.handle("settings:get", (event) => {
    if (!isTrustedSender(event, settingsWindow, SETTINGS_URL)) throw new Error("forbidden");
    return publicSettings();
  });

  ipcMain.handle("settings:update", (event, patch: unknown) => {
    if (!isTrustedSender(event, settingsWindow, SETTINGS_URL)) throw new Error("forbidden");
    const p = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
    const next: Partial<Settings> = {};

    if ("widgetUrl" in p) {
      if (p.widgetUrl === null || p.widgetUrl === "") {
        next.widgetUrl = null;
      } else {
        const location = typeof p.widgetUrl === "string" ? parseWidgetUrl(p.widgetUrl) : null;
        if (!location) return { ok: false, error: "Это не ссылка на виджет Squidify. Скопируйте её на сайте." };
        next.widgetUrl = location.href;
      }
    }
    for (const key of ["alwaysOnTop", "locked", "clickThrough", "autoSize", "openAtLogin"] as const) {
      if (typeof p[key] === "boolean") next[key] = p[key] as boolean;
    }
    if ("hotkey" in p) {
      if (!isValidHotkey(p.hotkey)) return { ok: false, error: "Некорректное сочетание клавиш" };
      next.hotkey = p.hotkey;
    }
    updateSettings(next);
    if (next.widgetUrl) setVisible(true);
    if (typeof p.width === "number" && typeof p.height === "number") resizeWidget(p.width, p.height);
    return { ok: true, settings: publicSettings() };
  });

  ipcMain.handle("settings:action", (event, action: unknown) => {
    if (!isTrustedSender(event, settingsWindow, SETTINGS_URL)) throw new Error("forbidden");
    switch (action) {
      case "toggle":
        toggleVisible();
        break;
      case "reload":
        widgetWindow?.webContents.send("shell:reload");
        break;
      case "open-site": {
        const widget = currentWidget();
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
  createWidgetWindow();
  createTray();
  registerHotkey();
  rebuildTrayMenu();

  widgetWindow?.on("show", rebuildTrayMenu);
  widgetWindow?.on("hide", rebuildTrayMenu);

  // После сна связь могла пропасть — обновляем страницу виджета.
  powerMonitor.on("resume", () => widgetWindow?.webContents.send("shell:reload"));

  const link = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (link) void handleProtocolLink(link);
  else if (!settings.widgetUrl) showSettings();
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("will-quit", () => globalShortcut.unregisterAll());

// Приложение живёт в трее и не закрывается вместе с окнами.
app.on("window-all-closed", () => undefined);
