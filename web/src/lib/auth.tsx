import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { config } from "./env";
import { getSupabase } from "./supabase";

interface AuthState {
  loading: boolean;
  session: Session | null;
  user: Pick<User, "id" | "email"> | null;
  /** Пользователь перешёл по ссылке восстановления пароля. */
  recovery: boolean;
  signOut: () => Promise<void>;
}

const DEMO_USER = { id: "demo", email: "demo@local" };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(!config.demo);
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (config.demo) return;
    const supabase = getSupabase();
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: config.demo ? DEMO_USER : session ? { id: session.user.id, email: session.user.email } : null,
      recovery,
      signOut: async () => {
        if (config.demo) return;
        await getSupabase().auth.signOut();
      },
    }),
    [loading, session, recovery],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth вне AuthProvider");
  return ctx;
}
