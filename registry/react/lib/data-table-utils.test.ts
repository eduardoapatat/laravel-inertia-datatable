import { describe, expect, it } from 'vitest';

import { getColumnClassName } from './data-table-utils';

describe('getColumnClassName', () => {
    it('gives the width class and the classes of the column', () => {
        expect(getColumnClassName(undefined, 'cell')).toEqual([
            'w-(--cell-size)',
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
        ).toEqual(['w-(--cell-size)', 'w-40 md:w-80', 'text-xs']);
        expect(
            getColumnClassName({ cellClassName: 'font-mono' }, 'cell'),
        ).toEqual(['w-(--cell-size)', 'font-mono']);
    });
});
