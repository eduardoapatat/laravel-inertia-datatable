'use client';

import type { Column, ReactTable, RowData } from '@tanstack/react-table';
import * as React from 'react';

import type { DataTableFeatures } from '@/lib/data-table-features';
import {
    type FilterComponentName,
    getFilterColumnIssue,
} from '@/lib/data-table-utils';

// Holds a table of any row type; each piece reads it with its own TData.
const DataTableContext = React.createContext<unknown>(null);

interface DataTableProviderProps<TData extends RowData> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    children: React.ReactNode;
}

/**
 * Shares the table with the pieces inside it (`DataTable`, the filters, the
 * search, View, Reset and the pagination pieces), so they can go anywhere in
 * the page without a `table` prop each.
 */
export function DataTableProvider<TData extends RowData>({
    table,
    children,
}: DataTableProviderProps<TData>) {
    return (
        <DataTableContext.Provider value={table}>
            {children}
        </DataTableContext.Provider>
    );
}

/**
 * The `table` prop of a piece, or the one of the closest `DataTableProvider`.
 */
export function useDataTable<TData extends RowData>(
    table?: ReactTable<DataTableFeatures, TData, unknown>,
    piece = 'DataTable',
): ReactTable<DataTableFeatures, TData, unknown> {
    const context = React.useContext(DataTableContext) as ReactTable<
        DataTableFeatures,
        TData,
        unknown
    > | null;
    const resolved = table ?? context;

    if (!resolved) {
        throw new Error(
            `${piece}: pass the \`table\` prop or render it inside <DataTableProvider table={table}>.`,
        );
    }

    return resolved;
}

/** Column of a filter: the id of a server column, or the TanStack column. */
export type DataTableColumnRef<TData extends RowData> =
    | string
    | Column<DataTableFeatures, TData>;

/**
 * Props shared by the filter components.
 */
export interface DataTableFilterPieceProps<TData extends RowData> {
    /** Not needed inside `DataTableProvider` or with a column object. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    /** Id of the column in the PHP table class (or the TanStack column). */
    column: DataTableColumnRef<TData>;
    /** Text of the button; the label of the column by default. */
    title?: string;
    /** Icon of the button while empty; `null` hides it. */
    icon?: React.ComponentType<React.ComponentProps<'svg'>> | null;
    /** Classes of the button. */
    className?: string;
    /** Classes of the popover. */
    contentClassName?: string;
    /** Alignment of the popover with the button. */
    align?: 'start' | 'center' | 'end';
    disabled?: boolean;
}

/**
 * Column a filter component edits, or `undefined` (with a warning outside
 * production) when the server did not declare that kind of filter for it.
 */
export function useDataTableFilterColumn<TData extends RowData>(
    component: FilterComponentName,
    column: DataTableColumnRef<TData>,
    table?: ReactTable<DataTableFeatures, TData, unknown>,
): Column<DataTableFeatures, TData> | undefined {
    const context = React.useContext(DataTableContext) as ReactTable<
        DataTableFeatures,
        TData,
        unknown
    > | null;
    let resolved: Column<DataTableFeatures, TData> | undefined;
    let columnId: string;

    if (typeof column === 'string') {
        const owner = table ?? context;

        if (!owner) {
            throw new Error(
                `${component}: pass the \`table\` prop or render it inside <DataTableProvider table={table}>.`,
            );
        }

        columnId = column;
        resolved = owner.getAllColumns().find((item) => item.id === column);
    } else {
        columnId = column.id;
        resolved = column;
    }

    const issue = getFilterColumnIssue(component, columnId, resolved);

    React.useEffect(() => {
        if (process.env.NODE_ENV === 'production' || !issue) return;
        console.warn(issue);
    }, [issue]);

    return issue ? undefined : resolved;
}
