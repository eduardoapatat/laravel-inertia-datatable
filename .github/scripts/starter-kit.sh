#!/usr/bin/env bash
# Installs the package in a freshly created React starter kit and checks it the way a user
# would: generates a table with its UI and runs the starter kit's own checks.
#
# Usage: .github/scripts/starter-kit.sh <npm|pnpm> <new-folder>
set -euo pipefail

package_manager="${1:?npm or pnpm}"
app_dir="${2:?folder where the starter kit is created}"
package_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ -e "$app_dir" ]; then
    echo "The folder $app_dir already exists" >&2
    exit 1
fi

echo "::group::Create the starter kit"
composer create-project laravel/react-starter-kit "$app_dir" dev-main --no-interaction --prefer-dist
cd "$app_dir"
echo "::endgroup::"

echo "::group::Install JS dependencies with $package_manager"
case "$package_manager" in
    pnpm) pnpm install ;;
    npm) npm install ;;
    *) echo "Unsupported package manager: $package_manager" >&2; exit 1 ;;
esac
echo "::endgroup::"

echo "::group::Install the package from the checkout"
composer config repositories.laravel-inertia-datatable path "$package_dir"
composer require eduardoapatat/laravel-inertia-datatable:@dev --no-interaction
echo "::endgroup::"

echo "::group::Generate a table with its UI (registry of this commit)"
INERTIA_DATATABLE_REGISTRY_URL="$package_dir/r" \
    php artisan make:datatable UsersTable --react --page --install-ui
test -f resources/js/hooks/use-server-data-table.ts
test -f resources/js/components/data-tables/users-table.tsx
test -f resources/js/pages/users/index.tsx
echo "::endgroup::"

echo "::group::Build"
npm run build
echo "::endgroup::"

# JS lint and types, Pint, PHPStan and the starter kit tests.
composer ci:check
