import { describe, expect, it } from 'vitest';

import { getColumnAlign, getColumnClassName } from './data-table-utils';

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
        expect(getColumnAlign({ display: { type: 'number' } })).toBe('end');
        expect(
            getColumnAlign({ display: { type: 'number', format: {} } }),
        ).toBe('end');
        expect(getColumnAlign({ display: { type: 'text' } })).toBe('start');
        expect(getColumnAlign(undefined)).toBe('start');
        expect(
            getColumnAlign({ display: { type: 'number' }, align: 'center' }),
        ).toBe('center');
        expect(
            getColumnClassName({ display: { type: 'number' } }, 'cell'),
        ).toEqual(['w-(--cell-size)', 'pe-8 text-end']);
    });
});
