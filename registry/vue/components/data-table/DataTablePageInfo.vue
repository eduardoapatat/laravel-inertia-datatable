<script setup lang="ts" generic="TData extends RowData">
import { computed, type HTMLAttributes } from 'vue';

import { formatNumber } from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';

/**
 * "Page 2 of 31".
 */
const props = defineProps<{
    /** Not needed inside a provider. */
    table?: DataTableInstance<TData>;
    class?: HTMLAttributes['class'];
}>();

const table = useDataTable(props.table, 'DataTablePageInfo');

const text = computed(() => {
    const count = (value: number) =>
        formatNumber(value, {}, table.options.meta?.locale);

    // The page count comes from the server response (rowCount), not the state.
    return getMessage(table, 'page_of', {
        page: count(table.atoms.pagination.get().pageIndex + 1),
        pages: count(table.getPageCount()),
    });
});
</script>

<template>
    <div
        role="status"
        data-slot="data-table-page-info"
        :class="
            cn(
                'flex items-center justify-center text-sm font-medium whitespace-nowrap',
                props.class,
            )
        "
    >
        {{ text }}
    </div>
</template>
