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
    type DataTableColumn,
    type DataTableColumns,
    getColumnId,
    getDefaultRowId,
    type LocalTableState,
    resolveLocale,
    toLocalState,
    toQueryState,
    withColumnMeta,
} from '@/lib/data-table-columns';
import {
    dataTableFeatures,
    type DataTableFeatures,
} from '@/lib/data-table-features';
import { createLoadingPhases, keepTypedSpaces } from '@/lib/data-table-loading';
import {
    type DataTableMessages,
    mergeMessages,
} from '@/lib/data-table-messages';
import {
    arrangeColumns,
    buildTableUrl,
    type ServerDataTable,
    type ServerTableConfig,
    stateToQuery,
} from '@/lib/data-table-server';
import type {
    DataTableColumnMeta,
    DataTableLoadingPhase,
} from '@/lib/data-table-types';

export { getOptionLabel } from '@/components/data-table/data-table-default-column';

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
     * Wait before showing that a visit is loading (dimmed rows), so a fast
     * response shows nothing. 150 ms by default.
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
            onActiveChange: setIsLoading,
        }),
    );
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
    const visitRef = React.useRef(0);
    const serverStateRef = React.useRef(serverState);
    const chainRef = React.useRef<{
        base: LocalTableState;
        next: LocalTableState;
    } | null>(null);

    // Every response brings the normalized state: it is the source of truth. If
    // the user kept typing after the request, their filters and search are kept
    // so what they are typing is not overwritten; so is a space they just typed,
    // which the server trims ("ana " would lose it before "ana perez").
    if (syncedServerState !== serverState) {
        setSyncedServerState(serverState);
        const fromServer = toLocalState(serverState);
        setState((current) =>
            draftVersion === sentVersion
                ? keepTypedSpaces(fromServer, current)
                : {
                      ...fromServer,
                      columnFilters: current.columnFilters,
                      globalFilter: current.globalFilter,
                  },
        );
    }

    React.useEffect(() => {
        serverStateRef.current = serverState;
    }, [serverState]);

    React.useEffect(
        () => () => {
            clearTimeout(timeoutRef.current);
            loadingPhases.dispose();
        },
        [loadingPhases],
    );

    function visit(next: LocalTableState, replace: boolean) {
        const pairs = stateToQuery(toQueryState(next, config), config);
        const id = ++visitRef.current;
        let succeeded = false;

        router.get(
            buildTableUrl(window.location.href, pairs, config.query),
            {},
            {
                only: [prop],
                preserveState: true,
                preserveScroll: true,
                replace,
                onStart: () => loadingPhases.start(),
                onSuccess: () => {
                    succeeded = true;
                },
                // Also after a cancelled or failed visit.
                onFinish: () => {
                    loadingPhases.finish();

                    // The state changed before the response (page 2 at once): without
                    // one, and with no newer visit on its way, it goes back to what
                    // the server last sent, which is what the rows and the URL show.
                    if (
                        !succeeded &&
                        visitRef.current === id &&
                        timeoutRef.current === undefined
                    ) {
                        setState(toLocalState(serverStateRef.current));
                    }
                },
            },
        );
    }

    function visitNow(next: LocalTableState, replace = true) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
        setSentVersion(draftVersion);
        visit(next, replace);
    }

    function visitLater(next: LocalTableState, version: number) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = undefined;
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
