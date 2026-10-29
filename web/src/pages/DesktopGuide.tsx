import { Link } from "react-router-dom";
import { config } from "../lib/env";

export default function DesktopGuide() {
  return (
    <div className="prose">
      <h1>Виджет в отдельном окне Windows</h1>
      <p className="muted">
        Приложение Squidify Desktop показывает ваш виджет в прозрачном окне без рамок поверх других окон — удобно для
        игр, работы и стримов без OBS. Дизайн по-прежнему настраивается на сайте и обновляется в окне автоматически.
      </p>

      <div className="row" style={{ marginBottom: 24 }}>
        <a className="btn primary" href={`${config.repositoryUrl}/releases/latest`} target="_blank" rel="noopener noreferrer">
          Скачать для Windows
        </a>
        <a className="btn" href={config.repositoryUrl} target="_blank" rel="noopener noreferrer">
          Исходный код
        </a>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Первый запуск</h2>
        <ol className="steps">
          <li>Установите приложение из раздела Releases и запустите его.</li>
          <li>
            На странице <Link to="/app">Мои виджеты</Link> нажмите <b>В окне Windows</b> — браузер предложит открыть
            Squidify. Или скопируйте ссылку виджета и вставьте её в окне настроек приложения.
          </li>
          <li>Перетащите виджет мышью в нужное место. Положение и размер запоминаются.</li>
          <li>
            Включите <b>Зафиксировать положение</b>, чтобы случайно не сдвинуть окно. В зафиксированном режиме по
            ссылкам в виджете можно кликать.
          </li>
        </ol>
      </div>

      <h2>Управление</h2>
      <table className="table">
        <tbody>
          <tr>
            <th>Перемещение</th>
            <td>Перетащите виджет мышью (когда положение не зафиксировано).</td>
          </tr>
          <tr>
            <th>Размер</th>
            <td>Потяните за уголок справа внизу, задайте размер в настройках или нажмите «Подогнать под виджет».</td>
          </tr>
          <tr>
            <th>Поверх окон</th>
            <td>Переключается в меню значка в системном трее.</td>
          </tr>
          <tr>
            <th>Скрыть / показать</th>
            <td>
              Горячая клавиша <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>S</kbd> (меняется в настройках) или пункт в меню
              трея.
            </td>
          </tr>
          <tr>
            <th>Фиксация</th>
            <td>Пункт «Зафиксировать положение» в трее или в настройках.</td>
          </tr>
          <tr>
            <th>Выход</th>
            <td>Меню трея → «Выход». Закрытие окна настроек сворачивает приложение в трей.</td>
          </tr>
        </tbody>
      </table>

      <h2>Безопасность</h2>
      <p>
        Окно загружает только страницу виджета с этого сайта во встроенном изолированном фрейме. У страницы нет доступа
        к Node.js, файлам и системным функциям: включены <code>contextIsolation</code>, <code>sandbox</code>,
        запрещены переходы на другие адреса и всплывающие окна (ссылки на Spotify открываются в обычном браузере).
      </p>
    </div>
  );
}
