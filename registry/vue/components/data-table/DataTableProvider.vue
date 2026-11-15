<script setup lang="ts" generic="TData extends RowData">
import type { RowData } from '@/lib/data-table-tanstack';

import { type DataTableInstance, provideDataTable } from './context';

const props = defineProps<{
    table: DataTableInstance<TData>;
}>();

provideDataTable(props.table);
</script>

<template>
    <slot />
</template>
