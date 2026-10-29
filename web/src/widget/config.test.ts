import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, imageUrl, mergeConfig, normalizeConfig, suggestedSourceSize } from "./config";
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

describe("imageUrl", () => {
  it("пропускает только https без логина и пароля", () => {
    expect(imageUrl("https://i.imgur.com/a.gif")).toBe("https://i.imgur.com/a.gif");
    expect(imageUrl("  https://example.com/x.png  ")).toBe("https://example.com/x.png");
    for (const bad of [
      "http://example.com/a.gif",
      "file:///C:/Users/Administrator/Downloads/sound.gif",
      "C:\\Users\\Administrator\\Downloads\\sound.gif",
      "javascript:alert(1)",
      "data:image/gif;base64,R0lGOD",
      "https://user:pass@example.com/a.gif",
      'https://example.com/a.gif"onerror="x',
      "",
      42,
    ]) {
      expect(imageUrl(bad)).toBe("");
    }
  });
});

describe("новые настройки", () => {
  it("старая конфигурация без новых полей получает значения по умолчанию", () => {
    const c = normalizeConfig({ layout: "compact", text: { font: "rubik" } });
    expect(c.visualizer).toEqual(DEFAULT_CONFIG.visualizer);
    expect(c.decorations).toEqual(DEFAULT_CONFIG.decorations);
    expect(c.text.effect).toBe("none");
    expect(c.text.font).toBe("rubik");
  });

  it("ограничивает визуализатор и картинки, всегда возвращает два слота", () => {
    const c = normalizeConfig({
      visualizer: { enabled: true, bars: 9999, height: 1, style: "nope", color: "url(x)" },
      decorations: [{ enabled: true, url: "http://x.y/a.gif", width: 99999, placement: "free", offsetX: 9999 }],
    });
    expect(c.visualizer.bars).toBe(128);
    expect(c.visualizer.height).toBe(8);
    expect(c.visualizer.style).toBe(DEFAULT_CONFIG.visualizer.style);
    expect(c.visualizer.color).toBe(DEFAULT_CONFIG.visualizer.color);
    expect(c.decorations).toHaveLength(2);
    expect(c.decorations[0].url).toBe("");
    expect(c.decorations[0].width).toBe(800);
    expect(c.decorations[0].offsetX).toBe(400);
    expect(c.decorations[1]).toEqual(DEFAULT_CONFIG.decorations[1]);
  });

  it("не принимает посторонние значения в списках", () => {
    const c = normalizeConfig({
      text: { effect: "evil", secondaryFont: "Comic Sans" },
      border: { style: "url(x)", effect: "rm" },
      animation: { idle: "x", trackChange: "x" },
    });
    expect(c.text.effect).toBe("none");
    expect(c.text.secondaryFont).toBe("same");
    expect(c.border.style).toBe("solid");
    expect(c.border.effect).toBe("none");
    expect(c.animation.idle).toBe("none");
    expect(c.animation.trackChange).toBe(DEFAULT_CONFIG.animation.trackChange);
  });

  it("пресеты проходят нормализацию без изменений", () => {
    for (const p of BUILT_IN_PRESETS) expect(normalizeConfig(p.config)).toEqual(p.config);
  });
});

describe("масштаб и прозрачность значка", () => {
  it("ограничивает масштаб и прозрачность значка Spotify", () => {
    const c = normalizeConfig({ size: { scale: 9999 }, attribution: { opacity: -5 } });
    expect(c.size.scale).toBe(400);
    expect(c.attribution.opacity).toBe(10);
  });

  it("масштабирует рекомендуемый размер источника", () => {
    const base = suggestedSourceSize(normalizeConfig({}));
    const doubled = suggestedSourceSize(normalizeConfig({ size: { scale: 200 } }));
    expect(doubled.width).toBe(base.width * 2);
    expect(doubled.height).toBe(base.height * 2);
  });
});

describe("новые настройки", () => {
  it("ограничивает прозрачность виджета, рамку обложки и межстрочный интервал", () => {
    const c = normalizeConfig({ size: { opacity: 0 }, cover: { borderWidth: 99 }, text: { lineHeight: 5 } });
    expect(c.size.opacity).toBe(10);
    expect(c.cover.borderWidth).toBe(8);
    expect(c.text.lineHeight).toBe(90);
  });
});
