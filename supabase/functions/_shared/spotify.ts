// Вызовы Spotify Accounts и Web API.
// Документация: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

export const SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_API = "https://api.spotify.com/v1";

/** Минимально необходимое разрешение: только чтение текущего трека. */
export const SPOTIFY_SCOPES = ["user-read-currently-playing"];

const TIMEOUT_MS = 8000;

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope?: string;
  expires_in: number;
  refresh_token?: string;
}

export class SpotifyAuthError extends Error {
  constructor(
    public code: string,
    message: string,
    /** true, если refresh-токен больше не действителен и нужно переподключение. */
    public revoked: boolean,
  ) {
    super(message);
  }
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(SPOTIFY_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: params.clientId,
    scope: SPOTIFY_SCOPES.join(" "),
    redirect_uri: params.redirectUri,
    state: params.state,
    code_challenge_method: "S256",
    code_challenge: params.codeChallenge,
    show_dialog: "true",
  }).toString();
  return url.toString();
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new SpotifyAuthError("network", "Spotify недоступен, попробуйте позже", false);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof data.error === "string" ? data.error : `http_${res.status}`;
    const description = typeof data.error_description === "string" ? data.error_description : "";
    // invalid_grant: код/refresh-токен недействителен или отозван.
    // invalid_client: Client ID удалён или неверен.
    const revoked = code === "invalid_grant" || code === "invalid_client" || code === "unauthorized_client";
    throw new SpotifyAuthError(code, description || `Ошибка Spotify: ${code}`, revoked);
  }
  if (typeof data.access_token !== "string" || typeof data.expires_in !== "number") {
    throw new SpotifyAuthError("invalid_response", "Неожиданный ответ Spotify", false);
  }
  return data as TokenResponse;
}

export function exchangeCode(params: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  });
}

/** Обновление токена в PKCE-потоке не требует Client Secret. Spotify может вернуть новый refresh-токен. */
export function refreshAccessToken(clientId: string, refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
}

export type ApiResult =
  | { kind: "ok"; status: 200; body: unknown }
  | { kind: "empty"; status: 204 }
  | { kind: "unauthorized"; status: 401 }
  | { kind: "forbidden"; status: 403; message: string }
  | { kind: "rate_limited"; status: 429; retryAfter: string | null }
  | { kind: "error"; status: number; message: string };

export async function getCurrentlyPlaying(accessToken: string): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(`${SPOTIFY_API}/me/player/currently-playing?additional_types=track,episode`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    return { kind: "error", status: 0, message: `Сетевая ошибка: ${(error as Error).name}` };
  }
  if (res.status === 204) return { kind: "empty", status: 204 };
  if (res.status === 401) {
    await res.body?.cancel();
    return { kind: "unauthorized", status: 401 };
  }
  if (res.status === 403) {
    const data = await res.json().catch(() => ({}));
    return { kind: "forbidden", status: 403, message: String(data?.error?.message ?? "Forbidden") };
  }
  if (res.status === 429) {
    await res.body?.cancel();
    return { kind: "rate_limited", status: 429, retryAfter: res.headers.get("Retry-After") };
  }
  if (!res.ok) {
    await res.body?.cancel();
    return { kind: "error", status: res.status, message: `Spotify ответил ${res.status}` };
  }
  const text = await res.text();
  // Иногда Spotify отвечает 200 с пустым телом, если ничего не играет.
  if (!text.trim()) return { kind: "empty", status: 204 };
  try {
    return { kind: "ok", status: 200, body: JSON.parse(text) };
  } catch {
    return { kind: "error", status: 200, message: "Некорректный JSON от Spotify" };
  }
}

export async function getProfile(accessToken: string): Promise<{ id: string | null; displayName: string | null }> {
  try {
    const res = await fetch(`${SPOTIFY_API}/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      await res.body?.cancel();
      return { id: null, displayName: null };
    }
    const data = await res.json();
    return {
      id: typeof data.id === "string" ? data.id : null,
      displayName: typeof data.display_name === "string" ? data.display_name : null,
    };
  } catch {
    return { id: null, displayName: null };
  }
}
