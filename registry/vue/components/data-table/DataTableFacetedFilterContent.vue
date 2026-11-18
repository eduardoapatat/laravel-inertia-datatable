<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import { CirclePlus, CircleX } from '@lucide/vue';
import { useDirection } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { Button } from '@/components/ui/button';
import {
    Faceted,
    FacetedBadge,
    FacetedBadgeList,
    FacetedClear,
    FacetedContent,
    FacetedEmpty,
    FacetedGroup,
    FacetedInput,
    FacetedItem,
    FacetedItemCheckbox,
    FacetedItemCount,
    FacetedList,
    FacetedSeparator,
    FacetedTrigger,
    FacetedValue,
} from '@/components/ui/faceted';
import { Separator } from '@/components/ui/separator';
import {
    clearColumnFilter,
    type DataTableFeatures,
    getEmptyFilter,
    getHiddenFilterCount,
    setEmptyFilter,
} from '@/lib/data-table-features';
import { EMPTY_VALUE } from '@/lib/data-table-advanced';
import { formatNumber, getEmptyLabel } from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';
import type { Column, DataTableIcon, RowData } from '@/lib/data-table-tanstack';
import type { ColumnSelectOption } from '@/lib/data-table-types';
import { cn } from '@/lib/utils';

import DataTableHiddenFilters from './DataTableHiddenFilters.vue';

/**
 * The list filter of `DataTableFacetedFilter` and `DataTableBooleanFilter`.
 */
const props = withDefaults(
    defineProps<{
        column?: Column<DataTableFeatures, TData>;
        options: ColumnSelectOption[];
        title?: string;
        multiple?: boolean;
        counts?: boolean;
        searchable?: boolean;
        icon?: DataTableIcon | null;
        class?: HTMLAttributes['class'];
        contentClass?: HTMLAttributes['class'];
        align?: 'start' | 'center' | 'end';
        disabled?: boolean;
    }>(),
    {
        column: undefined,
        title: undefined,
        multiple: false,
        counts: true,
        searchable: true,
        icon: () => CirclePlus,
        align: undefined,
    },
);

const dir = useDirection();
const table = computed(() => props.column?.table);
const meta = computed(() => props.column?.columnDef.meta);
const title = computed(
    () => props.title ?? meta.value?.label ?? props.column?.id,
);
// Boolean filters store a single value ('true' / 'false').
const isScalar = computed(() => meta.value?.filterVariant === 'boolean');

const selectedValues = computed(() => {
    const value = props.column?.getFilterValue();
    const picked = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : typeof value === 'string'
          ? [value]
          : [];

    return props.column && getEmptyFilter(props.column)
        ? [...picked, EMPTY_VALUE]
        : picked;
});
// Filters of the column the toolbar can not show (`+N`).
const hiddenCount = computed(() =>
    props.column ? getHiddenFilterCount(props.column) : 0,
);
const hasSelection = computed(
    () => selectedValues.value.length > 0 || hiddenCount.value > 0,
);

// With `empty: true` in PHP, the rows without a value go last.
const emptyOption = computed<ColumnSelectOption | undefined>(() =>
    meta.value?.empty
        ? {
              value: EMPTY_VALUE,
              label: getEmptyLabel(meta.value, table.value),
              count: meta.value.emptyCount,
          }
        : undefined,
);
const items = computed(() =>
    emptyOption.value ? [...props.options, emptyOption.value] : props.options,
);

function formatCount(count: number) {
    return formatNumber(count, {}, table.value?.options.meta?.locale);
}

function onValueChange(value: string | string[] | undefined) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    const picked = values.filter((item) => item !== EMPTY_VALUE);
    const column = props.column;

    column?.setFilterValue(
        picked.length === 0 ? undefined : isScalar.value ? picked[0] : picked,
    );

    if (column && emptyOption.value) {
        setEmptyFilter(column, values.includes(EMPTY_VALUE));
    }
}

function onReset() {
    if (props.column) {
        clearColumnFilter(props.column);
    }
}
</script>

<template>
    <Faceted
        :model-value="multiple ? selectedValues : selectedValues[0]"
        :items="items"
        :multiple="multiple"
        @update:model-value="onValueChange"
    >
        <FacetedTrigger as-child>
            <Button
                variant="outline"
                :class="cn('border-dashed', props.class)"
                :disabled="disabled"
            >
                <span
                    v-if="hasSelection"
                    aria-hidden="true"
                    class="rounded-sm opacity-70 transition-opacity hover:opacity-100"
                    @click.stop="onReset"
                >
                    <CircleX />
                </span>
                <component :is="icon" v-else-if="icon" />
                {{ title }}
                <template v-if="hasSelection">
                    <Separator
                        orientation="vertical"
                        class="mx-0.5 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                    />
                    <FacetedValue
                        v-if="selectedValues.length > 0"
                        v-slot="{ selected }"
                    >
                        <FacetedBadgeList>
                            <FacetedBadge v-if="selected.length > 2">
                                {{
                                    getMessage(table, 'selected', {
                                        count: selected.length,
                                    })
                                }}
                            </FacetedBadge>
                            <template v-else>
                                <FacetedBadge
                                    v-for="item in selected"
                                    :key="item.value"
                                >
                                    <span class="truncate">{{
                                        item.label
                                    }}</span>
                                </FacetedBadge>
                            </template>
                        </FacetedBadgeList>
                    </FacetedValue>
                </template>
                <DataTableHiddenFilters
                    :table="table"
                    :label="title ?? ''"
                    :count="hiddenCount"
                />
            </Button>
        </FacetedTrigger>
        <FacetedContent
            :aria-label="getMessage(table, 'filter', { label: title ?? '' })"
            :dir="dir"
            :align="align"
            :class="cn('w-50', contentClass)"
        >
            <FacetedInput v-if="searchable" :placeholder="title" />
            <FacetedList class="max-h-full">
                <FacetedEmpty>
                    {{ getMessage(table, 'no_options') }}
                </FacetedEmpty>
                <FacetedGroup
                    class="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto"
                >
                    <FacetedItem
                        v-for="option in options"
                        :key="option.value"
                        :value="option.value"
                    >
                        <FacetedItemCheckbox />
                        <component
                            :is="option.icon"
                            v-if="option.icon"
                            class="text-muted-foreground"
                        />
                        <span class="flex-1 truncate">{{ option.label }}</span>
                        <FacetedItemCount
                            v-if="counts && option.count !== undefined"
                        >
                            {{ formatCount(option.count) }}
                        </FacetedItemCount>
                    </FacetedItem>
                </FacetedGroup>
                <template v-if="emptyOption">
                    <FacetedSeparator />
                    <FacetedGroup>
                        <FacetedItem :value="emptyOption.value">
                            <FacetedItemCheckbox />
                            <span class="flex-1 truncate">{{
                                emptyOption.label
                            }}</span>
                            <FacetedItemCount
                                v-if="counts && emptyOption.count !== undefined"
                            >
                                {{ formatCount(emptyOption.count) }}
                            </FacetedItemCount>
                        </FacetedItem>
                    </FacetedGroup>
                </template>
                <FacetedClear>
                    {{ getMessage(table, 'clear_filters') }}
                </FacetedClear>
            </FacetedList>
        </FacetedContent>
    </Faceted>
</template>
