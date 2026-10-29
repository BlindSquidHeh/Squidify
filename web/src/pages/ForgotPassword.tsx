import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { authErrorMessage } from "../lib/api";
import { config } from "../lib/env";
import { getSupabase } from "../lib/supabase";
import { siteUrl } from "../lib/urls";
import { DemoAuthNotice } from "./DemoAuthNotice";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (config.demo) return <DemoAuthNotice />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: siteUrl("reset-password/"),
    });
    setBusy(false);
    if (error) setError(authErrorMessage(error));
    else setSent(true);
  };

  return (
    <div className="card auth-card">
      <h2>Восстановление доступа</h2>
      {sent ? (
        <div className="alert success">
          Если аккаунт с адресом {email} существует, мы отправили на него ссылку для смены пароля.
        </div>
      ) : (
        <form onSubmit={submit}>
          <p className="muted small">Укажите email аккаунта, и мы пришлём ссылку для установки нового пароля.</p>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="btn primary" disabled={busy}>
            {busy ? "Отправляем…" : "Отправить ссылку"}
          </button>
        </form>
      )}
      <p className="small" style={{ marginTop: 16 }}>
        <Link to="/login">Вернуться ко входу</Link>
      </p>
    </div>
  );
}
