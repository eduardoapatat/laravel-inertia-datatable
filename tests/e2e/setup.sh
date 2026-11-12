#!/usr/bin/env bash
# Prepares an app made by .github/scripts/starter-kit.sh for the e2e tests: copies the
# products scenario of tests/e2e/fixture, seeds its fixed data and builds the assets.
#
# Usage: tests/e2e/setup.sh <app-folder>
set -euo pipefail

app_dir="$(cd "${1:?folder of the starter kit app}" && pwd)"
fixture_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/fixture" && pwd)"

cp -r "$fixture_dir/." "$app_dir/"
cd "$app_dir"

if ! grep -q "routes/e2e.php\|/e2e.php" routes/web.php; then
    printf "\nrequire __DIR__.'/e2e.php';\n" >> routes/web.php
fi

php artisan migrate:fresh --seed --seeder='Database\Seeders\E2eSeeder' --force --no-interaction
npm run build
