import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCode,
  getCurrentlyPlaying,
  refreshAccessToken,
  SpotifyAuthError,
} from "./spotify.ts";

function mockFetch(response: Response) {
  const fn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("buildAuthorizeUrl", () => {
  it("содержит PKCE, state и только минимальный scope", () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: "c".repeat(32),
        redirectUri: "https://u.github.io/Squidify/callback/spotify/",
        state: "st",
        codeChallenge: "ch",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("scope")).toBe("user-read-currently-playing");
    expect(url.searchParams.get("redirect_uri")).toBe("https://u.github.io/Squidify/callback/spotify/");
  });
});

describe("токены", () => {
  it("обмен кода отправляет code_verifier и не отправляет секрет", async () => {
    const fetchMock = mockFetch(
      Response.json({ access_token: "a", token_type: "Bearer", expires_in: 3600, refresh_token: "r", scope: "user-read-currently-playing" }),
    );
    const tokens = await exchangeCode({ clientId: "id", code: "code", redirectUri: "https://x/cb/", codeVerifier: "ver" });
    expect(tokens.refresh_token).toBe("r");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://accounts.spotify.com/api/token");
    const body = new URLSearchParams(String(init?.body));
    expect(Object.fromEntries(body)).toEqual({
      grant_type: "authorization_code",
      code: "code",
      redirect_uri: "https://x/cb/",
      client_id: "id",
      code_verifier: "ver",
    });
    expect(body.has("client_secret")).toBe(false);
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });

  it("refresh-токен с invalid_grant помечается как отозванный", async () => {
    mockFetch(Response.json({ error: "invalid_grant", error_description: "Refresh token revoked" }, { status: 400 }));
    const error = await refreshAccessToken("id", "r").catch((e) => e);
    expect(error).toBeInstanceOf(SpotifyAuthError);
    expect(error.revoked).toBe(true);
  });

  it("временная ошибка Spotify не считается отзывом", async () => {
    mockFetch(new Response("oops", { status: 503 }));
    const error = await refreshAccessToken("id", "r").catch((e) => e);
    expect(error.revoked).toBe(false);
  });
});

describe("getCurrentlyPlaying", () => {
  it("204 — ничего не играет", async () => {
    mockFetch(new Response(null, { status: 204 }));
    expect((await getCurrentlyPlaying("t")).kind).toBe("empty");
  });

  it("429 возвращает Retry-After", async () => {
    mockFetch(new Response(null, { status: 429, headers: { "Retry-After": "12" } }));
    expect(await getCurrentlyPlaying("t")).toEqual({ kind: "rate_limited", status: 429, retryAfter: "12" });
  });

  it("401 и 403", async () => {
    mockFetch(new Response(null, { status: 401 }));
    expect((await getCurrentlyPlaying("t")).kind).toBe("unauthorized");
    mockFetch(Response.json({ error: { status: 403, message: "User not registered in the Developer Dashboard" } }, { status: 403 }));
    expect(await getCurrentlyPlaying("t")).toMatchObject({ kind: "forbidden", message: "User not registered in the Developer Dashboard" });
  });

  it("сетевой сбой", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect((await getCurrentlyPlaying("t")).kind).toBe("error");
  });

  it("запрашивает треки и эпизоды с Bearer-токеном", async () => {
    const fetchMock = mockFetch(Response.json({ is_playing: true, item: null }));
    await getCurrentlyPlaying("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.spotify.com/v1/me/player/currently-playing?additional_types=track,episode");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok");
  });
});
