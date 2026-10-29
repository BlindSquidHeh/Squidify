// Настройки окна, сохраняемые между запусками. Чистые функции без Electron.

import { parseWidgetUrl } from "./url";

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Settings {
  widgetUrl: string | null;
  bounds: Bounds | null;
  alwaysOnTop: boolean;
  locked: boolean;
  clickThrough: boolean;
  autoSize: boolean;
  visible: boolean;
  hotkey: string;
  openAtLogin: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  widgetUrl: null,
  bounds: null,
  alwaysOnTop: true,
  locked: false,
  clickThrough: false,
  autoSize: true,
  visible: true,
  hotkey: "CommandOrControl+Alt+S",
  openAtLogin: false,
};

export const MIN_SIZE = { width: 80, height: 40 };
export const MAX_SIZE = { width: 3840, height: 2160 };

const HOTKEY_RE = /^(?:(?:CommandOrControl|CmdOrCtrl|Control|Ctrl|Alt|Option|Shift|Super|Meta)\+){1,3}(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Home|End|PageUp|PageDown|Insert|Delete)$/i;

export function isValidHotkey(value: unknown): value is string {
  return typeof value === "string" && value.length <= 60 && HOTKEY_RE.test(value);
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

export function sanitizeSettings(input: unknown): Settings {
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const d = DEFAULT_SETTINGS;
  const widget = typeof src.widgetUrl === "string" ? parseWidgetUrl(src.widgetUrl) : null;
  return {
    widgetUrl: widget ? widget.href : null,
    bounds: sanitizeBounds(src.bounds),
    alwaysOnTop: bool(src.alwaysOnTop, d.alwaysOnTop),
    locked: bool(src.locked, d.locked),
    clickThrough: bool(src.clickThrough, d.clickThrough),
    autoSize: bool(src.autoSize, d.autoSize),
    visible: bool(src.visible, d.visible),
    hotkey: isValidHotkey(src.hotkey) ? src.hotkey : d.hotkey,
    openAtLogin: bool(src.openAtLogin, d.openAtLogin),
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
