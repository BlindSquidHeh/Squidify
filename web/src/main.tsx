import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";

const root = createRoot(document.getElementById("root")!);
const base = import.meta.env.BASE_URL;
const path = window.location.pathname;

// Страница виджета загружается отдельно: без роутера, авторизации и стилей сайта,
// чтобы в OBS открывался минимальный код на прозрачном фоне.
const isWidget = path === `${base}w` || path.startsWith(`${base}w/`);

if (isWidget) {
  document.documentElement.classList.add("widget-page");
  const WidgetPage = lazy(() => import("./pages/WidgetPage"));
  root.render(
    <StrictMode>
      <Suspense fallback={null}>
        <WidgetPage />
      </Suspense>
    </StrictMode>,
  );
} else {
  const App = lazy(() => import("./App"));
  root.render(
    <StrictMode>
      <Suspense fallback={<div className="boot">Загрузка…</div>}>
        <App />
      </Suspense>
    </StrictMode>,
  );
}
