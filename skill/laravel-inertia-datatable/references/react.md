# React reference

## Contents
- Page structure
- Columns and cells
- Toolbar, pagination and loading state
- First load with a skeleton
- Language and texts
- Column width and classes
- Layout: place and customize the pieces
- Custom meta (icons, labels)
- Readable URLs
- Several tables on one page
- Files installed by the registry

## Page structure

`make:datatable --react` generates the per-table component (`components/data-tables/<resource>-table.tsx`) with this same structure. Everything below also applies when writing it by hand.

Two levels: the shared UI (`components/data-table/*`, `hooks/use-server-data-table.ts`, `lib/data-table-*.ts`) is installed once per project; each table gets its own component with its row type and its customized columns, and pages just render it.

**The PHP table class is the source of truth for the columns**: which ones are shown, their order (also in the toolbar filters), labels, sorting, filters and visibility. To add, remove or reorder a column, change `columns()` in PHP; the component does not need to change. The `columns` array in React only customizes columns (same `id`) or adds client-only ones (actions, selection).

```tsx
import { Head, Link } from '@inertiajs/react';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableTextCell } from '@/components/data-table/data-table-cells';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { useServerDataTable } from '@/hooks/use-server-data-table';
import type { DataTableFeatures } from '@/lib/data-table-features';
import type { ServerDataTable } from '@/lib/data-table-server';

type Product = {
    id: number;
    name: string;
    status?: string;   // rows only carry visible columns: keep hideable fields optional
    price?: number;
};

const columnHelper = createColumnHelper<DataTableFeatures, Product>();

// Module level: TanStack needs a stable columns reference. Only customized
// columns go here; the rest come from the PHP class with default cells.
const columns = columnHelper.columns([
    columnHelper.accessor('name', {
        // The type cell keeps ->limit(), ->whenEmpty() and links of PHP.
        cell: (context) => <strong><DataTableTextCell {...context} /></strong>,
    }),
    columnHelper.display({
        id: 'actions',
        cell: ({ row }) => <Link href={`/products/${row.original.id}`}>Edit</Link>,
    }),
]);

export default function ProductsIndex({ products }: { products: ServerDataTable<Product> }) {
    const { table } = useServerDataTable({ table: products, prop: 'products', columns });

    return (
        <>
            <Head title="Products" />
            <DataTable table={table}>
                <DataTableToolbar table={table} />
            </DataTable>
        </>
    );
}
```

Match the layout conventions of the app (breadcrumbs, wrappers, Wayfinder route helpers) by looking at a sibling page. When layout data depends on page props (breadcrumbs with a record name on a show page), Inertia v3's `setLayoutProps({ breadcrumbs: [...] })` inside the component replaces the static `Page.layout = {...}` object.

## Columns and cells

- Every backend column is rendered, in the order of `columns()` in PHP, even if the component does not declare it: header with the server label and a default cell that follows the type and the format of the column declared in PHP (`Column::number(...)->money('CLP')`, `Column::date(...)->format('long')`, `->limit(60)`, `->badge()`…, see `backend.md`): dates (long by default), booleans as Yes/No (also `1`/`0`), options as their labels, numbers with their unit, text as is. The server always sends `display` (its `type` is the column type) and `filter` (`null` or `{ variant, placeholder?, empty? }`). Numbers and dates use the table locale (resolved by the server from the table, the config or the app locale; the `locale` option of the hook overrides it). Date columns without a format use `config('inertia-datatable.date_format')`.
- To customize a column, declare it with the backend column id (`columnHelper.accessor('status', { cell })`). Missing `header` or `cell` fall back to the defaults, so declaring only `cell` is enough.
- Client-only columns (no backend id: actions, row selection) go after the backend columns; add `meta: { position: 'start' }` to put one first (for example a selection checkbox).
- You do not set `enableSorting`, `enableColumnFilter`, `enableHiding` or filter `meta` yourself: the hook fills them from the server config (label, `filterVariant` with the filter of the PHP class, placeholder, options with counts, range bounds, and `display` with the type of the cells and its unit). Number filters show the unit or the currency next to their inputs (`getFilterAffixes` in `lib/data-table-format.ts`).
- The page can set or override the format in `meta.display` (same shape as the server `display`; with the same type, only the declared keys change): `meta: { display: { type: 'number', format: { style: 'percent' } } }`.
- Icons per value go in `meta.icons`; labels, counts and badge variants still come from the server. They show in the filter list and in the cells (with or without badge), also in boolean columns with the keys `true` / `false`. Icons are lucide components imported by name, so only the ones used reach the bundle; do not send icon names from PHP or use `DynamicIcon`:

```tsx
columnHelper.accessor('status', {
    meta: { icons: { active: CircleCheck, draft: CircleDashed, archived: Archive } },
}),
columnHelper.accessor('featured', {
    meta: { icons: { true: Star } },
}),
```

`meta.options` (`{ value, label, icon }`) still works when the page must also change the labels.

- Badge variant of a value, first wins: the `badge` prop of `DataTableOptionCell` → `meta.display.variants` of the page (replaces the whole PHP map) → the map of `badge('…', [...])` in PHP → `badgeVariant()` of the enum → the column variant of `badge('…')` → `outline`. How each variant looks is the project's `components/ui/badge.tsx`.

- To render a value differently (extra icons, other fields of the row, another component), write a custom `cell` (for a color or a class by value, `meta.cellClassName` as a function is shorter, see "Column width and classes") and reuse the type cells from `@/components/data-table/data-table-cells` so the declared format is kept: `DataTableCell` (picks by type), `DataTableTextCell`, `DataTableNumberCell`, `DataTableDateCell`, `DataTableBooleanCell`, `DataTableOptionCell` (each one shows `DataTableEmptyCell`, the `—` or the text of `->whenEmpty()`, for empty values). They take the cell context. A custom cell replaces the default one, so rendering `cell.getValue()` alone drops what PHP declares for the cell (`->limit()` and its tooltip, `->whenEmpty()`, `->url()`/`->email()` links, number and date formats); wrap the type cell instead:

```tsx
import { DataTableNumberCell } from '@/components/data-table/data-table-cells';

columnHelper.accessor('price', {
    cell: (context) => (
        <span className={cn(Number(context.cell.getValue()) < 100 && 'text-red-600')}>
            <DataTableNumberCell {...context} />
        </span>
    ),
}),
```

- Option cells (select / multi-select) can be customized without rewriting them; the cell still splits multiple values, skips empty ones and keeps the PHP labels and the `meta.icons` icons:

```tsx
import {
    DataTableOptionBadge,
    DataTableOptionCell,
} from '@/components/data-table/data-table-cells';

// Same shadcn Badge, other variant or classes per value (over the PHP `->badge()` variants)
columnHelper.accessor('status', {
    cell: (context) => (
        <DataTableOptionCell
            {...context}
            badge={(option) => ({
                variant: option?.value === 'archived' ? 'destructive' : 'secondary',
            })}
        />
    ),
}),

// Anything else than a badge
columnHelper.accessor('category', {
    cell: (context) => (
        <DataTableOptionCell
            {...context}
            renderOption={(option, value) => (
                <span className="inline-flex items-center gap-1.5">
                    <span className={cn('size-2 rounded-full', COLORS[String(value)])} />
                    {option?.label ?? value}
                </span>
            )}
        />
    ),
}),
```

- `DataTableOptionBadge` (`option`, `value` and any `Badge` prop) is the badge of `->badge()`, for fully custom cells: `<DataTableOptionBadge option={getOption(meta, value)} value={value} variant="secondary" />`. Never draw a badge by hand with Tailwind classes; use the project's `components/ui/badge.tsx`.

- For plain strings, `formatCellValue(meta, value, getFormatContext(table))` (locale, default date format and Yes/No texts of the table), `getOptionLabel(meta, value)` and `getOption(meta, value)` are exported from `@/components/data-table/data-table-default-column` (and `@/lib/data-table-format`). `row.original` gives the other visible fields of the row.

## Toolbar, pagination and loading state

- `<DataTableToolbar table={table} />` renders the global search (when the server allows it) and one control per filterable column: text/number inputs, faceted filters with counts, range slider, date pickers, Yes/No for booleans (with `empty: true` in PHP, a "without value" option or check, `DataTableEmptyFilter`), plus Reset and the column visibility menu (hidden below `lg`). Props: `searchPlaceholder`, `searchable` (override), `children` (extra buttons on the right). For another arrangement or to customize a filter, see "Layout: place and customize the pieces".
- Pagination is part of `<DataTable>` (below the table; `pagination={false}` to place it or its pieces yourself); page sizes come from the server.
- `<DataTable>` shows a slow visit on its own, without flicker on fast ones: after `loadingDelay` (150 ms) the rows dim with a fade, after `skeletonDelay` (600 ms; `false` turns it off) the rows turn into skeleton rows with the same column widths (they stay, dimmed, while the focus is on one of them). It draws no progress bar: Inertia already shows its own at the top of the page. The toolbar stays usable, the table container gets `aria-busy` and `data-loading="busy" | "slow"`, and with `prefers-reduced-motion` nothing animates. Both delays are options of `useServerDataTable`.
- Every column filter and the search are debounced (300 ms, `debounceMs` option); paging, sorting and visibility navigate immediately.
- `getRowId` (option of the hook): by default `row.id`; pass it when the primary key has another name, or the rows are told apart by their position, which breaks selection.
- The hook also returns `isLoading` (true as soon as a visit starts) and `loading` (`'idle' | 'busy' | 'slow'`). To show the state yourself, use `<DataTable loading={false}>` and one of them; never unmount the table while loading (that would lose input focus). Generated components older than v0.11 apply `cn(isLoading && 'opacity-60', className)`: replace it with `className`.

## First load with a skeleton

To show the page at once and load the table after it, defer the prop and send the table config, which runs no query, for the skeleton (`make:datatable --defer` generates this page):

```php
return Inertia::render('products/index', [
    'products' => Inertia::defer(fn () => ProductsTable::make()),
    'productsConfig' => fn () => ProductsTable::make()->config(),
]);
```

```tsx
type Props = { products?: ServerDataTable<Product>; productsConfig: ServerTableConfig };

export default function ProductsIndex({ products, productsConfig }: Props) {
    const skeleton = <DataTableSkeleton config={productsConfig} />;

    return (
        <Deferred data="products" fallback={skeleton}>
            {products && <ProductsTable products={products} />}
        </Deferred>
    );
}
```

`DataTableSkeleton config` draws the table that is coming: the visible columns with their labels, widths and alignment, `per_page` rows, the search and one placeholder per filter (the page size and the visible columns of the URL win over the defaults), with the screen-reader text of `messages.loading`; its manual props (`columnCount`, `rowCount`, `filterCount`, `withSearch`, `label`) win over the config. It waits `delay` (150 ms; `0` shows it at once) before showing, keeping its space, so a fast load does not flash it. Client-only columns (actions, selection) are not in the config: pass `columnCount` to count them. Filters, paging and sorting are partial reloads of `products`, so they do not show the deferred fallback again.

## Language and texts

- Every text of the UI (search, Reset, Rows per page, Page 1 of 25, Yes/No, filter and calendar labels) comes from `config.messages`, translated by Laravel in the app language. Translate or change them in PHP (`php artisan vendor:publish --tag=inertia-datatable-lang`), not in the components: those are overwritten by `inertia-datatable:ui --update`.
- Per table in React: `useServerDataTable({ table, prop, columns, locale: 'en-US', messages: { search: 'Find products…' } })`. `locale: 'browser'` uses the browser's.
- In your own components, `getMessage(table, 'page_of', { page: 1, pages: 25 })` from `@/lib/data-table-messages` (keys = `DEFAULT_MESSAGES`).
- `DataTableSkeleton` has no table: pass `config` (its `messages.loading`) or `label` for its screen-reader text.
- The calendar of the date filters takes the month and day names and the first day of the week from the table locale with Intl; no date-fns locale is needed.

## Column width and classes

Declared in the table component (Tailwind does not scan the PHP classes), only for the columns that need it; the column keeps everything the server declares:

```tsx
columnHelper.accessor('name', { size: 300 }),                                   // px (150 by default)
columnHelper.accessor('notes', { meta: { className: 'w-40 md:w-80 lg:w-96' } }), // responsive width
columnHelper.accessor('title', { size: 300, meta: { className: 'max-md:w-48' } }), // size from md up, class below
columnHelper.accessor('sku', { meta: { cellClassName: 'font-mono text-xs' } }),
columnHelper.accessor('featured', { meta: { align: 'center' } }),                 // header and cells together
// Classes by value: the default cell (and its PHP format) stays as it is
columnHelper.accessor('price', {
    meta: { cellClassName: (cell) => Number(cell.getValue()) < 100 && 'font-medium text-red-600' },
}),
```

- Prefer `meta.*ClassName` to a custom `cell` when only spacing, size, alignment or colors change; write a `cell` to render something else. Tailwind classes are for layout and colors: when shadcn has a component for the thing (Badge, Checkbox, Button), use the component.

- Alignment goes in `meta.align` (`start`, `center`, `end`), never as `text-right` in `className`: it aligns the header and the cells together so they line up exactly (the header button compensates its padding). Number columns are `end` by default, with `pe-8` of room before the next column.
- `meta.className` goes to the header and the cells, `headerClassName` / `cellClassName` to one of them. A `w-*` class replaces the `size` width (they are merged with `cn`); a `md:w-*` alone keeps `size` below that breakpoint.
- Cells cut what does not fit with "…" (`text-ellipsis`); `cellClassName: 'text-clip'` undoes it. To show more, widen the column (`size` or a `w-*` class), or use `->limit()` in PHP to cut by characters with the full text in a tooltip.
- A narrow column must still fit its header and its padding: an end-aligned column has `pe-8`, so with `w-20` give it less (`className: 'w-20 pe-2'`).
- The table grows to the sum of its columns and scrolls horizontally when it does not fit; when it fits, the extra space is shared.
- Pinned columns compute their offset from `size`: give them `size`, not width classes.

Row height and row classes are props of `<DataTable>`; the classes go on the `<tr>`, so cell padding is changed with `[&>th]` / `[&>td]`:

```tsx
// Outside the component, so the rows keep their memo
function rowClassName(row: Row<DataTableFeatures, Product>) {
    return cn('[&>td]:py-1', (row.original.stock ?? 0) < 50 && 'bg-amber-50 dark:bg-amber-950/30');
}

<DataTable table={table} headerClassName="[&>th]:h-8" rowClassName={rowClassName}>
```

- `rowClassName` is a string or a function of the row; `meta.cellClassName: 'py-4'` makes rows taller from a single column.

## Layout: place and customize the pieces

Every piece of the toolbar and the pagination is its own component. To change the layout or how a filter looks, place them yourself instead of editing `components/data-table/*`. Inside `<DataTableProvider table={table}>` they take the table from the context, so they can go anywhere in the page (a sidebar, a header, above the table); outside it, pass `table` to each one.

**Filters by type.** Each one takes `column` (the id of the column in the PHP class) and only works when the class declared that kind of filter: on another variant it renders nothing and warns in the console outside production, because the server would drop the values it sends.

| Component | PHP filter | Own props |
|---|---|---|
| `DataTableFacetedFilter` | `filterSelect()`, `filterMultiSelect()` (and booleans) | `options` (relabel, reorder or leave out server options by `value`; values the server did not declare are ignored), `counts`, `searchable`, `multiple` (from the variant by default) |
| `DataTableBooleanFilter` | `filterSelect()` on a boolean | `labels={{ true: 'On', false: 'Off' }}` (those of `->labels()` by default) |
| `DataTableSliderFilter` | `filterRange()` on a number | `step` |
| `DataTableDateFilter` | `filterDate()`, `filterRange()` on a date | one day or a range, from the variant |
| `DataTableTextFilter` | `filterInput()` on text | any `<input>` prop; `className` replaces the default width (`w-40`) |
| `DataTableNumberFilter` | `filterInput()` on a number | any `<input>` prop; the unit or currency of the column next to it; `className` replaces the default width (`w-30`) |

The popover filters also take `title` (the column label by default), `icon` (`null` hides it), `className` (the button), `contentClassName` (the popover), `align` and `disabled`. Faceted, slider and date filters import from `data-table-faceted-filter`, `data-table-slider-filter` and `data-table-date-filter`; text and number from `data-table-input-filter`.

**Other pieces.**

| Piece | Import from | Notes |
|---|---|---|
| `DataTableProvider` | `data-table-context` | `table`; `useDataTable()` reads it in your own components. |
| `DataTableSearch` | `data-table-toolbar` | Hidden when the PHP class has no `searchable()` column (force with `searchable`); `placeholder`, `className` (replaces the default width, `w-40`; the toolbar adds `lg:w-64`). |
| `DataTableFilters` | `data-table-toolbar` | One control per filterable column, with the component of its type; `columns={['status', 'price']}` shows only those, in that order. Renders no wrapper. |
| `DataTableFilter` | `data-table-toolbar` | A single filter with the component of its type, without props: `column="status"`. Use the component of the type to customize it. |
| `DataTableResetButton` | `data-table-toolbar` | Only visible while a filter or the search is active. `children` replace the text and are its accessible name; `icon` (`null` hides it). |
| `DataTableViewOptions` | `data-table-view-options` | Column visibility menu: `className` (the button), `contentClassName`, `align`, `icon`. Visible at every width; the toolbar hides it below `lg`. |
| `DataTablePagination` | `data-table-pagination` | All the pagination; use with `<DataTable pagination={false}>`. |
| `DataTablePageSize` | `data-table-pagination` | Rows per page: `pageSizeOptions`, `side`, `hideLabel`. |
| `DataTablePageInfo` | `data-table-pagination` | "Page 2 of 31". |
| `DataTablePageNav` | `data-table-pagination` | Page buttons; `firstLast` (`true`, `false` or `'lg'`, the default: from `lg` up). |
| `DataTableSelectedRows` | `data-table-pagination` | "2 rows selected"; empty without a selection. |

```tsx
// Filters in a sidebar, View and page buttons over the table, page size below.
<DataTableProvider table={table}>
    <div className="flex gap-4">
        <aside className="flex w-64 flex-col items-start gap-2">
            <DataTableFacetedFilter column="status" icon={Tag} counts={false} className="w-full justify-start" />
            <DataTableSliderFilter column="price" step={1000} className="w-full justify-start" />
            <DataTableDateFilter column="published_at" className="w-full justify-start" />
            <DataTableTextFilter column="sku" className="w-full" />
            <DataTableResetButton>Clear all</DataTableResetButton>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2">
                <DataTableViewOptions />
                <DataTableSearch className="flex-1" />
                <DataTablePageNav firstLast={false} />
            </div>
            <DataTable pagination={false} aria-label="Products" />
            <div className="flex items-center justify-between">
                <DataTablePageSize side="bottom" />
                <DataTablePageInfo />
            </div>
        </div>
    </div>
</DataTableProvider>
```

Children of `<DataTable>` render above the table, so a toolbar made of pieces can also stay inside it. The kind of filter is decided in PHP: to change it (for example, a select instead of a text input), change the column in the table class, not the component.

## Custom meta (icons, labels)

Page meta wins over server meta, so you can decorate options while keeping server counts:

```tsx
columnHelper.accessor('status', {
    meta: {
        options: [
            { value: 'active', label: 'Active', icon: CircleCheck },
            { value: 'draft', label: 'Draft', icon: CircleDashed },
        ],
    },
}),
```

## Readable URLs

Inertia builds the page URL with `$request->fullUrl()`, which encodes brackets and commas (`?filter%5Bstatus%5D=active%2Cdraft`). It works the same, but to keep the URL as the hook writes it (`?filter[status]=active,draft`), return the raw request URI from the app's `HandleInertiaRequests` middleware:

```php
use Closure;
use Illuminate\Http\Request;

public function urlResolver(): ?Closure
{
    return fn (Request $request): string => $request->getRequestUri();
}
```

It applies to every Inertia page of the app, which is why the package does not register it by itself.

## Several tables on one page

Call the hook once per table with its own prop and give each backend table a `name()`; the hook builds URLs with the prefixed parameter names returned by the server and keeps unrelated query parameters.

## Files installed by the registry

- `hooks/use-server-data-table.ts` — the hook and `getOptionLabel`.
- `components/data-table/data-table-default-column.tsx` — default header and cell for columns the component does not customize.
- `lib/data-table-server.ts` — response types (`ServerDataTable<T>`) and state ↔ URL serialization.
- `components/data-table/data-table-context.tsx` — `DataTableProvider` and `useDataTable`.
- `lib/data-table-{columns,features,filter-options,filter-values,format,loading,messages,types,utils}.ts`, `components/data-table/*`, `components/ui/faceted.tsx`.

These files belong to the project after installation: adapt styles there (texts are translated with the lang files, see above). `php artisan inertia-datatable:ui --update` brings the latest version of exactly these files (and nothing else in `components/ui/`), overwriting local changes — check `git diff` afterwards and re-apply the project's customizations.
