import { beforeAll, describe, expect, it } from 'vitest';

import {
    formatBoolean,
    formatCellValue,
    formatDateValue,
    formatNumber,
    getOption,
    getFilterUnit,
    isDateOnly,
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
    it('uses the display before the filter variant', () => {
        expect(
            formatCellValue(
                {
                    variant: 'number',
                    unit: 'kg',
                    display: {
                        type: 'number',
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
                    variant: 'number',
                    unit: '$',
                    display: {
                        type: 'number',
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

    it('keeps the variant formatting without display', () => {
        expect(formatCellValue({ variant: 'number', unit: 'kg' }, 2026)).toBe(
            '2026 kg',
        );
        expect(
            formatCellValue(
                {
                    variant: 'multi-select',
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

describe('getFilterUnit', () => {
    it('gives the code of the currency', () => {
        expect(
            getFilterUnit({
                display: {
                    type: 'number',
                    format: { style: 'currency', currency: 'CLP' },
                },
            }),
        ).toBe('CLP');
    });

    it('gives the unit of plain numbers', () => {
        expect(getFilterUnit({ display: { type: 'number', unit: 'kg' } })).toBe(
            'kg',
        );
        expect(getFilterUnit({ variant: 'number', unit: 'u.' })).toBe('u.');
    });

    it('has none for percentages or columns without a unit', () => {
        expect(
            getFilterUnit({
                variant: 'number',
                unit: '%',
                display: { type: 'number', format: { style: 'percent' } },
            }),
        ).toBeUndefined();
        expect(getFilterUnit({ display: { type: 'number' } })).toBeUndefined();
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
                    variant: 'select',
                    options: [{ value: 'active', label: 'Activo' }],
                    icons: { active: Icon },
                },
                'active',
            ),
        ).toEqual({ value: 'active', label: 'Activo', icon: Icon });
    });

    it('keeps the icon declared in meta.options', () => {
        const Own = () => null;

        expect(
            getOption(
                {
                    variant: 'select',
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
