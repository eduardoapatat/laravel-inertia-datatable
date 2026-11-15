<script setup lang="ts" generic="TData extends RowData">
import { computed } from 'vue';

import {
    getBooleanFilterOptions,
    getFacetedFilterOptions,
} from '@/lib/data-table-filter-options';
import { getMessage } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';

import {
    type DataTableFilterPieceProps,
    useDataTableFilterColumn,
} from './context';
import DataTableFacetedFilterContent from './DataTableFacetedFilterContent.vue';

/**
 * Yes / No filter of a `boolean` column (`->filterSelect()` in PHP).
 */
const props = withDefaults(
    defineProps<
        DataTableFilterPieceProps<TData> & {
            /** Texts of `true` and `false`; those of `->labels()` by default. */
            labels?: { true: string; false: string };
            /** Shows the number of rows of each option. */
            counts?: boolean;
            /** Shows the search box of the list. */
            searchable?: boolean;
        }
    >(),
    { counts: true, searchable: true, icon: undefined },
);

const column = useDataTableFilterColumn(
    'DataTableBooleanFilter',
    props.column,
    props.table,
);

const options = computed(() =>
    column
        ? getFacetedFilterOptions(
              getBooleanFilterOptions(
                  column.columnDef.meta,
                  {
                      yes: getMessage(column.table, 'yes'),
                      no: getMessage(column.table, 'no'),
                  },
                  props.labels,
              ),
          )
        : [],
);
</script>

<template>
    <DataTableFacetedFilterContent
        v-if="column"
        :column="column"
        :options="options"
        :title="title"
        :counts="counts"
        :searchable="searchable"
        :icon="icon"
        :class="props.class"
        :content-class="contentClass"
        :align="align"
        :disabled="disabled"
    />
</template>
