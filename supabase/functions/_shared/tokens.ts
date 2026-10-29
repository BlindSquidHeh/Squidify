// Хранение токенов Spotify в зашифрованном виде.

import { decryptString, encryptString } from "./crypto.ts";
import { encryptionKey } from "./env.ts";
import { refreshAccessToken, SpotifyAuthError, type TokenResponse } from "./spotify.ts";
import { adminClient } from "./supabase.ts";

// Шифротекст привязан к пользователю через AAD: строку нельзя
// подставить другому пользователю.
const refreshAad = (userId: string) => `refresh:${userId}`;
const accessAad = (userId: string) => `access:${userId}`;

const EXPIRY_MARGIN_MS = 60_000;

export async function saveTokens(userId: string, tokens: TokenResponse, fallbackRefresh?: string): Promise<void> {
  const key = await encryptionKey();
  const refresh = tokens.refresh_token ?? fallbackRefresh;
  if (!refresh) throw new SpotifyAuthError("no_refresh_token", "Spotify не вернул refresh-токен", true);
  const row = {
    user_id: userId,
    refresh_token_enc: await encryptString(key, refresh, refreshAad(userId)),
    access_token_enc: await encryptString(key, tokens.access_token, accessAad(userId)),
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
  const { error } = await adminClient().from("spotify_tokens").upsert(row);
  if (error) throw new Error(`Не удалось сохранить токены: ${error.message}`);
}

/**
 * Возвращает действующий access-токен, при необходимости обновляя его.
 * Бросает SpotifyAuthError с revoked=true, если нужно переподключение.
 */
export async function getAccessToken(userId: string, clientId: string, forceRefresh = false): Promise<string> {
  const db = adminClient();
  const key = await encryptionKey();
  const { data, error } = await db
    .from("spotify_tokens")
    .select("refresh_token_enc, access_token_enc, access_token_expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new SpotifyAuthError("no_tokens", "Spotify не подключён", true);

  const expiresAt = data.access_token_expires_at ? Date.parse(data.access_token_expires_at) : 0;
  if (!forceRefresh && data.access_token_enc && expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    return decryptString(key, data.access_token_enc, accessAad(userId));
  }

  const refreshToken = await decryptString(key, data.refresh_token_enc, refreshAad(userId));
  const tokens = await refreshAccessToken(clientId, refreshToken);
  await saveTokens(userId, tokens, refreshToken);
  return tokens.access_token;
}

/** Авторизация отозвана: удаляем токены, кеш и помечаем подключение. */
export async function markReauthRequired(userId: string, reason: string): Promise<void> {
  const db = adminClient();
  await db.from("spotify_tokens").delete().eq("user_id", userId);
  await db.from("playback_cache").delete().eq("user_id", userId);
  await db
    .from("spotify_connections")
    .update({ status: "reauth_required", last_error: reason.slice(0, 300) })
    .eq("user_id", userId);
}

/** Полное отключение Spotify: удаляются токены, кеш, OAuth state и подключение. */
export async function deleteSpotifyData(userId: string): Promise<void> {
  const db = adminClient();
  for (const table of ["spotify_tokens", "playback_cache", "oauth_states", "spotify_connections"]) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Не удалось удалить данные (${table}): ${error.message}`);
  }
}
