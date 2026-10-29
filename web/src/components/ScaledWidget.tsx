import type { FeedPlayback } from "../lib/feed";
import { suggestedSourceSize, type WidgetConfig } from "../widget/config";
import { WidgetView } from "../widget/WidgetView";

/** Уменьшенная копия виджета для карточек и лендинга. */
export function ScaledWidget({
  config,
  playback,
  receivedAt,
  maxWidth,
  maxHeight,
}: {
  config: WidgetConfig;
  playback: FeedPlayback;
  receivedAt: number;
  maxWidth: number;
  maxHeight: number;
}) {
  const size = suggestedSourceSize(config);
  const scale = Math.min(1, maxWidth / size.width, maxHeight / size.height);
  return (
    <div style={{ width: size.width * scale, height: size.height * scale, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center",
        }}
      >
        <WidgetView config={config} playback={playback} receivedAt={receivedAt} preview />
      </div>
    </div>
  );
}
