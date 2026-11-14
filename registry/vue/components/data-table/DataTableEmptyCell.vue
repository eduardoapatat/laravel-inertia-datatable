<script setup lang="ts" generic="TData extends RowData">
import { computed } from 'vue';

import { getMessage } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';

import { type DataTableCellProps, getCellSetup } from './cells';

/**
 * Cell without a value: the text of `->whenEmpty()` or the `empty` text of the
 * UI (`—`), muted. Every type cell shows it for `null` and `''`.
 */
const props = defineProps<DataTableCellProps<TData>>();

const text = computed(
    () =>
        getCellSetup(props.cell).meta?.display?.empty ??
        getMessage(props.cell.table, 'empty'),
);
</script>

<template>
    <span
        v-if="text"
        data-slot="data-table-empty"
        class="text-muted-foreground"
    >
        {{ text }}
    </span>
</template>
