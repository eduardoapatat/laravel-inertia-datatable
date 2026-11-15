import { describe, expect, it } from 'vite-plus/test';

import {
    changeFilterOperator,
    createFilterListItem,
    type FilterListRow,
    getFilterListItems,
    getFilterOperatorMessageKey,
    getIsFilterComplete,
    getRowFilters,
    getRowJoinCells,
    groupEmptyRows,
    moveItem,
    reconcileFilterRows,
} from '@/lib/data-table-advanced';
import type { ColumnFilterItem } from '@/lib/data-table-types';

const filter = (
    overrides: Partial<ColumnFilterItem> & Pick<ColumnFilterItem, 'id'>,
): ColumnFilterItem => ({
    variant: 'text',
    operator: 'iLike',
    value: '',
    filterId: `${overrides.id}-0`,
    ...overrides,
});

const keys = () => {
    let next = 0;

    return () => `new-${++next}`;
};

describe('createFilterListItem', () => {
    it('starts with the implicit operator and an empty value of its shape', () => {
        expect(createFilterListItem('name', 'text', 'k')).toEqual({
            id: 'name',
            variant: 'text',
            operator: 'iLike',
            value: '',
            filterId: 'k',
        });
        expect(createFilterListItem('price', 'range', 'k').value).toEqual([
            '',
            '',
        ]);
        expect(createFilterListItem('status', 'select', 'k').value).toEqual([]);
    });
});

describe('changeFilterOperator', () => {
    it('empties the value when the row enters or leaves rel', () => {
        const day = filter({
            id: 'published_at',
            variant: 'date',
            operator: 'eq',
            value: '2026-11-15',
        });
        const relative = changeFilterOperator(day, 'isRelativeToToday');

        expect(relative).toMatchObject({
            operator: 'isRelativeToToday',
            value: '',
        });
        expect(
            changeFilterOperator(
                {
                    ...relative,
                    value: '-7d',
                    range: ['2026-11-09', '2026-11-15'],
                },
                'isBetween',
            ),
        ).toEqual({ ...day, operator: 'isBetween', value: ['', ''] });
        expect(
            changeFilterOperator(
                { ...relative, value: '-7d' },
                'isRelativeToToday',
            ).value,
        ).toBe('-7d');
    });

    it('keeps what fits of the value', () => {
        const single = filter({
            id: 'price',
            variant: 'number',
            operator: 'eq',
            value: '10',
        });

        expect(changeFilterOperator(single, 'isBetween').value).toEqual([
            '10',
            '',
        ]);
        expect(changeFilterOperator(single, 'isEmpty').value).toBe('');

        const range = filter({
            id: 'price',
            variant: 'range',
            operator: 'isBetween',
            value: ['', '50'],
        });

        expect(changeFilterOperator(range, 'lte').value).toBe('50');

        const list = filter({
            id: 'status',
            variant: 'select',
            operator: 'inArray',
            value: ['a', 'b'],
        });

        expect(changeFilterOperator(list, 'eq').value).toBe('a');
        expect(
            changeFilterOperator(
                filter({
                    id: 'status',
                    variant: 'select',
                    operator: 'eq',
                    value: 'a',
                }),
                'inArray',
            ).value,
        ).toEqual(['a']);
    });
});

describe('getIsFilterComplete', () => {
    it('needs a value except for the empty operators', () => {
        expect(getIsFilterComplete(filter({ id: 'name' }))).toBe(false);
        expect(getIsFilterComplete(filter({ id: 'name', value: ' ' }))).toBe(
            false,
        );
        expect(getIsFilterComplete(filter({ id: 'name', value: 'a' }))).toBe(
            true,
        );
        expect(
            getIsFilterComplete(filter({ id: 'name', operator: 'isEmpty' })),
        ).toBe(true);
        expect(
            getIsFilterComplete(
                filter({
                    id: 'price',
                    variant: 'range',
                    operator: 'isBetween',
                    value: ['', '5'],
                }),
            ),
        ).toBe(true);
        expect(
            getIsFilterComplete(
                filter({
                    id: 'status',
                    variant: 'select',
                    operator: 'inArray',
                    value: [],
                }),
            ),
        ).toBe(false);
    });
});

describe('getFilterOperatorMessageKey', () => {
    it('names the comparisons of dates as before and after', () => {
        expect(getFilterOperatorMessageKey('number', 'lt')).toBe('operator_lt');
        expect(getFilterOperatorMessageKey('date', 'lt')).toBe(
            'operator_before',
        );
        expect(getFilterOperatorMessageKey('date-range', 'gte')).toBe(
            'operator_on_or_after',
        );
        expect(getFilterOperatorMessageKey('date', 'eq')).toBe('operator_eq');
    });
});

describe('getFilterListItems', () => {
    it('keeps the filters of the columns the server filters, normalized', () => {
        const variants: Record<string, 'range' | undefined> = {
            price: 'range',
        };

        expect(
            getFilterListItems(
                [
                    { id: 'price', value: [10, undefined] },
                    { id: 'other', value: 'x' },
                ],
                (id) => variants[id],
            ),
        ).toEqual([
            {
                id: 'price',
                variant: 'range',
                operator: 'isBetween',
                value: ['10', ''],
                filterId: 'price-filter',
            },
        ]);
    });
});

describe('reconcileFilterRows', () => {
    it('keeps the key and the place of each row when the server renames its filters', () => {
        const rows: FilterListRow[] = [
            {
                key: 'a',
                filter: filter({
                    id: 'status',
                    variant: 'select',
                    operator: 'inArray',
                    value: ['x'],
                    filterId: 'a',
                }),
            },
            {
                key: 'b',
                filter: filter({ id: 'name', value: 'ana', filterId: 'b' }),
            },
            {
                key: 'c',
                filter: filter({
                    id: 'status',
                    variant: 'select',
                    operator: 'eq',
                    value: 'y',
                    filterId: 'c',
                }),
            },
            {
                key: 'd',
                filter: filter({ id: 'name', value: '', filterId: 'd' }),
            },
        ];

        // The server groups the filters by column and numbers them.
        const server = [
            filter({
                id: 'status',
                variant: 'select',
                operator: 'inArray',
                value: ['x'],
                filterId: 'status-0',
            }),
            filter({
                id: 'status',
                variant: 'select',
                operator: 'eq',
                value: 'y',
                filterId: 'status-1',
            }),
            filter({ id: 'name', value: 'ana', filterId: 'name-0' }),
        ];

        const next = reconcileFilterRows(rows, server, keys());

        expect(next.map((row) => row.key)).toEqual(['a', 'b', 'c', 'd']);
        expect(next[0]?.filter.filterId).toBe('status-0');
        expect(next[3]?.filter.value).toBe('');
    });

    it('matches a normalized value, drops removed rows and adds new filters at the end', () => {
        const rows: FilterListRow[] = [
            {
                key: 'a',
                filter: filter({
                    id: 'price',
                    variant: 'range',
                    operator: 'isBetween',
                    value: ['50', '10'],
                }),
            },
            { key: 'b', filter: filter({ id: 'name', value: 'gone' }) },
        ];
        const server = [
            filter({
                id: 'price',
                variant: 'range',
                operator: 'isBetween',
                value: ['10', '50'],
            }),
            filter({ id: 'sku', operator: 'isEmpty' }),
        ];

        const next = reconcileFilterRows(rows, server, keys());

        expect(next.map((row) => row.key)).toEqual(['a', 'new-1']);
        expect(next[0]?.filter.value).toEqual(['10', '50']);
        expect(next[1]?.filter.id).toBe('sku');
    });
});

describe('getRowFilters', () => {
    it('sends the complete rows with their key as the filter id', () => {
        expect(
            getRowFilters([
                { key: 'a', filter: filter({ id: 'name', value: 'x' }) },
                { key: 'b', filter: filter({ id: 'name', value: '' }) },
            ]),
        ).toEqual([filter({ id: 'name', value: 'x', filterId: 'a' })]);
    });
});

describe('moveItem', () => {
    it('moves an item and ignores moves out of the list', () => {
        expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
        expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
        expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
    });
});

describe('groupEmptyRows and getRowJoinCells', () => {
    const row = (
        key: string,
        overrides: Partial<ColumnFilterItem> & Pick<ColumnFilterItem, 'id'>,
    ): FilterListRow => ({
        key,
        filter: filter({ value: 'x', ...overrides }),
    });
    const books = row('a', {
        id: 'category',
        variant: 'select',
        operator: 'inArray',
        value: ['Books'],
    });
    const price = row('b', {
        id: 'price',
        variant: 'range',
        operator: 'gte',
        value: '10',
    });
    const empty = row('c', {
        id: 'category',
        variant: 'select',
        operator: 'isEmpty',
        value: '',
    });

    it('puts the rows without a value next to their column, joined with or', () => {
        const rows = groupEmptyRows([books, price, empty], 'and');

        expect(rows.map((item) => item.key)).toEqual(['a', 'c', 'b']);
        expect(getRowJoinCells(rows, 'and')).toEqual([
            'where',
            'group',
            'select',
        ]);
    });

    it('keeps the order and the join with or', () => {
        const rows = groupEmptyRows([books, price, empty], 'or');

        expect(rows.map((item) => item.key)).toEqual(['a', 'b', 'c']);
        expect(getRowJoinCells(rows, 'or')).toEqual(['where', 'select', 'or']);
    });

    it('does not group an empty row without another complete row of its column', () => {
        const incomplete = row('d', {
            id: 'category',
            variant: 'select',
            operator: 'inArray',
            value: [],
        });
        const rows = groupEmptyRows([price, empty, incomplete], 'and');

        expect(rows.map((item) => item.key)).toEqual(['b', 'c', 'd']);
        expect(getRowJoinCells(rows, 'and')).toEqual([
            'where',
            'select',
            'and',
        ]);
    });
});
