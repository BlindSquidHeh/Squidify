#!/usr/bin/env bash
# Применяет миграции к временному PostgreSQL и проверяет RLS.
# Требуется локально установленный PostgreSQL (initdb, pg_ctl, psql).
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PG_BIN="${PG_BIN:-$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb | tail -1)")}"
TMP="$(mktemp -d)"
PORT="${PGTEST_PORT:-54399}"

cleanup() {
  "$PG_BIN/pg_ctl" -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

if [ "$(id -u)" = "0" ]; then
  echo "Запуск PostgreSQL от root невозможен: запустите от обычного пользователя" >&2
  exit 1
fi

"$PG_BIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PG_BIN/pg_ctl" -D "$TMP/data" -o "-p $PORT -k $TMP -c listen_addresses=''" -l "$TMP/log" start >/dev/null

PSQL=("$PG_BIN/psql" -h "$TMP" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$DIR/auth-stub.sql"
for f in "$DIR"/../migrations/*.sql; do
  echo "→ $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -f "$DIR/rls.test.sql"
