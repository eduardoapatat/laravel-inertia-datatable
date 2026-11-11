import { describe, expect, it } from 'vitest';

import {
    createPlainFilter,
    getIsPlainFilter,
    getPlainFilterValue,
    getRangeFilterBounds,
    getValidRangeFilterBounds,
    normalizeColumnFilter,
    pickDateRangeDay,
} from './data-table-filter-values';

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

describe('createPlainFilter', () => {
    it('uses the implicit operator of the variant', () => {
        expect(createPlainFilter('name', 'text', 'ana')).toEqual({
            id: 'name',
            variant: 'text',
            operator: 'iLike',
            value: 'ana',
            filterId: 'name-filter',
        });
        expect(createPlainFilter('status', 'select', 'active')).toMatchObject({
            operator: 'inArray',
            value: ['active'],
        });
    });

    it('returns null for an empty value', () => {
        expect(createPlainFilter('name', 'text', '')).toBeNull();
        expect(createPlainFilter('name', 'text', undefined)).toBeNull();
        expect(createPlainFilter('price', 'range', [undefined, ''])).toBeNull();
        expect(createPlainFilter('name', 'text', ['a'])).toBeNull();
    });

    it('orders the bounds of a range and drops the invalid ones', () => {
        expect(createPlainFilter('price', 'range', [50, 10])).toMatchObject({
            operator: 'isBetween',
            value: ['10', '50'],
        });
        expect(createPlainFilter('price', 'range', ['x', 5])).toMatchObject({
            value: ['', '5'],
        });
    });

    it('writes dates as local calendar days, in order', () => {
        const start = new Date(2026, 4, 20).getTime();
        const end = new Date(2026, 4, 1).getTime();

        expect(createPlainFilter('at', 'date', start)).toMatchObject({
            operator: 'eq',
            value: '2026-05-20',
        });
        expect(
            createPlainFilter('at', 'date-range', [start, end]),
        ).toMatchObject({ value: ['2026-05-01', '2026-05-20'] });
    });
});

describe('normalizeColumnFilter', () => {
    it('turns a plain value into the filter of the server variant', () => {
        expect(
            normalizeColumnFilter({ id: 'stock', value: 5 }, 'number'),
        ).toEqual({
            id: 'stock',
            variant: 'number',
            operator: 'eq',
            value: '5',
            filterId: 'stock-filter',
        });
    });

    it('keeps the operator of a filter that has one', () => {
        expect(
            normalizeColumnFilter(
                { id: 'weight', value: '', operator: 'isEmpty' },
                'range',
            ),
        ).toMatchObject({ variant: 'range', operator: 'isEmpty', value: '' });
    });

    it('returns an empty filter for an empty value', () => {
        expect(
            normalizeColumnFilter({ id: 'status', value: [] }, 'select'),
        ).toMatchObject({ operator: 'inArray', value: [] });
    });
});

describe('getPlainFilterValue', () => {
    it('gives back what the filter components write', () => {
        const date = new Date(2026, 0, 2);

        for (const [variant, value] of [
            ['text', 'ana'],
            ['select', ['a', 'b']],
            ['range', [10, undefined]],
            ['date', date.getTime()],
        ] as const) {
            const filter = createPlainFilter('id', variant, value);

            expect(filter && getPlainFilterValue(filter)).toEqual(value);
            expect(filter && getIsPlainFilter(filter)).toBe(true);
        }
    });

    it('is not plain with another operator', () => {
        expect(
            getIsPlainFilter(
                normalizeColumnFilter(
                    { id: 'name', value: '', operator: 'isEmpty' },
                    'text',
                ),
            ),
        ).toBe(false);
    });
});

describe('getRangeFilterBounds', () => {
    it('clamps and orders the bounds', () => {
        expect(getRangeFilterBounds(['150', '-5'], [0, 100])).toEqual([0, 100]);
        expect(getRangeFilterBounds(['', 'x'])).toEqual([undefined, undefined]);
    });
});

describe('getValidRangeFilterBounds', () => {
    it('accepts open and valid bounds', () => {
        expect(getValidRangeFilterBounds(['', '20'], [0, 100])).toEqual([
            undefined,
            20,
        ]);
    });

    it('rejects invalid, out of range or reversed bounds', () => {
        expect(getValidRangeFilterBounds(['x', ''])).toBeNull();
        expect(getValidRangeFilterBounds(['', '200'], [0, 100])).toBeNull();
        expect(getValidRangeFilterBounds(['20', '10'])).toBeNull();
    });
});
