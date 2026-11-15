<script setup lang="ts">
import {
    CalendarDate,
    type DateValue,
    getLocalTimeZone,
} from '@internationalized/date';
import { useDateFormatter } from 'reka-ui';
import { computed } from 'vue';

import {
    NativeSelect,
    NativeSelectOption,
} from '@/components/ui/native-select';
import { getMessage, type TableWithMeta } from '@/lib/data-table-messages';

/**
 * Month and year selects of the calendars of the date filter, named with the
 * `month` and `year` texts of the table; they move the month shown.
 */
const props = defineProps<{
    /** The month the calendar shows (`v-model:placeholder`). */
    placeholder: DateValue;
    locale: string;
    table?: TableWithMeta;
}>();

const emit = defineEmits<{ 'update:placeholder': [value: DateValue] }>();

const formatter = useDateFormatter(props.locale);
const months = Array.from({ length: 12 }, (_, index) => index + 1);
const years = computed(() =>
    Array.from(
        { length: 111 },
        (_, index) => props.placeholder.year - 100 + index,
    ),
);

function monthName(month: number) {
    return formatter.custom(
        new CalendarDate(props.placeholder.year, month, 1).toDate(
            getLocalTimeZone(),
        ),
        { month: 'short' },
    );
}

function onChange(unit: 'month' | 'year', event: Event) {
    emit(
        'update:placeholder',
        props.placeholder.set({
            [unit]: Number((event.target as HTMLSelectElement).value),
        }),
    );
}
</script>

<template>
    <div class="flex items-center justify-center gap-1">
        <NativeSelect
            class="h-8 pr-6 pl-2 text-xs"
            :aria-label="getMessage(table, 'month')"
            :model-value="placeholder.month"
            @change="onChange('month', $event)"
        >
            <NativeSelectOption
                v-for="month in months"
                :key="month"
                :value="month"
                :selected="placeholder.month === month"
            >
                {{ monthName(month) }}
            </NativeSelectOption>
        </NativeSelect>
        <NativeSelect
            class="h-8 pr-6 pl-2 text-xs"
            :aria-label="getMessage(table, 'year')"
            :model-value="placeholder.year"
            @change="onChange('year', $event)"
        >
            <NativeSelectOption
                v-for="year in years"
                :key="year"
                :value="year"
                :selected="placeholder.year === year"
            >
                {{ year }}
            </NativeSelectOption>
        </NativeSelect>
    </div>
</template>
