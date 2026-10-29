export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Цвет #rgb/#rrggbb/#rrggbbaa + прозрачность 0..100 → rgba(). */
export function hexToRgba(hex: string, opacityPercent = 100): string {
  const { r, g, b, a } = parseHex(hex);
  const alpha = Math.round(a * (opacityPercent / 100) * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function parseHex(hex: string): { r: number; g: number; b: number; a: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const a = h.length === 8 ? (parseInt(h.slice(6, 8), 16) || 0) / 255 : 1;
  return { r, g, b, a };
}

/** Относительная яркость по WCAG, 0..1. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function artistNames(artists: { name: string }[]): string {
  return artists.map((a) => a.name).join(", ");
}
