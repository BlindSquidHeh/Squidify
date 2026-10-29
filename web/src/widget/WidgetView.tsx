import type { CSSProperties, ReactNode } from "react";
import type { FeedItem, FeedPlayback } from "../lib/feed";
import { fontFamily, type Decoration, type WidgetConfig } from "./config";
import { useGoogleFont } from "./useGoogleFont";
import { artistNames, formatTime, hexToRgba, luminance } from "./format";
import { Marquee } from "./Marquee";
import { SPOTIFY_GREEN, SpotifyIcon } from "./SpotifyIcon";
import { usePlaybackClock } from "./usePlaybackClock";
import { Visualizer } from "./Visualizer";
import "./widget.css";

interface Props {
  config: WidgetConfig;
  playback: FeedPlayback | null;
  /** Время получения playback по локальным часам. */
  receivedAt: number;
  /** Последний показанный трек: для режима «оставить последний трек». */
  lastItem?: FeedItem | null;
  /** В редакторе скрытый виджет показывается полупрозрачным. */
  preview?: boolean;
}

const STATUS_MESSAGES: Partial<Record<FeedPlayback["status"], string>> = {
  not_connected: "Spotify не подключён. Подключите его на сайте.",
  reauth_required: "Доступ к Spotify истёк. Переподключите Spotify на сайте.",
  forbidden: "Spotify отклонил запрос (403). Проверьте User Management и Premium у владельца приложения.",
  ad: "Реклама",
};

function backgroundCss(c: WidgetConfig): string {
  const bg = c.background;
  if (bg.type === "none") return "transparent";
  if (bg.type === "gradient") {
    return `linear-gradient(${bg.angle}deg, ${hexToRgba(bg.color, bg.opacity)}, ${hexToRgba(bg.color2, bg.opacity)})`;
  }
  return hexToRgba(bg.color, bg.opacity);
}

function attributionColor(c: WidgetConfig): string {
  switch (c.attribution.variant) {
    case "green":
      return SPOTIFY_GREEN;
    case "white":
      return "#ffffff";
    case "black":
      return "#000000";
    default: {
      // Зелёный логотип допустим только на чёрном или белом фоне,
      // на остальных используется монохромный.
      const bg = c.background;
      if (bg.type === "none") return c.colors.title;
      const lum = luminance(bg.color);
      if (bg.type === "solid" && bg.opacity >= 90 && (lum < 0.02 || lum > 0.95)) return SPOTIFY_GREEN;
      return lum > 0.4 ? "#000000" : "#ffffff";
    }
  }
}

/** Значок Spotify не должен перекрывать обложку. */
function attributionPosition(c: WidgetConfig, showCover: boolean): WidgetConfig["attribution"]["position"] {
  const pos = c.attribution.position;
  if (pos === "inline" || !showCover) return pos;
  if (c.layout === "vertical" || c.layout === "large-cover") return "inline";
  if (pos === "top-left") return "top-right";
  if (pos === "bottom-left") return "bottom-right";
  return pos;
}

function cssVars(c: WidgetConfig): CSSProperties {
  const shadow = c.shadow.enabled
    ? `0 ${c.shadow.offsetY}px ${c.shadow.blur}px ${hexToRgba(c.shadow.color, c.shadow.opacity)}`
    : "none";
  const fill = c.progress.gradient
    ? `linear-gradient(90deg, ${c.progress.fillColor}, ${c.progress.fillColor2})`
    : c.progress.fillColor;
  return {
    "--sw-width": `${c.size.width}px`,
    "--sw-height": c.size.height > 0 ? `${c.size.height}px` : "auto",
    "--sw-padding": `${c.size.padding}px`,
    "--sw-gap": `${c.size.gap}px`,
    "--sw-font": fontFamily(c.text.font),
    "--sw-font-secondary": fontFamily(c.text.secondaryFont, c.text.font),
    "--sw-title-style": c.text.italic ? "italic" : "normal",
    "--sw-artist-weight": c.text.artistWeight,
    "--sw-fx-color": c.text.effectColor,
    "--sw-fx-color2": c.text.effectColor2,
    "--sw-fx-duration": `${Math.round(4800 / c.text.effectSpeed) / 10}s`,
    "--sw-label-size": `${c.label.size}px`,
    "--sw-label-color": c.label.color,
    "--sw-label-spacing": `${c.label.letterSpacing / 100}em`,
    "--sw-border-style": c.border.style,
    "--sw-border-width": `${c.border.width}px`,
    "--sw-border-fx": c.border.effectColor,
    "--sw-bg-seconds": `${c.background.animationSeconds}s`,
    "--sw-idle-amount": `${c.animation.idleAmount}px`,
    "--sw-paused-opacity": c.behavior.pausedOpacity / 100,
    "--sw-viz-height": `${c.visualizer.height}px`,
    "--sw-title-size": `${c.text.titleSize}px`,
    "--sw-title-weight": c.text.titleWeight,
    "--sw-artist-size": `${c.text.artistSize}px`,
    "--sw-album-size": `${c.text.albumSize}px`,
    "--sw-time-size": `${c.text.timeSize}px`,
    "--sw-letter-spacing": `${c.text.letterSpacing / 10}px`,
    "--sw-text-transform": c.text.uppercase ? "uppercase" : "none",
    "--sw-text-shadow": c.text.shadow ? "0 1px 3px rgba(0,0,0,0.85), 0 0 12px rgba(0,0,0,0.45)" : "none",
    "--sw-title-color": c.colors.title,
    "--sw-artist-color": c.colors.artist,
    "--sw-album-color": c.colors.album,
    "--sw-time-color": c.colors.time,
    "--sw-bg": backgroundCss(c),
    "--sw-backdrop": c.background.blur > 0 ? `blur(${c.background.blur}px)` : "none",
    "--sw-radius": `${c.border.radius}px`,
    "--sw-border":
      c.border.width > 0 && c.border.effect !== "rainbow"
        ? `${c.border.width}px ${c.border.style} ${c.border.color}`
        : "none",
    "--sw-shadow": shadow,
    "--sw-cover-size": `${c.cover.size}px`,
    "--sw-cover-radius": `${c.cover.radius}px`,
    "--sw-cover-shadow": c.cover.shadow ? "0 4px 14px rgba(0,0,0,0.35)" : "none",
    "--sw-progress-height": `${c.progress.height}px`,
    "--sw-progress-radius": `${c.progress.radius}px`,
    "--sw-progress-track": c.progress.trackColor,
    "--sw-progress-fill": fill,
    "--sw-progress-glow": c.progress.fillColor,
    "--sw-anim-duration": `${c.animation.durationMs}ms`,
    "--sw-justify": c.align.horizontal === "start" ? "flex-start" : c.align.horizontal === "end" ? "flex-end" : "center",
    "--sw-text-align": c.align.horizontal === "start" ? "left" : c.align.horizontal === "end" ? "right" : "center",
    "--sw-align-items": c.align.vertical === "start" ? "flex-start" : c.align.vertical === "end" ? "flex-end" : "center",
    "--sw-link-color": c.link.color,
    "--sw-link-bg": c.link.background,
    "--sw-attribution-size": `${c.attribution.size}px`,
  } as CSSProperties;
}

function DecorationImage({ d, order, hidden }: { d: Decoration; order: number; hidden: boolean }) {
  if (!d.enabled || !d.url || hidden) return null;
  const free = d.placement === "free";
  const background = d.placement === "background";
  const flip = d.flip ? "scaleX(-1)" : "";
  const style: CSSProperties = {
    opacity: d.opacity / 100,
    objectFit: d.fit,
    borderRadius: d.radius,
  };
  if (background) {
    style.transform = flip || undefined;
  } else {
    style.width = d.width;
    style.height = d.height > 0 ? d.height : "auto";
    if (free) {
      const x = d.offsetX;
      const y = d.offsetY;
      switch (d.anchor) {
        case "top-left":
          Object.assign(style, { left: x, top: y, transform: flip || undefined });
          break;
        case "top-right":
          Object.assign(style, { right: x, top: y, transform: flip || undefined });
          break;
        case "bottom-left":
          Object.assign(style, { left: x, bottom: y, transform: flip || undefined });
          break;
        case "bottom-right":
          Object.assign(style, { right: x, bottom: y, transform: flip || undefined });
          break;
        default:
          Object.assign(style, {
            left: `calc(50% + ${x}px)`,
            top: `calc(50% + ${y}px)`,
            transform: `translate(-50%, -50%) ${flip}`.trim(),
          });
      }
    } else {
      style.order = order;
      style.transform = flip || undefined;
    }
  }
  return (
    <img
      className={`sw-deco sw-deco-${d.placement}`}
      src={d.url}
      alt=""
      referrerPolicy="no-referrer"
      draggable={false}
      style={style}
      onError={(e) => {
        // Битая ссылка не должна оставлять «сломанную» иконку в кадре.
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

function ProgressBar({ c, progress, duration }: { c: WidgetConfig; progress: number; duration: number }) {
  const ratio = duration > 0 ? Math.min(1, Math.max(0, progress / duration)) : 0;
  return (
    <div
      className={`sw-progress sw-progress-${c.progress.style}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration / 1000)}
      aria-valuenow={Math.round(progress / 1000)}
    >
      <div className="sw-progress-fill" style={{ width: `${ratio * 100}%` }} />
      {c.progress.knob && <div className="sw-progress-knob" style={{ left: `${ratio * 100}%` }} />}
    </div>
  );
}

function Times({ c, progress, duration }: { c: WidgetConfig; progress: number; duration: number }) {
  const right =
    c.progress.timeFormat === "elapsed-remaining" ? `−${formatTime(duration - progress)}` : formatTime(duration);
  if (!c.elements.elapsed && !c.elements.remaining) return null;
  return (
    <div className="sw-times">
      <span>{c.elements.elapsed ? formatTime(progress) : ""}</span>
      <span>{c.elements.remaining ? right : ""}</span>
    </div>
  );
}

export function WidgetView({ config: c, playback, receivedAt, lastItem, preview }: Props) {
  useGoogleFont(c.text.font, c.text.secondaryFont);
  const progress = usePlaybackClock(playback, receivedAt);

  let item: FeedItem | null = playback?.item ?? null;
  let message: string | null = null;
  let hidden = false;

  if (!item) {
    const statusMessage = playback ? STATUS_MESSAGES[playback.status] : undefined;
    if (statusMessage && playback?.status !== "ad") {
      message = statusMessage;
    } else if (c.behavior.whenIdle === "last" && lastItem) {
      item = lastItem;
    } else if (c.behavior.whenIdle === "message" || (playback?.status === "ad" && c.behavior.whenIdle !== "hide")) {
      message = playback?.status === "ad" ? STATUS_MESSAGES.ad! : c.behavior.idleMessage || "Сейчас ничего не играет";
    } else {
      hidden = true;
    }
  }
  const paused = Boolean(item && playback?.item && !playback.isPlaying);
  if (paused && c.behavior.hideWhenPaused) hidden = true;
  if (!playback && !preview) hidden = true;

  const layout = c.layout;
  const showCover = c.elements.cover && layout !== "text" && layout !== "progress";
  const iconColor = attributionColor(c);
  const position = attributionPosition(c, showCover);
  const corner = position !== "inline";
  const attribution = <SpotifyIcon size={c.attribution.size} color={iconColor} />;

  let body: ReactNode;
  if (message && !item) {
    body = (
      <div className="sw-info sw-message">
        <div className="sw-row">
          {!corner && attribution}
          <span className="sw-artist">{message}</span>
        </div>
      </div>
    );
  } else if (item) {
    const duration = item.durationMs;
    const viz = c.visualizer;
    const vizInline = viz.enabled && viz.placement !== "background";
    const replaceProgress = vizInline && viz.placement === "replace-progress";
    const showProgress = c.elements.progress || vizInline;
    const ratio = duration > 0 ? Math.min(1, Math.max(0, progress / duration)) : 0;
    const vizEl = vizInline && (
      <div className="sw-viz" style={{ height: viz.height }}>
        <Visualizer config={viz} playing={Boolean(playback?.isPlaying)} ratio={ratio} seed={item.id || item.title} />
      </div>
    );
    const titleRow = c.elements.title && (
      <div className="sw-row sw-title-row">
        <Marquee
          className="sw-title"
          text={item.title}
          enabled={c.animation.marquee}
          speed={c.animation.marqueeSpeed}
          href={item.url}
        />
        {!corner && attribution}
      </div>
    );
    const artistsRow = c.elements.artists && item.artists.length > 0 && (
      <Marquee
        className="sw-artist"
        text={artistNames(item.artists)}
        enabled={c.animation.marquee}
        speed={c.animation.marqueeSpeed}
        href={item.artists[0]?.url}
      />
    );
    const albumRow = c.elements.album && item.album && (
      <Marquee
        className="sw-album"
        text={item.album}
        enabled={c.animation.marquee}
        speed={c.animation.marqueeSpeed}
        href={item.albumUrl}
      />
    );
    const progressBlock = showProgress && (
      <div className="sw-progress-block">
        {replaceProgress ? vizEl : c.elements.progress && <ProgressBar c={c} progress={progress} duration={duration} />}
        <Times c={c} progress={progress} duration={duration} />
        {!replaceProgress && vizEl}
      </div>
    );
    const labelRow = c.label.enabled && c.label.text && <div className="sw-label">{c.label.text}</div>;
    const link = c.elements.spotifyLink && (
      <a
        className="sw-link"
        href={item.url ?? "https://open.spotify.com/"}
        target="_blank"
        rel="noopener noreferrer"
      >
        <SpotifyIcon size={21} color={c.link.color} />
        <span>{c.link.text}</span>
      </a>
    );

    body = (
      <div
        key={item.id || item.title}
        className={`sw-info sw-anim-${c.animation.trackChange}`}
      >
        {layout === "progress" ? (
          <>
            {labelRow}
            <div className="sw-row sw-progress-head">
              {c.elements.title && (
                <Marquee
                  className="sw-title"
                  text={c.elements.artists ? `${item.title} — ${artistNames(item.artists)}` : item.title}
                  enabled={c.animation.marquee}
                  speed={c.animation.marqueeSpeed}
                  href={item.url}
                />
              )}
              {!corner && attribution}
            </div>
            {progressBlock}
          </>
        ) : (
          <>
            {labelRow}
            {titleRow}
            {artistsRow}
            {albumRow}
            {layout !== "compact" && progressBlock}
            {link}
          </>
        )}
      </div>
    );
  }

  const coverEl =
    showCover && item ? (
      <a
        className="sw-cover"
        href={item.albumUrl ?? item.url ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={item.album ?? item.title}
      >
        {item.coverUrl ? (
          <img src={item.coverUrl} alt={item.album ?? item.title} referrerPolicy="no-referrer" draggable={false} />
        ) : c.cover.fallbackUrl ? (
          <img src={c.cover.fallbackUrl} alt="" referrerPolicy="no-referrer" draggable={false} />
        ) : (
          <div className="sw-cover-empty">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
              <circle cx="17.5" cy="16" r="2.5" fill="currentColor" />
            </svg>
          </div>
        )}
      </a>
    ) : null;

  const compactProgress =
    layout === "compact" && item && (c.elements.progress || (c.visualizer.enabled && c.visualizer.placement !== "background")) ? (
      <div className="sw-compact-progress">
        {c.visualizer.enabled && c.visualizer.placement === "replace-progress" ? (
          <div className="sw-viz" style={{ height: c.visualizer.height }}>
            <Visualizer
              config={c.visualizer}
              playing={Boolean(playback?.isPlaying)}
              ratio={item.durationMs > 0 ? Math.min(1, progress / item.durationMs) : 0}
              seed={item.id || item.title}
            />
          </div>
        ) : (
          c.elements.progress && <ProgressBar c={c} progress={progress} duration={item.durationMs} />
        )}
      </div>
    ) : null;

  const isPlaying = Boolean(playback?.isPlaying && playback.item);
  const decoHidden = (d: Decoration) => (d.show === "playing" ? !isPlaying : d.show === "paused" ? isPlaying : false);
  const decorations = c.decorations.map((d, i) => (
    <DecorationImage key={i} d={d} order={d.placement === "before" ? 0 : 4} hidden={decoHidden(d)} />
  ));
  const backgroundViz =
    c.visualizer.enabled && c.visualizer.placement === "background" && item ? (
      <div className="sw-viz-bg">
        <Visualizer
          config={c.visualizer}
          playing={Boolean(playback?.isPlaying)}
          ratio={item.durationMs > 0 ? Math.min(1, progress / item.durationMs) : 0}
          seed={item.id || item.title}
        />
      </div>
    ) : null;
  const rootClasses = [
    "sw-root",
    `sw-layout-${layout}`,
    hidden ? "sw-hidden" : "",
    preview ? "sw-preview" : "",
    c.text.effect !== "none" ? `sw-fx sw-fx-${c.text.effect}` : "",
    c.text.effect !== "none" && c.text.effectAll ? "sw-fx-all" : "",
    c.border.effect !== "none" && c.border.width > 0 ? `sw-border-${c.border.effect}` : "",
    c.background.animated && c.background.type === "gradient" ? "sw-bg-animated" : "",
    c.animation.idle !== "none" ? `sw-idle-${c.animation.idle}` : "",
    c.cover.side === "end" ? "sw-cover-end" : "",
    paused ? "sw-is-paused" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootClasses}
      style={cssVars(c)}
      data-status={playback?.status ?? "loading"}
    >
      <div className={`sw-card ${corner ? `sw-has-corner sw-corner-${position.endsWith("left") ? "left" : "right"}` : ""}`}>
        {corner && (item || message) && (
          <div className={`sw-attribution sw-attribution-${position}`}>{attribution}</div>
        )}
        {backgroundViz}
        {decorations}
        {coverEl}
        {body}
        {compactProgress}
        {paused && c.behavior.pausedBadge && <div className="sw-paused">Пауза</div>}
      </div>
    </div>
  );
}
