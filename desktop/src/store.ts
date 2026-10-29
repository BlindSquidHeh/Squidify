import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from "./settings";

function file(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

export function loadSettings(): Settings {
  try {
    return sanitizeSettings(JSON.parse(fs.readFileSync(file(), "utf8")));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Атомарная запись: сначала во временный файл, затем переименование. */
export function saveSettings(settings: Settings): void {
  try {
    const target = file();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2), "utf8");
    fs.renameSync(tmp, target);
  } catch (error) {
    console.error("Не удалось сохранить настройки", error);
  }
}
