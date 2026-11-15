<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import { ListFilter } from '@lucide/vue';
import { useDirection } from 'reka-ui';
import {
    computed,
    type HTMLAttributes,
    ref,
    shallowRef,
    useId,
    watch,
} from 'vue';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    createFilterListItem,
    type FilterListRow,
    getFilterListItems,
    getRowFilters,
    reconcileFilterRows,
} from '@/lib/data-table-advanced';
import { getMessage } from '@/lib/data-table-messages';
import type { DataTableIcon, RowData } from '@/lib/data-table-tanstack';
import type { ColumnFilterItem } from '@/lib/data-table-types';
import { cn } from '@/lib/utils';

import { type DataTableInstance, useDataTable } from './context';
import DataTableFilterItem from './DataTableFilterItem.vue';

/**
 * Advanced filters: a row per filter with its column, operator and value,
 * combined with AND or OR (`join`). It edits the same filters as the toolbar,
 * so a toolbar filter shows up here as a row.
 */
const props = withDefaults(
    defineProps<{
        /** Not needed inside a provider. */
        table?: DataTableInstance<TData>;
        disabled?: boolean;
        /** Classes of the button. */
        class?: HTMLAttributes['class'];
        /** Classes of the popover. */
        contentClass?: HTMLAttributes['class'];
        /** Alignment of the popover with the button. */
        align?: 'start' | 'center' | 'end';
        /** Icon of the button; `null` hides it. */
        icon?: DataTableIcon | null;
    }>(),
    { align: 'start', icon: undefined },
);

const table = useDataTable(props.table, 'DataTableFilterList');
const dir = useDirection();
const id = useId();
let nextKey = 0;
const createKey = () => `${id}-${++nextKey}`;

const columns = computed(() =>
    table
        .getAllColumns()
        .filter(
            (column) =>
                column.getCanFilter() &&
                column.columnDef.meta?.filterVariant !== undefined,
        ),
);
const getColumn = (columnId: string) =>
    columns.value.find((column) => column.id === columnId);
const items = computed(() =>
    getFilterListItems(
        table.atoms.columnFilters.get(),
        (columnId) => getColumn(columnId)?.columnDef.meta?.filterVariant,
    ),
);

const rows = shallowRef<FilterListRow[]>([]);

// A change of the table filters (the server answer, the toolbar) keeps the
// rows in place, also those still without a value.
watch(
    items,
    (filters) => {
        rows.value = reconcileFilterRows(rows.value, filters, createKey);
    },
    { immediate: true },
);

const join = computed(() => table.options.meta?.join ?? 'and');
const maxFilters = computed(() => table.options.meta?.maxFilters ?? Infinity);
const addButton = ref<InstanceType<typeof Button> | null>(null);

function commit(next: FilterListRow[]) {
    const sent = getRowFilters(rows.value);
    const filters = getRowFilters(next);

    rows.value = next;

    if (signature(sent) !== signature(filters)) {
        table.setColumnFilters(filters);
    }
}

function updateRow(key: string, filter: ColumnFilterItem) {
    commit(rows.value.map((row) => (row.key === key ? { key, filter } : row)));
}

function addRow() {
    const [column] = columns.value;
    const variant = column?.columnDef.meta?.filterVariant;

    if (!column || !variant) return;

    const key = createKey();

    rows.value = [
        ...rows.value,
        { key, filter: createFilterListItem(column.id, variant, key) },
    ];
}

function removeRow(key: string) {
    commit(rows.value.filter((row) => row.key !== key));
    (addButton.value?.$el as HTMLElement | undefined)?.focus();
}

function reset() {
    rows.value = [];
    table.setColumnFilters([]);
    if (join.value !== 'and') table.options.meta?.setJoin?.('and');
}

/** What the server receives of some filters, to skip a visit that changes nothing. */
function signature(filters: ColumnFilterItem[]) {
    return JSON.stringify(
        filters.map((filter) => [filter.id, filter.operator, filter.value]),
    );
}
</script>

<template>
    <Popover>
        <PopoverTrigger as-child>
            <Button
                data-slot="data-table-filter-list-trigger"
                variant="outline"
                :class="props.class"
                :disabled="disabled"
            >
                <component
                    :is="icon ?? ListFilter"
                    v-if="icon !== null"
                    class="text-muted-foreground"
                />
                {{ getMessage(table, 'filters') }}
                <Badge
                    v-if="items.length > 0"
                    variant="secondary"
                    class="h-[18.24px] rounded-[3.2px] px-[5.12px] font-mono text-[10.4px] font-normal"
                >
                    {{ items.length }}
                </Badge>
            </Button>
        </PopoverTrigger>
        <PopoverContent
            data-slot="data-table-filter-list"
            :aria-label="getMessage(table, 'filters')"
            :dir="dir"
            :align="align"
            :class="
                cn(
                    'flex w-[calc(100vw-2rem)] max-w-[44rem] flex-col gap-3.5 p-4',
                    contentClass,
                )
            "
        >
            <div class="flex flex-col gap-1">
                <h4 class="leading-none font-medium">
                    {{
                        rows.length > 0
                            ? getMessage(table, 'filters')
                            : getMessage(table, 'filters_none')
                    }}
                </h4>
                <p
                    v-if="rows.length === 0"
                    class="text-sm text-muted-foreground"
                >
                    {{ getMessage(table, 'filters_description') }}
                </p>
            </div>
            <div
                v-if="rows.length > 0"
                role="list"
                class="flex max-h-80 flex-col gap-2 overflow-y-auto py-0.5"
            >
                <template v-for="(row, index) in rows" :key="row.key">
                    <DataTableFilterItem
                        v-if="getColumn(row.filter.id)"
                        :row="row"
                        :index="index"
                        :column="getColumn(row.filter.id)!"
                        :columns="columns"
                        :join="join"
                        :on-join-change="table.options.meta?.setJoin"
                        @change="updateRow(row.key, $event)"
                        @remove="removeRow(row.key)"
                    />
                </template>
            </div>
            <div class="flex w-full items-center gap-2">
                <Button
                    ref="addButton"
                    size="sm"
                    class="rounded"
                    :disabled="
                        columns.length === 0 || rows.length >= maxFilters
                    "
                    @click="addRow"
                >
                    {{ getMessage(table, 'add_filter') }}
                </Button>
                <Button
                    v-if="rows.length > 0"
                    variant="outline"
                    size="sm"
                    class="rounded"
                    @click="reset"
                >
                    {{ getMessage(table, 'reset_filters') }}
                </Button>
            </div>
        </PopoverContent>
    </Popover>
</template>
