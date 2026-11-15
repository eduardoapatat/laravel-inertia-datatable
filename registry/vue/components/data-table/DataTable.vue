<script setup lang="ts" generic="TData extends RowData">
import { useDirection } from 'reka-ui';
import {
    computed,
    type ComponentPublicInstance,
    type HTMLAttributes,
    ref,
    useAttrs,
} from 'vue';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { getMessage } from '@/lib/data-table-messages';
import {
    type Cell,
    type ColumnPinningPosition,
    FlexRender,
    type Row,
    type RowData,
} from '@/lib/data-table-tanstack';
import type { DataTableLoadingPhase } from '@/lib/data-table-types';
import {
    getAriaSort,
    getColumnAlign,
    getColumnClassName,
    getColumnPinningStyle,
    getColumnSizingStyle,
    getVisibleSelectedRows,
    hasBadge,
} from '@/lib/data-table-utils';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';
import DataTablePagination from './DataTablePagination.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
    defineProps<{
        /** Not needed inside a provider. */
        table?: DataTableInstance<TData>;
        /**
         * Renders the pagination below the table. With `false`, place
         * `<DataTablePagination />` or its pieces wherever you want (e.g. on
         * top).
         */
        pagination?: boolean;
        /**
         * Classes of the header row; for its cells, `[&>th]:h-8` (shorter
         * header).
         */
        headerClass?: HTMLAttributes['class'];
        /**
         * Classes of each body row, or a function of the row (for example, to
         * color it by its data); for its cells, `[&>td]:py-1` (compact rows).
         */
        rowClass?:
            | string
            | ((row: Row<DataTableFeatures, TData>) => string | undefined);
        /**
         * Shows that a visit is loading: after `loadingDelay` the rows dim,
         * after `skeletonDelay` they turn into skeletons (both options of
         * `useServerDataTable`); when a visit fails by network, a notice with
         * a retry button. With `false`, nothing is shown; handle it yourself
         * with the `loading`, `failed` and `retry` the composable returns.
         */
        loading?: 'auto' | false;
        class?: HTMLAttributes['class'];
    }>(),
    { pagination: true, loading: 'auto' },
);

defineSlots<{
    /** Above the table: the toolbar, for example. */
    default?: () => unknown;
    /** Shown below the table while there are selected rows on the page. */
    'action-bar'?: () => unknown;
}>();

const table = useDataTable(props.table, 'DataTable');
const dir = useDirection();
const attrs = useAttrs();

// `aria-label` and `aria-labelledby` name the table; the rest go to the root.
const rootAttrs = computed(() =>
    Object.fromEntries(
        Object.entries(attrs).filter(
            ([key]) => key !== 'aria-label' && key !== 'aria-labelledby',
        ),
    ),
);

const phase = computed<DataTableLoadingPhase>(() =>
    props.loading === false ? 'idle' : (table.options.meta?.loading ?? 'idle'),
);
const isLoading = computed(() => phase.value !== 'idle');
const failed = computed(
    () => props.loading !== false && table.options.meta?.failed === true,
);
const rows = computed(() => table.getRowModel().rows);
const hasVisibleSelectedRows = computed(
    () => getVisibleSelectedRows(table).length > 0,
);

// With the focus on a row (a link, a checkbox, its actions) the rows stay,
// dimmed: turning them into skeletons would drop the focus.
const body = ref<ComponentPublicInstance | null>(null);
const showSkeleton = computed(() => {
    const element = body.value?.$el as HTMLElement | undefined;

    return (
        phase.value === 'slow' &&
        !(element?.contains(document.activeElement) ?? false)
    );
});

// Rows on screen; with none, the page size, so the height stays.
const skeletonRows = computed(
    () => rows.value.length || table.atoms.pagination.get().pageSize,
);

function getCellClass(pinned: ColumnPinningPosition) {
    return pinned
        ? 'overflow-hidden bg-background transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-has-[[aria-expanded=true]]/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-data-[state=selected]/row:bg-muted'
        : 'overflow-hidden';
}

function getCellClassNames(cell: Cell<DataTableFeatures, TData>) {
    return getColumnClassName(
        cell.column.columnDef.meta,
        'cell',
        cell as Cell<DataTableFeatures, RowData>,
    );
}

function getRowClass(row: Row<DataTableFeatures, TData>) {
    return typeof props.rowClass === 'function'
        ? props.rowClass(row)
        : props.rowClass;
}
</script>

<template>
    <div
        data-slot="data-table"
        :dir="dir"
        :class="cn('flex w-full flex-col gap-2.5 overflow-auto', props.class)"
        v-bind="rootAttrs"
    >
        <slot />
        <div
            :aria-busy="isLoading || undefined"
            :data-loading="isLoading ? phase : undefined"
            class="isolate overflow-hidden rounded-md border"
        >
            <!-- The container and the table of the project's `Table`, drawn
                 here so `aria-label` and the column sizes reach the <table>
                 (shadcn-vue's `Table` gives them to its container). -->
            <div
                data-slot="table-container"
                class="relative w-full overflow-auto"
            >
                <table
                    data-slot="table"
                    class="w-full table-fixed caption-bottom text-sm"
                    :style="getColumnSizingStyle(table)"
                    :aria-label="attrs['aria-label'] as string | undefined"
                    :aria-labelledby="
                        attrs['aria-labelledby'] as string | undefined
                    "
                >
                    <TableHeader>
                        <TableRow
                            v-for="headerGroup in table.getHeaderGroups()"
                            :key="headerGroup.id"
                            :class="cn('group/row', headerClass)"
                        >
                            <TableHead
                                v-for="header in headerGroup.headers"
                                :key="header.id"
                                :aria-sort="
                                    getAriaSort(
                                        table.atoms.sorting.get(),
                                        header.column.id,
                                    )
                                "
                                :colspan="header.colSpan"
                                :data-align="
                                    getColumnAlign(header.column.columnDef.meta)
                                "
                                :class="
                                    cn(
                                        'group/head',
                                        getCellClass(
                                            header.column.getIsPinned(),
                                        ),
                                        ...getColumnClassName(
                                            header.column.columnDef.meta,
                                            'header',
                                        ),
                                    )
                                "
                                :style="getColumnPinningStyle(header.column)"
                            >
                                <FlexRender
                                    v-if="!header.isPlaceholder"
                                    :header="header"
                                />
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody v-if="showSkeleton">
                        <TableRow
                            v-for="index in skeletonRows"
                            :key="index"
                            class="hover:bg-transparent"
                        >
                            <TableCell
                                v-for="column in table.getVisibleLeafColumns()"
                                :key="column.id"
                                :class="
                                    cn(
                                        getCellClass(column.getIsPinned()),
                                        ...getColumnClassName(
                                            column.columnDef.meta,
                                            'cell',
                                        ),
                                    )
                                "
                                :style="getColumnPinningStyle(column)"
                            >
                                <!-- A badge is a bit taller than a line of text. -->
                                <Skeleton
                                    :class="
                                        cn(
                                            'w-full',
                                            hasBadge(
                                                column.columnDef.meta?.display,
                                            )
                                                ? 'h-5.5'
                                                : 'h-5',
                                        )
                                    "
                                />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                    <TableBody v-else-if="rows.length === 0">
                        <TableRow>
                            <TableCell
                                :colspan="
                                    table.getVisibleLeafColumns().length || 1
                                "
                                class="h-24 text-center"
                            >
                                {{ getMessage(table, 'no_results') }}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                    <TableBody
                        v-else
                        ref="body"
                        :class="
                            cn(
                                'transition-opacity duration-200 motion-reduce:transition-none',
                                phase !== 'idle' && 'opacity-60',
                            )
                        "
                    >
                        <TableRow
                            v-for="row in rows"
                            :key="row.id"
                            :data-state="
                                row.getIsSelected() ? 'selected' : undefined
                            "
                            :class="cn('group/row', getRowClass(row))"
                        >
                            <!-- Content that does not fit ends in "…" instead of
                             touching the next column; `text-clip` in
                             `meta.cellClassName` undoes it. -->
                            <TableCell
                                v-for="cell in row.getVisibleCells()"
                                :key="cell.id"
                                :class="
                                    cn(
                                        getCellClass(cell.column.getIsPinned()),
                                        'text-ellipsis',
                                        ...getCellClassNames(cell),
                                    )
                                "
                                :style="getColumnPinningStyle(cell.column)"
                            >
                                <FlexRender :cell="cell" />
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </table>
            </div>
        </div>
        <div
            v-if="failed"
            role="alert"
            data-slot="data-table-error"
            class="flex items-center justify-between gap-2 rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive"
        >
            <span>{{ getMessage(table, 'load_error') }}</span>
            <Button
                v-if="table.options.meta?.retry"
                type="button"
                variant="outline"
                size="sm"
                class="h-7"
                @click="table.options.meta?.retry?.()"
            >
                {{ getMessage(table, 'retry') }}
            </Button>
        </div>
        <div
            v-if="
                pagination || ($slots['action-bar'] && hasVisibleSelectedRows)
            "
            class="flex flex-col gap-2.5"
        >
            <DataTablePagination v-if="pagination" :table="table" />
            <slot v-if="hasVisibleSelectedRows" name="action-bar" />
        </div>
    </div>
</template>
