import { useEffect, useState } from "react";
import type { FeedPlayback } from "../lib/feed";
import { demoPlayback } from "./demo";

/** Демонстрационное воспроизведение, обновляется раз в секунду. */
export function useDemoFeed(enabled = true): { playback: FeedPlayback; receivedAt: number } {
  const [state, setState] = useState(() => ({ playback: demoPlayback(), receivedAt: Date.now() }));
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setState({ playback: demoPlayback(), receivedAt: Date.now() }), 1000);
    return () => window.clearInterval(id);
  }, [enabled]);
  return state;
}
