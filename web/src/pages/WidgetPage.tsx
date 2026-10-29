// Публичная страница виджета для OBS Browser Source и окна Windows.
// Адрес: <сайт>/w/#<токен>. Токен находится во фрагменте URL и не
// отправляется на сервер GitHub Pages; на сервер Supabase он уходит
// в заголовке X-Widget-Token.

import { useEffect, useMemo } from "react";
import { decodeDemoConfig } from "../lib/demoLink";
import { suggestedSourceSize } from "../widget/config";
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

  // Сообщаем размер виджета окну Windows-приложения (оно встраивает страницу в iframe).
  useEffect(() => {
    if (!config || window.parent === window) return;
    const size = suggestedSourceSize(config);
    window.parent.postMessage({ type: "squidify:size", width: size.width, height: size.height }, "*");
  }, [config]);

  if (!token && !demoConfig) {
    return <div className="wp-error">Неверная ссылка виджета. Скопируйте её заново на сайте Squidify.</div>;
  }
  if (live.invalid && !demoConfig) {
    return <div className="wp-error">Ссылка виджета недействительна: её пересоздали или виджет удалён.</div>;
  }
  if (!config) {
    return live.error ? <div className="wp-error wp-faint">Нет связи с сервером…</div> : null;
  }

  const pad = Math.round((suggestedSourceSize(config).width - config.size.width) / 2);
  return (
    <div className="wp-frame" style={{ padding: pad }}>
      <WidgetView config={config} playback={playback} receivedAt={receivedAt} lastItem={live.lastItem} />
    </div>
  );
}
