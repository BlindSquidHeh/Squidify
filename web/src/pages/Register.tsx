import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { authErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { config } from "../lib/env";
import { getSupabase } from "../lib/supabase";
import { siteUrl } from "../lib/urls";
import { DemoAuthNotice } from "./DemoAuthNotice";

export default function Register() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (config.demo) return <DemoAuthNotice />;
  if (user) return <Navigate to="/app" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Пароль должен быть не короче 8 символов");
    if (password !== password2) return setError("Пароли не совпадают");
    setBusy(true);
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: siteUrl("app/") },
    });
    setBusy(false);
    if (error) return setError(authErrorMessage(error));
    // Если подтверждение email отключено, Supabase сразу возвращает сессию.
    if (!data.session) setDone(true);
  };

  if (done) {
    return (
      <div className="card auth-card">
        <h2>Проверьте почту</h2>
        <p className="muted">
          Мы отправили письмо на <b>{email}</b>. Перейдите по ссылке из письма, чтобы подтвердить адрес и войти.
        </p>
        <Link to="/login" className="btn">
          Ко входу
        </Link>
      </div>
    );
  }

  return (
    <div className="card auth-card">
      <h2>Регистрация</h2>
      <form onSubmit={submit}>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Пароль (минимум 8 символов)</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Повторите пароль</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            required
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />
        </label>
        <label className="toggle">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
          <span>
            Я прочитал(а) <Link to="/privacy">политику конфиденциальности</Link>
          </span>
        </label>
        {error && <div className="alert error">{error}</div>}
        <button className="btn primary" disabled={busy || !agree}>
          {busy ? "Создаём аккаунт…" : "Зарегистрироваться"}
        </button>
        <div className="small muted">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </div>
      </form>
    </div>
  );
}
