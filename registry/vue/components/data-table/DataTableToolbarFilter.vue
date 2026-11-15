<script setup lang="ts" generic="TData extends RowData">
import type { DataTableFeatures } from '@/lib/data-table-features';
import type { Column, RowData } from '@/lib/data-table-tanstack';

import DataTableBooleanFilter from './DataTableBooleanFilter.vue';
import DataTableDateFilter from './DataTableDateFilter.vue';
import DataTableFacetedFilter from './DataTableFacetedFilter.vue';
import DataTableNumberFilter from './DataTableNumberFilter.vue';
import DataTableSliderFilter from './DataTableSliderFilter.vue';
import DataTableTextFilter from './DataTableTextFilter.vue';

/**
 * Filter of a column with the component of its server variant.
 */
defineProps<{
    column: Column<DataTableFeatures, TData>;
}>();
</script>

<template>
    <DataTableTextFilter
        v-if="column.columnDef.meta?.filterVariant === 'text'"
        :column="column"
        class="lg:w-56"
    />
    <DataTableNumberFilter
        v-else-if="column.columnDef.meta?.filterVariant === 'number'"
        :column="column"
    />
    <DataTableSliderFilter
        v-else-if="column.columnDef.meta?.filterVariant === 'range'"
        :column="column"
    />
    <DataTableDateFilter
        v-else-if="
            column.columnDef.meta?.filterVariant === 'date' ||
            column.columnDef.meta?.filterVariant === 'date-range'
        "
        :column="column"
    />
    <DataTableBooleanFilter
        v-else-if="column.columnDef.meta?.filterVariant === 'boolean'"
        :column="column"
    />
    <DataTableFacetedFilter
        v-else-if="
            column.columnDef.meta?.filterVariant === 'select' ||
            column.columnDef.meta?.filterVariant === 'multi-select'
        "
        :column="column"
    />
</template>
