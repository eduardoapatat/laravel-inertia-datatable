import type { DataTableTableMeta } from '@/lib/data-table-types';

/**
 * Texts of the UI in English: the same keys as `lang/en/ui.php` of the
 * package. The server sends them translated to the app language in
 * `config.messages`, and `useServerDataTable({ messages })` changes any of them.
 */
export const DEFAULT_MESSAGES = {
    search: 'Search...',
    reset: 'Reset',
    reset_filters: 'Reset filters',
    view: 'View',
    view_columns: 'View columns',
    columns: 'Columns',
    search_columns: 'Search columns...',
    no_columns: 'No columns found.',

    no_results: 'No results.',
    loading: 'Loading table…',
    yes: 'Yes',
    no: 'No',
    empty: '—',
    no_value: 'No value',
    include: 'Include :label',

    sort_ascending: 'Asc',
    sort_descending: 'Desc',
    hide: 'Hide',

    filter: ':label filter',
    clear: 'Clear',
    clear_filter: 'Clear :label filter',
    clear_filters: 'Clear filters',
    no_options: 'No results found.',
    selected: ':count selected',
    from: 'From',
    to: 'to',
    min: 'Min',
    max: 'Max',
    minimum: ':label minimum value',
    maximum: ':label maximum value',
    slider: ':label slider',
    previous_month: 'Go to the previous month',
    next_month: 'Go to the next month',

    rows_per_page: 'Rows per page',
    page_of: 'Page :page of :pages',
    row_selected: ':count row selected.',
    rows_selected: ':count rows selected.',
    not_shown: '(:count not shown)',
    first_page: 'Go to first page',
    previous_page: 'Go to previous page',
    next_page: 'Go to next page',
    last_page: 'Go to last page',
};

export type DataTableMessageKey = keyof typeof DEFAULT_MESSAGES;

export type DataTableMessages = Record<DataTableMessageKey, string>;

type Replacements = Record<string, string | number>;

export interface TableWithMeta {
    options: { meta?: DataTableTableMeta };
}

/**
 * Text of the UI with its placeholders replaced: `getMessage(table, 'filter',
 * { label: 'Status' })` → `Status filter`. Without a text for the key, the
 * English one.
 */
export function getMessage(
    table: TableWithMeta | undefined,
    key: DataTableMessageKey,
    replacements: Replacements = {},
): string {
    return replacePlaceholders(
        table?.options.meta?.messages?.[key] ?? DEFAULT_MESSAGES[key],
        replacements,
    );
}

/**
 * Replaces `:name` with its value, longest names first so that `:page` does not
 * eat the start of `:pages`.
 */
export function replacePlaceholders(
    text: string,
    replacements: Replacements,
): string {
    return Object.keys(replacements)
        .sort((a, b) => b.length - a.length)
        .reduce(
            (result, name) =>
                result.replaceAll(`:${name}`, String(replacements[name])),
            text,
        );
}

/**
 * Texts of the table: the English ones, those of the server and those of the
 * page, in that order; unknown keys and empty values are ignored.
 */
export function mergeMessages(
    ...sources: Array<Partial<Record<string, string>> | null | undefined>
): DataTableMessages {
    const messages: DataTableMessages = { ...DEFAULT_MESSAGES };

    for (const source of sources) {
        for (const [key, value] of Object.entries(source ?? {})) {
            if (key in DEFAULT_MESSAGES && typeof value === 'string') {
                messages[key as DataTableMessageKey] = value;
            }
        }
    }

    return messages;
}

// Regions whose week starts on Sunday (CLDR); the rest, on Monday, except
// the ones of SATURDAY_REGIONS.
const SUNDAY_REGIONS = new Set(
    'AG AS BD BR BS BT BW BZ CA CN CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW'.split(
        ' ',
    ),
);
const SATURDAY_REGIONS = new Set(
    'AE AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'.split(' '),
);

type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface LocaleWithWeekInfo extends Intl.Locale {
    getWeekInfo?: () => { firstDay: number };
    weekInfo?: { firstDay: number };
}

/**
 * First day of the week of a locale (0 = Sunday), for the calendar: Monday in
 * `es-CL`, Sunday in `en-US`. Without a locale, the browser's.
 */
export function getWeekStartsOn(locale?: string): WeekDay {
    try {
        const resolved = new Intl.Locale(
            locale ?? new Intl.DateTimeFormat().resolvedOptions().locale,
        ) as LocaleWithWeekInfo;
        const firstDay =
            resolved.getWeekInfo?.().firstDay ?? resolved.weekInfo?.firstDay;

        if (firstDay !== undefined) {
            return (firstDay % 7) as WeekDay;
        }

        const region = resolved.maximize().region ?? '';

        if (SUNDAY_REGIONS.has(region)) {
            return 0;
        }

        return SATURDAY_REGIONS.has(region) ? 6 : 1;
    } catch {
        return 0;
    }
}
