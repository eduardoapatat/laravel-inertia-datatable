# Vue reference

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

`make:datatable --vue` (or `--page` in a Vue app) generates the per-table component (`components/data-tables/<Resource>Table.vue`) with this same structure. Everything below also applies when writing it by hand.

Two levels: the shared UI (`components/data-table/*`, `composables/useServerDataTable.ts`, `lib/data-table-*.ts`) is installed once per project; each table gets its own component with its row type and its customized columns, and pages just render it. Everything is imported from `@/components/data-table` (its `index.ts`).

**The PHP table class is the source of truth for the columns**: which ones are shown, their order (also in the toolbar filters), labels, sorting, filters and visibility. To add, remove or reorder a column, change `columns()` in PHP; the component does not need to change. The `columns` array in Vue only customizes columns (same `id`) or adds client-only ones (actions, selection).

```vue
<script lang="ts">
export type Product = {
    id: number;
    name: string;
    status?: string; // rows only carry visible columns: keep hideable fields optional
    price?: number;
};
</script>

<script setup lang="ts">
import { Link } from '@inertiajs/vue3';
import { createColumnHelper } from '@tanstack/vue-table';
import { h } from 'vue';
import {
    DataTable,
    DataTableTextCell,
    DataTableToolbar,
} from '@/components/data-table';
import { useServerDataTable } from '@/composables/useServerDataTable';
import type { DataTableFeatures } from '@/lib/data-table-features';
import type { ServerDataTable } from '@/lib/data-table-server';

const props = defineProps<{ products: ServerDataTable<Product> }>();

const columnHelper = createColumnHelper<DataTableFeatures, Product>();

// Only customized columns go here; the rest come from the PHP class with
// default cells.
const columns = columnHelper.columns([
    columnHelper.accessor('name', {
        // The type cell keeps ->limit(), ->whenEmpty() and links of PHP.
        cell: ({ cell }) => h('strong', h(DataTableTextCell, { cell })),
    }),
    columnHelper.display({
        id: 'actions',
        cell: ({ row }) => h(Link, { href: `/products/${row.original.id}` }, () => 'Edit'),
    }),
]);

// A getter, so the table follows every response of the server.
const { table } = useServerDataTable({
    table: () => props.products,
    prop: 'products',
    columns,
});
</script>

<template>
    <DataTable :table="table" aria-label="Products">
        <DataTableToolbar :table="table" />
    </DataTable>
</template>
```

The page renders that component: `<ProductsTable :products="products" />`. Vue pages are named in PascalCase, as in the Vue starter kit: the controller returns `Inertia::render('products/Index', …)` for `pages/products/Index.vue`. Match the layout conventions of the app (breadcrumbs in `defineOptions({ layout: … })`, wrappers, Wayfinder route helpers) by looking at a sibling page.

## Columns and cells

- Every backend column is rendered, in the order of `columns()` in PHP, even if the component does not declare it: header with the server label and a default cell that follows the type and the format of the column declared in PHP (`Column::number(...)->money('CLP')`, `Column::date(...)->format('long')`, `->limit(60)`, `->badge()`…, see `backend.md`): dates (long by default), booleans as Yes/No (also `1`/`0`), options as their labels, numbers with their unit, text as is. Numbers and dates use the table locale (resolved by the server from the table, the config or the app locale; the `locale` option of the composable overrides it). Date columns without a format use `config('inertia-datatable.date_format')`.
- To customize a column, declare it with the backend column id (`columnHelper.accessor('status', { cell })`). Missing `header` or `cell` fall back to the defaults, so declaring only `cell` is enough. `cell` and `header` return a VNode (`h(...)`) or are a component.
- Client-only columns (no backend id: actions, row selection) go after the backend columns; add `meta: { position: 'start' }` to put one first (for example a selection checkbox).
- You do not set `enableSorting`, `enableColumnFilter`, `enableHiding` or filter `meta` yourself: the composable fills them from the server config (label, `filterVariant` with the filter of the PHP class, placeholder, options with counts, range bounds, and `display` with the type of the cells and its unit).
- The page can set or override the format in `meta.display` (same shape as the server `display`): `meta: { display: { type: 'number', format: { style: 'percent' } } }`.
- Icons per value go in `meta.icons`; labels, counts and badge variants still come from the server. They show in the filter list and in the cells, also in boolean columns with the keys `true` / `false`. Icons are `@lucide/vue` components imported by name:

```ts
import { Archive, CircleCheck, CircleDashed, Star } from '@lucide/vue';

columnHelper.accessor('status', {
    meta: { icons: { active: CircleCheck, draft: CircleDashed, archived: Archive } },
}),
columnHelper.accessor('featured', {
    meta: { icons: { true: Star } },
}),
```

- To render a value differently, write a custom `cell` (for a color or a class by value, `meta.cellClassName` as a function is shorter) and reuse the type cells so the declared format is kept: `DataTableCell` (picks by type), `DataTableTextCell`, `DataTableNumberCell`, `DataTableDateCell`, `DataTableBooleanCell`, `DataTableOptionCell` (each one shows `DataTableEmptyCell`, the `—` or the text of `->whenEmpty()`, for empty values). They take the TanStack `cell` as a prop (`h(DataTableNumberCell, { cell })`). Rendering `cell.getValue()` alone drops what PHP declares for the cell; wrap the type cell instead:

```ts
import { DataTableNumberCell } from '@/components/data-table';

columnHelper.accessor('price', {
    cell: ({ cell }) =>
        h(
            'span',
            { class: Number(cell.getValue()) < 100 ? 'text-red-600' : undefined },
            h(DataTableNumberCell, { cell }),
        ),
}),
```

- Option cells (select / multi-select) can be customized without rewriting them; the cell still splits multiple values, skips empty ones and keeps the PHP labels and the `meta.icons` icons. In a column of a to-many relation (`meta.multiple`) it shows up to `->maxVisible()` values (3 by default) and a "+N" with the rest in its `title`. `badge` returns the Badge props of each value; `renderOption` (or the `option` slot from a template) draws each value with anything else:

```ts
import { DataTableOptionCell } from '@/components/data-table';

// Same shadcn Badge, other variant or classes per value (over the PHP `->badge()` variants)
columnHelper.accessor('status', {
    cell: ({ cell }) =>
        h(DataTableOptionCell, {
            cell,
            badge: (option) => ({
                variant: option?.value === 'archived' ? 'destructive' : 'secondary',
            }),
        }),
}),

// Anything else than a badge
columnHelper.accessor('category', {
    cell: ({ cell }) =>
        h(DataTableOptionCell, {
            cell,
            renderOption: (option, value) =>
                h('span', { class: 'inline-flex items-center gap-1.5' }, [
                    h('span', { class: ['size-2 rounded-full', COLORS[String(value)]] }),
                    option?.label ?? String(value),
                ]),
        }),
}),
```

- A custom `header` keeps the sort and hide menu with `DataTableColumnHeader`: `header: ({ column }) => h(DataTableColumnHeader, { column, label: 'Code' })`.
- `DataTableOptionBadge` (`option`, `value`, `variant` and the default slot) is the badge of `->badge()`, for fully custom cells. Never draw a badge by hand with Tailwind classes; use the project's `components/ui/badge`.
- For plain strings, `formatCellValue(meta, value, getFormatContext(table))`, `getOptionLabel(meta, value)` and `getOption(meta, value)` are exported from `@/components/data-table` (and `@/lib/data-table-format`). `row.original` gives the other visible fields of the row.

## Toolbar, pagination and loading state

- `<DataTableToolbar :table="table" />` renders the global search (when the server allows it) and one control per filterable column (text/number inputs, faceted filters with counts, range slider, date pickers, Yes/No for booleans), plus Reset and the column visibility menu (hidden below `lg`). Props: `searchPlaceholder`, `searchable` (override); its default slot adds buttons on the right.
- Pagination is part of `<DataTable>` (below the table; `:pagination="false"` to place it or its pieces yourself); page sizes come from the server. The default slot of `<DataTable>` renders above the table, and its `action-bar` slot below it while there are selected rows on the page.
- `<DataTable>` shows a slow visit on its own: after `loadingDelay` (150 ms) the rows dim, after `skeletonDelay` (600 ms; `false` turns it off) they turn into skeleton rows with the same column widths (they stay, dimmed, while the focus is on one of them). The table container gets `aria-busy` and `data-loading="busy" | "slow"`. Both delays are options of `useServerDataTable`.
- Every column filter and the search are debounced (300 ms, `debounceMs` option); paging, sorting and visibility navigate immediately.
- `getRowId` (option of the composable): by default `row.id`; pass it when the primary key has another name.
- When a visit fails by network, the table goes back to what the server last sent and `<DataTable>` shows a notice below it (`messages.load_error`) with a Retry button. For a toast as well, pass `onNetworkError` to the composable. HTTP errors (500, 419…) are left to Inertia.
- The composable also returns `isLoading`, `loading` (`'idle' | 'busy' | 'slow'`), `failed` and `retry` as refs. To show the state yourself, use `<DataTable :loading="false">` and those values; never unmount the table while loading (that would lose input focus).

## First load with a skeleton

To show the page at once and load the table after it, defer the prop and send the table config, which runs no query, for the skeleton (`make:datatable --defer` generates this page):

```php
return Inertia::render('products/Index', [
    'products' => Inertia::defer(fn () => ProductsTable::make()),
    'productsConfig' => fn () => ProductsTable::make()->config(),
]);
```

```vue
<template>
    <Deferred data="products">
        <template #fallback>
            <DataTableSkeleton :config="productsConfig" :sizes="{ name: 320 }" />
        </template>
        <ProductsTable v-if="products" :products="products" />
    </Deferred>
</template>
```

`DataTableSkeleton` draws the table that is coming from its `config`: the visible columns with their labels, widths and alignment, `per_page` rows, the search and one placeholder per filter, with the screen-reader text of `messages.loading`; its manual props (`columnCount`, `rowCount`, `filterCount`, `withSearch`, `label`) win over the config. When the component sets `size` on a column, pass the same widths by id in `sizes`, so the page does not jump when the data arrives. It waits `delay` (150 ms; `0` shows it at once) before showing.

## Language and texts

- Every text of the UI comes from `config.messages`, translated by Laravel in the app language. Translate or change them in PHP (`php artisan vendor:publish --tag=inertia-datatable-lang`), not in the components: those are overwritten by `inertia-datatable:ui --update`.
- Per table: `useServerDataTable({ table: () => props.products, prop: 'products', columns, locale: 'en-US', messages: { search: 'Find products…' } })`. `locale: 'browser'` uses the browser's.
- In your own components, `getMessage(table, 'page_of', { page: 1, pages: 25 })` from `@/lib/data-table-messages` (keys = `DEFAULT_MESSAGES`).
- The calendar of the date filters takes the month and day names and the first day of the week from the table locale.

## Column width and classes

Declared in the table component (Tailwind does not scan the PHP classes), only for the columns that need it:

```ts
columnHelper.accessor('name', { size: 300 }),                                   // px (150 by default)
columnHelper.accessor('notes', { meta: { className: 'w-40 md:w-80 lg:w-96' } }), // responsive width
columnHelper.accessor('sku', { meta: { cellClassName: 'font-mono text-xs' } }),
columnHelper.accessor('featured', { meta: { align: 'center' } }),                 // header and cells together
// Classes by value: the default cell (and its PHP format) stays as it is
columnHelper.accessor('price', {
    meta: { cellClassName: (cell) => Number(cell.getValue()) < 100 && 'font-medium text-red-600' },
}),
```

- Alignment goes in `meta.align` (`start`, `center`, `end`), never as `text-right` in `className`. Number columns are `end` by default.
- `meta.className` goes to the header and the cells, `headerClassName` / `cellClassName` to one of them. Cells cut what does not fit with "…" (`text-ellipsis`); `cellClassName: 'text-clip'` undoes it.
- Pinned columns compute their offset from `size`: give them `size`, not width classes.

Row and header classes are props of `<DataTable>`; the classes go on the `<tr>`, so cell padding is changed with `[&>th]` / `[&>td]`:

```vue
<DataTable
    :table="table"
    header-class="[&>th]:h-8"
    :row-class="(row) => ((row.original.stock ?? 0) < 50 ? 'bg-amber-50' : undefined)"
/>
```

## Layout: place and customize the pieces

Every piece of the toolbar and the pagination is its own component. To change the layout or how a filter looks, place them yourself instead of editing `components/data-table/*`. Inside `<DataTableProvider :table="table">` (or after `provideDataTable(table)` in the `<script setup>` of the component) they take the table from the context, so they can go anywhere in the page; outside it, pass `table` to each one. The provider and the pieces take the table once, when they mount: to show another table in the same place, give them a `:key` that changes with it so they mount again.

**Filters by type.** Each one takes `column` (the id of the column in the PHP class) and only works when the class declared that kind of filter: on another variant it renders nothing and warns in the console outside production.

| Component | PHP filter | Own props |
|---|---|---|
| `DataTableFacetedFilter` | `filterSelect()`, `filterMultiSelect()` (and booleans) | `options`, `counts`, `searchable`, `multiple` |
| `DataTableBooleanFilter` | `filterSelect()` on a boolean | `labels` (those of `->labels()` by default) |
| `DataTableSliderFilter` | `filterRange()` on a number | `step` |
| `DataTableDateFilter` | `filterDate()`, `filterRange()` on a date | one day or a range, from the variant |
| `DataTableTextFilter` | `filterInput()` on text | other attributes go to the input; `class` replaces the default width (`w-40`) |
| `DataTableNumberFilter` | `filterInput()` on a number | other attributes go to the input; `class` replaces the default width (`w-30`) |

The popover filters also take `title`, `icon` (`null` hides it), `class` (the button), `contentClass` (the popover), `align` and `disabled`.

**Other pieces**, all from `@/components/data-table`: `DataTableProvider`, `DataTableSearch` (`searchable`, `placeholder`, `class`), `DataTableFilters` (`:columns="['status', 'price']"`), `DataTableFilter` (`column="status"`), `DataTableResetButton` (its default slot replaces the text and is its accessible name; `icon`), `DataTableViewOptions` (`class`, `contentClass`, `align`, `icon`), `DataTableFilterList` and `DataTableSortList` (the same props; see below), `DataTablePagination`, `DataTablePageSize` (`pageSizeOptions`, `side`, `hideLabel`), `DataTablePageInfo`, `DataTablePageNav` (`firstLast`) and `DataTableSelectedRows`.

```vue
<DataTableProvider :table="table">
    <div class="flex gap-4">
        <aside class="flex w-64 flex-col items-start gap-2">
            <DataTableFacetedFilter column="status" :icon="Tag" :counts="false" class="w-full justify-start" />
            <DataTableSliderFilter column="price" :step="1000" class="w-full justify-start" />
            <DataTableDateFilter column="published_at" class="w-full justify-start" />
            <DataTableResetButton>Clear all</DataTableResetButton>
        </aside>
        <div class="flex min-w-0 flex-1 flex-col gap-3">
            <div class="flex items-center gap-2">
                <DataTableViewOptions />
                <DataTableSearch class="flex-1" />
                <DataTablePageNav :first-last="false" />
            </div>
            <DataTable :pagination="false" aria-label="Products" />
            <div class="flex items-center justify-between">
                <DataTablePageSize side="bottom" />
                <DataTablePageInfo />
            </div>
        </div>
    </div>
</DataTableProvider>
```

**Advanced filters and multi-sort.** `DataTableFilterList` (a row per filter with its column, operator and value, combined with AND or OR: `join=or`) and `DataTableSortList` (a row per sorted column with its direction, in order of priority) are not part of the default toolbar; put them in its default slot:

```vue
<DataTableToolbar :table="table">
    <DataTableFilterList :table="table" />
    <DataTableSortList :table="table" />
</DataTableToolbar>
```

The filter list edits the same filters as the toolbar, so a toolbar filter shows up as a row of the list. Each row offers only the columns with a filter in the PHP class and the operators of their variant; a row without a value stays in the list but is not sent until it has one. From the second row, a select combines the filters with `and` (the default) or `or`; with `or` the toolbar filters are combined with OR as well, and the counts of the select options only apply the search. "Add filter" stops at `max_filters` and "Add sort" at `max_sorts` (`config/inertia-datatable.php`).

The kind of filter is decided in PHP: to change it, change the column in the table class, not the component.

## Custom meta (icons, labels)

Page meta wins over server meta, so you can decorate options while keeping server counts:

```ts
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

The same as in React: return the raw request URI from the app's `HandleInertiaRequests` middleware (`urlResolver()`, see "Readable URLs" in `react.md`).

## Several tables on one page

Call the composable once per table with its own prop and give each backend table a `name()`; the composable builds URLs with the prefixed parameter names returned by the server.

## Files installed by the registry

- `composables/useServerDataTable.ts` — the composable and `getOptionLabel`.
- `components/data-table/index.ts` — every component and helper of the table.
- `components/data-table/context.ts` — `provideDataTable`, `useDataTable` and the filter props.
- `components/data-table/DataTableCell.vue` — the default cell; the other type cells next to it.
- `lib/data-table-server.ts` — response types (`ServerDataTable<T>`) and state ↔ URL serialization.
- `lib/data-table-tanstack.ts` — TanStack Table and the Vue types the other `lib/` files use; they import TanStack from here.
- `lib/data-table-{advanced,columns,features,filter-options,filter-values,format,loading,messages,types,utils}.ts`, `components/data-table/*`, `components/ui/faceted/*`.

These files belong to the project after installation: adapt styles there. `php artisan inertia-datatable:ui --update` brings the latest version of exactly these files (and nothing else in `components/ui/`), overwriting local changes — check `git diff` afterwards and re-apply the project's customizations.
