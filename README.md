# laravel-inertia-datatable

[![tests](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/tests.yml/badge.svg)](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/tests.yml)
[![starter kit](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/starter-kit.yml/badge.svg)](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/starter-kit.yml)

Reusable DataTable for **Laravel + Inertia + React**, built on shadcn/ui and TanStack Table, with pagination, sorting, filters, global search and column visibility **resolved on the server**.

> Version 0.4: backend and React UI. The Vue version is in progress. Changes in [`CHANGELOG.md`](CHANGELOG.md).

## What this repo contains

| Part | Where | How to install it |
|---|---|---|
| Composer package (backend) | `src/`, `config/` | `composer require eduardoapatat/laravel-inertia-datatable` |
| shadcn registry (React) | `registry.json`, `registry/`, `r/` | `php artisan inertia-datatable:ui` or `pnpm dlx shadcn@latest add <url>` |
| Claude Code skill | `skill/` | `pnpm dlx shadcn@latest add <url>` |

The contract between frontend and backend is in [`docs/contract.md`](docs/contract.md).

## Backend installation

```bash
composer require eduardoapatat/laravel-inertia-datatable
php artisan vendor:publish --tag=inertia-datatable-config   # optional
```

Requires PHP 8.3+ and Laravel 12 or 13. It can also be installed straight from GitHub (`vcs` repository):

```json
"repositories": [
    { "type": "vcs", "url": "https://github.com/eduardoapatat/laravel-inertia-datatable" }
]
```

Or from a local folder (`path`), useful for development:

```json
"repositories": [
    { "type": "path", "url": "../laravel-inertia-datatable", "options": { "symlink": true } }
]
```

With these repositories: `composer require eduardoapatat/laravel-inertia-datatable:@dev`.

## Creating a table

```bash
php artisan make:datatable ProductsTable                 # only the class (guessed model: App\Models\Product)
php artisan make:datatable ProductsTable --react         # + component components/data-tables/products-table.tsx
php artisan make:datatable ProductsTable --page          # + component + page pages/products/index.tsx
php artisan make:datatable ProductsTable --react --install-ui   # also installs the generic UI if missing
php artisan make:datatable OrdersTable --model=Domain/Sales/Order --empty
```

It proposes the columns from the model casts and the table schema: text (searchable and sortable), numbers, booleans, dates, enums (`multiSelect(Enum::class)`) and `belongsTo` relations (`category_id` → `from('category.name')`). It skips the primary key, `$hidden` attributes and sensitive columns (`password`, `remember_token`…).

React has two levels: the generic components (`components/data-table/`, hook and libs) are installed once per project from the registry, and each table has its own component (`components/data-tables/<resource>-table.tsx`) reusable in any page. The PHP class decides which columns are shown and in which order (also the order of the filters): the columns the component does not declare are rendered with a default cell for their type, and the component only declares the columns it wants to customize (for example, a cell with a badge) or the ones that only exist on the client (actions or selection, at the end unless `meta: { position: 'start' }`).

The layout (search, filters, Reset, column menu and pagination) is also changed in each table's component, without touching the shared components: `DataTableToolbar` is made of exported pieces (`DataTableSearch`, `DataTableFilters`, `DataTableFilter`, `DataTableResetButton`, `DataTableViewOptions`) that can be placed in any order, and with `<DataTable pagination={false}>` the `DataTablePagination` goes wherever you want (for example, on top). `--install-ui` runs `shadcn add` with the lockfile's package manager and answers "no" to overwriting existing `ui/` files; the registry URL is set in `inertia-datatable.registry_url` or with the `INERTIA_DATATABLE_REGISTRY_URL` variable (a URL or a local folder with the compiled JSON, for example to pin the UI to a version). The UI is installed even when the table is not created (unknown model or existing class). When the model does not exist, the command lists the available models.

### Formatting cells

The row always carries the raw value; how it looks is declared on the column and formatted in the browser with Intl:

```php
Column::make('price', 'Price')->sortable()->range()->money('CLP'),
Column::make('weight', 'Weight')->number('kg')->decimals(1),
Column::make('discount', 'Discount')->percent(),
Column::make('published_at', 'Published')->dateRange()->dateFormat('long'),  // short | medium | long | datetime | relative
Column::make('notes', 'Notes')->text()->limit(60),
Column::make('website', 'Web')->url(),
Column::make('featured', 'Featured')->boolean()->booleanLabels('Sí', 'No'),
Column::make('status', 'Status')->multiSelect(ProductStatus::class)->badge(),
Column::make('views', 'Views')->numberFormat(['notation' => 'compact']),   // any Intl option
```

- Numbers and dates use the table locale (see [Language and formats](#language-and-formats)); `money()` without a currency uses `inertia-datatable.currency`.
- Dates without time (Laravel `date` casts) never move to the previous day.
- In the React component you can set or override the format (`meta: { display: … }`), add icons per option (`meta.options`, shown in the filter and in the cells) or write a custom `cell` that reuses the type cells (`DataTableNumberCell`, `DataTableDateCell`, `DataTableOptionCell`…) to render a value differently while keeping its format. See the skill's React reference.

### Language and formats

The defaults come from your Laravel app and each layer can change them; the most specific one wins.

| What | Order (first wins) |
|---|---|
| Locale of numbers, currencies and dates | `useServerDataTable({ locale })` → the table (`locale()` in the class, `->locale()` in `DataTable::for`) → `inertia-datatable.locale` → `app()->getLocale()` (`APP_LOCALE`) |
| UI texts (Search, Reset, Rows per page…) | `useServerDataTable({ messages })` → `lang/vendor/inertia-datatable/{lang}/ui.php` → the package texts (`en`, `es`) in the app language → English |
| Format of a column | your own `cell` → React `meta.display` → the column method (`->money()`, `->dateFormat()`…) → `inertia-datatable.currency` / `inertia-datatable.date_format` |

```php
// config/inertia-datatable.php
'locale' => null,         // null = app locale; 'es-CL', 'en-US'…; 'browser' = each browser's
'currency' => 'CLP',      // ->money() without a currency
'date_format' => 'long',  // ->dateFormat() without a format and date columns without one
```

- A locale with a region gives the local symbols: with `es` a CLP amount shows `CLP 1.234`, with `es-CL` it shows `$1.234`. `es_CL` is accepted too.
- The calendar of the date filters follows the same locale (month and day names, first day of the week).
- To translate or change the texts, publish them and edit the copy; it survives `inertia-datatable:ui --update`:

```bash
php artisan vendor:publish --tag=inertia-datatable-lang   # → lang/vendor/inertia-datatable/{en,es}/ui.php
```

Add a language by copying `en/ui.php` to `lang/vendor/inertia-datatable/{lang}/ui.php`; keys missing in a file fall back to English. In React, `useServerDataTable({ messages: { search: 'Find products…' } })` changes texts for one table.

### Column validation

With `APP_DEBUG=true`, every request checks that the declared columns exist, so a typo or a missing migration fails on the first load with a clear message instead of a SQL error when someone sorts or filters:

- Columns that sort, search or filter (and the default sort) must be columns of their table (or of the related table, with `from('relation.column')`).
- Displayed columns must have a value in the model: a column, an alias of the query (`withCount`, `addSelect`) or an attribute in `$appends`. Tables with `transform()` are not checked.

It is controlled with `inertia-datatable.validate_columns` (`null` = follow the debug mode, `true`/`false` to force it). In production it is off and costs nothing.

### Installing or updating the UI

```bash
php artisan inertia-datatable:ui            # installs the generic UI if missing
php artisan inertia-datatable:ui --update   # updates only the DataTable files (asks for confirmation; --force to skip it)
```

The update uses the `data-table-react-files` item, which overwrites `components/data-table/*`, `components/ui/faceted.tsx`, the hook and `lib/data-table-*.ts`, without touching the rest of the project's `components/ui/`. Local changes to those files are lost.

The stubs can be customized with `php artisan vendor:publish --tag=inertia-datatable-stubs`.

## Frontend installation (React)

In a project with Laravel's React starter kit:

```bash
php artisan inertia-datatable:ui            # or make:datatable … --install-ui
php artisan inertia-datatable:ui --update   # brings the new version of the DataTable files
```

From the registry of the same version as the package, it installs `@tanstack/react-table` v9, the `useServerDataTable` hook, the components in `resources/js/components/data-table/` and the missing shadcn primitives, answering "no" to overwriting the existing `ui/` files (the DataTable only uses variants the starter kit already has). By hand:

```bash
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/v0.4.1/r/data-table-react.json
```

Inertia writes the URL with brackets and commas encoded (`filter%5Bstatus%5D=a%2Cb`). For readable URLs, add this to the app's `HandleInertiaRequests` middleware (it affects every Inertia page, so the package does not do it by itself):

```php
public function urlResolver(): ?Closure
{
    return fn (Request $request): string => $request->getRequestUri();
}
```

For usage in pages, see `make:datatable --react` above and the skill's React reference (`skill/laravel-inertia-datatable/references/react.md`).

## Claude Code skill

So Claude Code knows how to install the package and create tables in a project:

```bash
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/v0.4.1/r/data-table-skill.json
```

It is placed in `.claude/skills/laravel-inertia-datatable/`.

## Development

```bash
composer install
composer test           # Pest
composer format         # Pint
composer analyse        # Larastan
composer check          # all of the above (Pint in --test mode)
pnpm install
pnpm run test           # tests of the shared code (Vitest)
pnpm run check          # format and lint (vite-plus)
pnpm run types:check
pnpm run registry:build # compiles registry.json into r/
```

Tests use in-memory SQLite; for another engine pass Testbench's variables, for example `DB_CONNECTION=pgsql DB_HOST=127.0.0.1 DB_PORT=5432 DB_DATABASE=testing DB_USERNAME=postgres DB_PASSWORD=password vendor/bin/pest`.

The CI (`.github/workflows/`) runs:

- **tests**: Pest with PHP 8.3 to 8.5 and Laravel 12 and 13, MySQL 8.4 and Postgres 17, and the registry (format, tests, types and that `r/` is rebuilt).
- **starter kit**: creates a clean React starter kit, installs the package and the UI of the commit with `make:datatable --react --page --install-ui` (with npm and with pnpm) and runs the starter kit's `composer ci:check`. It also runs every week, because the installer uses `shadcn@latest`. It can be run locally with `.github/scripts/starter-kit.sh npm /tmp/app`.

## Releasing a version

1. Move the `## [Unreleased]` entries of `CHANGELOG.md` to the new version.
2. Change the version in the registry URLs of the README and the skill (`…/vX.Y.Z/r/…`) and rebuild `r/`.
3. Commit, annotated tag `vX.Y.Z` and push the tag. Packagist publishes it by itself; `inertia-datatable:ui` installs the UI of that tag.

## Credits

Part of the frontend code includes third-party MIT-licensed software; see [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
