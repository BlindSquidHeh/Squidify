// Чтение настроек Edge Functions. Секреты задаются командой
// `supabase secrets set ...` и никогда не попадают во фронтенд.

import { importEncryptionKey } from "./crypto.ts";

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Не задана переменная окружения ${name}`);
  return value;
}

function list(name: string): string[] {
  return (Deno.env.get(name) ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL"),
  serviceRoleKey: () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? required("SERVICE_ROLE_KEY"),
  /** Точный список разрешённых Redirect URI (как в Spotify Dashboard). */
  allowedRedirectUris: () => list("ALLOWED_REDIRECT_URIS"),
  /** Разрешённые Origin для CORS у функций с авторизацией. Пусто = любые. */
  allowedOrigins: () => list("ALLOWED_ORIGINS"),
  /** Общий Client ID. Включайте, только если приложение Spotify получило расширенную квоту
   *  или все пользователи добавлены в User Management (до 5 в Development Mode). */
  sharedClientId: () => {
    const value = Deno.env.get("SPOTIFY_SHARED_CLIENT_ID")?.trim();
    return value && /^[0-9a-zA-Z]{32}$/.test(value) ? value : null;
  },
};

let cachedKey: Promise<CryptoKey> | null = null;

export function encryptionKey(): Promise<CryptoKey> {
  if (!cachedKey) cachedKey = importEncryptionKey(required("TOKEN_ENCRYPTION_KEY"));
  return cachedKey;
}
