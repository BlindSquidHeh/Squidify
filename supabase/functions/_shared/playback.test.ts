import { describe, expect, it } from "vitest";
import {
  computePollAfter,
  normalizeCurrentlyPlaying,
  parseRetryAfter,
  POLL_INTERVALS,
  safeImageUrl,
  safeSpotifyUrl,
} from "./playback.ts";

const sample = {
  timestamp: 1700000000000,
  progress_ms: 42_000,
  is_playing: true,
  currently_playing_type: "track",
  item: {
    id: "4uLU6hMCjMI75M1A2tKUQC",
    name: "Never Gonna Give You Up",
    duration_ms: 213_573,
    external_urls: { spotify: "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC" },
    artists: [{ name: "Rick Astley", external_urls: { spotify: "https://open.spotify.com/artist/0gxyHStUsqpMadRV0Di1Qt" } }],
    album: {
      name: "Whenever You Need Somebody",
      external_urls: { spotify: "https://open.spotify.com/album/6eUW0wxWtzkFdaEFsTJto6" },
      images: [
        { url: "https://i.scdn.co/image/640", width: 640, height: 640 },
        { url: "https://i.scdn.co/image/300", width: 300, height: 300 },
        { url: "https://i.scdn.co/image/64", width: 64, height: 64 },
      ],
    },
  },
};

describe("normalizeCurrentlyPlaying", () => {
  it("преобразует трек в компактное состояние", () => {
    const p = normalizeCurrentlyPlaying(sample);
    expect(p.status).toBe("active");
    expect(p.isPlaying).toBe(true);
    expect(p.progressMs).toBe(42_000);
    expect(p.item).toMatchObject({
      type: "track",
      title: "Never Gonna Give You Up",
      album: "Whenever You Need Somebody",
      coverUrl: "https://i.scdn.co/image/300",
      durationMs: 213_573,
    });
    expect(p.item?.artists).toEqual([
      { name: "Rick Astley", url: "https://open.spotify.com/artist/0gxyHStUsqpMadRV0Di1Qt" },
    ]);
  });

  it("204 / пустой ответ — ничего не играет", () => {
    expect(normalizeCurrentlyPlaying(null).status).toBe("idle");
    expect(normalizeCurrentlyPlaying({ is_playing: false, item: null }).status).toBe("idle");
  });

  it("реклама", () => {
    expect(normalizeCurrentlyPlaying({ currently_playing_type: "ad", is_playing: true, item: null }).status).toBe("ad");
  });

  it("эпизод подкаста", () => {
    const p = normalizeCurrentlyPlaying({
      is_playing: true,
      progress_ms: 1000,
      currently_playing_type: "episode",
      item: {
        id: "ep",
        type: "episode",
        name: "Выпуск 1",
        duration_ms: 60_000,
        images: [{ url: "https://i.scdn.co/image/ep", width: 300 }],
        show: { name: "Подкаст", external_urls: { spotify: "https://open.spotify.com/show/1" } },
      },
    });
    expect(p.item).toMatchObject({ type: "episode", title: "Выпуск 1", album: "Подкаст", coverUrl: "https://i.scdn.co/image/ep" });
  });

  it("не пропускает ссылки и картинки с чужих доменов", () => {
    const evil = structuredClone(sample);
    evil.item.external_urls.spotify = "javascript:alert(1)";
    evil.item.album.images = [{ url: "https://evil.example/x.png", width: 300, height: 300 }];
    const p = normalizeCurrentlyPlaying(evil);
    expect(p.item?.url).toBeNull();
    expect(p.item?.coverUrl).toBeNull();
  });

  it("прогресс не превышает длительность", () => {
    const p = normalizeCurrentlyPlaying({ ...sample, progress_ms: 10_000_000 });
    expect(p.progressMs).toBe(213_573);
  });
});

describe("безопасные URL", () => {
  it("safeSpotifyUrl", () => {
    expect(safeSpotifyUrl("https://open.spotify.com/track/1")).toBe("https://open.spotify.com/track/1");
    expect(safeSpotifyUrl("http://open.spotify.com/track/1")).toBeNull();
    expect(safeSpotifyUrl("https://open.spotify.com.evil.com/")).toBeNull();
  });
  it("safeImageUrl", () => {
    expect(safeImageUrl("https://i.scdn.co/image/a")).toBe("https://i.scdn.co/image/a");
    expect(safeImageUrl("https://image-cdn-ak.spotifycdn.com/image/a")).not.toBeNull();
    expect(safeImageUrl("https://scdn.co.evil.com/a")).toBeNull();
  });
});

describe("parseRetryAfter", () => {
  it("секунды", () => expect(parseRetryAfter("7")).toBe(7000));
  it("HTTP-дата", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    expect(parseRetryAfter("Thu, 01 Jan 2026 00:00:30 GMT", now)).toBe(30_000);
  });
  it("нет заголовка — 30 секунд", () => expect(parseRetryAfter(null)).toBe(30_000));
  it("ограничение сверху и снизу", () => {
    expect(parseRetryAfter("0")).toBe(1000);
    expect(parseRetryAfter("999999")).toBe(3_600_000);
  });
});

describe("computePollAfter", () => {
  const playing = normalizeCurrentlyPlaying(sample);

  it("во время воспроизведения — базовый интервал", () => {
    expect(computePollAfter(playing)).toBe(POLL_INTERVALS.playing);
  });

  it("перед концом трека — чуть позже его окончания", () => {
    const p = { ...playing, progressMs: playing.item!.durationMs - 2000 };
    expect(computePollAfter(p)).toBe(3000);
  });

  it("на паузе и без воспроизведения реже", () => {
    expect(computePollAfter({ ...playing, isPlaying: false })).toBe(POLL_INTERVALS.paused);
    expect(computePollAfter(normalizeCurrentlyPlaying(null))).toBe(POLL_INTERVALS.idle);
  });

  it("при 429 ждёт Retry-After", () => {
    expect(computePollAfter({ ...playing, status: "rate_limited" }, 45_000)).toBe(45_000);
  });

  it("не опрашивает чаще минимального интервала", () => {
    const p = { ...playing, progressMs: playing.item!.durationMs };
    expect(computePollAfter(p)).toBe(POLL_INTERVALS.min);
  });
});
