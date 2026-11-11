/**
 * Contract between the DataTable and the eduardoapatat/laravel-inertia-datatable package.
 *
 * Plain TypeScript, without React, Vue or Inertia dependencies: types of the
 * server response and conversion of the table state to a query string.
 * See docs/contract.md in the package.
 */

export type FilterVariant =
    | 'text'
    | 'number'
    | 'range'
    | 'date'
    | 'date-range'
    | 'boolean'
    | 'select'
    | 'multi-select';

export type FilterOperator =
    | 'iLike'
    | 'notILike'
    | 'eq'
    | 'ne'
    | 'inArray'
    | 'notInArray'
    | 'isEmpty'
    | 'isNotEmpty'
    | 'lt'
    | 'lte'
    | 'gt'
    | 'gte'
    | 'isBetween';

export interface ServerSort {
    id: string;
    desc: boolean;
}

export interface ServerFilter {
    id: string;
    filterId?: string;
    variant: FilterVariant;
    operator: FilterOperator;
    value: string | string[];
}

/**
 * How the currency of `->money()` is shown: the symbol before the number
 * (`$1.234`, by default), the code after it (`1.234 CLP`), both
 * (`$1.234 CLP`) or nothing (`1.234`).
 */
export type CurrencyDisplay = 'symbol' | 'code' | 'both' | 'none';

/**
 * How the cells of a column are displayed; `type` is the type of the column
 * (`Column::number()`, `Column::date()`…). Formats are Intl options, applied on
 * the client with the table locale.
 */
export type ServerColumnDisplay = (
    | {
          type: 'number';
          format?: Intl.NumberFormatOptions;
          /** Unit after plain numbers (`->unit('kg')`). */
          unit?: string;
          /**
           * Where the unit is hidden: in the cells (and the filter label) or
           * next to the filter inputs; shown when missing.
           */
          showUnit?: { cell?: false; filter?: false };
          /**
           * Currency of `->money()` in the cells (and the filter label) and
           * next to the filter inputs; `symbol` when missing.
           */
          currency?: { cell?: CurrencyDisplay; filter?: CurrencyDisplay };
      }
    | {
          type: 'date';
          /** Without it, the date format of the table. */
          format?:
              | 'short'
              | 'medium'
              | 'long'
              | 'datetime'
              | 'relative'
              | Intl.DateTimeFormatOptions;
      }
    | { type: 'text'; limit?: number; link?: 'url' | 'email' }
    | {
          type: 'boolean';
          labels?: { true: string; false: string };
          /** Labels with the project's shadcn Badge. */
          badge?: boolean;
          /** Badge variant of the column (`outline` by default). */
          variant?: string;
          /** Badge variant of `true` and `false`. */
          variants?: { true?: string; false?: string };
      }
    | {
          type: 'option';
          /** Labels with the project's shadcn Badge. */
          badge?: boolean;
          /** Badge variant of the column (`outline` by default). */
          variant?: string;
          /** Badge variant per option value. */
          variants?: Record<string, string>;
      }
) & {
    /**
     * Text of the cells without a value (`->whenEmpty()`); without it, the
     * `empty` message (`—`).
     */
    empty?: string;
};

/** Filter of a column (`->filterInput()`, `->filterSelect()`, `->filterRange()`…). */
export interface ServerColumnFilter {
    variant: FilterVariant;
    placeholder?: string;
    /** The filter also offers the rows without a value (`empty: true`). */
    empty?: true;
}

export interface ServerColumnConfig {
    id: string;
    label: string;
    sortable: boolean;
    hideable: boolean;
    visible: boolean;
    display: ServerColumnDisplay;
    /** Null: the column has no filter. */
    filter: ServerColumnFilter | null;
}

export interface ServerFacetOption {
    /** `null`: the rows without a value, last, with `empty: true`. */
    value: string | null;
    label: string;
    count?: number;
}

export interface ServerRangeFacet {
    min: number | null;
    max: number | null;
}

export interface ServerQueryKeys {
    page: string;
    per_page: string;
    sort: string;
    filter: string;
    search: string;
    columns: string;
}

export interface ServerTableConfig {
    columns: ServerColumnConfig[];
    searchable: boolean;
    /** Locale to format numbers and dates (table, config or app); null uses the browser's. */
    locale?: string | null;
    /** Preset of the date columns without their own format. */
    date_format?: 'short' | 'medium' | 'long' | 'datetime' | 'relative';
    /** UI texts in the app language (lang/vendor/inertia-datatable). */
    messages?: Record<string, string>;
    per_page: number;
    per_page_options: number[];
    default_sorting: ServerSort[];
    query: ServerQueryKeys;
}

export interface ServerTableState {
    pagination: { pageIndex: number; pageSize: number };
    sorting: ServerSort[];
    columnFilters: ServerFilter[];
    globalFilter: string;
    columnVisibility: Record<string, boolean>;
}

/**
 * Package response: the Inertia prop (or the JSON) of a table.
 */
export interface ServerDataTable<TData> {
    data: TData[];
    meta: {
        current_page: number;
        per_page: number;
        last_page: number;
        total: number;
        from: number | null;
        to: number | null;
    };
    state: ServerTableState;
    facets: Record<string, ServerFacetOption[] | ServerRangeFacet>;
    config: ServerTableConfig;
}

/**
 * Table state to put in the URL.
 */
export interface TableQueryState {
    pageIndex: number;
    pageSize: number;
    sorting: ServerSort[];
    filters: ServerFilter[];
    globalFilter: string;
    columnVisibility: Record<string, boolean>;
}

export const FILTER_OPERATOR_URL_NAMES = {
    iLike: 'ilike',
    notILike: 'not.ilike',
    eq: 'eq',
    ne: 'neq',
    inArray: 'in',
    notInArray: 'not.in',
    isEmpty: 'is.empty',
    isNotEmpty: 'not.is.empty',
    lt: 'lt',
    lte: 'lte',
    gt: 'gt',
    gte: 'gte',
    isBetween: 'between',
} as const satisfies Record<FilterOperator, string>;

const IMPLICIT_OPERATORS: Record<FilterVariant, FilterOperator> = {
    text: 'iLike',
    number: 'eq',
    range: 'isBetween',
    date: 'eq',
    'date-range': 'isBetween',
    boolean: 'eq',
    select: 'inArray',
    'multi-select': 'inArray',
};

const LIST_OPERATORS = new Set<FilterOperator>([
    'inArray',
    'notInArray',
    'isBetween',
]);

const VALUELESS_OPERATORS = new Set<FilterOperator>(['isEmpty', 'isNotEmpty']);

/**
 * Names the server accepts as an operator (URL form and key).
 */
const OPERATOR_NAMES = Object.entries(FILTER_OPERATOR_URL_NAMES).flatMap(
    ([key, urlName]) => [key.toLowerCase(), urlName],
);

/**
 * `[{ id: 'created_at', desc: true }, { id: 'name', desc: false }]` → `-created_at,name`.
 */
export function serializeSorting(sorting: ServerSort[]): string {
    return sorting
        .map((sort) => (sort.desc ? `-${sort.id}` : sort.id))
        .join(',');
}

/**
 * Value of `filter[<col>]` with the `[<operator>.]<value>` syntax.
 * Returns `null` when the filter has no value (it must not go in the URL).
 */
export function serializeFilter(filter: ServerFilter): string | null {
    const urlName = FILTER_OPERATOR_URL_NAMES[filter.operator];

    if (VALUELESS_OPERATORS.has(filter.operator)) {
        return urlName;
    }

    const raw = LIST_OPERATORS.has(filter.operator)
        ? serializeList(filter)
        : serializeSingle(filter.value);

    if (raw === null) {
        return null;
    }

    const isImplicit = filter.operator === IMPLICIT_OPERATORS[filter.variant];

    return isImplicit && !startsWithOperatorName(raw)
        ? raw
        : `${urlName}.${raw}`;
}

/**
 * Query string `[key, value]` pairs for the given state. Leaves out whatever
 * matches the default so URLs stay clean.
 */
export function stateToQuery(
    state: TableQueryState,
    config: ServerTableConfig,
): Array<[string, string]> {
    const keys = config.query;
    const pairs: Array<[string, string]> = [];

    if (state.pageIndex > 0) {
        pairs.push([keys.page, String(state.pageIndex + 1)]);
    }

    if (state.pageSize !== config.per_page) {
        pairs.push([keys.per_page, String(state.pageSize)]);
    }

    if (state.sorting.length > 0) {
        pairs.push([keys.sort, serializeSorting(state.sorting)]);
    }

    pairs.push(...filterPairs(state.filters, keys.filter));

    const search = state.globalFilter.trim();

    if (search !== '') {
        pairs.push([keys.search, search]);
    }

    const visible = visibleColumns(state.columnVisibility, config.columns);
    const defaults = config.columns
        .filter((column) => column.visible)
        .map((column) => column.id);

    if (visible.join(',') !== defaults.join(',')) {
        pairs.push([keys.columns, visible.join(',')]);
    }

    return pairs;
}

/**
 * URL with the table state, keeping the parameters that are not its own
 * (other tables on the page, the screen's own filters…).
 */
export function buildTableUrl(
    href: string,
    pairs: Array<[string, string]>,
    keys: ServerQueryKeys,
): string {
    const url = new URL(href);
    const kept = [...url.searchParams.entries()].filter(
        ([key]) => !isTableQueryKey(key, keys),
    );
    const query = [...kept, ...pairs]
        .map(([key, value]) => `${encodeKey(key)}=${encodeValue(value)}`)
        .join('&');

    return `${url.pathname}${query === '' ? '' : `?${query}`}${url.hash}`;
}

export interface ArrangeColumnsOptions<T> {
    /** Id of the client column, if it has one. */
    getId: (column: T) => string | undefined;
    /** Client-only columns that go first (e.g. the selection column). */
    isLeading: (column: T) => boolean;
    /** Final column for a server id; receives the client one if it exists. */
    resolve: (id: string, column: T | undefined) => T;
}

/**
 * The table class decides which columns exist and in which order: every server
 * column appears in its order, using the client column with the same id if it
 * exists. Client-only columns go at the end, except the ones marked as leading.
 */
export function arrangeColumns<T>(
    clientColumns: readonly T[],
    serverIds: readonly string[],
    { getId, isLeading, resolve }: ArrangeColumnsOptions<T>,
): T[] {
    const server = new Set(serverIds);
    const byId = new Map<string, T>();
    const leading: T[] = [];
    const trailing: T[] = [];

    for (const column of clientColumns) {
        const id = getId(column);

        if (id !== undefined && server.has(id)) {
            byId.set(id, column);
        } else if (isLeading(column)) {
            leading.push(column);
        } else {
            trailing.push(column);
        }
    }

    return [
        ...leading,
        ...serverIds.map((id) => resolve(id, byId.get(id))),
        ...trailing,
    ];
}

export function isTableQueryKey(key: string, keys: ServerQueryKeys): boolean {
    return (
        key === keys.page ||
        key === keys.per_page ||
        key === keys.sort ||
        key === keys.search ||
        key === keys.columns ||
        key === keys.filter ||
        key.startsWith(`${keys.filter}[`)
    );
}

function filterPairs(
    filters: ServerFilter[],
    filterKey: string,
): Array<[string, string]> {
    const byColumn = new Map<string, string[]>();

    for (const filter of filters) {
        const value = serializeFilter(filter);

        if (value === null) {
            continue;
        }

        byColumn.set(filter.id, [...(byColumn.get(filter.id) ?? []), value]);
    }

    return [...byColumn.entries()].flatMap(([id, values]) =>
        values.length === 1
            ? [[`${filterKey}[${id}]`, values[0] ?? ''] as [string, string]]
            : values.map(
                  (value) =>
                      [`${filterKey}[${id}][]`, value] as [string, string],
              ),
    );
}

function visibleColumns(
    visibility: Record<string, boolean>,
    columns: ServerColumnConfig[],
): string[] {
    return columns
        .filter(
            (column) =>
                !column.hideable || (visibility[column.id] ?? column.visible),
        )
        .map((column) => column.id);
}

function serializeList(filter: ServerFilter): string | null {
    const values = Array.isArray(filter.value) ? filter.value : [filter.value];

    if (filter.operator === 'isBetween') {
        const [from = '', to = ''] = values;

        return from === '' && to === '' ? null : joinList([from, to]);
    }

    const present = values.filter((value) => value !== '');

    return present.length === 0 ? null : joinList(present);
}

function serializeSingle(value: string | string[]): string | null {
    const single = Array.isArray(value) ? (value[0] ?? '') : value;

    return single.trim() === '' ? null : single;
}

/**
 * Comma-separated list; values with commas, quotes or surrounding spaces are
 * quoted, doubling the inner quotes.
 */
function joinList(values: string[]): string {
    return values
        .map((value) =>
            /[,"]/.test(value) || value !== value.trim()
                ? `"${value.replaceAll('"', '""')}"`
                : value,
        )
        .join(',');
}

function startsWithOperatorName(raw: string): boolean {
    const lower = raw.toLowerCase();

    return OPERATOR_NAMES.some(
        (name) => lower === name || lower.startsWith(`${name}.`),
    );
}

/**
 * Brackets and commas are kept readable: they are valid in a query string.
 */
function encodeKey(key: string): string {
    return encodeURIComponent(key)
        .replaceAll('%5B', '[')
        .replaceAll('%5D', ']');
}

function encodeValue(value: string): string {
    return encodeURIComponent(value).replaceAll('%2C', ',');
}
