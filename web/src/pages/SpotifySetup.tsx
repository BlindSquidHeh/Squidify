import { useEffect, useState } from "react";
import { useDialogs } from "../components/dialog-context";
import { CopyField } from "../components/CopyField";
import {
  disconnectSpotify,
  getSpotifyServerConfig,
  startSpotifyAuth,
  type SpotifyServerConfig,
} from "../lib/api";
import { config } from "../lib/env";
import { useSpotifyConnection } from "../lib/useSpotifyConnection";
import { OAUTH_STATE_KEY } from "../lib/oauth";
import { spotifyRedirectUri } from "../lib/urls";


const CLIENT_ID_KEY = "squidify-last-client-id";

export default function SpotifySetup() {
  const dialogs = useDialogs();
  const { connection, loading, reload } = useSpotifyConnection();
  const [server, setServer] = useState<SpotifyServerConfig | null>(null);
  const [mode, setMode] = useState<"own" | "shared">("own");
  const [clientIdDraft, setClientId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CLIENT_ID_KEY);
    } catch {
      return null;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const redirectUri = spotifyRedirectUri();
  const clientId = clientIdDraft ?? (connection?.mode === "own" ? connection.clientId : "");

  useEffect(() => {
    if (config.demo) return;
    getSpotifyServerConfig()
      .then(setServer)
      .catch((e) => setError(`Не удалось получить настройки сервера: ${(e as Error).message}`));
  }, []);

  if (config.demo) {
    return (
      <div className="card prose">
        <h1>Подключение Spotify</h1>
        <div className="alert warn">
          Сайт работает в демо-режиме без сервера. Подключение Spotify требует Supabase: так токены хранятся на
          сервере в зашифрованном виде и никогда не попадают в браузер или ссылку виджета. Инструкция по настройке
          есть в README репозитория.
        </div>
      </div>
    );
  }

  const redirectAllowed = !server || server.allowedRedirectUris.includes(redirectUri);
  const clientIdValid = /^[0-9a-zA-Z]{32}$/.test(clientId.trim());

  const connect = async () => {
    setError(null);
    setBusy(true);
    try {
      const { authorizeUrl, state } = await startSpotifyAuth({
        mode,
        clientId: mode === "own" ? clientId.trim() : undefined,
        redirectUri,
      });
      // state дополнительно проверяется в браузере: ответ должен вернуться в ту же вкладку.
      sessionStorage.setItem(OAUTH_STATE_KEY, state);
      if (mode === "own") {
        try {
          localStorage.setItem(CLIENT_ID_KEY, clientId.trim());
        } catch {
          // не критично
        }
      }
      window.location.assign(authorizeUrl);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const ok = await dialogs.confirm({
      title: "Отключить Spotify?",
      message: "Токены доступа и кеш воспроизведения будут удалены с сервера, виджеты перестанут показывать музыку.",
      confirmLabel: "Отключить",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await disconnectSpotify();
      reload();
      setMessage(
        "Spotify отключён, токены удалены. Чтобы полностью отозвать доступ, удалите приложение на странице spotify.com/account/apps.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack prose" style={{ gap: 20 }}>
      <h1 style={{ margin: 0 }}>Подключение Spotify</h1>
      <p className="muted" style={{ margin: 0 }}>
        Вход на сайт и подключение Spotify — разные вещи. Squidify получает от Spotify только разрешение{" "}
        <code>user-read-currently-playing</code>: название, исполнителей, обложку и прогресс текущего трека. Управлять
        воспроизведением, читать плейлисты и историю приложение не может.
      </p>

      {message && <div className="alert success">{message}</div>}
      {error && <div className="alert error">{error}</div>}

      {!loading && connection && (
        <div className="card stack">
          <div className="spread">
            <h3 style={{ margin: 0 }}>Текущее подключение</h3>
            {connection.status === "connected" ? (
              <span className="badge ok">● Подключено</span>
            ) : (
              <span className="badge warn">Нужно переподключить</span>
            )}
          </div>
          <table className="table">
            <tbody>
              <tr>
                <th>Аккаунт Spotify</th>
                <td>{connection.displayName ?? "—"}</td>
              </tr>
              <tr>
                <th>Режим</th>
                <td>{connection.mode === "own" ? "Собственный Client ID" : "Общее приложение"}</td>
              </tr>
              {connection.mode === "own" && (
                <tr>
                  <th>Client ID</th>
                  <td>
                    <code>
                      {connection.clientId.slice(0, 6)}…{connection.clientId.slice(-4)}
                    </code>
                  </td>
                </tr>
              )}
              <tr>
                <th>Подключено</th>
                <td>{new Date(connection.connectedAt).toLocaleString("ru-RU")}</td>
              </tr>
              {connection.lastError && (
                <tr>
                  <th>Последняя ошибка</th>
                  <td className="small">{connection.lastError}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="row">
            <button className="btn danger" onClick={disconnect} disabled={busy}>
              Отключить Spotify и удалить токены
            </button>
          </div>
        </div>
      )}

      <div className="card stack">
        <h2 style={{ margin: 0 }}>{connection ? "Переподключить" : "Как подключить"}</h2>

        {server?.sharedClientAvailable && (
          <div className="segmented" role="tablist">
            <button className={mode === "own" ? "active" : ""} onClick={() => setMode("own")}>
              Свой Client ID
            </button>
            <button className={mode === "shared" ? "active" : ""} onClick={() => setMode("shared")}>
              Общее приложение
            </button>
          </div>
        )}

        {mode === "shared" ? (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Владелец этого сайта настроил общее приложение Spotify. Если оно работает в Development Mode, войти
              смогут только пользователи, которых владелец вручную добавил в User Management (не больше 5).
            </p>
          </div>
        ) : (
          <>
            <div className="alert info small">
              Сейчас Spotify разрешает приложениям в Development Mode не больше 5 пользователей, а владелец
              приложения должен иметь Spotify Premium. Поэтому каждый пользователь Squidify создаёт собственное
              бесплатное приложение в Spotify for Developers и подключает его по Client ID. Client Secret не нужен —
              используется Authorization Code Flow с PKCE.
            </div>
            <ol className="steps">
              <li>
                Откройте{" "}
                <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">
                  Spotify for Developers → Dashboard
                </a>{" "}
                и войдите под своим аккаунтом Spotify.
              </li>
              <li>
                Нажмите <b>Create app</b>. Название и описание любые, например «Мой виджет Squidify». В поле{" "}
                <b>Redirect URIs</b> добавьте адрес ниже, в поле <b>Which API/SDKs are you planning to use?</b>{" "}
                отметьте <b>Web API</b>, примите условия и сохраните.
                <div style={{ marginTop: 10 }}>
                  <CopyField label="Redirect URI" value={redirectUri} />
                </div>
                {!redirectAllowed && (
                  <div className="alert warn small" style={{ marginTop: 10 }}>
                    Этот адрес не указан в серверной настройке <code>ALLOWED_REDIRECT_URIS</code>. Подключение будет
                    отклонено, пока администратор сайта его не добавит.
                  </div>
                )}
              </li>
              <li>
                В настройках приложения откройте <b>User Management</b> и добавьте свой аккаунт Spotify (имя и email,
                на который зарегистрирован Spotify). В Development Mode без этого Spotify может вернуть ошибку 403.
              </li>
              <li>
                Скопируйте <b>Client ID</b> со страницы приложения (Settings → Basic Information) и вставьте сюда.
                Client Secret вводить не нужно и нельзя никому передавать.
                <label className="field" style={{ marginTop: 10 }}>
                  <span>Client ID</span>
                  <input
                    className="input"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="32 символа, например 1a2b3c4d…"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </label>
                {clientId && !clientIdValid && (
                  <div className="small" style={{ color: "var(--danger)", marginTop: 6 }}>
                    Client ID состоит из 32 латинских букв и цифр.
                  </div>
                )}
              </li>
              <li>Нажмите кнопку ниже и разрешите доступ на странице Spotify.</li>
            </ol>
          </>
        )}

        <div className="row">
          <button
            className="btn primary"
            onClick={connect}
            disabled={busy || !redirectAllowed || (mode === "own" && !clientIdValid)}
          >
            {busy ? "Переходим в Spotify…" : connection ? "Переподключить Spotify" : "Подключить Spotify"}
          </button>
        </div>
      </div>
    </div>
  );
}
