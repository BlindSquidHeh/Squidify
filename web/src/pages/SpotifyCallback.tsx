import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { completeSpotifyAuth } from "../lib/api";
import { OAUTH_STATE_KEY } from "../lib/oauth";

type Parsed = { code: string; state: string; error: null } | { code: null; state: null; error: string };

/** Читает ответ Spotify из адреса. Не меняет состояние, поэтому безопасна для повторного вызова. */
function readCallback(): Parsed {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const spotifyError = params.get("error");
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);

  if (spotifyError) {
    return {
      code: null,
      state: null,
      error:
        spotifyError === "access_denied"
          ? "Вы отменили доступ на странице Spotify."
          : `Spotify вернул ошибку: ${spotifyError}`,
    };
  }
  if (!code || !state) return { code: null, state: null, error: "В ответе Spotify нет кода авторизации." };
  if (!expectedState || expectedState !== state) {
    return {
      code: null,
      state: null,
      error: "Проверка state не пройдена. Начните подключение заново из этой же вкладки браузера.",
    };
  }
  return { code, state, error: null };
}

/** Redirect URI для Spotify: <сайт>/callback/spotify/?code=…&state=… */
export default function SpotifyCallback() {
  const navigate = useNavigate();
  const [parsed] = useState(readCallback);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    // Убираем code из адресной строки и истории браузера.
    window.history.replaceState(null, "", window.location.pathname);
    if (parsed.error !== null) return;

    completeSpotifyAuth(parsed.code, parsed.state)
      .then(() => navigate("/app?spotify=connected", { replace: true }))
      .catch((e) => setError((e as Error).message));
  }, [navigate, parsed]);

  const shown = parsed.error ?? error;

  return (
    <div className="card auth-card">
      {shown ? (
        <>
          <h2>Не удалось подключить Spotify</h2>
          <div className="alert error">{shown}</div>
          <p className="muted small" style={{ marginTop: 12 }}>
            Проверьте, что Redirect URI в Spotify Dashboard точно совпадает с адресом на странице подключения, а ваш
            аккаунт добавлен в User Management приложения.
          </p>
          <Link to="/app/spotify" className="btn primary">
            Попробовать снова
          </Link>
        </>
      ) : (
        <>
          <h2>Подключаем Spotify…</h2>
          <p className="muted">Проверяем ответ Spotify и сохраняем доступ.</p>
        </>
      )}
    </div>
  );
}
