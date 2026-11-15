<script setup lang="ts">
// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    CalendarDate,
    type DateValue,
    getLocalTimeZone,
    today,
} from '@internationalized/date';
import { CalendarIcon } from '@lucide/vue';
import {
    CalendarRoot,
    type DateRange,
    RangeCalendarRoot,
    useDirection,
} from 'reka-ui';
import { computed, type HTMLAttributes, ref, shallowRef } from 'vue';

import { Button } from '@/components/ui/button';
import {
    CalendarCell,
    CalendarCellTrigger,
    CalendarGrid,
    CalendarGridBody,
    CalendarGridHead,
    CalendarGridRow,
    CalendarHeadCell,
    CalendarHeader,
    CalendarNextButton,
    CalendarPrevButton,
} from '@/components/ui/calendar';
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
import {
    formatFilterDate,
    parseFilterDate,
} from '@/lib/data-table-filter-values';
import { formatDate } from '@/lib/data-table-format';
import {
    getMessage,
    getWeekStartsOn,
    type TableWithMeta,
} from '@/lib/data-table-messages';
import type { ColumnFilterItem } from '@/lib/data-table-types';
import { cn } from '@/lib/utils';

import DataTableCalendarSelects from './DataTableCalendarSelects.vue';

/**
 * Date of a row of `DataTableFilterList`: one day, or a range with
 * `isBetween`, as `YYYY-MM-DD`.
 */
const props = defineProps<{
    /** For the locale and the texts. */
    table: TableWithMeta;
    filter: ColumnFilterItem;
    /** Accessible name of the button and the calendar. */
    label: string;
    class?: HTMLAttributes['class'];
}>();

const emit = defineEmits<{ change: [value: string | string[]] }>();

const dir = useDirection();
const open = ref(false);
const table = computed(() => props.table);
const locale = computed(
    () =>
        table.value.options.meta?.locale ??
        (typeof navigator === 'undefined' ? 'en' : navigator.language),
);
const weekStartsOn = computed(() => getWeekStartsOn(locale.value));
const isRange = computed(() => props.filter.operator === 'isBetween');

const dates = computed(() => {
    const values = Array.isArray(props.filter.value)
        ? props.filter.value
        : [props.filter.value];

    return values.map((value) => toCalendarDate(parseFilterDate(value)));
});
const singleValue = computed(() =>
    isRange.value ? undefined : dates.value[0],
);
const rangeValue = computed<DateRange>(() => ({
    start: isRange.value ? dates.value[0] : undefined,
    end: isRange.value ? dates.value[1] : undefined,
}));

// Month shown by the calendar: the one of the picked date, else today's.
const placeholder = shallowRef<DateValue>(today(getLocalTimeZone()));

const text = computed(() => {
    const format = (date: CalendarDate | undefined) =>
        date
            ? formatDate(toJsDate(date), { month: 'short' }, locale.value)
            : '';
    const [from, to] = dates.value;

    if (!dates.value.some(Boolean)) return '';

    return isRange.value ? `${format(from)} - ${format(to)}` : format(from);
});

function onOpenChange(next: boolean) {
    open.value = next;

    if (next) {
        placeholder.value =
            dates.value.find(Boolean) ?? today(getLocalTimeZone());
    }
}

function onSelect(date: DateValue | undefined) {
    emit('change', date ? formatFilterDate(toJsDate(date)) : '');
    open.value = false;
}

// The value only changes once both ends are picked.
function onRangeSelect(range: DateRange) {
    if (range.start && range.end) {
        emit('change', [
            formatFilterDate(toJsDate(range.start)),
            formatFilterDate(toJsDate(range.end)),
        ]);
        open.value = false;
    }
}

function toCalendarDate(date: Date | undefined) {
    return date
        ? new CalendarDate(
              date.getFullYear(),
              date.getMonth() + 1,
              date.getDate(),
          )
        : undefined;
}

function toJsDate(date: DateValue) {
    return date.toDate(getLocalTimeZone());
}
</script>

<template>
    <Popover :open="open" @update:open="onOpenChange">
        <PopoverTrigger as-child>
            <Button
                data-slot="data-table-filter-value"
                variant="outline"
                :aria-label="label"
                :class="
                    cn(
                        'h-8 w-full justify-start font-normal',
                        !text && 'text-muted-foreground',
                        props.class,
                    )
                "
            >
                <CalendarIcon />
                <span class="truncate">{{
                    text || getMessage(table, 'pick_date')
                }}</span>
            </Button>
        </PopoverTrigger>
        <PopoverContent
            :aria-label="label"
            :dir="dir"
            align="start"
            class="w-auto p-0"
        >
            <RangeCalendarRoot
                v-if="isRange"
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
                <div class="mt-4 flex flex-col gap-y-4">
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
            <CalendarRoot
                v-else
                v-slot="{ grid, weekDays }"
                v-model:placeholder="placeholder"
                :model-value="singleValue"
                :locale="locale"
                :week-starts-on="weekStartsOn"
                :dir="dir"
                initial-focus
                data-slot="calendar"
                class="p-3"
                @update:model-value="onSelect"
            >
                <CalendarHeader class="pt-0">
                    <DataTableCalendarSelects
                        v-model:placeholder="placeholder"
                        :locale="locale"
                        :table="table"
                    />
                    <nav
                        class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-1"
                    >
                        <CalendarPrevButton
                            :aria-label="getMessage(table, 'previous_month')"
                        />
                        <CalendarNextButton
                            :aria-label="getMessage(table, 'next_month')"
                        />
                    </nav>
                </CalendarHeader>
                <div class="mt-4 flex flex-col gap-y-4">
                    <CalendarGrid
                        v-for="month in grid"
                        :key="month.value.toString()"
                    >
                        <CalendarGridHead>
                            <CalendarGridRow>
                                <CalendarHeadCell
                                    v-for="day in weekDays"
                                    :key="day"
                                >
                                    {{ day }}
                                </CalendarHeadCell>
                            </CalendarGridRow>
                        </CalendarGridHead>
                        <CalendarGridBody>
                            <CalendarGridRow
                                v-for="(weekDates, index) in month.rows"
                                :key="`weekDate-${index}`"
                                class="mt-2 w-full"
                            >
                                <CalendarCell
                                    v-for="weekDate in weekDates"
                                    :key="weekDate.toString()"
                                    :date="weekDate"
                                >
                                    <CalendarCellTrigger
                                        :day="weekDate"
                                        :month="month.value"
                                    />
                                </CalendarCell>
                            </CalendarGridRow>
                        </CalendarGridBody>
                    </CalendarGrid>
                </div>
            </CalendarRoot>
        </PopoverContent>
    </Popover>
</template>
