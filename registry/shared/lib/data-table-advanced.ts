// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { ColumnFilter } from '@/lib/data-table-tanstack';

import { normalizeColumnFilter } from '@/lib/data-table-filter-values';
import type { DataTableMessageKey } from '@/lib/data-table-messages';
import {
    type FilterOperator,
    type FilterVariant,
    IMPLICIT_OPERATORS,
    serializeFilter,
} from '@/lib/data-table-server';
import type { ColumnFilterItem } from '@/lib/data-table-types';

/**
 * What the filter list (`DataTableFilterList`) and the sort list
 * (`DataTableSortList`) do without a UI framework: the operators of each
 * variant, the value of a row when its operator changes, and the rows kept in
 * place while the server answers.
 */

const NUMBER_OPERATORS = [
    'eq',
    'ne',
    'lt',
    'lte',
    'gt',
    'gte',
    'isBetween',
    'isEmpty',
    'isNotEmpty',
] as const satisfies readonly FilterOperator[];

const DATE_OPERATORS = [
    'eq',
    'ne',
    'lt',
    'lte',
    'gt',
    'gte',
    'isBetween',
    'isRelativeToToday',
    'isEmpty',
    'isNotEmpty',
] as const satisfies readonly FilterOperator[];

/**
 * Operators the server accepts for each variant, in the order of the menu:
 * the same as `FilterVariant::operators()` in PHP.
 */
export const FILTER_OPERATORS: Record<
    FilterVariant,
    readonly FilterOperator[]
> = {
    text: ['iLike', 'notILike', 'eq', 'ne', 'isEmpty', 'isNotEmpty'],
    number: NUMBER_OPERATORS,
    range: NUMBER_OPERATORS,
    date: DATE_OPERATORS,
    'date-range': DATE_OPERATORS,
    boolean: ['eq', 'ne', 'isEmpty', 'isNotEmpty'],
    select: ['inArray', 'eq', 'ne', 'isEmpty', 'isNotEmpty'],
    'multi-select': ['inArray', 'notInArray', 'isEmpty', 'isNotEmpty'],
};

const OPERATOR_MESSAGES: Record<FilterOperator, DataTableMessageKey> = {
    iLike: 'operator_ilike',
    notILike: 'operator_not_ilike',
    eq: 'operator_eq',
    ne: 'operator_ne',
    lt: 'operator_lt',
    lte: 'operator_lte',
    gt: 'operator_gt',
    gte: 'operator_gte',
    isBetween: 'operator_between',
    isRelativeToToday: 'operator_relative',
    inArray: 'operator_in',
    notInArray: 'operator_not_in',
    isEmpty: 'operator_empty',
    isNotEmpty: 'operator_not_empty',
};

const DATE_OPERATOR_MESSAGES: Partial<
    Record<FilterOperator, DataTableMessageKey>
> = {
    lt: 'operator_before',
    lte: 'operator_on_or_before',
    gt: 'operator_after',
    gte: 'operator_on_or_after',
};

const LIST_OPERATORS = new Set<FilterOperator>([
    'inArray',
    'notInArray',
    'isBetween',
]);

/** Text of an operator in the menu: dates say "is before" instead of "is less than". */
export function getFilterOperatorMessageKey(
    variant: FilterVariant,
    operator: FilterOperator,
): DataTableMessageKey {
    const date = variant === 'date' || variant === 'date-range';

    return (
        (date ? DATE_OPERATOR_MESSAGES[operator] : undefined) ??
        OPERATOR_MESSAGES[operator]
    );
}

/** `is.empty` and `not.is.empty` take no value. */
export function getIsValuelessOperator(operator: FilterOperator): boolean {
    return operator === 'isEmpty' || operator === 'isNotEmpty';
}

/**
 * A new row for a column: its implicit operator and no value yet, so the
 * toolbar filter of the column edits it too.
 */
export function createFilterListItem(
    id: string,
    variant: FilterVariant,
    filterId: string,
): ColumnFilterItem {
    const operator = IMPLICIT_OPERATORS[variant];

    return {
        id,
        variant,
        operator,
        value: emptyValue(operator),
        filterId,
    };
}

/**
 * The row with another operator, keeping what fits of its value: the first
 * value for a single one, the non empty ones for a list and the first one as
 * the start of a range. A `rel` token and a date do not fit each other: the
 * value starts empty when the row enters or leaves `rel`.
 */
export function changeFilterOperator(
    filter: ColumnFilterItem,
    operator: FilterOperator,
): ColumnFilterItem {
    const { range: _range, ...rest } = filter;
    // Enters or leaves `rel`.
    const relative =
        (operator === 'isRelativeToToday') !==
        (filter.operator === 'isRelativeToToday');
    const values = relative
        ? []
        : Array.isArray(filter.value)
          ? filter.value
          : [filter.value];
    const present = values.filter((value) => value !== '');
    let value: string | string[];

    if (getIsValuelessOperator(operator)) {
        value = '';
    } else if (operator === 'isBetween') {
        const [start = '', end = ''] = relative ? [] : values;

        value = Array.isArray(filter.value) ? [start, end] : [start, ''];
    } else if (LIST_OPERATORS.has(operator)) {
        value = present;
    } else {
        value = present[0] ?? '';
    }

    return { ...rest, operator, value };
}

/** Whether the row has what the server needs: it goes in the URL. */
export function getIsFilterComplete(filter: ColumnFilterItem): boolean {
    return serializeFilter(filter) !== null;
}

export interface FilterListRow {
    /** Stable key of the row while the server renames its filters. */
    key: string;
    filter: ColumnFilterItem;
}

/**
 * Filters of the table state as rows of the list: only those of the columns the
 * server filters, each with the variant it declares.
 */
export function getFilterListItems(
    filters: ColumnFilter[],
    variantOf: (columnId: string) => FilterVariant | undefined,
): ColumnFilterItem[] {
    return filters.flatMap((filter) => {
        const variant = variantOf(filter.id);

        return variant ? [normalizeColumnFilter(filter, variant)] : [];
    });
}

/**
 * The rows after a change of the table filters (the server answer, the
 * toolbar): each filter keeps the row that wrote it, matched by the same
 * value, then the same operator, then the same column, so a row keeps its key
 * and its place even when the server renames or normalizes its filter. Rows
 * still without a value stay where they are; complete rows whose filter is gone
 * are removed, and new filters go at the end.
 */
export function reconcileFilterRows(
    rows: FilterListRow[],
    filters: ColumnFilterItem[],
    createKey: () => string,
): FilterListRow[] {
    const candidates = rows.filter((row) => getIsFilterComplete(row.filter));
    const matched = new Map<FilterListRow, ColumnFilterItem>();
    const pending = new Set(filters);
    const matchers: Array<
        (row: ColumnFilterItem, filter: ColumnFilterItem) => boolean
    > = [
        (row, filter) =>
            row.id === filter.id &&
            row.operator === filter.operator &&
            serializeFilter(row) === serializeFilter(filter),
        (row, filter) =>
            row.id === filter.id && row.operator === filter.operator,
        (row, filter) => row.id === filter.id,
    ];

    for (const matches of matchers) {
        for (const filter of pending) {
            const row = candidates.find(
                (candidate) =>
                    !matched.has(candidate) &&
                    matches(candidate.filter, filter),
            );

            if (row) {
                matched.set(row, filter);
                pending.delete(filter);
            }
        }
    }

    return [
        ...rows.flatMap((row) => {
            if (!getIsFilterComplete(row.filter)) return [row];

            const filter = matched.get(row);

            return filter ? [{ key: row.key, filter }] : [];
        }),
        ...[...pending].map((filter) => ({ key: createKey(), filter })),
    ];
}

/** The filters to send: the complete rows, in their order. */
export function getRowFilters(rows: FilterListRow[]): ColumnFilterItem[] {
    return rows
        .filter((row) => getIsFilterComplete(row.filter))
        .map((row) => ({ ...row.filter, filterId: row.key }));
}

/** The list with the item at `from` moved to `to` (the sort priority). */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
    if (to < 0 || to >= items.length || from === to) return items;

    const next = [...items];
    const [item] = next.splice(from, 1);

    if (item !== undefined) next.splice(to, 0, item);

    return next;
}

function emptyValue(operator: FilterOperator): string | string[] {
    if (operator === 'isBetween') return ['', ''];

    return LIST_OPERATORS.has(operator) ? [] : '';
}
