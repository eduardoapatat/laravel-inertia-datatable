# laravel-inertia-datatable

[![tests](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/tests.yml/badge.svg)](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/tests.yml)
[![starter kit](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/starter-kit.yml/badge.svg)](https://github.com/eduardoapatat/laravel-inertia-datatable/actions/workflows/starter-kit.yml)

Reusable DataTable for **Laravel + Inertia** with **React** or **Vue**, built on shadcn/ui (shadcn-vue in Vue) and TanStack Table, with pagination, sorting, filters, global search and column visibility **resolved on the server**. The state lives in the URL.

Requires PHP 8.3+, Laravel 12 or 13 and an app with Laravel's React or Vue starter kit.

## Installation

```bash
composer require eduardoapatat/laravel-inertia-datatable
php artisan inertia-datatable:ui            # the UI: components/data-table/*, the hook or composable and the libs
php artisan inertia-datatable:ui --update   # later, to bring the DataTable files of a new version
```

The UI comes from the shadcn registry of the same version as the package, for the framework of the Inertia adapter in `package.json` (`--react` or `--vue` force one). By hand:

```bash
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/v0.16.2/r/data-table-react.json
pnpm dlx shadcn-vue@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/v0.16.2/r/data-table-vue.json   # Vue
```

To install the package from GitHub or a local folder, add a `vcs` or `path` repository to `composer.json` and require `eduardoapatat/laravel-inertia-datatable:@dev`.

### Claude Code skill

So Claude Code knows how to install the package and create tables in your project (it goes in `.claude/skills/laravel-inertia-datatable/`):

```bash
pnpm dlx shadcn@latest add https://raw.githubusercontent.com/eduardoapatat/laravel-inertia-datatable/v0.16.2/r/data-table-skill.json
```

## Quick start

```bash
php artisan make:datatable ProductsTable --page   # the class, its component and a page (--react / --vue / --defer…)
```

The PHP class decides the columns, their order, their format and what can be sorted, searched and filtered:

```php
use InertiaDataTable\Column;

Column::text('name', 'Name')->sortable()->searchable()->filterInput(),
Column::number('price', 'Price')->sortable()->money('CLP')->filterRange(),
Column::date('published_at', 'Published')->format('long')->filterRange(empty: true),
Column::boolean('featured', 'Featured')->filterSelect(),
Column::option('status', 'Status')->options(ProductStatus::class)->badge()->filterMultiSelect(),
Column::option('category', 'Category')->from('category.name')->filterMultiSelect(),
```

| Type | Format | Filter |
|---|---|---|
| `Column::text()` | `limit()`, `url()` or `email()` | `filterInput()`: contains |
| `Column::number()` | `money()`, `decimals()`, `percent()`, `unit()`, `format([...])` | `filterInput()`: equal to; `filterRange()`: slider |
| `Column::date()` | `format(preset or Intl options)` | `filterDate()`: one day; `filterRange()`: from / to |
| `Column::boolean()` | `labels(true, false)`, `badge()` | `filterSelect()`: Yes or No |
| `Column::option()` | `options(list, map or enum)`, `badge()` | `filterSelect()`: one option; `filterMultiSelect()`: several |

The table component (React or Vue) only customizes cells or adds client-only columns, and every piece of the toolbar and the pagination can go anywhere in the page.

### Readable URLs

Inertia encodes brackets and commas in the URL (`filter%5Bstatus%5D=a%2Cb`). For readable URLs, add this to the app's `HandleInertiaRequests` (it affects every Inertia page, so the package does not do it by itself):

```php
public function urlResolver(): ?Closure
{
    return fn (Request $request): string => $request->getRequestUri();
}
```

## Documentation

- [`SKILL.md`](skill/laravel-inertia-datatable/SKILL.md): the workflow, from installing to a tested table.
- [Backend](skill/laravel-inertia-datatable/references/backend.md): table classes, every column method, relations, configuration, language and formats.
- [React](skill/laravel-inertia-datatable/references/react.md) and [Vue](skill/laravel-inertia-datatable/references/vue.md): the hook or composable, cells, layout and every component.
- [Tests](skill/laravel-inertia-datatable/references/testing.md) of the tables in your app.
- [`docs/contract.md`](docs/contract.md): the HTTP contract between client and server (URL, response, normalization).
- [`CHANGELOG.md`](CHANGELOG.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md) (development, CI and releases).

## Credits

Part of the frontend code includes third-party MIT-licensed software; see [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).
