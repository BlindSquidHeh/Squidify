import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { env } from "./env.ts";
import { HttpError } from "./http.ts";

let admin: SupabaseClient | null = null;

/** Клиент с service_role. Используется только внутри Edge Functions. */
export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(env.supabaseUrl(), env.serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/** Проверяет JWT пользователя сайта и возвращает его id. */
export async function requireUser(req: Request): Promise<{ id: string; email: string | null }> {
  const header = req.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) throw new HttpError(401, "unauthorized", "Требуется вход в аккаунт");
  const { data, error } = await adminClient().auth.getUser(match[1]);
  if (error || !data.user) throw new HttpError(401, "unauthorized", "Сессия истекла, войдите заново");
  return { id: data.user.id, email: data.user.email ?? null };
}
