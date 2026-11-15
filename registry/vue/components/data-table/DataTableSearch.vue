<script setup lang="ts" generic="TData extends RowData">
import { computed, type HTMLAttributes } from 'vue';

import { Input } from '@/components/ui/input';
import { getMessage } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';

/**
 * Global search (`?search=`). Hidden when the table class declares no
 * `searchable()` column, unless forced with `searchable`.
 */
const props = withDefaults(
    defineProps<{
        /** Not needed inside a provider. */
        table?: DataTableInstance<TData>;
        /** Shows the global search; by default, when the server allows it. */
        searchable?: boolean;
        placeholder?: string;
        class?: HTMLAttributes['class'];
    }>(),
    { searchable: undefined },
);

const table = useDataTable(props.table, 'DataTableSearch');
const shown = computed(
    () => props.searchable ?? table.options.meta?.searchable ?? false,
);
const placeholder = computed(
    () => props.placeholder ?? getMessage(table, 'search'),
);
const value = computed(() => {
    const globalFilter = table.atoms.globalFilter.get();

    return typeof globalFilter === 'string' ? globalFilter : '';
});

function onInput(next: string | number) {
    table.setGlobalFilter(String(next));
}
</script>

<template>
    <Input
        v-if="shown"
        type="search"
        :aria-label="placeholder"
        :placeholder="placeholder"
        :class="cn('w-40', props.class)"
        :model-value="value"
        @update:model-value="onInput"
    />
</template>
