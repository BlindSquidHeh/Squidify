// Контракт ответа публичного endpoint виджета. Этот файл импортирует и сайт
// (только типы), поэтому здесь не должно быть кода, зависящего от Deno.

export type PlaybackStatus =
  /** Сейчас что-то играет или стоит на паузе: см. isPlaying. */
  | "active"
  /** Spotify ничего не воспроизводит. */
  | "idle"
  /** Играет реклама, метаданные недоступны. */
  | "ad"
  /** Spotify не подключён к аккаунту. */
  | "not_connected"
  /** Авторизация Spotify отозвана или истекла, нужно переподключение. */
  | "reauth_required"
  /** Spotify вернул 403: пользователь не добавлен в приложение или у владельца нет Premium. */
  | "forbidden"
  /** Превышен лимит запросов, показывается последнее известное состояние. */
  | "rate_limited"
  /** Временная ошибка сети или Spotify. */
  | "error";

export interface FeedArtist {
  name: string;
  url: string | null;
}

export interface FeedItem {
  type: "track" | "episode";
  id: string;
  title: string;
  artists: FeedArtist[];
  album: string | null;
  albumUrl: string | null;
  coverUrl: string | null;
  durationMs: number;
  url: string | null;
}

export interface FeedPlayback {
  status: PlaybackStatus;
  isPlaying: boolean;
  progressMs: number;
  item: FeedItem | null;
  /** Сколько миллисекунд прошло с момента запроса к Spotify (возраст кеша). */
  ageMs: number;
}

export interface FeedResponse {
  /** null, если конфигурация не изменилась с версии, переданной клиентом. */
  widget: { config: unknown; version: string } | null;
  version: string;
  playback: FeedPlayback;
  /** Рекомендуемая пауза до следующего запроса. */
  pollAfterMs: number;
}

export interface FeedError {
  error: "invalid_token" | "not_found" | "server_error" | "bad_request";
  message: string;
}
