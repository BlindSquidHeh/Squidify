import { useEffect, useState } from "react";
import type { FeedPlayback } from "../lib/feed";

/**
 * Плавно продолжает прогресс между запросами к серверу: сервер отдаёт
 * progressMs и возраст кеша, а время до следующего опроса досчитывается локально.
 */
export function currentProgress(playback: FeedPlayback | null, receivedAt: number, now: number): number {
  if (!playback || !playback.item) return 0;
  let progress = playback.progressMs;
  if (playback.isPlaying) progress += playback.ageMs + Math.max(0, now - receivedAt);
  const duration = playback.item.durationMs;
  return duration > 0 ? Math.min(progress, duration) : progress;
}

export function usePlaybackClock(playback: FeedPlayback | null, receivedAt: number): number {
  const [now, setNow] = useState(() => Date.now());
  const ticking = Boolean(playback?.isPlaying && playback.item);

  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [ticking]);

  return currentProgress(playback, receivedAt, ticking ? now : receivedAt);
}
