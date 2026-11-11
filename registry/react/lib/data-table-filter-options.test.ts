import { describe, expect, it } from 'vitest';

import {
    getBooleanFilterOptions,
    getFacetedFilterOptions,
    getFilterColumnIssue,
    getFilterComponentName,
} from './data-table-filter-options';

describe('getFilterColumnIssue', () => {
    const column = (meta: object | undefined, canFilter = true) => ({
        getCanFilter: () => canFilter,
        columnDef: { meta },
    });

    it('accepts the variants the component edits', () => {
        const status = column({ filterVariant: 'multi-select' });

        expect(
            getFilterColumnIssue('DataTableFacetedFilter', 'status', status),
        ).toBeUndefined();
        expect(
            getFilterColumnIssue(
                'DataTableSliderFilter',
                'price',
                column({ filterVariant: 'range' }),
            ),
        ).toBeUndefined();
        expect(
            getFilterColumnIssue(
                'DataTableDateFilter',
                'published_at',
                column({ filterVariant: 'date-range' }),
            ),
        ).toBeUndefined();
        expect(
            getFilterColumnIssue(
                'DataTableFacetedFilter',
                'featured',
                column({ filterVariant: 'boolean' }),
            ),
        ).toBeUndefined();
    });

    it('names the component that fits a variant it does not edit', () => {
        expect(
            getFilterColumnIssue(
                'DataTableSliderFilter',
                'status',
                column({ filterVariant: 'multi-select' }),
            ),
        ).toBe(
            'DataTableSliderFilter: column "status" filters as "multi-select" on the server; use DataTableFacetedFilter.',
        );
        expect(
            getFilterColumnIssue(
                'DataTableNumberFilter',
                'price',
                column({ filterVariant: 'range' }),
            ),
        ).toContain('use DataTableSliderFilter');
    });

    it('rejects missing columns and columns without a filter', () => {
        expect(
            getFilterColumnIssue('DataTableTextFilter', 'nope', undefined),
        ).toContain('has no column "nope"');
        expect(
            getFilterColumnIssue(
                'DataTableTextFilter',
                'sku',
                column({ filterVariant: 'text' }, false),
            ),
        ).toContain('column "sku" has no filter');
        expect(
            getFilterColumnIssue('DataTableTextFilter', 'sku', column({})),
        ).toContain('has no filter');
    });
});

describe('getFilterComponentName', () => {
    it('gives the component the toolbar renders for each variant', () => {
        expect(getFilterComponentName('text')).toBe('DataTableTextFilter');
        expect(getFilterComponentName('range')).toBe('DataTableSliderFilter');
        expect(getFilterComponentName('date-range')).toBe(
            'DataTableDateFilter',
        );
        expect(getFilterComponentName('select')).toBe('DataTableFacetedFilter');
        expect(getFilterComponentName('boolean')).toBe(
            'DataTableBooleanFilter',
        );
    });
});

describe('getBooleanFilterOptions', () => {
    const texts = { yes: 'Yes', no: 'No' };

    it('uses the labels of the prop, of PHP or the table texts', () => {
        expect(
            getBooleanFilterOptions(undefined, texts).map((o) => o.label),
        ).toEqual(['Yes', 'No']);
        expect(
            getBooleanFilterOptions(
                {
                    display: {
                        type: 'boolean',
                        labels: { true: 'Sí', false: 'No' },
                    },
                },
                texts,
            ).map((o) => o.label),
        ).toEqual(['Sí', 'No']);
        expect(
            getBooleanFilterOptions(undefined, texts, {
                true: 'On',
                false: 'Off',
            }).map((o) => [o.value, o.label]),
        ).toEqual([
            ['true', 'On'],
            ['false', 'Off'],
        ]);
    });
});

describe('getFacetedFilterOptions', () => {
    const server = [
        { value: 'draft', label: 'Draft', count: 3 },
        { value: 'active', label: 'Active', count: 5 },
        { value: 'archived', label: 'Archived', count: 1 },
    ];

    it('keeps the server options without a custom list', () => {
        expect(getFacetedFilterOptions(server)).toBe(server);
    });

    it('relabels, reorders and leaves out options but never adds values', () => {
        expect(
            getFacetedFilterOptions(server, [
                { value: 'active', label: 'Activo' },
                { value: 'draft', label: 'Borrador' },
                { value: 'hacked', label: 'Hacked' },
            ]),
        ).toEqual([
            { value: 'active', label: 'Activo', count: 5 },
            { value: 'draft', label: 'Borrador', count: 3 },
        ]);
    });
});
