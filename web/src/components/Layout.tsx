import { useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { config } from "../lib/env";

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const wide = location.pathname.startsWith("/app/editor");

  return (
    <div className="app">
      {config.demo && (
        <div className="demo-banner">
          Демо-режим: Supabase не настроен, данные хранятся только в этом браузере, вместо Spotify показывается
          демонстрационный трек. Как подключить сервер — в README.
        </div>
      )}
      <header className="header">
        <Link to="/" className="brand" onClick={() => setOpen(false)}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          Squidify
        </Link>
        <button className="btn small ghost menu-toggle" onClick={() => setOpen((v) => !v)} aria-label="Меню">
          ☰
        </button>
        <nav className={`nav ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
          {user && <NavLink to="/app" end>Мои виджеты</NavLink>}
          {user && <NavLink to="/app/spotify">Spotify</NavLink>}
          <NavLink to="/obs">OBS</NavLink>
          <NavLink to="/desktop">Windows</NavLink>
          <NavLink to="/privacy">Конфиденциальность</NavLink>
        </nav>
        <div className={`header-right ${open ? "open" : ""}`}>
          {user ? (
            <>
              {!config.demo && (
                <NavLink to="/app/account" className="btn small ghost" onClick={() => setOpen(false)}>
                  {user.email}
                </NavLink>
              )}
              {!config.demo && (
                <button
                  className="btn small"
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                    navigate("/");
                  }}
                >
                  Выйти
                </button>
              )}
            </>
          ) : (
            <>
              <Link to="/login" className="btn small ghost" onClick={() => setOpen(false)}>
                Войти
              </Link>
              <Link to="/register" className="btn small primary" onClick={() => setOpen(false)}>
                Регистрация
              </Link>
            </>
          )}
        </div>
      </header>
      <main className={`main ${wide ? "wide" : ""}`}>{children}</main>
      <footer className="footer">
        <span>
          Squidify — независимый проект с открытым исходным кодом. Не связан со Spotify AB, не одобрен и не
          поддерживается Spotify. Spotify — товарный знак Spotify AB.
        </span>
        <span>
          <Link to="/privacy">Политика конфиденциальности</Link>
        </span>
      </footer>
    </div>
  );
}
