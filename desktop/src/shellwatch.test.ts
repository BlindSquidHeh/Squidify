import { describe, expect, it } from "vitest";
import { isFullscreenOn, isOnVisibleTaskbar, parseSnapshot, taskbarOnDisplay } from "./shellwatch";

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

describe("taskbarOnDisplay", () => {
  const second = { x: 1920, y: 0, width: 1920, height: 1080 };
  const bars = [
    { x: 0, y: 1040, width: 1920, height: 40 },
    { x: 1920, y: 1040, width: 1920, height: 40 },
  ];
  it("находит панель нужного монитора", () => {
    expect(taskbarOnDisplay(second, bars)).toBe(bars[1]);
  });
  it("нет панели, если она спрятана", () => {
    expect(taskbarOnDisplay(second, [bars[0], { x: 1920, y: 1078, width: 1920, height: 2 }])).toBeNull();
  });
});

describe("полный экран на мониторе", () => {
  it("читает третий блок строки", () => {
    const s = parseSnapshot("1|0,1040,1920,1080|1920,0,3840,1080");
    expect(s?.fullscreenAreas).toEqual([{ x: 1920, y: 0, width: 1920, height: 1080 }]);
    expect(parseSnapshot("1|0,1040,1920,1080")?.fullscreenAreas).toEqual([]);
  });
  it("полный экран на втором мониторе не прячет виджет первого", () => {
    const areas = [{ x: 1920, y: 0, width: 1920, height: 1080 }];
    expect(isFullscreenOn({ x: 1920, y: 0, width: 1920, height: 1080 }, areas)).toBe(true);
    expect(isFullscreenOn({ x: 0, y: 0, width: 1920, height: 1080 }, areas)).toBe(false);
  });
});
