import { describe, expect, it } from "vitest";
import {
  base64UrlToBytes,
  bytesToBase64Url,
  createPkcePair,
  decryptString,
  encryptString,
  importEncryptionKey,
  sha256Base64Url,
  timingSafeEqual,
} from "./crypto.ts";

const KEY = bytesToBase64Url(new Uint8Array(32).fill(7));

describe("PKCE", () => {
  it("challenge совпадает с примером из RFC 7636", async () => {
    expect(await sha256Base64Url("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  it("verifier соответствует требованиям длины и алфавита", async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/);
    expect(challenge).toBe(await sha256Base64Url(verifier));
  });
});

describe("AES-GCM", () => {
  it("шифрует и расшифровывает", async () => {
    const key = await importEncryptionKey(KEY);
    const enc = await encryptString(key, "refresh-token-секрет", "refresh:user1");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("refresh-token");
    expect(await decryptString(key, enc, "refresh:user1")).toBe("refresh-token-секрет");
  });

  it("каждый раз новый IV", async () => {
    const key = await importEncryptionKey(KEY);
    expect(await encryptString(key, "x")).not.toBe(await encryptString(key, "x"));
  });

  it("не расшифровывается с чужим AAD (подмена строки другого пользователя)", async () => {
    const key = await importEncryptionKey(KEY);
    const enc = await encryptString(key, "secret", "refresh:user1");
    await expect(decryptString(key, enc, "refresh:user2")).rejects.toThrow();
  });

  it("требует ключ ровно 32 байта", async () => {
    await expect(importEncryptionKey(bytesToBase64Url(new Uint8Array(16)))).rejects.toThrow();
  });

  it("принимает стандартный base64 с паддингом (вывод openssl rand -base64 32)", async () => {
    const std = btoa(String.fromCharCode(...new Uint8Array(32).fill(250)));
    expect(std).toMatch(/[+/=]/);
    await expect(importEncryptionKey(std)).resolves.toBeDefined();
  });
});

describe("утилиты", () => {
  it("base64url туда и обратно", () => {
    const bytes = new Uint8Array([0, 255, 128, 62, 63]);
    expect(Array.from(base64UrlToBytes(bytesToBase64Url(bytes)))).toEqual(Array.from(bytes));
  });
  it("timingSafeEqual", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
