import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { AuthProvider } from "./lib/auth";
import "./styles.css";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SpotifySetup = lazy(() => import("./pages/SpotifySetup"));
const SpotifyCallback = lazy(() => import("./pages/SpotifyCallback"));
const Editor = lazy(() => import("./editor/EditorPage"));
const Account = lazy(() => import("./pages/Account"));
const ObsGuide = lazy(() => import("./pages/ObsGuide"));
const DesktopGuide = lazy(() => import("./pages/DesktopGuide"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));

// BASE_URL = "/<repo>/" на GitHub Pages; роутеру нужен путь без завершающего слэша.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <Layout>
          <Suspense fallback={<div className="boot">Загрузка…</div>}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/obs" element={<ObsGuide />} />
              <Route path="/desktop" element={<DesktopGuide />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route element={<RequireAuth />}>
                <Route path="/app" element={<Dashboard />} />
                <Route path="/app/spotify" element={<SpotifySetup />} />
                <Route path="/app/editor" element={<Editor />} />
                <Route path="/app/account" element={<Account />} />
                <Route path="/callback/spotify" element={<SpotifyCallback />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
