import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./env";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (config.demo) throw new Error("Supabase не настроен: сайт работает в демо-режиме");
  if (!client) {
    // На странице возврата из Spotify в адресе есть свои ?code= и ?error=,
    // их нельзя принимать за ответ авторизации Supabase.
    const isSpotifyCallback = window.location.pathname.includes("/callback/spotify");
    client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !isSpotifyCallback,
        storageKey: "squidify-auth",
      },
    });
  }
  return client;
}
