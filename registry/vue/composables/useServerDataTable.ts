import { router } from '@inertiajs/vue3';
import {
    computed,
    h,
    type MaybeRefOrGetter,
    onScopeDispose,
    ref,
    shallowRef,
    toValue,
    watch,
} from 'vue';

import DataTableCell from '@/components/data-table/DataTableCell.vue';
import type { DataTableAnyColumn } from '@/components/data-table/cells';
import DataTableDefaultHeader from '@/components/data-table/DataTableDefaultHeader.vue';
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
import {
    type CellContext,
    type ColumnFiltersState,
    type ColumnVisibilityState,
    functionalUpdate,
    type HeaderContext,
    type PaginationState,
    type RowData,
    type SortingState,
    type TableOptions,
    type Updater,
    useTable,
} from '@/lib/data-table-tanstack';
import type {
    DataTableColumnMeta,
    DataTableLoadingPhase,
} from '@/lib/data-table-types';

export { getOptionLabel } from '@/lib/data-table-format';

export interface UseServerDataTableOptions<TData extends RowData> {
    /**
     * Inertia prop with the response of the laravel-inertia-datatable package:
     * a getter (`() => props.products`) or a ref, so the table follows each
     * response.
     */
    table: MaybeRefOrGetter<ServerDataTable<TData>>;
    /** Name of that prop: visits only reload this prop (`only`). */
    prop: string;
    /**
     * TanStack columns that customize the ones of the table class (same id) or
     * that only exist on the client. The server decides the order, the missing
     * columns and their `meta`.
     */
    columns: MaybeRefOrGetter<DataTableColumns<TData>>;
    /** Delay after typing in a filter or the search before requesting the server. */
    debounceMs?: number;
    /**
     * Locale to format numbers and dates, over the one of the server
     * (`inertia-datatable.locale` or the app locale); `'browser'` for the
     * browser's.
     */
    locale?: MaybeRefOrGetter<string | undefined>;
    /** Texts of the UI to change, over the ones of the server lang files. */
    messages?: MaybeRefOrGetter<Partial<DataTableMessages> | undefined>;
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
    /**
     * Called when the latest visit fails by network (server down, no
     * connection), after the table goes back to what the server last sent;
     * for example, to show a toast. `<DataTable>` already shows a notice with
     * a retry button.
     */
    onNetworkError?: (error: unknown) => void;
    getRowId?: TableOptions<DataTableFeatures, TData>['getRowId'];
}

/**
 * TanStack table in server mode: the state lives in the URL and every change
 * is a partial Inertia visit that returns the already processed page.
 */
export function useServerDataTable<TData extends RowData>({
    table: serverTableSource,
    prop,
    columns,
    debounceMs = 300,
    getRowId = getDefaultRowId,
    locale,
    messages,
    loadingDelay = 150,
    skeletonDelay = 600,
    onNetworkError,
}: UseServerDataTableOptions<TData>) {
    const serverTable = computed(() => toValue(serverTableSource));

    const state = shallowRef<LocalTableState>(
        toLocalState(serverTable.value.state),
    );
    const isLoading = ref(false);
    const loading = ref<DataTableLoadingPhase>('idle');
    // The state the user asked for in a visit that failed by network: retry
    // sends it again.
    const failedVisit = shallowRef<LocalTableState | null>(null);
    const loadingPhases = createLoadingPhases({
        loadingDelay,
        skeletonDelay,
        onChange: (phase) => {
            loading.value = phase;
        },
        onActiveChange: (active) => {
            isLoading.value = active;
        },
    });
    let draftVersion = 0;
    let sentVersion = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let visitId = 0;

    // Every response brings the normalized state: it is the source of truth. If
    // the user kept typing after the request, their filters and search are kept
    // so what they are typing is not overwritten; so is a space they just typed,
    // which the server trims ("ana " would lose it before "ana perez").
    watch(
        () => serverTable.value.state,
        (serverState) => {
            const fromServer = toLocalState(serverState);
            const current = state.value;

            state.value =
                draftVersion === sentVersion
                    ? keepTypedSpaces(fromServer, current)
                    : {
                          ...fromServer,
                          columnFilters: current.columnFilters,
                          globalFilter: current.globalFilter,
                      };
        },
    );

    onScopeDispose(() => {
        clearTimeout(timeout);
        loadingPhases.dispose();
    });

    function visit(next: LocalTableState, replace: boolean) {
        const { config } = serverTable.value;
        const pairs = stateToQuery(toQueryState(next, config), config);
        const id = ++visitId;
        let succeeded = false;
        let networkError: { error: unknown } | null = null;

        router.get(
            buildTableUrl(window.location.href, pairs, config.query),
            {},
            {
                only: [prop],
                preserveState: true,
                preserveScroll: true,
                replace,
                onStart: () => {
                    failedVisit.value = null;
                    loadingPhases.start();
                },
                onSuccess: () => {
                    succeeded = true;
                },
                // Handled here: `false` keeps Inertia from throwing it.
                onNetworkError: (error) => {
                    networkError = { error };

                    return false;
                },
                // Also after a cancelled or failed visit.
                onFinish: () => {
                    loadingPhases.finish();

                    // The state changed before the response (page 2 at once): without
                    // one, and with no newer visit on its way, it goes back to what
                    // the server last sent, which is what the rows and the URL show.
                    if (!succeeded && visitId === id && timeout === undefined) {
                        state.value = toLocalState(serverTable.value.state);
                    }

                    if (networkError && visitId === id) {
                        failedVisit.value = next;
                        onNetworkError?.(networkError.error);
                    }
                },
            },
        );
    }

    function visitNow(next: LocalTableState, replace = true) {
        clearTimeout(timeout);
        timeout = undefined;
        sentVersion = draftVersion;
        visit(next, replace);
    }

    function visitLater(next: LocalTableState) {
        const version = ++draftVersion;

        clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = undefined;
            sentVersion = version;
            visit(next, true);
        }, debounceMs);
    }

    /**
     * Applies a change on top of the latest state: several setters in a row
     * (for example, the Reset button) build on each other.
     */
    function update(
        change: (current: LocalTableState) => LocalTableState,
    ): LocalTableState {
        const next = change(state.value);
        state.value = next;

        return next;
    }

    function onPaginationChange(updater: Updater<PaginationState>) {
        const pageSize = state.value.pagination.pageSize;
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
        visitNow(next, next.pagination.pageSize !== pageSize);
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
        visitLater(next);
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
        visitLater(next);
    }

    function retry() {
        const next = failedVisit.value;

        if (next) {
            state.value = next;
            visitNow(next);
        }
    }

    const table = useTable<DataTableFeatures, TData>({
        features: dataTableFeatures,
        columns: computed(() =>
            withServerMeta(
                toValue(columns),
                serverTable.value.config,
                serverTable.value.facets,
            ),
        ),
        data: computed(() => serverTable.value.data),
        getRowId,
        meta: computed(() => {
            const { config } = serverTable.value;

            return {
                pageSizeOptions: config.per_page_options,
                searchable: config.searchable,
                locale: resolveLocale(toValue(locale) ?? config.locale),
                dateFormat: config.date_format,
                messages: mergeMessages(config.messages, toValue(messages)),
                loading: loading.value,
                failed: failedVisit.value !== null,
                retry,
            };
        }),
        rowCount: computed(() => serverTable.value.meta.total),
        // Without rows the server reports 1 page, not 0.
        pageCount: computed(() => serverTable.value.meta.last_page),
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
     * phase `DataTable` shows (`idle`, `busy`, `slow`). `failed`: the latest
     * visit failed by network; `retry` sends it again.
     */
    return {
        table,
        isLoading,
        loading,
        failed: computed(() => failedVisit.value !== null),
        retry,
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
        header:
            column.header ??
            (({ column }: HeaderContext<DataTableFeatures, TData, unknown>) =>
                h(DataTableDefaultHeader, {
                    column: column as DataTableAnyColumn,
                })),
        cell:
            column.cell ??
            (({ cell }: CellContext<DataTableFeatures, TData, unknown>) =>
                h(DataTableCell, { cell })),
    } as DataTableColumn<TData>;
}
