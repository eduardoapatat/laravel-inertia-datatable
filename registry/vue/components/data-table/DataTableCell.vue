<script setup lang="ts">
import { computed } from 'vue';

import { type DataTableCellProps, getCellSetup } from './cells';
import DataTableBooleanCell from './DataTableBooleanCell.vue';
import DataTableDateCell from './DataTableDateCell.vue';
import DataTableNumberCell from './DataTableNumberCell.vue';
import DataTableOptionCell from './DataTableOptionCell.vue';
import DataTableTextCell from './DataTableTextCell.vue';

/**
 * Default cell: picks the cell of the column type, from the `display` declared
 * in PHP or in the page `meta` (a text cell without it). Every type cell is
 * exported to reuse its formatting inside a custom `cell`.
 */
const props = defineProps<DataTableCellProps>();

const type = computed(() => getCellSetup(props.cell).meta?.display?.type);
</script>

<template>
    <DataTableNumberCell v-if="type === 'number'" :cell="cell" />
    <DataTableDateCell v-else-if="type === 'date'" :cell="cell" />
    <DataTableBooleanCell v-else-if="type === 'boolean'" :cell="cell" />
    <DataTableOptionCell v-else-if="type === 'option'" :cell="cell" />
    <DataTableTextCell v-else :cell="cell" />
</template>
