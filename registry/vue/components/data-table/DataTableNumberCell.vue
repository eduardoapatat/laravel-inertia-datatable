<script setup lang="ts" generic="TData extends RowData">
import { computed } from 'vue';

import { formatNumberCell, isEmptyValue } from '@/lib/data-table-format';
import type { RowData } from '@/lib/data-table-tanstack';

import { type DataTableCellProps, getCellSetup } from './cells';
import DataTableEmptyCell from './DataTableEmptyCell.vue';

/**
 * Number, currency or percentage with Intl and the table locale; the column is
 * aligned to the end with its header (`meta.align` changes it). The currency
 * code (`cell: 'code'`) and the unit go after the number, smaller and muted.
 */
const props = defineProps<DataTableCellProps<TData>>();

const parts = computed(() => {
    const value = props.cell.getValue();

    if (isEmptyValue(value)) {
        return null;
    }

    const { meta, locale } = getCellSetup(props.cell);

    return formatNumberCell(
        meta?.display?.type === 'number'
            ? meta
            : { ...meta, display: { type: 'number' } },
        value,
        locale,
    );
});
</script>

<template>
    <DataTableEmptyCell v-if="parts === null" :cell="cell" />
    <span v-else data-slot="data-table-number" class="tabular-nums"
        >{{ parts.text
        }}<template v-if="parts.suffix"
            >{{ ' '
            }}<span
                data-slot="data-table-number-suffix"
                class="text-xs text-muted-foreground"
                >{{ parts.suffix }}</span
            ></template
        ></span
    >
</template>
