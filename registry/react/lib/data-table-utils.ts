// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type {
    Cell,
    Column,
    ColumnFilter,
    RowData,
    SortingState,
    Table,
} from '@tanstack/react-table';

import type { DataTableFeatures } from '@/lib/data-table-features';
import type {
    ColumnFilterItem,
    ColumnSelectOption,
    ColumnVariantMeta,
    DataTableAlign,
    DataTableColumnMeta,
    DataTableLoadingPhase,
    FilterOperator,
    FilterOperatorOption,
    FilterVariant,
} from '@/lib/data-table-types';

import { formatDate } from '@/lib/data-table-format';
import type { ServerTableConfig } from '@/lib/data-table-server';

export const FILTER_VARIANTS = [
    'text',
    'number',
    'range',
    'date',
    'date-range',
    'boolean',
    'select',
    'multi-select',
] as const;

export const FILTER_OPERATORS = {
    iLike: 'ilike',
    notILike: 'not.ilike',
    eq: 'eq',
    ne: 'neq',
    inArray: 'in',
    notInArray: 'not.in',
    isEmpty: 'is.empty',
    isNotEmpty: 'not.is.empty',
    lt: 'lt',
    lte: 'lte',
    gt: 'gt',
    gte: 'gte',
    isBetween: 'between',
    isRelativeToToday: 'rel',
} as const;

export const SORT_ORDERS = [
    { label: 'Asc', value: 'asc' },
    { label: 'Desc', value: 'desc' },
] as const;

const TEXT_OPERATORS = [
    { label: 'Contains', value: 'iLike' },
    { label: 'Does not contain', value: 'notILike' },
    { label: 'Is', value: 'eq' },
    { label: 'Is not', value: 'ne' },
    { label: 'Is empty', value: 'isEmpty' },
    { label: 'Is not empty', value: 'isNotEmpty' },
] satisfies FilterOperatorOption[];

const NUMERIC_OPERATORS = [
    { label: 'Is', value: 'eq' },
    { label: 'Is not', value: 'ne' },
    { label: 'Is less than', value: 'lt' },
    { label: 'Is less than or equal to', value: 'lte' },
    { label: 'Is greater than', value: 'gt' },
    { label: 'Is greater than or equal to', value: 'gte' },
    { label: 'Is between', value: 'isBetween' },
    { label: 'Is empty', value: 'isEmpty' },
    { label: 'Is not empty', value: 'isNotEmpty' },
] satisfies FilterOperatorOption[];

const DATE_OPERATORS = [
    { label: 'Is', value: 'eq' },
    { label: 'Is not', value: 'ne' },
    { label: 'Is before', value: 'lt' },
    { label: 'Is after', value: 'gt' },
    { label: 'Is on or before', value: 'lte' },
    { label: 'Is on or after', value: 'gte' },
    { label: 'Is between', value: 'isBetween' },
    { label: 'Is relative to today', value: 'isRelativeToToday' },
    { label: 'Is empty', value: 'isEmpty' },
    { label: 'Is not empty', value: 'isNotEmpty' },
] satisfies FilterOperatorOption[];

const SELECT_OPERATORS = [
    { label: 'Is', value: 'eq' },
    { label: 'Is not', value: 'ne' },
    { label: 'Is empty', value: 'isEmpty' },
    { label: 'Is not empty', value: 'isNotEmpty' },
] satisfies FilterOperatorOption[];

const MULTI_SELECT_OPERATORS = [
    { label: 'Has any of', value: 'inArray' },
    { label: 'Has none of', value: 'notInArray' },
    { label: 'Is empty', value: 'isEmpty' },
    { label: 'Is not empty', value: 'isNotEmpty' },
] satisfies FilterOperatorOption[];

const BOOLEAN_OPERATORS = [
    { label: 'Is', value: 'eq' },
    { label: 'Is not', value: 'ne' },
    { label: 'Is empty', value: 'isEmpty' },
    { label: 'Is not empty', value: 'isNotEmpty' },
] satisfies FilterOperatorOption[];

const MULTI_VALUE_FILTER_VARIANTS: FilterVariant[] = [
    'select',
    'multi-select',
    'range',
    'date-range',
];

const FILTER_OPERATORS_BY_VARIANT: Record<
    FilterVariant,
    FilterOperatorOption[]
> = {
    text: TEXT_OPERATORS,
    number: NUMERIC_OPERATORS,
    range: NUMERIC_OPERATORS,
    date: DATE_OPERATORS,
    'date-range': DATE_OPERATORS,
    boolean: BOOLEAN_OPERATORS,
    select: SELECT_OPERATORS,
    'multi-select': MULTI_SELECT_OPERATORS,
};

export function getAriaSort(
    sorting: SortingState,
    columnId: string,
): React.AriaAttributes['aria-sort'] {
    const sort = sorting[0];
    if (sort?.id !== columnId) return undefined;
    return sort.desc ? 'descending' : 'ascending';
}

export function getVisibleSelectedRows<TData extends RowData>(
    table: Table<DataTableFeatures, TData>,
) {
    return table.getRowModel().rows.filter((row) => row.getIsSelected());
}

export function getColumnPinningStyle<TData extends RowData>(
    column: Column<DataTableFeatures, TData>,
    isPinned = column.getIsPinned(),
): React.CSSProperties {
    return {
        insetInlineStart:
            isPinned === 'start'
                ? `var(${getColumnVar(column.id, 'offset')})`
                : undefined,
        insetInlineEnd:
            isPinned === 'end'
                ? `var(${getColumnVar(column.id, 'offset')})`
                : undefined,
        position: isPinned ? 'sticky' : 'relative',
        // The width is the `w-(--cell-size)` class of the cell, so the Tailwind
        // classes of `meta.className` can replace it (an inline width cannot).
        ['--cell-size' as string]: `var(${getColumnVar(column.id, 'size')})`,
        zIndex: isPinned ? 20 : undefined,
    };
}

/**
 * Width class and the `meta` classes of a column, for its header or its cells
 * (to combine with `cn`, which lets a `w-*` of the page replace the default).
 */
export function getColumnClassName(
    meta: DataTableColumnMeta | undefined,
    part: 'header' | 'cell',
    cell?: Cell<DataTableFeatures, RowData>,
): string[] {
    const own =
        part === 'header'
            ? meta?.headerClassName
            : typeof meta?.cellClassName === 'function'
              ? cell
                  ? meta.cellClassName(cell)
                  : undefined
              : meta?.cellClassName;

    return [
        'w-(--cell-size)',
        ALIGN_CLASSES[getColumnAlign(meta)],
        meta?.className,
        own,
    ].filter((item): item is string => typeof item === 'string' && item !== '');
}

export function getColumnSizingStyle<TData extends RowData>(
    table: Table<DataTableFeatures, TData>,
): React.CSSProperties {
    // No minWidth: with `table-fixed` the browser already widens the table to
    // the sum of its columns, also when Tailwind classes change their width.
    const style: Record<string, string> = {};

    for (const header of table.getFlatHeaders()) {
        style[getColumnVar(header.column.id, 'size')] = `${header.getSize()}px`;
    }

    for (const { column } of table.getLeafHeaders()) {
        const isPinned = column.getIsPinned();
        if (!isPinned) continue;

        const offset =
            isPinned === 'start'
                ? column.getStart('start')
                : column.getAfter('end');
        style[getColumnVar(column.id, 'offset')] = `${offset}px`;
    }

    return style;
}

export function getFilterOperators(filterVariant: FilterVariant) {
    return FILTER_OPERATORS_BY_VARIANT[filterVariant] ?? [];
}

export function getDefaultFilterOperator(filterVariant: FilterVariant) {
    const operators = getFilterOperators(filterVariant);

    return operators[0]?.value ?? (filterVariant === 'text' ? 'iLike' : 'eq');
}

export function getIsEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;

    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
    );
}

export function getIsValuelessOperator(operator: FilterOperator) {
    return operator === 'isEmpty' || operator === 'isNotEmpty';
}

export function coerceFilterValue(
    operator: FilterOperator,
    value: string | string[],
) {
    if (getIsValuelessOperator(operator)) return '';

    if (operator === 'inArray' || operator === 'notInArray') {
        if (Array.isArray(value)) return value;
        return value ? [value] : [];
    }

    if (operator === 'isBetween') {
        return Array.isArray(value) ? value : [value, ''];
    }

    if (Array.isArray(value)) return value.find((item) => item !== '') ?? '';

    return value;
}

export function getFilterVariant(
    meta: ColumnVariantMeta | undefined,
): FilterVariant {
    switch (meta?.variant) {
        case 'number':
            return meta.filter === 'range' ? 'range' : 'number';
        case 'date':
            return meta.filter === 'range' ? 'date-range' : 'date';
        case 'boolean':
        case 'select':
        case 'multi-select':
            return meta.variant;
        default:
            return 'text';
    }
}

export function getColumnSelectOptions(
    meta: ColumnVariantMeta | undefined,
): ColumnSelectOption[] {
    return meta?.variant === 'select' || meta?.variant === 'multi-select'
        ? (meta.options ?? [])
        : [];
}

/**
 * Server filter variants that each filter component can edit. A component on
 * another variant would send values the server drops, so it renders nothing.
 */
export const FILTER_COMPONENT_VARIANTS = {
    DataTableTextFilter: ['text'],
    DataTableNumberFilter: ['number'],
    DataTableSliderFilter: ['range'],
    DataTableDateFilter: ['date', 'date-range'],
    DataTableBooleanFilter: ['boolean'],
    DataTableFacetedFilter: ['select', 'multi-select', 'boolean'],
} as const satisfies Record<string, readonly FilterVariant[]>;

export type FilterComponentName = keyof typeof FILTER_COMPONENT_VARIANTS;

/**
 * Component that edits a server filter variant, as the toolbar renders it.
 */
export function getFilterComponentName(
    variant: FilterVariant,
): FilterComponentName | undefined {
    switch (variant) {
        case 'text':
            return 'DataTableTextFilter';
        case 'number':
            return 'DataTableNumberFilter';
        case 'range':
            return 'DataTableSliderFilter';
        case 'date':
        case 'date-range':
            return 'DataTableDateFilter';
        case 'boolean':
            return 'DataTableBooleanFilter';
        case 'select':
        case 'multi-select':
            return 'DataTableFacetedFilter';
        default:
            return undefined;
    }
}

/**
 * Why a filter component can not edit a column, or `undefined` when it can:
 * the column must exist, have a filter declared in the PHP class and use a
 * variant the component edits.
 */
export function getFilterColumnIssue(
    component: FilterComponentName,
    columnId: string,
    column:
        | {
              getCanFilter: () => boolean;
              columnDef: { meta?: ColumnVariantMeta };
          }
        | undefined,
): string | undefined {
    if (!column) {
        return `${component}: the table has no column "${columnId}". Use the id of a column of the PHP table class.`;
    }

    if (!column.getCanFilter() || !column.columnDef.meta?.variant) {
        return `${component}: column "${columnId}" has no filter. Declare it in the PHP table class (\`->filterInput()\`, \`->filterSelect()\`, \`->filterMultiSelect()\`, \`->filterRange()\`, \`->filterDate()\`).`;
    }

    const variant = getFilterVariant(column.columnDef.meta);
    const accepted: readonly FilterVariant[] =
        FILTER_COMPONENT_VARIANTS[component];

    if (accepted.includes(variant)) return undefined;

    const expected = getFilterComponentName(variant);

    return `${component}: column "${columnId}" filters as "${variant}" on the server${expected ? `; use ${expected}` : ''}.`;
}

/**
 * Options of a boolean filter: the labels of `->labels()`, or Yes / No of the
 * table texts, with the icons of `meta.icons`.
 */
export function getBooleanFilterOptions(
    meta: DataTableColumnMeta | undefined,
    texts: { yes: string; no: string },
    labels?: { true: string; false: string },
): ColumnSelectOption[] {
    const display = meta?.display;
    const resolved = labels ??
        (display?.type === 'boolean' ? display.labels : undefined) ?? {
            true: texts.yes,
            false: texts.no,
        };

    return [
        { label: resolved.true, value: 'true', icon: meta?.icons?.true },
        { label: resolved.false, value: 'false', icon: meta?.icons?.false },
    ];
}

/**
 * Options of a select filter, limited to the ones the server declared: a
 * custom list can relabel, reorder or leave out options, never add values.
 */
export function getFacetedFilterOptions(
    serverOptions: ColumnSelectOption[],
    options?: ColumnSelectOption[],
): ColumnSelectOption[] {
    if (!options) return serverOptions;

    const byValue = new Map(
        serverOptions.map((option) => [option.value, option]),
    );

    return options.flatMap((option) => {
        const server = byValue.get(option.value);

        return server ? [{ ...server, ...option }] : [];
    });
}

interface LoadingPhasesOptions {
    /** Before it, a fast response shows nothing (no flicker). */
    loadingDelay: number;
    /** After it, the rows become skeleton rows; `false` never. */
    skeletonDelay: number | false;
    onChange: (phase: DataTableLoadingPhase) => void;
    /** At once when the first visit starts and when the last one ends. */
    onActiveChange?: (active: boolean) => void;
}

/**
 * Timers of the loading state of the visits: `start()` when one begins (`busy`
 * after `loadingDelay`, `slow` after `skeletonDelay`), `finish()` when it ends
 * or is cancelled, `dispose()` on unmount. A visit that replaces another one
 * (the cancelled one finishes right before the new one starts) keeps the
 * state and its timers, so the indicator does not blink between both.
 */
export function createLoadingPhases({
    loadingDelay,
    skeletonDelay,
    onChange,
    onActiveChange,
}: LoadingPhasesOptions) {
    let timers: ReturnType<typeof setTimeout>[] = [];
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let phase: DataTableLoadingPhase = 'idle';
    let inFlight = 0;
    let active = false;

    function set(next: DataTableLoadingPhase) {
        if (next === phase) return;
        phase = next;
        onChange(next);
    }

    function clear() {
        timers.forEach((timer) => clearTimeout(timer));
        timers = [];
        clearTimeout(settleTimer);
        settleTimer = undefined;
    }

    return {
        start() {
            inFlight += 1;
            clearTimeout(settleTimer);
            settleTimer = undefined;

            if (active) return;

            active = true;
            onActiveChange?.(true);
            timers.push(
                setTimeout(() => set('busy'), Math.max(0, loadingDelay)),
            );

            if (skeletonDelay !== false) {
                timers.push(
                    setTimeout(
                        () => set('slow'),
                        Math.max(loadingDelay, skeletonDelay),
                    ),
                );
            }
        },
        finish() {
            inFlight = Math.max(0, inFlight - 1);

            if (inFlight > 0 || !active) return;

            // Wait a tick: the visit that replaces this one starts next.
            clearTimeout(settleTimer);
            settleTimer = setTimeout(() => {
                clear();
                active = false;
                onActiveChange?.(false);
                set('idle');
            }, 0);
        },
        dispose: clear,
    };
}

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

export function getDefaultFilter<TData extends RowData>(
    column: Column<DataTableFeatures, TData>,
) {
    const variant = getFilterVariant(column.columnDef.meta);

    return {
        id: column.id,
        variant,
        operator: getDefaultFilterOperator(variant),
        value: '',
    };
}

export function getSelectFilterValue(filter: ColumnFilterItem) {
    if (filter.variant === 'multi-select') {
        return Array.isArray(filter.value) ? filter.value : [];
    }

    return typeof filter.value === 'string' ? filter.value : undefined;
}

/**
 * Whether the default cell of the column is a number cell.
 */
export function isNumberColumn(meta: DataTableColumnMeta | undefined) {
    return meta?.display
        ? meta.display.type === 'number'
        : meta?.variant === 'number';
}

/**
 * Alignment of the header and the cells of a column: `meta.align`, else `end`
 * for numbers (figures line up) and `start` for the rest.
 */
export function getColumnAlign(
    meta: DataTableColumnMeta | undefined,
): DataTableAlign {
    return meta?.align ?? (isNumberColumn(meta) ? 'end' : 'start');
}

// `end` adds room before the next column, which usually starts at its start.
const ALIGN_CLASSES: Record<DataTableAlign, string> = {
    start: 'text-start',
    center: 'text-center',
    end: 'pe-8 text-end',
};

function getColumnVar(columnId: string, property: 'size' | 'offset') {
    const name = columnId.replace(
        /[^a-zA-Z0-9-]/g,
        (char) => `_${char.codePointAt(0)?.toString(16)}_`,
    );
    return `--column-${name}-${property}`;
}

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

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

export function formatFilterDate(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

export function getIsDateVariant(variant: FilterVariant) {
    return variant === 'date' || variant === 'date-range';
}

export function getFilterDates(value: ColumnFilterItem['value']) {
    return (Array.isArray(value) ? value : [value]).flatMap((item) => {
        const date = parseFilterDate(item);
        return date ? [date] : [];
    });
}

export function getFilterDateValue(date: Date | undefined) {
    return date ? formatFilterDate(date) : '';
}

export function getDateFilterLabel(filter: ColumnFilterItem) {
    const [startDate, endDate] = getFilterDates(filter.value);
    if (!startDate) return undefined;

    const start = formatDate(startDate, { month: 'short' });
    if (
        filter.operator !== 'isBetween' ||
        !endDate ||
        startDate.toDateString() === endDate.toDateString()
    ) {
        return start;
    }

    return `${start} - ${formatDate(endDate, { month: 'short' })}`;
}

export function stringifyFilterValue(value: unknown): string {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- narrows `unknown` for no-base-to-string
    return String(value as string | number | boolean | bigint);
}

const UNBOUNDED_RANGE: [number, number] = [-Infinity, Infinity];

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

export function getIsMultiValueVariant(variant: FilterVariant) {
    return MULTI_VALUE_FILTER_VARIANTS.includes(variant);
}

export function getPlainFilterOperator(variant: FilterVariant): FilterOperator {
    if (variant === 'select' || variant === 'multi-select') return 'inArray';
    if (variant === 'range' || variant === 'date-range') return 'isBetween';
    return getDefaultFilterOperator(variant);
}

export function getIsPlainFilter(filter: ColumnFilterItem) {
    return (
        filter.operator === getPlainFilterOperator(filter.variant) &&
        Array.isArray(filter.value) === getIsMultiValueVariant(filter.variant)
    );
}

export function getPlainFilterId(columnId: string) {
    return `${columnId}-filter`;
}

export function createPlainFilter<TColumnId extends string>(
    id: TColumnId,
    variant: FilterVariant,
    value: unknown,
): ColumnFilterItem<TColumnId> | null {
    if (value === undefined || value === null || value === '') return null;

    const operator = getPlainFilterOperator(variant);
    const filterId = getPlainFilterId(id);
    const stringify = getFilterValueStringifier(variant, operator);

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

export function normalizeColumnFilter(
    filter: ColumnFilter,
    variant: FilterVariant,
): ColumnFilterItem {
    const filterId = filter.filterId ?? getPlainFilterId(filter.id);

    if (filter.operator) {
        const filterVariant = filter.variant ?? variant;
        const stringify = getFilterValueStringifier(
            filterVariant,
            filter.operator,
        );

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
        operator: getPlainFilterOperator(variant),
        value: getIsMultiValueVariant(variant) ? [] : '',
        filterId,
    };
}

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

export function getIsActiveFilter(filter: ColumnFilterItem) {
    return (
        getIsValuelessOperator(filter.operator) ||
        (Array.isArray(filter.value)
            ? filter.value.some((value) => value !== '')
            : filter.value !== '')
    );
}

export function getActiveFilters<TFilterItem extends ColumnFilterItem>(
    filters: TFilterItem[],
): TFilterItem[] {
    return filters.filter(getIsActiveFilter);
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

function getFilterValueStringifier(
    variant: FilterVariant,
    operator: FilterOperator,
) {
    return getIsDateVariant(variant) && operator !== 'isRelativeToToday'
        ? stringifyFilterDate
        : stringifyFilterValue;
}

function stringifyFilterDate(value: unknown) {
    const date = parseFilterDate(value);
    return date ? formatFilterDate(date) : '';
}

interface TypedTextState {
    globalFilter: string;
    columnFilters: { id: string; value: unknown }[];
}

/**
 * The state of a response, keeping the spaces around a text the user typed:
 * the server trims the search and the text filters, and writing its value
 * back into the input would eat the space before the next word.
 */
export function keepTypedSpaces<TState extends TypedTextState>(
    fromServer: TState,
    local: TypedTextState,
): TState {
    const typed = (server: unknown, mine: unknown) =>
        typeof server === 'string' &&
        typeof mine === 'string' &&
        mine !== server &&
        mine.trim() === server;

    return {
        ...fromServer,
        globalFilter: typed(fromServer.globalFilter, local.globalFilter)
            ? local.globalFilter
            : fromServer.globalFilter,
        columnFilters: fromServer.columnFilters.map((filter) => {
            const mine = local.columnFilters.find(({ id }) => id === filter.id);

            return typed(filter.value, mine?.value)
                ? { ...filter, value: mine?.value }
                : filter;
        }),
    };
}

export interface DataTableSkeletonShape {
    /** Visible columns, in the server order. */
    columns: {
        id: string;
        label: string;
        align: DataTableAlign;
        /** Its cells hold a badge, a bit taller than a line of text. */
        badge: boolean;
    }[];
    rowCount: number;
    /**
     * A control per column with a filter, also the hidden ones (their filter
     * shows): `input` for the text and number fields, `button` for the rest.
     */
    filters: ('input' | 'button')[];
    filterCount: number;
    searchable: boolean;
    label: string | undefined;
}

/**
 * Shape of the first-load skeleton from the table config (`->config()` in
 * PHP), so it looks like the table that is coming. `search` is the query
 * string of the page (`window.location.search`): its page size and visible
 * columns win over the defaults, with the rules of the server.
 */
export function getSkeletonShape(
    config: ServerTableConfig,
    search = '',
): DataTableSkeletonShape {
    const params = new URLSearchParams(search);
    const perPage = Number(params.get(config.query.per_page));
    // Like the server: an empty list is no list, and the ids are trimmed.
    const columns = params.get(config.query.columns)?.trim();
    const visible = columns
        ? columns.split(',').map((id) => id.trim())
        : undefined;
    const filters = config.columns.flatMap((column) =>
        column.filter
            ? [
                  column.filter.variant === 'text' ||
                  column.filter.variant === 'number'
                      ? ('input' as const)
                      : ('button' as const),
              ]
            : [],
    );

    return {
        columns: config.columns
            .filter((column) =>
                visible
                    ? !column.hideable || visible.includes(column.id)
                    : column.visible,
            )
            .map(({ id, label, display }) => ({
                id,
                label,
                align: display.type === 'number' ? 'end' : 'start',
                badge: 'badge' in display && display.badge === true,
            })),
        rowCount: config.per_page_options.includes(perPage)
            ? perPage
            : config.per_page,
        filters,
        filterCount: filters.length,
        searchable: config.searchable,
        label: config.messages?.loading,
    };
}
