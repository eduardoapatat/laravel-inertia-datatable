<script setup lang="ts" generic="TData extends RowData, TValue = unknown">
import type { DataTableFeatures } from '@/lib/data-table-features';
import type { Column, RowData } from '@/lib/data-table-tanstack';

import DataTableColumnHeader from './DataTableColumnHeader.vue';

/**
 * Header of a column the component does not customize: the label declared by
 * the table class, with sorting and hiding when the column allows them. The
 * other keys of the header context are accepted too, so it can be the
 * `header` of a column as is.
 */
defineProps<{
    column: Column<DataTableFeatures, TData, TValue>;
    header?: unknown;
    table?: unknown;
}>();
</script>

<template>
    <DataTableColumnHeader
        :column="column"
        :label="column.columnDef.meta?.label ?? column.id"
    />
</template>
