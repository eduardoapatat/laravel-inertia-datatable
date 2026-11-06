# laravel-inertia-datatable

[![tests](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/tests.yml/badge.svg)](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/tests.yml)
[![starter kit](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/starter-kit.yml/badge.svg)](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/starter-kit.yml)

Reusable DataTable for **Laravel + Inertia + React**, built on shadcn/ui and TanStack Table, with pagination, sorting, filters, global search and column visibility **resolved on the server**.

> Version 0.8: backend and React UI. The Vue version is in progress. Changes in [`CHANGELOG.md`](CHANGELOG.md).

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

It proposes the columns from the model casts and the table schema, only with what is needed to show them: text, numbers (`decimals(N)` for `decimal:N` casts), booleans, dates, enums (`Column::option()->options(Enum::class)`), only from the model's own columns: foreign keys (`category_id`) are left out, and relation columns (`Column::option('category')->from('category.name')`) are added by hand. The global search goes on a `name` column, else on a `title` one; sorting, filters and hiding are yours to add. It skips the primary key, `$hidden` attributes and sensitive columns (`password`, `remember_token`…).

React has two levels: the generic components (`components/data-table/`, hook and libs) are installed once per project from the registry, and each table has its own component (`components/data-tables/<resource>-table.tsx`) reusable in any page. The PHP class decides which columns are shown and in which order (also the order of the filters): the columns the component does not declare are rendered with a default cell for their type, and the component only declares the columns it wants to customize (for example, a cell with a badge) or the ones that only exist on the client (actions or selection, at the end unless `meta: { position: 'start' }`).

The layout (search, filters, Reset, column menu and pagination) is also changed in each table's component, without touching the shared components: `DataTableToolbar` is made of exported pieces (`DataTableSearch`, `DataTableFilters`, `DataTableFilter`, `DataTableResetButton`, `DataTableViewOptions`) that can be placed in any order, and with `<DataTable pagination={false}>` the `DataTablePagination` goes wherever you want (for example, on top). `--install-ui` runs `shadcn add` with the lockfile's package manager and answers "no" to overwriting existing `ui/` files; the registry URL is set in `inertia-datatable.registry_url` or with the `INERTIA_DATATABLE_REGISTRY_URL` variable (a URL or a local folder with the compiled JSON, for example to pin the UI to a version). The UI is installed even when the table is not created (unknown model or existing class). When the model does not exist, the command lists the available models.

### Columns, formats and filters

Each column has a type, and the type only offers the methods that make sense for its values: a date has no `money()` and a number has no `badge()`, so the IDE and PHPStan catch a wrong combination. The row always carries the raw value; how it looks is declared on the column and formatted in the browser with Intl.

```php
use InertiaDataTable\Column;

Column::text('name', 'Name')->sortable()->searchable()->filterInput('Search name…'),
Column::text('notes', 'Notes')->limit(60),
Column::text('website', 'Web')->url(),                                          // or ->email()
Column::number('price', 'Price')->sortable()->money('CLP')->filterRange(),            // slider, bounds from the data
Column::number('weight', 'Weight')->unit('kg')->decimals(1)->filterInput(),
Column::number('discount', 'Discount')->percent(),
Column::number('views', 'Views')->format(['notation' => 'compact']),           // any Intl option
Column::date('published_at', 'Published')->format('long')->filterRange(),            // short | medium | long | datetime | relative
Column::boolean('featured', 'Featured')->labels('Sí', 'No')->filterSelect(),
Column::option('status', 'Status')->options(ProductStatus::class)->badge()->filterMultiSelect(),
Column::option('stage', 'Stage')->options(Stage::class)->badge('secondary', ['lost' => 'destructive']),
Column::option('category', 'Category')->from('category.name')->sortable()->filterMultiSelect(),
```

| Type | Format | Filter |
|---|---|---|
| `Column::text()` | `limit()`, `url()` or `email()` | `filterInput(?placeholder)`: text input, contains |
| `Column::number()` | `money(?currency, ?decimals)`, `decimals()`, `percent()`, `format([...])`, `unit()` | `filterInput(?placeholder)`: number input, equal to; `filterRange(?min, ?max)`: slider |
| `Column::date()` | `format(preset or Intl options)` | `filterDate()`: calendar, one day; `filterRange()`: calendar, from / to |
| `Column::boolean()` | `labels(true, false)`, `badge()` | `filterSelect()`: list, Yes or No |
| `Column::option()` | `options(list, map or enum)`, `badge()` | `filterSelect()`: list, one option; `filterMultiSelect()`: list, several (`counts: false` skips the counts) |

- The name of each filter method says the control shown in the toolbar. The URL also accepts other operators than the control uses (`filter[stock]=gt.100`, `between.10,50`, `is.empty`…, see `docs/contract.md`).
- A column has at most one filter: calling two filter methods throws an error instead of keeping the last one. In the same way, `url()` with `email()` and `hidden()` with `hideable(false)` are errors.
- `searchable()` exists in text, number and option columns: the global search compares text, which says nothing useful about dates or booleans.
- The unit of `unit('kg')` goes after the number in the cells and next to the filter inputs (`unit('kg', cell: false)` or `filter: false` hides it on one side); with `money()`, the cells and the filter inputs show the currency symbol before the number (`$1.200`, `[ $ | 1200 ]`), in any locale; `money('CLP', cell: 'code', filter: 'none')` chooses separately for the cells (and the filter label) and the inputs: `symbol`, `code` (`1.200 CLP`, `[ 1200 | CLP ]`), `both` (`$1.200 CLP`, `[ $ | 1200 | CLP ]`, clearer when `$` could be more than one currency) or `none`. In the cells, the code and the unit are smaller and muted. `unit()` together with `money()` or `percent()` is an error, since they already say the unit.
- An option column shows the labels of its declared options even without a filter; with a filter, the options carry the row counts.
- Numbers and dates use the table locale (see [Language and formats](#language-and-formats)); `money()` without a currency uses `inertia-datatable.currency`, and dates without `format()` use `inertia-datatable.date_format`.
- Dates without time (Laravel `date` casts) never move to the previous day.
- `badge()` uses the project's shadcn `Badge` with any variant of its `badge.tsx` (`outline` by default), for the column and per value. In boolean columns the values are `true` and `false`; without `labels()`, booleans show Yes / No in the app language.
- With `options(Enum::class)`, the enum can give the label (`label()`) and the badge variant (`badgeVariant()`) of each case, so every table that uses it looks the same: `Column::option('status')->options(ProductStatus::class)->badge()`. A variant passed to `badge('…', [...])` wins.
- In the React component you can set or override the format (`meta: { display: … }`), add icons per value (`meta: { icons: { active: CircleCheck } }`, shown in the filter and in the cells of option and boolean columns) or write a custom `cell` that reuses the type cells (`DataTableNumberCell`, `DataTableDateCell`, `DataTableOptionCell`…) to render a value differently while keeping its format. Option cells take `badge` (props of the same Badge per value) or `renderOption` (anything else, such as a colored dot), and `DataTableOptionBadge` is exported for fully custom cells. See the skill's React reference.
- Column width and classes also live in the React component: `size: 280` (px) or Tailwind classes, responsive too, in `meta: { className: 'w-40 md:w-80' }` (`headerClassName` / `cellClassName` for one of them; `cellClassName` can be a function of the cell for classes by value). Alignment is `meta.align` (`start`, `center` or `end`; numbers are `end` by default), which moves the header and the cells together. Row height and row colors go in `<DataTable headerClassName="[&>th]:h-8" rowClassName={(row) => …}>`.

### Language and formats

The defaults come from your Laravel app and each layer can change them; the most specific one wins.

| What | Order (first wins) |
|---|---|
| Locale of numbers, currencies and dates | `useServerDataTable({ locale })` → the table (`locale()` in the class, `->locale()` in `DataTable::for`) → `inertia-datatable.locale` → `app()->getLocale()` (`APP_LOCALE`) |
| UI texts (Search, Reset, Rows per page…) | `useServerDataTable({ messages })` → `lang/vendor/inertia-datatable/{lang}/ui.php` → the package texts (`en`, `es`) in the app language → English |
| Format of a column | your own `cell` → React `meta.display` → the column method (`->money()`, `->format()`…) → `inertia-datatable.currency` / `inertia-datatable.date_format` |

```php
// config/inertia-datatable.php
'locale' => null,         // null = app locale; 'es-CL', 'en-US'…; 'browser' = each browser's
'currency' => 'CLP',      // ->money() without a currency
'date_format' => 'long',  // date columns without ->format()
```

- The locale gives the separators: with `es` or `es-CL` a CLP amount shows `$1.234`, with `en` it shows `$1,234`. `es_CL` is accepted too.
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
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/v0.8.0/r/data-table-react.json
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
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/v0.8.0/r/data-table-skill.json
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
