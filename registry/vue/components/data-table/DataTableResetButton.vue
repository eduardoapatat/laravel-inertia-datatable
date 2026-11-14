<script setup lang="ts" generic="TData extends RowData">
import { X } from '@lucide/vue';
import { computed } from 'vue';

import { Button } from '@/components/ui/button';
import { getMessage } from '@/lib/data-table-messages';
import type { DataTableIcon, RowData } from '@/lib/data-table-tanstack';

import { type DataTableInstance, useDataTable } from './context';

/**
 * Clears the filters and the search; only shown while one of them is active.
 * With content in the default slot, it is also its accessible name.
 */
const props = withDefaults(
    defineProps<{
        /** Not needed inside a provider. */
        table?: DataTableInstance<TData>;
        /** Icon before the text; `null` hides it. */
        icon?: DataTableIcon | null;
    }>(),
    { icon: undefined },
);

const slots = defineSlots<{ default?: () => unknown }>();

const table = useDataTable(props.table, 'DataTableResetButton');
const isFiltered = computed(
    () =>
        table.atoms.columnFilters.get().length > 0 ||
        Boolean(table.atoms.globalFilter.get()),
);

function onReset() {
    table.resetColumnFilters(true);
    table.resetGlobalFilter(true);
}
</script>

<template>
    <Button
        v-if="isFiltered"
        :aria-label="
            slots.default ? undefined : getMessage(table, 'reset_filters')
        "
        variant="outline"
        @click="onReset"
    >
        <component :is="icon ?? X" v-if="icon !== null" />
        <slot>{{ getMessage(table, 'reset') }}</slot>
    </Button>
</template>
