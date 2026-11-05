// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    DEFAULT_MESSAGES,
    getMessage,
    type TableWithMeta,
} from '@/lib/data-table-messages';
import type {
    ColumnDisplay,
    ColumnSelectOption,
    DataTableColumnMeta,
    DatePreset,
} from '@/lib/data-table-types';

export function formatDate(
    date: Date | string | number | undefined,
    opts: Intl.DateTimeFormatOptions = {},
    locale?: string,
) {
    if (!date) return '';

    try {
        return new Intl.DateTimeFormat(locale, {
            month: opts.month ?? 'long',
            day: opts.day ?? 'numeric',
            year: opts.year ?? 'numeric',
            ...opts,
        }).format(new Date(date));
    } catch {
        return '';
    }
}

const DATE_PRESETS: Record<
    Exclude<DatePreset, 'relative'>,
    Intl.DateTimeFormatOptions
> = {
    short: { dateStyle: 'short' },
    medium: { dateStyle: 'medium' },
    long: { dateStyle: 'long' },
    datetime: { dateStyle: 'medium', timeStyle: 'short' },
};

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
    ['second', 1],
];

/**
 * Number with Intl options (`{ style: 'currency', currency: 'CLP' }`…). Texts
 * that are not numbers are returned as they are.
 */
export function formatNumber(
    value: unknown,
    format: Intl.NumberFormatOptions = {},
    locale?: string,
): string {
    const number = toNumber(value);

    if (number === null) {
        return toText(value);
    }

    try {
        return new Intl.NumberFormat(locale, format).format(number);
    } catch {
        return String(number);
    }
}

export interface NumberAffix {
    text: string;
    align: 'inline-start' | 'inline-end';
}

/**
 * What goes next to the number inputs of a filter: the unit of plain numbers
 * (`->unit('kg')`) at the end, or the symbol of the currency (`->money('CLP')`)
 * on the side the locale puts it (`$` before in es-CL, `€` after in de-DE).
 * Percentages and Intl units have none: the input takes the raw value.
 */
export function getNumberAffix(
    meta: DataTableColumnMeta | undefined,
    locale?: string,
): NumberAffix | undefined {
    const format =
        meta?.display?.type === 'number' ? meta.display.format : undefined;

    if (format?.style === 'currency' && format.currency) {
        try {
            const parts = new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: format.currency,
                currencyDisplay: format.currencyDisplay,
            }).formatToParts(1);
            const symbol = parts.findIndex((part) => part.type === 'currency');
            const integer = parts.findIndex((part) => part.type === 'integer');
            const text = parts[symbol]?.value;

            return text
                ? {
                      text,
                      align: symbol < integer ? 'inline-start' : 'inline-end',
                  }
                : undefined;
        } catch {
            return undefined;
        }
    }

    const unit = format?.style === undefined ? getUnit(meta) : undefined;

    return unit ? { text: unit, align: 'inline-end' } : undefined;
}

/**
 * Date with a preset or Intl options. Dates without time (`2026-01-15`, or
 * midnight UTC as Laravel serializes `date` casts) are formatted in UTC so they
 * do not move to the previous day west of Greenwich.
 */
export function formatDateValue(
    value: unknown,
    format: ColumnDisplayDateFormat = 'long',
    locale?: string,
    now: Date = new Date(),
): string {
    const parsed = parseDate(value);

    if (parsed === null) {
        return toText(value);
    }

    if (format === 'relative') {
        return formatRelativeDate(parsed, now, locale);
    }

    const options = typeof format === 'string' ? DATE_PRESETS[format] : format;
    const hasTime =
        options.timeStyle !== undefined ||
        options.hour !== undefined ||
        options.minute !== undefined ||
        options.second !== undefined;
    const timeZone =
        options.timeZone ?? (parsed.dateOnly && !hasTime ? 'UTC' : undefined);

    try {
        return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(
            parsed.date,
        );
    } catch {
        return toText(value);
    }
}

type ColumnDisplayDateFormat = Extract<
    ColumnDisplay,
    { type: 'date' }
>['format'];

function formatRelativeDate(
    { date, dateOnly }: ParsedDate,
    now: Date,
    locale?: string,
): string {
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    // A date without time is compared by days: "yesterday", not "in 21 hours".
    const seconds = dateOnly
        ? (date.getTime() -
              Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
          1000
        : (date.getTime() - now.getTime()) / 1000;
    const units = dateOnly
        ? RELATIVE_UNITS.filter(([, size]) => size >= 86_400)
        : RELATIVE_UNITS;
    const [unit, size] = units.find(([, size]) => Math.abs(seconds) >= size) ??
        units[units.length - 1] ?? ['second', 1];

    return formatter.format(Math.round(seconds / size), unit);
}

/**
 * A date without time: `2026-01-15` or midnight UTC (Laravel `date` casts).
 */
export function isDateOnly(value: unknown): boolean {
    return parseDate(value)?.dateOnly ?? false;
}

interface ParsedDate {
    date: Date;
    dateOnly: boolean;
}

function parseDate(value: unknown): ParsedDate | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? null
            : { date: value, dateOnly: false };
    }

    if (typeof value === 'number') {
        return { date: new Date(value), dateOnly: false };
    }

    if (typeof value !== 'string' || value.trim() === '') {
        return null;
    }

    const dateOnly =
        /^\d{4}-\d{2}-\d{2}$/.test(value) ||
        /T00:00:00(\.0+)?(Z|[+-]00:?00)$/.test(value);
    const date = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value,
    );

    return Number.isNaN(date.getTime()) ? null : { date, dateOnly };
}

/**
 * Cuts a text to `limit` characters (not code units), adding an ellipsis.
 */
export function truncate(text: string, limit?: number): string {
    const characters = Array.from(text);

    return limit === undefined || characters.length <= limit
        ? text
        : `${characters.slice(0, limit).join('').trimEnd()}…`;
}

/**
 * Only http and https URLs become links (never `javascript:`).
 */
export function isSafeUrl(url: string): boolean {
    try {
        const { protocol } = new URL(url);

        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

export function isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+$/.test(value);
}

/**
 * Defaults of the table to format a cell: `getFormatContext(table)`.
 */
export interface FormatContext {
    locale?: string;
    /** Format of the dates without `display`; `long` by default. */
    dateFormat?: DatePreset;
    /** Texts of true and false without `display.labels`; Yes / No by default. */
    booleanLabels?: { true: string; false: string };
}

/**
 * Locale, date format and Yes / No texts of the table (`table.options.meta`).
 */
export function getFormatContext(
    table: TableWithMeta | undefined,
): FormatContext {
    const meta = table?.options.meta;

    return {
        locale: meta?.locale,
        dateFormat: meta?.dateFormat,
        booleanLabels: {
            true: getMessage(table, 'yes'),
            false: getMessage(table, 'no'),
        },
    };
}

/**
 * Text of a cell as the default cell shows it: the column `display` (format
 * declared in PHP or in the page `meta`) or, without it, the filter variant.
 * The third argument is the locale or the defaults of the table.
 */
export function formatCellValue(
    meta: DataTableColumnMeta | undefined,
    value: unknown,
    context: string | FormatContext = {},
): string {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    const {
        locale,
        dateFormat = 'long',
        booleanLabels,
    } = typeof context === 'string' ? { locale: context } : context;

    if (Array.isArray(value)) {
        return value
            .map((item) => formatCellValue(meta, item, context))
            .join(', ');
    }

    const display = meta?.display;

    switch (display?.type) {
        case 'number':
            return withUnit(
                formatNumber(value, display.format, locale),
                meta,
                display.format,
            );
        case 'date':
            return formatDateValue(value, display.format ?? dateFormat, locale);
        case 'text':
            return truncate(toText(value), display.limit);
        case 'boolean':
            return formatBoolean(value, display.labels ?? booleanLabels);
        case 'option':
            return getOptionLabel(meta, toPrimitive(value));
    }

    switch (meta?.variant) {
        case 'date':
            return formatDateValue(value, dateFormat, locale);
        case 'boolean':
            return formatBoolean(value, booleanLabels);
        case 'select':
        case 'multi-select':
            return getOptionLabel(meta, toPrimitive(value));
        case 'number':
            return withUnit(toText(value), meta);
    }

    if (typeof value === 'boolean') {
        return formatBoolean(value, booleanLabels);
    }

    return toText(value);
}

/**
 * Some databases (SQLite, MySQL) return 1/0 instead of true/false.
 */
export function formatBoolean(
    value: unknown,
    labels: { true: string; false: string } = {
        true: DEFAULT_MESSAGES.yes,
        false: DEFAULT_MESSAGES.no,
    },
): string {
    return value === true || value === 1 || value === '1' || value === 'true'
        ? labels.true
        : labels.false;
}

/**
 * Label of an option (select / multi-select) as declared by the server, to
 * show `Administrator` instead of `admin` in a cell.
 */
export function getOptionLabel(
    meta: DataTableColumnMeta | undefined,
    value: string | number | boolean | null | undefined,
): string {
    const text = value === null || value === undefined ? '' : String(value);

    return getOption(meta, value)?.label ?? text;
}

/**
 * Option (select / multi-select) of a value, with its label, count and the
 * icon declared in the page `meta`.
 */
export function getOption(
    meta: DataTableColumnMeta | undefined,
    value: string | number | boolean | null | undefined,
): ColumnSelectOption | undefined {
    const text = value === null || value === undefined ? '' : String(value);
    const options = meta && 'options' in meta ? meta.options : undefined;

    return options?.find((option) => option.value === text);
}

export function toText(value: unknown): string {
    switch (typeof value) {
        case 'string':
            return value;
        case 'number':
        case 'bigint':
        case 'boolean':
            return String(value);
        case 'object':
            return value === null ? '' : JSON.stringify(value);
        default:
            return '';
    }
}

export function toPrimitive(value: unknown): string | number | boolean | null {
    return typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
        ? value
        : null;
}

function toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const number = Number(value);

        return Number.isFinite(number) ? number : null;
    }

    return null;
}

/**
 * Unit of the column: `->unit('kg')` in PHP or `meta.unit` in the page.
 */
function getUnit(meta: DataTableColumnMeta | undefined): string | undefined {
    const display = meta?.display?.type === 'number' ? meta.display : undefined;

    return display?.unit ?? (meta && 'unit' in meta ? meta.unit : undefined);
}

/**
 * The unit goes after plain numbers, not after currencies, percentages or
 * Intl units.
 */
function withUnit(
    text: string,
    meta: DataTableColumnMeta | undefined,
    format?: Intl.NumberFormatOptions,
): string {
    const unit = getUnit(meta);

    return unit && format?.style === undefined ? `${text} ${unit}` : text;
}
