// Получение состояния воспроизведения с общим кешем на пользователя.
//
// Все виджеты пользователя читают одну строку playback_cache. К Spotify
// обращается только тот запрос, который захватил блокировку, и не чаще
// одного раза в PLAYBACK_CACHE_TTL_MS. При 429 соблюдается Retry-After.

import type { FeedPlayback } from "./feed-types.ts";
import {
  emptyPlayback,
  normalizeCurrentlyPlaying,
  parseRetryAfter,
  PLAYBACK_CACHE_TTL_MS,
  PLAYBACK_LOCK_TTL_MS,
} from "./playback.ts";
import { getCurrentlyPlaying, SpotifyAuthError } from "./spotify.ts";
import { adminClient } from "./supabase.ts";
import { getAccessToken, markReauthRequired } from "./tokens.ts";

interface CacheRow {
  payload: FeedPlayback | null;
  fetched_at: string | null;
  retry_after_until: string | null;
  error_count: number;
}

export interface PlaybackResult {
  playback: FeedPlayback;
  retryAfterMs: number;
  /** true, если другой запрос сейчас обращается к Spotify и стоит переспросить чуть позже. */
  pending: boolean;
}

function withAge(payload: FeedPlayback, fetchedAt: string | null, now: number): FeedPlayback {
  const age = fetchedAt ? Math.max(0, now - Date.parse(fetchedAt)) : 0;
  return { ...payload, ageMs: age };
}

function errorBackoffMs(errorCount: number): number {
  return Math.min(5000 * 2 ** Math.max(0, errorCount - 1), 60_000);
}

export async function getPlayback(userId: string): Promise<PlaybackResult> {
  const db = adminClient();
  const now = Date.now();

  const { data: connection, error: connError } = await db
    .from("spotify_connections")
    .select("client_id, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (connError) throw new Error(connError.message);
  if (!connection) return { playback: emptyPlayback("not_connected"), retryAfterMs: 0, pending: false };
  if (connection.status === "reauth_required") {
    return { playback: emptyPlayback("reauth_required"), retryAfterMs: 0, pending: false };
  }

  const { data: cacheData } = await db
    .from("playback_cache")
    .select("payload, fetched_at, retry_after_until, error_count")
    .eq("user_id", userId)
    .maybeSingle();
  const cache = cacheData as CacheRow | null;
  const cached = cache?.payload ? withAge(cache.payload, cache.fetched_at, now) : null;

  // Ждём окончания Retry-After или паузы после ошибок.
  const retryUntil = cache?.retry_after_until ? Date.parse(cache.retry_after_until) : 0;
  if (retryUntil > now) {
    const status = cached?.status === "forbidden"
      ? "forbidden"
      : cache && cache.error_count > 0
      ? "error"
      : "rate_limited";
    const playback = cached ? { ...cached, status } : emptyPlayback(status);
    return { playback: playback as FeedPlayback, retryAfterMs: retryUntil - now, pending: false };
  }

  // Свежий кеш.
  if (cached && cache?.fetched_at && now - Date.parse(cache.fetched_at) < PLAYBACK_CACHE_TTL_MS) {
    return { playback: cached, retryAfterMs: 0, pending: false };
  }

  const { data: acquired, error: lockError } = await db.rpc("acquire_playback_lock", {
    p_user_id: userId,
    p_ttl_ms: PLAYBACK_LOCK_TTL_MS,
  });
  if (lockError) throw new Error(lockError.message);
  if (!acquired) {
    return { playback: cached ?? emptyPlayback("idle"), retryAfterMs: 0, pending: true };
  }

  return await fetchAndStore(userId, connection.client_id, cache, cached, now);
}

async function fetchAndStore(
  userId: string,
  clientId: string,
  cache: CacheRow | null,
  cached: FeedPlayback | null,
  now: number,
): Promise<PlaybackResult> {
  const db = adminClient();
  const store = async (fields: Record<string, unknown>) => {
    await db
      .from("playback_cache")
      .upsert({ user_id: userId, lock_until: null, ...fields });
  };

  try {
    let token = await getAccessToken(userId, clientId);
    let result = await getCurrentlyPlaying(token);
    if (result.kind === "unauthorized") {
      // Access-токен мог быть отозван раньше срока: обновляем один раз.
      token = await getAccessToken(userId, clientId, true);
      result = await getCurrentlyPlaying(token);
    }

    switch (result.kind) {
      case "ok":
      case "empty": {
        const playback = normalizeCurrentlyPlaying(result.kind === "ok" ? result.body : null);
        await store({
          payload: playback,
          fetched_at: new Date(now).toISOString(),
          retry_after_until: null,
          error_count: 0,
        });
        return { playback, retryAfterMs: 0, pending: false };
      }
      case "unauthorized": {
        await markReauthRequired(userId, "Spotify отклонил токен (401)");
        return { playback: emptyPlayback("reauth_required"), retryAfterMs: 0, pending: false };
      }
      case "forbidden": {
        // 403 в Development Mode: пользователь не добавлен в User Management
        // приложения или у владельца приложения нет Premium.
        const playback = emptyPlayback("forbidden");
        await store({
          payload: playback,
          fetched_at: new Date(now).toISOString(),
          retry_after_until: new Date(now + 60_000).toISOString(),
          error_count: 0,
        });
        await db
          .from("spotify_connections")
          .update({ last_error: `403: ${result.message}`.slice(0, 300) })
          .eq("user_id", userId);
        return { playback, retryAfterMs: 60_000, pending: false };
      }
      case "rate_limited": {
        const retryAfterMs = parseRetryAfter(result.retryAfter, now);
        await store({ retry_after_until: new Date(now + retryAfterMs).toISOString(), error_count: 0 });
        const playback = cached ? { ...cached, status: "rate_limited" as const } : emptyPlayback("rate_limited");
        return { playback, retryAfterMs, pending: false };
      }
      default: {
        const errorCount = (cache?.error_count ?? 0) + 1;
        const backoff = errorBackoffMs(errorCount);
        await store({ retry_after_until: new Date(now + backoff).toISOString(), error_count: errorCount });
        const playback = cached ? { ...cached, status: "error" as const } : emptyPlayback("error");
        return { playback, retryAfterMs: backoff, pending: false };
      }
    }
  } catch (error) {
    if (error instanceof SpotifyAuthError && error.revoked) {
      await markReauthRequired(userId, `${error.code}: ${error.message}`);
      return { playback: emptyPlayback("reauth_required"), retryAfterMs: 0, pending: false };
    }
    const errorCount = (cache?.error_count ?? 0) + 1;
    const backoff = errorBackoffMs(errorCount);
    await store({ retry_after_until: new Date(now + backoff).toISOString(), error_count: errorCount }).catch(
      () => undefined,
    );
    console.error("playback fetch failed", error instanceof Error ? error.message : error);
    const playback = cached ? { ...cached, status: "error" as const } : emptyPlayback("error");
    return { playback, retryAfterMs: backoff, pending: false };
  }
}
