// Схема конфигурации виджета. Конфигурация хранится в Supabase как JSON и
// всегда проходит через normalizeConfig(): неизвестные поля отбрасываются,
// числа ограничиваются диапазонами, цвета и шрифты проверяются по списку.
// Это защищает страницу виджета от некорректных или вредоносных значений.

export const LAYOUTS = ["horizontal", "vertical", "compact", "text", "large-cover", "progress"] as const;
export type Layout = (typeof LAYOUTS)[number];

export const LAYOUT_LABELS: Record<Layout, string> = {
  horizontal: "Горизонтальный",
  vertical: "Вертикальный",
  compact: "Компактный",
  text: "Только текст",
  "large-cover": "Крупная обложка",
  progress: "Полоса прогресса",
};

export const FONTS = [
  { id: "inter", label: "Inter", family: "Inter", google: "Inter:wght@400;500;600;700;800" },
  { id: "manrope", label: "Manrope", family: "Manrope", google: "Manrope:wght@400;500;600;700;800" },
  { id: "montserrat", label: "Montserrat", family: "Montserrat", google: "Montserrat:wght@400;500;600;700;800" },
  { id: "roboto", label: "Roboto", family: "Roboto", google: "Roboto:wght@400;500;700;900" },
  { id: "rubik", label: "Rubik", family: "Rubik", google: "Rubik:wght@400;500;600;700;800" },
  { id: "nunito", label: "Nunito", family: "Nunito", google: "Nunito:wght@400;600;700;800" },
  { id: "unbounded", label: "Unbounded", family: "Unbounded", google: "Unbounded:wght@400;500;600;700;800" },
  { id: "comfortaa", label: "Comfortaa", family: "Comfortaa", google: "Comfortaa:wght@400;500;600;700" },
  { id: "oswald", label: "Oswald", family: "Oswald", google: "Oswald:wght@400;500;600;700" },
  { id: "playfair", label: "Playfair Display", family: "Playfair Display", google: "Playfair+Display:wght@400;600;700;800" },
  { id: "jetbrains", label: "JetBrains Mono", family: "JetBrains Mono", google: "JetBrains+Mono:wght@400;500;700;800" },
  { id: "pixel", label: "Press Start 2P", family: "Press Start 2P", google: "Press+Start+2P" },
  { id: "system", label: "Системный", family: "", google: null },
] as const;
export type FontId = (typeof FONTS)[number]["id"];
const FONT_IDS = FONTS.map((f) => f.id) as FontId[];

export const ALIGNS = ["start", "center", "end"] as const;
export type Align = (typeof ALIGNS)[number];

export const BACKGROUND_TYPES = ["solid", "gradient", "none"] as const;
export const PROGRESS_STYLES = ["bar", "line", "glow", "segmented"] as const;
export const TRACK_ANIMATIONS = ["none", "fade", "slide-up", "slide-left", "scale", "blur"] as const;
export const IDLE_BEHAVIORS = ["hide", "message", "last"] as const;
export const LINK_TEXTS = ["OPEN SPOTIFY", "PLAY ON SPOTIFY", "LISTEN ON SPOTIFY"] as const;
export const ATTRIBUTION_POSITIONS = ["top-right", "top-left", "bottom-right", "bottom-left", "inline"] as const;
export const ATTRIBUTION_VARIANTS = ["auto", "green", "white", "black"] as const;
export const TIME_FORMATS = ["elapsed-total", "elapsed-remaining"] as const;

export interface WidgetConfig {
  schemaVersion: 1;
  layout: Layout;
  elements: {
    cover: boolean;
    title: boolean;
    artists: boolean;
    album: boolean;
    progress: boolean;
    elapsed: boolean;
    remaining: boolean;
    spotifyLink: boolean;
  };
  size: {
    width: number;
    /** 0 = высота по содержимому. */
    height: number;
    padding: number;
    gap: number;
  };
  align: {
    horizontal: Align;
    vertical: Align;
  };
  text: {
    font: FontId;
    titleSize: number;
    titleWeight: number;
    artistSize: number;
    albumSize: number;
    timeSize: number;
    uppercase: boolean;
    letterSpacing: number;
    shadow: boolean;
  };
  colors: {
    title: string;
    artist: string;
    album: string;
    time: string;
  };
  background: {
    type: (typeof BACKGROUND_TYPES)[number];
    color: string;
    color2: string;
    angle: number;
    /** 0..100 */
    opacity: number;
    blur: number;
  };
  border: {
    radius: number;
    width: number;
    color: string;
  };
  shadow: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetY: number;
    /** 0..100 */
    opacity: number;
  };
  cover: {
    size: number;
    /** Spotify рекомендует 4px для небольших и 8px для крупных обложек. */
    radius: number;
    shadow: boolean;
  };
  progress: {
    style: (typeof PROGRESS_STYLES)[number];
    height: number;
    radius: number;
    trackColor: string;
    fillColor: string;
    fillColor2: string;
    gradient: boolean;
    knob: boolean;
    timeFormat: (typeof TIME_FORMATS)[number];
  };
  animation: {
    trackChange: (typeof TRACK_ANIMATIONS)[number];
    durationMs: number;
    marquee: boolean;
    marqueeSpeed: number;
  };
  behavior: {
    whenIdle: (typeof IDLE_BEHAVIORS)[number];
    idleMessage: string;
    hideWhenPaused: boolean;
    pausedBadge: boolean;
  };
  link: {
    text: (typeof LINK_TEXTS)[number];
    color: string;
    background: string;
  };
  attribution: {
    position: (typeof ATTRIBUTION_POSITIONS)[number];
    variant: (typeof ATTRIBUTION_VARIANTS)[number];
    size: number;
  };
}

export const DEFAULT_CONFIG: WidgetConfig = {
  schemaVersion: 1,
  layout: "horizontal",
  elements: {
    cover: true,
    title: true,
    artists: true,
    album: false,
    progress: true,
    elapsed: true,
    remaining: true,
    spotifyLink: false,
  },
  size: { width: 420, height: 0, padding: 14, gap: 14 },
  align: { horizontal: "start", vertical: "center" },
  text: {
    font: "inter",
    titleSize: 18,
    titleWeight: 700,
    artistSize: 14,
    albumSize: 12,
    timeSize: 11,
    uppercase: false,
    letterSpacing: 0,
    shadow: false,
  },
  colors: { title: "#ffffff", artist: "#b3b3b3", album: "#8a8a8a", time: "#b3b3b3" },
  background: { type: "solid", color: "#121212", color2: "#1db954", angle: 135, opacity: 88, blur: 0 },
  border: { radius: 16, width: 0, color: "#ffffff" },
  shadow: { enabled: true, color: "#000000", blur: 24, offsetY: 8, opacity: 40 },
  cover: { size: 72, radius: 4, shadow: true },
  progress: {
    style: "bar",
    height: 4,
    radius: 4,
    trackColor: "#4d4d4d",
    fillColor: "#1db954",
    fillColor2: "#1ed760",
    gradient: false,
    knob: false,
    timeFormat: "elapsed-total",
  },
  animation: { trackChange: "fade", durationMs: 450, marquee: true, marqueeSpeed: 40 },
  behavior: { whenIdle: "message", idleMessage: "Сейчас ничего не играет", hideWhenPaused: false, pausedBadge: true },
  link: { text: "LISTEN ON SPOTIFY", color: "#000000", background: "#1db954" },
  attribution: { position: "top-right", variant: "auto", size: 21 },
};

// ---------------------------------------------------------------------------
// Валидация
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function obj(value: unknown): Obj {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : {};
}

export function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

const COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function color(value: unknown, fallback: string): string {
  return typeof value === "string" && COLOR_RE.test(value) ? value.toLowerCase() : fallback;
}

function text(value: unknown, maxLength: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  // Удаляем управляющие символы, текст выводится только как текст (не HTML).
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, maxLength);
}

export function normalizeConfig(input: unknown): WidgetConfig {
  const src = obj(input);
  const d = DEFAULT_CONFIG;
  const el = obj(src.elements);
  const size = obj(src.size);
  const align = obj(src.align);
  const t = obj(src.text);
  const c = obj(src.colors);
  const bg = obj(src.background);
  const border = obj(src.border);
  const sh = obj(src.shadow);
  const cover = obj(src.cover);
  const pr = obj(src.progress);
  const an = obj(src.animation);
  const be = obj(src.behavior);
  const link = obj(src.link);
  const at = obj(src.attribution);

  return {
    schemaVersion: 1,
    layout: oneOf(src.layout, LAYOUTS, d.layout),
    elements: {
      cover: bool(el.cover, d.elements.cover),
      title: bool(el.title, d.elements.title),
      artists: bool(el.artists, d.elements.artists),
      album: bool(el.album, d.elements.album),
      progress: bool(el.progress, d.elements.progress),
      elapsed: bool(el.elapsed, d.elements.elapsed),
      remaining: bool(el.remaining, d.elements.remaining),
      spotifyLink: bool(el.spotifyLink, d.elements.spotifyLink),
    },
    size: {
      width: num(size.width, 120, 1920, d.size.width),
      height: num(size.height, 0, 1080, d.size.height),
      padding: num(size.padding, 0, 80, d.size.padding),
      gap: num(size.gap, 0, 64, d.size.gap),
    },
    align: {
      horizontal: oneOf(align.horizontal, ALIGNS, d.align.horizontal),
      vertical: oneOf(align.vertical, ALIGNS, d.align.vertical),
    },
    text: {
      font: oneOf(t.font, FONT_IDS, d.text.font),
      titleSize: num(t.titleSize, 8, 96, d.text.titleSize),
      titleWeight: num(t.titleWeight, 300, 900, d.text.titleWeight),
      artistSize: num(t.artistSize, 8, 72, d.text.artistSize),
      albumSize: num(t.albumSize, 8, 72, d.text.albumSize),
      timeSize: num(t.timeSize, 8, 48, d.text.timeSize),
      uppercase: bool(t.uppercase, d.text.uppercase),
      letterSpacing: num(t.letterSpacing, -5, 20, d.text.letterSpacing),
      shadow: bool(t.shadow, d.text.shadow),
    },
    colors: {
      title: color(c.title, d.colors.title),
      artist: color(c.artist, d.colors.artist),
      album: color(c.album, d.colors.album),
      time: color(c.time, d.colors.time),
    },
    background: {
      type: oneOf(bg.type, BACKGROUND_TYPES, d.background.type),
      color: color(bg.color, d.background.color),
      color2: color(bg.color2, d.background.color2),
      angle: num(bg.angle, 0, 360, d.background.angle),
      opacity: num(bg.opacity, 0, 100, d.background.opacity),
      blur: num(bg.blur, 0, 40, d.background.blur),
    },
    border: {
      radius: num(border.radius, 0, 200, d.border.radius),
      width: num(border.width, 0, 12, d.border.width),
      color: color(border.color, d.border.color),
    },
    shadow: {
      enabled: bool(sh.enabled, d.shadow.enabled),
      color: color(sh.color, d.shadow.color),
      blur: num(sh.blur, 0, 120, d.shadow.blur),
      offsetY: num(sh.offsetY, -60, 60, d.shadow.offsetY),
      opacity: num(sh.opacity, 0, 100, d.shadow.opacity),
    },
    cover: {
      size: num(cover.size, 24, 640, d.cover.size),
      radius: num(cover.radius, 0, 8, d.cover.radius),
      shadow: bool(cover.shadow, d.cover.shadow),
    },
    progress: {
      style: oneOf(pr.style, PROGRESS_STYLES, d.progress.style),
      height: num(pr.height, 1, 24, d.progress.height),
      radius: num(pr.radius, 0, 12, d.progress.radius),
      trackColor: color(pr.trackColor, d.progress.trackColor),
      fillColor: color(pr.fillColor, d.progress.fillColor),
      fillColor2: color(pr.fillColor2, d.progress.fillColor2),
      gradient: bool(pr.gradient, d.progress.gradient),
      knob: bool(pr.knob, d.progress.knob),
      timeFormat: oneOf(pr.timeFormat, TIME_FORMATS, d.progress.timeFormat),
    },
    animation: {
      trackChange: oneOf(an.trackChange, TRACK_ANIMATIONS, d.animation.trackChange),
      durationMs: num(an.durationMs, 0, 3000, d.animation.durationMs),
      marquee: bool(an.marquee, d.animation.marquee),
      marqueeSpeed: num(an.marqueeSpeed, 5, 200, d.animation.marqueeSpeed),
    },
    behavior: {
      whenIdle: oneOf(be.whenIdle, IDLE_BEHAVIORS, d.behavior.whenIdle),
      idleMessage: text(be.idleMessage, 80, d.behavior.idleMessage),
      hideWhenPaused: bool(be.hideWhenPaused, d.behavior.hideWhenPaused),
      pausedBadge: bool(be.pausedBadge, d.behavior.pausedBadge),
    },
    link: {
      text: oneOf(link.text, LINK_TEXTS, d.link.text),
      color: color(link.color, d.link.color),
      background: color(link.background, d.link.background),
    },
    attribution: {
      position: oneOf(at.position, ATTRIBUTION_POSITIONS, d.attribution.position),
      variant: oneOf(at.variant, ATTRIBUTION_VARIANTS, d.attribution.variant),
      // Минимальный размер значка Spotify по правилам бренда: 21px.
      size: num(at.size, 21, 48, d.attribution.size),
    },
  };
}

/** Глубокое слияние частичного объекта с конфигурацией (для пресетов и редактора). */
export function mergeConfig(base: WidgetConfig, patch: unknown): WidgetConfig {
  const p = obj(patch);
  const merged: Obj = { ...base };
  for (const [key, value] of Object.entries(p)) {
    const current = (base as unknown as Obj)[key];
    merged[key] =
      current && typeof current === "object" && value && typeof value === "object"
        ? { ...(current as Obj), ...(value as Obj) }
        : value;
  }
  return normalizeConfig(merged);
}

export function fontFamily(font: FontId): string {
  const def = FONTS.find((f) => f.id === font);
  const stack = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  return def && def.family ? `"${def.family}", ${stack}` : stack;
}

export function googleFontUrl(font: FontId): string | null {
  const def = FONTS.find((f) => f.id === font);
  if (!def || !def.google) return null;
  return `https://fonts.googleapis.com/css2?family=${def.google}&display=swap`;
}

/** Рекомендуемый размер Browser Source в OBS. */
export function suggestedSourceSize(config: WidgetConfig): { width: number; height: number } {
  const shadowSpace = config.shadow.enabled ? config.shadow.blur + Math.abs(config.shadow.offsetY) : 0;
  const pad = Math.ceil(shadowSpace) + 8;
  const estimatedHeight = config.size.height || estimateHeight(config);
  return { width: config.size.width + pad * 2, height: estimatedHeight + pad * 2 };
}

function estimateHeight(c: WidgetConfig): number {
  const lines =
    (c.elements.title ? c.text.titleSize * 1.3 : 0) +
    (c.elements.artists ? c.text.artistSize * 1.35 : 0) +
    (c.elements.album ? c.text.albumSize * 1.35 : 0) +
    (c.elements.progress ? c.progress.height + 8 : 0) +
    (c.elements.elapsed || c.elements.remaining ? c.text.timeSize * 1.4 : 0) +
    (c.elements.spotifyLink ? 34 : 0);
  const cover = c.elements.cover ? c.cover.size : 0;
  switch (c.layout) {
    case "vertical":
    case "large-cover":
      return Math.round(c.size.padding * 2 + cover + c.size.gap + lines);
    case "progress":
      return Math.round(c.size.padding * 2 + Math.max(lines, 24));
    case "text":
      return Math.round(c.size.padding * 2 + lines);
    default:
      return Math.round(c.size.padding * 2 + Math.max(cover, lines));
  }
}
