import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    createLoadingPhases,
    getSkeletonShape,
    keepTypedSpaces,
} from './data-table-loading';
import type {
    ServerColumnConfig,
    ServerTableConfig,
} from '@/lib/data-table-server';

describe('createLoadingPhases', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    function setup(skeletonDelay: number | false = 600) {
        vi.useFakeTimers();
        const phases: string[] = [];
        const active: boolean[] = [];
        const loading = createLoadingPhases({
            loadingDelay: 150,
            skeletonDelay,
            onChange: (phase) => phases.push(phase),
            onActiveChange: (value) => active.push(value),
        });

        return { loading, phases, active };
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
        vi.advanceTimersByTime(0);
        expect(phases).toEqual(['busy', 'slow', 'idle']);
    });

    it('never shows the skeleton when it is disabled', () => {
        const { loading, phases } = setup(false);

        loading.start();
        vi.advanceTimersByTime(5000);
        loading.finish();
        vi.advanceTimersByTime(0);

        expect(phases).toEqual(['busy', 'idle']);
    });

    it('keeps the state when a visit replaces another one', () => {
        const { loading, phases, active } = setup();

        loading.start();
        vi.advanceTimersByTime(300);
        // The cancelled visit finishes right before the new one starts.
        loading.finish();
        loading.start();
        vi.advanceTimersByTime(300);
        expect(phases).toEqual(['busy', 'slow']);
        // Or right after it.
        loading.start();
        loading.finish();
        vi.advanceTimersByTime(300);
        expect(phases).toEqual(['busy', 'slow']);
        expect(active).toEqual([true]);

        loading.finish();
        vi.advanceTimersByTime(0);
        expect(phases).toEqual(['busy', 'slow', 'idle']);
        expect(active).toEqual([true, false]);
    });

    it('stops the timers on dispose', () => {
        const { loading, phases } = setup();

        loading.start();
        vi.advanceTimersByTime(100);
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
            column('price', { display: { type: 'number' }, hideable: false }),
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
                { id: 'name', label: 'NAME', align: 'start', badge: false },
                { id: 'price', label: 'PRICE', align: 'end', badge: false },
            ],
            rowCount: 25,
            filters: [
                { kind: 'text', label: 'NAME' },
                { kind: 'button', label: 'CREATED_AT' },
            ],
            filterCount: 2,
            searchable: true,
            label: undefined,
        });
    });

    it('takes the page size and the visible columns of the URL', () => {
        const shape = getSkeletonShape(
            config(),
            '?per_page=10&columns=sku,nope&page=3',
        );

        // `price` is not hideable: always shown, like on the server.
        expect(shape.columns.map((column) => column.id)).toEqual([
            'sku',
            'price',
        ]);
        expect(shape.rowCount).toBe(10);
    });

    it('ignores a page size out of the list and the keys of another table', () => {
        expect(getSkeletonShape(config(), '?per_page=7').rowCount).toBe(25);
        expect(
            getSkeletonShape(
                config(),
                '?users_per_page=10&users_columns=sku',
            ).columns.map((column) => column.id),
        ).toEqual(['name', 'price']);
    });

    it('reads the columns of the URL like the server', () => {
        const ids = (search: string) =>
            getSkeletonShape(config(), search).columns.map(({ id }) => id);

        // An empty list is no list: the default columns.
        expect(ids('?columns=')).toEqual(['name', 'price']);
        expect(ids('?columns=%20')).toEqual(['name', 'price']);
        expect(ids('?columns=name,%20sku')).toEqual(['name', 'sku', 'price']);
    });

    it('takes the loading text of the server', () => {
        const shape = getSkeletonShape(
            config({ searchable: false, messages: { loading: 'Cargando…' } }),
        );

        expect(shape.searchable).toBe(false);
        expect(shape.label).toBe('Cargando…');
    });
});

describe('keepTypedSpaces', () => {
    const state = (globalFilter: string, name?: unknown) => ({
        page: 1,
        globalFilter,
        columnFilters: name === undefined ? [] : [{ id: 'name', value: name }],
    });

    it('keeps the space typed after a word the server trimmed', () => {
        expect(
            keepTypedSpaces(state('ana', 'luz'), state('ana ', ' luz ')),
        ).toEqual(state('ana ', ' luz '));
    });

    it('takes the server value when it is another text', () => {
        expect(
            keepTypedSpaces(state('ana', 'luz'), state('an', 'lu ')),
        ).toEqual(state('ana', 'luz'));
        // Cut by the server, a filter it dropped, or a value that is not text.
        expect(keepTypedSpaces(state('a'), state('a b', ' '))).toEqual(
            state('a'),
        );
        expect(
            keepTypedSpaces(state('', ['1', '2']), state('', ['1', '2'])),
        ).toEqual(state('', ['1', '2']));
    });
});
