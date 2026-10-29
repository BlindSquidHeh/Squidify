import { describe, expect, it } from "vitest";
import { isOnVisibleTaskbar, parseSnapshot } from "./shellwatch";

describe("parseSnapshot", () => {
  it("разбирает состояние и панели задач", () => {
    const s = parseSnapshot("1|0,1040,1920,1080;1920,1040,3840,1080");
    expect(s?.fullscreen).toBe(false);
    expect(s?.taskbars).toEqual([
      { x: 0, y: 1040, width: 1920, height: 40 },
      { x: 1920, y: 1040, width: 1920, height: 40 },
    ]);
  });

  it("определяет полноэкранный режим", () => {
    expect(parseSnapshot("2|0,1040,1920,1080")?.fullscreen).toBe(true);
    expect(parseSnapshot("3|")?.fullscreen).toBe(true);
    expect(parseSnapshot("4|")?.fullscreen).toBe(true);
    expect(parseSnapshot("5|")?.fullscreen).toBe(false);
  });

  it("отбрасывает мусор", () => {
    expect(parseSnapshot("hello")).toBeNull();
    expect(parseSnapshot("1|a,b")).toBeNull();
    expect(parseSnapshot("1|1,2,3")?.taskbars).toEqual([]);
  });
});

describe("isOnVisibleTaskbar", () => {
  const bar = { x: 0, y: 1040, width: 1920, height: 40 };
  it("виджет внутри панели виден", () => {
    expect(isOnVisibleTaskbar({ x: 1500, y: 1042, width: 200, height: 36 }, [bar])).toBe(true);
  });
  it("виджет на рабочем столе не считается", () => {
    expect(isOnVisibleTaskbar({ x: 100, y: 100, width: 200, height: 36 }, [bar])).toBe(false);
  });
  it("скрытая (автоскрытие) панель в виде полоски не считается", () => {
    const strip = { x: 0, y: 1078, width: 1920, height: 2 };
    expect(isOnVisibleTaskbar({ x: 1500, y: 1070, width: 200, height: 20 }, [strip])).toBe(false);
  });
});
