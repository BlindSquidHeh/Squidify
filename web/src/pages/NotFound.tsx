import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="empty">
      <h2>Страница не найдена</h2>
      <p>Возможно, ссылка устарела.</p>
      <Link to="/" className="btn">
        На главную
      </Link>
    </div>
  );
}
