# React reference

## Contents
- Page structure
- Columns and cells
- Toolbar, pagination and loading state
- Column width and classes
- Layout: reorder the pieces
- Language and texts
- Custom meta (icons, labels)
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
        cell: ({ cell }) => <strong>{cell.getValue()}</strong>,
    }),
    columnHelper.display({
        id: 'actions',
        cell: ({ row }) => <Link href={`/products/${row.original.id}`}>Edit</Link>,
    }),
]);

export default function ProductsIndex({ products }: { products: ServerDataTable<Product> }) {
    const { table, isLoading } = useServerDataTable({ table: products, prop: 'products', columns });

    return (
        <>
            <Head title="Products" />
            <DataTable table={table} className={isLoading ? 'opacity-60' : undefined}>
                <DataTableToolbar table={table} />
            </DataTable>
        </>
    );
}
```

Match the layout conventions of the app (breadcrumbs, wrappers, Wayfinder route helpers) by looking at a sibling page. When layout data depends on page props (breadcrumbs with a record name on a show page), Inertia v3's `setLayoutProps({ breadcrumbs: [...] })` inside the component replaces the static `Page.layout = {...}` object.

## Columns and cells

- Every backend column is rendered, in the order of `columns()` in PHP, even if the component does not declare it: header with the server label and a default cell that follows the column display declared in PHP (`->money('CLP')`, `->dateFormat('long')`, `->limit(60)`, `->badge()`…, see `backend.md`) or, without it, the filter variant — dates (long), booleans as Yes/No (also `1`/`0`), select/multi-select as option labels, numbers with their unit, anything else as text. Numbers and dates use the table locale (resolved by the server from the table, the config or the app locale; the `locale` option of the hook overrides it). Date columns without a format use `config('inertia-datatable.date_format')`.
- To customize a column, declare it with the backend column id (`columnHelper.accessor('status', { cell })`). Missing `header` or `cell` fall back to the defaults, so declaring only `cell` is enough.
- Client-only columns (no backend id: actions, row selection) go after the backend columns; add `meta: { position: 'start' }` to put one first (for example a selection checkbox).
- You do not set `enableSorting`, `enableColumnFilter`, `enableHiding` or filter `meta` yourself: the hook fills them from the server config (label, variant, placeholder, unit, options with counts, range bounds).
- The page can set or override the format in `meta.display` (same shape as the server `display`; with the same type, only the declared keys change): `meta: { display: { type: 'number', format: { style: 'percent' } } }`.
- Icons per option go in `meta.options` (labels and counts still come from the server); they show in the faceted filter and in the cells:

```tsx
columnHelper.accessor('status', {
    meta: {
        variant: 'multi-select',
        options: [
            { value: 'active', label: 'Active', icon: CircleCheck },
            { value: 'draft', label: 'Draft', icon: CircleDashed },
        ],
    },
}),
```

- To render a value differently (extra icons, other fields of the row, another component), write a custom `cell` (for a color or a class by value, `meta.cellClassName` as a function is shorter, see "Column width and classes") and reuse the type cells from `@/components/data-table/data-table-cells` so the declared format is kept: `DataTableCell` (picks by type), `DataTableTextCell`, `DataTableNumberCell`, `DataTableDateCell`, `DataTableBooleanCell`, `DataTableOptionCell`. They take the cell context:

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

- Option cells (select / multi-select) can be customized without rewriting them; the cell still splits multiple values, skips empty ones and keeps the PHP labels and the `meta.options` icons:

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

- `<DataTableToolbar table={table} />` renders the global search (when the server allows it) and one control per filterable column: text/number inputs, faceted filters with counts, range slider, date pickers, Yes/No for booleans, plus Reset and the column visibility menu. Props: `searchPlaceholder`, `searchable` (override), `children` (extra buttons on the right). For another arrangement, see the next section.
- Pagination is part of `<DataTable>` (below the table; `pagination={false}` to place it yourself); page sizes come from the server.
- `isLoading` is true while a visit is in flight; use it for a subtle opacity or a spinner, never to unmount the table (that would lose input focus).
- Text filters and the search are debounced (300 ms, `debounceMs` option); paging, sorting and visibility navigate immediately.

## Language and texts

- Every text of the UI (search, Reset, Rows per page, Page 1 of 25, Yes/No, filter and calendar labels) comes from `config.messages`, translated by Laravel in the app language. Translate or change them in PHP (`php artisan vendor:publish --tag=inertia-datatable-lang`), not in the components: those are overwritten by `inertia-datatable:ui --update`.
- Per table in React: `useServerDataTable({ table, prop, columns, locale: 'en-US', messages: { search: 'Find products…' } })`. `locale: 'browser'` uses the browser's.
- In your own components, `getMessage(table, 'page_of', { page: 1, pages: 25 })` from `@/lib/data-table-messages` (keys = `DEFAULT_MESSAGES`).
- `DataTableSkeleton` has no table: pass `label` for its screen-reader text.
- The calendar of the date filters takes the month and day names and the first day of the week from the table locale with Intl; no date-fns locale is needed.

## Column width and classes

Declared in the table component (Tailwind does not scan the PHP classes), only for the columns that need it; the column keeps everything the server declares:

```tsx
columnHelper.accessor('name', { size: 300 }),                                   // px (150 by default)
columnHelper.accessor('notes', { meta: { className: 'w-40 md:w-80 lg:w-96' } }), // responsive width
columnHelper.accessor('title', { size: 300, meta: { className: 'max-md:w-48' } }), // size from md up, class below
columnHelper.accessor('sku', { meta: { cellClassName: 'font-mono text-xs' } }),
columnHelper.accessor('price', { meta: { numberClassName: 'min-w-28' } }),         // figures longer than the header
// Classes by value: the default cell (and its PHP format) stays as it is
columnHelper.accessor('price', {
    meta: { cellClassName: (cell) => Number(cell.getValue()) < 100 && 'font-medium text-red-600' },
}),
```

- Prefer `meta.*ClassName` to a custom `cell` when only spacing, size, alignment or colors change; write a `cell` to render something else. Tailwind classes are for layout and colors: when shadcn has a component for the thing (Badge, Checkbox, Button), use the component.

- Number cells are already right-aligned in a box as wide as the header label, so figures end right under it; do not add `text-right`, which pushes them against the next column. `meta.numberClassName` changes that box (`min-w-28` when figures are longer than the label).
- `meta.className` goes to the header and the cells, `headerClassName` / `cellClassName` to one of them. A `w-*` class replaces the `size` width (they are merged with `cn`); a `md:w-*` alone keeps `size` below that breakpoint.
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

## Layout: reorder the pieces

The toolbar and the pagination are made of exported pieces. To change the layout, compose them in the per-table component instead of editing `components/data-table/*`:

| Piece | Import from | Notes |
|---|---|---|
| `DataTableSearch` | `data-table-toolbar` | Hidden when the PHP class has no `searchable()` column (force with `searchable`); `placeholder`, `className`. |
| `DataTableFilters` | `data-table-toolbar` | One control per filterable column; `columns={['status', 'price']}` shows only those, in that order. Renders no wrapper. |
| `DataTableFilter` | `data-table-toolbar` | A single filter: `column="status"`. |
| `DataTableResetButton` | `data-table-toolbar` | Only visible while a filter or the search is active. |
| `DataTableViewOptions` | `data-table-view-options` | Column visibility menu; `align`. |
| `DataTablePagination` | `data-table-pagination` | Use with `<DataTable pagination={false}>`. |

```tsx
// Pagination on top, View menu first, two filters, and the status filter apart on the right.
<DataTable table={table} pagination={false}>
    <DataTablePagination table={table} />
    <div className="flex flex-wrap items-center gap-2">
        <DataTableViewOptions table={table} />
        <DataTableSearch table={table} />
        <DataTableFilters table={table} columns={['created_at', 'name']} />
        <DataTableResetButton table={table} />
        <div className="ml-auto">
            <DataTableFilter table={table} column="status" />
        </div>
    </div>
</DataTable>
```

Children of `<DataTable>` render above the table; anything else (titles, tabs, buttons) can sit between the pieces.

## Custom meta (icons, labels)

Page meta wins over server meta, so you can decorate options while keeping server counts:

```tsx
columnHelper.accessor('status', {
    meta: {
        variant: 'multi-select',
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
- `lib/data-table-{features,filters,types,utils,format,messages}.ts`, `components/data-table/*`, `components/ui/faceted.tsx`.

These files belong to the project after installation: adapt styles there (texts are translated with the lang files, see above). `php artisan inertia-datatable:ui --update` brings the latest version of exactly these files (and nothing else in `components/ui/`), overwriting local changes — check `git diff` afterwards and re-apply the project's customizations.
