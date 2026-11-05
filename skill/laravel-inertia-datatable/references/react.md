# React reference

## Contents
- Page structure
- Columns and cells
- Toolbar, pagination and loading state
- Layout: reorder the pieces
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

- Every backend column is rendered, in the order of `columns()` in PHP, even if the component does not declare it: header with the server label and a default cell by filter variant — dates with `formatDate` (browser locale), booleans as Yes/No (also `1`/`0`), select/multi-select as option labels, numbers with their unit, anything else as text.
- To customize a column, declare it with the backend column id (`columnHelper.accessor('status', { cell })`). Missing `header` or `cell` fall back to the defaults, so declaring only `cell` is enough.
- Client-only columns (no backend id: actions, row selection) go after the backend columns; add `meta: { position: 'start' }` to put one first (for example a selection checkbox).
- You do not set `enableSorting`, `enableColumnFilter`, `enableHiding` or filter `meta` yourself: the hook fills them from the server config (label, variant, placeholder, unit, options with counts, range bounds).
- In custom cells, reuse the default formatting instead of showing raw values:
  - `getOptionLabel(column.columnDef.meta, value)` (from `@/components/data-table/data-table-default-column`) turns enum/option values into their labels (`active` → `Active`).
  - `formatCellValue(column.columnDef.meta, value)` (same file) formats any value like the default cell.
  - `formatDate(value)` (from `@/lib/data-table-format`) formats dates.

```tsx
import { getOptionLabel } from '@/components/data-table/data-table-default-column';

columnHelper.accessor('status', {
    cell: ({ cell, column }) => (
        <Badge>{getOptionLabel(column.columnDef.meta, cell.getValue())}</Badge>
    ),
}),
```

## Toolbar, pagination and loading state

- `<DataTableToolbar table={table} />` renders the global search (when the server allows it) and one control per filterable column: text/number inputs, faceted filters with counts, range slider, date pickers, Yes/No for booleans, plus Reset and the column visibility menu. Props: `searchPlaceholder`, `searchable` (override), `children` (extra buttons on the right). For another arrangement, see the next section.
- Pagination is part of `<DataTable>` (below the table; `pagination={false}` to place it yourself); page sizes come from the server.
- `isLoading` is true while a visit is in flight; use it for a subtle opacity or a spinner, never to unmount the table (that would lose input focus).
- Text filters and the search are debounced (300 ms, `debounceMs` option); paging, sorting and visibility navigate immediately.

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
- `lib/data-table-{features,filters,types,utils,format}.ts`, `components/data-table/*`, `components/ui/faceted.tsx`.

These files belong to the project after installation: adapt texts (for example to Spanish) or styles there. `php artisan inertia-datatable:ui --update` brings the latest version of exactly these files (and nothing else in `components/ui/`), overwriting local changes — check `git diff` afterwards and re-apply the project's customizations.
