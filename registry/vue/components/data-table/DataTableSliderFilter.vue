<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import { CirclePlus, CircleX } from '@lucide/vue';
import { useDirection } from 'reka-ui';
import { computed, onBeforeUnmount, ref, useId } from 'vue';

import { Button } from '@/components/ui/button';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
    clearColumnFilter,
    getEmptyFilter,
    getHiddenFilterCount,
} from '@/lib/data-table-features';
import {
    getRangeFilterBounds,
    getValidRangeFilterBounds,
} from '@/lib/data-table-filter-values';
import {
    formatNumber,
    getEmptyLabel,
    getFilterAffixes,
    getUnit,
} from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import {
    type DataTableFilterPieceProps,
    useDataTableFilterColumn,
} from './context';
import DataTableEmptyFilter from './DataTableEmptyFilter.vue';
import DataTableHiddenFilters from './DataTableHiddenFilters.vue';

const INVALID_RING_DELAY_MS = 500;

type RangeValue = [number, number];
type Drafts = [string | null, string | null];

/**
 * Range filter of a number column with `->filterRange()`: a popover with the
 * two bounds and a slider between the min and max of the server.
 */
const props = withDefaults(
    defineProps<
        DataTableFilterPieceProps<TData> & {
            /** Step of the slider; by default about 50 steps between the bounds. */
            step?: number;
        }
    >(),
    { icon: undefined, align: 'start' },
);

const column = useDataTableFilterColumn(
    'DataTableSliderFilter',
    props.column,
    props.table,
);
const dir = useDirection();
const id = useId();

const drafts = ref<Drafts>([null, null]);
const showInvalid = ref(false);
let invalidTimeout: ReturnType<typeof setTimeout> | undefined;

onBeforeUnmount(() => clearTimeout(invalidTimeout));

const view = computed(() => {
    if (!column) return undefined;

    const meta = column.columnDef.meta;
    const table = column.table;
    // The server sends the bounds of the data; without rows it has none.
    const min = meta?.min ?? 0;
    const max = meta?.max ?? 100;
    const bounds = parseRangeBounds(column.getFilterValue());
    const filterValue: RangeValue | undefined = bounds
        ? [bounds[0] ?? min, bounds[1] ?? max]
        : undefined;
    // The bounds in the trigger use the format of the cells (`->money('CLP')`
    // → `$10 - $2.489`); a currency or percentage already says the unit.
    const display = meta?.display?.type === 'number' ? meta.display : undefined;
    const valueFormat = display?.format ?? { maximumFractionDigits: 2 };
    // The label of the filter shows the unit as the cells do.
    const unit = getUnit(meta, 'cell');
    const showUnit = Boolean(unit) && valueFormat.style === undefined;
    // Next to the inputs: the unit, or the symbol and/or code of the currency.
    const affixes = getFilterAffixes(meta);
    // Wide enough for the longest bound (`2491510` does not fit in w-24).
    const digits = Math.max(String(min).length, String(max).length, 4);
    const includesEmpty = getEmptyFilter(column);
    const format = (value: number) =>
        formatNumber(
            value,
            valueFormat,
            table.options.meta?.locale,
            display?.currency?.cell,
        );
    const emptyLabel = includesEmpty ? getEmptyLabel(meta, table) : '';

    return {
        table,
        title: props.title ?? meta?.label ?? column.id,
        min,
        max,
        step: props.step ?? getRangeStep(min, max),
        range: filterValue ?? ([min, max] as RangeValue),
        filterValue,
        includesEmpty,
        hasEmpty: meta?.empty === true,
        affixes,
        inputStyle: {
            width: `calc(${digits}ch + ${2.75 + affixes.length * 1.5}rem)`,
        },
        summary: [
            filterValue
                ? `${format(filterValue[0])} - ${format(filterValue[1])}${showUnit ? ` ${unit}` : ''}`
                : '',
            emptyLabel,
        ]
            .filter(Boolean)
            .join(', '),
    };
});

// Filters of the column the toolbar can not show (`+N`).
const hiddenCount = computed(() => (column ? getHiddenFilterCount(column) : 0));
const hasFilter = computed(() =>
    Boolean(
        view.value?.filterValue ||
        view.value?.includesEmpty ||
        hiddenCount.value > 0,
    ),
);

function onInvalidChange(isInvalid: boolean) {
    clearTimeout(invalidTimeout);
    if (!isInvalid) {
        showInvalid.value = false;
        return;
    }
    if (showInvalid.value) return;
    invalidTimeout = setTimeout(() => {
        showInvalid.value = true;
    }, INVALID_RING_DELAY_MS);
}

function setRangeFilter([start, end]: [
    number | undefined,
    number | undefined,
]) {
    if (!column || !view.value) return;

    const { min, max } = view.value;
    const from = start ?? min;
    const to = end ?? max;

    column.setFilterValue(from <= min && to >= max ? undefined : [from, to]);
}

function getInputValues(next: Drafts): [string, string] {
    const range = view.value?.range ?? [0, 0];

    return [next[0] ?? range[0].toString(), next[1] ?? range[1].toString()];
}

function onDraftChange(index: 0 | 1, value: string | number) {
    if (!view.value) return;

    const text = String(value);
    const next: Drafts =
        index === 0 ? [text, drafts.value[1]] : [drafts.value[0], text];
    drafts.value = next;

    const bounds = getValidRangeFilterBounds(getInputValues(next), [
        view.value.min,
        view.value.max,
    ]);
    if (bounds) setRangeFilter(bounds);
    onInvalidChange(!bounds);
}

function onDraftCommit() {
    if (!view.value) return;
    if (drafts.value[0] === null && drafts.value[1] === null) return;

    setRangeFilter(
        getRangeFilterBounds(getInputValues(drafts.value), [
            view.value.min,
            view.value.max,
        ]),
    );
    drafts.value = [null, null];
    onInvalidChange(false);
}

function onInputsFocusOut(event: FocusEvent) {
    const target = event.currentTarget as HTMLElement;

    if (target.contains(event.relatedTarget as Node | null)) return;
    onDraftCommit();
}

function onSliderValueChange(value: number[] | undefined) {
    if (value?.length === 2) {
        drafts.value = [null, null];
        onInvalidChange(false);
        setRangeFilter([value[0], value[1]]);
    }
}

function onReset() {
    drafts.value = [null, null];
    onInvalidChange(false);
    if (column) clearColumnFilter(column);
}

function getRangeStep(min: number, max: number) {
    const rangeSize = max - min;
    if (rangeSize <= 20) return 1;
    if (rangeSize <= 100) return Math.ceil(rangeSize / 20);
    return Math.ceil(rangeSize / 50);
}

function parseRangeBounds(
    value: unknown,
): [number | undefined, number | undefined] | undefined {
    if (!Array.isArray(value) || value.length !== 2) return undefined;

    const [start, end] = value.map(parseRangeBound);
    if (start === null || end === null) return undefined;
    if (start === undefined && end === undefined) return undefined;

    return [start, end];
}

function parseRangeBound(value: unknown) {
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'number' && typeof value !== 'string') return null;

    const number = Number(value);
    return Number.isNaN(number) ? null : number;
}
</script>

<template>
    <Popover v-if="column && view">
        <PopoverTrigger as-child>
            <Button
                variant="outline"
                :class="cn('border-dashed', props.class)"
                :disabled="disabled"
            >
                <span
                    v-if="hasFilter"
                    aria-hidden="true"
                    class="rounded-sm opacity-70 transition-opacity hover:opacity-100"
                    @click.stop="onReset"
                >
                    <CircleX />
                </span>
                <component :is="icon ?? CirclePlus" v-else-if="icon !== null" />
                <span>{{ view.title }}</span>
                <template v-if="hasFilter">
                    <Separator
                        orientation="vertical"
                        class="mx-0.5 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                    />
                    {{ view.summary }}
                </template>
                <DataTableHiddenFilters
                    :table="column.table"
                    :label="view.title"
                    :count="hiddenCount"
                />
            </Button>
        </PopoverTrigger>
        <PopoverContent
            :aria-label="
                getMessage(view.table, 'filter', { label: view.title })
            "
            :dir="dir"
            :align="align"
            :class="cn('flex w-auto flex-col gap-4', contentClass)"
        >
            <div class="flex flex-col gap-3">
                <Label>{{ view.title }}</Label>
                <div
                    class="flex items-center gap-4"
                    @focusout="onInputsFocusOut"
                >
                    <Label :for="`${id}-from`" class="sr-only">
                        {{ getMessage(view.table, 'from') }}
                    </Label>
                    <InputGroup :style="view.inputStyle">
                        <InputGroupInput
                            :id="`${id}-from`"
                            type="number"
                            :aria-valuemin="view.min"
                            :aria-valuemax="view.max"
                            :aria-invalid="
                                (showInvalid && drafts[0] !== null) || undefined
                            "
                            inputmode="decimal"
                            :placeholder="view.min.toString()"
                            :min="view.min"
                            :max="view.max"
                            :model-value="drafts[0] ?? view.range[0].toString()"
                            @update:model-value="onDraftChange(0, $event)"
                            @keydown.enter="onDraftCommit"
                        />
                        <InputGroupAddon
                            v-for="affix in view.affixes"
                            :key="affix.align"
                            :align="affix.align"
                        >
                            <InputGroupText>{{ affix.text }}</InputGroupText>
                        </InputGroupAddon>
                    </InputGroup>
                    <Label :for="`${id}-to`" class="sr-only">
                        {{ getMessage(view.table, 'to') }}
                    </Label>
                    <InputGroup :style="view.inputStyle">
                        <InputGroupInput
                            :id="`${id}-to`"
                            type="number"
                            :aria-valuemin="view.min"
                            :aria-valuemax="view.max"
                            :aria-invalid="
                                (showInvalid && drafts[1] !== null) || undefined
                            "
                            inputmode="decimal"
                            :placeholder="view.max.toString()"
                            :min="view.min"
                            :max="view.max"
                            :model-value="drafts[1] ?? view.range[1].toString()"
                            @update:model-value="onDraftChange(1, $event)"
                            @keydown.enter="onDraftCommit"
                        />
                        <InputGroupAddon
                            v-for="affix in view.affixes"
                            :key="affix.align"
                            :align="affix.align"
                        >
                            <InputGroupText>{{ affix.text }}</InputGroupText>
                        </InputGroupAddon>
                    </InputGroup>
                </div>
                <Label :for="`${id}-slider`" class="sr-only">
                    {{
                        getMessage(view.table, 'slider', { label: view.title })
                    }}
                </Label>
                <Slider
                    :id="`${id}-slider`"
                    :min="view.min"
                    :max="view.max"
                    :step="view.step"
                    :model-value="view.range"
                    @update:model-value="onSliderValueChange"
                />
                <DataTableEmptyFilter v-if="view.hasEmpty" :column="column" />
            </div>
            <Button
                :aria-label="
                    getMessage(view.table, 'clear_filter', {
                        label: view.title,
                    })
                "
                variant="outline"
                @click="onReset"
            >
                {{ getMessage(view.table, 'clear') }}
            </Button>
        </PopoverContent>
    </Popover>
</template>
