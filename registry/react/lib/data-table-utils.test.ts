import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    createLoadingPhases,
    getBooleanFilterOptions,
    getColumnAlign,
    getColumnClassName,
    getFacetedFilterOptions,
    getFilterColumnIssue,
    getFilterComponentName,
    getSkeletonShape,
    pickDateRangeDay,
} from './data-table-utils';
import type {
    ServerColumnConfig,
    ServerTableConfig,
} from '@/lib/data-table-server';

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

describe('pickDateRangeDay', () => {
    const day = (date: number) => new Date(2026, 10, date);

    it('only marks the start with the first click', () => {
        expect(pickDateRangeDay(undefined, day(5))).toEqual({ start: day(5) });
    });

    it('gives the range in order with the second click', () => {
        expect(pickDateRangeDay(day(5), day(20))).toEqual({
            range: [day(5), day(20)],
        });
        expect(pickDateRangeDay(day(20), day(5))).toEqual({
            range: [day(5), day(20)],
        });
        expect(pickDateRangeDay(day(5), day(5))).toEqual({
            range: [day(5), day(5)],
        });
    });
});

describe('createLoadingPhases', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    function setup(skeletonDelay: number | false = 600) {
        vi.useFakeTimers();
        const phases: string[] = [];
        const loading = createLoadingPhases({
            loadingDelay: 150,
            skeletonDelay,
            onChange: (phase) => phases.push(phase),
        });

        return { loading, phases };
    }

    it('shows nothing when the response is fast', () => {
        const { loading, phases } = setup();

        loading.start();
        vi.advanceTimersByTime(100);
        loading.finish();
        vi.advanceTimersByTime(1000);

        expect(phases).toEqual([]);
    });

    it('dims after the loading delay and shows the skeleton after the skeleton delay', () => {
        const { loading, phases } = setup();

        loading.start();
        vi.advanceTimersByTime(150);
        expect(phases).toEqual(['busy']);
        vi.advanceTimersByTime(450);
        expect(phases).toEqual(['busy', 'slow']);
        loading.finish();
        expect(phases).toEqual(['busy', 'slow', 'idle']);
    });

    it('never shows the skeleton when it is disabled', () => {
        const { loading, phases } = setup(false);

        loading.start();
        vi.advanceTimersByTime(5000);
        loading.finish();

        expect(phases).toEqual(['busy', 'idle']);
    });

    it('restarts the timers with a new visit and stops them on dispose', () => {
        const { loading, phases } = setup();

        loading.start();
        vi.advanceTimersByTime(100);
        loading.start();
        vi.advanceTimersByTime(100);
        expect(phases).toEqual([]);
        loading.dispose();
        vi.advanceTimersByTime(5000);
        expect(phases).toEqual([]);
    });
});

describe('getSkeletonShape', () => {
    const column = (
        id: string,
        overrides: Partial<ServerColumnConfig> = {},
    ): ServerColumnConfig => ({
        id,
        label: id.toUpperCase(),
        sortable: false,
        hideable: true,
        visible: true,
        display: { type: 'text' },
        filter: null,
        ...overrides,
    });
    const config = (
        overrides: Partial<ServerTableConfig> = {},
    ): ServerTableConfig => ({
        columns: [
            column('name', { filter: { variant: 'text' } }),
            column('sku', { visible: false }),
            column('created_at', {
                visible: false,
                filter: { variant: 'date' },
            }),
            column('price'),
        ],
        searchable: true,
        per_page: 25,
        per_page_options: [10, 25],
        default_sorting: [],
        query: {
            page: 'page',
            per_page: 'per_page',
            sort: 'sort',
            filter: 'filter',
            search: 'search',
            columns: 'columns',
        },
        ...overrides,
    });

    it('takes the visible columns, the page size and the filters', () => {
        expect(getSkeletonShape(config())).toEqual({
            columns: [
                { id: 'name', label: 'NAME' },
                { id: 'price', label: 'PRICE' },
            ],
            rowCount: 25,
            filterCount: 2,
            searchable: true,
            label: undefined,
        });
    });

    it('takes the loading text of the server', () => {
        const shape = getSkeletonShape(
            config({ searchable: false, messages: { loading: 'Cargando…' } }),
        );

        expect(shape.searchable).toBe(false);
        expect(shape.label).toBe('Cargando…');
    });
});
