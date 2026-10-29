import { env } from "./env.ts";

const BASE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function corsHeaders(req: Request, publicEndpoint: boolean): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = env.allowedOrigins();
  let allowOrigin = "*";
  if (!publicEndpoint && allowed.length > 0) {
    allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
  }
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-widget-token, x-config-version",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200, publicEndpoint = false): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...corsHeaders(req, publicEndpoint) },
  });
}

export function preflight(req: Request, publicEndpoint = false): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, publicEndpoint) });
  }
  return null;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 16_384) throw new HttpError(413, "bad_request", "Слишком большой запрос");
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  } catch {
    // ниже
  }
  throw new HttpError(400, "bad_request", "Ожидался JSON-объект");
}

export function handleError(req: Request, error: unknown, publicEndpoint = false): Response {
  if (error instanceof HttpError) {
    return json(req, { error: error.code, message: error.message }, error.status, publicEndpoint);
  }
  console.error(error);
  return json(req, { error: "server_error", message: "Внутренняя ошибка сервера" }, 500, publicEndpoint);
}
