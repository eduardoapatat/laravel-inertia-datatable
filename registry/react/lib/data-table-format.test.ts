import { beforeAll, describe, expect, it } from 'vitest';

import {
    formatBoolean,
    formatCellValue,
    formatDateValue,
    formatNumber,
    formatNumberCell,
    getOption,
    getEmptyLabel,
    getFilterAffixes,
    isDateOnly,
    isEmptyValue,
    isSafeUrl,
    truncate,
} from './data-table-format';

// West of Greenwich, where a date at midnight UTC falls on the previous day.
beforeAll(() => {
    process.env.TZ = 'America/Santiago';
});

describe('formatNumber', () => {
    it('formats currencies, decimals and percentages with the locale', () => {
        expect(
            formatNumber(
                1234.5,
                { style: 'currency', currency: 'CLP' },
                'es-CL',
            ),
        ).toBe('$1.235');
        expect(
            formatNumber(
                '1234.50',
                { style: 'currency', currency: 'USD' },
                'en-US',
            ),
        ).toBe('$1,234.50');
        expect(
            formatNumber(
                1234.5,
                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                'es-CL',
            ),
        ).toBe('1.234,50');
        expect(formatNumber(0.25, { style: 'percent' }, 'es-CL')).toBe('25%');
    });

    it('returns texts that are not numbers as they are', () => {
        expect(formatNumber('n/a')).toBe('n/a');
        expect(formatNumber(null)).toBe('');
    });
});

describe('formatDateValue', () => {
    it('does not move dates without time to the previous day', () => {
        expect(
            formatDateValue('2025-10-20T00:00:00.000000Z', 'long', 'es-CL'),
        ).toBe('20 de octubre de 2025');
        expect(formatDateValue('2026-01-15', 'short', 'en-US')).toBe('1/15/26');
    });

    it('accepts Intl options', () => {
        expect(
            formatDateValue(
                '2026-01-15',
                { month: 'short', year: 'numeric' },
                'en-US',
            ),
        ).toBe('Jan 2026');
    });

    it('formats relative dates, by days when there is no time', () => {
        const now = new Date('2026-11-05T12:00:00Z');

        expect(
            formatDateValue('2026-11-02T12:00:00Z', 'relative', 'es-CL', now),
        ).toBe('hace 3 días');
        expect(formatDateValue('2026-11-04', 'relative', 'es-CL', now)).toBe(
            'ayer',
        );
    });

    it('shows a numeric date out of range as text, also when relative', () => {
        expect(formatDateValue(9e18, 'relative', 'es-CL')).toBe(
            '9000000000000000000',
        );
        expect(formatDateValue(Number.NaN, 'relative', 'es-CL')).toBe('NaN');
        expect(formatDateValue(1e16, 'long', 'es-CL')).toBe(
            '10000000000000000',
        );
    });

    it('tells dates without time apart', () => {
        expect(isDateOnly('2026-01-15')).toBe(true);
        expect(isDateOnly('2026-01-15T00:00:00.000000Z')).toBe(true);
        expect(isDateOnly('2026-01-15T10:30:00.000000Z')).toBe(false);
    });

    it('returns values that are not dates as they are', () => {
        expect(formatDateValue('soon')).toBe('soon');
        expect(formatDateValue(null)).toBe('');
    });
});

describe('formatCellValue', () => {
    it('adds the unit of the display', () => {
        expect(
            formatCellValue(
                {
                    display: {
                        type: 'number',
                        unit: 'kg',
                        format: { maximumFractionDigits: 1 },
                    },
                },
                12.345,
                'en-US',
            ),
        ).toBe('12.3 kg');
        expect(
            formatCellValue(
                {
                    display: {
                        type: 'number',
                        unit: '$',
                        format: { style: 'currency', currency: 'USD' },
                    },
                },
                5,
                'en-US',
            ),
        ).toBe('$5.00');
        expect(
            formatCellValue(
                { display: { type: 'text', limit: 5 } },
                'Lámpara grande',
            ),
        ).toBe('Lámpa…');
    });

    it('takes the type of the cell from display only', () => {
        expect(formatCellValue({ filterVariant: 'range' }, 2026)).toBe('2026');
        expect(
            formatCellValue(
                {
                    display: { type: 'option' },
                    options: [{ value: 'active', label: 'Active' }],
                },
                ['active', 'draft'],
            ),
        ).toBe('Active, draft');
    });
});

describe('formatBoolean', () => {
    it('accepts 1/0 and custom labels', () => {
        expect(formatBoolean(1, { true: 'Sí', false: 'No' })).toBe('Sí');
        expect(formatBoolean('0')).toBe('No');
    });
});

describe('truncate and isSafeUrl', () => {
    it('cuts by characters', () => {
        expect(truncate('áéíóú', 3)).toBe('áéí…');
        expect(truncate('short', 10)).toBe('short');
    });

    it('only accepts http and https links', () => {
        expect(isSafeUrl('https://example.com')).toBe(true);
        expect(isSafeUrl('javascript:alert(1)')).toBe(false);
        expect(isSafeUrl('not a url')).toBe(false);
    });
});

describe('formatNumberCell', () => {
    const money = (cell?: 'symbol' | 'code' | 'both' | 'none') => ({
        display: {
            type: 'number' as const,
            format: { style: 'currency' as const, currency: 'CLP' },
            ...(cell ? { currency: { cell } } : {}),
        },
    });

    it('splits the currency code from the number', () => {
        expect(formatNumberCell(money('code'), 1234567, 'es-CL')).toEqual({
            text: '1.234.567',
            suffix: 'CLP',
        });
    });

    it('keeps the symbol and splits the code with both', () => {
        expect(formatNumberCell(money('both'), 1234567, 'es-CL')).toEqual({
            text: '$1.234.567',
            suffix: 'CLP',
        });
    });

    it('splits the unit of plain numbers', () => {
        expect(
            formatNumberCell(
                { display: { type: 'number', unit: 'kg' } },
                12,
                'es-CL',
            ),
        ).toEqual({ text: '12', suffix: 'kg' });
    });

    it('leaves out a unit hidden in the cells', () => {
        expect(
            formatNumberCell(
                {
                    display: {
                        type: 'number',
                        unit: 'u.',
                        showUnit: { cell: false },
                    },
                },
                12,
                'es-CL',
            ),
        ).toEqual({ text: '12' });
    });

    it('keeps the symbol, plain numbers and empty values whole', () => {
        expect(formatNumberCell(money(), 1500, 'es-CL')).toEqual({
            text: '$1.500',
        });
        expect(formatNumberCell(money('none'), 1500, 'es-CL')).toEqual({
            text: '1.500',
        });
        expect(formatNumberCell(money('code'), null, 'es-CL')).toEqual({
            text: '',
        });
    });
});

describe('getFilterAffixes', () => {
    const money = (filter?: 'symbol' | 'code' | 'both' | 'none') => ({
        display: {
            type: 'number' as const,
            format: { style: 'currency' as const, currency: 'CLP' },
            ...(filter ? { currency: { filter } } : {}),
        },
    });
    const symbol = { text: '$', align: 'inline-start' };
    const code = { text: 'CLP', align: 'inline-end' };

    it('puts the currency symbol before the inputs by default', () => {
        expect(getFilterAffixes(money())).toEqual([symbol]);
    });

    it('puts the currency code after the inputs, both, or nothing', () => {
        expect(getFilterAffixes(money('code'))).toEqual([code]);
        expect(getFilterAffixes(money('both'))).toEqual([symbol, code]);
        expect(getFilterAffixes(money('none'))).toEqual([]);
    });

    it('puts the unit of plain numbers after the inputs', () => {
        expect(
            getFilterAffixes({ display: { type: 'number', unit: 'kg' } }),
        ).toEqual([{ text: 'kg', align: 'inline-end' }]);
    });

    it('leaves out a unit hidden in the filter', () => {
        expect(
            getFilterAffixes({
                display: {
                    type: 'number',
                    unit: 'u.',
                    showUnit: { filter: false },
                },
            }),
        ).toEqual([]);
    });

    it('has none for percentages or columns without a unit', () => {
        expect(
            getFilterAffixes({
                display: {
                    type: 'number',
                    unit: '%',
                    format: { style: 'percent' },
                },
            }),
        ).toEqual([]);
        expect(getFilterAffixes({ display: { type: 'number' } })).toEqual([]);
    });
});

describe('formatNumber with a currency', () => {
    const clp = { style: 'currency' as const, currency: 'CLP' };

    it('puts the symbol before the number in any locale', () => {
        expect(formatNumber(1684910, clp, 'es-CL')).toBe('$1.684.910');
        expect(formatNumber(1684910, clp, 'es')).toBe('$1.684.910');
        expect(formatNumber(1684910, clp, 'en')).toBe('$1,684,910');
        expect(formatNumber(-1500, clp, 'es-CL')).toBe('-$1.500');
    });

    it('puts the code after the number, or shows only the number', () => {
        expect(formatNumber(1684910, clp, 'es-CL', 'code')).toBe(
            '1.684.910 CLP',
        );
        expect(formatNumber(1684910, clp, 'en', 'none')).toBe('1,684,910');
    });

    it('puts the symbol before and the code after the number with both', () => {
        expect(formatNumber(-1500, clp, 'es-CL', 'both')).toBe('-$1.500 CLP');
    });

    it('keeps the decimals of the currency', () => {
        expect(
            formatNumber(5, { style: 'currency', currency: 'USD' }, 'en-US'),
        ).toBe('$5.00');
    });

    it('lets currencyDisplay of the format decide', () => {
        expect(
            formatNumber(5, { ...clp, currencyDisplay: 'name' }, 'en-US'),
        ).toBe('5 Chilean pesos');
    });
});

describe('formatCellValue with a date column without a format', () => {
    it('uses the date format of the table', () => {
        expect(
            formatCellValue({ display: { type: 'date' } }, '2026-01-15', {
                locale: 'es-CL',
                dateFormat: 'short',
            }),
        ).toBe('15-01-26');
    });
});

describe('getOption', () => {
    const Icon = () => null;

    it('adds the icon of meta.icons to the option of the server', () => {
        expect(
            getOption(
                {
                    options: [{ value: 'active', label: 'Activo' }],
                    icons: { active: Icon },
                },
                'active',
            ),
        ).toEqual({ value: 'active', label: 'Activo', icon: Icon });
    });

    it('ignores the inherited members of meta.icons', () => {
        const meta = {
            options: [],
            icons: { active: Icon },
        };

        expect(getOption(meta, 'constructor')).toBeUndefined();
        expect(getOption(meta, '__proto__')).toBeUndefined();
        expect(getOption(meta, 'hasOwnProperty')).toBeUndefined();
    });

    it('keeps the icon declared in meta.options', () => {
        const Own = () => null;

        expect(
            getOption(
                {
                    options: [{ value: 'active', label: 'Activo', icon: Own }],
                    icons: { active: Icon },
                },
                'active',
            )?.icon,
        ).toBe(Own);
    });

    it('gives an option with only the icon for values without options', () => {
        expect(getOption({ icons: { true: Icon } }, true)).toEqual({
            value: 'true',
            label: 'true',
            icon: Icon,
        });
        expect(getOption({ icons: { true: Icon } }, false)).toBeUndefined();
    });
});

describe('isEmptyValue', () => {
    it('is empty for null, undefined, blank texts and lists of them', () => {
        expect(isEmptyValue(null)).toBe(true);
        expect(isEmptyValue(undefined)).toBe(true);
        expect(isEmptyValue('')).toBe(true);
        expect(isEmptyValue([])).toBe(true);
        expect(isEmptyValue([null, ''])).toBe(true);
    });

    it('is not empty for zero, false or a list with a value', () => {
        expect(isEmptyValue(0)).toBe(false);
        expect(isEmptyValue(false)).toBe(false);
        expect(isEmptyValue(' ')).toBe(false);
        expect(isEmptyValue([null, 'a'])).toBe(false);
    });
});

describe('getEmptyLabel', () => {
    const table = {
        options: { meta: { messages: { no_value: 'Sin valor' } } },
    };

    it('uses the text of whenEmpty()', () => {
        expect(
            getEmptyLabel(
                { display: { type: 'date', empty: 'Sin publicar' } },
                table,
            ),
        ).toBe('Sin publicar');
    });

    it('uses the no_value text without it or when it is blank', () => {
        expect(getEmptyLabel({ display: { type: 'date' } }, table)).toBe(
            'Sin valor',
        );
        expect(
            getEmptyLabel({ display: { type: 'date', empty: '' } }, table),
        ).toBe('Sin valor');
        expect(getEmptyLabel(undefined)).toBe('No value');
    });

    it('uses the no_value text when whenEmpty() is only a symbol', () => {
        for (const empty of ['—', '-', ' – ', '…']) {
            expect(
                getEmptyLabel({ display: { type: 'number', empty } }, table),
            ).toBe('Sin valor');
        }
        expect(
            getEmptyLabel({ display: { type: 'number', empty: 'N/A' } }, table),
        ).toBe('N/A');
    });
});

describe('formatDateValue with a date without time and a format with time', () => {
    it('shows the same day, without an hour', () => {
        for (const value of ['2026-01-15', '2026-01-15T00:00:00.000000Z']) {
            expect(formatDateValue(value, 'datetime', 'en-US')).toBe(
                'Jan 15, 2026',
            );
            expect(
                formatDateValue(
                    value,
                    { day: 'numeric', month: 'short', hour: 'numeric' },
                    'en-US',
                ),
            ).toBe('Jan 15');
            expect(
                formatDateValue(value, { timeStyle: 'short' }, 'en-US'),
            ).toBe('Jan 15, 2026');
        }
    });

    it('keeps the hour of a date with time', () => {
        expect(
            formatDateValue('2026-01-15T15:30:00Z', 'datetime', 'en-US'),
        ).toMatch(/Jan 15, 2026, \d{1,2}:30/);
    });

    it('falls back to the browser locale in a relative date', () => {
        expect(
            formatDateValue(
                '2026-01-14',
                'relative',
                'zz_not-a-locale!',
                new Date(2026, 0, 15),
            ),
        ).not.toBe('');
    });
});
