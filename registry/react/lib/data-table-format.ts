// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    DEFAULT_MESSAGES,
    getMessage,
    type TableWithMeta,
} from '@/lib/data-table-messages';
import type {
    ColumnDisplay,
    ColumnSelectOption,
    CurrencyDisplay,
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
 * that are not numbers are returned as they are. Currencies follow `currency`:
 * the symbol before the number (`$1.234`, in any locale), the code after it
 * (`1.234 CLP`), both (`$1.234 CLP`) or nothing (`1.234`); the locale gives the
 * separators.
 */
export function formatNumber(
    value: unknown,
    format: Intl.NumberFormatOptions = {},
    locale?: string,
    currency: CurrencyDisplay = 'symbol',
): string {
    const number = toNumber(value);

    if (number === null) {
        return toText(value);
    }

    try {
        if (
            format.style === 'currency' &&
            format.currencyDisplay === undefined
        ) {
            return formatMoney(number, format, locale, currency);
        }

        return new Intl.NumberFormat(locale, format).format(number);
    } catch {
        return String(number);
    }
}

function formatMoney(
    number: number,
    format: Intl.NumberFormatOptions,
    locale: string | undefined,
    currency: CurrencyDisplay,
): string {
    const parts = new Intl.NumberFormat(locale, {
        ...format,
        currencyDisplay: 'narrowSymbol',
    }).formatToParts(number);
    const symbol = parts.find((part) => part.type === 'currency')?.value ?? '';
    const sign = parts.find((part) => part.type === 'minusSign')?.value ?? '';
    const digits = parts
        .filter(
            (part) =>
                part.type !== 'currency' &&
                part.type !== 'minusSign' &&
                !(part.type === 'literal' && part.value.trim() === ''),
        )
        .map((part) => part.value)
        .join('');

    const code = format.currency?.toUpperCase() ?? '';

    switch (currency) {
        case 'code':
            return `${sign}${digits} ${code}`.trim();
        case 'both':
            return `${sign}${symbol}${digits} ${code}`.trim();
        case 'none':
            return `${sign}${digits}`;
        default:
            return `${sign}${symbol}${digits}`;
    }
}

export interface NumberCellParts {
    text: string;
    suffix?: string;
}

/**
 * Number cell split in the number and what goes after it, which the cell shows
 * smaller and muted: the currency code with `cell: 'code'` or `'both'` or the
 * unit of plain numbers (`->unit('kg')`). Without one, `text` is the whole
 * formatted value.
 */
export function formatNumberCell(
    meta: DataTableColumnMeta | undefined,
    value: unknown,
    locale?: string,
): NumberCellParts {
    const display = meta?.display?.type === 'number' ? meta.display : undefined;
    const format = display?.format;
    const cell = display?.currency?.cell;
    let suffix: string | undefined;

    if (toNumber(value) !== null) {
        if (format?.style === 'currency') {
            suffix =
                format.currencyDisplay === undefined &&
                (cell === 'code' || cell === 'both')
                    ? format.currency?.toUpperCase()
                    : undefined;
        } else if (format?.style === undefined) {
            suffix = getUnit(meta);
        }
    }

    if (!suffix) {
        return { text: formatCellValue(meta, value, locale) };
    }

    return {
        text: formatNumber(
            value,
            format,
            locale,
            cell === 'both' ? 'symbol' : 'none',
        ),
        suffix,
    };
}

export interface FilterAffix {
    text: string;
    align: 'inline-start' | 'inline-end';
}

/**
 * What goes next to the number inputs of a filter, which take the raw value:
 * the unit of plain numbers (`->unit('kg')`) after them or, for `->money()`,
 * the symbol before (`$`, by default), the code after (`CLP`) or both, as
 * chosen with `filter:`. Percentages and Intl units have none.
 */
export function getFilterAffixes(
    meta: DataTableColumnMeta | undefined,
): FilterAffix[] {
    const display = meta?.display?.type === 'number' ? meta.display : undefined;
    const format = display?.format;

    if (format?.style === 'currency' && format.currency) {
        const shown = display?.currency?.filter ?? 'symbol';
        const affixes: FilterAffix[] = [];

        if (shown === 'symbol' || shown === 'both') {
            const symbol = new Intl.NumberFormat(undefined, {
                ...format,
                currencyDisplay: 'narrowSymbol',
            })
                .formatToParts(0)
                .find((part) => part.type === 'currency')?.value;

            if (symbol) {
                affixes.push({ text: symbol, align: 'inline-start' });
            }
        }

        if (shown === 'code' || shown === 'both') {
            affixes.push({
                text: format.currency.toUpperCase(),
                align: 'inline-end',
            });
        }

        return affixes;
    }

    const unit =
        format?.style === undefined ? getUnit(meta, 'filter') : undefined;

    return unit ? [{ text: unit, align: 'inline-end' }] : [];
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
                formatNumber(
                    value,
                    display.format,
                    locale,
                    display.currency?.cell,
                ),
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
 * icon declared in the page `meta` (`meta.icons` or `meta.options`).
 */
export function getOption(
    meta: DataTableColumnMeta | undefined,
    value: string | number | boolean | null | undefined,
): ColumnSelectOption | undefined {
    const text = value === null || value === undefined ? '' : String(value);
    const options = meta && 'options' in meta ? meta.options : undefined;
    const option = options?.find((item) => item.value === text);
    const icon = meta?.icons?.[text];

    return icon && !option?.icon
        ? { value: text, label: text, ...option, icon }
        : option;
}

/**
 * Whether a cell has nothing to show: `null`, `undefined`, `''` or a list of
 * those.
 */
export function isEmptyValue(value: unknown): boolean {
    if (Array.isArray(value)) {
        return value.every(isEmptyValue);
    }

    return value === null || value === undefined || value === '';
}

/**
 * Name of the rows without a value in the filters: the text of
 * `->whenEmpty()` or the `no_value` text of the UI.
 */
export function getEmptyLabel(
    meta: DataTableColumnMeta | undefined,
    table?: TableWithMeta,
): string {
    return meta?.display?.empty || getMessage(table, 'no_value');
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
 * Unit of the column in the cells (and the filter label) or next to the filter
 * inputs: `->unit('kg', cell: false)` in PHP or `meta.unit` in the page.
 */
export function getUnit(
    meta: DataTableColumnMeta | undefined,
    place: 'cell' | 'filter' = 'cell',
): string | undefined {
    const display = meta?.display?.type === 'number' ? meta.display : undefined;

    if (display?.unit !== undefined) {
        return display.showUnit?.[place] === false ? undefined : display.unit;
    }

    return meta && 'unit' in meta ? meta.unit : undefined;
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
