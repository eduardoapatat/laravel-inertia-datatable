# Backend reference

## Contents
- Table classes and the quick form
- `Column` API
- Relations, enums and options
- Tables scoped to a parent model
- Several tables on one page
- Shaping rows
- Configuration
- URL contract (query string)

## Table classes and the quick form

One class per table (what `make:datatable` generates):

```php
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;

class ProductsTable extends DataTable
{
    public function query(): Builder               // any Builder or Relation
    {
        return Product::query()->where('archived', false);
    }

    public function columns(): array
    {
        return [
            Column::text('name', 'Name')->sortable()->searchable()->filterInput()->hideable(false),
            Column::number('price', 'Price')->sortable()->money('USD')->filterRange(),
        ];
    }

    public function defaultSort(): ?string { return '-created_at'; } // "-" = descending
    public function perPage(): int { return 25; }
    public function perPageOptions(): array { return [25, 50, 100]; }
    public function name(): ?string { return null; }                // query prefix, see below
    public function alwaysInclude(): ?array { return null; }        // keys kept in every row (default: primary key)
}
```

`ProductsTable::make()` resolves the class from the container, so constructors can receive dependencies and named arguments: `ProductsTable::make(store: $store)`.

Quick form for one-off tables (same features, no class):

```php
DataTable::for(User::query())
    ->columns([Column::text('name')->sortable()->searchable()])
    ->defaultSort('name')
    ->perPage(20)->perPageOptions([20, 50])
    ->name('users')
    ->transform(fn (User $user) => [...]);
```

Both are `Arrayable` (Inertia prop) and `Responsable` (return them from a route to get JSON).

## `Column` API

Every column is created with the factory of its type: `Column::text()`, `Column::number()`, `Column::date()`, `Column::boolean()` or `Column::option()` (`string $id, ?string $label = null`). `$id` is the public name used in the URL and in each row; label defaults to the headline of the id. The type decides how the cells look and which filters exist, so each one only has the methods that make sense (a date has no `money()`). `Column::make()` no longer exists.

Methods of every type:

| Method | Effect |
|---|---|
| `from('attribute')` / `from('relation.attribute')` | Read the value from another attribute or a to-one relation |
| `sortable()` | Allowed in `sort` |
| `hideable(false)` | Always visible (use for the column that identifies the row); cannot be combined with `hidden()` |
| `hidden()` | Hidden by default; the user can show it |
| `whenEmpty('Not published')` | Text of the cells without a value (`null` or `''`); without it, a muted `—` (the `empty` UI text); `''` leaves them blank |

Format (only changes how cells look; the row keeps the raw value and the UI formats with Intl and the table locale, see Configuration) and filter of each type:

| Type | Format | Filter |
|---|---|---|
| `Column::text()` | `limit(60)` (full text in the tooltip), `url()` (only http/https) or `email()` (mailto) | `filterInput(?placeholder)`: text input, contains |
| `Column::number()` | `money('CLP', decimals: 0, cell: 'symbol', filter: 'symbol')` (ISO 4217; `money()` uses `inertia-datatable.currency`; `cell` = cells and filter label, `filter` = next to the filter inputs: `symbol` before the number (default), `code` after it, smaller and muted in the cells, `both` (`$1.200 CLP`) or `none`), `decimals(2)`, `percent()` (`0.25` → `25 %`), `format(['notation' => 'compact'])` (any Intl.NumberFormat option), `unit('kg', cell: true, filter: true)` (smaller and muted in the cells; `cell: false` or `filter: false` hides it on one side); they add up | `filterInput(?placeholder)`: number input, equal to; `filterRange(?min, ?max)`: slider with from / to inputs, without bounds the server computes them |
| `Column::date()` | `format('long')`: `short`, `medium`, `long`, `datetime`, `relative` ("3 days ago") or Intl.DateTimeFormat options; without it, `inertia-datatable.date_format`. Dates without time never move a day | `filterDate()`: calendar, one day (`YYYY-MM-DD`); `filterRange()`: calendar, from / to |
| `Column::boolean()` | `labels('Active', 'Inactive')` (without it, Yes / No in the app language), `badge()` with values `true` / `false` (also 1 / 0) | `filterSelect()`: list, Yes or No |
| `Column::option()` | `options($options)`: list, `value => label` map or backed enum class (without it the filter offers the distinct values from the DB); `badge()` | `filterSelect()`: list, one option; `filterMultiSelect()`: list, several; `counts: false` skips the count query |

- A column without a filter method is not filterable; a column without `sortable()` is not sortable.
- `searchable()` (text, number and option columns only): included in the global search; every word must match some searchable column.
- The name of each filter method says the control in the toolbar; the URL also accepts the other operators of its variant (`filter[stock]=gt.100`, `between.10,50`, `is.empty`…, see `docs/contract.md` §1.4).
- One filter per column: calling two filter methods (`->filterInput()->filterRange()`) throws a `LogicException`. `url()` with `email()` and `hidden()` with `hideable(false)` throw too.
- `unit()` goes after plain numbers in the cells and next to the filter inputs. It cannot be combined with `money()` or `percent()` (`InvalidArgumentException`): `money()` already shows the currency in the cells and the filter inputs.
- `badge()` / `badge('secondary', ['archived' => 'destructive'])` shows the labels with the project's shadcn `Badge` (and the icons of the React `meta.icons`): the column variant (`outline` by default) and a variant per value; any variant of the project's `badge.tsx`. `badge(false)` = plain labels.
- An option column without a filter still sends the labels of its declared options, so the cells show `Archived` instead of `archived`.

`make:datatable` proposes `decimals(N)` for `decimal:N` casts; it never guesses a currency.

## Relations, enums and options

```php
Column::option('category', 'Category')->from('category.name')->sortable()->searchable()->filterMultiSelect(),
Column::option('status', 'Status')->options(OrderStatus::class)->badge()->filterMultiSelect(),
```

- Relations: one level, to-one only (`belongsTo`, `hasOne`, `morphOne`, `hasOneThrough`). The relation is eager loaded automatically and the row gets the flat value under the column id (`"category": "Books"`). Sorting uses a correlated subquery, filtering uses `whereHas`.
- Enums: labels come from a `label()` method on the enum when it exists, otherwise from the case name; with `badge()`, the variant of each value comes from a `badgeVariant()` method when it exists (the map passed to `badge()` wins). Keep icons in React (`meta.icons`): they are components, not data. The cast on the model makes rows serialize the enum value.
- Facet counts are crossed: each option counts rows with every other filter and the search applied, except its own column's filter.

## Tables scoped to a parent model

For "the orders of this customer" use a table whose query starts from the relation. The quickest way: generate it (`php artisan make:datatable CustomerOrdersTable --model=Order`), then add the constructor, return the relation from `query()` and drop the column that points back to the parent (every row has the same customer).

```php
class CustomerOrdersTable extends DataTable
{
    public function __construct(private readonly Customer $customer) {}

    public function query(): HasMany
    {
        return $this->customer->orders();
    }

    public function columns(): array { /* ... */ }
}

// controller
return Inertia::render('customers/show', [
    'customer' => $customer,
    'orders' => fn () => CustomerOrdersTable::make(customer: $customer),
]);
```

## Several tables on one page

Give each table a `name()`; its parameters get a prefix (`orders_page`, `orders_filter[status]`…), so the tables do not share state. Use distinct prop names and pass each one to its own `useServerDataTable` call. The frontend reads the effective parameter names from the response, nothing else to configure.

## Shaping rows

By default each row holds the visible columns plus `alwaysInclude()` keys, taken from the model's `toArray()` (respects `$hidden`, casts, date format). Override `transform(Model $model): array` (class) or pass `->transform(fn ...)` (quick form) to return a custom array — extra keys such as URLs are kept; keys of hidden columns are removed.

Never expose attributes only because a column exists: `$hidden` still applies to the default rows.

## Configuration

`php artisan vendor:publish --tag=inertia-datatable-config` → `config/inertia-datatable.php`: query parameter names, default `per_page` and options, `max_sorts`, `max_filters`, `max_search_length`, `validate_columns`, and the language and formats. Stubs for `make:datatable`: `--tag=inertia-datatable-stubs`.

Language and formats (defaults from the app; the most specific layer wins):

- Locale of numbers and dates: React `useServerDataTable({ locale })` → the table (`public function locale(): ?string` in the class, `->locale('es-CL')` in the quick form) → `inertia-datatable.locale` → `app()->getLocale()`. `'browser'` at any level = the browser's. Use a locale with a region (`es-CL`, not `es`) for local currency symbols.
- `inertia-datatable.currency`: default of `money()`. `inertia-datatable.date_format`: default of date columns without `format()`.
- UI texts follow the app language (`en` and `es` included, English fallback). To translate or change them: `php artisan vendor:publish --tag=inertia-datatable-lang` → `lang/vendor/inertia-datatable/{lang}/ui.php`; never edit the React components for this.

## URL contract (query string)

| Parameter | Example | Notes |
|---|---|---|
| `page` | `page=2` | Clamped to the last page |
| `per_page` | `per_page=20` | Must be one of the options, else the default |
| `sort` | `sort=-created_at,name` | Multi-sort; `-` = descending |
| `filter[col]` | `filter[status]=active,draft` | `[operator.]value`; implicit operator per variant |
| `filter[col][]` | `filter[price][]=gte.10&filter[price][]=lte.50` | Several filters on one column (AND) |
| `search` | `search=ana perez` | Global search |
| `columns` | `columns=name,email` | Visible columns |

Operators: `ilike`, `not.ilike`, `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `between`, `in`, `not.in`, `is.empty`, `not.is.empty`. Negations include rows without a value. Invalid values are ignored and the normalized state is returned, never a 400.
