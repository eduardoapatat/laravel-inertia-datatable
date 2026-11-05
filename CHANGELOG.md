# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/). While the version is 0.x, a minor version (0.2, 0.3…) may include breaking changes.

## [Unreleased]

## [0.4.0] - 2026-11-05

### Changed

- **Breaking:** the default locale of numbers and dates is the app locale (`app()->getLocale()`), not the browser's. Set `inertia-datatable.locale` to `'browser'` to keep the previous behaviour.

### Added

- Locale per table (`locale()` in the class, `->locale()` in `DataTable::for`) and in the React hook (`useServerDataTable({ locale })`); `es_CL` is accepted as `es-CL`.
- `inertia-datatable.currency` (default of `money()`) and `inertia-datatable.date_format` (default of `dateFormat()` and of date columns without a format).
- Every UI text is translatable with Laravel lang files (`en` and `es` included), sent in `config.messages` and publishable with `--tag=inertia-datatable-lang`; `useServerDataTable({ messages })` changes them per table.
- The date filter calendar uses the table locale (month and day names, first day of the week), and the filter chips and counts format numbers and dates with it.

## [0.3.0] - 2026-11-05

### Added

- Cell formatting declared on the column and applied with Intl: `money()`, `decimals()`, `percent()`, `numberFormat()`, `dateFormat()` (`short`, `medium`, `long`, `datetime`, `relative`), `limit()`, `url()`, `email()`, `booleanLabels()` and `badge()`. It travels in `config.columns[].display`, can be overridden in the React `meta.display`, and uses `inertia-datatable.locale` (or the browser locale).
- Type cells exported from `components/data-table/data-table-cells.tsx` (`DataTableNumberCell`, `DataTableDateCell`, `DataTableOptionCell`…) to render a value differently in a custom `cell` while keeping its format.
- Icons of the React `meta.options` are shown in the cells, not only in the filter.
- `make:datatable` proposes `decimals(N)` for `decimal:N` casts.

### Fixed

- Dates without time (Laravel `date` casts) no longer show the previous day west of Greenwich.

## [0.2.0] - 2026-11-05

### Added

- Column validation in debug mode (`inertia-datatable.validate_columns`): a sortable, searchable or filterable column that does not exist in its table, or a displayed column without a value in the model (typo, `$hidden`, accessor missing from `$appends`), fails on the first load with a clear message instead of a SQL error when someone sorts or filters.
- Docs on keeping the default formatting in custom cells (`getOptionLabel`, `formatCellValue`) and on readable URLs (`filter[status]=a,b`) with Inertia's `urlResolver()`.

### Fixed

- `make:datatable` types the React row as the values arrive in the JSON: `decimal` casts as `string`, and uncast `DECIMAL` and boolean columns as `number | string` and `boolean | number`.
- The date filter cuts long ranges on small screens instead of overflowing the toolbar.

## [0.1.0] - 2026-11-05

First published version: Laravel backend and React UI.

### Backend (Composer package)

- Table classes (`DataTable`) and the quick form `DataTable::for($query)`, with declarative columns (`Column`): sorting, global search, `text`, `number`, `range`, `date`, `dateRange`, `boolean`, `select` and `multiSelect` filters (also with enums), hidden and non-hideable columns.
- HTTP contract documented in `docs/contract.md`: pagination, multi-column sorting, filters with operators, search, column visibility and a per-table prefix to have several tables on one page. Invalid parameters are ignored and the response returns the normalized state.
- Facets with cross counts (each filter counts with the others applied) and range bounds.
- Columns from to-one relations (`belongsTo`, `hasOne`) to display, filter, sort and search, and child tables of a parent record.
- Stable ordering: the primary key always breaks ties, in the direction of the first sort.
- Works with SQLite, MySQL and Postgres.
- `php artisan make:datatable`: guesses the columns from the model (casts, schema, enums and relations) and, with `--react`/`--page`, generates the React component and page. Lists the available models when the given one does not exist.
- `php artisan inertia-datatable:ui [--update]`: installs or updates the UI from the registry of the same package version, without overwriting the project's `ui/` files. Can be changed with `INERTIA_DATATABLE_REGISTRY_URL`.

### React UI (shadcn registry)

- `useServerDataTable` hook on top of TanStack Table v9: the state lives in the URL and every change is a partial Inertia visit, with debounced text filters and search.
- The PHP class decides which columns are shown and in which order; the component only customizes cells or adds its own columns (actions, selection). Default cells by filter type.
- Toolbar with search, one filter per column (text, number, range, dates, Yes/No and faceted with counts), Reset and column menu, and pagination with the page sizes defined by the server.
- Exported pieces (`DataTableSearch`, `DataTableFilters`, `DataTableFilter`, `DataTableResetButton`, `DataTableViewOptions`, `DataTablePagination`) to change the layout in each table's component.

### Other

- Claude Code skill (`data-table-skill`) to install the package and create tables.
- CI: tests with PHP 8.3 to 8.5 and Laravel 12 and 13, MySQL and Postgres, rebuilt registry, and a real install in the React starter kit with npm and pnpm (also every week).

[Unreleased]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/releases/tag/v0.1.0
