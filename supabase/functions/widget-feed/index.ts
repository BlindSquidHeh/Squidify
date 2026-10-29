// Публичный endpoint виджета (для OBS и окна Windows).
//
// Принимает только длинный случайный токен виджета в заголовке
// X-Widget-Token (не в URL, чтобы токен не попадал в логи запросов).
// Возвращает конфигурацию оформления и текущий трек. Не раскрывает
// email, id пользователя, имя аккаунта Spotify и токены Spotify.

import type { FeedResponse } from "../_shared/feed-types.ts";
import { handleError, HttpError, json, preflight } from "../_shared/http.ts";
import { getPlayback } from "../_shared/playback-service.ts";
import { computePollAfter } from "../_shared/playback.ts";
import { adminClient } from "../_shared/supabase.ts";

const TOKEN_RE = /^[0-9a-f]{64}$/;

Deno.serve(async (req) => {
  const early = preflight(req, true);
  if (early) return early;

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      throw new HttpError(405, "bad_request", "Метод не поддерживается");
    }
    const token = (req.headers.get("X-Widget-Token") ?? "").trim().toLowerCase();
    if (!TOKEN_RE.test(token)) throw new HttpError(401, "invalid_token", "Неверная ссылка виджета");

    const { data: widget, error } = await adminClient()
      .from("widgets")
      .select("user_id, config, updated_at")
      .eq("public_token", token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!widget) {
      throw new HttpError(404, "not_found", "Виджет не найден. Возможно, ссылка была пересоздана.");
    }

    const version = String(Date.parse(widget.updated_at));
    const knownVersion = req.headers.get("X-Config-Version");

    const { playback, retryAfterMs, pending } = await getPlayback(widget.user_id);
    const pollAfterMs = pending ? 1500 : computePollAfter(playback, retryAfterMs);

    const body: FeedResponse = {
      widget: knownVersion === version ? null : { config: widget.config, version },
      version,
      playback,
      pollAfterMs,
    };
    return json(req, body, 200, true);
  } catch (error) {
    return handleError(req, error, true);
  }
});
