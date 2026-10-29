-- Squidify: схема базы данных.
-- Все пользовательские таблицы защищены Row Level Security.
-- Таблицы с секретами (токены Spotify, OAuth state, кеш воспроизведения)
-- доступны только service_role, то есть Edge Functions.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Общие функции
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_widget_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

-- ---------------------------------------------------------------------------
-- Виджеты
-- ---------------------------------------------------------------------------

create table public.widgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Мой виджет',
  config jsonb not null default '{}'::jsonb,
  -- Публичный токен только для чтения. 256 бит случайности, hex.
  public_token text not null unique default public.generate_widget_token(),
  token_rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint widgets_name_length check (char_length(name) between 1 and 80),
  constraint widgets_config_object check (jsonb_typeof(config) = 'object'),
  constraint widgets_config_size check (pg_column_size(config) <= 32768),
  constraint widgets_token_format check (public_token ~ '^[0-9a-f]{64}$')
);

create index widgets_user_id_idx on public.widgets (user_id);

create trigger widgets_set_updated_at
  before update on public.widgets
  for each row execute function public.set_updated_at();

-- Ограничение количества виджетов на пользователя.
create or replace function public.enforce_widget_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.widgets w where w.user_id = new.user_id) >= 20 then
    raise exception 'Достигнут лимит: не больше 20 виджетов на аккаунт'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger widgets_enforce_limit
  before insert on public.widgets
  for each row execute function public.enforce_widget_limit();

alter table public.widgets enable row level security;

create policy "widgets: владелец читает"
  on public.widgets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "widgets: владелец создаёт"
  on public.widgets for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "widgets: владелец изменяет"
  on public.widgets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "widgets: владелец удаляет"
  on public.widgets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Клиент может менять только имя и конфигурацию. Токен меняется только
-- через regenerate_widget_token(), user_id задаётся по умолчанию.
revoke all on public.widgets from anon, authenticated;
grant select, delete on public.widgets to authenticated;
grant insert (name, config) on public.widgets to authenticated;
grant update (name, config) on public.widgets to authenticated;

-- Пересоздание публичной ссылки: старый токен сразу перестаёт работать.
create or replace function public.regenerate_widget_token(p_widget_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  update public.widgets
     set public_token = public.generate_widget_token(),
         token_rotated_at = now()
   where id = p_widget_id
     and user_id = auth.uid()
  returning public_token into v_token;

  if v_token is null then
    raise exception 'Виджет не найден' using errcode = 'no_data_found';
  end if;
  return v_token;
end;
$$;

revoke all on function public.regenerate_widget_token(uuid) from public, anon;
grant execute on function public.regenerate_widget_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Пользовательские пресеты оформления
-- ---------------------------------------------------------------------------

create table public.widget_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  config jsonb not null,
  created_at timestamptz not null default now(),
  constraint widget_presets_name_length check (char_length(name) between 1 and 80),
  constraint widget_presets_config_object check (jsonb_typeof(config) = 'object'),
  constraint widget_presets_config_size check (pg_column_size(config) <= 32768)
);

create index widget_presets_user_id_idx on public.widget_presets (user_id);

create or replace function public.enforce_preset_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.widget_presets p where p.user_id = new.user_id) >= 50 then
    raise exception 'Достигнут лимит: не больше 50 пресетов на аккаунт'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger widget_presets_enforce_limit
  before insert on public.widget_presets
  for each row execute function public.enforce_preset_limit();

alter table public.widget_presets enable row level security;

create policy "presets: владелец читает"
  on public.widget_presets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "presets: владелец создаёт"
  on public.widget_presets for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "presets: владелец изменяет"
  on public.widget_presets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "presets: владелец удаляет"
  on public.widget_presets for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.widget_presets from anon, authenticated;
grant select, delete on public.widget_presets to authenticated;
grant insert (name, config) on public.widget_presets to authenticated;
grant update (name, config) on public.widget_presets to authenticated;

-- ---------------------------------------------------------------------------
-- Подключение Spotify (несекретная часть, видна владельцу)
-- ---------------------------------------------------------------------------

create table public.spotify_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- own: персональный Client ID пользователя; shared: общий Client ID сервиса.
  mode text not null check (mode in ('own', 'shared')),
  client_id text not null check (client_id ~ '^[0-9a-zA-Z]{32}$'),
  status text not null default 'connected'
    check (status in ('connected', 'reauth_required')),
  spotify_user_id text,
  spotify_display_name text,
  scopes text not null default '',
  last_error text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger spotify_connections_set_updated_at
  before update on public.spotify_connections
  for each row execute function public.set_updated_at();

alter table public.spotify_connections enable row level security;

create policy "spotify_connections: владелец читает"
  on public.spotify_connections for select to authenticated
  using ((select auth.uid()) = user_id);

-- Запись только через Edge Functions (service_role).
revoke all on public.spotify_connections from anon, authenticated;
grant select on public.spotify_connections to authenticated;

-- ---------------------------------------------------------------------------
-- Секреты: только service_role
-- ---------------------------------------------------------------------------

-- Токены Spotify, зашифрованные AES-256-GCM ключом из секретов Edge Functions.
create table public.spotify_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token_enc text not null,
  access_token_enc text,
  access_token_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create trigger spotify_tokens_set_updated_at
  before update on public.spotify_tokens
  for each row execute function public.set_updated_at();

-- Одноразовые OAuth state с PKCE code_verifier (зашифрован), живут 10 минут.
create table public.oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('own', 'shared')),
  client_id text not null,
  redirect_uri text not null,
  code_verifier_enc text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);

create index oauth_states_user_id_idx on public.oauth_states (user_id);
create index oauth_states_expires_at_idx on public.oauth_states (expires_at);

-- Короткий кеш текущего воспроизведения. Хранится только последнее
-- состояние, история прослушивания не сохраняется.
create table public.playback_cache (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb,
  fetched_at timestamptz,
  lock_until timestamptz,
  retry_after_until timestamptz,
  error_count integer not null default 0
);

alter table public.spotify_tokens enable row level security;
alter table public.oauth_states enable row level security;
alter table public.playback_cache enable row level security;

-- Политик нет: anon и authenticated не имеют доступа вообще.
revoke all on public.spotify_tokens from anon, authenticated;
revoke all on public.oauth_states from anon, authenticated;
revoke all on public.playback_cache from anon, authenticated;

grant all on public.spotify_tokens to service_role;
grant all on public.oauth_states to service_role;
grant all on public.playback_cache to service_role;
grant all on public.spotify_connections to service_role;
grant all on public.widgets to service_role;
grant all on public.widget_presets to service_role;

-- Атомарный захват блокировки на запрос к Spotify. Если несколько виджетов
-- одного пользователя опрашивают сервер одновременно, к Spotify пойдёт
-- только один запрос, остальные получат кешированное состояние.
create or replace function public.acquire_playback_lock(p_user_id uuid, p_ttl_ms integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acquired boolean;
begin
  insert into public.playback_cache as c (user_id, lock_until)
  values (p_user_id, now() + make_interval(secs => p_ttl_ms / 1000.0))
  on conflict (user_id) do update
    set lock_until = excluded.lock_until
    where c.lock_until is null or c.lock_until < now()
  returning true into v_acquired;

  return coalesce(v_acquired, false);
end;
$$;

revoke all on function public.acquire_playback_lock(uuid, integer) from public, anon, authenticated;
grant execute on function public.acquire_playback_lock(uuid, integer) to service_role;

-- Очистка просроченных OAuth state.
create or replace function public.cleanup_expired_oauth_states()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.oauth_states where expires_at < now();
$$;

revoke all on function public.cleanup_expired_oauth_states() from public, anon, authenticated;
grant execute on function public.cleanup_expired_oauth_states() to service_role;
