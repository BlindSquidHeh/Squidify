import { useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/errors";
import { fetchFeed } from "../lib/feedApi";
import type { FeedItem, FeedPlayback } from "../lib/feed";
import { normalizeConfig, type WidgetConfig } from "./config";

export interface WidgetFeedState {
  config: WidgetConfig | null;
  playback: FeedPlayback | null;
  receivedAt: number;
  lastItem: FeedItem | null;
  /** Ссылка недействительна (пересоздана или виджет удалён). */
  invalid: boolean;
  error: string | null;
}

const HIDDEN_POLL_MS = 30_000;
const INVALID_POLL_MS = 300_000;

/**
 * Опрос публичного endpoint виджета. Интервал задаёт сервер (pollAfterMs):
 * чаще во время воспроизведения, реже на паузе и без подключения, с учётом
 * Retry-After. При сетевых ошибках интервал растёт экспоненциально.
 */
export function useWidgetFeed(token: string | null, enabled = true): WidgetFeedState {
  const [state, setState] = useState<WidgetFeedState>({
    config: null,
    playback: null,
    receivedAt: 0,
    lastItem: null,
    invalid: false,
    error: null,
  });
  const versionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token || !enabled) return;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    let stopped = false;
    let failures = 0;
    versionRef.current = null;

    const schedule = (ms: number) => {
      if (stopped) return;
      const delay = document.hidden ? Math.max(ms, HIDDEN_POLL_MS) : ms;
      timer = window.setTimeout(tick, delay);
    };

    const tick = async () => {
      controller = new AbortController();
      try {
        const res = await fetchFeed(token, versionRef.current, controller.signal);
        failures = 0;
        if (res.widget) versionRef.current = res.widget.version;
        const receivedAt = Date.now();
        setState((prev) => ({
          config: res.widget ? normalizeConfig(res.widget.config) : prev.config,
          playback: res.playback,
          receivedAt,
          lastItem: res.playback.item ?? prev.lastItem,
          invalid: false,
          error: null,
        }));
        schedule(res.pollAfterMs);
      } catch (e) {
        if (stopped || (e as Error).name === "AbortError") return;
        const err = e instanceof ApiError ? e : new ApiError(String(e));
        if (err.status === 401 || err.status === 404) {
          setState((prev) => ({ ...prev, invalid: true, error: err.message }));
          schedule(INVALID_POLL_MS);
          return;
        }
        failures += 1;
        setState((prev) => ({ ...prev, error: err.message }));
        schedule(Math.min(5000 * 2 ** (failures - 1), 60_000));
      }
    };

    // При возвращении вкладки сразу обновляем данные.
    const onVisible = () => {
      if (!document.hidden) {
        window.clearTimeout(timer);
        controller?.abort();
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    tick();

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [token, enabled]);

  return state;
}
