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
            Column::make('name', 'Name')->sortable()->searchable()->text()->hideable(false),
            Column::make('price', 'Price')->sortable()->range(unit: '$'),
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
    ->columns([Column::make('name')->sortable()->searchable()])
    ->defaultSort('name')
    ->perPage(20)->perPageOptions([20, 50])
    ->name('users')
    ->transform(fn (User $user) => [...]);
```

Both are `Arrayable` (Inertia prop) and `Responsable` (return them from a route to get JSON).

## `Column` API

`Column::make(string $id, ?string $label = null)` — `$id` is the public name used in the URL and in each row; label defaults to the headline of the id.

| Method | Effect |
|---|---|
| `from('attribute')` / `from('relation.attribute')` | Read the value from another attribute or a to-one relation |
| `sortable()` | Allowed in `sort` |
| `searchable()` | Included in the global search (every word must match some searchable column) |
| `hideable(false)` | Always visible (use for the column that identifies the row) |
| `hidden()` | Hidden by default; the user can show it |
| `placeholder('...')` | Placeholder of the toolbar filter |
| `text()` | Text filter (`contains` by default) |
| `number(unit: '$')` | Numeric filter with operators |
| `range(min: 0, max: 100, unit: '$')` | Range slider; without min/max the server computes them |
| `date()` / `dateRange()` | Date filter (`YYYY-MM-DD`) |
| `boolean()` | Yes/No filter |
| `select($options)` / `multiSelect($options)` | Options with counts; `$options` = list, `value => label` map, backed enum class or `null` (distinct values from the DB) |
| `withCounts(false)` | Skip the count query of a select column |

A column without a filter method is not filterable; a column without `sortable()` is not sortable.

## Relations, enums and options

```php
Column::make('category', 'Category')->from('category.name')->sortable()->searchable()->multiSelect(),
Column::make('status', 'Status')->multiSelect(OrderStatus::class),
```

- Relations: one level, to-one only (`belongsTo`, `hasOne`, `morphOne`, `hasOneThrough`). The relation is eager loaded automatically and the row gets the flat value under the column id (`"category": "Books"`). Sorting uses a correlated subquery, filtering uses `whereHas`.
- Enums: labels come from a `label()` method on the enum when it exists, otherwise from the case name. The cast on the model makes rows serialize the enum value.
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

`php artisan vendor:publish --tag=inertia-datatable-config` → `config/inertia-datatable.php`: query parameter names, default `per_page` and options, `max_sorts`, `max_filters`, `max_search_length`. Stubs for `make:datatable`: `--tag=inertia-datatable-stubs`.

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
