import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { formatCellValue, getFormatContext } from './data-table-format';
import {
    DEFAULT_MESSAGES,
    getMessage,
    getWeekStartsOn,
    mergeMessages,
    replacePlaceholders,
} from './data-table-messages';

const table = (messages: Record<string, string>, locale?: string) => ({
    options: { meta: { locale, messages } },
});

describe('getMessage', () => {
    it('replaces the placeholders, the longest names first', () => {
        expect(
            getMessage(
                table({ page_of: 'Página :page de :pages' }),
                'page_of',
                {
                    page: 2,
                    pages: '1.234',
                },
            ),
        ).toBe('Página 2 de 1.234');
    });

    it('falls back to English without a text or a table', () => {
        expect(getMessage(table({}), 'reset')).toBe('Reset');
        expect(getMessage(undefined, 'filter', { label: 'Status' })).toBe(
            'Status filter',
        );
    });
});

describe('mergeMessages', () => {
    it('lets the page change the texts of the server', () => {
        const messages = mergeMessages(
            { reset: 'Restablecer', search: 'Buscar...', unknown: 'x' },
            { reset: 'Borrar filtros' },
        );

        expect(messages.reset).toBe('Borrar filtros');
        expect(messages.search).toBe('Buscar...');
        expect(messages.no_results).toBe('No results.');
        expect(messages).not.toHaveProperty('unknown');
    });

    it('has the same keys as the lang file of the package', () => {
        const php = readFileSync(
            new URL('../../../lang/en/ui.php', import.meta.url),
            'utf8',
        );
        const entries = [...php.matchAll(/^\s+'(\w+)' => '(.*)',$/gm)].map(
            ([, key, text]) => [key, text?.replace(/\\'/g, "'")],
        );

        expect(Object.fromEntries(entries)).toEqual(DEFAULT_MESSAGES);
    });
});

describe('getWeekStartsOn', () => {
    it('starts the week on the first day of the locale', () => {
        expect(getWeekStartsOn('es-CL')).toBe(1);
        expect(getWeekStartsOn('en-US')).toBe(0);
        expect(getWeekStartsOn('en-GB')).toBe(1);
    });

    it('does not break with an invalid locale', () => {
        expect(getWeekStartsOn('not a locale')).toBe(0);
    });
});

describe('getFormatContext', () => {
    it('formats booleans and dates with the defaults of the table', () => {
        const context = getFormatContext({
            options: {
                meta: {
                    locale: 'es-CL',
                    dateFormat: 'short',
                    messages: { yes: 'Sí', no: 'No' },
                },
            },
        });

        expect(formatCellValue({ variant: 'boolean' }, 1, context)).toBe('Sí');
        expect(
            formatCellValue({ variant: 'date' }, '2026-01-15', context),
        ).toBe('15-01-26');
        expect(
            formatCellValue(
                {
                    variant: 'boolean',
                    display: {
                        type: 'boolean',
                        labels: { true: 'Activo', false: 'Inactivo' },
                    },
                },
                0,
                context,
            ),
        ).toBe('Inactivo');
    });
});

describe('replacePlaceholders', () => {
    it('does not read the value as a pattern nor replace it again', () => {
        expect(
            replacePlaceholders('Clear :label filter', { label: 'Price $$' }),
        ).toBe('Clear Price $$ filter');
        expect(
            replacePlaceholders('Clear :label filter', { label: 'A $& B' }),
        ).toBe('Clear A $& B filter');
        expect(
            replacePlaceholders(':label (:count)', {
                label: ':count',
                count: 3,
            }),
        ).toBe(':count (3)');
    });
});
