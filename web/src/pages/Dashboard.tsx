import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CopyField } from "../components/CopyField";
import { ScaledWidget } from "../components/ScaledWidget";
import { createWidget, deleteWidget, listWidgets, regenerateWidgetToken, type WidgetRecord } from "../lib/api";
import { config } from "../lib/env";
import { useSpotifyConnection } from "../lib/useSpotifyConnection";
import { desktopOpenUrl } from "../lib/urls";
import { widgetLink } from "../lib/widgetLink";
import { suggestedSourceSize } from "../widget/config";
import { useDemoFeed } from "../widget/useDemoFeed";

function SpotifyStatus() {
  const { connection, loading } = useSpotifyConnection();
  if (config.demo) {
    return (
      <div className="alert warn">
        Демо-режим: вместо Spotify используется демонстрационный трек. Чтобы показывать реальную музыку, настройте
        Supabase по инструкции из README.
      </div>
    );
  }
  if (loading) return null;
  if (!connection) {
    return (
      <div className="card spread">
        <div>
          <h3>Spotify не подключён</h3>
          <p className="muted small" style={{ margin: 0 }}>
            Виджеты уже можно настраивать на демо-треке, но для показа реальной музыки подключите Spotify.
          </p>
        </div>
        <Link to="/app/spotify" className="btn primary">
          Подключить Spotify
        </Link>
      </div>
    );
  }
  if (connection.status === "reauth_required") {
    return (
      <div className="card spread">
        <div>
          <h3>
            Spotify <span className="badge warn">нужно переподключить</span>
          </h3>
          <p className="muted small" style={{ margin: 0 }}>
            Доступ к Spotify отозван или истёк. Виджеты показывают сообщение вместо трека.
          </p>
        </div>
        <Link to="/app/spotify" className="btn primary">
          Переподключить
        </Link>
      </div>
    );
  }
  return (
    <div className="card spread">
      <div className="row">
        <span className="badge ok">● Spotify подключён</span>
        {connection.displayName && <span className="muted">{connection.displayName}</span>}
      </div>
      <Link to="/app/spotify" className="btn small">
        Управление
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState<WidgetRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const demo = useDemoFeed();

  const load = useCallback(
    () =>
      listWidgets()
        .then(setWidgets)
        .catch((e) => setError((e as Error).message)),
    [],
  );

  useEffect(() => {
    listWidgets()
      .then(setWidgets)
      .catch((e) => setError((e as Error).message));
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const widget = await createWidget(`Виджет ${(widgets?.length ?? 0) + 1}`);
      navigate(`/app/editor?id=${widget.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async (widget: WidgetRecord) => {
    if (!window.confirm(`Удалить «${widget.name}»? Ссылка на виджет перестанет работать.`)) return;
    try {
      await deleteWidget(widget.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const regenerate = async (widget: WidgetRecord) => {
    if (!window.confirm("Создать новую ссылку? Старая ссылка сразу перестанет работать в OBS и приложении.")) return;
    try {
      await regenerateWidgetToken(widget.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="spread">
        <h1 style={{ margin: 0 }}>Мои виджеты</h1>
        <button className="btn primary" onClick={create} disabled={busy}>
          + Новый виджет
        </button>
      </div>
      <SpotifyStatus />
      {error && <div className="alert error">{error}</div>}
      {widgets === null ? (
        <div className="muted">Загрузка…</div>
      ) : widgets.length === 0 ? (
        <div className="card empty">
          <h3>Пока нет ни одного виджета</h3>
          <p>Создайте первый виджет, настройте дизайн и добавьте ссылку в OBS.</p>
          <button className="btn primary" onClick={create} disabled={busy}>
            Создать виджет
          </button>
        </div>
      ) : (
        <div className="grid two">
          {widgets.map((widget) => {
            const link = widgetLink(widget);
            const size = suggestedSourceSize(widget.config);
            return (
              <div key={widget.id} className="card widget-card">
                <div className="spread">
                  <h3 style={{ margin: 0 }}>{widget.name}</h3>
                  <span className="faint small">
                    OBS: {size.width}×{size.height}
                  </span>
                </div>
                <div className="widget-thumb checker">
                  <ScaledWidget
                    config={widget.config}
                    playback={demo.playback}
                    receivedAt={demo.receivedAt}
                    maxWidth={420}
                    maxHeight={150}
                  />
                </div>
                <CopyField label="Ссылка для OBS Browser Source" value={link} secret={!config.demo} />
                <div className="row">
                  <Link className="btn small primary" to={`/app/editor?id=${widget.id}`}>
                    Редактировать
                  </Link>
                  <a className="btn small" href={link} target="_blank" rel="noopener noreferrer">
                    Открыть
                  </a>
                  <a className="btn small" href={desktopOpenUrl(link)} title="Нужно установленное приложение Squidify для Windows">
                    В окне Windows
                  </a>
                  {!config.demo && (
                    <button className="btn small" onClick={() => regenerate(widget)}>
                      Новая ссылка
                    </button>
                  )}
                  <button className="btn small danger" onClick={() => remove(widget)}>
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="muted small">
        Как добавить виджет в OBS — <Link to="/obs">пошаговая инструкция</Link>. Окно поверх игр и программ —{" "}
        <Link to="/desktop">приложение для Windows</Link>.
      </p>
    </div>
  );
}
