import { config } from "./env";

/** Абсолютный адрес страницы сайта с учётом базового пути GitHub Pages. */
export function siteUrl(path = ""): string {
  const base = `${window.location.origin}${config.basePath}`;
  return base + path.replace(/^\/+/, "");
}

/** Redirect URI для Spotify. Должен в точности совпадать с адресом в Spotify Dashboard. */
export function spotifyRedirectUri(): string {
  return siteUrl("callback/spotify/");
}

/** Публичная ссылка на виджет. Токен передаётся во фрагменте (#), он не уходит на сервер GitHub Pages. */
export function widgetUrl(token: string): string {
  return `${siteUrl("w/")}#${token}`;
}

export function demoWidgetUrl(encodedConfig: string): string {
  return `${siteUrl("w/")}#demo=${encodedConfig}`;
}

/** Ссылка для открытия виджета в приложении для Windows. */
export function desktopOpenUrl(widgetLink: string): string {
  return `squidify://open?url=${encodeURIComponent(widgetLink)}`;
}
