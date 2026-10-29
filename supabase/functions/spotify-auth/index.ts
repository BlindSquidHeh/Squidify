// Подключение и отключение Spotify для вошедшего пользователя сайта.
//
// Authorization Code Flow with PKCE:
//   1. action=start: сервер создаёт state и code_verifier, сохраняет их
//      (verifier зашифрован) и возвращает ссылку на авторизацию Spotify.
//   2. Spotify возвращает пользователя на Redirect URI сайта с code и state.
//   3. action=complete: сервер проверяет, что state принадлежит этому
//      пользователю, не истёк и используется впервые, обменивает code
//      на токены с тем же verifier и сохраняет refresh-токен в зашифрованном виде.

import { createPkcePair, decryptString, encryptString, randomBase64Url, sha256Base64Url } from "../_shared/crypto.ts";
import { encryptionKey, env } from "../_shared/env.ts";
import { handleError, HttpError, json, preflight, readJson } from "../_shared/http.ts";
import { buildAuthorizeUrl, exchangeCode, getProfile, SPOTIFY_SCOPES, SpotifyAuthError } from "../_shared/spotify.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { deleteSpotifyData, saveTokens } from "../_shared/tokens.ts";

const CLIENT_ID_RE = /^[0-9a-zA-Z]{32}$/;
const verifierAad = (userId: string, stateHash: string) => `pkce:${userId}:${stateHash}`;

function checkRedirectUri(value: unknown): string {
  if (typeof value !== "string") throw new HttpError(400, "bad_request", "Не передан Redirect URI");
  const allowed = env.allowedRedirectUris();
  if (!allowed.includes(value)) {
    throw new HttpError(
      400,
      "bad_request",
      "Этот Redirect URI не разрешён на сервере. Добавьте его в секрет ALLOWED_REDIRECT_URIS.",
    );
  }
  return value;
}

async function start(userId: string, body: Record<string, unknown>) {
  const mode = body.mode === "shared" ? "shared" : "own";
  let clientId: string;
  if (mode === "shared") {
    const shared = env.sharedClientId();
    if (!shared) throw new HttpError(400, "bad_request", "Общий Client ID не настроен на этом сервере");
    clientId = shared;
  } else {
    const value = typeof body.clientId === "string" ? body.clientId.trim() : "";
    if (!CLIENT_ID_RE.test(value)) {
      throw new HttpError(400, "bad_request", "Client ID должен состоять из 32 латинских букв и цифр");
    }
    clientId = value;
  }
  const redirectUri = checkRedirectUri(body.redirectUri);

  const db = adminClient();
  // Одновременно действует только одна попытка подключения.
  await db.from("oauth_states").delete().eq("user_id", userId);
  await db.rpc("cleanup_expired_oauth_states");

  const state = randomBase64Url(32);
  const stateHash = await sha256Base64Url(state);
  const { verifier, challenge } = await createPkcePair();
  const key = await encryptionKey();

  const { error } = await db.from("oauth_states").insert({
    state_hash: stateHash,
    user_id: userId,
    mode,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier_enc: await encryptString(key, verifier, verifierAad(userId, stateHash)),
  });
  if (error) throw new Error(error.message);

  return {
    authorizeUrl: buildAuthorizeUrl({ clientId, redirectUri, state, codeChallenge: challenge }),
    state,
  };
}

async function complete(userId: string, body: Record<string, unknown>) {
  const code = typeof body.code === "string" ? body.code : "";
  const state = typeof body.state === "string" ? body.state : "";
  if (!code || code.length > 2048 || !state || state.length > 256) {
    throw new HttpError(400, "bad_request", "Некорректный ответ авторизации");
  }
  const stateHash = await sha256Base64Url(state);
  const db = adminClient();

  // Удаление с возвратом делает state одноразовым даже при повторной отправке.
  const { data: rows, error } = await db
    .from("oauth_states")
    .delete()
    .eq("state_hash", stateHash)
    .eq("user_id", userId)
    .select("mode, client_id, redirect_uri, code_verifier_enc, expires_at");
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row) {
    throw new HttpError(400, "invalid_state", "Сессия подключения не найдена или уже использована. Начните заново.");
  }
  if (Date.parse(row.expires_at) < Date.now()) {
    throw new HttpError(400, "invalid_state", "Сессия подключения истекла. Начните заново.");
  }

  const key = await encryptionKey();
  const verifier = await decryptString(key, row.code_verifier_enc, verifierAad(userId, stateHash));

  let tokens;
  try {
    tokens = await exchangeCode({
      clientId: row.client_id,
      code,
      redirectUri: row.redirect_uri,
      codeVerifier: verifier,
    });
  } catch (e) {
    if (e instanceof SpotifyAuthError) {
      throw new HttpError(400, "spotify_error", `Spotify отклонил подключение: ${e.message}`);
    }
    throw e;
  }
  if (!tokens.refresh_token) throw new HttpError(400, "spotify_error", "Spotify не вернул refresh-токен");

  const grantedScopes = (tokens.scope ?? "").split(" ").filter(Boolean);
  if (!SPOTIFY_SCOPES.every((s) => grantedScopes.includes(s))) {
    throw new HttpError(400, "spotify_error", "Не выдано разрешение user-read-currently-playing");
  }

  const profile = await getProfile(tokens.access_token);
  await saveTokens(userId, tokens);
  await db.from("playback_cache").delete().eq("user_id", userId);
  const { error: upsertError } = await db.from("spotify_connections").upsert({
    user_id: userId,
    mode: row.mode,
    client_id: row.client_id,
    status: "connected",
    spotify_user_id: profile.id,
    spotify_display_name: profile.displayName,
    scopes: grantedScopes.join(" "),
    last_error: null,
    connected_at: new Date().toISOString(),
  });
  if (upsertError) throw new Error(upsertError.message);

  return { ok: true, displayName: profile.displayName };
}

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  try {
    if (req.method !== "POST") throw new HttpError(405, "bad_request", "Метод не поддерживается");
    const user = await requireUser(req);
    const body = await readJson(req);

    switch (body.action) {
      case "config":
        return json(req, {
          sharedClientAvailable: env.sharedClientId() !== null,
          scopes: SPOTIFY_SCOPES,
          allowedRedirectUris: env.allowedRedirectUris(),
        });
      case "start":
        return json(req, await start(user.id, body));
      case "complete":
        return json(req, await complete(user.id, body));
      case "disconnect":
        await deleteSpotifyData(user.id);
        return json(req, { ok: true });
      default:
        throw new HttpError(400, "bad_request", "Неизвестное действие");
    }
  } catch (error) {
    return handleError(req, error);
  }
});
