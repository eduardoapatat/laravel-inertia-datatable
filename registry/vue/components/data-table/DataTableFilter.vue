<script setup lang="ts" generic="TData extends RowData">
import { computed } from 'vue';

import type { RowData } from '@/lib/data-table-tanstack';

import { type DataTableInstance, useDataTable } from './context';
import DataTableToolbarFilter from './DataTableToolbarFilter.vue';

/**
 * The filter of a single column, with the component of its type. To pass
 * props to it, use that component (`DataTableFacetedFilter`…) instead.
 */
const props = defineProps<{
    /** Not needed inside a provider. */
    table?: DataTableInstance<TData>;
    /** Id of the column in the table class. */
    column: string;
}>();

const table = useDataTable(props.table, 'DataTableFilter');

const found = computed(() =>
    table
        .getAllColumns()
        .find((item) => item.id === props.column && item.getCanFilter()),
);
</script>

<template>
    <DataTableToolbarFilter v-if="found" :column="found" />
</template>
