// В демо-режиме нет сервера, поэтому конфигурация виджета кодируется
// прямо во фрагмент ссылки (#demo=...). Так ссылку можно проверить в OBS.

import { normalizeConfig, type WidgetConfig } from "../widget/config";

export function encodeDemoConfig(config: WidgetConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeDemoConfig(value: string): WidgetConfig | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return normalizeConfig(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
