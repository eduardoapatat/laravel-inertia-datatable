import { router } from '@inertiajs/react';
import {
    functionalUpdate,
    type ColumnFiltersState,
    type ColumnVisibilityState,
    type PaginationState,
    type RowData,
    type SortingState,
    type TableOptions,
    type Updater,
    useTable,
} from '@tanstack/react-table';
import * as React from 'react';

import {
    DataTableDefaultCell,
    DataTableDefaultHeader,
} from '@/components/data-table/data-table-default-column';
import {
    dataTableFeatures,
    type DataTableFeatures,
} from '@/lib/data-table-features';
import {
    arrangeColumns,
    buildTableUrl,
    type ServerColumnConfig,
    type ServerDataTable,
    type ServerFacetOption,
    type ServerFilter,
    type ServerRangeFacet,
    type ServerTableConfig,
    type ServerTableState,
    stateToQuery,
} from '@/lib/data-table-server';
import {
    type DataTableMessages,
    mergeMessages,
} from '@/lib/data-table-messages';
import type {
    ColumnDisplay,
    ColumnSelectOption,
    DataTableColumnMeta,
    DataTableLoadingPhase,
} from '@/lib/data-table-types';
import { getOwn } from '@/lib/data-table-format';
import {
    createLoadingPhases,
    normalizeColumnFilter,
} from '@/lib/data-table-utils';

export { getOptionLabel } from '@/components/data-table/data-table-default-column';

type DataTableColumns<TData extends RowData> = TableOptions<
    DataTableFeatures,
    TData
>['columns'];

type DataTableColumn<TData extends RowData> = DataTableColumns<TData>[number];

interface LocalTableState {
    pagination: PaginationState;
    sorting: SortingState;
    columnFilters: ColumnFiltersState;
    globalFilter: string;
    columnVisibility: ColumnVisibilityState;
}

export interface UseServerDataTableOptions<TData extends RowData> {
    /** Inertia prop with the response of the laravel-inertia-datatable package. */
    table: ServerDataTable<TData>;
    /** Name of that prop: visits only reload this prop (`only`). */
    prop: string;
    /**
     * TanStack columns that customize the ones of the table class (same id) or
     * that only exist on the client. The server decides the order, the missing
     * columns and their `meta`.
     */
    columns: DataTableColumns<TData>;
    /** Delay after typing in a filter or the search before requesting the server. */
    debounceMs?: number;
    /**
     * Locale to format numbers and dates, over the one of the server
     * (`inertia-datatable.locale` or the app locale); `'browser'` for the
     * browser's.
     */
    locale?: string;
    /** Texts of the UI to change, over the ones of the server lang files. */
    messages?: Partial<DataTableMessages>;
    /**
     * Wait before showing that a visit is loading (dimmed rows and a progress
     * bar), so fast responses do not flicker. 150 ms by default.
     */
    loadingDelay?: number;
    /**
     * Wait before replacing the rows with skeleton rows of the same columns;
     * `false` keeps the dimmed rows. 600 ms by default.
     */
    skeletonDelay?: number | false;
    getRowId?: TableOptions<DataTableFeatures, TData>['getRowId'];
}

/**
 * TanStack table in server mode: the state lives in the URL and every change
 * is a partial Inertia visit that returns the already processed page.
 */
export function useServerDataTable<TData extends RowData>({
    table: serverTable,
    prop,
    columns,
    debounceMs = 300,
    getRowId = getDefaultRowId,
    locale,
    messages,
    loadingDelay = 150,
    skeletonDelay = 600,
}: UseServerDataTableOptions<TData>) {
    const { config, data, facets, meta, state: serverState } = serverTable;

    const [state, setState] = React.useState(() => toLocalState(serverState));
    const [syncedServerState, setSyncedServerState] =
        React.useState(serverState);
    const [draftVersion, setDraftVersion] = React.useState(0);
    const [sentVersion, setSentVersion] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(false);
    const [loading, setLoading] = React.useState<DataTableLoadingPhase>('idle');
    const [loadingPhases] = React.useState(() =>
        createLoadingPhases({
            loadingDelay,
            skeletonDelay,
            onChange: setLoading,
        }),
    );
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
    const chainRef = React.useRef<{
        base: LocalTableState;
        next: LocalTableState;
    } | null>(null);

    // Every response brings the normalized state: it is the source of truth. If
    // the user kept typing after the request, their filters and search are kept
    // so what they are typing is not overwritten.
    if (syncedServerState !== serverState) {
        setSyncedServerState(serverState);
        const fromServer = toLocalState(serverState);
        setState((current) =>
            draftVersion === sentVersion
                ? fromServer
                : {
                      ...fromServer,
                      columnFilters: current.columnFilters,
                      globalFilter: current.globalFilter,
                  },
        );
    }

    React.useEffect(
        () => () => {
            clearTimeout(timeoutRef.current);
            loadingPhases.dispose();
        },
        [loadingPhases],
    );

    function visit(next: LocalTableState, replace: boolean) {
        const pairs = stateToQuery(toQueryState(next, config), config);

        router.get(
            buildTableUrl(window.location.href, pairs, config.query),
            {},
            {
                only: [prop],
                preserveState: true,
                preserveScroll: true,
                replace,
                onStart: () => {
                    setIsLoading(true);
                    loadingPhases.start();
                },
                // Also after a cancelled or failed visit.
                onFinish: () => {
                    setIsLoading(false);
                    loadingPhases.finish();
                },
            },
        );
    }

    function visitNow(next: LocalTableState, replace = true) {
        clearTimeout(timeoutRef.current);
        setSentVersion(draftVersion);
        visit(next, replace);
    }

    function visitLater(next: LocalTableState, version: number) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setSentVersion(version);
            visit(next, true);
        }, debounceMs);
    }

    /**
     * Applies a change on top of the latest state of the same event: several
     * setters in a row (for example, the Reset button) must not overwrite each other.
     */
    function update(
        change: (current: LocalTableState) => LocalTableState,
    ): LocalTableState {
        const pending = chainRef.current;
        const base = pending?.base === state ? pending.next : state;
        const next = change(base);
        chainRef.current = { base: state, next };
        setState(next);

        return next;
    }

    function onPaginationChange(updater: Updater<PaginationState>) {
        const next = update((current) => {
            const pagination = functionalUpdate(updater, current.pagination);

            return {
                ...current,
                pagination:
                    pagination.pageSize === current.pagination.pageSize
                        ? pagination
                        : { ...pagination, pageIndex: 0 },
            };
        });
        visitNow(next, next.pagination.pageSize !== state.pagination.pageSize);
    }

    function onSortingChange(updater: Updater<SortingState>) {
        const next = update((current) => ({
            ...current,
            sorting: functionalUpdate(updater, current.sorting),
            pagination: { ...current.pagination, pageIndex: 0 },
        }));
        visitNow(next);
    }

    function onColumnVisibilityChange(updater: Updater<ColumnVisibilityState>) {
        const next = update((current) => ({
            ...current,
            columnVisibility: functionalUpdate(
                updater,
                current.columnVisibility,
            ),
        }));
        visitNow(next);
    }

    function onColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
        const next = update((current) => ({
            ...current,
            columnFilters: functionalUpdate(updater, current.columnFilters),
            pagination: { ...current.pagination, pageIndex: 0 },
        }));
        const version = draftVersion + 1;
        setDraftVersion(version);
        visitLater(next, version);
    }

    function onGlobalFilterChange(updater: Updater<unknown>) {
        const next = update((current) => {
            const value = functionalUpdate(updater, current.globalFilter);

            return {
                ...current,
                globalFilter: typeof value === 'string' ? value : '',
                pagination: { ...current.pagination, pageIndex: 0 },
            };
        });
        const version = draftVersion + 1;
        setDraftVersion(version);
        visitLater(next, version);
    }

    const tableColumns = React.useMemo(
        () => withServerMeta(columns, config, facets),
        [columns, config, facets],
    );

    const tableMessages = React.useMemo(
        () => mergeMessages(config.messages, messages),
        [config.messages, messages],
    );

    const table = useTable({
        features: dataTableFeatures,
        columns: tableColumns,
        data,
        getRowId,
        meta: {
            pageSizeOptions: config.per_page_options,
            searchable: config.searchable,
            locale: resolveLocale(locale ?? config.locale),
            dateFormat: config.date_format,
            messages: tableMessages,
            loading,
        },
        rowCount: meta.total,
        // Without rows the server reports 1 page, not 0.
        pageCount: meta.last_page,
        state,
        onPaginationChange,
        onSortingChange,
        onColumnFiltersChange,
        onGlobalFilterChange,
        onColumnVisibilityChange,
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
    });

    /**
     * `isLoading`: a visit is in flight, right away. `loading`: the delayed
     * phase `DataTable` shows (`idle`, `busy`, `slow`).
     */
    return { table, isLoading, loading };
}

/** `'browser'` or nothing: the browser locale (Intl without a locale). */
function resolveLocale(locale: string | null | undefined): string | undefined {
    return locale && locale !== 'browser'
        ? locale.replace('_', '-')
        : undefined;
}

function toLocalState(state: ServerTableState): LocalTableState {
    return {
        pagination: state.pagination,
        sorting: state.sorting,
        columnFilters: state.columnFilters,
        globalFilter: state.globalFilter,
        columnVisibility: state.columnVisibility,
    };
}

function toQueryState(state: LocalTableState, config: ServerTableConfig) {
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

        // Dates relative to today: the server does not support them yet.
        if (item.operator === 'isRelativeToToday') {
            continue;
        }

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
 * Orders the columns like the table class, creates the ones the component does
 * not declare and fills each one with what the server declares: label, filter
 * variant, options with counts, range bounds and capabilities. The `meta`
 * declared by the page (for example, icons) takes precedence.
 */
function withServerMeta<TData extends RowData>(
    columns: DataTableColumns<TData>,
    config: ServerTableConfig,
    facets: ServerDataTable<TData>['facets'],
): DataTableColumns<TData> {
    return arrangeColumns(
        columns,
        config.columns.map((column) => column.id),
        {
            getId: getColumnId,
            isLeading: (column) =>
                (column.meta as DataTableColumnMeta | undefined)?.position ===
                'start',
            resolve: (id, column) => {
                const server = config.columns.find((item) => item.id === id);

                return server
                    ? withColumnMeta(
                          withDefaults(column ?? defaultColumn<TData>(id)),
                          server,
                          facets[id],
                      )
                    : (column ?? defaultColumn<TData>(id));
            },
        },
    );
}

/**
 * Column of the table class that the component does not declare: reads the
 * value by id, which is how the server builds each row.
 */
function defaultColumn<TData extends RowData>(
    id: string,
): DataTableColumn<TData> {
    return {
        id,
        accessorFn: (row: TData) => (row as Record<string, unknown>)[id],
    } as DataTableColumn<TData>;
}

/**
 * Default header and cell for whatever the component does not customize:
 * declaring `cell` is enough to change only how the value looks.
 */
function withDefaults<TData extends RowData>(
    column: DataTableColumn<TData>,
): DataTableColumn<TData> {
    return {
        ...column,
        header: column.header ?? DataTableDefaultHeader,
        cell: column.cell ?? DataTableDefaultCell,
    } as DataTableColumn<TData>;
}

function withColumnMeta<TData extends RowData>(
    column: DataTableColumn<TData>,
    server: ServerColumnConfig,
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
): DataTableColumn<TData> {
    const userMeta = column.meta as DataTableColumnMeta | undefined;

    return {
        ...column,
        meta: {
            ...serverMeta(server, facet, userMeta),
            ...userMeta,
            ...mergedOptions(facet, userMeta),
            ...mergedDisplay(server.display, userMeta?.display),
        } as DataTableColumnMeta,
        enableSorting: column.enableSorting ?? server.sortable,
        enableColumnFilter: column.enableColumnFilter ?? server.filter !== null,
        enableHiding: column.enableHiding ?? server.hideable,
    };
}

function serverMeta(
    server: ServerColumnConfig,
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
    userMeta: DataTableColumnMeta | undefined,
): DataTableColumnMeta {
    const base = {
        label: server.label,
        placeholder: server.filter?.placeholder,
        empty: server.filter?.empty,
        emptyCount: Array.isArray(facet)
            ? facet.find((option) => option.value === null)?.count
            : undefined,
    };
    const filter = server.filter?.variant;
    const display = server.display;

    // The type of the column gives the variant of the meta; its filter, the
    // details (the toolbar only shows the columns that can filter).
    switch (display.type) {
        case 'number': {
            if (filter !== 'range') {
                return { ...base, variant: 'number', unit: display.unit };
            }

            const range = isRangeFacet(facet) ? facet : undefined;

            return {
                ...base,
                variant: 'number',
                filter: 'range',
                unit: display.unit,
                min: range?.min ?? undefined,
                max: range?.max ?? undefined,
            };
        }
        case 'date':
            return filter === 'date-range'
                ? { ...base, variant: 'date', filter: 'range' }
                : { ...base, variant: 'date' };
        case 'option':
            return {
                ...base,
                variant: filter === 'select' ? 'select' : 'multi-select',
                options: toOptions(facet, userMeta),
            };
        default:
            return { ...base, variant: display.type };
    }
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
 * Options always carry the server count, even when the page redeclares them
 * (for example, to add icons).
 */
function mergedOptions(
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
    userMeta: DataTableColumnMeta | undefined,
): { options?: ColumnSelectOption[] } {
    return Array.isArray(facet) ? { options: toOptions(facet, userMeta) } : {};
}

function toOptions(
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
    userMeta: DataTableColumnMeta | undefined,
): ColumnSelectOption[] {
    if (!Array.isArray(facet)) {
        return [];
    }

    const declared =
        userMeta && 'options' in userMeta ? (userMeta.options ?? []) : [];

    // The rows without a value are not an option: the filter adds them apart.
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

function isRangeFacet(
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
): facet is ServerRangeFacet {
    return facet !== undefined && !Array.isArray(facet);
}

function getColumnId<TData extends RowData>(
    column: DataTableColumn<TData>,
): string | undefined {
    if (column.id) {
        return column.id;
    }

    return 'accessorKey' in column && typeof column.accessorKey === 'string'
        ? column.accessorKey
        : undefined;
}

function getDefaultRowId<TData extends RowData>(
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
