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
  { id: "bebas", label: "Bebas Neue", family: "Bebas Neue", google: "Bebas+Neue" },
  { id: "orbitron", label: "Orbitron", family: "Orbitron", google: "Orbitron:wght@400;500;600;700;800;900" },
  { id: "russo", label: "Russo One", family: "Russo One", google: "Russo+One" },
  { id: "righteous", label: "Righteous", family: "Righteous", google: "Righteous" },
  { id: "audiowide", label: "Audiowide", family: "Audiowide", google: "Audiowide" },
  { id: "bungee", label: "Bungee", family: "Bungee", google: "Bungee" },
  { id: "pacifico", label: "Pacifico", family: "Pacifico", google: "Pacifico" },
  { id: "caveat", label: "Caveat", family: "Caveat", google: "Caveat:wght@400;500;600;700" },
  { id: "marck", label: "Marck Script", family: "Marck Script", google: "Marck+Script" },
  { id: "system", label: "Системный", family: "", google: null },
] as const;
export type FontId = (typeof FONTS)[number]["id"];
const FONT_IDS = FONTS.map((f) => f.id) as FontId[];
/** Второй шрифт (исполнитель, альбом, время): «same» = как у названия. */
const SECONDARY_FONT_IDS = ["same", ...FONT_IDS] as readonly (FontId | "same")[];

export const ALIGNS = ["start", "center", "end"] as const;
export type Align = (typeof ALIGNS)[number];

export const BACKGROUND_TYPES = ["solid", "gradient", "none"] as const;
export const PROGRESS_STYLES = ["bar", "line", "glow", "segmented", "dots", "stripes", "rainbow", "cover-ring"] as const;
export const TRACK_ANIMATIONS = ["none", "fade", "slide-up", "slide-left", "scale", "blur", "flip", "bounce", "drop"] as const;
export const IDLE_EFFECTS = ["none", "float", "pulse", "swing"] as const;
export const TEXT_EFFECTS = ["none", "gradient", "rainbow", "neon", "outline"] as const;
export const BORDER_STYLES = ["solid", "dashed", "dotted", "double"] as const;
export const BORDER_EFFECTS = ["none", "pulse", "wave", "blink", "rainbow"] as const;
export const COVER_SIDES = ["start", "end"] as const;
export const VISUALIZER_STYLES = ["bars", "mirror", "wave", "dots", "blocks", "soundcloud"] as const;
export const VISUALIZER_PLACEMENTS = ["replace-progress", "below", "background"] as const;
export const DECORATION_PLACEMENTS = ["before", "after", "background", "free"] as const;
export const DECORATION_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const;
export const DECORATION_FITS = ["contain", "cover", "fill"] as const;
export const DECORATION_SHOW = ["always", "playing", "paused"] as const;
export const IDLE_BEHAVIORS = ["hide", "message", "last"] as const;
export const LINK_TEXTS = ["OPEN SPOTIFY", "PLAY ON SPOTIFY", "LISTEN ON SPOTIFY"] as const;
export const ATTRIBUTION_POSITIONS = ["top-right", "top-left", "bottom-right", "bottom-left", "inline"] as const;
export const ATTRIBUTION_VARIANTS = ["auto", "green", "white", "black"] as const;
export const TIME_FORMATS = ["elapsed-total", "elapsed-remaining"] as const;

export interface Decoration {
  enabled: boolean;
  /** Прямая ссылка https на картинку или GIF. Локальные файлы (C:\\...) браузеру недоступны. */
  url: string;
  placement: (typeof DECORATION_PLACEMENTS)[number];
  anchor: (typeof DECORATION_ANCHORS)[number];
  offsetX: number;
  offsetY: number;
  width: number;
  /** 0 = по пропорциям картинки. */
  height: number;
  fit: (typeof DECORATION_FITS)[number];
  /** 0..100 */
  opacity: number;
  radius: number;
  flip: boolean;
  show: (typeof DECORATION_SHOW)[number];
}

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
    /** Масштаб всего виджета в процентах. */
    scale: number;
    /** Прозрачность всего виджета, 10..100. */
    opacity: number;
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
    /** Межстрочный интервал названия, % от размера. */
    lineHeight: number;
    shadow: boolean;
    italic: boolean;
    artistWeight: number;
    /** Шрифт исполнителя, альбома и времени. */
    secondaryFont: FontId | "same";
    effect: (typeof TEXT_EFFECTS)[number];
    /** Применять эффект и к исполнителю. */
    effectAll: boolean;
    effectColor: string;
    effectColor2: string;
    /** Скорость анимации эффекта, 1..100. */
    effectSpeed: number;
  };
  label: {
    enabled: boolean;
    text: string;
    size: number;
    color: string;
    letterSpacing: number;
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
    /** Плавное перетекание цветов градиента. */
    animated: boolean;
    /** Секунд на цикл. */
    animationSeconds: number;
  };
  border: {
    radius: number;
    width: number;
    color: string;
    style: (typeof BORDER_STYLES)[number];
    effect: (typeof BORDER_EFFECTS)[number];
    /** Скорость эффекта, 1..100. */
    effectSpeed: number;
    /** Размах свечения и волн, px. */
    effectSize: number;
    /** Яркость эффекта, 10..100. */
    effectIntensity: number;
    effectColor: string;
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
    side: (typeof COVER_SIDES)[number];
    /** Картинка для треков без обложки (например, локальных файлов). */
    fallbackUrl: string;
    borderWidth: number;
    borderColor: string;
    /** Как вписать свою картинку в рамку обложки. */
    fallbackFit: (typeof DECORATION_FITS)[number];
    /** Масштаб своей картинки, %. */
    fallbackScale: number;
    /** Сдвиг своей картинки внутри обложки, % от размера. */
    fallbackX: number;
    fallbackY: number;
    /** Фон под своей картинкой, нужен для PNG и GIF с прозрачностью. */
    fallbackBg: string;
    fallbackBgOpacity: number;
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
    idle: (typeof IDLE_EFFECTS)[number];
    /** Амплитуда непрерывной анимации карточки, px. */
    idleAmount: number;
  };
  behavior: {
    whenIdle: (typeof IDLE_BEHAVIORS)[number];
    idleMessage: string;
    hideWhenPaused: boolean;
    pausedBadge: boolean;
    /** Непрозрачность карточки на паузе, 10..100. */
    pausedOpacity: number;
  };
  visualizer: {
    enabled: boolean;
    style: (typeof VISUALIZER_STYLES)[number];
    placement: (typeof VISUALIZER_PLACEMENTS)[number];
    bars: number;
    height: number;
    gap: number;
    radius: number;
    /** 10..100: насколько высоко «прыгают» столбики. */
    amplitude: number;
    /** 10..300, % от обычной скорости. */
    speed: number;
    color: string;
    color2: string;
    gradient: boolean;
    /** Цвет непроигранной части для стиля «волна трека». */
    dimColor: string;
    /** 5..100 */
    opacity: number;
    freezeWhenPaused: boolean;
  };
  decorations: [Decoration, Decoration];
  link: {
    text: (typeof LINK_TEXTS)[number];
    color: string;
    background: string;
  };
  attribution: {
    position: (typeof ATTRIBUTION_POSITIONS)[number];
    variant: (typeof ATTRIBUTION_VARIANTS)[number];
    size: number;
    /** Прозрачность значка Spotify, %. */
    opacity: number;
  };
}

export const DEFAULT_DECORATION: Decoration = {
  enabled: false,
  url: "",
  placement: "after",
  anchor: "bottom-right",
  offsetX: 0,
  offsetY: 0,
  width: 64,
  height: 0,
  fit: "contain",
  opacity: 100,
  radius: 0,
  flip: false,
  show: "always",
};

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
  size: { width: 420, height: 0, padding: 14, gap: 14, scale: 100, opacity: 100 },
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
    lineHeight: 125,
    shadow: false,
    italic: false,
    artistWeight: 500,
    secondaryFont: "same",
    effect: "none",
    effectAll: false,
    effectColor: "#ff3cac",
    effectColor2: "#2b86c5",
    effectSpeed: 40,
  },
  label: { enabled: false, text: "СЕЙЧАС ИГРАЕТ", size: 10, color: "#1db954", letterSpacing: 12 },
  colors: { title: "#ffffff", artist: "#b3b3b3", album: "#8a8a8a", time: "#b3b3b3" },
  background: { type: "solid", color: "#121212", color2: "#1db954", angle: 135, opacity: 88, blur: 0, animated: false, animationSeconds: 12 },
  border: { radius: 16, width: 0, color: "#ffffff", style: "solid", effect: "none", effectColor: "#ff3cac", effectSpeed: 50, effectSize: 18, effectIntensity: 100 },
  shadow: { enabled: true, color: "#000000", blur: 24, offsetY: 8, opacity: 40 },
  cover: { size: 72, radius: 4, shadow: true, side: "start", fallbackUrl: "", borderWidth: 0, borderColor: "#ffffff", fallbackFit: "contain", fallbackScale: 100, fallbackX: 0, fallbackY: 0, fallbackBg: "#ffffff", fallbackBgOpacity: 8 },
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
  animation: { trackChange: "fade", durationMs: 450, marquee: true, marqueeSpeed: 40, idle: "none", idleAmount: 6 },
  behavior: { whenIdle: "message", idleMessage: "Сейчас ничего не играет", hideWhenPaused: false, pausedBadge: true, pausedOpacity: 100 },
  visualizer: {
    enabled: false,
    style: "bars",
    placement: "replace-progress",
    bars: 32,
    height: 36,
    gap: 3,
    radius: 2,
    amplitude: 80,
    speed: 100,
    color: "#1db954",
    color2: "#1ed760",
    gradient: false,
    dimColor: "#4d4d4d",
    opacity: 100,
    freezeWhenPaused: true,
  },
  decorations: [DEFAULT_DECORATION, DEFAULT_DECORATION],
  link: { text: "LISTEN ON SPOTIFY", color: "#000000", background: "#1db954" },
  attribution: { position: "top-right", variant: "auto", size: 21, opacity: 100 },
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

/**
 * Адрес картинки или GIF: только https, без логина и пароля. Это защищает
 * страницу виджета от file://, javascript: и data: адресов.
 */
export function imageUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (raw === "" || raw.length > 600 || /[\s"'<>`\\]/.test(raw)) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function decoration(value: unknown): Decoration {
  const d = DEFAULT_DECORATION;
  const v = obj(value);
  return {
    enabled: bool(v.enabled, d.enabled),
    url: imageUrl(v.url),
    placement: oneOf(v.placement, DECORATION_PLACEMENTS, d.placement),
    anchor: oneOf(v.anchor, DECORATION_ANCHORS, d.anchor),
    offsetX: num(v.offsetX, -400, 400, d.offsetX),
    offsetY: num(v.offsetY, -400, 400, d.offsetY),
    width: num(v.width, 8, 800, d.width),
    height: num(v.height, 0, 800, d.height),
    fit: oneOf(v.fit, DECORATION_FITS, d.fit),
    opacity: num(v.opacity, 0, 100, d.opacity),
    radius: num(v.radius, 0, 400, d.radius),
    flip: bool(v.flip, d.flip),
    show: oneOf(v.show, DECORATION_SHOW, d.show),
  };
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
  const lb = obj(src.label);
  const viz = obj(src.visualizer);
  const decos = Array.isArray(src.decorations) ? src.decorations : [];

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
      scale: num(size.scale, 25, 400, d.size.scale),
      opacity: num(size.opacity, 10, 100, d.size.opacity),
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
      lineHeight: num(t.lineHeight, 90, 200, d.text.lineHeight),
      shadow: bool(t.shadow, d.text.shadow),
      italic: bool(t.italic, d.text.italic),
      artistWeight: num(t.artistWeight, 300, 900, d.text.artistWeight),
      secondaryFont: oneOf(t.secondaryFont, SECONDARY_FONT_IDS, d.text.secondaryFont),
      effect: oneOf(t.effect, TEXT_EFFECTS, d.text.effect),
      effectAll: bool(t.effectAll, d.text.effectAll),
      effectColor: color(t.effectColor, d.text.effectColor),
      effectColor2: color(t.effectColor2, d.text.effectColor2),
      effectSpeed: num(t.effectSpeed, 1, 100, d.text.effectSpeed),
    },
    label: {
      enabled: bool(lb.enabled, d.label.enabled),
      text: text(lb.text, 40, d.label.text),
      size: num(lb.size, 7, 32, d.label.size),
      color: color(lb.color, d.label.color),
      letterSpacing: num(lb.letterSpacing, 0, 40, d.label.letterSpacing),
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
      animated: bool(bg.animated, d.background.animated),
      animationSeconds: num(bg.animationSeconds, 2, 60, d.background.animationSeconds),
    },
    border: {
      radius: num(border.radius, 0, 200, d.border.radius),
      width: num(border.width, 0, 12, d.border.width),
      color: color(border.color, d.border.color),
      style: oneOf(border.style, BORDER_STYLES, d.border.style),
      effect: oneOf(border.effect, BORDER_EFFECTS, d.border.effect),
      effectColor: color(border.effectColor, d.border.effectColor),
      effectSpeed: num(border.effectSpeed, 1, 100, d.border.effectSpeed),
      effectSize: num(border.effectSize, 2, 60, d.border.effectSize),
      effectIntensity: num(border.effectIntensity, 10, 100, d.border.effectIntensity),
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
      side: oneOf(cover.side, COVER_SIDES, d.cover.side),
      fallbackUrl: imageUrl(cover.fallbackUrl),
      borderWidth: num(cover.borderWidth, 0, 8, d.cover.borderWidth),
      borderColor: color(cover.borderColor, d.cover.borderColor),
      fallbackFit: oneOf(cover.fallbackFit, DECORATION_FITS, d.cover.fallbackFit),
      fallbackScale: num(cover.fallbackScale, 10, 400, d.cover.fallbackScale),
      fallbackX: num(cover.fallbackX, -100, 100, d.cover.fallbackX),
      fallbackY: num(cover.fallbackY, -100, 100, d.cover.fallbackY),
      fallbackBg: color(cover.fallbackBg, d.cover.fallbackBg),
      fallbackBgOpacity: num(cover.fallbackBgOpacity, 0, 100, d.cover.fallbackBgOpacity),
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
      idle: oneOf(an.idle, IDLE_EFFECTS, d.animation.idle),
      idleAmount: num(an.idleAmount, 1, 30, d.animation.idleAmount),
    },
    behavior: {
      whenIdle: oneOf(be.whenIdle, IDLE_BEHAVIORS, d.behavior.whenIdle),
      idleMessage: text(be.idleMessage, 80, d.behavior.idleMessage),
      hideWhenPaused: bool(be.hideWhenPaused, d.behavior.hideWhenPaused),
      pausedBadge: bool(be.pausedBadge, d.behavior.pausedBadge),
      pausedOpacity: num(be.pausedOpacity, 10, 100, d.behavior.pausedOpacity),
    },
    visualizer: {
      enabled: bool(viz.enabled, d.visualizer.enabled),
      style: oneOf(viz.style, VISUALIZER_STYLES, d.visualizer.style),
      placement: oneOf(viz.placement, VISUALIZER_PLACEMENTS, d.visualizer.placement),
      bars: num(viz.bars, 4, 128, d.visualizer.bars),
      height: num(viz.height, 8, 300, d.visualizer.height),
      gap: num(viz.gap, 0, 24, d.visualizer.gap),
      radius: num(viz.radius, 0, 24, d.visualizer.radius),
      amplitude: num(viz.amplitude, 10, 100, d.visualizer.amplitude),
      speed: num(viz.speed, 10, 300, d.visualizer.speed),
      color: color(viz.color, d.visualizer.color),
      color2: color(viz.color2, d.visualizer.color2),
      gradient: bool(viz.gradient, d.visualizer.gradient),
      dimColor: color(viz.dimColor, d.visualizer.dimColor),
      opacity: num(viz.opacity, 5, 100, d.visualizer.opacity),
      freezeWhenPaused: bool(viz.freezeWhenPaused, d.visualizer.freezeWhenPaused),
    },
    decorations: [decoration(decos[0]), decoration(decos[1])],
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
      opacity: num(at.opacity, 10, 100, d.attribution.opacity),
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
      current && typeof current === "object" && !Array.isArray(current) && value && typeof value === "object"
        ? { ...(current as Obj), ...(value as Obj) }
        : value;
  }
  return normalizeConfig(merged);
}

export function fontFamily(font: FontId | "same", fallbackFont: FontId = "inter"): string {
  if (font === "same") font = fallbackFont;
  const def = FONTS.find((f) => f.id === font);
  const stack = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  return def && def.family ? `"${def.family}", ${stack}` : stack;
}

export function googleFontUrl(font: FontId | "same"): string | null {
  const def = FONTS.find((f) => f.id === font);
  if (!def || !def.google) return null;
  return `https://fonts.googleapis.com/css2?family=${def.google}&display=swap`;
}

/** Размер Browser Source в OBS с учётом масштаба. */
export function suggestedSourceSize(config: WidgetConfig): { width: number; height: number } {
  const natural = naturalSourceSize(config);
  const k = config.size.scale / 100;
  return { width: Math.round(natural.width * k), height: Math.round(natural.height * k) };
}

/** Размер виджета в масштабе 100%. */
export function naturalSourceSize(config: WidgetConfig): { width: number; height: number } {
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
    (c.label.enabled ? c.label.size * 1.4 : 0) +
    (c.elements.progress && !(c.visualizer.enabled && c.visualizer.placement === "replace-progress")
      ? c.progress.height + 8
      : 0) +
    (c.visualizer.enabled && c.visualizer.placement !== "background" ? c.visualizer.height + 8 : 0) +
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
