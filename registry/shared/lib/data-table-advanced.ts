// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { ColumnFilter } from '@/lib/data-table-tanstack';

import { normalizeColumnFilter } from '@/lib/data-table-filter-values';
import type { DataTableMessageKey } from '@/lib/data-table-messages';
import {
    type FilterOperator,
    type FilterVariant,
    IMPLICIT_OPERATORS,
    type JoinOperator,
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

/** Operators that already take the rows without a value. */
const NEGATIONS = new Set<FilterOperator>([
    'ne',
    'notInArray',
    'notILike',
    'isNotEmpty',
]);

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
    /**
     * Whether the row also takes the rows without a value: the `is.empty`
     * filter of its column, that the server adds with OR to the other filters
     * of the column. Every row of the column shows it (`normalizeEmptyRows`).
     */
    includesEmpty: boolean;
}

/**
 * Value of the option that stands for the rows without a value in a list of
 * options (the toolbar and the rows of the filter list).
 */
export const EMPTY_VALUE = '\u0000empty';

/** Whether the row has something to send: its filter or the rows without a value. */
export function getIsRowComplete(row: FilterListRow): boolean {
    return row.includesEmpty || getIsFilterComplete(row.filter);
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
 * are removed, and new filters go at the end. The `is.empty` filter of a column
 * goes inside its other rows (`normalizeEmptyRows`).
 */
export function reconcileFilterRows(
    rows: FilterListRow[],
    filters: ColumnFilterItem[],
    createKey: () => string,
): FilterListRow[] {
    const emptyColumns = new Set(
        filters.filter(getIsEmptyFilter).map((filter) => filter.id),
    );
    const candidates = rows.filter(getIsRowComplete);
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
                    // The rows of the column take `is.empty` as a flag: it
                    // only matches a row of its own.
                    getIsEmptyFilter(filter) ===
                        getIsEmptyFilter(candidate.filter) &&
                    matches(candidate.filter, filter),
            );

            if (row) {
                matched.set(row, filter);
                pending.delete(filter);
            }
        }
    }

    return normalizeEmptyRows([
        ...rows.flatMap((row): FilterListRow[] => {
            if (!getIsRowComplete(row)) return [row];

            const filter = matched.get(row);
            const includesEmpty =
                row.includesEmpty && emptyColumns.has(row.filter.id);

            if (filter) return [{ key: row.key, filter, includesEmpty }];

            // Its value is gone but its column still takes the rows without a
            // value: the row keeps showing them.
            return includesEmpty
                ? [
                      {
                          key: row.key,
                          filter: {
                              ...row.filter,
                              value: emptyValue(row.filter.operator),
                          },
                          includesEmpty,
                      },
                  ]
                : [];
        }),
        ...[...pending].map((filter) => ({
            key: createKey(),
            filter,
            includesEmpty: false,
        })),
    ]);
}

/**
 * Puts the `is.empty` filter of each column inside its other rows, as the
 * server adds it with OR to them: when a column has a row with a value (or one
 * that already takes the rows without a value), its "Is empty" rows go away and
 * every other row of the column takes them. Read row by row it says what the
 * server does: `(A or empty) and (B or empty)` is `(A and B) or empty`, and
 * the same with `or`. A column with only "Is empty" keeps it as its own row.
 */
export function normalizeEmptyRows(rows: FilterListRow[]): FilterListRow[] {
    const folded = new Set<string>();

    for (const row of rows) {
        if (getIsEmptyFilter(row.filter)) continue;

        const columnRows = rows.filter(
            (other) => other.filter.id === row.filter.id,
        );
        const wantsEmpty = columnRows.some(
            (other) => other.includesEmpty || getIsEmptyFilter(other.filter),
        );

        if (wantsEmpty && getIsRowComplete(row)) folded.add(row.filter.id);
    }

    return rows.flatMap((row) => {
        const isEmpty = getIsEmptyFilter(row.filter);

        if (!folded.has(row.filter.id)) {
            return [isEmpty ? { ...row, includesEmpty: false } : row];
        }

        return isEmpty ? [] : [{ ...row, includesEmpty: true }];
    });
}

/**
 * Adds or removes the rows without a value of a column: every row of the
 * column shows them, as the server applies them to all of its filters.
 */
export function setRowsEmpty(
    rows: FilterListRow[],
    columnId: string,
    include: boolean,
): FilterListRow[] {
    return normalizeEmptyRows(
        rows.flatMap((row) => {
            if (row.filter.id !== columnId) return [row];
            if (getIsEmptyFilter(row.filter)) return include ? [row] : [];

            return [{ ...row, includesEmpty: include }];
        }),
    );
}

/**
 * The row with another filter (its column, operator or value): a row of another
 * column or an "Is empty" row does not take the rows without a value.
 */
export function updateRowFilter(
    rows: FilterListRow[],
    key: string,
    filter: ColumnFilterItem,
): FilterListRow[] {
    return normalizeEmptyRows(
        rows.map((row) =>
            row.key === key
                ? {
                      key,
                      filter,
                      includesEmpty:
                          row.includesEmpty &&
                          row.filter.id === filter.id &&
                          !getIsEmptyFilter(filter),
                  }
                : row,
        ),
    );
}

/** The filters to send: the complete rows, in their order, with one `is.empty` per column. */
export function getRowFilters(rows: FilterListRow[]): ColumnFilterItem[] {
    const lastEmptyRow = new Map<string, FilterListRow>();

    for (const row of rows) {
        if (row.includesEmpty) lastEmptyRow.set(row.filter.id, row);
    }

    return rows.flatMap((row) => {
        const filters = getIsFilterComplete(row.filter)
            ? [{ ...row.filter, filterId: row.key }]
            : [];

        return lastEmptyRow.get(row.filter.id) === row
            ? [
                  ...filters,
                  {
                      id: row.filter.id,
                      variant: row.filter.variant,
                      operator: 'isEmpty' as const,
                      value: '',
                      filterId: `${row.filter.id}-empty`,
                  },
              ]
            : filters;
    });
}

/**
 * How a row offers the rows without a value: an option of its list of options
 * (`inArray`), a check next to its value, or nothing. The column offers them
 * with `empty: true` in PHP; a negation already takes them (the server adds
 * `IS NULL` to it). A row that already takes them always shows it, so it can
 * be removed.
 */
export function getRowEmptyControl(
    row: Pick<FilterListRow, 'filter' | 'includesEmpty'>,
    offersEmpty: boolean,
): 'option' | 'check' | null {
    const { operator } = row.filter;

    if (operator === 'isEmpty') return null;
    if (!row.includesEmpty && (!offersEmpty || NEGATIONS.has(operator))) {
        return null;
    }

    return operator === 'inArray' ? 'option' : 'check';
}

/**
 * What goes before each row: `where` (the first one), the `select` of the join
 * (the next one) or the join as text.
 */
export type FilterJoinCell = 'where' | 'select' | JoinOperator;

/** What goes before each row of the list. */
export function getRowJoinCells(
    rows: FilterListRow[],
    join: JoinOperator,
): FilterJoinCell[] {
    return rows.map((_row, index) =>
        index === 0 ? 'where' : index === 1 ? 'select' : join,
    );
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

function getIsEmptyFilter(filter: ColumnFilterItem) {
    return filter.operator === 'isEmpty';
}
