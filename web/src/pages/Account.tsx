import { useState, type FormEvent } from "react";
import { useDialogs } from "../components/dialog-context";
import { useNavigate } from "react-router-dom";
import { authErrorMessage, deleteAccount } from "../lib/api";
import { useAuth } from "../lib/auth";
import { config } from "../lib/env";
import { getSupabase } from "../lib/supabase";

export default function Account() {
  const dialogs = useDialogs();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (config.demo) {
    return (
      <div className="card prose">
        <h1>Аккаунт</h1>
        <p className="muted">В демо-режиме аккаунтов нет. Данные демо хранятся в localStorage этого браузера.</p>
        <button
          className="btn danger"
          onClick={async () => {
            const ok = await dialogs.confirm({
              title: "Очистить демо-данные?",
              message: "Все демо-виджеты и пресеты в этом браузере будут удалены.",
              confirmLabel: "Очистить",
              danger: true,
            });
            if (ok) {
              localStorage.removeItem("squidify-demo-v1");
              navigate("/app");
            }
          }}
        >
          Очистить демо-данные
        </button>
      </div>
    );
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setPwMessage({ ok: false, text: "Минимум 8 символов" });
    const { error } = await getSupabase().auth.updateUser({ password });
    setPwMessage(error ? { ok: false, text: authErrorMessage(error) } : { ok: true, text: "Пароль изменён" });
    if (!error) setPassword("");
  };

  const remove = async () => {
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (e) {
      setDeleteError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="stack prose" style={{ gap: 16 }}>
      <h1 style={{ margin: 0 }}>Аккаунт</h1>
      <div className="card stack">
        <div className="spread">
          <div>
            <div className="label">Email</div>
            <div>{user?.email}</div>
          </div>
          <button
            className="btn"
            onClick={async () => {
              await signOut();
              navigate("/");
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      <form className="card stack" onSubmit={changePassword}>
        <h3 style={{ margin: 0 }}>Сменить пароль</h3>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          placeholder="Новый пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {pwMessage && <div className={`alert ${pwMessage.ok ? "success" : "error"}`}>{pwMessage.text}</div>}
        <button className="btn" style={{ alignSelf: "flex-start" }}>
          Сохранить пароль
        </button>
      </form>

      <div className="card stack" style={{ borderColor: "#4a2028" }}>
        <h3 style={{ margin: 0, color: "var(--danger)" }}>Удалить аккаунт</h3>
        <p className="muted small" style={{ margin: 0 }}>
          Будут безвозвратно удалены аккаунт, все виджеты, пресеты, подключение Spotify и токены доступа. Ссылки на
          виджеты перестанут работать. Чтобы подтвердить, введите <b>УДАЛИТЬ</b>.
        </p>
        <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="УДАЛИТЬ" />
        {deleteError && <div className="alert error">{deleteError}</div>}
        <button
          className="btn danger"
          style={{ alignSelf: "flex-start" }}
          disabled={busy || confirmText.trim().toUpperCase() !== "УДАЛИТЬ"}
          onClick={remove}
        >
          {busy ? "Удаляем…" : "Удалить аккаунт навсегда"}
        </button>
      </div>
    </div>
  );
}
