<script setup lang="ts" generic="TData extends RowData">
import type { HTMLAttributes } from 'vue';

import type { RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';
import DataTablePageInfo from './DataTablePageInfo.vue';
import DataTablePageNav from './DataTablePageNav.vue';
import DataTablePageSize from './DataTablePageSize.vue';
import DataTableSelectedRows from './DataTableSelectedRows.vue';

/**
 * Default pagination: selected rows on one side; rows per page, current page
 * and the buttons on the other. For another layout, place the pieces
 * (`DataTableSelectedRows`, `DataTablePageSize`, `DataTablePageInfo`,
 * `DataTablePageNav`) yourself, with `<DataTable :pagination="false">`.
 */
const props = defineProps<{
    /** Not needed inside a provider. */
    table?: DataTableInstance<TData>;
    pageSizeOptions?: number[];
    class?: HTMLAttributes['class'];
}>();

const table = useDataTable(props.table, 'DataTablePagination');
</script>

<template>
    <div
        data-slot="data-table-pagination"
        :class="
            cn(
                'flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8',
                props.class,
            )
        "
    >
        <DataTableSelectedRows :table="table" class="flex-1" />
        <div
            class="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8"
        >
            <DataTablePageSize
                :table="table"
                :page-size-options="pageSizeOptions"
            />
            <DataTablePageInfo :table="table" />
            <DataTablePageNav :table="table" />
        </div>
    </div>
</template>
