#!/usr/bin/env bash
# Runs locally what the CI checks, so a change does not reach main to find out:
#
#   repo         Pint, Larastan and Pest (SQLite); format, lint, Vitest and types of
#                the shared code; the compiled registry r/ is up to date.
#   databases    Pest against MySQL 8.4 and Postgres 17 in Docker. Without pdo_mysql or
#                pdo_pgsql in the local PHP, Pest runs in a PHP container that has them.
#   starter-kit  .github/scripts/starter-kit.sh in a temporary folder: a new React
#                starter kit with the package and its UI, checked like a user would.
#
# Usage: .github/scripts/verify.sh [repo] [databases] [starter-kit]   (all without arguments)
#        composer verify [-- databases]
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

mysql_container=laravel-inertia-datatable-verify-mysql
pgsql_container=laravel-inertia-datatable-verify-pgsql
php_image=laravel-inertia-datatable-verify-php
mysql_port=33069
pgsql_port=54329
temp_dir=""

cleanup() {
    docker rm -f "$mysql_container" "$pgsql_container" >/dev/null 2>&1 || true
    if [ -n "$temp_dir" ]; then
        rm -rf "$temp_dir"
    fi
}
trap cleanup EXIT INT TERM

step() {
    echo
    echo "▶ $*"
    "$@"
}

stage_repo() {
    step composer check &&
        step pnpm exec vp check &&
        step pnpm exec vp test run &&
        step pnpm exec tsc --noEmit &&
        step pnpm exec shadcn build -o r &&
        step git diff --exit-code --stat -- r/
}

# Waits until a command succeeds, for at most two minutes.
wait_for() {
    local name="$1"
    shift

    for _ in $(seq 1 120); do
        if "$@" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done

    echo "$name did not start in time" >&2
    return 1
}

# Pest against one database: with the local PHP when it has the driver, else in a
# container (as the current user, so it leaves no files owned by root).
run_pest() {
    local connection="$1" port="$2" username="$3" extension="$4"
    local env=(
        -e DB_CONNECTION="$connection" -e DB_HOST=127.0.0.1 -e DB_PORT="$port"
        -e DB_DATABASE=testing -e DB_USERNAME="$username" -e DB_PASSWORD=password
    )

    if php -m | grep -qx "$extension"; then
        echo "▶ Pest ($connection, local PHP)"
        env DB_CONNECTION="$connection" DB_HOST=127.0.0.1 DB_PORT="$port" \
            DB_DATABASE=testing DB_USERNAME="$username" DB_PASSWORD=password \
            vendor/bin/pest
        return
    fi

    if ! docker image inspect "$php_image" >/dev/null 2>&1; then
        echo "▶ Building the PHP image with $extension (only the first time)"
        docker build -q -t "$php_image" - <<'DOCKERFILE' >/dev/null || return 1
FROM php:8.5-cli
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_mysql pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*
DOCKERFILE
    fi

    echo "▶ Pest ($connection, PHP in Docker: the local PHP has no $extension)"
    docker run --rm --network host --user "$(id -u):$(id -g)" -e HOME=/tmp \
        -v "$root":/app -w /app "${env[@]}" "$php_image" vendor/bin/pest
}

stage_databases() {
    if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
        echo "Docker is not available: it is needed to run MySQL and Postgres." >&2
        return 1
    fi

    cleanup
    echo "▶ Starting MySQL 8.4 (port $mysql_port) and Postgres 17 (port $pgsql_port)"
    docker run -d --rm --name "$mysql_container" -p "127.0.0.1:$mysql_port:3306" \
        -e MYSQL_ROOT_PASSWORD=password -e MYSQL_DATABASE=testing mysql:8.4 >/dev/null || return 1
    docker run -d --rm --name "$pgsql_container" -p "127.0.0.1:$pgsql_port:5432" \
        -e POSTGRES_PASSWORD=password -e POSTGRES_DB=testing postgres:17 >/dev/null || return 1

    # Over TCP: while they initialize, both only listen on a socket.
    wait_for MySQL docker exec "$mysql_container" mysql -h 127.0.0.1 -uroot -ppassword -e 'select 1' testing || return 1
    wait_for Postgres docker exec "$pgsql_container" pg_isready -h 127.0.0.1 -U postgres || return 1

    local status=0
    run_pest mysql "$mysql_port" root pdo_mysql || status=1
    run_pest pgsql "$pgsql_port" postgres pdo_pgsql || status=1

    return "$status"
}

stage_starter_kit() {
    temp_dir="$(mktemp -d)"
    bash "$root/.github/scripts/starter-kit.sh" pnpm "$temp_dir/app"
}

stages=("$@")
if [ "${#stages[@]}" -eq 0 ]; then
    stages=(repo databases starter-kit)
fi

for stage in "${stages[@]}"; do
    case "$stage" in
        repo | databases | starter-kit) ;;
        *) echo "Unknown stage: $stage (repo, databases, starter-kit)" >&2; exit 2 ;;
    esac
done

results=()
failed=0

for stage in "${stages[@]}"; do
    echo
    echo "━━━ $stage ━━━"
    if "stage_${stage//-/_}"; then
        results+=("OK      $stage")
    else
        results+=("FAILED  $stage")
        failed=1
    fi
done

echo
echo "━━━ Summary ━━━"
printf '%s\n' "${results[@]}"

exit "$failed"
