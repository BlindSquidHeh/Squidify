// Доступ к данным сайта. В обычном режиме всё идёт в Supabase (таблицы с RLS
// и Edge Functions), в демо-режиме — в localStorage браузера.

import { DEFAULT_CONFIG, normalizeConfig, type WidgetConfig } from "../widget/config";
import { config, functionsUrl } from "./env";
import { ApiError } from "./errors";
import { getSupabase } from "./supabase";

export { ApiError };

export interface WidgetRecord {
  id: string;
  name: string;
  config: WidgetConfig;
  publicToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface PresetRecord {
  id: string;
  name: string;
  config: WidgetConfig;
  createdAt: string;
}

export interface SpotifyConnection {
  mode: "own" | "shared";
  clientId: string;
  status: "connected" | "reauth_required";
  displayName: string | null;
  connectedAt: string;
  lastError: string | null;
}

export interface SpotifyServerConfig {
  sharedClientAvailable: boolean;
  scopes: string[];
  allowedRedirectUris: string[];
}

// ---------------------------------------------------------------------------
// Демо-хранилище
// ---------------------------------------------------------------------------

interface DemoStore {
  widgets: WidgetRecord[];
  presets: PresetRecord[];
}

const DEMO_KEY = "squidify-demo-v1";

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function readDemo(): DemoStore {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStore;
      return {
        widgets: (parsed.widgets ?? []).map((w) => ({ ...w, config: normalizeConfig(w.config) })),
        presets: (parsed.presets ?? []).map((p) => ({ ...p, config: normalizeConfig(p.config) })),
      };
    }
  } catch {
    // повреждённые данные или недоступный localStorage
  }
  return { widgets: [], presets: [] };
}

function writeDemo(store: DemoStore) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(store));
  } catch {
    throw new ApiError("Не удалось сохранить данные в браузере");
  }
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

interface WidgetRow {
  id: string;
  name: string;
  config: unknown;
  public_token: string;
  created_at: string;
  updated_at: string;
}

const WIDGET_COLUMNS = "id, name, config, public_token, created_at, updated_at";

function toWidget(row: WidgetRow): WidgetRecord {
  return {
    id: row.id,
    name: row.name,
    config: normalizeConfig(row.config),
    publicToken: row.public_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbError(error: { message: string; code?: string } | null): never {
  const message = error?.message ?? "Неизвестная ошибка";
  if (/JWT|session/i.test(message)) throw new ApiError("Сессия истекла, войдите заново", 401, "unauthorized");
  throw new ApiError(message, 400, error?.code ?? "error");
}

async function accessToken(): Promise<string> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("Требуется вход в аккаунт", 401, "unauthorized");
  return token;
}

async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(functionsUrl(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${await accessToken()}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Сервер недоступен. Проверьте подключение к интернету.", 0, "network");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      typeof data.message === "string" ? data.message : `Ошибка сервера (${res.status})`,
      res.status,
      typeof data.error === "string" ? data.error : "error",
    );
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Виджеты
// ---------------------------------------------------------------------------

export async function listWidgets(): Promise<WidgetRecord[]> {
  if (config.demo) return readDemo().widgets;
  const { data, error } = await getSupabase()
    .from("widgets")
    .select(WIDGET_COLUMNS)
    .order("created_at", { ascending: true });
  if (error) dbError(error);
  return (data as WidgetRow[]).map(toWidget);
}

export async function getWidget(id: string): Promise<WidgetRecord | null> {
  if (config.demo) return readDemo().widgets.find((w) => w.id === id) ?? null;
  const { data, error } = await getSupabase().from("widgets").select(WIDGET_COLUMNS).eq("id", id).maybeSingle();
  if (error) dbError(error);
  return data ? toWidget(data as WidgetRow) : null;
}

export async function createWidget(name: string, widgetConfig: WidgetConfig = DEFAULT_CONFIG): Promise<WidgetRecord> {
  const cfg = normalizeConfig(widgetConfig);
  if (config.demo) {
    const store = readDemo();
    if (store.widgets.length >= 20) throw new ApiError("Достигнут лимит: не больше 20 виджетов");
    const now = new Date().toISOString();
    const widget: WidgetRecord = {
      id: crypto.randomUUID(),
      name,
      config: cfg,
      publicToken: randomHex(32),
      createdAt: now,
      updatedAt: now,
    };
    store.widgets.push(widget);
    writeDemo(store);
    return widget;
  }
  const { data, error } = await getSupabase()
    .from("widgets")
    .insert({ name, config: cfg })
    .select(WIDGET_COLUMNS)
    .single();
  if (error) dbError(error);
  return toWidget(data as WidgetRow);
}

export async function updateWidget(
  id: string,
  patch: { name?: string; config?: WidgetConfig },
): Promise<WidgetRecord> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim().slice(0, 80) || "Без названия";
  if (patch.config !== undefined) update.config = normalizeConfig(patch.config);
  if (config.demo) {
    const store = readDemo();
    const widget = store.widgets.find((w) => w.id === id);
    if (!widget) throw new ApiError("Виджет не найден", 404);
    Object.assign(widget, update, { updatedAt: new Date().toISOString() });
    writeDemo(store);
    return widget;
  }
  const { data, error } = await getSupabase()
    .from("widgets")
    .update(update)
    .eq("id", id)
    .select(WIDGET_COLUMNS)
    .single();
  if (error) dbError(error);
  return toWidget(data as WidgetRow);
}

export async function deleteWidget(id: string): Promise<void> {
  if (config.demo) {
    const store = readDemo();
    store.widgets = store.widgets.filter((w) => w.id !== id);
    writeDemo(store);
    return;
  }
  const { error } = await getSupabase().from("widgets").delete().eq("id", id);
  if (error) dbError(error);
}

/** Создаёт новую публичную ссылку. Старая перестаёт работать сразу. */
export async function regenerateWidgetToken(id: string): Promise<string> {
  if (config.demo) {
    const store = readDemo();
    const widget = store.widgets.find((w) => w.id === id);
    if (!widget) throw new ApiError("Виджет не найден", 404);
    widget.publicToken = randomHex(32);
    writeDemo(store);
    return widget.publicToken;
  }
  const { data, error } = await getSupabase().rpc("regenerate_widget_token", { p_widget_id: id });
  if (error) dbError(error);
  return data as string;
}

// ---------------------------------------------------------------------------
// Пресеты
// ---------------------------------------------------------------------------

export async function listPresets(): Promise<PresetRecord[]> {
  if (config.demo) return readDemo().presets;
  const { data, error } = await getSupabase()
    .from("widget_presets")
    .select("id, name, config, created_at")
    .order("created_at", { ascending: false });
  if (error) dbError(error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    config: normalizeConfig(row.config),
    createdAt: row.created_at as string,
  }));
}

export async function createPreset(name: string, presetConfig: WidgetConfig): Promise<PresetRecord> {
  const cfg = normalizeConfig(presetConfig);
  const cleanName = name.trim().slice(0, 80) || "Мой пресет";
  if (config.demo) {
    const store = readDemo();
    const preset = { id: crypto.randomUUID(), name: cleanName, config: cfg, createdAt: new Date().toISOString() };
    store.presets.unshift(preset);
    writeDemo(store);
    return preset;
  }
  const { data, error } = await getSupabase()
    .from("widget_presets")
    .insert({ name: cleanName, config: cfg })
    .select("id, name, config, created_at")
    .single();
  if (error) dbError(error);
  return { id: data.id, name: data.name, config: normalizeConfig(data.config), createdAt: data.created_at };
}

export async function deletePreset(id: string): Promise<void> {
  if (config.demo) {
    const store = readDemo();
    store.presets = store.presets.filter((p) => p.id !== id);
    writeDemo(store);
    return;
  }
  const { error } = await getSupabase().from("widget_presets").delete().eq("id", id);
  if (error) dbError(error);
}

// ---------------------------------------------------------------------------
// Spotify
// ---------------------------------------------------------------------------

export async function getSpotifyConnection(): Promise<SpotifyConnection | null> {
  if (config.demo) return null;
  const { data, error } = await getSupabase()
    .from("spotify_connections")
    .select("mode, client_id, status, spotify_display_name, connected_at, last_error")
    .maybeSingle();
  if (error) dbError(error);
  if (!data) return null;
  return {
    mode: data.mode,
    clientId: data.client_id,
    status: data.status,
    displayName: data.spotify_display_name,
    connectedAt: data.connected_at,
    lastError: data.last_error,
  };
}

export function getSpotifyServerConfig(): Promise<SpotifyServerConfig> {
  return callFunction<SpotifyServerConfig>("spotify-auth", { action: "config" });
}

export function startSpotifyAuth(params: {
  mode: "own" | "shared";
  clientId?: string;
  redirectUri: string;
}): Promise<{ authorizeUrl: string; state: string }> {
  return callFunction("spotify-auth", { action: "start", ...params });
}

export function completeSpotifyAuth(code: string, state: string): Promise<{ ok: boolean; displayName: string | null }> {
  return callFunction("spotify-auth", { action: "complete", code, state });
}

export async function disconnectSpotify(): Promise<void> {
  await callFunction("spotify-auth", { action: "disconnect" });
}

export async function deleteAccount(): Promise<void> {
  await callFunction("account-delete", { confirm: "DELETE" });
  await getSupabase().auth.signOut({ scope: "local" });
}

// ---------------------------------------------------------------------------
// Сообщения об ошибках авторизации
// ---------------------------------------------------------------------------

export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const map: [RegExp, string][] = [
    [/invalid login credentials/i, "Неверный email или пароль"],
    [/email not confirmed/i, "Подтвердите email: мы отправили письмо со ссылкой"],
    [/user already registered|already been registered/i, "Пользователь с таким email уже зарегистрирован"],
    [/password should be at least|weak password/i, "Пароль слишком короткий или простой (минимум 8 символов)"],
    [/rate limit|too many/i, "Слишком много попыток. Подождите немного и попробуйте снова"],
    [/unable to validate email|invalid email/i, "Некорректный email"],
    [/new password should be different/i, "Новый пароль должен отличаться от старого"],
    [/failed to fetch|network/i, "Сервер недоступен. Проверьте подключение к интернету"],
  ];
  for (const [re, text] of map) if (re.test(message)) return text;
  return message || "Что-то пошло не так";
}
