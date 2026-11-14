<script setup lang="ts" generic="TData extends RowData, TValue = unknown">
import { computed, useId } from 'vue';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    type DataTableFeatures,
    getEmptyFilter,
    setEmptyFilter,
} from '@/lib/data-table-features';
import { getEmptyLabel } from '@/lib/data-table-format';
import type { Column, RowData } from '@/lib/data-table-tanstack';

/**
 * Check of the range and date filters that adds the rows without a value
 * (`empty: true` in PHP) to the picked range, or shows only them.
 */
const props = defineProps<{
    column: Column<DataTableFeatures, TData, TValue>;
}>();

const id = useId();
const checked = computed(() => getEmptyFilter(props.column));

function onCheckedChange(value: boolean | 'indeterminate') {
    setEmptyFilter(props.column, value === true);
}
</script>

<template>
    <div data-slot="data-table-empty-filter" class="flex items-center gap-2">
        <Checkbox
            :id="id"
            :model-value="checked"
            @update:model-value="onCheckedChange"
        />
        <Label :for="id" class="font-normal">
            {{ getEmptyLabel(column.columnDef.meta, column.table) }}
        </Label>
    </div>
</template>
