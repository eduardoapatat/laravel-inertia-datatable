#!/usr/bin/env bash
# Instala el paquete en un starter kit de React recién creado y lo comprueba como lo haría un
# usuario: genera una tabla con su UI y pasa los checks del propio starter kit.
#
# Uso: .github/scripts/starter-kit.sh <npm|pnpm> <carpeta-nueva>
set -euo pipefail

package_manager="${1:?npm o pnpm}"
app_dir="${2:?carpeta donde crear el starter kit}"
package_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [ -e "$app_dir" ]; then
    echo "La carpeta $app_dir ya existe" >&2
    exit 1
fi

echo "::group::Crear el starter kit"
composer create-project laravel/react-starter-kit "$app_dir" dev-main --no-interaction --prefer-dist
cd "$app_dir"
echo "::endgroup::"

echo "::group::Instalar dependencias JS con $package_manager"
case "$package_manager" in
    pnpm) pnpm install ;;
    npm) npm install ;;
    *) echo "Gestor no soportado: $package_manager" >&2; exit 1 ;;
esac
echo "::endgroup::"

echo "::group::Instalar el paquete desde el checkout"
composer config repositories.laravel-inertia-datatable path "$package_dir"
composer require eduardoapatat/laravel-inertia-datatable:@dev --no-interaction
echo "::endgroup::"

echo "::group::Generar una tabla con su UI (registro del propio commit)"
INERTIA_DATATABLE_REGISTRY_URL="$package_dir/r" \
    php artisan make:datatable UsersTable --react --page --install-ui
test -f resources/js/hooks/use-server-data-table.ts
test -f resources/js/components/data-tables/users-table.tsx
test -f resources/js/pages/users/index.tsx
echo "::endgroup::"

echo "::group::Build"
npm run build
echo "::endgroup::"

# Lint y tipos de JS, Pint, PHPStan y los tests del starter kit.
composer ci:check
