import { Link } from "react-router-dom";

export function DemoAuthNotice() {
  return (
    <div className="card auth-card">
      <h2>Демо-режим</h2>
      <p className="muted">
        Сервер Supabase не настроен, поэтому регистрация и вход отключены. Вы можете попробовать редактор и
        демонстрационный виджет прямо сейчас.
      </p>
      <Link className="btn primary" to="/app">
        Открыть редактор
      </Link>
    </div>
  );
}
