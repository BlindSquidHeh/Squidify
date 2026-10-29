// Типы ответа публичного endpoint берутся из кода Edge Functions,
// чтобы сайт и сервер не расходились.
export type {
  FeedArtist,
  FeedError,
  FeedItem,
  FeedPlayback,
  FeedResponse,
  PlaybackStatus,
} from "../../../supabase/functions/_shared/feed-types.ts";
