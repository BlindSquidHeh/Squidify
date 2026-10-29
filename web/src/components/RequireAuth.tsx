import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function RequireAuth() {
  const { loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <div className="boot">Загрузка…</div>;
  if (!user) {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
