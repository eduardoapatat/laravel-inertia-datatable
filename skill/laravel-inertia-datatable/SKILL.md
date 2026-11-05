---
name: laravel-inertia-datatable
description: Build server-side data tables (pagination, sorting, filters, global search, column visibility) in Laravel + Inertia apps with the eduardoapatat/laravel-inertia-datatable package and its shadcn/TanStack Table React components. Use this skill whenever the user wants a table, list, index or admin page with paging, sorting, filtering or searching over Eloquent models in a Laravel + Inertia project (e.g. "users table with filters", "listado de productos con búsqueda y paginación", "add a datatable for orders"), mentions make:datatable, useServerDataTable, DataTable::for, data-table-react, or asks to install or extend this package, even if they never say "datatable".
---

# Laravel Inertia DataTable

Server-side tables for Laravel + Inertia. The backend package parses the query string, applies whitelisted sorting/filters/search with Eloquent and returns one Inertia prop; the React components (shadcn + TanStack Table v9) render it and turn every interaction into a partial Inertia visit. State lives in the URL, so reload, back/forward and shared links reproduce the same view.

Pieces:
- **Backend** (Composer): `EduardoApatat\InertiaDataTable\DataTable`, `Column`, `php artisan make:datatable`.
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
composer config repositories.laravel-inertia-datatable vcs https://github.com/eduardoapatat/laravel-inertia-datatable
composer require eduardoapatat/laravel-inertia-datatable:@dev
```

For local development of the package itself, use a `path` repository pointing to its folder instead of `vcs`.

Frontend (once per project):

```bash
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/main/r/data-table-react.json
```

When the CLI asks to overwrite existing `components/ui/*` files, answer **no**: the table only needs variants the Laravel starter kits already have, and overwriting would change components the app already uses. In a non-interactive shell, pipe the answers: `yes n | pnpm dlx shadcn@latest add <url> -y`. Then run the project's type check; if `components/ui/command.tsx` fails because `DialogContent` has no `showCloseButton` prop, the app has an old `dialog.tsx` — update it with `pnpm dlx shadcn@latest add dialog --overwrite` after telling the user.

### 3. Create the table class (and its React component)

```bash
php artisan make:datatable ProductsTable --react --install-ui
```

- The model is guessed from the class name (`ProductsTable` → `App\Models\Product`); pass `--model=...` otherwise (a full class name works for models outside `app/Models`).
- Columns are proposed from the model casts and the DB schema: strings (searchable, sortable), numbers, booleans, dates, backed enums (`multiSelect(Enum::class)`) and `belongsTo` relations (`category_id` → `from('category.name')`). Primary key, `$hidden` and sensitive columns are skipped.
- `--react` also writes `resources/js/components/data-tables/products-table.tsx`: a per-table component (row type, columns, hook, toolbar) used as `<ProductsTable products={products} />` in any page. `--page` additionally writes `resources/js/pages/products/index.tsx`, which only renders that component. Prefer `--react` when the page has more than the table (headers, tabs, several tables) and write the page by hand.
- `--install-ui` installs the shared UI (`components/data-table/*`, hook, libs) when the project does not have it yet, declining to overwrite existing `ui/` files; without it the command only prints the install command. You can skip step 2's frontend install when using this flag.
- `--empty` skips the column guessing.

Then **review the generated columns with the user's intent in mind** — the guess is a starting point: remove columns nobody needs, add labels in the app's language, mark rarely used ones `->hidden()`, set `defaultSort()`. The full `Column` API, relations, enums, parent-model tables and multiple tables per page are in `references/backend.md`.

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
- **Rows only contain visible columns.** Type row fields as optional in TypeScript and handle `undefined` in cells.
- **Several tables on one page** need `name()` (query parameter prefix) and distinct prop names.
- **Case-insensitive matching of non-ASCII letters** (`Á`/`á`) does not work on SQLite; it does on MySQL/PostgreSQL.

## References

- `references/backend.md` — `Column` API, relations, enums, parent-model tables, multiple tables, `transform`, config, URL contract.
- `references/react.md` — page structure, columns, cells, toolbar, custom meta/icons, multiple tables.
- `references/testing.md` — `assertInertia` patterns for tables.
