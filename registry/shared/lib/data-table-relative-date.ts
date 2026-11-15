import type { DataTableMessageKey } from '@/lib/data-table-messages';

/**
 * Tokens of the `rel` operator (`filter[published_at]=rel.-7d`): days relative
 * to today that the server resolves on each request (docs/contract.md §1.4).
 * The client never turns them into dates: it shows their label and the `range`
 * the server answered with.
 */

/** Tokens offered by the filter list and the date filter with `presets`. */
export const RELATIVE_DATE_PRESETS = [
    'today',
    'yesterday',
    '-7d',
    '-30d',
    'this-week',
    'last-week',
    'this-month',
    'last-month',
    'this-quarter',
    'this-year',
    'last-year',
] as const;

const DAY_MESSAGES: Record<string, DataTableMessageKey> = {
    today: 'relative_today',
    yesterday: 'relative_yesterday',
    tomorrow: 'relative_tomorrow',
};

const PERIOD_MESSAGES: Record<string, DataTableMessageKey> = {
    'this-week': 'relative_this_week',
    'last-week': 'relative_last_week',
    'next-week': 'relative_next_week',
    'this-month': 'relative_this_month',
    'last-month': 'relative_last_month',
    'next-month': 'relative_next_month',
    'this-quarter': 'relative_this_quarter',
    'last-quarter': 'relative_last_quarter',
    'next-quarter': 'relative_next_quarter',
    'this-year': 'relative_this_year',
    'last-year': 'relative_last_year',
    'next-year': 'relative_next_year',
};

/** Largest N of each unit (about ten years), as `RelativeDate` in PHP. */
const MAX_COUNT = { d: 3660, w: 522, m: 120, y: 10 } as const;

const ROLLING = /^([+-])(\d{1,6})([dwmy])$/;

/**
 * The token in its canonical form (`-07D` → `-7d`, N clamped), or `null` when
 * it is not a relative date: the same rules as the server.
 */
export function normalizeRelativeDate(value: string): string | null {
    const token = value.trim().toLowerCase();

    if (
        Object.hasOwn(DAY_MESSAGES, token) ||
        Object.hasOwn(PERIOD_MESSAGES, token)
    ) {
        return token;
    }

    const match = ROLLING.exec(token);

    if (!match) return null;

    const [, sign, count, unit] = match as unknown as [
        string,
        '+' | '-',
        string,
        keyof typeof MAX_COUNT,
    ];

    return `${sign}${Math.max(1, Math.min(MAX_COUNT[unit], Number(count)))}${unit}`;
}

/**
 * Text of a token: the name of a period (`This month`) or its count
 * (`Past 45 days`). Weeks are told in days (`-2w` = `Past 14 days`, the same
 * range) and one day is today. Months and years use the `singular|plural`
 * text. An unknown token is shown as written.
 */
export function getRelativeDateLabel(
    value: string,
    message: (
        key: DataTableMessageKey,
        replacements?: Record<string, string | number>,
    ) => string,
): string {
    const token = normalizeRelativeDate(value);

    if (token === null) return value;

    const named = DAY_MESSAGES[token] ?? PERIOD_MESSAGES[token];

    if (named) return message(named);

    const [, sign, count, unit] = ROLLING.exec(token) as unknown as [
        string,
        '+' | '-',
        string,
        keyof typeof MAX_COUNT,
    ];
    const past = sign === '-';
    let amount = Number(count);

    if (unit === 'd' || unit === 'w') {
        amount *= unit === 'w' ? 7 : 1;

        if (amount === 1) return message('relative_today');

        return message(past ? 'relative_past_days' : 'relative_next_days', {
            count: amount,
        });
    }

    const key: DataTableMessageKey =
        unit === 'm'
            ? past
                ? 'relative_past_months'
                : 'relative_next_months'
            : past
              ? 'relative_past_years'
              : 'relative_next_years';
    const [singular = '', plural = singular] = message(key, {
        count: amount,
    }).split('|');

    return amount === 1 ? singular : plural;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The days of a `rel` filter as the server resolved them (`9–15 nov 2026`),
 * or `''` without them. They are calendar days: formatted in UTC, so the
 * server render and the browser show the same text.
 */
export function formatRelativeDateRange(
    range: readonly [string, string] | undefined,
    locale?: string,
): string {
    const [start, end] = (range ?? []).map((day) => {
        const match = DAY.exec(day);

        return match
            ? new Date(
                  Date.UTC(
                      Number(match[1]),
                      Number(match[2]) - 1,
                      Number(match[3]),
                  ),
              )
            : undefined;
    });

    if (!start || !end) return '';

    try {
        return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
        }).formatRange(start, end);
    } catch {
        return `${range?.[0]} – ${range?.[1]}`;
    }
}
