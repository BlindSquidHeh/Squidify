import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { config } from "../lib/env";
import { getSupabase } from "../lib/supabase";
import { DemoAuthNotice } from "./DemoAuthNotice";

export default function ResetPassword() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (config.demo) return <DemoAuthNotice />;
  if (loading) return <div className="boot">Проверяем ссылку…</div>;
  if (!session) {
    return (
      <div className="card auth-card">
        <h2>Ссылка недействительна</h2>
        <p className="muted">Ссылка для смены пароля устарела или уже использована. Запросите новую.</p>
        <Link to="/forgot-password" className="btn primary">
          Запросить ссылку
        </Link>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Пароль должен быть не короче 8 символов");
    if (password !== password2) return setError("Пароли не совпадают");
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) setError(authErrorMessage(error));
    else navigate("/app", { replace: true });
  };

  return (
    <div className="card auth-card">
      <h2>Новый пароль</h2>
      <form onSubmit={submit}>
        <label className="field">
          <span>Новый пароль</span>
          <input className="input" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          <span>Повторите пароль</span>
          <input className="input" type="password" autoComplete="new-password" required value={password2} onChange={(e) => setPassword2(e.target.value)} />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Сохраняем…" : "Сохранить пароль"}
        </button>
      </form>
    </div>
  );
}
