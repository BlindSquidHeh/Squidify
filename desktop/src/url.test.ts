import { describe, expect, it } from "vitest";
import { isAllowedExternalUrl, parseProtocolUrl, parseWidgetUrl, sameOrigin } from "./url";

const TOKEN = "a".repeat(64);

describe("parseWidgetUrl", () => {
  it("принимает ссылку виджета на GitHub Pages", () => {
    const loc = parseWidgetUrl(`https://user.github.io/Squidify/w/#${TOKEN}`);
    expect(loc).toEqual({ href: `https://user.github.io/Squidify/w/#${TOKEN}`, origin: "https://user.github.io" });
  });

  it("добавляет завершающий слэш и убирает query", () => {
    expect(parseWidgetUrl(`https://x.dev/w?x=1#${TOKEN}`)?.href).toBe(`https://x.dev/w/#${TOKEN}`);
  });

  it("принимает демо-ссылку и локальный адрес разработки", () => {
    expect(parseWidgetUrl("http://127.0.0.1:5173/w/#demo=eyJhIjoxfQ")).not.toBeNull();
  });

  it("отклоняет небезопасные и чужие адреса", () => {
    expect(parseWidgetUrl(`http://example.com/w/#${TOKEN}`)).toBeNull();
    expect(parseWidgetUrl(`file:///C:/w/#${TOKEN}`)).toBeNull();
    expect(parseWidgetUrl(`javascript:alert(1)//w/#${TOKEN}`)).toBeNull();
    expect(parseWidgetUrl(`https://example.com/app/#${TOKEN}`)).toBeNull();
    expect(parseWidgetUrl("https://example.com/w/#short")).toBeNull();
    expect(parseWidgetUrl(`https://user:pass@example.com/w/#${TOKEN}`)).toBeNull();
    expect(parseWidgetUrl("не ссылка")).toBeNull();
  });
});

describe("parseProtocolUrl", () => {
  const target = encodeURIComponent(`https://user.github.io/Squidify/w/#${TOKEN}`);
  it("разбирает squidify://open", () => {
    expect(parseProtocolUrl(`squidify://open?url=${target}`)?.origin).toBe("https://user.github.io");
    expect(parseProtocolUrl(`squidify://open/?url=${target}`)?.origin).toBe("https://user.github.io");
  });
  it("отклоняет другие действия и протоколы", () => {
    expect(parseProtocolUrl(`squidify://exec?url=${target}`)).toBeNull();
    expect(parseProtocolUrl(`https://open?url=${target}`)).toBeNull();
    expect(parseProtocolUrl("squidify://open?url=https%3A%2F%2Fevil.com%2F")).toBeNull();
  });
});

describe("внешние ссылки", () => {
  it("открывает только Spotify", () => {
    expect(isAllowedExternalUrl("https://open.spotify.com/track/1")).toBe(true);
    expect(isAllowedExternalUrl("http://open.spotify.com/track/1")).toBe(false);
    expect(isAllowedExternalUrl("https://evil.com/")).toBe(false);
    expect(isAllowedExternalUrl("file:///etc/passwd")).toBe(false);
  });
  it("sameOrigin", () => {
    expect(sameOrigin("https://a.io/x", "https://a.io")).toBe(true);
    expect(sameOrigin("https://a.io.evil.com/x", "https://a.io")).toBe(false);
  });
});
