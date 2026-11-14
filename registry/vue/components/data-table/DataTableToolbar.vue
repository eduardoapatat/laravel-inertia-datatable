<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { HTMLAttributes } from 'vue';

import type { RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';
import DataTableFilters from './DataTableFilters.vue';
import DataTableResetButton from './DataTableResetButton.vue';
import DataTableSearch from './DataTableSearch.vue';
import DataTableViewOptions from './DataTableViewOptions.vue';

/**
 * Default layout: search, filters and Reset on the left; the default slot and
 * the column menu on the right. For another layout, place the pieces yourself
 * (`DataTableSearch`, `DataTableFilters`, `DataTableFilter`, the filters of
 * each type, `DataTableResetButton`, `DataTableViewOptions`), anywhere inside a
 * provider.
 */
const props = withDefaults(
    defineProps<{
        /** Not needed inside a provider. */
        table?: DataTableInstance<TData>;
        /** Shows the global search; by default, when the server allows it. */
        searchable?: boolean;
        searchPlaceholder?: string;
        class?: HTMLAttributes['class'];
    }>(),
    { searchable: undefined },
);

const table = useDataTable(props.table, 'DataTableToolbar');
</script>

<template>
    <div
        data-slot="data-table-toolbar"
        :class="
            cn('flex w-full items-start justify-between gap-2 p-1', props.class)
        "
    >
        <div class="flex flex-1 flex-wrap items-center gap-2">
            <DataTableSearch
                :table="table"
                :searchable="searchable"
                :placeholder="searchPlaceholder"
                class="lg:w-64"
            />
            <DataTableFilters :table="table" />
            <DataTableResetButton :table="table" />
        </div>
        <div class="flex items-center gap-2">
            <slot />
            <DataTableViewOptions
                :table="table"
                align="end"
                class="ms-auto hidden lg:flex"
            />
        </div>
    </div>
</template>
