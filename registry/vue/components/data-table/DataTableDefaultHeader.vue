<script setup lang="ts">
import type { DataTableAnyColumn } from './cells';
import DataTableColumnHeader from './DataTableColumnHeader.vue';

/**
 * Header of a column the component does not customize: the label declared by
 * the table class, with sorting and hiding when the column allows them. The
 * other keys of the header context are accepted too, so they never end up as
 * attributes.
 */
defineProps<{
    column: DataTableAnyColumn;
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
