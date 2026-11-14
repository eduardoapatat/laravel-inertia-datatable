<script setup lang="ts" generic="TData extends RowData">
import { computed } from 'vue';

import {
    formatBoolean,
    formatCellValue,
    getOwn,
} from '@/lib/data-table-format';
import type { RowData } from '@/lib/data-table-tanstack';

import {
    type DataTableBadgeVariant,
    type DataTableCellProps,
    getCellSetup,
} from './cells';
import DataTableEmptyCell from './DataTableEmptyCell.vue';
import DataTableOptionBadge from './DataTableOptionBadge.vue';

/**
 * The labels of `->labels()` or the Yes / No texts of the table, with the
 * icon of `meta.icons.true` / `meta.icons.false`; with `->badge()`, inside the
 * project's Badge (variant of `true` / `false`, else the column one).
 */
const props = defineProps<DataTableCellProps<TData>>();

const view = computed(() => {
    const { meta, context } = getCellSetup(props.cell);
    const display =
        meta?.display?.type === 'boolean' ? meta.display : undefined;
    const value = props.cell.getValue();
    const text = formatCellValue(
        display ? meta : { ...meta, display: { type: 'boolean' } },
        value,
        context,
    );
    const key =
        formatBoolean(value, { true: 'true', false: 'false' }) === 'true'
            ? 'true'
            : 'false';
    const icon = meta?.icons?.[key];

    return {
        text,
        icon,
        option: icon ? { value: key, label: text, icon } : undefined,
        badge: display?.badge === true,
        variant: (getOwn(display?.variants, key) ??
            display?.variant ??
            'outline') as DataTableBadgeVariant,
    };
});
</script>

<template>
    <DataTableEmptyCell v-if="view.text === ''" :cell="cell" />
    <DataTableOptionBadge
        v-else-if="view.badge"
        :option="view.option"
        :variant="view.variant"
        >{{ view.text }}</DataTableOptionBadge
    >
    <span v-else-if="view.icon" class="inline-flex items-center gap-1.5">
        <component
            :is="view.icon"
            aria-hidden="true"
            class="size-3.5 shrink-0 text-muted-foreground"
        />
        {{ view.text }}
    </span>
    <template v-else>{{ view.text }}</template>
</template>
