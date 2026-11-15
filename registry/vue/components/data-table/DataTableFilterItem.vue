<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import { ChevronsUpDown, Trash2 } from '@lucide/vue';
import { useDirection } from 'reka-ui';
import { computed } from 'vue';

import { Button } from '@/components/ui/button';
import {
    Faceted,
    type FacetedSelection,
    FacetedContent,
    FacetedEmpty,
    FacetedGroup,
    FacetedInput,
    FacetedItem,
    FacetedItemIndicator,
    FacetedList,
    FacetedTrigger,
} from '@/components/ui/faceted';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    changeFilterOperator,
    createFilterListItem,
    FILTER_OPERATORS,
    type FilterJoinCell,
    type FilterListRow,
    getFilterOperatorMessageKey,
} from '@/lib/data-table-advanced';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { getMessage } from '@/lib/data-table-messages';
import type { FilterOperator, JoinOperator } from '@/lib/data-table-server';
import type { Column, RowData } from '@/lib/data-table-tanstack';
import type { ColumnFilterItem } from '@/lib/data-table-types';
import { cn } from '@/lib/utils';

import DataTableFilterValue from './DataTableFilterValue.vue';

/**
 * A row of `DataTableFilterList`: how it joins the previous ones, its column,
 * operator and value, and a button to remove it.
 */
const props = defineProps<{
    row: FilterListRow;
    /** What goes before the row (`getRowJoinCells`). */
    joinCell: FilterJoinCell;
    column: Column<DataTableFeatures, TData>;
    columns: Column<DataTableFeatures, TData>[];
    join: JoinOperator;
    /** Missing when the table was not made by `useServerDataTable`. */
    onJoinChange?: (join: JoinOperator) => void;
}>();

const emit = defineEmits<{
    change: [filter: ColumnFilterItem];
    remove: [];
}>();

const dir = useDirection();
const table = computed(() => props.column.table);
const filter = computed(() => props.row.filter);
const label = computed(
    () => props.column.columnDef.meta?.label ?? props.column.id,
);
const operators = computed(() => FILTER_OPERATORS[filter.value.variant]);
const columnItems = computed(() =>
    props.columns.map((column) => ({
        value: column.id,
        label: column.columnDef.meta?.label ?? column.id,
    })),
);

function joinLabel(join: JoinOperator) {
    return getMessage(table.value, join === 'or' ? 'filter_or' : 'filter_and');
}

function onJoin(value: unknown) {
    if (value === 'and' || value === 'or') props.onJoinChange?.(value);
}

function onColumn(value: FacetedSelection) {
    const next = props.columns.find((column) => column.id === value);
    const variant = next?.columnDef.meta?.filterVariant;

    if (next && variant && next.id !== filter.value.id) {
        emit('change', createFilterListItem(next.id, variant, props.row.key));
    }
}

function onOperator(value: unknown) {
    if (typeof value === 'string') {
        emit(
            'change',
            changeFilterOperator(filter.value, value as FilterOperator),
        );
    }
}
</script>

<template>
    <div
        role="listitem"
        data-slot="data-table-filter-item"
        :data-column="filter.id"
        :data-group="joinCell === 'group' ? 'empty' : undefined"
        :class="
            cn(
                'flex flex-wrap items-center gap-2 sm:flex-nowrap',
                joinCell === 'group' && 'border-s-2 ps-2',
            )
        "
    >
        <div class="w-18 shrink-0 text-sm text-muted-foreground">
            <template v-if="joinCell === 'where'">
                {{ getMessage(table, 'filter_where') }}
            </template>
            <Select
                v-else-if="joinCell === 'select' && onJoinChange"
                :model-value="join"
                @update:model-value="onJoin"
            >
                <SelectTrigger
                    :aria-label="getMessage(table, 'filter_join')"
                    class="h-8 w-full lowercase"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem
                        v-for="value in ['and', 'or'] as const"
                        :key="value"
                        :value="value"
                        class="lowercase"
                    >
                        {{ joinLabel(value) }}
                    </SelectItem>
                </SelectContent>
            </Select>
            <span v-else class="lowercase">{{
                joinLabel(joinCell === 'group' ? 'or' : join)
            }}</span>
        </div>
        <Faceted
            :model-value="filter.id"
            :items="columnItems"
            @update:model-value="onColumn"
        >
            <FacetedTrigger as-child>
                <Button
                    variant="outline"
                    :aria-label="getMessage(table, 'field')"
                    class="h-8 w-36 shrink-0 justify-between font-normal"
                >
                    <span class="truncate">{{ label }}</span>
                    <ChevronsUpDown class="text-muted-foreground" />
                </Button>
            </FacetedTrigger>
            <FacetedContent :dir="dir" align="start" class="w-48">
                <FacetedInput
                    :placeholder="getMessage(table, 'search_fields')"
                />
                <FacetedList>
                    <FacetedEmpty>{{
                        getMessage(table, 'no_fields')
                    }}</FacetedEmpty>
                    <FacetedGroup>
                        <FacetedItem
                            v-for="item in columnItems"
                            :key="item.value"
                            :value="item.value"
                        >
                            <span class="truncate">{{ item.label }}</span>
                            <FacetedItemIndicator />
                        </FacetedItem>
                    </FacetedGroup>
                </FacetedList>
            </FacetedContent>
        </Faceted>
        <Select :model-value="filter.operator" @update:model-value="onOperator">
            <SelectTrigger
                :aria-label="getMessage(table, 'filter_operator', { label })"
                class="h-8 w-40 shrink-0"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem
                    v-for="operator in operators"
                    :key="operator"
                    :value="operator"
                >
                    {{
                        getMessage(
                            table,
                            getFilterOperatorMessageKey(
                                filter.variant,
                                operator,
                            ),
                        )
                    }}
                </SelectItem>
            </SelectContent>
        </Select>
        <DataTableFilterValue
            :column="column"
            :filter="filter"
            class="min-w-40 flex-1"
            @change="emit('change', { ...filter, value: $event })"
        />
        <Button
            variant="outline"
            size="icon"
            :aria-label="getMessage(table, 'remove_filter', { label })"
            class="size-8 shrink-0"
            @click="emit('remove')"
        >
            <Trash2 />
        </Button>
    </div>
</template>
