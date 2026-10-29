// Чистые функции обработки ответов Spotify. Не зависят от Deno.

import type { FeedItem, FeedPlayback, PlaybackStatus } from "./feed-types.ts";

/** Сколько живёт кеш состояния воспроизведения. */
export const PLAYBACK_CACHE_TTL_MS = 4000;
/** Как долго держится блокировка на запрос к Spotify. */
export const PLAYBACK_LOCK_TTL_MS = 8000;

export const POLL_INTERVALS = {
  playing: 5000,
  paused: 10000,
  idle: 15000,
  ad: 10000,
  notConnected: 60000,
  error: 15000,
  min: 2000,
  max: 120000,
} as const;

// deno-lint-ignore no-explicit-any
type Json = any;

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function pickImage(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  // Spotify отдаёт изображения от большего к меньшему. Берём ближайшее к 300px,
  // чтобы не грузить 640px ради маленькой обложки.
  const sorted = images
    .filter((img: Json) => img && typeof img.url === "string")
    .sort((a: Json, b: Json) => (a.width ?? 0) - (b.width ?? 0));
  const suitable = sorted.find((img: Json) => (img.width ?? 0) >= 300) ?? sorted[sorted.length - 1];
  return suitable ? suitable.url : null;
}

/** Ссылки на Spotify принимаем только с доменов Spotify. */
export function safeSpotifyUrl(value: unknown): string | null {
  const url = str(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname !== "open.spotify.com") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function safeImageUrl(value: unknown): string | null {
  const url = str(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (!/(^|\.)scdn\.co$|(^|\.)spotifycdn\.com$/.test(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeItem(item: Json, type: unknown): FeedItem | null {
  if (!item || typeof item !== "object") return null;
  const id = str(item.id) ?? str(item.uri) ?? "";
  const title = str(item.name);
  if (!title) return null;
  const duration = Number.isFinite(item.duration_ms) ? Math.max(0, item.duration_ms) : 0;

  if (type === "episode" || item.type === "episode") {
    const show = item.show ?? {};
    return {
      type: "episode",
      id,
      title,
      artists: str(show.name) ? [{ name: show.name, url: safeSpotifyUrl(show.external_urls?.spotify) }] : [],
      album: str(show.name),
      albumUrl: safeSpotifyUrl(show.external_urls?.spotify),
      coverUrl: safeImageUrl(pickImage(item.images) ?? pickImage(show.images)),
      durationMs: duration,
      url: safeSpotifyUrl(item.external_urls?.spotify),
    };
  }

  const album = item.album ?? {};
  const artists = Array.isArray(item.artists)
    ? item.artists
      .filter((a: Json) => a && str(a.name))
      .map((a: Json) => ({ name: a.name as string, url: safeSpotifyUrl(a.external_urls?.spotify) }))
    : [];
  return {
    type: "track",
    id,
    title,
    artists,
    album: str(album.name),
    albumUrl: safeSpotifyUrl(album.external_urls?.spotify),
    coverUrl: safeImageUrl(pickImage(album.images)),
    durationMs: duration,
    url: safeSpotifyUrl(item.external_urls?.spotify),
  };
}

/**
 * Преобразует ответ GET /me/player/currently-playing в компактное состояние.
 * `body === null` означает ответ 204 (ничего не играет).
 */
export function normalizeCurrentlyPlaying(body: Json | null): FeedPlayback {
  if (!body || typeof body !== "object") {
    return { status: "idle", isPlaying: false, progressMs: 0, item: null, ageMs: 0 };
  }
  if (body.currently_playing_type === "ad") {
    return { status: "ad", isPlaying: Boolean(body.is_playing), progressMs: 0, item: null, ageMs: 0 };
  }
  const item = normalizeItem(body.item, body.currently_playing_type);
  if (!item) {
    return { status: "idle", isPlaying: false, progressMs: 0, item: null, ageMs: 0 };
  }
  const progress = Number.isFinite(body.progress_ms) ? Math.max(0, body.progress_ms) : 0;
  return {
    status: "active",
    isPlaying: Boolean(body.is_playing),
    progressMs: item.durationMs > 0 ? Math.min(progress, item.durationMs) : progress,
    item,
    ageMs: 0,
  };
}

export function emptyPlayback(status: PlaybackStatus): FeedPlayback {
  return { status, isPlaying: false, progressMs: 0, item: null, ageMs: 0 };
}

/**
 * Разбор заголовка Retry-After (секунды или HTTP-дата). Возвращает миллисекунды,
 * ограниченные разумным диапазоном.
 */
export function parseRetryAfter(header: string | null, now = Date.now()): number {
  const fallback = 30_000;
  if (!header) return fallback;
  const seconds = Number(header);
  let ms: number;
  if (Number.isFinite(seconds)) {
    ms = seconds * 1000;
  } else {
    const date = Date.parse(header);
    ms = Number.isFinite(date) ? date - now : fallback;
  }
  return Math.min(Math.max(ms, 1000), 3_600_000);
}

/** Пауза до следующего опроса с учётом конца текущего трека. */
export function computePollAfter(playback: FeedPlayback, retryAfterMs = 0): number {
  let interval: number;
  switch (playback.status) {
    case "active": {
      interval = playback.isPlaying ? POLL_INTERVALS.playing : POLL_INTERVALS.paused;
      if (playback.isPlaying && playback.item && playback.item.durationMs > 0) {
        const remaining = playback.item.durationMs - playback.progressMs - playback.ageMs;
        // Запрашиваем чуть позже окончания трека, чтобы сразу показать следующий.
        if (remaining >= 0 && remaining + 1000 < interval) interval = remaining + 1000;
      }
      break;
    }
    case "idle":
      interval = POLL_INTERVALS.idle;
      break;
    case "ad":
      interval = POLL_INTERVALS.ad;
      break;
    case "not_connected":
    case "reauth_required":
    case "forbidden":
      interval = POLL_INTERVALS.notConnected;
      break;
    case "rate_limited":
      interval = Math.max(retryAfterMs, POLL_INTERVALS.error);
      break;
    default:
      interval = POLL_INTERVALS.error;
  }
  return Math.min(Math.max(Math.round(interval), POLL_INTERVALS.min), POLL_INTERVALS.max);
}
