import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';

import {
    getHiddenFilterCount,
    setRelativeFilter,
} from '@/lib/data-table-features';
import type { DataTableMessages } from '@/lib/data-table-messages';
import type { ServerDataTable } from '@/lib/data-table-server';
import type {
    DataTableColumnMeta,
    DataTableLoadingPhase,
    ColumnFilterItem,
    DataTableTableMeta,
} from '@/lib/data-table-types';

import {
    lastVisit,
    type Product,
    serverTable,
    visits,
    type Visit,
} from './server-data-table';

/** What the cases use of the TanStack table: the same API in both adapters. */
export interface TestTable {
    setSorting(sorting: { id: string; desc: boolean }[]): void;
    setPageIndex(index: number): void;
    setPageSize(size: number): void;
    setGlobalFilter(value: string): void;
    setColumnFilters(filters: ColumnFilterItem[]): void;
    setColumnVisibility(visibility: Record<string, boolean>): void;
    getColumn(id: string):
        | {
              getFilterValue(): unknown;
              setFilterValue(value: unknown): void;
              columnDef: { meta?: DataTableColumnMeta };
          }
        | undefined;
    getAllLeafColumns(): { id: string }[];
    atoms: {
        pagination: { get(): { pageIndex: number; pageSize: number } };
        sorting: { get(): { id: string; desc: boolean }[] };
        columnFilters: { get(): { id: string; value: unknown }[] };
        globalFilter: { get(): unknown };
        columnVisibility: { get(): Record<string, boolean> };
    };
    options: { meta?: DataTableTableMeta };
}

/** A page column, as plain as both adapters take it. */
export interface TestColumn {
    id?: string;
    accessorKey?: string;
    meta?: DataTableColumnMeta;
}

export interface MountOptions {
    table: ServerDataTable<Product>;
    columns?: TestColumn[];
    debounceMs?: number;
    locale?: string;
    messages?: Partial<DataTableMessages>;
    loadingDelay?: number;
    skeletonDelay?: number | false;
    onNetworkError?: (error: unknown) => void;
}

/** The hook mounted: getters, so each read sees the latest render. */
export interface Mounted {
    table(): TestTable;
    isLoading(): boolean;
    loading(): DataTableLoadingPhase;
    failed(): boolean;
    retry(): void;
}

/**
 * How each framework mounts its hook. Every change of state goes through
 * `act`, so React renders it and Vue runs its watchers.
 */
export interface HookDriver {
    mount(options: MountOptions): Mounted;
    /** A new response of the server, as Inertia gives it to the page. */
    respond(table: ServerDataTable<Product>): Promise<void>;
    act(action: () => void): Promise<void>;
    unmount(): void;
}

const PROP = 'products';

/**
 * The cases of `useServerDataTable`, the same for React and Vue: the hook of
 * each one must behave the same way.
 */
export function defineUseServerDataTableTests(driver: HookDriver): void {
    let hook: Mounted;

    const mount = (options: Partial<MountOptions> = {}) => {
        hook = driver.mount({ table: serverTable(), ...options });

        return hook;
    };
    const act = (action: () => void) => driver.act(action);
    const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));
    const table = () => hook.table();

    /** The server answers a visit: the events Inertia fires, in order. */
    async function respond(
        visit: Visit,
        response: ServerDataTable<Product>,
    ): Promise<void> {
        await act(() => visit.options.onStart());
        await act(() => visit.options.onSuccess());
        await driver.respond(response);
        await act(() => visit.options.onFinish());
    }

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
    });

    afterEach(() => {
        driver.unmount();
        vi.useRealTimers();
    });

    describe('visits', () => {
        it('sorts right away, on the first page, reloading only its prop', async () => {
            mount({
                table: serverTable({
                    pagination: { pageIndex: 2, pageSize: 10 },
                }),
            });

            await act(() => table().setSorting([{ id: 'price', desc: true }]));

            expect(visits()).toHaveLength(1);
            const { url, options } = lastVisit();
            expect(url.pathname).toBe('/products');
            expect(url.searchParams.get('sort')).toBe('-price');
            expect(url.searchParams.has('page')).toBe(false);
            expect(options).toMatchObject({
                only: [PROP],
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
            expect(table().atoms.pagination.get().pageIndex).toBe(0);
        });

        it('adds a page to the history, and a new page size goes back to page 1', async () => {
            mount();

            await act(() => table().setPageIndex(1));

            expect(lastVisit().url.searchParams.get('page')).toBe('2');
            expect(lastVisit().options.replace).toBe(false);

            await act(() => table().setPageSize(25));

            expect(lastVisit().url.searchParams.get('per_page')).toBe('25');
            expect(lastVisit().url.searchParams.has('page')).toBe(false);
            expect(lastVisit().options.replace).toBe(true);
            expect(table().atoms.pagination.get()).toEqual({
                pageIndex: 0,
                pageSize: 25,
            });
        });

        it('waits for the typing to stop before searching or filtering', async () => {
            mount({ debounceMs: 300 });

            await act(() => table().setGlobalFilter('a'));
            await act(() => table().setGlobalFilter('an'));
            await act(() => table().getColumn('name')?.setFilterValue('x'));
            await wait(299);

            expect(visits()).toHaveLength(0);

            await wait(1);

            expect(visits()).toHaveLength(1);
            expect(lastVisit().url.searchParams.get('search')).toBe('an');
            expect(lastVisit().url.searchParams.get('filter[name]')).toBe('x');
            expect(lastVisit().options.replace).toBe(true);
        });

        it('hiding a column visits with the visible ones', async () => {
            mount();

            await act(() =>
                table().setColumnVisibility({
                    name: true,
                    price: false,
                    status: true,
                }),
            );

            expect(lastVisit().url.searchParams.get('columns')).toBe(
                'name,status',
            );
        });

        it('replaces the days of a date filter with a period relative to today, and back', async () => {
            mount();
            const column = () =>
                table().getColumn('released_on') as Parameters<
                    typeof setRelativeFilter
                >[0];
            const january = [
                new Date(2026, 0, 1).getTime(),
                new Date(2026, 0, 31).getTime(),
            ];

            await act(() => column().setFilterValue(january));
            await act(() => setRelativeFilter(column(), 'this-month'));
            await wait(300);

            expect(
                lastVisit().url.searchParams.getAll('filter[released_on]'),
            ).toEqual(['rel.this-month']);

            await act(() => {
                setRelativeFilter(column(), undefined);
                column().setFilterValue(january);
            });
            await wait(300);

            expect(
                lastVisit().url.searchParams.getAll('filter[released_on]'),
            ).toEqual(['2026-01-01,2026-01-31']);
        });

        it('sends the filters of the filter list with their operators', async () => {
            mount({ debounceMs: 300 });

            await act(() =>
                table().setColumnFilters([
                    {
                        id: 'price',
                        variant: 'range',
                        operator: 'gte',
                        value: '10',
                        filterId: 'a',
                    },
                    {
                        id: 'name',
                        variant: 'text',
                        operator: 'notILike',
                        value: 'x',
                        filterId: 'b',
                    },
                    {
                        id: 'price',
                        variant: 'range',
                        operator: 'lte',
                        value: '50',
                        filterId: 'c',
                    },
                ]),
            );
            await wait(300);

            const { searchParams } = lastVisit().url;
            expect(searchParams.getAll('filter[price][]')).toEqual([
                'gte.10',
                'lte.50',
            ]);
            expect(searchParams.get('filter[name]')).toBe('not.ilike.x');
            expect(searchParams.has('join')).toBe(false);
        });

        it('combines the filters with OR right away, on the first page', async () => {
            mount({
                table: serverTable({
                    pagination: { pageIndex: 2, pageSize: 10 },
                    columnFilters: [
                        {
                            id: 'name',
                            filterId: 'name-0',
                            variant: 'text',
                            operator: 'iLike',
                            value: 'a',
                        },
                    ],
                }),
            });

            expect(table().options.meta?.join).toBe('and');

            await act(() => table().options.meta?.setJoin?.('or'));

            expect(visits()).toHaveLength(1);
            expect(lastVisit().url.searchParams.get('join')).toBe('or');
            expect(lastVisit().url.searchParams.get('filter[name]')).toBe('a');
            expect(lastVisit().url.searchParams.has('page')).toBe(false);
            expect(table().options.meta?.join).toBe('or');
            expect(table().atoms.pagination.get().pageIndex).toBe(0);
        });

        it('sorts by several columns in their order', async () => {
            mount();

            await act(() =>
                table().setSorting([
                    { id: 'status', desc: false },
                    { id: 'price', desc: true },
                ]),
            );

            expect(lastVisit().url.searchParams.get('sort')).toBe(
                'status,-price',
            );
        });

        it('makes no visit after it is unmounted with a search pending', async () => {
            mount();

            await act(() => table().setGlobalFilter('ana'));
            driver.unmount();
            await wait(1000);

            expect(visits()).toHaveLength(0);
        });
    });

    describe('toolbar and filter list', () => {
        const columnOf = (id: string) =>
            table().getColumn(id) as Parameters<typeof getHiddenFilterCount>[0];

        it('reads a select filter with "is" as the toolbar value and replaces it', async () => {
            mount({
                table: serverTable({
                    columnFilters: [
                        {
                            id: 'status',
                            filterId: 'status-0',
                            variant: 'select',
                            operator: 'eq',
                            value: 'active',
                        },
                    ],
                }),
            });

            expect(columnOf('status').getFilterValue()).toEqual(['active']);
            expect(getHiddenFilterCount(columnOf('status'))).toBe(0);

            await act(() =>
                columnOf('status').setFilterValue(['active', 'draft']),
            );
            await wait(300);

            const { searchParams } = lastVisit().url;
            expect(searchParams.get('filter[status]')).toBe('active,draft');
            expect(searchParams.getAll('filter[status][]')).toEqual([]);
        });

        it('reads a range filter with "greater or equal" as a range open at the end', () => {
            mount({
                table: serverTable({
                    columnFilters: [
                        {
                            id: 'price',
                            filterId: 'price-0',
                            variant: 'range',
                            operator: 'gte',
                            value: '20',
                        },
                    ],
                }),
            });

            expect(columnOf('price').getFilterValue()).toEqual([20, undefined]);
        });

        it('counts the filters of a column that the toolbar can not show', () => {
            mount({
                table: serverTable({
                    columnFilters: [
                        {
                            id: 'name',
                            filterId: 'name-0',
                            variant: 'text',
                            operator: 'iLike',
                            value: 'a',
                        },
                        {
                            id: 'name',
                            filterId: 'name-1',
                            variant: 'text',
                            operator: 'notILike',
                            value: 'b',
                        },
                        {
                            id: 'status',
                            filterId: 'status-0',
                            variant: 'select',
                            operator: 'ne',
                            value: 'draft',
                        },
                    ],
                }),
            });

            expect(columnOf('name').getFilterValue()).toBe('a');
            expect(getHiddenFilterCount(columnOf('name'))).toBe(1);
            expect(getHiddenFilterCount(columnOf('status'))).toBe(1);
            expect(getHiddenFilterCount(columnOf('price'))).toBe(0);
        });
    });

    describe('responses', () => {
        it('takes the join of the server and leaves it out of the URL when it is and', async () => {
            mount({ table: serverTable({ join: 'or' }) });

            expect(table().options.meta?.join).toBe('or');

            await act(() => table().setPageIndex(1));

            expect(lastVisit().url.searchParams.get('join')).toBe('or');

            await respond(lastVisit(), serverTable({ join: 'and' }));
            await act(() => table().setPageIndex(1));

            expect(table().options.meta?.join).toBe('and');
            expect(lastVisit().url.searchParams.has('join')).toBe(false);
        });

        it('passes the limits of the server in the meta', () => {
            mount();

            expect(table().options.meta).toMatchObject({
                maxFilters: 20,
                maxSorts: 3,
            });
        });

        it('keeps the days the server resolved a period relative to today to', async () => {
            mount();

            await act(() =>
                table().setColumnFilters([
                    {
                        id: 'released_on',
                        variant: 'date-range',
                        operator: 'isRelativeToToday',
                        value: '-7D',
                        filterId: 'released_on-rel',
                    },
                ]),
            );
            await wait(300);
            expect(
                lastVisit().url.searchParams.get('filter[released_on]'),
            ).toBe('rel.-7d');

            await respond(
                lastVisit(),
                serverTable({
                    columnFilters: [
                        {
                            id: 'released_on',
                            filterId: 'released_on-0',
                            variant: 'date-range',
                            operator: 'isRelativeToToday',
                            value: '-7d',
                            range: ['2026-11-09', '2026-11-15'],
                        },
                    ],
                }),
            );

            expect(table().atoms.columnFilters.get()).toEqual([
                expect.objectContaining({
                    id: 'released_on',
                    operator: 'isRelativeToToday',
                    value: '-7d',
                    range: ['2026-11-09', '2026-11-15'],
                }),
            ]);
            expect(
                table().getColumn('released_on')?.columnDef.meta,
            ).toMatchObject({ filterVariant: 'date-range', presets: true });
        });

        it('takes the state of the server, which is the source of truth', async () => {
            mount();

            await act(() =>
                table().getColumn('price')?.setFilterValue(['x', 'y']),
            );
            await wait(300);
            await respond(
                lastVisit(),
                serverTable({
                    sorting: [{ id: 'name', desc: false }],
                    pagination: { pageIndex: 0, pageSize: 25 },
                }),
            );

            // The invalid range was dropped by the server.
            expect(table().atoms.columnFilters.get()).toEqual([]);
            expect(table().atoms.sorting.get()).toEqual([
                { id: 'name', desc: false },
            ]);
            expect(table().atoms.pagination.get().pageSize).toBe(25);
        });

        it('keeps what the user goes on typing while a response arrives', async () => {
            mount();

            await act(() => table().setGlobalFilter('an'));
            await wait(300);
            const first = lastVisit();
            await act(() => table().setGlobalFilter('ana'));
            await respond(
                first,
                serverTable({
                    globalFilter: 'an',
                    sorting: [{ id: 'price', desc: true }],
                }),
            );

            expect(table().atoms.globalFilter.get()).toBe('ana');
            expect(table().atoms.sorting.get()).toEqual([
                { id: 'price', desc: true },
            ]);

            await wait(300);

            expect(visits()).toHaveLength(2);
            expect(lastVisit().url.searchParams.get('search')).toBe('ana');
        });

        it('keeps a space the user typed, which the server trims', async () => {
            mount();

            await act(() => table().setGlobalFilter('ana '));
            await wait(300);

            expect(lastVisit().url.searchParams.get('search')).toBe('ana');

            await respond(lastVisit(), serverTable({ globalFilter: 'ana' }));

            expect(table().atoms.globalFilter.get()).toBe('ana ');
        });

        it('goes back to the state of the server when a visit gets no response', async () => {
            mount();

            await act(() => table().setPageIndex(1));
            const visit = lastVisit();
            await act(() => visit.options.onStart());
            await act(() => visit.options.onFinish());

            expect(table().atoms.pagination.get().pageIndex).toBe(0);
            expect(hook.failed()).toBe(false);
        });

        it('ignores an older visit that ends after a newer one', async () => {
            mount();

            await act(() => table().setPageIndex(1));
            const older = lastVisit();
            await act(() => table().setPageIndex(2));
            await act(() => older.options.onStart());
            await act(() => older.options.onNetworkError(new Error('down')));
            await act(() => older.options.onFinish());

            expect(table().atoms.pagination.get().pageIndex).toBe(2);
            expect(hook.failed()).toBe(false);
        });

        it('does not go back while a search waits to be sent', async () => {
            mount();

            await act(() => table().setPageIndex(1));
            const visit = lastVisit();
            await act(() => table().setGlobalFilter('ana'));
            await act(() => visit.options.onStart());
            await act(() => visit.options.onFinish());

            expect(table().atoms.globalFilter.get()).toBe('ana');
        });
    });

    describe('network errors', () => {
        it('marks the table as failed and retries the same visit', async () => {
            const onNetworkError = vi.fn();
            mount({ onNetworkError });

            await act(() => table().setSorting([{ id: 'price', desc: true }]));
            const visit = lastVisit();
            const error = new Error('down');
            let handled: unknown;
            await act(() => visit.options.onStart());
            await act(() => {
                handled = visit.options.onNetworkError(error);
            });
            await act(() => visit.options.onFinish());

            expect(handled).toBe(false);
            expect(onNetworkError).toHaveBeenCalledWith(error);
            expect(hook.failed()).toBe(true);
            expect(table().options.meta?.failed).toBe(true);
            // The table shows again what the server last sent.
            expect(table().atoms.sorting.get()).toEqual([]);

            await act(() => hook.retry());

            expect(visits()).toHaveLength(2);
            expect(lastVisit().url.href).toBe(visit.url.href);
            expect(table().atoms.sorting.get()).toEqual([
                { id: 'price', desc: true },
            ]);

            await act(() => lastVisit().options.onStart());

            expect(hook.failed()).toBe(false);
        });

        it('retry does nothing when no visit failed', async () => {
            mount();

            await act(() => hook.retry());
            await act(() => table().options.meta?.retry?.());

            expect(visits()).toHaveLength(0);
        });
    });

    describe('loading', () => {
        it('dims the rows after a delay, then shows the skeleton', async () => {
            mount();

            await act(() => table().setPageIndex(1));
            const visit = lastVisit();
            await act(() => visit.options.onStart());

            expect(hook.isLoading()).toBe(true);
            expect(hook.loading()).toBe('idle');

            await wait(149);
            expect(hook.loading()).toBe('idle');
            await wait(1);
            expect(hook.loading()).toBe('busy');
            expect(table().options.meta?.loading).toBe('busy');
            await wait(450);
            expect(hook.loading()).toBe('slow');

            await act(() => visit.options.onSuccess());
            await act(() => visit.options.onFinish());
            await wait(0);

            expect(hook.isLoading()).toBe(false);
            expect(hook.loading()).toBe('idle');
        });

        it('shows nothing for a fast response', async () => {
            mount();

            await act(() => table().setPageIndex(1));
            const visit = lastVisit();
            await act(() => visit.options.onStart());
            await wait(100);
            await act(() => visit.options.onSuccess());
            await act(() => visit.options.onFinish());
            await wait(1000);

            expect(hook.loading()).toBe('idle');
        });

        it('keeps the dimmed rows without a skeleton delay', async () => {
            mount({ loadingDelay: 50, skeletonDelay: false });

            await act(() => table().setPageIndex(1));
            await act(() => lastVisit().options.onStart());
            await wait(5000);

            expect(hook.loading()).toBe('busy');
        });
    });

    describe('columns and meta', () => {
        it('follows the columns of the server and fills them with its meta', () => {
            mount({
                columns: [
                    { id: 'actions' },
                    { id: 'select', meta: { position: 'start' } },
                    { accessorKey: 'price', meta: { label: 'Precio' } },
                ],
            });

            expect(
                table()
                    .getAllLeafColumns()
                    .map(({ id }) => id),
            ).toEqual([
                'select',
                'name',
                'price',
                'status',
                'released_on',
                'actions',
            ]);

            const price = table().getColumn('price')?.columnDef.meta;
            expect(price).toMatchObject({
                label: 'Precio',
                filterVariant: 'range',
                min: 10,
                max: 90,
            });

            const status = table().getColumn('status')?.columnDef.meta;
            expect(status?.label).toBe('Status');
            expect(status?.options?.map(({ value }) => value)).toEqual([
                'active',
                'draft',
            ]);
        });

        it('marks a column with several values per row and sends its filters as any other', async () => {
            const base = serverTable();
            mount({
                table: {
                    ...base,
                    config: {
                        ...base.config,
                        columns: base.config.columns.map((column) =>
                            column.id === 'status'
                                ? {
                                      ...column,
                                      sortable: false,
                                      display: { type: 'option', max: 2 },
                                      filter: { variant: 'multi-select' },
                                      multiple: true,
                                  }
                                : column,
                        ),
                    },
                },
            });

            expect(table().getColumn('status')?.columnDef.meta).toMatchObject({
                multiple: true,
                display: { type: 'option', max: 2 },
            });
            expect(table().getColumn('name')?.columnDef.meta?.multiple).toBe(
                undefined,
            );

            await act(() =>
                table().setColumnFilters([
                    {
                        id: 'status',
                        variant: 'multi-select',
                        operator: 'inArray',
                        value: ['active'],
                        filterId: 'a',
                    },
                    {
                        id: 'status',
                        variant: 'multi-select',
                        operator: 'inArray',
                        value: ['draft'],
                        filterId: 'b',
                    },
                ]),
            );
            await wait(1000);

            // One filter per value: the rows with both values (`in` is implicit).
            expect(
                lastVisit().url.searchParams.getAll('filter[status][]'),
            ).toEqual(['active', 'draft']);
        });

        it('takes the locale and the texts of the server, under the ones of the page', () => {
            mount({ messages: { reset: 'Limpiar' } });

            expect(table().options.meta).toMatchObject({
                locale: 'es-CL',
                dateFormat: 'long',
                searchable: true,
                pageSizeOptions: [10, 25],
                failed: false,
            });
            expect(table().options.meta?.messages).toMatchObject({
                search: 'Buscar...',
                reset: 'Limpiar',
                clear: 'Clear',
            });
        });

        it("takes the browser locale with 'browser'", () => {
            mount({ locale: 'browser' });

            expect(table().options.meta?.locale).toBeUndefined();
        });
    });
}
