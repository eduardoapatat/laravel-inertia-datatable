<script setup lang="ts" generic="TData extends RowData">
import { computed, type HTMLAttributes } from 'vue';

import { formatNumber } from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';
import { getVisibleSelectedRows } from '@/lib/data-table-utils';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';

/**
 * "2 rows selected" (and how many of them are on other pages); empty without
 * a selection.
 */
const props = defineProps<{
    /** Not needed inside a provider. */
    table?: DataTableInstance<TData>;
    class?: HTMLAttributes['class'];
}>();

const table = useDataTable(props.table, 'DataTableSelectedRows');

const text = computed(() => {
    const selected = table.getSelectedRowIds().length;
    const hidden = selected - getVisibleSelectedRows(table).length;
    const count = (value: number) =>
        formatNumber(value, {}, table.options.meta?.locale);

    if (selected === 0) return '';

    return [
        getMessage(table, selected === 1 ? 'row_selected' : 'rows_selected', {
            count: count(selected),
        }),
        hidden > 0
            ? getMessage(table, 'not_shown', { count: count(hidden) })
            : null,
    ]
        .filter(Boolean)
        .join(' ');
});
</script>

<template>
    <div
        role="status"
        data-slot="data-table-selected-rows"
        :class="
            cn('text-sm whitespace-nowrap text-muted-foreground', props.class)
        "
    >
        {{ text }}
    </div>
</template>
