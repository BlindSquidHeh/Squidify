import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, ensureVisible, isValidHotkey, sanitizeSettings } from "./settings";

const primary = { x: 0, y: 0, width: 1920, height: 1040 };

describe("sanitizeSettings", () => {
  it("значения по умолчанию для мусора", () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ alwaysOnTop: "yes", hotkey: "rm -rf" })).toEqual(DEFAULT_SETTINGS);
  });

  it("отбрасывает недопустимую ссылку и ограничивает размер окна", () => {
    const s = sanitizeSettings({ widgetUrl: "https://evil.com/", bounds: { x: 10, y: 20, width: 99999, height: 1 } });
    expect(s.widgets).toHaveLength(1);
    expect(s.widgets[0].url).toBeNull();
    expect(s.widgets[0].bounds).toEqual({ x: 10, y: 20, width: 3840, height: 40 });
  });

  it("переносит единственный виджет из настроек старой версии", () => {
    const token = "a".repeat(64);
    const s = sanitizeSettings({ widgetUrl: `https://u.github.io/Squidify/w/#${token}`, visible: false });
    expect(s.widgets).toHaveLength(1);
    expect(s.widgets[0]).toMatchObject({ id: "main", url: `https://u.github.io/Squidify/w/#${token}`, visible: false });
  });

  it("хранит несколько виджетов, чинит повторяющиеся id и ограничивает их число", () => {
    const token = "b".repeat(64);
    const url = `https://u.github.io/Squidify/w/#${token}`;
    const many = Array.from({ length: 30 }, () => ({ id: "same", name: "  ", url }));
    const s = sanitizeSettings({ widgets: many });
    expect(s.widgets).toHaveLength(12);
    expect(new Set(s.widgets.map((w) => w.id)).size).toBe(12);
    expect(s.widgets[0].name).toBe("Виджет 1");
  });
});

describe("ensureVisible", () => {
  it("оставляет окно на месте, если оно видно", () => {
    const b = { x: 100, y: 100, width: 400, height: 120 };
    expect(ensureVisible(b, [primary], primary)).toEqual(b);
  });

  it("возвращает окно с отключённого монитора", () => {
    const b = { x: 3000, y: 100, width: 400, height: 120 };
    const fixed = ensureVisible(b, [primary], primary);
    expect(fixed.x).toBe(1920 - 400 - 24);
    expect(fixed.y).toBe(24);
  });
});

describe("isValidHotkey", () => {
  it("принимает сочетания Electron", () => {
    expect(isValidHotkey("CommandOrControl+Alt+S")).toBe(true);
    expect(isValidHotkey("Ctrl+Shift+F12")).toBe(true);
  });
  it("отклоняет одиночные клавиши и мусор", () => {
    expect(isValidHotkey("S")).toBe(false);
    expect(isValidHotkey("Ctrl+")).toBe(false);
    expect(isValidHotkey(42)).toBe(false);
  });
});
