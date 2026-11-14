<script setup lang="ts" generic="TData extends RowData">
import type { HTMLAttributes } from 'vue';

import { getFilterAffixes } from '@/lib/data-table-format';
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
 * Exact value filter of a number column with `->filterInput()`, with the unit
 * or currency of the column next to it; other attributes go to the input.
 */
const props = defineProps<{
    /** Not needed inside a provider or with a column object. */
    table?: DataTableInstance<TData>;
    /** Id of the column in the PHP table class (or the TanStack column). */
    column: DataTableColumnRef<TData>;
    class?: HTMLAttributes['class'];
}>();

const column = useDataTableFilterColumn(
    'DataTableNumberFilter',
    props.column,
    props.table,
);
</script>

<template>
    <!-- `numeric` gives a keypad without a decimal separator on iOS. -->
    <DataTableFilterInput
        v-if="column"
        :column="column"
        type="number"
        inputmode="decimal"
        :affixes="getFilterAffixes(column.columnDef.meta)"
        :placeholder="
            column.columnDef.meta?.placeholder ?? column.columnDef.meta?.label
        "
        :aria-label="column.columnDef.meta?.label ?? column.id"
        v-bind="$attrs"
        :class="cn('w-30', props.class)"
    />
</template>
