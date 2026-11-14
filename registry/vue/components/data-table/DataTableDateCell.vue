<script setup lang="ts" generic="TData extends RowData">
import { computed } from 'vue';

import { formatDateValue, isDateOnly } from '@/lib/data-table-format';
import type { RowData } from '@/lib/data-table-tanstack';

import { type DataTableCellProps, getCellSetup } from './cells';
import DataTableEmptyCell from './DataTableEmptyCell.vue';

/**
 * Date with the preset or Intl options of `->format()`; relative dates
 * keep the full date in the tooltip.
 */
const props = defineProps<DataTableCellProps<TData>>();

const view = computed(() => {
    const { meta, locale, context } = getCellSetup(props.cell);
    const value = props.cell.getValue();
    const format =
        (meta?.display?.type === 'date' ? meta.display.format : undefined) ??
        context.dateFormat ??
        'long';

    return {
        text: formatDateValue(value, format, locale),
        dateTime: typeof value === 'string' ? value : undefined,
        title:
            format === 'relative'
                ? formatDateValue(
                      value,
                      isDateOnly(value) ? 'long' : 'datetime',
                      locale,
                  )
                : undefined,
    };
});
</script>

<template>
    <DataTableEmptyCell v-if="view.text === ''" :cell="cell" />
    <time v-else :datetime="view.dateTime" :title="view.title">{{
        view.text
    }}</time>
</template>
