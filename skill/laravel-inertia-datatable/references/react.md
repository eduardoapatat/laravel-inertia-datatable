# React reference

## Contents
- Page structure
- Columns and cells
- Toolbar, pagination and loading state
- Custom meta (icons, labels)
- Several tables on one page
- Files installed by the registry

## Page structure

`make:datatable --react` generates the per-table component (`components/data-tables/<resource>-table.tsx`) with this same structure, so most of the time you only adjust labels and cells there. Everything below also applies when writing it by hand.

Two levels: the shared UI (`components/data-table/*`, `hooks/use-server-data-table.ts`, `lib/data-table-*.ts`) is installed once per project; each table gets its own component with its row type and columns, and pages just render it.

```tsx
import { Head } from '@inertiajs/react';
import { createColumnHelper } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { getOptionLabel, useServerDataTable } from '@/hooks/use-server-data-table';
import type { DataTableFeatures } from '@/lib/data-table-features';
import type { ServerDataTable } from '@/lib/data-table-server';

type Product = {
    id: number;
    name: string;
    status?: string;   // rows only carry visible columns: keep hideable fields optional
    price?: number;
};

const columnHelper = createColumnHelper<DataTableFeatures, Product>();

// Module level: TanStack needs a stable columns reference.
const columns = columnHelper.columns([
    columnHelper.accessor('name', {
        id: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} label="Name" />,
    }),
    columnHelper.accessor('status', {
        id: 'status',
        header: ({ column }) => <DataTableColumnHeader column={column} label="Status" />,
        cell: ({ cell, column }) => getOptionLabel(column.columnDef.meta, cell.getValue()),
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

- Every column `id` must equal the backend column id; that is how sorting, filters, labels and options get connected. Columns without a backend counterpart (actions, row selection) are left alone.
- You do not set `enableSorting`, `enableColumnFilter`, `enableHiding` or filter `meta` yourself: the hook fills them from the server config (label, variant, placeholder, unit, options with counts, range bounds).
- Cells: `getOptionLabel(column.columnDef.meta, value)` turns enum/option values into their labels; `formatDate(value)` from `@/lib/data-table-format` formats dates with the browser locale; booleans need an explicit cell (`value ? 'Yes' : 'No'`) or they render nothing.

## Toolbar, pagination and loading state

- `<DataTableToolbar table={table} />` renders the global search (when the server allows it) and one control per filterable column: text/number inputs, faceted filters with counts, range slider, date pickers, Yes/No for booleans, plus Reset and the column visibility menu. Props: `searchPlaceholder`, `searchable` (override), `children` (extra buttons on the right).
- Pagination is part of `<DataTable>`; page sizes come from the server.
- `isLoading` is true while a visit is in flight; use it for a subtle opacity or a spinner, never to unmount the table (that would lose input focus).
- Text filters and the search are debounced (300 ms, `debounceMs` option); paging, sorting and visibility navigate immediately.

## Custom meta (icons, labels)

Page meta wins over server meta, so you can decorate options while keeping server counts:

```tsx
columnHelper.accessor('status', {
    id: 'status',
    header: ...,
    meta: {
        variant: 'multi-select',
        options: [
            { value: 'active', label: 'Active', icon: CircleCheck },
            { value: 'draft', label: 'Draft', icon: CircleDashed },
        ],
    },
}),
```

## Several tables on one page

Call the hook once per table with its own prop and give each backend table a `name()`; the hook builds URLs with the prefixed parameter names returned by the server and keeps unrelated query parameters.

## Files installed by the registry

- `hooks/use-server-data-table.ts` — the hook and `getOptionLabel`.
- `lib/data-table-server.ts` — response types (`ServerDataTable<T>`) and state ↔ URL serialization.
- `lib/data-table-{features,filters,types,utils,format}.ts`, `components/data-table/*`, `components/ui/faceted.tsx`.

These files belong to the project after installation: adapt texts (for example to Spanish) or styles there. Reinstalling from the registry overwrites them, so note local changes.
