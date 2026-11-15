import { vi } from 'vite-plus/test';

import type {
    ServerColumnConfig,
    ServerDataTable,
    ServerTableState,
} from '@/lib/data-table-server';

/**
 * A response of the package for the tests of `useServerDataTable`: the
 * products table, with a text, a number and an option column, and a hidden
 * date column with presets relative to today.
 */
export interface Product {
    id: number;
    name: string;
    price: number;
    status: string;
    released_on?: string;
}

const column = (
    id: string,
    overrides: Partial<ServerColumnConfig> = {},
): ServerColumnConfig => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    sortable: true,
    hideable: true,
    visible: true,
    display: { type: 'text' },
    filter: null,
    ...overrides,
});

export function serverState(
    overrides: Partial<ServerTableState> = {},
): ServerTableState {
    return {
        pagination: { pageIndex: 0, pageSize: 10 },
        sorting: [],
        columnFilters: [],
        join: 'and',
        globalFilter: '',
        columnVisibility: {
            name: true,
            price: true,
            status: true,
            released_on: false,
        },
        ...overrides,
    };
}

/** The response, with a new `state` object each time, as Inertia sends it. */
export function serverTable(
    state: Partial<ServerTableState> = {},
    overrides: Partial<ServerDataTable<Product>> = {},
): ServerDataTable<Product> {
    return {
        data: [
            { id: 1, name: 'Ana', price: 10, status: 'active' },
            { id: 2, name: 'Bea', price: 20, status: 'draft' },
        ],
        meta: {
            current_page: 1,
            per_page: 10,
            last_page: 3,
            total: 25,
            from: 1,
            to: 10,
        },
        state: serverState(state),
        facets: {
            status: [
                { value: 'active', label: 'Active', count: 12 },
                { value: 'draft', label: 'Draft', count: 13 },
            ],
            price: { min: 10, max: 90 },
        },
        config: {
            columns: [
                column('name', { filter: { variant: 'text' } }),
                column('price', {
                    display: { type: 'number' },
                    filter: { variant: 'range' },
                }),
                column('status', {
                    display: { type: 'option' },
                    filter: { variant: 'select' },
                }),
                column('released_on', {
                    visible: false,
                    display: { type: 'date' },
                    filter: { variant: 'date-range', presets: true },
                }),
            ],
            searchable: true,
            locale: 'es-CL',
            date_format: 'long',
            messages: { search: 'Buscar...' },
            per_page: 10,
            per_page_options: [10, 25],
            default_sorting: [],
            max_sorts: 3,
            max_filters: 20,
            query: {
                page: 'page',
                per_page: 'per_page',
                sort: 'sort',
                filter: 'filter',
                search: 'search',
                columns: 'columns',
                join: 'join',
            },
        },
        ...overrides,
    };
}

/** The options a hook passes to `router.get` of Inertia. */
export interface VisitOptions {
    only: string[];
    preserveState: boolean;
    preserveScroll: boolean;
    replace: boolean;
    onStart: () => void;
    onSuccess: () => void;
    onNetworkError: (error: unknown) => unknown;
    onFinish: () => void;
}

export interface Visit {
    url: URL;
    options: VisitOptions;
}

/** The `router` of `@inertiajs/react` and `@inertiajs/vue3`, mocked. */
export const router = {
    get: vi.fn((_url: string, _data: object, _options: VisitOptions) => {}),
};

/** Every visit since the last `vi.clearAllMocks()`, oldest first. */
export function visits(): Visit[] {
    return router.get.mock.calls.map(([url, , options]) => ({
        // The hooks visit a path with its query, relative to the page.
        url: new URL(url, 'http://localhost'),
        options,
    }));
}

export function lastVisit(): Visit {
    const visit = visits().at(-1);

    if (!visit) {
        throw new Error('No visit was made.');
    }

    return visit;
}
