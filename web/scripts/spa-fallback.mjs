// GitHub Pages — статический хостинг. Чтобы прямые ссылки на страницы сайта
// (например, Redirect URI Spotify или ссылка виджета для OBS) открывались с
// кодом 200, копируем index.html в папки маршрутов. 404.html обрабатывает
// остальные адреса.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const index = join(dist, "index.html");
if (!existsSync(index)) {
  console.error("dist/index.html не найден, сначала выполните vite build");
  process.exit(1);
}

const routes = [
  "w",
  "callback/spotify",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "app",
  "app/spotify",
  "app/editor",
  "app/account",
  "obs",
  "desktop",
  "privacy",
];

for (const route of routes) {
  const dir = join(dist, route);
  mkdirSync(dir, { recursive: true });
  copyFileSync(index, join(dir, "index.html"));
}
copyFileSync(index, join(dist, "404.html"));
console.log(`SPA fallback: ${routes.length} маршрутов + 404.html`);
