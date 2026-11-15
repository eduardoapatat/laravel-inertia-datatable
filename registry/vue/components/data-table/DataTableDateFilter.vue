<script setup lang="ts" generic="TData extends RowData">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    CalendarDate,
    type DateValue,
    getLocalTimeZone,
    today,
} from '@internationalized/date';
import { CalendarIcon, CircleX } from '@lucide/vue';
import { type DateRange, RangeCalendarRoot, useDirection } from 'reka-ui';
import { computed, shallowRef } from 'vue';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    RangeCalendarCell,
    RangeCalendarCellTrigger,
    RangeCalendarGrid,
    RangeCalendarGridBody,
    RangeCalendarGridHead,
    RangeCalendarGridRow,
    RangeCalendarHeadCell,
    RangeCalendarHeader,
    RangeCalendarNextButton,
    RangeCalendarPrevButton,
} from '@/components/ui/range-calendar';
import { Separator } from '@/components/ui/separator';
import { clearColumnFilter, getEmptyFilter } from '@/lib/data-table-features';
import { formatDate, getEmptyLabel } from '@/lib/data-table-format';
import { getMessage, getWeekStartsOn } from '@/lib/data-table-messages';
import type { RowData } from '@/lib/data-table-tanstack';
import { cn } from '@/lib/utils';

import {
    type DataTableFilterPieceProps,
    useDataTableFilterColumn,
} from './context';
import DataTableCalendarSelects from './DataTableCalendarSelects.vue';
import DataTableEmptyFilter from './DataTableEmptyFilter.vue';

/**
 * Calendar filter of a date column: one day with `->filterDate()`, a range
 * with `->filterRange()`.
 */
const props = withDefaults(defineProps<DataTableFilterPieceProps<TData>>(), {
    icon: undefined,
    align: 'start',
});

const column = useDataTableFilterColumn(
    'DataTableDateFilter',
    props.column,
    props.table,
);
const dir = useDirection();

const table = computed(() => column?.table);
const multiple = computed(
    () => column?.columnDef.meta?.filterVariant === 'date-range',
);
const title = computed(
    () => props.title ?? column?.columnDef.meta?.label ?? column?.id ?? '',
);
// The calendar texts follow the table locale (the browser's without one).
const locale = computed(
    () =>
        table.value?.options.meta?.locale ??
        (typeof navigator === 'undefined' ? 'en' : navigator.language),
);
const weekStartsOn = computed(() => getWeekStartsOn(locale.value));

const dates = computed(() =>
    parseFilterValue(column?.getFilterValue()).map((value) =>
        toCalendarDate(value),
    ),
);
const includesEmpty = computed(() => (column ? getEmptyFilter(column) : false));
const hasDates = computed(() => dates.value.some(Boolean));
const hasValue = computed(() => hasDates.value || includesEmpty.value);

const singleValue = computed(() =>
    multiple.value ? undefined : dates.value[0],
);
const rangeValue = computed<DateRange>(() => ({
    start: multiple.value ? dates.value[0] : undefined,
    end: multiple.value ? dates.value[1] : undefined,
}));

// Month shown by the calendar: the one of the picked date, else today's.
const placeholder = shallowRef<DateValue>(today(getLocalTimeZone()));

const dateText = computed(() => {
    const format = (date: CalendarDate | undefined) =>
        date
            ? formatDate(toJsDate(date), { month: 'short' }, locale.value)
            : '';
    const [from, to] = dates.value;
    const text = !hasDates.value
        ? ''
        : multiple.value && from && to
          ? `${format(from)} - ${format(to)}`
          : format(from ?? to);

    return [
        text,
        includesEmpty.value
            ? getEmptyLabel(column?.columnDef.meta, table.value)
            : '',
    ]
        .filter(Boolean)
        .join(', ');
});

function onOpenChange(open: boolean) {
    if (open) {
        placeholder.value = dates.value[0] ?? today(getLocalTimeZone());
    }
}

function onSelect(date: DateValue | undefined) {
    column?.setFilterValue(date ? toTimestamp(date) : undefined);
}

// The filter only changes once both ends are picked, so the table does not
// search a one-day range in between.
function onRangeSelect(range: DateRange) {
    if (range.start && range.end) {
        column?.setFilterValue([
            toTimestamp(range.start),
            toTimestamp(range.end),
        ]);
    }
}

function onReset() {
    if (column) clearColumnFilter(column);
}

function parseFilterValue(value: unknown): (number | string | undefined)[] {
    if (Array.isArray(value)) {
        return value.map((item) =>
            typeof item === 'number' || typeof item === 'string'
                ? item
                : undefined,
        );
    }
    if (typeof value === 'string' || typeof value === 'number') return [value];
    return [];
}

/** A timestamp of the filter as the calendar day it falls on, locally. */
function toCalendarDate(value: number | string | undefined) {
    if (!value) return undefined;

    const date = new Date(typeof value === 'string' ? Number(value) : value);

    return Number.isNaN(date.getTime())
        ? undefined
        : new CalendarDate(
              date.getFullYear(),
              date.getMonth() + 1,
              date.getDate(),
          );
}

function toJsDate(date: DateValue) {
    return date.toDate(getLocalTimeZone());
}

function toTimestamp(date: DateValue) {
    return toJsDate(date).getTime();
}
</script>

<template>
    <Popover v-if="column" @update:open="onOpenChange">
        <PopoverTrigger as-child>
            <Button
                variant="outline"
                :class="cn('border-dashed', props.class)"
                :disabled="disabled"
            >
                <span
                    v-if="hasValue"
                    aria-hidden="true"
                    class="rounded-sm opacity-70 transition-opacity hover:opacity-100"
                    @click.stop="onReset"
                >
                    <CircleX />
                </span>
                <component
                    :is="icon ?? CalendarIcon"
                    v-else-if="icon !== null"
                />
                <span class="flex min-w-0 items-center gap-2">
                    <span>{{ title }}</span>
                    <template v-if="hasValue">
                        <Separator
                            orientation="vertical"
                            class="mx-0.5 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                        />
                        <!-- Long ranges are cut on small screens; the title shows them whole. -->
                        <span
                            :title="dateText"
                            class="max-w-32 truncate sm:max-w-none"
                            >{{ dateText }}</span
                        >
                    </template>
                </span>
            </Button>
        </PopoverTrigger>
        <PopoverContent
            :aria-label="getMessage(table, 'filter', { label: title })"
            :dir="dir"
            :align="align"
            :class="cn('w-auto p-0', contentClass)"
        >
            <RangeCalendarRoot
                v-if="multiple"
                v-slot="{ grid, weekDays }"
                v-model:placeholder="placeholder"
                :model-value="rangeValue"
                :locale="locale"
                :week-starts-on="weekStartsOn"
                :dir="dir"
                initial-focus
                data-slot="range-calendar"
                class="p-3"
                @update:model-value="onRangeSelect"
            >
                <RangeCalendarHeader class="px-8 pt-0">
                    <DataTableCalendarSelects
                        v-model:placeholder="placeholder"
                        :locale="locale"
                        :table="table"
                    />
                    <RangeCalendarPrevButton
                        :aria-label="getMessage(table, 'previous_month')"
                    />
                    <RangeCalendarNextButton
                        :aria-label="getMessage(table, 'next_month')"
                    />
                </RangeCalendarHeader>
                <div
                    class="mt-4 flex flex-col gap-y-4 sm:flex-row sm:gap-x-4 sm:gap-y-0"
                >
                    <RangeCalendarGrid
                        v-for="month in grid"
                        :key="month.value.toString()"
                    >
                        <RangeCalendarGridHead>
                            <RangeCalendarGridRow>
                                <RangeCalendarHeadCell
                                    v-for="day in weekDays"
                                    :key="day"
                                >
                                    {{ day }}
                                </RangeCalendarHeadCell>
                            </RangeCalendarGridRow>
                        </RangeCalendarGridHead>
                        <RangeCalendarGridBody>
                            <RangeCalendarGridRow
                                v-for="(weekDates, index) in month.rows"
                                :key="`weekDate-${index}`"
                                class="mt-2 w-full"
                            >
                                <RangeCalendarCell
                                    v-for="weekDate in weekDates"
                                    :key="weekDate.toString()"
                                    :date="weekDate"
                                >
                                    <RangeCalendarCellTrigger
                                        :day="weekDate"
                                        :month="month.value"
                                    />
                                </RangeCalendarCell>
                            </RangeCalendarGridRow>
                        </RangeCalendarGridBody>
                    </RangeCalendarGrid>
                </div>
            </RangeCalendarRoot>
            <Calendar
                v-else
                v-model:placeholder="placeholder"
                :model-value="singleValue"
                :locale="locale"
                :week-starts-on="weekStartsOn"
                :dir="dir"
                initial-focus
                @update:model-value="onSelect"
            >
                <template #calendar-heading>
                    <DataTableCalendarSelects
                        v-model:placeholder="placeholder"
                        :locale="locale"
                        :table="table"
                    />
                </template>
            </Calendar>
            <template v-if="column.columnDef.meta?.empty">
                <Separator />
                <div class="p-3">
                    <DataTableEmptyFilter :column="column" />
                </div>
            </template>
            <template v-if="hasValue">
                <Separator />
                <div class="p-3">
                    <Button
                        :aria-label="
                            getMessage(table, 'clear_filter', { label: title })
                        "
                        variant="outline"
                        class="w-full"
                        @click="onReset"
                    >
                        {{ getMessage(table, 'clear') }}
                    </Button>
                </div>
            </template>
        </PopoverContent>
    </Popover>
</template>
