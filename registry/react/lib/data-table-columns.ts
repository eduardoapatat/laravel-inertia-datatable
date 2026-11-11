import type {
    ColumnFiltersState,
    ColumnVisibilityState,
    PaginationState,
    RowData,
    SortingState,
    TableOptions,
} from '@tanstack/react-table';

import type { DataTableFeatures } from '@/lib/data-table-features';
import { normalizeColumnFilter } from '@/lib/data-table-filter-values';
import { getOwn } from '@/lib/data-table-format';
import type {
    ServerColumnConfig,
    ServerFacetOption,
    ServerFilter,
    ServerRangeFacet,
    ServerTableConfig,
    ServerTableState,
    TableQueryState,
} from '@/lib/data-table-server';
import type {
    ColumnDisplay,
    ColumnSelectOption,
    DataTableColumnMeta,
} from '@/lib/data-table-types';

/**
 * What `useServerDataTable` does with the server response, without React:
 * the column `meta` from the table class and the conversion of the table
 * state to the query of the next visit.
 */

export type DataTableColumns<TData extends RowData> = TableOptions<
    DataTableFeatures,
    TData
>['columns'];

export type DataTableColumn<TData extends RowData> =
    DataTableColumns<TData>[number];

type ServerFacet = ServerFacetOption[] | ServerRangeFacet | undefined;

/** The table state the server sends back and the page changes. */
export interface LocalTableState {
    pagination: PaginationState;
    sorting: SortingState;
    columnFilters: ColumnFiltersState;
    globalFilter: string;
    columnVisibility: ColumnVisibilityState;
}

/** `'browser'` or nothing: the browser locale (Intl without a locale). */
export function resolveLocale(
    locale: string | null | undefined,
): string | undefined {
    return locale && locale !== 'browser'
        ? locale.replaceAll('_', '-')
        : undefined;
}

export function toLocalState(state: ServerTableState): LocalTableState {
    return {
        pagination: state.pagination,
        sorting: state.sorting,
        columnFilters: state.columnFilters,
        globalFilter: state.globalFilter,
        columnVisibility: state.columnVisibility,
    };
}

/**
 * The table state as the query of the next visit: only the filters of the
 * columns the server can filter, each one with the variant it declares.
 */
export function toQueryState(
    state: LocalTableState,
    config: ServerTableConfig,
): TableQueryState {
    const variants = new Map(
        config.columns.map((column) => [column.id, column.filter?.variant]),
    );
    const filters: ServerFilter[] = [];

    for (const filter of state.columnFilters) {
        const variant = variants.get(filter.id);

        if (!variant) {
            continue;
        }

        const item = normalizeColumnFilter(filter, variant);

        filters.push({
            id: item.id,
            variant,
            operator: item.operator,
            value: item.value,
        });
    }

    return {
        pageIndex: state.pagination.pageIndex,
        pageSize: state.pagination.pageSize,
        sorting: state.sorting,
        filters,
        globalFilter: state.globalFilter,
        columnVisibility: state.columnVisibility,
    };
}

/**
 * A column with what the server declares: label, filter variant, options with
 * counts, range bounds and capabilities. The `meta` of the page wins, except
 * for the option counts, which are always the server ones.
 */
export function withColumnMeta<TData extends RowData>(
    column: DataTableColumn<TData>,
    server: ServerColumnConfig,
    facet: ServerFacet,
): DataTableColumn<TData> {
    const userMeta = column.meta as DataTableColumnMeta | undefined;
    const options = Array.isArray(facet)
        ? toOptions(facet, userMeta)
        : undefined;

    return {
        ...column,
        meta: {
            ...serverMeta(server, facet),
            ...userMeta,
            ...(options && { options }),
            ...mergedDisplay(server.display, userMeta?.display),
        } as DataTableColumnMeta,
        enableSorting: column.enableSorting ?? server.sortable,
        enableColumnFilter: column.enableColumnFilter ?? server.filter !== null,
        enableHiding: column.enableHiding ?? server.hideable,
    };
}

export function getColumnId<TData extends RowData>(
    column: DataTableColumn<TData>,
): string | undefined {
    if (column.id) {
        return column.id;
    }

    return 'accessorKey' in column && typeof column.accessorKey === 'string'
        ? column.accessorKey
        : undefined;
}

/** The `id` of the row when it has one, else its index. */
export function getDefaultRowId<TData extends RowData>(
    row: TData,
    index: number,
): string {
    const id =
        typeof row === 'object' && row !== null && 'id' in row
            ? row.id
            : undefined;

    return typeof id === 'string' || typeof id === 'number'
        ? String(id)
        : String(index);
}

function serverMeta(
    server: ServerColumnConfig,
    facet: ServerFacet,
): DataTableColumnMeta {
    const range =
        server.filter?.variant === 'range' && isRangeFacet(facet)
            ? facet
            : undefined;

    return {
        label: server.label,
        placeholder: server.filter?.placeholder,
        filterVariant: server.filter?.variant,
        empty: server.filter?.empty,
        emptyCount: Array.isArray(facet)
            ? facet.find((option) => option.value === null)?.count
            : undefined,
        min: range?.min ?? undefined,
        max: range?.max ?? undefined,
    };
}

/**
 * The page `display` wins; with the same type as the server one, only the keys
 * it declares (TanStack merges `meta` shallowly, so it is done here).
 */
function mergedDisplay(
    server: ColumnDisplay,
    page: ColumnDisplay | undefined,
): { display: ColumnDisplay } {
    if (page === undefined || server.type !== page.type) {
        return { display: page ?? server };
    }

    if (server.type === 'number' && page.type === 'number') {
        return {
            display: {
                ...server,
                ...page,
                format: { ...server.format, ...page.format },
            },
        };
    }

    return { display: { ...server, ...page } as ColumnDisplay };
}

/**
 * The server options with the label, icon and other keys the page declares
 * for each value. The rows without a value are not an option: the filter
 * adds them apart.
 */
function toOptions(
    facet: ServerFacetOption[],
    userMeta: DataTableColumnMeta | undefined,
): ColumnSelectOption[] {
    const declared = userMeta?.options ?? [];

    return facet.flatMap(({ value, label, count }) => {
        if (value === null) {
            return [];
        }

        const own = declared.find((item) => item.value === value);

        return {
            ...own,
            value,
            label: own?.label ?? label,
            count,
            icon: own?.icon ?? getOwn(userMeta?.icons, value),
        };
    });
}

function isRangeFacet(facet: ServerFacet): facet is ServerRangeFacet {
    return facet !== undefined && !Array.isArray(facet);
}
