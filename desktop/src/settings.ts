// Настройки окна, сохраняемые между запусками. Чистые функции без Electron.

import { parseWidgetUrl } from "./url";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Одно окно виджета на рабочем столе. */
export interface WidgetEntry {
  id: string;
  name: string;
  url: string | null;
  bounds: Bounds | null;
  visible: boolean;
  /** desktop — обычное окно; taskbar — над панелью задач, видно только пока видна панель. */
  placement: "desktop" | "taskbar";
  /** Эти четыре настройки у каждого виджета свои. */
  alwaysOnTop: boolean;
  locked: boolean;
  clickThrough: boolean;
  autoSize: boolean;
}

export interface Settings {
  widgets: WidgetEntry[];
  hotkey: string;
  openAtLogin: boolean;
  /** Видеокарта в окнах виджетов. Выключена: на части ПК с ней прозрачные окна становятся серыми и мигают. */
  gpu: boolean;
  /** Кадров в секунду у анимаций виджета. 0 — без анимаций, 60 — как есть. Чем меньше, тем меньше нагрузка. */
  animationFps: 0 | 15 | 20 | 30 | 60;
}

export const MAX_WIDGETS = 12;

export function newWidgetId(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, "0");
}

export function defaultWidgetName(index: number): string {
  return `Виджет ${index + 1}`;
}

export const WIDGET_FLAG_DEFAULTS = { alwaysOnTop: true, locked: false, clickThrough: false, autoSize: true };

export function newWidgetEntry(id: string, name: string, url: string | null): WidgetEntry {
  return { id, name, url, bounds: null, visible: true, placement: "desktop", ...WIDGET_FLAG_DEFAULTS };
}

export const DEFAULT_SETTINGS: Settings = {
  widgets: [newWidgetEntry("main", defaultWidgetName(0), null)],
  hotkey: "CommandOrControl+Alt+S",
  openAtLogin: false,
  gpu: false,
  animationFps: 20,
};

export const MIN_SIZE = { width: 80, height: 40 };
export const MAX_SIZE = { width: 3840, height: 2160 };

const HOTKEY_RE = /^(?:(?:CommandOrControl|CmdOrCtrl|Control|Ctrl|Alt|Option|Shift|Super|Meta)\+){1,3}(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Home|End|PageUp|PageDown|Insert|Delete)$/i;

export function isValidHotkey(value: unknown): value is string {
  return typeof value === "string" && value.length <= 60 && HOTKEY_RE.test(value);
}

const FPS_VALUES = [0, 15, 20, 30, 60] as const;

function sanitizeFps(value: unknown, legacyEconomy: unknown): Settings["animationFps"] {
  const found = FPS_VALUES.find((v) => v === value);
  if (found !== undefined) return found;
  return legacyEconomy === true ? 0 : DEFAULT_SETTINGS.animationFps;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function clampSize(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.round(Math.min(MAX_SIZE.width, Math.max(MIN_SIZE.width, width))),
    height: Math.round(Math.min(MAX_SIZE.height, Math.max(MIN_SIZE.height, height))),
  };
}

function sanitizeBounds(value: unknown): Bounds | null {
  if (!value || typeof value !== "object") return null;
  const b = value as Record<string, unknown>;
  const nums = [b.x, b.y, b.width, b.height];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const size = clampSize(b.width as number, b.height as number);
  return { x: Math.round(b.x as number), y: Math.round(b.y as number), ...size };
}

function sanitizeWidgets(input: unknown, legacy: Record<string, unknown>): WidgetEntry[] {
  const list: unknown[] = Array.isArray(input)
    ? input
    : // Настройки старой версии: один виджет в полях widgetUrl, bounds, visible.
      [{ id: "main", url: legacy.widgetUrl, bounds: legacy.bounds, visible: legacy.visible }];
  const seen = new Set<string>();
  const widgets: WidgetEntry[] = [];
  for (const raw of list.slice(0, MAX_WIDGETS)) {
    const w = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const location = typeof w.url === "string" ? parseWidgetUrl(w.url) : null;
    let id = typeof w.id === "string" && /^[a-z0-9]{4,16}$/.test(w.id) ? w.id : newWidgetId();
    while (seen.has(id)) id = newWidgetId();
    seen.add(id);
    const name = typeof w.name === "string" && w.name.trim() ? w.name.trim().slice(0, 40) : defaultWidgetName(widgets.length);
    widgets.push({
      id,
      name,
      url: location ? location.href : null,
      bounds: sanitizeBounds(w.bounds),
      visible: bool(w.visible, true),
      placement: w.placement === "taskbar" ? "taskbar" : "desktop",
      // Старые настройки хранили эти флаги один раз для всех виджетов.
      alwaysOnTop: bool(w.alwaysOnTop, bool(legacy.alwaysOnTop, WIDGET_FLAG_DEFAULTS.alwaysOnTop)),
      locked: bool(w.locked, bool(legacy.locked, WIDGET_FLAG_DEFAULTS.locked)),
      clickThrough: bool(w.clickThrough, bool(legacy.clickThrough, WIDGET_FLAG_DEFAULTS.clickThrough)),
      autoSize: bool(w.autoSize, bool(legacy.autoSize, WIDGET_FLAG_DEFAULTS.autoSize)),
    });
  }
  return widgets.length > 0 ? widgets : DEFAULT_SETTINGS.widgets.map((w) => ({ ...w }));
}

export function sanitizeSettings(input: unknown): Settings {
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  return {
    widgets: sanitizeWidgets(src.widgets, src),
    hotkey: isValidHotkey(src.hotkey) ? src.hotkey : d.hotkey,
    openAtLogin: bool(src.openAtLogin, d.openAtLogin),
    gpu: bool(src.gpu, d.gpu),
    animationFps: sanitizeFps(src.animationFps, src.economy),
  };
}

export interface DisplayArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Если сохранённое положение окна оказалось за пределами экранов (например,
 * отключили второй монитор), возвращаем окно в правый верхний угол основного экрана.
 */
export function ensureVisible(bounds: Bounds, displays: DisplayArea[], primary: DisplayArea): Bounds {
  const minVisible = 40;
  const visible = displays.some((d) => {
    const overlapX = Math.min(bounds.x + bounds.width, d.x + d.width) - Math.max(bounds.x, d.x);
    const overlapY = Math.min(bounds.y + bounds.height, d.y + d.height) - Math.max(bounds.y, d.y);
    return overlapX >= minVisible && overlapY >= minVisible;
  });
  if (visible) return bounds;
  return defaultBounds(primary, bounds.width, bounds.height);
}

export function defaultBounds(primary: DisplayArea, width = 460, height = 140): Bounds {
  const size = clampSize(Math.min(width, primary.width), Math.min(height, primary.height));
  return {
    x: primary.x + primary.width - size.width - 24,
    y: primary.y + 24,
    ...size,
  };
}
