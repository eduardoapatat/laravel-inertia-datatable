import { inject, type InjectionKey, provide, watchEffect } from 'vue';

import type { DataTableFeatures } from '@/lib/data-table-features';
import {
    type FilterComponentName,
    getFilterColumnIssue,
} from '@/lib/data-table-filter-options';
import type {
    Column,
    DataTableIcon,
    RowData,
    Table,
} from '@/lib/data-table-tanstack';

/** The table of `useServerDataTable`, as every piece receives it. */
export type DataTableInstance<TData extends RowData = RowData> = Table<
    DataTableFeatures,
    TData
>;

// Holds a table of any row type; each piece reads it with its own TData.
const DataTableKey: InjectionKey<DataTableInstance> = Symbol('DataTable');

/**
 * Shares the table with the pieces inside the component (`DataTable`, the
 * filters, the search, View, Reset and the pagination pieces), so they can go
 * anywhere in the page without a `table` prop each. `<DataTableProvider>` does
 * the same from a template.
 */
export function provideDataTable<TData extends RowData>(
    table: DataTableInstance<TData>,
): void {
    provide(DataTableKey, table as unknown as DataTableInstance);
}

/**
 * The `table` prop of a piece, or the one of the closest provider.
 */
export function useDataTable<TData extends RowData>(
    table?: DataTableInstance<TData>,
    piece = 'DataTable',
): DataTableInstance<TData> {
    const resolved =
        table ??
        (inject(DataTableKey, null) as DataTableInstance<TData> | null);

    if (!resolved) {
        throw new Error(
            `${piece}: pass the \`table\` prop or render it inside <DataTableProvider :table="table">.`,
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
    /** Not needed inside a provider or with a column object. */
    table?: DataTableInstance<TData>;
    /** Id of the column in the PHP table class (or the TanStack column). */
    column: DataTableColumnRef<TData>;
    /** Text of the button; the label of the column by default. */
    title?: string;
    /** Icon of the button while empty; `null` hides it. */
    icon?: DataTableIcon | null;
    /** Classes of the button. */
    class?: string;
    /** Classes of the popover. */
    contentClass?: string;
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
    table?: DataTableInstance<TData>,
): Column<DataTableFeatures, TData> | undefined {
    let resolved: Column<DataTableFeatures, TData> | undefined;
    let columnId: string;

    if (typeof column === 'string') {
        const owner = useDataTable(table, component);

        columnId = column;
        resolved = owner.getAllColumns().find((item) => item.id === column);
    } else {
        columnId = column.id;
        resolved = column;
    }

    const issue = getFilterColumnIssue(component, columnId, resolved);

    watchEffect(() => {
        if (import.meta.env.PROD || !issue) return;
        console.warn(issue);
    });

    return issue ? undefined : resolved;
}
