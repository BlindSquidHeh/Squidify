// Полное удаление аккаунта: данные Spotify, виджеты, пресеты и сам пользователь.
// Таблицы связаны с auth.users через ON DELETE CASCADE, но данные Spotify
// удаляются явно и первыми, чтобы токены точно не остались при сбое.

import { handleError, HttpError, json, preflight, readJson } from "../_shared/http.ts";
import { adminClient, requireUser } from "../_shared/supabase.ts";
import { deleteSpotifyData } from "../_shared/tokens.ts";

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;

  try {
    if (req.method !== "POST") throw new HttpError(405, "bad_request", "Метод не поддерживается");
    const user = await requireUser(req);
    const body = await readJson(req);
    if (body.confirm !== "DELETE") {
      throw new HttpError(400, "bad_request", "Удаление не подтверждено");
    }

    await deleteSpotifyData(user.id);
    const db = adminClient();
    await db.from("widgets").delete().eq("user_id", user.id);
    await db.from("widget_presets").delete().eq("user_id", user.id);
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);

    return json(req, { ok: true });
  } catch (error) {
    return handleError(req, error);
  }
});
