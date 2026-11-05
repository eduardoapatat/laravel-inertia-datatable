import { describe, expect, it } from 'vite-plus/test';
import {
    arrangeColumns,
    buildTableUrl,
    serializeFilter,
    serializeSorting,
    stateToQuery,
} from './data-table-server';
import type {
    ServerFilter,
    ServerTableConfig,
    TableQueryState,
} from './data-table-server';

const config: ServerTableConfig = {
    columns: [
        {
            id: 'name',
            label: 'Nombre',
            sortable: true,
            hideable: false,
            visible: true,
            display: { type: 'text' },
            filter: { variant: 'text' },
        },
        {
            id: 'price',
            label: 'Precio',
            sortable: true,
            hideable: true,
            visible: true,
            display: { type: 'number', unit: '$' },
            filter: { variant: 'range' },
        },
        {
            id: 'sku',
            label: 'SKU',
            sortable: false,
            hideable: true,
            visible: false,
            display: { type: 'text' },
            filter: { variant: 'text' },
        },
    ],
    searchable: true,
    per_page: 10,
    per_page_options: [10, 20],
    default_sorting: [],
    query: {
        page: 'page',
        per_page: 'per_page',
        sort: 'sort',
        filter: 'filter',
        search: 'search',
        columns: 'columns',
    },
};

const defaultState: TableQueryState = {
    pageIndex: 0,
    pageSize: 10,
    sorting: [],
    filters: [],
    globalFilter: '',
    columnVisibility: {},
};

describe('serializeSorting', () => {
    it('writes descending columns with a leading minus', () => {
        expect(
            serializeSorting([
                { id: 'created_at', desc: true },
                { id: 'name', desc: false },
            ]),
        ).toBe('-created_at,name');
    });
});

describe('serializeFilter', () => {
    it.each<[string, ServerFilter, string | null]>([
        [
            'omits the implicit operator of a list',
            {
                id: 'status',
                variant: 'multi-select',
                operator: 'inArray',
                value: ['active', 'draft'],
            },
            'active,draft',
        ],
        [
            'quotes values with commas and doubles inner quotes',
            {
                id: 'name',
                variant: 'multi-select',
                operator: 'inArray',
                value: ['Pérez, Ana', 'say "hi"'],
            },
            '"Pérez, Ana","say ""hi"""',
        ],
        [
            'writes an explicit operator',
            {
                id: 'status',
                variant: 'multi-select',
                operator: 'notInArray',
                value: ['archived'],
            },
            'not.in.archived',
        ],
        [
            'writes only the name of a valueless operator',
            { id: 'sku', variant: 'text', operator: 'isEmpty', value: '' },
            'is.empty',
        ],
        [
            'keeps an open bound of a range',
            {
                id: 'price',
                variant: 'range',
                operator: 'isBetween',
                value: ['', '100'],
            },
            ',100',
        ],
        [
            'prefixes the operator when the value looks like one',
            { id: 'name', variant: 'text', operator: 'iLike', value: 'eq.x' },
            'ilike.eq.x',
        ],
        [
            'writes a comparison with its operator',
            { id: 'stock', variant: 'number', operator: 'gte', value: '10' },
            'gte.10',
        ],
        [
            'returns null for a blank value',
            { id: 'name', variant: 'text', operator: 'iLike', value: '  ' },
            null,
        ],
        [
            'returns null for a list without values',
            {
                id: 'status',
                variant: 'multi-select',
                operator: 'inArray',
                value: ['', ''],
            },
            null,
        ],
        [
            'returns null for a range without bounds',
            {
                id: 'price',
                variant: 'range',
                operator: 'isBetween',
                value: ['', ''],
            },
            null,
        ],
    ])('%s', (_, filter, expected) => {
        expect(serializeFilter(filter)).toBe(expected);
    });
});

describe('stateToQuery', () => {
    it('returns no parameters for the default state', () => {
        expect(stateToQuery(defaultState, config)).toEqual([]);
    });

    it('writes every part of a changed state', () => {
        const pairs = stateToQuery(
            {
                pageIndex: 2,
                pageSize: 20,
                sorting: [{ id: 'price', desc: true }],
                filters: [
                    {
                        id: 'name',
                        variant: 'text',
                        operator: 'iLike',
                        value: 'mesa',
                    },
                ],
                globalFilter: ' ana ',
                columnVisibility: { price: false, sku: true },
            },
            config,
        );

        expect(pairs).toEqual([
            ['page', '3'],
            ['per_page', '20'],
            ['sort', '-price'],
            ['filter[name]', 'mesa'],
            ['search', 'ana'],
            ['columns', 'name,sku'],
        ]);
    });

    it('uses the array form when a column has several filters', () => {
        const pairs = stateToQuery(
            {
                ...defaultState,
                filters: [
                    {
                        id: 'price',
                        variant: 'range',
                        operator: 'gte',
                        value: '10',
                    },
                    {
                        id: 'price',
                        variant: 'range',
                        operator: 'lte',
                        value: '50',
                    },
                ],
            },
            config,
        );

        expect(pairs).toEqual([
            ['filter[price][]', 'gte.10'],
            ['filter[price][]', 'lte.50'],
        ]);
    });

    it('keeps non hideable columns visible', () => {
        const pairs = stateToQuery(
            {
                ...defaultState,
                columnVisibility: { name: false, price: false },
            },
            config,
        );

        expect(pairs).toEqual([['columns', 'name']]);
    });

    it('uses the prefixed parameter names of the table', () => {
        const pairs = stateToQuery(
            {
                ...defaultState,
                pageIndex: 1,
                filters: [
                    {
                        id: 'name',
                        variant: 'text',
                        operator: 'iLike',
                        value: 'a',
                    },
                ],
            },
            {
                ...config,
                query: {
                    ...config.query,
                    page: 'users_page',
                    filter: 'users_filter',
                },
            },
        );

        expect(pairs).toEqual([
            ['users_page', '2'],
            ['users_filter[name]', 'a'],
        ]);
    });
});

describe('buildTableUrl', () => {
    it('replaces the table parameters and keeps the others readable', () => {
        const url = buildTableUrl(
            'https://app.test/products?tab=all&page=4&filter%5Bstatus%5D=draft&filter[price][]=gte.1#list',
            [
                ['filter[status]', 'active,draft'],
                ['search', 'mesa grande'],
            ],
            config.query,
        );

        expect(url).toBe(
            '/products?tab=all&filter[status]=active,draft&search=mesa%20grande#list',
        );
    });

    it('drops the query string when nothing remains', () => {
        expect(
            buildTableUrl('https://app.test/products?page=2', [], config.query),
        ).toBe('/products');
    });
});

describe('arrangeColumns', () => {
    type Column = { id?: string; start?: boolean; custom?: boolean };

    const options = {
        getId: (column: Column) => column.id,
        isLeading: (column: Column) => column.start === true,
        resolve: (id: string, column: Column | undefined) => column ?? { id },
    };

    it('follows the order of the server and creates the missing columns', () => {
        const client: Column[] = [{ id: 'email', custom: true }];

        expect(
            arrangeColumns(client, ['name', 'email', 'role'], options),
        ).toEqual([
            { id: 'name' },
            { id: 'email', custom: true },
            { id: 'role' },
        ]);
    });

    it('places the client only columns at the end unless they are leading', () => {
        const client: Column[] = [
            { id: 'actions' },
            { id: 'select', start: true },
            { id: 'name', custom: true },
        ];

        expect(arrangeColumns(client, ['email', 'name'], options)).toEqual([
            { id: 'select', start: true },
            { id: 'email' },
            { id: 'name', custom: true },
            { id: 'actions' },
        ]);
    });

    it('keeps the columns without id', () => {
        expect(arrangeColumns([{}], ['name'], options)).toEqual([
            { id: 'name' },
            {},
        ]);
    });
});
