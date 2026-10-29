// Проверка адресов, которые приложение готово открыть. Чистые функции без Electron.

export interface WidgetLocation {
  /** Полный адрес страницы виджета, включая #токен. */
  href: string;
  /** Origin сайта: только с него разрешено загружать содержимое окна. */
  origin: string;
}

const TOKEN_RE = /^[0-9a-f]{64}$/;
const DEMO_RE = /^demo=[A-Za-z0-9_-]{1,20000}$/;

function isLoopback(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "localhost";
}

/**
 * Принимает только ссылку на страницу виджета Squidify: https (или локальный
 * http для разработки), путь заканчивается на /w/, во фрагменте — токен виджета.
 */
export function parseWidgetUrl(input: string): WidgetLocation | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const secure = url.protocol === "https:" || (url.protocol === "http:" && isLoopback(url.hostname));
  if (!secure) return null;
  if (url.username || url.password) return null;
  if (!/\/w\/?$/.test(url.pathname)) return null;
  const fragment = url.hash.replace(/^#/, "");
  if (!TOKEN_RE.test(fragment.toLowerCase()) && !DEMO_RE.test(fragment)) return null;
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.search = "";
  return { href: url.toString(), origin: url.origin };
}

/** squidify://open?url=<encoded widget url> */
export function parseProtocolUrl(input: string): WidgetLocation | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "squidify:") return null;
  // В Windows адрес приходит как squidify://open/?url=... или squidify://open?url=...
  const action = (url.hostname || url.pathname.replace(/^\/+/, "")).replace(/\/+$/, "");
  if (action !== "open") return null;
  const target = url.searchParams.get("url");
  return target ? parseWidgetUrl(target) : null;
}

/** Ссылки, которые можно открыть во внешнем браузере (из виджета). */
export function isAllowedExternalUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "https:" && (url.hostname === "open.spotify.com" || url.hostname === "www.spotify.com");
  } catch {
    return false;
  }
}

export function sameOrigin(input: string, origin: string): boolean {
  try {
    return new URL(input).origin === origin;
  } catch {
    return false;
  }
}
