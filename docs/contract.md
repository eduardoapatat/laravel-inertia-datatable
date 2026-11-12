# DataTable HTTP contract

This document defines how the frontend (shadcn DataTable on top of TanStack Table, in React or Vue) and the backend (the `eduardoapatat/laravel-inertia-datatable` package) communicate.

Principles:

- **The server is the source of truth.** Pagination, sorting, filters, global search and column visibility are resolved on the server. TanStack Table works in manual mode (`manualPagination`, `manualSorting`, `manualFiltering`).
- **The state lives in the URL.** The whole table state is serialized in the query string, so reloading or sharing the link reproduces the same view. Changing the page adds a history entry; filters, search and sorting replace the current one (see "Visits").
- **Allowlists.** Sorting, filtering, searching and displaying are only possible on columns declared on the server. Names coming from the request are never interpolated into SQL.
- **Normalize, don't fail.** An invalid value (column not allowed, `per_page` outside the list, nonexistent page…) is ignored or corrected; it does not return 400. The response includes the normalized state so the client rehydrates with what was actually applied.
- **Convention compatible with spatie/laravel-query-builder** (`sort=-col`, `filter[col]=a,b`), in case migrating ever makes sense.

---

## 1. Request

A `GET` request to the page route (Inertia) or to a JSON endpoint. All parameters are optional.

| Parameter | Example | Meaning |
|---|---|---|
| `page` | `page=3` | Page, 1-based |
| `per_page` | `per_page=20` | Page size |
| `sort` | `sort=-created_at,name` | Sorting, accepts several columns |
| `filter[<col>]` | `filter[status]=active,pending` | Column filter |
| `search` | `search=ana perez` | Global search |
| `columns` | `columns=name,email,status` | Visible columns |

Full example:

```
/users?page=2&per_page=20&sort=-created_at,name&filter[status]=active,pending&filter[role]=admin&search=ana&columns=name,email,status
```

### 1.1 `page`

- Integer ≥ 1. Defaults to `1`.
- Not numeric or < 1 → `1`.
- Greater than the last page → the last page is used (`meta` and `state` reflect the actual page).

### 1.2 `per_page`

- Must be in the table's `perPageOptions` (by default `[10, 20, 30, 50]`). If it is not → the table's default value (by default `10`).
- It is a closed list, not a maximum, to prevent `per_page=100000`.

### 1.3 `sort`

- Comma-separated list; the `-` prefix means descending: `sort=-created_at,name`.
- The order is respected (priority from left to right).
- `-created_at` (the spatie and JSON:API convention) is used instead of `created_at.desc`. `registry/shared` translates it from the TanStack state.
- Columns that are not `sortable`, duplicates and anything beyond `maxSorts` (by default 3) are dropped.
- With no valid sort → the table's `defaultSort` is applied, if any.
- Rows without a value (`NULL`) go first ascending and last descending on every database (Postgres would put them the other way around by itself).
- The primary key is always added as the final tiebreaker (unless already present), so pagination is stable. It follows the direction of the first criterion: `sort=-created_at` → `created_at desc, id desc`.
- `state.sorting` reflects **only the explicitly requested sort** (empty if the default was used); the default one is reported in `config.default_sorting`. This way the client does not write into the URL a sort the user did not choose.

### 1.4 `filter[<col>]`

Only columns declared as filterable. The filter model is the one of the frontend DataTable components (variants + operators): faceted filter, range/slider, date filter, filter menu and sort menu.

#### Syntax

```
filter[<col>]=[<operator>.]<value>
```

- **Without an operator** the variant's implicit operator is applied: `filter[status]=active,pending` = `filter[status]=in.active,pending`.
- **Lists** are comma-separated. A value containing a comma, quotes or leading/trailing spaces goes in double quotes, with inner quotes doubled: `filter[name]=in."Pérez, Ana",Luis`.
- **Several filters on the same column** use the array form and are combined with AND: `filter[price][]=gte.10&filter[price][]=lte.100`. The exception is `is.empty`, which adds the rows without a value with OR: `filter[published_at][]=between.2026-01-01,2026-03-31&filter[published_at][]=is.empty` → `(published_at BETWEEN … AND …) OR published_at IS NULL` (with AND it could never match a row).
- If the prefix is not a valid operator for the variant, the whole text is taken as the value with the implicit operator (`filter[email]=foo.bar` searches for "foo.bar"). To avoid ambiguity, the client writes the explicit operator when the value starts with an operator name.
- Operator names are case-insensitive and accepted in two forms: URL name (`neq`, `not.in`) or key (`ne`, `notInArray`).

#### Variants and operators

| Variant | Implicit operator | Operators (URL name) | Value |
|---|---|---|---|
| `text` | `ilike` | `ilike`, `not.ilike`, `eq`, `neq`, `is.empty`, `not.is.empty` | text |
| `number` | `eq` | `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `between`, `is.empty`, `not.is.empty` | number (`.` decimal) |
| `range` | `between` | same as `number` | `min,max`; one end may be empty (`10,` / `,100`) |
| `date` | `eq` | `eq`, `neq`, `lt`, `gt`, `lte`, `gte`, `between`, `is.empty`, `not.is.empty` | `YYYY-MM-DD` |
| `date-range` | `between` | same as `date` | `from,to` (`YYYY-MM-DD`) |
| `boolean` | `eq` | `eq`, `neq`, `is.empty`, `not.is.empty` | `true` / `false` |
| `select` | `in` | `in`, `eq`, `neq`, `is.empty`, `not.is.empty` | value or list |
| `multi-select` | `in` | `in`, `not.in`, `is.empty`, `not.is.empty` | list |

#### Translation to SQL

| Operator | SQL |
|---|---|
| `ilike` / `not.ilike` | Case-insensitive `LIKE %value%` (`ILIKE` in PostgreSQL, with the column cast to text), escaping `%`, `_` and `\` |
| `eq` / `neq` | `=` / `<>`; in `date` it compares the whole day (`whereDate`); in `text` it is case-insensitive |
| `lt` `lte` `gt` `gte` | comparison; in `date` by day (`lte` 2026-01-31 includes that whole day) |
| `between` | both ends inclusive; with one empty end it is equivalent to `gte` / `lte` |
| `in` / `not.in` | `whereIn` / `whereNotIn` |
| `is.empty` / `not.is.empty` | `IS NULL` (or `''` in `text`) / the opposite |

- Negations (`not.ilike`, `neq`, `not.in`) include rows without a value (`NULL`): "is not X" also holds for what has no value. On relation columns they include rows without the relation.
- "Case-insensitive" depends on the database: in MySQL/MariaDB (`_ci` collation) and PostgreSQL (`ILIKE`, `lower()`) it works with any letter; in SQLite only with ASCII letters (`Á` ≠ `á`).

#### Normalization

- A filter without a value (except `is.empty` / `not.is.empty`) is ignored: `filter[status]=` = no filter.
- A text value is cut at 255 characters.
- A value that does not match the variant (`filter[price]=abc`, invalid date, boolean other than `true`/`false`) drops that filter.
- `between` with `min > max` swaps the ends.
- In `select` / `multi-select` with declared options, values not in the list are dropped.
- Columns from `belongsTo` / `hasOne` relations are filtered the same way (see §5).

#### Phases

- **Phase 1:** all the variants and operators in the table, several filters per column, AND combination (OR for `is.empty` within its column).
- **Future phase:** `join=or` (combine filters with OR, used by the advanced filter menu; the parameter name is reserved), the `rel` operator (dates relative to today) and to-many relations (`hasMany`, `belongsToMany`).

### 1.5 `search`

- It is trimmed (`trim`). If it ends up empty, there is no search. Maximum length: 100 characters (the excess is cut). At most 10 distinct words are used; the rest are ignored.
- It is split into words: **each word** must match in **some** `searchable` column: `(name LIKE %ana% OR email LIKE %ana%) AND (name LIKE %perez% OR email LIKE %perez%)`.
- It is a case-insensitive `LIKE %word%` (`ILIKE` in PostgreSQL) that escapes `%`, `_` and `\`.
- It maps 1:1 to TanStack's `globalFilter`; that is why it is a top-level parameter and not `filter[search]`.

### 1.6 `columns`

- Comma-separated list of the **visible** columns.
- Missing → default visibility (each column declares whether it is visible by default).
- Unknown columns are ignored; non-hideable ones (`hideable: false`) are always shown.
- `data` rows do not include the keys of hidden columns (see §2.2). Showing a hidden column means requesting it from the server again.
- A list of visible columns (not hidden ones) is used so that columns hidden by default can be shown.

### 1.7 Several tables on the same page

Each table can have a name used as the prefix of its parameters:

```
/dashboard?users_page=2&users_sort=-name&orders_filter[status]=paid
```

The effective names are returned in `config.query`, so the client never infers them on its own. The base names (`page`, `per_page`, …) can be changed in `config/inertia-datatable.php`.

---

## 2. Response

The backend returns an object that works as an **Inertia prop** or as a **JSON response** (it implements `Arrayable`, `JsonSerializable` and `Responsable`).

```php
return Inertia::render('users/index', [
    'users' => fn () => UsersTable::make(),
]);
```

Inertia converts the object with `toArray()` (it is `Arrayable`). Using a closure avoids resolving the table when a partial reload does not request it (`router.get(url, {}, { only: ['users'] })`).

`config()` returns only the `config` key of the response (2.1) without running any query, not even the column validation. It is meant for a deferred first load: the table goes in `Inertia::defer(fn () => UsersTable::make())` and its config in another prop, so the frontend draws a skeleton with the real columns while the data arrives.

### 2.1 Shape

```json
{
  "data": [
    { "id": 41, "name": "Ana Pérez", "email": "ana@example.com", "status": "active" }
  ],
  "meta": {
    "current_page": 2,
    "per_page": 20,
    "last_page": 9,
    "total": 172,
    "from": 21,
    "to": 40
  },
  "state": {
    "pagination": { "pageIndex": 1, "pageSize": 20 },
    "sorting": [ { "id": "created_at", "desc": true }, { "id": "name", "desc": false } ],
    "columnFilters": [
      { "id": "status", "filterId": "status-0", "variant": "multi-select", "operator": "inArray", "value": ["active", "pending"] },
      { "id": "email", "filterId": "email-0", "variant": "text", "operator": "iLike", "value": "gmail" },
      { "id": "price", "filterId": "price-0", "variant": "range", "operator": "isBetween", "value": ["10", "100"] }
    ],
    "globalFilter": "ana",
    "columnVisibility": { "name": true, "email": true, "status": true, "role": false, "created_at": false }
  },
  "facets": {
    "status": [
      { "value": "active", "label": "Active", "count": 120 },
      { "value": "pending", "label": "Pending", "count": 31 },
      { "value": "inactive", "label": "Inactive", "count": 0 }
    ],
    "role": [
      { "value": "admin", "label": "admin", "count": 4 }
    ],
    "price": { "min": 0, "max": 2490 }
  },
  "config": {
    "columns": [
      { "id": "name", "label": "Name", "sortable": true, "hideable": false, "visible": true, "display": { "type": "text" }, "filter": null },
      { "id": "email", "label": "Email", "sortable": true, "hideable": true, "visible": true, "display": { "type": "text" }, "filter": { "variant": "text", "placeholder": "Search email…" } },
      { "id": "status", "label": "Status", "sortable": false, "hideable": true, "visible": true, "display": { "type": "option" }, "filter": { "variant": "multi-select" } },
      { "id": "price", "label": "Price", "sortable": true, "hideable": true, "visible": true, "display": { "type": "number", "format": { "style": "currency", "currency": "USD" } }, "filter": { "variant": "range" } }
    ],
    "searchable": true,
    "locale": "es-CL",
    "date_format": "long",
    "messages": { "search": "Buscar...", "page_of": "Página :page de :pages", "...": "..." },
    "per_page": 10,
    "per_page_options": [10, 20, 30, 50],
    "default_sorting": [ { "id": "created_at", "desc": true } ],
    "query": {
      "page": "page", "per_page": "per_page", "sort": "sort",
      "filter": "filter", "search": "search", "columns": "columns"
    }
  }
}
```

### 2.2 `data`

Rows of the current page:

- **Without `transform`:** only the visible columns plus the fixed keys (`alwaysInclude`, by default the primary key). Each value comes from the model's `toArray()` (it respects `$hidden`, casts and date format); relation columns are flattened under their id.
- **With `transform`:** whatever the class's `transform()` method or the `->transform()` closure returns, removing the keys of hidden columns except the fixed ones (`alwaysInclude`, by default the primary key). Keys that are not columns (for example `url`) are kept.

### 2.3 `meta`

Same as Laravel's `LengthAwarePaginator` (in snake_case). `from` and `to` are `null` when there are no results.

### 2.4 `state`

The **normalized and applied** state, with the TanStack Table v9 shapes (`PaginationState`, `SortingState`, `ColumnFiltersState`, `globalFilter`, `VisibilityState`) so it can be passed to the table as is. `pageIndex` is 0-based (`page - 1`).

Each `columnFilters` item has the frontend's `ColumnFilterItem` shape: `id`, `filterId` (`<id>-<index>`), `variant`, `operator` (operator key: `iLike`, `notILike`, `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `isBetween`, `inArray`, `notInArray`, `isEmpty`, `isNotEmpty`) and `value` (`string` or `string[]`, always as text, just like in the URL).

### 2.5 `facets`

Data the client cannot compute by itself in server mode (they replace TanStack's `getFacetedUniqueValues` / `getFacetedMinMaxValues`):

**`select` / `multi-select`** (and option columns without a filter) → list of options with the frontend's `ColumnSelectOption` shape (`value`, `label`, `count`; the client adds the icon):

- **Cross counts:** each facet count is computed with all the other filters and the search applied, **except the facet's own filter**. This way, after checking "active" the counts of "pending" and "inactive" are still visible. It is one `GROUP BY` per facet.
- **Source of the options:**
  - Declared (`->options(['active' => 'Active', …])`): all of them appear, in the declared order and with `count: 0` when there are no rows.
  - An option column without a filter sends only its declared options, without `count` and without a query, so the cells show their labels.
  - Not declared: distinct values present in the database, sorted by value, with `label = value`.
- Selected values always appear, even if their count is 0.
- `NULL` values are not an option. With `empty: true` in the filter, the rows without a value go last as `{ "value": null, "label": …, "count"?: … }`; the label is the text of `->whenEmpty()` or the `no_value` UI text.
- Counts can be disabled per column (`->filterSelect(counts: false)` / `->filterMultiSelect(counts: false)`); then `count` is not sent. The count query is only skipped with declared options: without them it still runs to list the values.

**`range`** → `{ "min": …, "max": … }` of the column over the base query (without filters), for the slider / range filter bounds. They can be set by hand with `Column::number(...)->filterRange(min: 0, max: 5000)` to skip the query.

### 2.6 `config`

Static table metadata to build the UI: columns (label, whether it is sortable, whether it is hideable, default visibility, display and filter), whether there is global search, the display locale, the default date format, the UI texts, the default `per_page` and its options, the default sort and the effective names of the URL parameters.

- `locale`: BCP 47 locale to format numbers and dates (`es-CL`), resolved on the server: the table (`locale()` / `->locale()`), then `inertia-datatable.locale`, then `app()->getLocale()`, with `_` turned into `-`. `null` when the setting is `'browser'`: the client uses the browser locale.
- `date_format`: preset of the date columns without a `format` (`inertia-datatable.date_format`, `long` by default).
- `messages`: UI texts in the app language (`lang/{lang}/ui.php` of the package or the published copy in `lang/vendor/inertia-datatable`), English as fallback. Placeholders `:label`, `:count`, `:page` and `:pages` are replaced on the client.

Each column:

```json
{ "id": "price", "label": "Price", "sortable": true, "hideable": true, "visible": true,
  "display": { "type": "number", "format": { "style": "currency", "currency": "CLP" } },
  "filter": { "variant": "range" } }
```

`filter` is `null` or `{ "variant": …, "placeholder"?: …, "empty"?: true }`, with the variants of §1.4. `empty: true` (`filterRange(empty: true)`, `filterSelect(empty: true)`…, not in `filterInput()`) makes the filter offer the rows without a value, sent as `is.empty` next to the column's other filters (OR, §1.4); with `inertia-datatable.validate_columns`, it throws on a `NOT NULL` column and on a `belongsTo` column whose foreign key and related column are both `NOT NULL`. Each type of column allows only some of them:

| Column | `display.type` | Filter variants |
|---|---|---|
| `Column::text()` | `text` | `text` (`filterInput('…')`, with its `placeholder`) |
| `Column::number()` | `number` | `number` (`filterInput()`, with its `placeholder`), `range` (`filterRange()`, bounds in `facets`) |
| `Column::date()` | `date` | `date` (`filterDate()`), `date-range` (`filterRange()`) |
| `Column::boolean()` | `boolean` | `boolean` (`filterSelect()`) |
| `Column::option()` | `option` | `select` (`filterSelect()`), `multi-select` (`filterMultiSelect()`); options in `facets` |

`display` is always present: `type` is the type of the column and the other keys say how its cells are shown. Any type can carry `empty`, the text of cells without a value (`->whenEmpty()`); without it, the client shows the `empty` message (`—`). Rows keep the raw value and the client formats it with Intl and `locale` (`null`: the browser's):

| `display` | Declared with | Cell |
|---|---|---|
| `{ "type": "number", "format": { "style": "currency", "currency": "CLP" } }` | `money()`, `decimals()`, `percent()`, `format()` | `format` = Intl.NumberFormat options |
| `{ "type": "number", "format": { … }, "currency": { "cell": "both", "filter": "none" } }` | `money('CLP', cell:, filter:)` | Currency in the cells (and the filter label) and next to the filter inputs: `symbol` (default, not sent), `code`, `both` or `none` |
| `{ "type": "number", "unit": "kg", "showUnit": { "cell": false } }` | `unit('kg', cell:, filter:)` | Unit after plain numbers and next to the filter inputs (never with a `style`); `showUnit` (only when one side hides it) says where it is not shown |
| `{ "type": "date", "format": "long" }` | `format()` | `short`, `medium`, `long`, `datetime`, `relative` or Intl.DateTimeFormat options; without `format`, the table `date_format`; dates without time are formatted in UTC |
| `{ "type": "text", "limit": 60, "link": "url" }` | `limit()`, `url()`, `email()` | Cut text; link only for http/https URLs |
| `{ "type": "boolean", "labels": { "true": "Sí", "false": "No" } }` | `labels()` | Labels of true/false (also `1`/`0`); without them, the Yes / No of `messages` |
| `{ "type": "option", "badge": true, "variant": "outline", "variants": { "archived": "destructive" } }` | `badge()`, `badge('secondary', ['archived' => 'destructive'])` | Option labels with the project's shadcn `Badge`: the variant of the value, else the column one (`outline` by default); any variant of the project's `badge.tsx` |

The client adapter translates each column into the columns' `meta` (`label`, `placeholder`, `variant`, `filter: "range"`, `unit`, `options`, `display`) and into `enableSorting` / `enableColumnFilter` / `enableHiding`, so the definition lives in a single place: the server.

---

## 3. From the TanStack state to the URL (done by `registry/shared`)

Pure TypeScript functions shared between React and Vue:

- `stateToQuery(state, config) → Array<[string, string]>`: serializes into `[key, value]` pairs (several filters of one column repeat the key as `filter[col][]`), leaving out default values (page 1, default `per_page`, no sort, no filters, default visibility) so URLs stay clean. Filters with their implicit operator are written without a prefix (`filter[status]=active,pending`).
- `buildTableUrl(href, pairs, keys)`: builds the URL of the visit from those pairs, keeping the parameters that are not of the table. There is no inverse function: the official state is always the `state` of the response.

Rules the client must follow:

- When the sort, the filters, the search or `per_page` change, it goes back to page 1.
- The search is debounced (about 300 ms).
- Visits use `preserveState: true`, `preserveScroll: true`, `replace: true` (except when changing pages, which may add history) and `only: [<prop>]`.
- A visit that fails (by network or cancelled) changes nothing: the client goes back to the last `state` of the server, which is what the rows and the URL show.

---

## 4. Security and performance

- The contract's column identifiers are public names the server maps to real columns, always qualified (`users.status`), or to declared relation paths (`category.name`).
- No request value is used as an SQL identifier; values always go as bindings.
- `per_page` limited to a closed list; `sort` limited by `maxSorts`; `search` limited in length.
- Cost per request: 1 `COUNT` + 1 paginated `SELECT` + 1 `GROUP BY` per `select` / `multi-select` column with counts + 1 `MIN/MAX` per `range` column without fixed bounds. Index the filterable and sortable columns, and the foreign keys used by relation columns.
- Maximum number of filters per request (by default 20) to bound the query size.
- In debug mode (`inertia-datatable.validate_columns`), the columns used in SQL are checked against the schema and the displayed ones against the serialized model, so a missing column fails on the first load with a `LogicException` instead of a SQL error on the first sort or filter.

---

## 5. Table definitions per model and relations

The contract is the same for any model (users, products, orders…); what changes is the **table definition** in the backend. There are two equivalent forms.

### 5.1 One class per table (recommended; generated by `make:datatable`)

```php
// app/DataTables/ProductsTable.php
class ProductsTable extends DataTable
{
    public function query(): Builder
    {
        return Product::query();
    }

    public function columns(): array
    {
        return [
            Column::text('name', 'Name')->sortable()->searchable()->hideable(false),
            Column::number('price', 'Price')->sortable()->money('USD')->filterRange(),
            Column::option('status', 'Status')->options(['active' => 'Active', 'draft' => 'Draft'])->filterMultiSelect(),
            Column::option('category', 'Category')->from('category.name')->filterMultiSelect()->sortable()->searchable(),
            Column::boolean('featured', 'Featured')->filterSelect(),
            Column::date('created_at', 'Created')->sortable()->filterRange()->hidden(),
        ];
    }

    public function defaultSort(): string
    {
        return '-created_at';
    }
}

// Controller
return Inertia::render('products/index', ['products' => fn () => ProductsTable::make()]);
```

### 5.2 Quick form (simple cases)

```php
DataTable::for(User::query())
    ->columns([
        Column::text('name', 'Name')->sortable()->searchable(),
        Column::option('role', 'Role')->filterSelect(),
    ])
    ->defaultSort('name');
```

### 5.3 Tables from a parent model

The base query can be any Eloquent `Builder` or relation. `make()` creates the table from the container, so the constructor accepts named arguments (and injected dependencies):

```php
class UserProductsTable extends DataTable
{
    public function __construct(private readonly User $user) {}

    public function query(): HasMany
    {
        return $this->user->products();
    }

    // columns(), …
}

UserProductsTable::make(user: $user);
```

### 5.4 Relation columns (`belongsTo` / `hasOne`)

`->from('relation.column')` takes the value from a related model (`belongsTo`, `hasOne`, `morphOne` or `hasOneThrough`; a `morphTo` or a to-many relation throws a `LogicException`). The public id (`category`) is independent of the internal path (`category.name`): the frontend does not know there is a relation.

| Operation | How it is resolved |
|---|---|
| `data` | The relation is eager loaded automatically; the row carries `"category": "Electronics"` (flattened under the public id) |
| `sort` | Correlated subquery: `ORDER BY (SELECT name FROM categories WHERE categories.id = products.category_id)` |
| `filter` | `whereHas('category', …)` with the matching operator on the related column (`is.empty` also includes records without the relation) |
| `search` | `orWhereHas('category', …)` inside each word's group |
| `facets` | `GROUP BY` on the subquery value; the options are the related column's values (for example, category names) |

Limits of this phase:

- Only to-one relations (`belongsTo`, `hasOne`, `morphOne`, `hasOneThrough`), one level deep (`category.name`; not `category.parent.name`). Declaring a column on a to-many relation throws a `LogicException` when the table is resolved, even if it is only displayed.
- The facet values are the displayed column's values (`filter[category]=Electronics`). Repeated values (two categories with the same name) are grouped.
- To-many relations (`hasMany`, `belongsToMany`, for example tags) are left for a future phase.

---

## 6. spatie/laravel-query-builder or a custom implementation?

**Recommendation: custom implementation**, with spatie's URL convention.

| | spatie/laravel-query-builder 7.3 | Custom |
|---|---|---|
| Parsing and allowlist of `sort` / `filter` | ✅ Mature | ~150 lines, covered by tests |
| `per_page` with a closed list and out-of-range page | ❌ Has to be built on top | ✅ |
| Global search across several columns | ⚠️ With a custom `AllowedFilter::callback` | ✅ |
| Options with cross counts and min/max | ❌ The builder has to be rebuilt with a modified Request per facet | ✅ Designed for it |
| Normalized state in TanStack format | ❌ | ✅ |
| Disallowed values | Throws `InvalidFilterQuery` / `InvalidSortQuery` (400), only partly configurable | Normalizes and reports in `state` |
| Concepts outside this use case (includes, fields, appends) | Yes | No |
| Requirements | PHP ^8.4, `spatie/laravel-package-tools` | Only `illuminate/*` (PHP ^8.3, same as Laravel 13) |

spatie would only solve the smallest part (parsing); facets, pagination, search and the response shape would have to be written anyway, on top of fighting its error handling. Since the URL convention is shared, migrating to spatie later would be possible without touching the frontend.
