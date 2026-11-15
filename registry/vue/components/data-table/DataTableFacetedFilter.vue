<script setup lang="ts" generic="TData extends RowData">
import { computed } from 'vue';

import {
    getBooleanFilterOptions,
    getFacetedFilterOptions,
} from '@/lib/data-table-filter-options';
import { getMessage } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';
import type { ColumnSelectOption } from '@/lib/data-table-types';

import {
    type DataTableFilterPieceProps,
    useDataTableFilterColumn,
} from './context';
import DataTableFacetedFilterContent from './DataTableFacetedFilterContent.vue';

/**
 * List filter for `select`, `multi-select` and `boolean` columns: one popover
 * with the options of the server and their counts.
 */
const props = withDefaults(
    defineProps<
        Omit<DataTableFilterPieceProps<TData>, 'column'> & {
            /**
             * Id of a `select`, `multi-select` or `boolean` column of the PHP
             * class. Without it, the filter only shows `options` (no table
             * needed).
             */
            column?: DataTableFilterPieceProps<TData>['column'];
            /**
             * Relabels, reorders or leaves out the server options (matched by
             * `value`); values the server did not declare are ignored.
             */
            options?: ColumnSelectOption[];
            /** Several values at once; by default, when the column is `multi-select`. */
            multiple?: boolean;
            /** Shows the number of rows of each option. */
            counts?: boolean;
            /** Shows the search box of the list. */
            searchable?: boolean;
        }
    >(),
    {
        column: undefined,
        options: undefined,
        multiple: undefined,
        counts: true,
        searchable: true,
        icon: undefined,
    },
);

const column =
    props.column === undefined
        ? undefined
        : useDataTableFilterColumn(
              'DataTableFacetedFilter',
              props.column,
              props.table,
          );

const options = computed(() => {
    if (!column) return props.options ?? [];

    const meta = column.columnDef.meta;
    const serverOptions =
        meta?.filterVariant === 'boolean'
            ? getBooleanFilterOptions(meta, {
                  yes: getMessage(column.table, 'yes'),
                  no: getMessage(column.table, 'no'),
              })
            : (meta?.options ?? []);

    return getFacetedFilterOptions(serverOptions, props.options);
});
</script>

<template>
    <DataTableFacetedFilterContent
        v-if="column || props.column === undefined"
        :column="column"
        :options="options"
        :title="title"
        :multiple="
            multiple ?? column?.columnDef.meta?.filterVariant === 'multi-select'
        "
        :counts="counts"
        :searchable="searchable"
        :icon="icon"
        :class="props.class"
        :content-class="contentClass"
        :align="align"
        :disabled="disabled"
    />
</template>
