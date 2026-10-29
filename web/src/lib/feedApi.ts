// Запрос к публичному endpoint виджета. Модуль не тянет supabase-js,
// чтобы страница виджета в OBS загружалась быстрее.

import { config, functionsUrl } from "./env";
import { ApiError } from "./errors";
import type { FeedError, FeedResponse } from "./feed";

export async function fetchFeed(token: string, knownVersion: string | null, signal?: AbortSignal): Promise<FeedResponse> {
  if (config.demo) throw new ApiError("Демо-режим: сервер не настроен", 0, "demo");
  const headers: Record<string, string> = {
    "X-Widget-Token": token,
    apikey: config.supabaseAnonKey,
  };
  if (knownVersion) headers["X-Config-Version"] = knownVersion;
  let res: Response;
  try {
    res = await fetch(functionsUrl("widget-feed"), { method: "POST", headers, signal, cache: "no-store" });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError("Сеть недоступна", 0, "network");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as Partial<FeedError>;
    throw new ApiError(err.message ?? `Ошибка ${res.status}`, res.status, err.error ?? "error");
  }
  return data as FeedResponse;
}
