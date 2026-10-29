// Публичная страница виджета для OBS Browser Source и окна Windows.
// Адрес: <сайт>/w/#<токен>. Токен находится во фрагменте URL и не
// отправляется на сервер GitHub Pages; на сервер Supabase он уходит
// в заголовке X-Widget-Token.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { decodeDemoConfig } from "../lib/demoLink";
import { naturalSourceSize } from "../widget/config";
import { useDemoFeed } from "../widget/useDemoFeed";
import { useWidgetFeed } from "../widget/useWidgetFeed";
import { WidgetView } from "../widget/WidgetView";
import "../widget/widget-page.css";

function parseHash(): { token: string | null; demo: string | null } {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("demo=")) return { token: null, demo: hash.slice(5) };
  const token = hash.trim().toLowerCase();
  return { token: /^[0-9a-f]{64}$/.test(token) ? token : null, demo: null };
}

export default function WidgetPage() {
  const { token, demo } = useMemo(() => parseHash(), []);
  const demoConfig = useMemo(() => (demo ? decodeDemoConfig(demo) : null), [demo]);
  const live = useWidgetFeed(token, !demoConfig);
  const demoFeed = useDemoFeed(Boolean(demoConfig));

  const config = demoConfig ?? live.config;
  const playback = demoConfig ? demoFeed.playback : live.playback;
  const receivedAt = demoConfig ? demoFeed.receivedAt : live.receivedAt;

  useEffect(() => {
    document.title = "Squidify Widget";
  }, []);

  // Токен читается один раз. Окно Windows при смене ссылки меняет только #фрагмент,
  // страница при этом не перезагружается и показывала бы старый виджет.
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener("hashchange", reload);
    return () => window.removeEventListener("hashchange", reload);
  }, []);

  const embedded = window.parent !== window;
  const userScale = config ? config.size.scale / 100 : 1;

  // Настоящий размер виджета без масштаба: высота может зависеть от содержимого.
  const hasConfig = Boolean(config);
  const frameRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      setNatural((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasConfig]);

  // В окне Windows виджет масштабируется под размер окна, а не обрезается.
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    if (!embedded) return;
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [embedded]);

  // Сообщаем окну Windows-приложения (оно встраивает страницу в iframe) размер виджета с учётом масштаба.
  useEffect(() => {
    if (!embedded || !natural) return;
    window.parent.postMessage(
      {
        type: "squidify:size",
        width: Math.ceil(natural.width * userScale),
        height: Math.ceil(natural.height * userScale),
      },
      "*",
    );
  }, [embedded, natural, userScale]);

  if (!token && !demoConfig) {
    return <div className="wp-error">Неверная ссылка виджета. Скопируйте её заново на сайте Squidify.</div>;
  }
  if (live.invalid && !demoConfig) {
    return <div className="wp-error">Ссылка виджета недействительна: её пересоздали или виджет удалён.</div>;
  }
  if (!config) {
    return live.error ? <div className="wp-error wp-faint">Нет связи с сервером…</div> : null;
  }

  const naturalSize = naturalSourceSize(config);
  const pad = Math.round((naturalSize.width - config.size.width) / 2);
  const fit =
    embedded && natural && natural.width > 0 && natural.height > 0
      ? Math.min(viewport.width / natural.width, viewport.height / natural.height)
      : userScale;
  return (
    <div
      className="wp-outer"
      style={natural ? { width: Math.ceil(natural.width * fit), height: Math.ceil(natural.height * fit) } : undefined}
    >
      <div
        ref={frameRef}
        className="wp-frame"
        style={{ padding: pad, transform: `scale(${fit})`, transformOrigin: "0 0" }}
      >
        <WidgetView config={config} playback={playback} receivedAt={receivedAt} lastItem={live.lastItem} />
      </div>
    </div>
  );
}
