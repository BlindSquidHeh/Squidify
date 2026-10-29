import { useState } from "react";
import { Link } from "react-router-dom";
import { ScaledWidget } from "../components/ScaledWidget";
import { useAuth } from "../lib/auth";
import { FONTS, LAYOUTS, VISUALIZER_STYLES } from "../widget/config";
import { BUILT_IN_PRESETS } from "../widget/presets";
import { useDemoFeed } from "../widget/useDemoFeed";

export default function Landing() {
  const { user } = useAuth();
  const demo = useDemoFeed();
  const [presetId, setPresetId] = useState(BUILT_IN_PRESETS[0].id);
  const preset = BUILT_IN_PRESETS.find((p) => p.id === presetId) ?? BUILT_IN_PRESETS[0];

  return (
    <div className="landing">
      <section className="hero">
        <div>
          <h1>Виджет «Сейчас играет» для OBS в вашем собственном стиле</h1>
          <p className="lead">
            Подключаете свой Spotify, собираете оформление в редакторе, вставляете одну ссылку в OBS. Менять дизайн
            потом можно, не трогая саму ссылку.
          </p>
          <div className="row">
            <Link to={user ? "/app" : "/register"} className="btn primary">
              {user ? "Мои виджеты" : "Создать виджет"}
            </Link>
            <Link to="/obs" className="btn ghost">
              Как вставить в OBS
            </Link>
          </div>
          <ul className="facts">
            <li>бесплатно, исходный код открыт</li>
            <li>нужен Spotify Premium (требование Spotify)</li>
            <li>окно для Windows есть, ссылка для OBS тоже</li>
          </ul>
        </div>

        <figure className="stage" style={{ margin: 0 }}>
          <div className="stage-view">
            <ScaledWidget
              config={preset.config}
              playback={demo.playback}
              receivedAt={demo.receivedAt}
              maxWidth={Math.min(460, window.innerWidth - 96)}
              maxHeight={220}
            />
          </div>
          <ul className="stage-picker" aria-label="Примеры оформления">
            {BUILT_IN_PRESETS.map((p) => (
              <li key={p.id}>
                <button type="button" aria-pressed={p.id === preset.id} onClick={() => setPresetId(p.id)}>
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
          <figcaption className="stage-caption">
            Это настоящий виджет, а не картинка. «{preset.name}»: {preset.description.toLowerCase()}.
          </figcaption>
        </figure>
      </section>

      <section className="split">
        <div>
          <h2>Редактор</h2>
          <p className="muted">
            Всё, что видно в виджете, настраивается. Изменения сразу идут в OBS, ссылку заново вставлять не нужно.
          </p>
        </div>
        <dl className="spec">
          <dt>{LAYOUTS.length} макетов</dt>
          <dd>от узкой строки в углу до крупной обложки</dd>
          <dt>{FONTS.length - 1} шрифтов</dt>
          <dd>для исполнителя можно взять другой, чем для названия</dd>
          <dt>{VISUALIZER_STYLES.length} визуализаторов</dt>
          <dd>вместо полосы прогресса, в том числе «волна трека» с закрашенной проигранной частью</dd>
          <dt>2 картинки или GIF</dt>
          <dd>по прямой ссылке, в любом месте карточки, можно показывать только пока трек играет</dd>
          <dt>{BUILT_IN_PRESETS.length} пресетов</dt>
          <dd>и свои, до 50 штук</dd>
        </dl>
      </section>

      <section className="split">
        <div>
          <h2>Что надо знать заранее</h2>
          <p className="muted">Часть ограничений придумали не мы, их накладывает Spotify.</p>
        </div>
        <ul className="notes">
          <li>
            <b>Свое приложение Spotify.</b> Spotify разрешил обычным разработчикам только 5 пользователей на
            приложение, поэтому у каждого свой Client ID. Создаётся за пару минут, мы показываем, куда нажимать.
          </li>
          <li>
            <b>Premium у владельца приложения.</b> Без него Spotify отвечает ошибкой 403, и виджет это подскажет.
          </li>
          <li>
            <b>Обложка остаётся как есть.</b> По правилам Spotify её нельзя обрезать, размывать и анимировать,
            поэтому скругление ограничено, а эффекты применяются к остальному.
          </li>
          <li>
            <b>Визуализатор не слышит музыку.</b> Spotify не отдаёт звук трека, поэтому столбики живут своей жизнью:
            движутся, пока трек играет, и затихают на паузе.
          </li>
          <li>
            <b>Токен Spotify лежит на сервере</b> в зашифрованном виде. В ссылке для OBS его нет, ссылку можно
            пересоздать в один клик.
          </li>
        </ul>
      </section>

      <section className="split">
        <div>
          <h2>Как начать</h2>
        </div>
        <ol className="steps">
          <li>Зарегистрируйтесь, у каждого свои виджеты.</li>
          <li>Создайте приложение на developer.spotify.com и вставьте Client ID в разделе «Spotify».</li>
          <li>Выберите пресет и подправьте под себя.</li>
          <li>Скопируйте ссылку в источник «Браузер» в OBS или откройте виджет в окне Windows.</li>
        </ol>
      </section>
    </div>
  );
}
