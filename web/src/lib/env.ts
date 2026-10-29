// Публичные настройки сайта. Anon/publishable-ключ Supabase не является
// секретом: доступ к данным ограничивает Row Level Security.

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";
const forceDemo = import.meta.env.VITE_DEMO_MODE === "true";

export const config = {
  supabaseUrl: url.replace(/\/+$/, ""),
  supabaseAnonKey: anonKey,
  /** Демо-режим: нет ключей Supabase, данные хранятся в браузере. */
  demo: forceDemo || !url || !anonKey,
  basePath: import.meta.env.BASE_URL,
  /** Репозиторий проекта: ссылка на релизы приложения для Windows. */
  repositoryUrl: ((import.meta.env.VITE_REPOSITORY_URL as string | undefined) || "https://github.com/BlindSquidHeh/Squidify").replace(/\/+$/, ""),
};

export function functionsUrl(name: string): string {
  return `${config.supabaseUrl}/functions/v1/${name}`;
}
