import { describe, expect, it } from 'vite-plus/test';

import {
    DEFAULT_MESSAGES,
    type DataTableMessageKey,
    replacePlaceholders,
} from '@/lib/data-table-messages';
import {
    formatRelativeDateRange,
    getRelativeDateLabel,
    normalizeRelativeDate,
    RELATIVE_DATE_PRESETS,
} from '@/lib/data-table-relative-date';

const message = (
    key: DataTableMessageKey,
    replacements: Record<string, string | number> = {},
) => replacePlaceholders(DEFAULT_MESSAGES[key], replacements);

describe('normalizeRelativeDate', () => {
    it.each([
        ['today', 'today'],
        [' This-Month ', 'this-month'],
        ['-07D', '-7d'],
        ['-0d', '-1d'],
        ['-99999d', '-3660d'],
        ['+1000w', '+522w'],
        ['-500m', '-120m'],
        ['+50y', '+10y'],
    ])('writes %j as %j, as the server', (value, token) => {
        expect(normalizeRelativeDate(value)).toBe(token);
    });

    it.each([
        '',
        'now',
        '7d',
        '-7',
        '-7h',
        '--7d',
        '-1234567d',
        'this-day',
        'this_week',
        '2026-11-15',
        'constructor',
    ])('rejects %j', (value) => {
        expect(normalizeRelativeDate(value)).toBeNull();
    });

    it('offers only valid tokens', () => {
        for (const token of RELATIVE_DATE_PRESETS) {
            expect(normalizeRelativeDate(token)).toBe(token);
        }
    });
});

describe('getRelativeDateLabel', () => {
    it.each([
        ['today', 'Today'],
        ['last-month', 'Last month'],
        ['next-quarter', 'Next quarter'],
        ['-7d', 'Past 7 days'],
        ['+30d', 'Next 30 days'],
        ['-1d', 'Today'],
        ['-2w', 'Past 14 days'],
        ['-1w', 'Past 7 days'],
        ['-1m', 'Past month'],
        ['-3m', 'Past 3 months'],
        ['+1y', 'Coming year'],
        ['+2y', 'Next 2 years'],
        ['soon', 'soon'],
    ])('names %j %j', (token, label) => {
        expect(getRelativeDateLabel(token, message)).toBe(label);
    });

    it('has a text for every preset', () => {
        for (const token of RELATIVE_DATE_PRESETS) {
            expect(getRelativeDateLabel(token, message)).not.toBe(token);
        }
    });
});

describe('formatRelativeDateRange', () => {
    it('formats the calendar days of the server in any time zone', () => {
        // Intl separates the range with thin spaces.
        const format = (range: [string, string]) =>
            formatRelativeDateRange(range, 'en-US').replace(/\s/g, ' ');

        expect(format(['2026-11-09', '2026-11-15'])).toBe('Nov 9 – 15, 2026');
        expect(format(['2026-11-15', '2026-11-15'])).toBe('Nov 15, 2026');
    });

    it('is empty without the days', () => {
        expect(formatRelativeDateRange(undefined)).toBe('');
        expect(formatRelativeDateRange(['soon', '2026-11-15'])).toBe('');
    });
});
