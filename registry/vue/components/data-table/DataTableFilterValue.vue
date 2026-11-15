<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import { useDirection } from 'reka-ui';
import { computed, type HTMLAttributes } from 'vue';

import { Button } from '@/components/ui/button';
import {
    Faceted,
    type FacetedSelection,
    FacetedContent,
    FacetedEmpty,
    FacetedGroup,
    FacetedInput,
    FacetedItem,
    FacetedItemCheckbox,
    FacetedItemCount,
    FacetedList,
    FacetedTrigger,
    FacetedValue,
} from '@/components/ui/faceted';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { getIsValuelessOperator } from '@/lib/data-table-advanced';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { getBooleanFilterOptions } from '@/lib/data-table-filter-options';
import { formatNumber } from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';
import type { Column, RowData } from '@/lib/data-table-tanstack';
import type { ColumnFilterItem } from '@/lib/data-table-types';
import { cn } from '@/lib/utils';

import DataTableFilterDateValue from './DataTableFilterDateValue.vue';

/**
 * Value of a row of `DataTableFilterList`, by the variant of its column and
 * its operator: text or number fields (two for `isBetween`), a calendar, a
 * list of options or yes / no. `is.empty` and `not.is.empty` take none.
 */
const props = defineProps<{
    column: Column<DataTableFeatures, TData>;
    filter: ColumnFilterItem;
    class?: HTMLAttributes['class'];
}>();

const emit = defineEmits<{ change: [value: string | string[]] }>();

const dir = useDirection();
const table = computed(() => props.column.table);
const label = computed(
    () => props.column.columnDef.meta?.label ?? props.column.id,
);
const ariaLabel = computed(() =>
    getMessage(table.value, 'filter_value', { label: label.value }),
);
const kind = computed(() => {
    const { variant, operator } = props.filter;

    if (getIsValuelessOperator(operator)) return 'none';
    if (variant === 'date' || variant === 'date-range') return 'date';
    if (variant === 'boolean') return 'boolean';
    if (variant === 'select' || variant === 'multi-select') return 'options';

    return operator === 'isBetween' ? 'between' : 'input';
});
const inputType = computed(() =>
    props.filter.variant === 'text' ? 'text' : 'number',
);
const list = computed(() => toList(props.filter.value));
const single = computed(() =>
    Array.isArray(props.filter.value)
        ? (props.filter.value[0] ?? '')
        : props.filter.value,
);

const booleanOptions = computed(() =>
    getBooleanFilterOptions(props.column.columnDef.meta, {
        yes: getMessage(table.value, 'yes'),
        no: getMessage(table.value, 'no'),
    }),
);
const options = computed(() => props.column.columnDef.meta?.options ?? []);
const items = computed(() =>
    options.value.map((option) => ({
        value: option.value,
        label: option.label,
    })),
);
const multiple = computed(
    () =>
        props.filter.operator === 'inArray' ||
        props.filter.operator === 'notInArray',
);

function onBetween(index: 0 | 1, value: string | number) {
    const [from = '', to = ''] = list.value;
    const next = [from, to];

    next[index] = String(value);
    emit('change', next);
}

function onOptions(value: FacetedSelection) {
    if (multiple.value) {
        emit('change', Array.isArray(value) ? value : []);
    } else {
        emit('change', typeof value === 'string' ? value : '');
    }
}

function selectedText(selected: { label: string }[]) {
    if (selected.length === 0) return getMessage(table.value, 'select_options');
    if (selected.length > 2) {
        return getMessage(table.value, 'selected', { count: selected.length });
    }

    return selected.map((item) => item.label).join(', ');
}

function toList(value: string | string[]): string[] {
    return Array.isArray(value) ? value : value === '' ? [] : [value];
}
</script>

<template>
    <div
        v-if="kind === 'none'"
        data-slot="data-table-filter-value"
        :class="props.class"
    />
    <div
        v-else-if="kind === 'between'"
        data-slot="data-table-filter-value"
        :class="cn('flex items-center gap-1', props.class)"
    >
        <Input
            :type="inputType"
            inputmode="decimal"
            :aria-label="`${ariaLabel}: ${getMessage(table, 'from')}`"
            :placeholder="getMessage(table, 'from')"
            class="h-8 min-w-0"
            :model-value="list[0] ?? ''"
            @update:model-value="onBetween(0, $event)"
        />
        <Input
            :type="inputType"
            inputmode="decimal"
            :aria-label="`${ariaLabel}: ${getMessage(table, 'to')}`"
            :placeholder="getMessage(table, 'to')"
            class="h-8 min-w-0"
            :model-value="list[1] ?? ''"
            @update:model-value="onBetween(1, $event)"
        />
    </div>
    <Input
        v-else-if="kind === 'input'"
        data-slot="data-table-filter-value"
        :type="inputType"
        :inputmode="inputType === 'number' ? 'decimal' : undefined"
        :aria-label="ariaLabel"
        :placeholder="
            column.columnDef.meta?.placeholder ??
            getMessage(table, 'enter_value')
        "
        :class="cn('h-8', props.class)"
        :model-value="single"
        @update:model-value="emit('change', String($event))"
    />
    <DataTableFilterDateValue
        v-else-if="kind === 'date'"
        :table="table"
        :filter="filter"
        :label="ariaLabel"
        :class="props.class"
        @change="emit('change', $event)"
    />
    <Select
        v-else-if="kind === 'boolean'"
        :model-value="single || undefined"
        @update:model-value="emit('change', String($event ?? ''))"
    >
        <SelectTrigger
            data-slot="data-table-filter-value"
            :aria-label="ariaLabel"
            :class="cn('h-8 w-full', props.class)"
        >
            <SelectValue :placeholder="getMessage(table, 'select_options')" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem
                v-for="option in booleanOptions"
                :key="option.value"
                :value="option.value"
            >
                {{ option.label }}
            </SelectItem>
        </SelectContent>
    </Select>
    <Faceted
        v-else
        :multiple="multiple"
        :items="items"
        :model-value="multiple ? list : single"
        @update:model-value="onOptions"
    >
        <FacetedTrigger as-child>
            <Button
                data-slot="data-table-filter-value"
                variant="outline"
                :aria-label="ariaLabel"
                :class="cn('h-8 w-full justify-between', props.class)"
            >
                <FacetedValue v-slot="{ selected }">
                    <span
                        :class="
                            cn(
                                'truncate',
                                selected.length === 0 &&
                                    'text-muted-foreground',
                            )
                        "
                        >{{ selectedText(selected) }}</span
                    >
                </FacetedValue>
            </Button>
        </FacetedTrigger>
        <FacetedContent
            :aria-label="ariaLabel"
            :dir="dir"
            align="start"
            class="w-56"
        >
            <FacetedInput :placeholder="getMessage(table, 'select_options')" />
            <FacetedList>
                <FacetedEmpty>{{
                    getMessage(table, 'no_options')
                }}</FacetedEmpty>
                <FacetedGroup class="max-h-75 overflow-y-auto">
                    <FacetedItem
                        v-for="option in options"
                        :key="option.value"
                        :value="option.value"
                    >
                        <FacetedItemCheckbox v-if="multiple" />
                        <component
                            :is="option.icon"
                            v-if="option.icon"
                            class="text-muted-foreground"
                        />
                        <span class="flex-1 truncate">{{ option.label }}</span>
                        <FacetedItemCount v-if="option.count !== undefined">
                            {{
                                formatNumber(
                                    option.count,
                                    {},
                                    table.options.meta?.locale,
                                )
                            }}
                        </FacetedItemCount>
                    </FacetedItem>
                </FacetedGroup>
            </FacetedList>
        </FacetedContent>
    </Faceted>
</template>
