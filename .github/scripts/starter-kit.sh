#!/usr/bin/env bash
# Installs the package in a freshly created React or Vue starter kit and checks it the way
# a user would: generates a table with its UI and runs the starter kit's own checks.
#
# Usage: .github/scripts/starter-kit.sh <react|vue> <npm|pnpm> <new-folder>
set -euo pipefail

framework="${1:?react or vue}"
package_manager="${2:?npm or pnpm}"
app_dir="${3:?folder where the starter kit is created}"
package_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# What make:datatable writes in each framework, to check it is there.
case "$framework" in
    react)
        ui_file=resources/js/hooks/use-server-data-table.ts
        component_file=resources/js/components/data-tables/users-table.tsx
        page_file=resources/js/pages/users/index.tsx
        ;;
    vue)
        ui_file=resources/js/composables/useServerDataTable.ts
        component_file=resources/js/components/data-tables/UsersTable.vue
        page_file=resources/js/pages/users/Index.vue
        ;;
    *) echo "Unsupported framework: $framework" >&2; exit 1 ;;
esac

if [ -e "$app_dir" ]; then
    echo "The folder $app_dir already exists" >&2
    exit 1
fi

echo "::group::Create the starter kit"
composer create-project "laravel/$framework-starter-kit" "$app_dir" dev-main --no-interaction --prefer-dist
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
    php artisan make:datatable UsersTable "--$framework" --page --install-ui
test -f "$ui_file"
test -f "$component_file"
test -f "$page_file"
echo "::endgroup::"

echo "::group::Check the page and generate the deferred one"
# The same table with each kind of page: both must pass the format and the types as generated.
"$package_manager" run check
"$package_manager" run types:check
php artisan make:datatable UsersTable --defer --force
grep -q '<Deferred data="users"' "$page_file"
echo "::endgroup::"

echo "::group::Build"
npm run build
echo "::endgroup::"

# JS lint and types, Pint, PHPStan and the starter kit tests.
composer ci:check
