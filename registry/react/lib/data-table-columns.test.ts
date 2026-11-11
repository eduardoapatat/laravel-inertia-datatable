import { describe, expect, it } from 'vitest';

import {
    type DataTableColumn,
    getDefaultRowId,
    type LocalTableState,
    resolveLocale,
    toQueryState,
    withColumnMeta,
} from './data-table-columns';
import type {
    ServerColumnConfig,
    ServerTableConfig,
} from '@/lib/data-table-server';
import type { DataTableColumnMeta } from '@/lib/data-table-types';

type Row = Record<string, unknown>;

const server = (
    id: string,
    overrides: Partial<ServerColumnConfig> = {},
): ServerColumnConfig => ({
    id,
    label: id.toUpperCase(),
    sortable: true,
    hideable: true,
    visible: true,
    display: { type: 'text' },
    filter: null,
    ...overrides,
});

const metaOf = (column: DataTableColumn<Row>) =>
    column.meta as DataTableColumnMeta;

const Icon = () => null;

describe('withColumnMeta', () => {
    it('fills the column with what the server declares', () => {
        const column = withColumnMeta<Row>(
            { id: 'name' },
            server('name', {
                sortable: false,
                filter: { variant: 'text', placeholder: 'Search…' },
            }),
            undefined,
        );

        expect(metaOf(column)).toMatchObject({
            label: 'NAME',
            placeholder: 'Search…',
            filterVariant: 'text',
            display: { type: 'text' },
        });
        expect(column.enableSorting).toBe(false);
        expect(column.enableColumnFilter).toBe(true);
        expect(column.enableHiding).toBe(true);
    });

    it('lets the page meta and capabilities win', () => {
        const column = withColumnMeta<Row>(
            {
                id: 'name',
                enableSorting: true,
                meta: { label: 'Full name', align: 'center' },
            },
            server('name', { sortable: false }),
            undefined,
        );

        expect(metaOf(column)).toMatchObject({
            label: 'Full name',
            align: 'center',
        });
        expect(column.enableSorting).toBe(true);
        expect(column.enableColumnFilter).toBe(false);
    });

    it('keeps the server counts on the options the page redeclares', () => {
        const column = withColumnMeta<Row>(
            {
                id: 'status',
                meta: {
                    options: [{ value: 'active', label: 'On' }],
                    icons: { draft: Icon },
                },
            },
            server('status', {
                display: { type: 'option' },
                filter: { variant: 'select', empty: true },
            }),
            [
                { value: 'active', label: 'Active', count: 3 },
                { value: 'draft', label: 'Draft', count: 2 },
                { value: null, label: 'None', count: 1 },
            ],
        );

        expect(metaOf(column)).toMatchObject({
            filterVariant: 'select',
            empty: true,
            emptyCount: 1,
            options: [
                { value: 'active', label: 'On', count: 3 },
                { value: 'draft', label: 'Draft', count: 2, icon: Icon },
            ],
        });
    });

    it('takes the range bounds from the facet', () => {
        const column = withColumnMeta<Row>(
            { id: 'price' },
            server('price', {
                display: { type: 'number', unit: 'kg' },
                filter: { variant: 'range' },
            }),
            { min: 1, max: null },
        );

        expect(metaOf(column)).toMatchObject({
            filterVariant: 'range',
            min: 1,
            max: undefined,
        });
    });

    it('merges a page display of the same type key by key', () => {
        const column = withColumnMeta<Row>(
            {
                id: 'price',
                meta: {
                    display: {
                        type: 'number',
                        format: { maximumFractionDigits: 0 },
                    },
                },
            },
            server('price', {
                display: {
                    type: 'number',
                    format: { style: 'currency', currency: 'CLP' },
                },
            }),
            undefined,
        );

        expect(metaOf(column).display).toEqual({
            type: 'number',
            format: {
                style: 'currency',
                currency: 'CLP',
                maximumFractionDigits: 0,
            },
        });
    });

    it('replaces a page display of another type', () => {
        const column = withColumnMeta<Row>(
            { id: 'code', meta: { display: { type: 'text' } } },
            server('code', { display: { type: 'number' } }),
            undefined,
        );

        expect(metaOf(column).display).toEqual({ type: 'text' });
    });
});

describe('toQueryState', () => {
    const config = {
        columns: [
            server('name', { filter: { variant: 'text' } }),
            server('price', { filter: { variant: 'range' } }),
            server('sku'),
        ],
    } as ServerTableConfig;
    const state = (
        columnFilters: LocalTableState['columnFilters'],
    ): LocalTableState => ({
        pagination: { pageIndex: 1, pageSize: 25 },
        sorting: [{ id: 'name', desc: true }],
        columnFilters,
        globalFilter: 'x',
        columnVisibility: { sku: false },
    });

    it('sends the filters with the variant the server declares', () => {
        expect(
            toQueryState(
                state([
                    { id: 'name', value: 'ana' },
                    { id: 'price', value: [50, 10] },
                ]),
                config,
            ),
        ).toEqual({
            pageIndex: 1,
            pageSize: 25,
            sorting: [{ id: 'name', desc: true }],
            filters: [
                {
                    id: 'name',
                    variant: 'text',
                    operator: 'iLike',
                    value: 'ana',
                },
                {
                    id: 'price',
                    variant: 'range',
                    operator: 'isBetween',
                    value: ['10', '50'],
                },
            ],
            globalFilter: 'x',
            columnVisibility: { sku: false },
        });
    });

    it('leaves out the columns the server can not filter', () => {
        expect(
            toQueryState(
                state([
                    { id: 'sku', value: 'a' },
                    { id: 'missing', value: 'b' },
                ]),
                config,
            ).filters,
        ).toEqual([]);
    });
});

describe('resolveLocale', () => {
    it('uses the browser locale for browser or nothing', () => {
        expect(resolveLocale('browser')).toBeUndefined();
        expect(resolveLocale(null)).toBeUndefined();
        expect(resolveLocale('es_CL')).toBe('es-CL');
    });
});

describe('getDefaultRowId', () => {
    it('uses the id of the row, else its index', () => {
        expect(getDefaultRowId({ id: 7 }, 0)).toBe('7');
        expect(getDefaultRowId({ id: null }, 3)).toBe('3');
        expect(getDefaultRowId('text', 2)).toBe('2');
    });
});
