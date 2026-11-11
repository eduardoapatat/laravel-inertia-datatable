# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/). While the version is 0.x, a minor version (0.2, 0.3…) may include breaking changes.

## [Unreleased]

### Changed

- `make:datatable --react` and `--page` add the missing React component and page to a table class that already exists, without overwriting the class or the files it already has.

### Fixed

- The comments of `DatePreset`, the React component stub and the date cell referred to a `->dateFormat()` method that does not exist; the method is `->format()`.

## [0.9.1] - 2026-11-07

### Added

- With `validate_columns` (debug mode), `whenEmpty()` on a column that can never be empty throws, like `empty: true` (a `NOT NULL` column, or a `belongsTo` whose foreign key and related column are both `NOT NULL`). Tables with `transform()` are not checked.

### Changed

- Sorting by, or computing the facets of, a column on a `morphTo` relation throws a `LogicException`. It was never supported, and those values could come from rows outside the base query.

### Fixed

- A table whose base query is a `hasManyThrough`, `hasOneThrough`, `belongsToMany` or `morphToMany` relation only reads the columns of the related table. Before, the joined table overwrote the attributes of each row: the row id was the intermediate one, `hasOne` columns loaded the value of another record, and a `transform()` built on `toArray()` sent the attributes of the intermediate model, hidden ones included.
- The sort and the facets (options, counts, range) of a relation column apply the `where` constraints of the relation method, like the data, the filters and the search already did.
- A range facet whose minimum or maximum is not a finite number (SQLite stores an overflowing value such as `1e400` as Infinity) sends `null` for that bound instead of failing every response of the table.
- `make:datatable` leaves out the columns whose name is not a plain identifier and writes the generated literals with `var_export()`, so a column name can no longer add code to the generated PHP or TypeScript.
- Option cells, badges and facets ignore inherited keys of `meta.icons` and `display.variants`: a value such as `constructor` or `__proto__` no longer resolves to a member of `Object`.
- A numeric date out of the valid range is shown as text with the `relative` format too, instead of throwing during render.

## [0.9.0] - 2026-11-06

### Added

- `money('CLP', cell: 'both', filter: 'both')` shows the symbol before the number and the code after it (`$1.684.910 CLP`, `[ $ | 1200 | CLP ]`), for when `$` could be more than one currency.
- `unit('u.', cell: false)` or `unit('u.', filter: false)` hides the unit in the cells (and the filter label) or next to the filter inputs.
- Cells without a value (`null` or `''`) show a muted `—` instead of nothing (`empty` text of `lang/*/ui.php`, `DataTableEmptyCell`); `->whenEmpty('Not published')` changes it per column and `->whenEmpty('')` keeps them blank.
- `empty: true` in `filterSelect()`, `filterMultiSelect()`, `filterRange()` and `filterDate()` offers the rows without a value: the last option of the list, with its count, or an "Include …" check under the slider or the calendar (`DataTableEmptyFilter`). They are added with OR to what is picked, or shown alone, and are named after `whenEmpty()` or the new `no_value` text. With `validate_columns`, a `NOT NULL` column throws, and so does a `belongsTo` column whose foreign key and related column are both `NOT NULL`.
- Boolean filters accept `is.empty` and `not.is.empty` in the URL.

### Changed

- `is.empty` is combined with OR with the other filters of its column (`(between … AND …) OR IS NULL`); with AND that combination could never match a row.
- `getFilterAffix()` of `lib/data-table-format.ts` is now `getFilterAffixes()`, which returns a list (the symbol and the code can go on both sides), and the `affix` prop of `DataTableFilterInput` is now `affixes`.
- `make:datatable` only proposes the model's own columns: foreign keys (`category_id`) are left out instead of becoming relation columns (`from('category.name')`), which are added by hand.
- The number cells show the currency code (`cell: 'code'`) and the unit (`unit('kg')`) smaller and muted after the number (`data-slot="data-table-number-suffix"`). `formatNumberCell()` gives the number and that suffix apart, for custom cells.

## [0.8.0] - 2026-11-06

### Added

- `money('CLP', cell: …, filter: …)` chooses how the currency is shown in the cells (and the filter label) and next to the filter inputs, separately: `symbol` before the number (`$1.684.910`, `[ $ | 1200 ]`), `code` after it (`1.684.910 CLP`, `[ 1200 | CLP ]`) or `none`.

### Changed

- By default, `money()` shows the currency symbol before the number in any locale (`es` gave `1.684.910 CLP`, now `$1.684.910`), and the filter inputs show it before the value instead of the code after it. The locale still gives the separators. A `currencyDisplay` passed to `format()` keeps the plain Intl format.
- `getFilterUnit()` of `lib/data-table-format.ts` is now `getFilterAffix()`, which also says on which side the text goes.

## [0.7.1] - 2026-11-05

### Changed

- `make:datatable` only proposes what is needed to show the columns (type, relation path, enum labels, decimals): no `sortable()`, filters or `hideable(false)`, which are added by hand. `searchable()` goes on one column, `name` or else `title`. Relations are proposed when the method declares its `BelongsTo` return type.

## [0.7.0] - 2026-11-05

### Changed (breaking)

- Columns have a type: `Column::text()`, `Column::number()`, `Column::date()`, `Column::boolean()` and `Column::option()` replace `Column::make()`. Each type only offers the format and filter methods that make sense for its values, so combinations such as `->boolean()->money()` or `->dateRange()->badge()` no longer exist, and the IDE and PHPStan catch them.
- The filter methods are named after the control shown in the toolbar: `filterInput()`, `filterRange()`, `filterDate()`, `filterSelect()` and `filterMultiSelect()`.
- A column has one filter: calling two filter methods throws a `LogicException` instead of keeping the last one. `url()` with `email()`, and `hidden()` with `hideable(false)` (a column the user could never show), throw too.
- `config.columns[]` sends `display` always (its `type` is the column type) and `filter` (`null` or `{ variant, placeholder? }`) instead of `variant`, `placeholder` and `unit`; the unit moves to `display.unit`. Update the generic UI with `php artisan inertia-datatable:ui --update`.

Migration:

| Before | Now |
|---|---|
| `Column::make('name')->text('Search…')` | `Column::text('name')->filterInput('Search…')` |
| `Column::make('notes')->limit(60)` | `Column::text('notes')->limit(60)` |
| `Column::make('stock')->number('u.')` | `Column::number('stock')->unit('u.')->filterInput()` |
| `Column::make('price')->range(0, 100, '$')->money('USD')` | `Column::number('price')->money('USD')->filterRange(0, 100)` (the filter inputs end in `USD`) |
| `->numberFormat([...])` | `Column::number(...)->format([...])` |
| `Column::make('day')->date()` / `->dateRange()` | `Column::date('day')->filterDate()` / `->filterRange()` |
| `->dateFormat('long')` | `Column::date(...)->format('long')` |
| `Column::make('active')->boolean()->booleanLabels('Sí', 'No')` | `Column::boolean('active')->labels('Sí', 'No')->filterSelect()` |
| `Column::make('status')->select($options)` / `->multiSelect($options)` | `Column::option('status')->options($options)->filterSelect()` / `->filterMultiSelect()` |
| `->placeholder('…')` | the argument of `filterInput('…')` (text and number columns) |
| `->withCounts(false)` | `filterSelect(counts: false)` / `filterMultiSelect(counts: false)` |
| `->searchable()` on a date or boolean column | removed: the global search only covers text, number and option columns |
| `Column::make('total')` (no filter) | the factory of its type: `Column::number('total')` |
| `$column->filterVariant()` (reads the filter, does not add one) | `$column->variantOfFilter()`, internal; so typing `->filter` only offers the methods that add a filter |

### Added

- The inputs of number filters end in the currency code of `->money()` (`[ 1200 | CLP ]`, clearer than `$`, which several currencies use) or the unit of `->unit()`; the cells keep the format of the column (`$1.200`). The inputs of the range filter are as wide as its bounds.
- Option columns without a filter send the labels of their declared options, so the cells show `Archived` instead of `archived`.
- Date columns without `format()` use the `date_format` of the table.
- `meta.icons` in React gives an icon per value (`{ active: CircleCheck }`, or `true` / `false` in boolean columns) without repeating the labels, the filter variant or the badge variants of PHP. Boolean cells and the Yes / No filter show icons too.
- With `options(Enum::class)` and `badge()`, a `badgeVariant()` method on the enum gives the badge variant of each case, like `label()` gives its label.

## [0.6.1] - 2026-11-05

### Added

- The header and the cells of a column are aligned together with `meta.align` (`'start' | 'center' | 'end'`): number columns are aligned to the end by default, with their header, and get more room before the next column (`pe-8`). It is plain CSS, so nothing moves after the page loads. Columns that were right-aligned with `meta.className: 'text-right'` no longer need it.

### Changed

- The trigger of the range filter shows its bounds with the format of the column (`->money('CLP')` → `$10.000 - $900.000`); the unit is only added when the format has no currency or percentage.
- Cell content that does not fit ends in "…" (`text-ellipsis`) instead of being cut against the next column; `meta.cellClassName: 'text-clip'` undoes it in a column.

## [0.6.0] - 2026-11-05

### Added

- Tailwind classes per column in the React `meta`: `className` (header and cells), `headerClassName` and `cellClassName`, which can also be a function of the cell for classes by value (`(cell) => Number(cell.getValue()) < 100 && 'text-red-600'`). A width class (`w-40 md:w-80`) replaces the `size` width, so widths can be responsive.
- `<DataTable>` takes `headerClassName` and `rowClassName` (a string or a function of the row), for the row height (`[&>td]:py-1`) or to color rows by their data.

### Changed

- The column width is the `w-(--cell-size)` class instead of an inline style, and the table no longer has a `minWidth`: with `table-fixed` it grows to the sum of its columns.
- The header button is `inline-flex`, so it follows the alignment of its column (`meta.className: 'text-right'`).

## [0.5.0] - 2026-11-05

### Added

- `badge()` takes the variant of the column and of some values: `badge('secondary', ['archived' => 'destructive'])`, with any variant of the project's `badge.tsx` (`outline` by default). They travel in `display.variant` and `display.variants`. In boolean columns it adds up with `booleanLabels()` (in any order), and the values are `true` and `false`: `->boolean()->badge('secondary', ['true' => 'default', 'false' => 'destructive'])`.
- `DataTableOptionCell` accepts `badge` (props of the same Badge per value) and `renderOption` (draw each value with anything else), and `DataTableOptionBadge` is exported for fully custom cells.

### Changed

- The UI uses the project's shadcn components instead of Tailwind imitations: `Badge` in the option cells and in the selected values of the filters, `Checkbox` in the filter options, `Separator` in the calendar footer and `Label` in the pagination and the range filter. The `data-table-react` item now depends on `badge` and `checkbox`.

## [0.4.1] - 2026-11-05

### Changed

- Filter buttons have a dashed border, the filter options show a checkbox at the start and the count at the end (like the shadcn tasks example), and the sort check of the column menu is at the end. `components/ui/faceted.tsx` adds `FacetedItemCheckbox` and `FacetedItemCount`.

### Fixed

- The checkbox of the filter options stays visible on hover in any theme: its border comes from the item text color, not from `--input` (equal to the hover color in some dark themes).

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

[Unreleased]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.9.1...HEAD
[0.9.1]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/eduardoapatat/laravel-inertia-datatable/releases/tag/v0.1.0
