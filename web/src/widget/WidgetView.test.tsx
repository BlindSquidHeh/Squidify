import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FeedPlayback } from "../lib/feed";
import { normalizeConfig } from "./config";
import { WidgetView } from "./WidgetView";

const playing: FeedPlayback = {
  status: "active",
  isPlaying: true,
  progressMs: 65_000,
  ageMs: 0,
  item: {
    type: "track",
    id: "track1",
    title: "Тестовый трек",
    artists: [
      { name: "Исполнитель", url: "https://open.spotify.com/artist/1" },
      { name: "Гость", url: null },
    ],
    album: "Альбом",
    albumUrl: "https://open.spotify.com/album/1",
    coverUrl: "https://i.scdn.co/image/abc",
    durationMs: 200_000,
    url: "https://open.spotify.com/track/1",
  },
};

describe("WidgetView", () => {
  it("показывает трек, исполнителей, время и значок Spotify", () => {
    const now = Date.now();
    render(<WidgetView config={normalizeConfig({ elements: { album: true } })} playback={playing} receivedAt={now} />);
    expect(screen.getByText("Тестовый трек")).toBeInTheDocument();
    expect(screen.getByText("Исполнитель, Гость")).toBeInTheDocument();
    expect(screen.getByText("Альбом")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
    expect(screen.getByText("3:20")).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Spotify" }).length).toBeGreaterThan(0);
    const link = screen.getByText("Тестовый трек").closest("a");
    expect(link).toHaveAttribute("href", "https://open.spotify.com/track/1");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("скрывается, когда ничего не играет и выбран режим «скрыть»", () => {
    const { container } = render(
      <WidgetView
        config={normalizeConfig({ behavior: { whenIdle: "hide" } })}
        playback={{ status: "idle", isPlaying: false, progressMs: 0, ageMs: 0, item: null }}
        receivedAt={Date.now()}
      />,
    );
    expect(container.querySelector(".sw-root")).toHaveClass("sw-hidden");
  });

  it("показывает сообщение, если Spotify не подключён", () => {
    render(
      <WidgetView
        config={normalizeConfig({})}
        playback={{ status: "not_connected", isPlaying: false, progressMs: 0, ageMs: 0, item: null }}
        receivedAt={Date.now()}
      />,
    );
    expect(screen.getByText(/Spotify не подключён/)).toBeInTheDocument();
  });

  it("оставляет последний трек в режиме «last»", () => {
    render(
      <WidgetView
        config={normalizeConfig({ behavior: { whenIdle: "last" } })}
        playback={{ status: "idle", isPlaying: false, progressMs: 0, ageMs: 0, item: null }}
        lastItem={playing.item}
        receivedAt={Date.now()}
      />,
    );
    expect(screen.getByText("Тестовый трек")).toBeInTheDocument();
  });

  it("показывает оставшееся время в формате elapsed-remaining", () => {
    render(
      <WidgetView
        config={normalizeConfig({ progress: { timeFormat: "elapsed-remaining" } })}
        playback={{ ...playing, isPlaying: false }}
        receivedAt={Date.now()}
      />,
    );
    expect(screen.getByText("−2:15")).toBeInTheDocument();
    expect(screen.getByText("Пауза")).toBeInTheDocument();
  });

  it("показывает визуализатор вместо полосы прогресса", () => {
    const { container } = render(
      <WidgetView
        config={normalizeConfig({ visualizer: { enabled: true, placement: "replace-progress" } })}
        playback={playing}
        receivedAt={Date.now()}
      />,
    );
    expect(container.querySelector("canvas.sw-visualizer")).not.toBeNull();
    expect(container.querySelector(".sw-progress")).toBeNull();
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("по умолчанию визуализатора и картинок нет", () => {
    const { container } = render(<WidgetView config={normalizeConfig({})} playback={playing} receivedAt={Date.now()} />);
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".sw-deco")).toBeNull();
  });

  it("выводит картинку/GIF только по https и скрывает её на паузе при show=playing", () => {
    const cfg = normalizeConfig({
      decorations: [
        { enabled: true, url: "https://example.com/dance.gif", show: "playing", placement: "after" },
        { enabled: true, url: "file:///C:/sound.gif" },
      ],
    });
    const { container, rerender } = render(<WidgetView config={cfg} playback={playing} receivedAt={Date.now()} />);
    const imgs = container.querySelectorAll("img.sw-deco");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]).toHaveAttribute("src", "https://example.com/dance.gif");
    rerender(
      <WidgetView config={cfg} playback={{ ...playing, isPlaying: false }} receivedAt={Date.now()} />,
    );
    expect(container.querySelector("img.sw-deco")).toBeNull();
  });

  it("показывает свою подпись и включает эффект текста классом", () => {
    const { container } = render(
      <WidgetView
        config={normalizeConfig({ label: { enabled: true, text: "NOW PLAYING" }, text: { effect: "neon" } })}
        playback={playing}
        receivedAt={Date.now()}
      />,
    );
    expect(screen.getByText("NOW PLAYING")).toBeInTheDocument();
    expect(container.querySelector(".sw-root")).toHaveClass("sw-fx-neon");
  });
});
