import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { authErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { config } from "../lib/env";
import { getSupabase } from "../lib/supabase";
import { DemoAuthNotice } from "./DemoAuthNotice";

function safeNext(value: string | null): string {
  // Разрешаем только внутренние пути, чтобы ссылку нельзя было использовать для редиректа на чужой сайт.
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export default function Login() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));

  if (config.demo) return <DemoAuthNotice />;
  if (user) return <Navigate to={next} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(authErrorMessage(error));
    else navigate(next, { replace: true });
  };

  return (
    <div className="card auth-card">
      <h2>Вход</h2>
      <form onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? "Входим…" : "Войти"}
        </button>
        <div className="spread small">
          <Link to="/forgot-password">Забыли пароль?</Link>
          <Link to="/register">Создать аккаунт</Link>
        </div>
      </form>
    </div>
  );
}
