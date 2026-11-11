// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    assignPrototypeAPIs,
    assignTableAPIs,
    type Column,
    type ColumnFilter,
    columnFilteringFeature,
    columnOrderingFeature,
    columnPinningFeature,
    columnSizingFeature,
    columnVisibilityFeature,
    functionalUpdate,
    metaHelper,
    type RowData,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    setStateSlice,
    type Table,
    type TableFeature,
    tableFeatures,
    type Updater,
    globalFilteringFeature,
} from '@tanstack/react-table';

import type {
    DataTableColumnMeta,
    DataTableTableMeta,
} from '@/lib/data-table-types';

import {
    getFilterVariant,
    getIsPlainFilter,
    getPlainFilterValue,
    normalizeColumnFilter,
} from '@/lib/data-table-utils';

declare module '@tanstack/react-table' {
    interface Plugins {
        dataTableFilteringFeature: TableFeature;
    }
}

type DataTableInstance = Table<DataTableFeatures, RowData>;

/**
 * The table filters on the server (`manualFiltering`): this feature only keeps
 * its filters in the URL format. A column has one "plain" filter, the value its
 * filter component edits (`column.getFilterValue()`), and, with `empty: true`
 * in PHP, an `is.empty` filter next to it for the rows without a value.
 */
const dataTableFilteringFeature: TableFeature = {
    getDefaultColumnDef: () => ({
        enableColumnFilter: false,
    }),
    assignColumnPrototype: (prototype, table) => {
        const instance = asDataTable(table);

        assignPrototypeAPIs('dataTableFilteringFeature', prototype, table, {
            column_getFilterValue: {
                fn: (column: { id: string }) =>
                    getPlainFilter(
                        instance,
                        column.id,
                        instance.atoms.columnFilters.get(),
                    ).value,
                memoDeps: () => [instance.atoms.columnFilters.get()],
            },
            column_setFilterValue: {
                fn: (column: { id: string }, updater: Updater<unknown>) =>
                    setPlainFilter(instance, column.id, updater),
            },
        });
    },
    constructTableAPIs: (table) => {
        assignTableAPIs('dataTableFilteringFeature', table, {
            table_setColumnFilters: {
                fn: (updater: Updater<ColumnFilter[]>) =>
                    setStateSlice(
                        table,
                        'columnFilters',
                        (old: ColumnFilter[]) =>
                            functionalUpdate(updater, old).filter(
                                (filter) => !getShouldRemoveFilter(filter),
                            ),
                    ),
            },
        });
    },
};

/**
 * Feature hooks get a `Table` generic over any features. This feature is only
 * registered in `dataTableFeatures`, so its hooks can use that table's types.
 */
function asDataTable(table: object) {
    return table as DataTableInstance;
}

function getPlainFilter(
    instance: DataTableInstance,
    columnId: string,
    filters: ColumnFilter[],
) {
    const variant = getFilterVariant(
        instance.getColumn(columnId)?.columnDef.meta,
    );
    const index = filters.findIndex(
        (filter) =>
            filter.id === columnId &&
            getIsPlainFilter(normalizeColumnFilter(filter, variant)),
    );
    const filter = filters[index];
    const value = filter
        ? getPlainFilterValue(normalizeColumnFilter(filter, variant))
        : undefined;

    return { index, filter, value };
}

function setPlainFilter(
    instance: DataTableInstance,
    columnId: string,
    updater: Updater<unknown>,
) {
    instance.setColumnFilters((old) => {
        const {
            index,
            filter: previous,
            value: previousValue,
        } = getPlainFilter(instance, columnId, old);
        const value = functionalUpdate(updater, previousValue);
        const next: ColumnFilter = previous?.filterId
            ? { id: columnId, value, filterId: previous.filterId }
            : { id: columnId, value };

        if (index === -1) return [...old, next];
        return old.map((filter, filterIndex) =>
            filterIndex === index ? next : filter,
        );
    });
}

/**
 * Only an `undefined` value removes a filter: a cleared filter that keeps an
 * empty value (`''`, `[]`) is sent as no filter, and the `is.empty` filter,
 * whose value is `''`, must survive TanStack's default removal of empty text.
 */
function getShouldRemoveFilter(filter: ColumnFilter) {
    return filter.value === undefined;
}

export const dataTableFeatures = tableFeatures({
    columnFilteringFeature,
    globalFilteringFeature,
    columnOrderingFeature,
    columnPinningFeature,
    columnSizingFeature,
    columnVisibilityFeature,
    rowPaginationFeature,
    rowSelectionFeature,
    rowSortingFeature,
    dataTableFilteringFeature,
    columnMeta: metaHelper<DataTableColumnMeta>(),
    tableMeta: metaHelper<DataTableTableMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

type DataTableColumn<TData extends RowData, TValue> = Column<
    DataTableFeatures,
    TData,
    TValue
>;

function isEmptyFilterOf(filter: ColumnFilter, columnId: string) {
    return filter.id === columnId && filter.operator === 'isEmpty';
}

/**
 * Whether the filter of the column also takes the rows without a value: an
 * `is.empty` filter next to its plain one, added with OR by the server
 * (`empty: true` in PHP).
 */
export function getEmptyFilter<TData extends RowData, TValue>(
    column: DataTableColumn<TData, TValue>,
): boolean {
    return column.table.atoms.columnFilters
        .get()
        .some((filter) => isEmptyFilterOf(filter, column.id));
}

/** Adds or removes the rows without a value, keeping the picked values. */
export function setEmptyFilter<TData extends RowData, TValue>(
    column: DataTableColumn<TData, TValue>,
    include: boolean,
) {
    const variant = getFilterVariant(column.columnDef.meta);

    column.table.setColumnFilters((old) => {
        const rest = old.filter(
            (filter) => !isEmptyFilterOf(filter, column.id),
        );

        return include && variant
            ? [
                  ...rest,
                  {
                      id: column.id,
                      value: '',
                      variant,
                      operator: 'isEmpty',
                      filterId: `${column.id}-empty`,
                  },
              ]
            : rest;
    });
}

/** Removes every filter of the column, the rows without a value included. */
export function clearColumnFilter<TData extends RowData, TValue>(
    column: DataTableColumn<TData, TValue>,
) {
    column.table.setColumnFilters((old) =>
        old.filter((filter) => filter.id !== column.id),
    );
}
