// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { ColumnFilter } from '@tanstack/react-table';

import {
    type FilterOperator,
    type FilterVariant,
    IMPLICIT_OPERATORS,
} from '@/lib/data-table-server';
import type { ColumnFilterItem } from '@/lib/data-table-types';

/**
 * Values of the table filters: the plain value a filter component reads and
 * writes (`column.getFilterValue()`), and the filter with its operator that the
 * server receives.
 */

const MULTI_VALUE_FILTER_VARIANTS: FilterVariant[] = [
    'select',
    'multi-select',
    'range',
    'date-range',
];

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const UNBOUNDED_RANGE: [number, number] = [-Infinity, Infinity];

/**
 * A click on the calendar of a date range filter: the first one only marks
 * the start (nothing is sent yet), the second one gives the range, in order.
 * The same day twice is a one-day range.
 */
export function pickDateRangeDay(
    start: Date | undefined,
    day: Date,
):
    | { start: Date; range?: undefined }
    | { start?: undefined; range: [Date, Date] } {
    if (!start) return { start: day };

    return {
        range: start.getTime() <= day.getTime() ? [start, day] : [day, start],
    };
}

/**
 * A date of a filter: `YYYY-MM-DD` is a local calendar day; a timestamp, a
 * `Date` or another date string are read as is.
 */
export function parseFilterDate(value: unknown): Date | undefined {
    if (value instanceof Date) return getValidDate(value);
    if (typeof value === 'number') return getValidDate(new Date(value));
    if (typeof value !== 'string' || value.trim() === '') return undefined;

    const text = value.trim();
    const match = CALENDAR_DATE_PATTERN.exec(text);
    if (match) {
        const [, year, month, day] = match.map(Number);
        if (year === undefined || month === undefined || day === undefined) {
            return undefined;
        }
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
            ? date
            : undefined;
    }

    const numeric = Number(text);
    return getValidDate(new Date(Number.isNaN(numeric) ? text : numeric));
}

/** The local calendar day of a date, as `YYYY-MM-DD`. */
export function formatFilterDate(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Bounds of a range filter as numbers, clamped to `[min, max]` and in order;
 * an empty or invalid bound is `undefined` (open).
 */
export function getRangeFilterBounds(
    values: [string, string],
    [min, max]: [number, number] = UNBOUNDED_RANGE,
): [number | undefined, number | undefined] {
    const [start, end] = values.map((value) => {
        const number = Number(value);
        return value.trim() === '' || Number.isNaN(number)
            ? undefined
            : Math.min(Math.max(number, min), max);
    });

    return start !== undefined && end !== undefined && start > end
        ? [end, start]
        : [start, end];
}

/**
 * Bounds of a range filter as typed, or `null` when one is not a number, is
 * out of `[min, max]` or the start is after the end.
 */
export function getValidRangeFilterBounds(
    values: [string, string],
    [min, max]: [number, number] = UNBOUNDED_RANGE,
): [number | undefined, number | undefined] | null {
    const [start, end] = values.map((value) =>
        value.trim() === '' ? undefined : Number(value),
    );

    for (const bound of [start, end]) {
        if (bound === undefined) continue;
        if (Number.isNaN(bound) || bound < min || bound > max) return null;
    }
    if (start !== undefined && end !== undefined && start > end) return null;

    return [start, end];
}

/**
 * Whether the filter is the plain one of its variant (the implicit operator),
 * the only one the filter components edit.
 */
export function getIsPlainFilter(filter: ColumnFilterItem) {
    return (
        filter.operator === IMPLICIT_OPERATORS[filter.variant] &&
        Array.isArray(filter.value) === getIsMultiValueVariant(filter.variant)
    );
}

/**
 * The filter of a plain value (what a filter component writes), or `null`
 * when the value is empty.
 */
export function createPlainFilter<TColumnId extends string>(
    id: TColumnId,
    variant: FilterVariant,
    value: unknown,
): ColumnFilterItem<TColumnId> | null {
    if (value === undefined || value === null || value === '') return null;

    const operator = IMPLICIT_OPERATORS[variant];
    const filterId = getPlainFilterId(id);
    const stringify = getFilterValueStringifier(variant);

    if (getIsMultiValueVariant(variant)) {
        const values = normalizeFilterValues(
            variant,
            operator,
            (Array.isArray(value) ? value : [value]).map(stringify),
        );
        if (values.every((item) => item === '')) return null;
        return { id, variant, operator, value: values, filterId };
    }

    if (Array.isArray(value)) return null;

    return { id, variant, operator, value: stringify(value), filterId };
}

/**
 * A filter of the table state, plain or with its operator, as the server
 * filter of the column `variant`: values as strings, dates as `YYYY-MM-DD`
 * and ranges in order.
 */
export function normalizeColumnFilter(
    filter: ColumnFilter,
    variant: FilterVariant,
): ColumnFilterItem {
    const filterId = filter.filterId ?? getPlainFilterId(filter.id);

    if (filter.operator) {
        const filterVariant = filter.variant ?? variant;
        const stringify = getFilterValueStringifier(filterVariant);

        return {
            id: filter.id,
            variant: filterVariant,
            operator: filter.operator,
            value: Array.isArray(filter.value)
                ? normalizeFilterValues(
                      filterVariant,
                      filter.operator,
                      filter.value.map(stringify),
                  )
                : stringify(filter.value),
            filterId,
        };
    }

    const item = createPlainFilter(filter.id, variant, filter.value);
    if (item) return { ...item, filterId };

    return {
        id: filter.id,
        variant,
        operator: IMPLICIT_OPERATORS[variant],
        value: getIsMultiValueVariant(variant) ? [] : '',
        filterId,
    };
}

/**
 * The plain value of a filter, as the filter components read it: a list for
 * selects, numbers for ranges and timestamps for dates.
 */
export function getPlainFilterValue(filter: ColumnFilterItem): unknown {
    const { variant, value } = filter;

    if (variant === 'select' || variant === 'multi-select') {
        return Array.isArray(value) ? value : [value];
    }

    if (variant === 'range') {
        return Array.isArray(value)
            ? value.map((item) => (item === '' ? undefined : Number(item)))
            : value;
    }

    if (getIsDateVariant(variant)) {
        return Array.isArray(value)
            ? value.map((item) => parseFilterDate(item)?.getTime())
            : parseFilterDate(value)?.getTime();
    }

    return value;
}

function getIsDateVariant(variant: FilterVariant) {
    return variant === 'date' || variant === 'date-range';
}

function getIsMultiValueVariant(variant: FilterVariant) {
    return MULTI_VALUE_FILTER_VARIANTS.includes(variant);
}

function getPlainFilterId(columnId: string) {
    return `${columnId}-filter`;
}

function getValidDate(date: Date) {
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeFilterValues(
    variant: FilterVariant,
    operator: FilterOperator,
    values: string[],
) {
    if (operator !== 'isBetween') return values;

    if (getIsDateVariant(variant)) {
        const [start = '', end = ''] = values;
        const startTime = parseFilterDate(start)?.getTime();
        const endTime = parseFilterDate(end)?.getTime();
        return startTime !== undefined &&
            endTime !== undefined &&
            startTime > endTime
            ? [end, start]
            : [start, end];
    }

    if (variant !== 'number' && variant !== 'range') return values;

    const [start = '', end = ''] = values.map((value) => {
        const trimmed = value.trim();
        return trimmed === '' || Number.isNaN(Number(trimmed)) ? '' : trimmed;
    });

    return start !== '' && end !== '' && Number(start) > Number(end)
        ? [end, start]
        : [start, end];
}

function getFilterValueStringifier(variant: FilterVariant) {
    return getIsDateVariant(variant)
        ? stringifyFilterDate
        : stringifyFilterValue;
}

function stringifyFilterDate(value: unknown) {
    const date = parseFilterDate(value);
    return date ? formatFilterDate(date) : '';
}

function stringifyFilterValue(value: unknown): string {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- narrows `unknown` for no-base-to-string
    return String(value as string | number | boolean | bigint);
}
