<script setup lang="ts" generic="TData extends RowData">
import { computed } from 'vue';

import type { RowData } from '@/lib/data-table-tanstack';

import { type DataTableInstance, useDataTable } from './context';
import DataTableToolbarFilter from './DataTableToolbarFilter.vue';

/**
 * One control per filterable column, in the table order or in the order of
 * `columns`. No wrapper: they are laid out inside the parent container.
 */
const props = defineProps<{
    /** Not needed inside a provider. */
    table?: DataTableInstance<TData>;
    /** Ids of the columns to show, in this order; all of them by default. */
    columns?: string[];
}>();

const table = useDataTable(props.table, 'DataTableFilters');

const shown = computed(() => {
    const filterable = table
        .getAllColumns()
        .filter((column) => column.getCanFilter());

    return props.columns
        ? props.columns.flatMap((id) =>
              filterable.filter((column) => column.id === id),
          )
        : filterable;
});
</script>

<template>
    <DataTableToolbarFilter
        v-for="column in shown"
        :key="column.id"
        :column="column"
    />
</template>
