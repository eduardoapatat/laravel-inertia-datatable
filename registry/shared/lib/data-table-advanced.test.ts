import { describe, expect, it } from 'vite-plus/test';

import {
    changeFilterOperator,
    createFilterListItem,
    type FilterListRow,
    getFilterListItems,
    getFilterOperatorMessageKey,
    getIsFilterComplete,
    getRowEmptyControl,
    getRowFilters,
    getRowJoinCells,
    moveItem,
    normalizeEmptyRows,
    reconcileFilterRows,
    setRowsEmpty,
    updateRowFilter,
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
                includesEmpty: false,
            },
            {
                key: 'b',
                filter: filter({ id: 'name', value: 'ana', filterId: 'b' }),
                includesEmpty: false,
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
                includesEmpty: false,
            },
            {
                key: 'd',
                filter: filter({ id: 'name', value: '', filterId: 'd' }),
                includesEmpty: false,
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
                includesEmpty: false,
            },
            {
                key: 'b',
                filter: filter({ id: 'name', value: 'gone' }),
                includesEmpty: false,
            },
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
                {
                    key: 'a',
                    filter: filter({ id: 'name', value: 'x' }),
                    includesEmpty: false,
                },
                {
                    key: 'b',
                    filter: filter({ id: 'name', value: '' }),
                    includesEmpty: false,
                },
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

describe('the rows without a value of a column', () => {
    const books = filter({
        id: 'category',
        variant: 'select',
        operator: 'inArray',
        value: ['Books'],
    });
    const garden = filter({ ...books, value: ['Garden'] });
    const empty = filter({
        id: 'category',
        variant: 'select',
        operator: 'isEmpty',
        value: '',
    });
    const price = filter({
        id: 'price',
        variant: 'range',
        operator: 'gte',
        value: '10',
    });
    const row = (
        key: string,
        item: ColumnFilterItem,
        includesEmpty = false,
    ): FilterListRow => ({ key, filter: item, includesEmpty });
    const shown = (rows: FilterListRow[]) =>
        rows.map((item) => [
            item.key,
            item.filter.operator,
            item.filter.value,
            item.includesEmpty,
        ]);

    it('go inside the row of the other filter of their column', () => {
        // The toolbar: "Books" and "No category".
        const rows = reconcileFilterRows([], [books, empty, price], keys());

        expect(shown(rows)).toEqual([
            ['new-1', 'inArray', ['Books'], true],
            ['new-3', 'gte', '10', false],
        ]);
        expect(
            getRowFilters(rows).map((item) => [item.id, item.operator]),
        ).toEqual([
            ['category', 'inArray'],
            ['category', 'isEmpty'],
            ['price', 'gte'],
        ]);
    });

    it('go inside every row of their column, sent once', () => {
        // (Books or empty) and (Garden or empty) is (Books and Garden) or empty,
        // what the server applies.
        const rows = reconcileFilterRows([], [books, garden, empty], keys());

        expect(shown(rows)).toEqual([
            ['new-1', 'inArray', ['Books'], true],
            ['new-2', 'inArray', ['Garden'], true],
        ]);
        expect(getRowFilters(rows).at(-1)).toEqual({
            id: 'category',
            variant: 'select',
            operator: 'isEmpty',
            value: '',
            filterId: 'category-empty',
        });
        expect(
            getRowFilters(rows).filter((item) => item.operator === 'isEmpty'),
        ).toHaveLength(1);
    });

    it('stay their own row when their column has no other filter', () => {
        const rows = reconcileFilterRows([], [empty, price], keys());

        expect(shown(rows)).toEqual([
            ['new-1', 'isEmpty', '', false],
            ['new-2', 'gte', '10', false],
        ]);
    });

    it('go inside a row of their column that gets a value', () => {
        const rows = [row('a', empty), row('b', { ...books, value: [] })];

        expect(shown(updateRowFilter(rows, 'b', books))).toEqual([
            ['b', 'inArray', ['Books'], true],
        ]);
    });

    it('keep the row whose value is gone while its column still takes them', () => {
        const rows = [row('a', books, true)];
        const next = reconcileFilterRows(rows, [empty], keys());

        expect(shown(next)).toEqual([['a', 'inArray', [], true]]);
        expect(getRowFilters(next)).toEqual([
            expect.objectContaining({ id: 'category', operator: 'isEmpty' }),
        ]);
    });

    it('leave the rows of their column when their filter is gone', () => {
        const rows = [
            row('a', books, true),
            row('b', { ...books, value: [] }, true),
        ];

        expect(shown(reconcileFilterRows(rows, [books], keys()))).toEqual([
            ['a', 'inArray', ['Books'], false],
        ]);
    });

    it('are added and removed on every row of their column at once', () => {
        const rows = [row('a', books), row('b', garden), row('c', price)];
        const added = setRowsEmpty(rows, 'category', true);

        expect(shown(added).map((item) => item[3])).toEqual([
            true,
            true,
            false,
        ]);
        expect(
            shown(setRowsEmpty(added, 'category', false)).map(
                (item) => item[3],
            ),
        ).toEqual([false, false, false]);
    });

    it('are not taken by a row moved to another column or to "Is empty"', () => {
        const rows = [row('a', books, true), row('b', price)];

        expect(
            shown(updateRowFilter(rows, 'a', { ...price, value: '5' })),
        ).toEqual([
            ['a', 'gte', '5', false],
            ['b', 'gte', '10', false],
        ]);
        expect(shown(updateRowFilter(rows, 'a', empty))).toEqual([
            ['a', 'isEmpty', '', false],
            ['b', 'gte', '10', false],
        ]);
    });

    it('do not change rows that already read as the server applies them', () => {
        const rows = [row('a', books, true), row('b', price)];

        expect(normalizeEmptyRows(rows)).toEqual(rows);
    });
});

describe('getRowEmptyControl', () => {
    const control = (
        overrides: Partial<ColumnFilterItem>,
        offersEmpty = true,
        includesEmpty = false,
    ) =>
        getRowEmptyControl(
            {
                filter: filter({ id: 'x', value: 'v', ...overrides }),
                includesEmpty,
            },
            offersEmpty,
        );

    it('is an option of a list of options and a check for the rest', () => {
        expect(control({ variant: 'select', operator: 'inArray' })).toBe(
            'option',
        );
        expect(control({ variant: 'multi-select', operator: 'inArray' })).toBe(
            'option',
        );
        expect(control({ variant: 'select', operator: 'eq' })).toBe('check');
        expect(control({ variant: 'range', operator: 'isBetween' })).toBe(
            'check',
        );
        expect(
            control({ variant: 'date', operator: 'isRelativeToToday' }),
        ).toBe('check');
    });

    it('is missing in "Is empty", the negations and the columns that do not offer it', () => {
        expect(control({ operator: 'isEmpty' })).toBeNull();
        expect(control({ operator: 'ne' })).toBeNull();
        expect(
            control({ variant: 'select', operator: 'notInArray' }),
        ).toBeNull();
        expect(control({ operator: 'isNotEmpty' })).toBeNull();
        expect(control({ operator: 'eq' }, false)).toBeNull();
    });

    it('shows on a row that already takes them, so it can be removed', () => {
        expect(control({ operator: 'ne' }, false, true)).toBe('check');
        expect(
            control({ variant: 'select', operator: 'inArray' }, false, true),
        ).toBe('option');
    });
});

describe('getRowJoinCells', () => {
    it('starts with where, then the select of the join, then the join', () => {
        const rows = ['a', 'b', 'c'].map((key) => ({
            key,
            filter: filter({ id: key, value: 'x' }),
            includesEmpty: false,
        }));

        expect(getRowJoinCells(rows, 'or')).toEqual(['where', 'select', 'or']);
        expect(getRowJoinCells(rows, 'and')).toEqual([
            'where',
            'select',
            'and',
        ]);
    });
});
