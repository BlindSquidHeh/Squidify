/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// На GitHub Pages сайт открывается по адресу https://<user>.github.io/<repo>/,
// поэтому базовый путь задаётся через VITE_BASE_PATH (в CI = /<repo>/).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let base = env.VITE_BASE_PATH || "/";
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;

  return {
    base,
    plugins: [react()],
    server: {
      // Spotify запрещает localhost в Redirect URI, используем 127.0.0.1.
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      fs: { allow: [".."] },
    },
    preview: { host: "127.0.0.1", port: 4173, strictPort: true },
    build: {
      target: "es2022",
      sourcemap: false,
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "../supabase/functions/_shared/**/*.test.ts"],
      css: false,
      globals: true,
    },
  };
});
