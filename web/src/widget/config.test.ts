import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, mergeConfig, normalizeConfig, suggestedSourceSize } from "./config";
import { BUILT_IN_PRESETS } from "./presets";

describe("normalizeConfig", () => {
  it("возвращает значения по умолчанию для пустого и некорректного ввода", () => {
    expect(normalizeConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig("строка")).toEqual(DEFAULT_CONFIG);
    expect(normalizeConfig([1, 2, 3])).toEqual(DEFAULT_CONFIG);
  });

  it("ограничивает числа диапазонами", () => {
    const c = normalizeConfig({ size: { width: 99999, padding: -5 }, cover: { radius: 50, size: 1 } });
    expect(c.size.width).toBe(1920);
    expect(c.size.padding).toBe(0);
    // Spotify: скругление обложки не больше 8px.
    expect(c.cover.radius).toBe(8);
    expect(c.cover.size).toBe(24);
  });

  it("не пропускает CSS-инъекции через цвета и шрифты", () => {
    const c = normalizeConfig({
      colors: { title: "red; background: url(https://evil)" },
      background: { color: "#12345g" },
      text: { font: "Comic Sans'; } body { display:none" },
    });
    expect(c.colors.title).toBe(DEFAULT_CONFIG.colors.title);
    expect(c.background.color).toBe(DEFAULT_CONFIG.background.color);
    expect(c.text.font).toBe(DEFAULT_CONFIG.text.font);
  });

  it("принимает корректные цвета в разных форматах", () => {
    const c = normalizeConfig({ colors: { title: "#FFF", artist: "#11223344" } });
    expect(c.colors.title).toBe("#fff");
    expect(c.colors.artist).toBe("#11223344");
  });

  it("не даёт сделать значок Spotify меньше 21px", () => {
    expect(normalizeConfig({ attribution: { size: 8 } }).attribution.size).toBe(21);
  });

  it("убирает управляющие символы и ограничивает длину сообщения", () => {
    const c = normalizeConfig({ behavior: { idleMessage: "a\u0000b".padEnd(500, "x") } });
    expect(c.behavior.idleMessage.startsWith("ab")).toBe(true);
    expect(c.behavior.idleMessage.length).toBe(80);
  });

  it("отбрасывает неизвестные поля", () => {
    const c = normalizeConfig({ evil: true, elements: { cover: false, script: "x" } }) as unknown as Record<string, unknown>;
    expect(c.evil).toBeUndefined();
    expect((c.elements as Record<string, unknown>).script).toBeUndefined();
    expect((c.elements as Record<string, unknown>).cover).toBe(false);
  });
});

describe("пресеты", () => {
  it("все встроенные пресеты валидны и стабильны при повторной нормализации", () => {
    for (const preset of BUILT_IN_PRESETS) {
      expect(normalizeConfig(preset.config)).toEqual(preset.config);
    }
  });

  it("mergeConfig сливает вложенные секции", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { text: { titleSize: 30 } });
    expect(merged.text.titleSize).toBe(30);
    expect(merged.text.font).toBe(DEFAULT_CONFIG.text.font);
  });

  it("у пресетов уникальные id", () => {
    const ids = BUILT_IN_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("suggestedSourceSize", () => {
  it("учитывает тень и фиксированную высоту", () => {
    const c = normalizeConfig({ size: { width: 400, height: 100 }, shadow: { enabled: true, blur: 20, offsetY: 4 } });
    const size = suggestedSourceSize(c);
    expect(size.width).toBe(400 + 2 * (24 + 8));
    expect(size.height).toBe(100 + 2 * (24 + 8));
  });
});
