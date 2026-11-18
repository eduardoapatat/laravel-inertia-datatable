<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import { useDirection } from 'reka-ui';
import { computed, type HTMLAttributes, useId } from 'vue';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    EMPTY_VALUE,
    getIsValuelessOperator,
    getRowEmptyControl,
} from '@/lib/data-table-advanced';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { getBooleanFilterOptions } from '@/lib/data-table-filter-options';
import { formatNumber, getEmptyLabel } from '@/lib/data-table-format';
import {
    type DataTableMessageKey,
    getMessage,
} from '@/lib/data-table-messages';
import {
    formatRelativeDateRange,
    getRelativeDateLabel,
    RELATIVE_DATE_PRESETS,
} from '@/lib/data-table-relative-date';
import type { Column, RowData } from '@/lib/data-table-tanstack';
import type { ColumnFilterItem } from '@/lib/data-table-types';
import { cn } from '@/lib/utils';

import DataTableFilterDateValue from './DataTableFilterDateValue.vue';

/**
 * Value of a row of `DataTableFilterList`, by the variant of its column and
 * its operator: text or number fields (two for `isBetween`), a calendar, a
 * list of options, yes / no or the periods relative to today of `rel`.
 * `is.empty` and `not.is.empty` take none. The rows without a value of the
 * column (`getRowEmptyControl`) are an option of the list of options of
 * `inArray`, or else a check next to the value.
 */
const props = defineProps<{
    column: Column<DataTableFeatures, TData>;
    filter: ColumnFilterItem;
    /** Whether the row also takes the rows without a value (`is.empty`). */
    includesEmpty: boolean;
    class?: HTMLAttributes['class'];
}>();

const emit = defineEmits<{
    change: [value: string | string[]];
    'update:includesEmpty': [include: boolean];
}>();

const dir = useDirection();
const emptyId = useId();
const table = computed(() => props.column.table);
const emptyControl = computed(() =>
    getRowEmptyControl(
        { filter: props.filter, includesEmpty: props.includesEmpty },
        props.column.columnDef.meta?.empty === true,
    ),
);
const emptyLabel = computed(() =>
    emptyControl.value === 'option'
        ? getEmptyLabel(props.column.columnDef.meta, table.value)
        : undefined,
);
const emptyCount = computed(() => props.column.columnDef.meta?.emptyCount);
const label = computed(
    () => props.column.columnDef.meta?.label ?? props.column.id,
);
const ariaLabel = computed(() =>
    getMessage(table.value, 'filter_value', { label: label.value }),
);
const kind = computed(() => {
    const { variant, operator } = props.filter;

    if (getIsValuelessOperator(operator)) return 'none';
    if (operator === 'isRelativeToToday') return 'relative';
    if (variant === 'date' || variant === 'date-range') return 'date';
    if (variant === 'boolean') return 'boolean';
    if (variant === 'select' || variant === 'multi-select') return 'options';

    return operator === 'isBetween' ? 'between' : 'input';
});
/** The value fills the row; the check of the rows without a value goes after it. */
const valueClass = 'min-w-0 flex-1';
const inputType = computed(() =>
    props.filter.variant === 'text' ? 'text' : 'number',
);
const list = computed(() => toList(props.filter.value));
const single = computed(() =>
    Array.isArray(props.filter.value)
        ? (props.filter.value[0] ?? '')
        : props.filter.value,
);

/**
 * Periods relative to today: the presets, and first the token of the URL when
 * it is not one of them. The days the server resolved it to go in the title.
 */
const relativeTokens = computed<readonly string[]>(() => {
    const presets: readonly string[] = RELATIVE_DATE_PRESETS;

    return single.value === '' || presets.includes(single.value)
        ? presets
        : [single.value, ...presets];
});
const relativeRange = computed(() =>
    formatRelativeDateRange(
        props.filter.range,
        table.value.options.meta?.locale,
    ),
);

function relativeLabel(token: string) {
    return getRelativeDateLabel(
        token,
        (
            key: DataTableMessageKey,
            replacements?: Record<string, string | number>,
        ) => getMessage(table.value, key, replacements),
    );
}

const booleanOptions = computed(() =>
    getBooleanFilterOptions(props.column.columnDef.meta, {
        yes: getMessage(table.value, 'yes'),
        no: getMessage(table.value, 'no'),
    }),
);
const options = computed(() => props.column.columnDef.meta?.options ?? []);
const items = computed(() => [
    ...options.value.map((option) => ({
        value: option.value,
        label: option.label,
    })),
    ...(emptyLabel.value === undefined
        ? []
        : [{ value: EMPTY_VALUE, label: emptyLabel.value }]),
]);
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
        const picked = Array.isArray(value) ? value : [];
        const include = picked.includes(EMPTY_VALUE);

        if (emptyLabel.value !== undefined && include !== props.includesEmpty) {
            emit('update:includesEmpty', include);
        } else {
            emit(
                'change',
                picked.filter((item) => item !== EMPTY_VALUE),
            );
        }
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
    <div :class="cn('flex items-center gap-2', props.class)">
        <div
            v-if="kind === 'none'"
            data-slot="data-table-filter-value"
            :class="valueClass"
        />
        <div
            v-else-if="kind === 'between'"
            data-slot="data-table-filter-value"
            :class="cn('flex items-center gap-1', valueClass)"
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
            :class="cn('h-8', valueClass)"
            :model-value="single"
            @update:model-value="emit('change', String($event))"
        />
        <DataTableFilterDateValue
            v-else-if="kind === 'date'"
            :table="table"
            :filter="filter"
            :label="ariaLabel"
            :class="valueClass"
            @change="emit('change', $event)"
        />
        <Select
            v-else-if="kind === 'relative'"
            :model-value="single || undefined"
            @update:model-value="emit('change', String($event ?? ''))"
        >
            <SelectTrigger
                data-slot="data-table-filter-value"
                :aria-label="ariaLabel"
                :title="relativeRange || undefined"
                :class="cn('h-8 w-full', valueClass)"
            >
                <SelectValue :placeholder="getMessage(table, 'pick_period')" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem
                    v-for="token in relativeTokens"
                    :key="token"
                    :value="token"
                >
                    {{ relativeLabel(token) }}
                </SelectItem>
            </SelectContent>
        </Select>
        <Select
            v-else-if="kind === 'boolean'"
            :model-value="single || undefined"
            @update:model-value="emit('change', String($event ?? ''))"
        >
            <SelectTrigger
                data-slot="data-table-filter-value"
                :aria-label="ariaLabel"
                :class="cn('h-8 w-full', valueClass)"
            >
                <SelectValue
                    :placeholder="getMessage(table, 'select_options')"
                />
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
            :model-value="
                multiple
                    ? emptyLabel !== undefined && includesEmpty
                        ? [...list, EMPTY_VALUE]
                        : list
                    : single
            "
            @update:model-value="onOptions"
        >
            <FacetedTrigger as-child>
                <Button
                    data-slot="data-table-filter-value"
                    variant="outline"
                    :aria-label="ariaLabel"
                    :class="cn('h-8 w-full justify-between', valueClass)"
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
                <FacetedInput
                    :placeholder="getMessage(table, 'select_options')"
                />
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
                            <span class="flex-1 truncate">{{
                                option.label
                            }}</span>
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
                        <FacetedItem
                            v-if="emptyLabel !== undefined"
                            :value="EMPTY_VALUE"
                        >
                            <FacetedItemCheckbox />
                            <span class="flex-1 truncate">{{
                                emptyLabel
                            }}</span>
                            <FacetedItemCount v-if="emptyCount !== undefined">
                                {{
                                    formatNumber(
                                        emptyCount,
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
        <div
            v-if="emptyControl === 'check'"
            data-slot="data-table-filter-empty"
            class="flex shrink-0 items-center gap-2"
        >
            <Checkbox
                :id="emptyId"
                :model-value="includesEmpty"
                @update:model-value="
                    emit('update:includesEmpty', $event === true)
                "
            />
            <Label :for="emptyId" class="font-normal whitespace-nowrap">
                {{ getMessage(table, 'filter_or_empty') }}
            </Label>
        </div>
    </div>
</template>
