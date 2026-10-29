import { describe, expect, it } from "vitest";
import { normalizeConfig } from "../widget/config";
import { decodeDemoConfig, encodeDemoConfig } from "./demoLink";

describe("демо-ссылка", () => {
  it("кодирует и декодирует конфигурацию с кириллицей", () => {
    const config = normalizeConfig({ behavior: { idleMessage: "Тишина 🎧" }, layout: "vertical" });
    const encoded = encodeDemoConfig(config);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeDemoConfig(encoded)).toEqual(config);
  });

  it("возвращает null для мусора", () => {
    expect(decodeDemoConfig("!!!")).toBeNull();
  });
});
