import { describe, expect, it } from 'vitest';

import {
    getBooleanFilterOptions,
    getColumnAlign,
    getColumnClassName,
    getFacetedFilterOptions,
    getFilterColumnIssue,
    getFilterComponentName,
} from './data-table-utils';

describe('getColumnClassName', () => {
    it('gives the width class and the classes of the column', () => {
        expect(getColumnClassName(undefined, 'cell')).toEqual([
            'w-(--cell-size)',
            'text-start',
        ]);
        expect(
            getColumnClassName(
                {
                    className: 'w-40 md:w-80',
                    headerClassName: 'text-xs',
                    cellClassName: 'font-mono',
                },
                'header',
            ),
        ).toEqual(['w-(--cell-size)', 'text-start', 'w-40 md:w-80', 'text-xs']);
        expect(
            getColumnClassName({ cellClassName: 'font-mono' }, 'cell'),
        ).toEqual(['w-(--cell-size)', 'text-start', 'font-mono']);
    });

    it('calls cellClassName with the cell when it is a function', () => {
        const meta = {
            cellClassName: (cell: { getValue: () => unknown }) =>
                Number(cell.getValue()) < 100 && 'text-red-600',
        };
        const cell = (value: number) =>
            ({ getValue: () => value }) as unknown as Parameters<
                typeof getColumnClassName
            >[2];

        expect(getColumnClassName(meta, 'cell', cell(50))).toEqual([
            'w-(--cell-size)',
            'text-start',
            'text-red-600',
        ]);
        expect(getColumnClassName(meta, 'cell', cell(500))).toEqual([
            'w-(--cell-size)',
            'text-start',
        ]);
        expect(getColumnClassName(meta, 'header')).toEqual([
            'w-(--cell-size)',
            'text-start',
        ]);
    });
});

describe('getColumnAlign', () => {
    it('aligns numbers to the end and the rest to the start', () => {
        expect(getColumnAlign({ variant: 'number' })).toBe('end');
        expect(
            getColumnAlign({ display: { type: 'number', format: {} } }),
        ).toBe('end');
        expect(getColumnAlign({ variant: 'text' })).toBe('start');
        expect(getColumnAlign(undefined)).toBe('start');
        expect(getColumnAlign({ variant: 'number', align: 'center' })).toBe(
            'center',
        );
        expect(getColumnClassName({ variant: 'number' }, 'cell')).toEqual([
            'w-(--cell-size)',
            'pe-8 text-end',
        ]);
    });
});

describe('getFilterColumnIssue', () => {
    const column = (meta: object | undefined, canFilter = true) => ({
        getCanFilter: () => canFilter,
        columnDef: { meta },
    });

    it('accepts the variants the component edits', () => {
        const status = column({ variant: 'multi-select', options: [] });

        expect(
            getFilterColumnIssue('DataTableFacetedFilter', 'status', status),
        ).toBeUndefined();
        expect(
            getFilterColumnIssue(
                'DataTableSliderFilter',
                'price',
                column({ variant: 'number', filter: 'range' }),
            ),
        ).toBeUndefined();
        expect(
            getFilterColumnIssue(
                'DataTableDateFilter',
                'published_at',
                column({ variant: 'date', filter: 'range' }),
            ),
        ).toBeUndefined();
        expect(
            getFilterColumnIssue(
                'DataTableFacetedFilter',
                'featured',
                column({ variant: 'boolean' }),
            ),
        ).toBeUndefined();
    });

    it('names the component that fits a variant it does not edit', () => {
        expect(
            getFilterColumnIssue(
                'DataTableSliderFilter',
                'status',
                column({ variant: 'multi-select', options: [] }),
            ),
        ).toBe(
            'DataTableSliderFilter: column "status" filters as "multi-select" on the server; use DataTableFacetedFilter.',
        );
        expect(
            getFilterColumnIssue(
                'DataTableNumberFilter',
                'price',
                column({ variant: 'number', filter: 'range' }),
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
                column({ variant: 'text' }, false),
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
