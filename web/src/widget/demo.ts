import type { FeedPlayback } from "../lib/feed";

// Демонстрационные треки для предпросмотра, когда Spotify ещё не подключён.
// Обложки нарисованы здесь же (SVG), это не данные Spotify.

function demoCover(c1: string, c2: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="300" height="300" fill="url(#g)"/>
<circle cx="150" cy="150" r="88" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="10"/>
<circle cx="150" cy="150" r="18" fill="rgba(255,255,255,0.8)"/>
<text x="150" y="276" font-family="sans-serif" font-size="22" font-weight="700" fill="rgba(255,255,255,0.85)" text-anchor="middle">${label}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const DEMO_TRACKS = [
  {
    id: "demo-1",
    title: "Ночной город (демо-трек с очень длинным названием)",
    artists: [{ name: "Демо-исполнитель", url: null }, { name: "Гость", url: null }],
    album: "Демонстрационный альбом",
    durationMs: 214_000,
    coverUrl: demoCover("#1db954", "#0b3d20", "DEMO"),
  },
  {
    id: "demo-2",
    title: "Рассвет",
    artists: [{ name: "Squidify", url: null }],
    album: "Пример",
    durationMs: 187_000,
    coverUrl: demoCover("#ff3cac", "#2b86c5", "DEMO"),
  },
];

/** Состояние демо-воспроизведения: треки сменяются по кругу в реальном времени. */
export function demoPlayback(now = Date.now(), speed = 1): FeedPlayback {
  const total = DEMO_TRACKS.reduce((sum, t) => sum + t.durationMs, 0);
  let offset = Math.floor((now * speed) % total);
  for (const track of DEMO_TRACKS) {
    if (offset < track.durationMs) {
      return {
        status: "active",
        isPlaying: true,
        progressMs: offset,
        ageMs: 0,
        item: {
          type: "track",
          id: track.id,
          title: track.title,
          artists: track.artists,
          album: track.album,
          albumUrl: null,
          coverUrl: track.coverUrl,
          durationMs: track.durationMs,
          url: null,
        },
      };
    }
    offset -= track.durationMs;
  }
  return { status: "idle", isPlaying: false, progressMs: 0, ageMs: 0, item: null };
}
