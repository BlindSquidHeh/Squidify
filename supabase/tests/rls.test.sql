-- Проверки RLS и прав доступа. Любая ошибка прерывает выполнение (ON_ERROR_STOP).
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

-- Данные пользователя B, созданные сервером.
insert into public.widgets (id, user_id, name, config)
values ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B', '{"x":1}');
insert into public.spotify_connections (user_id, mode, client_id)
values ('00000000-0000-0000-0000-00000000000b', 'own', 'abcdefabcdefabcdefabcdefabcdefab');
insert into public.spotify_tokens (user_id, refresh_token_enc)
values ('00000000-0000-0000-0000-00000000000b', 'v1.secret');

-- Действуем как пользователь A.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into public.widgets (name, config) values ('A', '{"layout":"horizontal"}');

do $$
declare
  n int;
  tok text;
  new_tok text;
begin
  select count(*) into n from public.widgets;
  if n <> 1 then raise exception 'A должен видеть только свой виджет, видит %', n; end if;

  select count(*) into n from public.spotify_connections;
  if n <> 0 then raise exception 'A видит чужое подключение Spotify'; end if;

  update public.widgets set name = 'взлом' where id = '10000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A изменил чужой виджет'; end if;

  delete from public.widgets where id = '10000000-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A удалил чужой виджет'; end if;

  select public_token into tok from public.widgets limit 1;
  if tok !~ '^[0-9a-f]{64}$' then raise exception 'Неверный формат токена: %', tok; end if;

  new_tok := public.regenerate_widget_token((select id from public.widgets limit 1));
  if new_tok = tok then raise exception 'Токен не изменился'; end if;

  begin
    perform public.regenerate_widget_token('10000000-0000-0000-0000-00000000000b');
    raise exception 'A пересоздал чужой токен';
  exception when no_data_found then null;
  end;
end $$;

-- Прямая запись токена запрещена правами на столбцы.
do $$
begin
  begin
    update public.widgets set public_token = repeat('a', 64);
    raise exception 'Клиент смог задать public_token';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.widgets (name, user_id) values ('x', '00000000-0000-0000-0000-00000000000b');
    raise exception 'Клиент смог задать user_id';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.spotify_tokens;
    raise exception 'Клиент прочитал spotify_tokens';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.oauth_states;
    raise exception 'Клиент прочитал oauth_states';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.playback_cache;
    raise exception 'Клиент прочитал playback_cache';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.spotify_connections (user_id, mode, client_id)
    values ('00000000-0000-0000-0000-00000000000a', 'own', 'abcdefabcdefabcdefabcdefabcdefab');
    raise exception 'Клиент смог записать spotify_connections';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.acquire_playback_lock('00000000-0000-0000-0000-00000000000a', 1000);
    raise exception 'Клиент вызвал acquire_playback_lock';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Пресеты.
insert into public.widget_presets (name, config) values ('Мой', '{}');
do $$
declare n int;
begin
  select count(*) into n from public.widget_presets;
  if n <> 1 then raise exception 'Пресет не создан'; end if;
end $$;

-- Аноним не видит ничего.
reset role;
set role anon;
do $$
begin
  begin
    perform 1 from public.widgets;
    raise exception 'anon прочитал widgets';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Сервер: блокировка запроса к Spotify.
reset role;
set role service_role;
do $$
declare a boolean; b boolean;
begin
  a := public.acquire_playback_lock('00000000-0000-0000-0000-00000000000b', 5000);
  b := public.acquire_playback_lock('00000000-0000-0000-0000-00000000000b', 5000);
  if not a or b then raise exception 'Блокировка работает неверно: % %', a, b; end if;
  update public.playback_cache set lock_until = now() - interval '1 second';
  a := public.acquire_playback_lock('00000000-0000-0000-0000-00000000000b', 5000);
  if not a then raise exception 'Просроченная блокировка не освобождена'; end if;
end $$;

-- Каскадное удаление аккаунта.
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
do $$
declare n int;
begin
  select (select count(*) from public.widgets where user_id = '00000000-0000-0000-0000-00000000000b')
       + (select count(*) from public.spotify_tokens)
       + (select count(*) from public.spotify_connections)
       + (select count(*) from public.playback_cache) into n;
  if n <> 0 then raise exception 'После удаления аккаунта остались данные: %', n; end if;
end $$;

-- Лимит количества виджетов.
do $$
begin
  for i in 1..19 loop
    insert into public.widgets (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'w' || i);
  end loop;
  begin
    insert into public.widgets (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'лишний');
    raise exception 'Лимит виджетов не сработал';
  exception when check_violation then null;
  end;
end $$;

select 'OK: все проверки базы данных пройдены' as result;
