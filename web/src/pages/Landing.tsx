import { Link } from "react-router-dom";
import { ScaledWidget } from "../components/ScaledWidget";
import { useAuth } from "../lib/auth";
import { BUILT_IN_PRESETS } from "../widget/presets";
import { useDemoFeed } from "../widget/useDemoFeed";

const FEATURES = [
  ["🎨", "Полный контроль над дизайном", "Шесть макетов, шрифты, цвета, градиенты, прозрачность, тени, анимации и прокрутка длинных названий."],
  ["⚡", "Предпросмотр в реальном времени", "Все изменения сразу видны в редакторе и автоматически применяются к уже добавленной в OBS ссылке."],
  ["🎥", "Готово для OBS", "Прозрачная страница без лишних элементов. Скопируйте ссылку в Browser Source — и всё."],
  ["🪟", "Окно поверх всех окон", "Приложение для Windows показывает тот же виджет в прозрачном окне, которое можно двигать мышью."],
  ["🔒", "Безопасно", "Токены Spotify хранятся на сервере в зашифрованном виде и никогда не попадают в ссылку виджета."],
  ["💸", "Бесплатно и открыто", "Исходный код открыт. Разверните свою копию на GitHub Pages и Supabase бесплатно."],
];

export default function Landing() {
  const { user } = useAuth();
  const demo = useDemoFeed();
  const presets = [BUILT_IN_PRESETS[0], BUILT_IN_PRESETS[2], BUILT_IN_PRESETS[4]];

  return (
    <div className="stack" style={{ gap: 48 }}>
      <section className="hero">
        <div>
          <span className="badge ok">Бесплатно · Открытый код</span>
          <h1 style={{ marginTop: 16 }}>Свой виджет Spotify для стрима и рабочего стола</h1>
          <p className="lead">
            Покажите зрителям, что сейчас играет: обложка, трек, исполнитель и прогресс. Настройте внешний вид в
            визуальном редакторе без кода и вставьте ссылку в OBS Studio.
          </p>
          <div className="row">
            <Link to={user ? "/app" : "/register"} className="btn primary">
              {user ? "Мои виджеты" : "Создать виджет"}
            </Link>
            <Link to="/obs" className="btn">
              Как добавить в OBS
            </Link>
          </div>
        </div>
        <div className="hero-preview">
          <div className="stack" style={{ alignItems: "center", gap: 18 }}>
            {presets.map((p) => (
              <ScaledWidget
                key={p.id}
                config={p.config}
                playback={demo.playback}
                receivedAt={demo.receivedAt}
                maxWidth={440}
                maxHeight={140}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid three">
        {FEATURES.map(([icon, title, text]) => (
          <div key={title} className="card feature">
            <h3>
              <span aria-hidden>{icon}</span> {title}
            </h3>
            <p className="muted" style={{ margin: 0 }}>
              {text}
            </p>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Как это работает</h2>
        <ol className="steps">
          <li>Зарегистрируйтесь на сайте — у каждого пользователя свои виджеты и настройки.</li>
          <li>
            Подключите Spotify через собственное приложение Spotify for Developers (это бесплатно, займёт пару минут).
          </li>
          <li>Настройте дизайн в редакторе или выберите готовый пресет.</li>
          <li>Скопируйте ссылку в OBS Browser Source или откройте виджет в окне Windows.</li>
        </ol>
      </section>
    </div>
  );
}
