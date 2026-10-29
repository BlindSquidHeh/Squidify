import { describe, expect, it } from "vitest";
import { formatTime, hexToRgba, luminance } from "./format";
import { currentProgress } from "./usePlaybackClock";
import type { FeedPlayback } from "../lib/feed";

describe("formatTime", () => {
  it("форматирует минуты и часы", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(61_000)).toBe("1:01");
    expect(formatTime(3_725_000)).toBe("1:02:05");
    expect(formatTime(-5)).toBe("0:00");
  });
});

describe("цвета", () => {
  it("hexToRgba учитывает альфу и прозрачность", () => {
    expect(hexToRgba("#ff0000", 50)).toBe("rgba(255, 0, 0, 0.5)");
    expect(hexToRgba("#fff")).toBe("rgba(255, 255, 255, 1)");
    expect(hexToRgba("#00000080", 100)).toBe("rgba(0, 0, 0, 0.502)");
  });

  it("luminance", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1);
  });
});

describe("currentProgress", () => {
  const playback: FeedPlayback = {
    status: "active",
    isPlaying: true,
    progressMs: 10_000,
    ageMs: 1_000,
    item: {
      type: "track",
      id: "x",
      title: "t",
      artists: [],
      album: null,
      albumUrl: null,
      coverUrl: null,
      durationMs: 15_000,
      url: null,
    },
  };

  it("досчитывает прогресс с учётом возраста кеша", () => {
    expect(currentProgress(playback, 1000, 3000)).toBe(13_000);
  });

  it("не выходит за длительность трека", () => {
    expect(currentProgress(playback, 0, 60_000)).toBe(15_000);
  });

  it("на паузе прогресс не растёт", () => {
    expect(currentProgress({ ...playback, isPlaying: false }, 0, 60_000)).toBe(10_000);
  });
});
