<script setup lang="ts" generic="TData extends RowData">
import type { HTMLAttributes } from 'vue';

import type { RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import {
    type DataTableColumnRef,
    type DataTableInstance,
    useDataTableFilterColumn,
} from './context';
import DataTableFilterInput from './DataTableFilterInput.vue';

defineOptions({ inheritAttrs: false });

/**
 * Text filter of a column with `->filterInput()` (contains, without case);
 * other attributes go to the input.
 */
const props = defineProps<{
    /** Not needed inside a provider or with a column object. */
    table?: DataTableInstance<TData>;
    /** Id of the column in the PHP table class (or the TanStack column). */
    column: DataTableColumnRef<TData>;
    class?: HTMLAttributes['class'];
}>();

const column = useDataTableFilterColumn(
    'DataTableTextFilter',
    props.column,
    props.table,
);
</script>

<template>
    <DataTableFilterInput
        v-if="column"
        :column="column"
        :placeholder="
            column.columnDef.meta?.placeholder ?? column.columnDef.meta?.label
        "
        :aria-label="column.columnDef.meta?.label ?? column.id"
        v-bind="$attrs"
        :class="cn('w-40', props.class)"
    />
</template>
