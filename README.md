# laravel-inertia-datatable

[![tests](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/tests.yml/badge.svg)](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/tests.yml)
[![starter kit](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/starter-kit.yml/badge.svg)](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/starter-kit.yml)

DataTable reutilizable para **Laravel + Inertia** (React y Vue), basado en shadcn/ui y TanStack Table, con paginación, ordenamiento, filtros, búsqueda global y visibilidad de columnas **resueltos en el servidor**.

> Estado: en desarrollo (fase 1: contrato HTTP y backend).

## Qué contiene este repo

| Parte | Dónde | Cómo se instala |
|---|---|---|
| Paquete Composer (backend) | `src/`, `config/` | `composer require eduardoapatat/laravel-inertia-datatable` |
| Registro shadcn (React) y shadcn-vue (Vue) | `registry.json`, `registry/`, `r/` | `pnpm dlx shadcn@latest add <url>` / `pnpm dlx shadcn-vue@latest add <url>` |
| Skill de Claude Code | `skill/` | — |

El contrato entre frontend y backend está en [`docs/contract.md`](docs/contract.md).

## Instalación del backend

Desde GitHub (repositorio `vcs`):

```json
"repositories": [
    { "type": "vcs", "url": "https://github.com/eduardoapatat/laravel-inertia-datatable" }
]
```

O desde una carpeta local (`path`), útil para desarrollo:

```json
"repositories": [
    { "type": "path", "url": "../laravel-inertia-datatable", "options": { "symlink": true } }
]
```

```bash
composer require eduardoapatat/laravel-inertia-datatable:@dev
php artisan vendor:publish --tag=inertia-datatable-config   # opcional
```

## Crear una tabla

```bash
php artisan make:datatable ProductsTable                 # solo la clase (modelo deducido: App\Models\Product)
php artisan make:datatable ProductsTable --react         # + componente components/data-tables/products-table.tsx
php artisan make:datatable ProductsTable --page          # + componente + página pages/products/index.tsx
php artisan make:datatable ProductsTable --react --install-ui   # instala también la UI genérica si falta
php artisan make:datatable OrdersTable --model=Domain/Sales/Order --empty
```

Propone las columnas leyendo los casts del modelo y el esquema de la tabla: texto (buscable y ordenable), números, booleanos, fechas, enums (`multiSelect(Enum::class)`) y relaciones `belongsTo` (`category_id` → `from('category.name')`). Omite la clave primaria, los atributos `$hidden` y columnas sensibles (`password`, `remember_token`…).

En React hay dos niveles: los componentes genéricos (`components/data-table/`, hook y libs) se instalan una vez por proyecto desde el registro, y cada tabla tiene su propio componente (`components/data-tables/<recurso>-table.tsx`) reutilizable en cualquier página. La clase PHP decide qué columnas se ven y en qué orden (también el de los filtros): las que el componente no declara se muestran con una celda por defecto según su tipo, y en el componente solo se declaran las columnas que se quieren personalizar (por ejemplo, una celda con un badge) o las que solo existen en el cliente (acciones o selección, al final salvo `meta: { position: 'start' }`).

La disposición (buscador, filtros, Reset, menú de columnas y paginación) también se cambia en el componente de cada tabla, sin tocar los componentes compartidos: `DataTableToolbar` está hecho de piezas exportadas (`DataTableSearch`, `DataTableFilters`, `DataTableFilter`, `DataTableResetButton`, `DataTableViewOptions`) que se pueden colocar en cualquier orden, y con `<DataTable pagination={false}>` la `DataTablePagination` va donde se quiera (por ejemplo, arriba). `--install-ui` ejecuta `shadcn add` con el gestor del lockfile y responde "no" a sobrescribir los `ui/` existentes; la URL del registro se configura en `inertia-datatable.registry_url` o con la variable `INERTIA_DATATABLE_REGISTRY_URL` (una URL o una carpeta local con los JSON compilados, por ejemplo para fijar la UI a una versión). La UI se instala aunque la tabla no llegue a crearse (modelo inexistente o clase ya existente). Si el modelo no existe, el comando lista los modelos disponibles.

### Instalar o actualizar la UI

```bash
php artisan inertia-datatable:ui            # instala la UI genérica si falta
php artisan inertia-datatable:ui --update   # actualiza solo los archivos del DataTable (pide confirmación; --force para no preguntar)
```

La actualización usa el item `data-table-react-files`, que sobrescribe `components/data-table/*`, `components/ui/faceted.tsx`, el hook y `lib/data-table-*.ts`, sin tocar el resto de `components/ui/` del proyecto. Los cambios locales en esos archivos se pierden.

Los stubs se pueden personalizar con `php artisan vendor:publish --tag=inertia-datatable-stubs`.

## Instalación del frontend (React)

En un proyecto con el starter kit de React de Laravel:

```bash
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/main/r/data-table-react.json
```

Instala `@tanstack/react-table` v9, el hook `useServerDataTable`, los componentes en `resources/js/components/data-table/` y las primitivas de shadcn que falten. Cuando pregunte si sobrescribir componentes de `ui/` que ya existen, se puede responder que no: el DataTable solo usa variantes que ya tiene el starter kit.

Si `resources/js/components/ui/dialog.tsx` es una versión antigua (sin la prop `showCloseButton`), la primitiva `command` no compila; actualízala con `pnpm dlx shadcn@latest add dialog --overwrite`.

Uso en una página:

```tsx
const { table, isLoading } = useServerDataTable({ table: users, prop: 'users', columns });

<DataTable table={table}>
    <DataTableToolbar table={table} searchable={users.config.searchable} />
</DataTable>
```

## Skill de Claude Code

Para que Claude Code sepa instalar el paquete y crear tablas en un proyecto:

```bash
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/main/r/data-table-skill.json
```

La deja en `.claude/skills/laravel-inertia-datatable/`.

## Desarrollo

```bash
composer install
composer test           # Pest
composer format         # Pint
composer analyse        # Larastan
composer check          # todo lo anterior (Pint en modo --test)
pnpm install
pnpm run test           # tests del código compartido (Vitest)
pnpm run check          # formato y lint (vite-plus)
pnpm run types:check
pnpm run registry:build # compila registry.json en r/
```

Los tests usan SQLite en memoria; para otro motor se pasan las variables de Testbench, por ejemplo `DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 DB_DATABASE=testing DB_USERNAME=postgres DB_PASSWORD=password vendor/bin/pest`.

El CI (`.github/workflows/`) corre:

- **tests**: Pest con PHP 8.3 a 8.5 y Laravel 12 y 13, MySQL 8.4 y Postgres 17, y el registro (formato, tests, tipos y que `r/` esté recompilado).
- **starter kit**: crea un starter kit de React limpio, instala el paquete y la UI de este commit con `make:datatable --react --page --install-ui` (con npm y con pnpm) y pasa el `composer ci:check` del starter kit. También corre cada semana, porque el instalador usa `shadcn@latest`. Se puede ejecutar en local con `.github/scripts/starter-kit.sh npm /tmp/app`.

## Créditos

Parte del código de frontend incluye software de terceros con licencia MIT; ver [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
