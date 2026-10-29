// Криптографические утилиты на WebCrypto. Модуль не зависит от Deno,
// поэтому его можно тестировать в Node (vitest).

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

/**
 * PKCE (RFC 7636): code_verifier длиной 43–128 символов из
 * [A-Za-z0-9-._~] и code_challenge = BASE64URL(SHA256(verifier)).
 */
export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  // 64 случайных байта дают 86 символов base64url.
  const verifier = randomBase64Url(64);
  const challenge = await sha256Base64Url(verifier);
  return { verifier, challenge };
}

/** Сравнение строк за время, не зависящее от позиции первого различия. */
export function timingSafeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

const KEY_VERSION = "v1";

/**
 * Импортирует ключ AES-256-GCM из base64 (стандартного или url-safe).
 * Ключ должен быть ровно 32 байта: `openssl rand -base64 32`.
 */
// deno-lint-ignore require-await
export async function importEncryptionKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64UrlToBytes(base64Key.trim());
  if (raw.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY должен содержать 32 байта в base64");
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Шифрует строку. Формат результата: `v1.<iv>.<ciphertext+tag>`. */
export async function encryptString(key: CryptoKey, plaintext: string, aad = ""): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(aad) },
    key,
    encoder.encode(plaintext),
  );
  return `${KEY_VERSION}.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptString(key: CryptoKey, payload: string, aad = ""): Promise<string> {
  const [version, ivPart, dataPart] = payload.split(".");
  if (version !== KEY_VERSION || !ivPart || !dataPart) {
    throw new Error("Неизвестный формат зашифрованных данных");
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(ivPart), additionalData: encoder.encode(aad) },
    key,
    base64UrlToBytes(dataPart),
  );
  return decoder.decode(plaintext);
}
