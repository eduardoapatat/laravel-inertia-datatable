---
name: laravel-inertia-datatable
description: Build server-side data tables (pagination, sorting, filters, global search, column visibility) in Laravel + Inertia apps with the eduardoapatat/laravel-inertia-datatable package and its shadcn/TanStack Table React components. Use this skill whenever the user wants a table, list, index or admin page with paging, sorting, filtering or searching over Eloquent models in a Laravel + Inertia project (e.g. "users table with filters", "listado de productos con búsqueda y paginación", "add a datatable for orders"), mentions make:datatable, useServerDataTable, DataTable::for, data-table-react, or asks to install or extend this package, even if they never say "datatable".
---

# Laravel Inertia DataTable

Server-side tables for Laravel + Inertia. The backend package parses the query string, applies whitelisted sorting/filters/search with Eloquent and returns one Inertia prop; the React components (shadcn + TanStack Table v9) render it and turn every interaction into a partial Inertia visit. State lives in the URL, so reload, back/forward and shared links reproduce the same view.

Pieces:
- **Backend** (Composer): `InertiaDataTable\DataTable`, `Column`, `php artisan make:datatable`.
- **Frontend** (shadcn registry item `data-table-react`): `useServerDataTable` hook, `components/data-table/*`.

## Workflow

### 1. Check the project

Confirm it is Laravel + Inertia with React (`@inertiajs/react` in package.json, `resources/js/pages`) and find what is already installed:

- `composer show eduardoapatat/laravel-inertia-datatable` → backend installed?
- `resources/js/hooks/use-server-data-table.ts` exists → frontend installed?

Use the package manager of the lockfile (pnpm/npm/yarn/bun) for every JS command.

### 2. Install what is missing

Backend (only if missing):

```bash
composer require eduardoapatat/laravel-inertia-datatable
```

If Composer cannot find it, install it from GitHub: `composer config repositories.laravel-inertia-datatable vcs https://github.com/eduardoapatat/laravel-inertia-datatable` and then `composer require eduardoapatat/laravel-inertia-datatable:@dev`.

For local development of the package itself, use a `path` repository pointing to its folder instead of `vcs`.

Frontend (once per project):

```bash
php artisan inertia-datatable:ui
```

It installs the UI of the same version as the backend. Manual equivalent: `pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/v0.7.0/r/data-table-react.json`.

When the CLI asks to overwrite existing `components/ui/*` files, answer **no**: the table only needs variants the Laravel starter kits already have, and overwriting would change components the app already uses. In a non-interactive shell, pipe the answers: `yes n | pnpm dlx shadcn@latest add <url> -y`. `inertia-datatable:ui` already does this. Then run the project's type check and lint.

### 3. Create the table class (and its React component)

```bash
php artisan make:datatable ProductsTable --react --install-ui
```

- The model is guessed from the class name (`ProductsTable` → `App\Models\Product`); pass `--model=...` otherwise (a full class name works for models outside `app/Models`).
- Columns are proposed from the model casts and the DB schema, only with what is needed to show them (no sorting, filters or hiding; `searchable()` only on a `name` column, else `title`): strings, numbers, booleans, dates, backed enums (`Column::option()->options(Enum::class)`) and `belongsTo` relations (`category_id` → `Column::option('category')->from('category.name')`, only when `category()` declares its `BelongsTo` return type). Each column is created with the factory of its type (`Column::text()`, `number()`, `date()`, `boolean()`, `option()`), which only offers the format and filter methods of that type. Primary key, `$hidden` and sensitive columns are skipped.
- `--react` also writes `resources/js/components/data-tables/products-table.tsx`: a per-table component (row type, hook, toolbar) used as `<ProductsTable products={products} />` in any page. It declares no columns: the PHP class decides which columns are shown and in which order, and the component only customizes cells or adds client-only columns (`references/react.md`). `--page` additionally writes `resources/js/pages/products/index.tsx`, which only renders that component. Prefer `--react` when the page has more than the table (headers, tabs, several tables) and write the page by hand.
- `--install-ui` installs the shared UI (`components/data-table/*`, hook, libs) when the project does not have it yet, declining to overwrite existing `ui/` files; without it the command only prints the install command. You can skip step 2's frontend install when using this flag. The UI is installed even when the table class is not created (unknown model or existing class). When the model does not exist, the command lists the available models: pick one with `--model`. The registry it installs from is `inertia-datatable.registry_url` (env `INERTIA_DATATABLE_REGISTRY_URL`: a URL or a local folder with the compiled JSON).
- `--empty` skips the column guessing.

To install the shared UI on its own, or to update it later without touching the project's other `components/ui` files: `php artisan inertia-datatable:ui` / `php artisan inertia-datatable:ui --update`.

Then **review the generated columns with the user's intent in mind** — the guess is a starting point: remove columns nobody needs, add labels in the app's language, add `sortable()`, the filters the user needs (`filterInput()`, `filterRange()`, `filterSelect()`…) and formats such as `money()`, mark rarely used ones `->hidden()` and the identifying one `->hideable(false)`, set `defaultSort()`. The full `Column` API, relations, enums, parent-model tables and multiple tables per page are in `references/backend.md`.

### 4. Wire controller, route and page

```php
// app/Http/Controllers/ProductController.php
public function index(): Response
{
    return Inertia::render('products/index', [
        'products' => fn () => ProductsTable::make(),
    ]);
}
```

```php
Route::get('products', [ProductController::class, 'index'])->name('products.index');
```

The closure matters: partial reloads only resolve the table prop they ask for. The prop name (`products`) must match the `prop` passed to `useServerDataTable` on the page, otherwise filters reload nothing.

Follow the app's conventions for controllers, middleware (usually `auth`, `verified`), route names and navigation.

### 5. Test and verify

Write feature tests in the app's test style (see `references/testing.md`): authorization, one filter/sort/search case per behavior that matters, and facets if the page relies on counts. Then run the project's checks (tests, Pint, PHPStan, type check, lint/format) and build the assets (`pnpm run build`, or ask the user to run the dev server) before opening the page.

## Things that commonly go wrong

- **Only to-one relations** (`belongsTo`, `hasOne`) can be columns; a `hasMany` column throws a `LogicException` on purpose. Use a parent-model table instead (`references/backend.md`).
- **Filter/sort/search only work on declared columns.** Anything not declared with the matching capability is ignored by design (allow-list), not an error.
- **Columns must exist.** With `APP_DEBUG=true` (or `inertia-datatable.validate_columns`), the first load throws a `LogicException` when a sortable/searchable/filterable column is not a column of its table, or when a displayed column has no value in the model (typo, `$hidden`, accessor missing from `$appends`). Fix the column or the migration; values computed in PHP can only be displayed (accessor in `$appends`, `withCount`/`addSelect` alias or `transform()`).
- **Rows only contain visible columns.** Type row fields as optional in TypeScript and handle `undefined` in cells.
- **Layout is composed in JSX.** To move the search, filters, Reset, View menu or pagination, replace `<DataTableToolbar>` with its exported pieces in the per-table component (`references/react.md`, "Layout"); never edit `components/data-table/*` for that.
- **Columns and their order live in PHP.** Add, remove or reorder columns in `columns()`; do not mirror them in the React component unless a cell needs custom rendering.
- **Formats are declared on the column.** Currency, decimals, percentages, dates, cut texts, links, Yes/No labels and badges go in PHP (`Column::number(...)->money('CLP')`, `Column::date(...)->format('long')`…); do not reformat them by hand in React. To render a value differently, write a custom `cell` that reuses the type cells of `components/data-table/data-table-cells.tsx` (`references/react.md`).
- **Several tables on one page** need `name()` (query parameter prefix) and distinct prop names.
- **Encoded URLs** (`filter%5Bstatus%5D=a%2Cb`) come from Inertia (`$request->fullUrl()`), not from the package; for readable URLs add `urlResolver()` to `HandleInertiaRequests` (`references/react.md`, "Readable URLs").
- **Case-insensitive matching of non-ASCII letters** (`Á`/`á`) does not work on SQLite; it does on MySQL/PostgreSQL.

## References

- `references/backend.md` — `Column` API, relations, enums, parent-model tables, multiple tables, `transform`, config, URL contract.
- `references/react.md` — page structure, columns, cells, toolbar, custom meta/icons, multiple tables.
- `references/testing.md` — `assertInertia` patterns for tables.
