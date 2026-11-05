/**
 * Contrato entre el DataTable y el paquete eduardoapatat/laravel-inertia-datatable.
 *
 * TypeScript puro, sin dependencias de React, Vue ni Inertia: tipos de la
 * respuesta del servidor y conversión del estado de la tabla a query string.
 * Ver docs/contract.md del paquete.
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

export interface ServerColumnConfig {
    id: string;
    label: string;
    sortable: boolean;
    variant: FilterVariant | null;
    placeholder: string | null;
    unit: string | null;
    hideable: boolean;
    visible: boolean;
}

export interface ServerFacetOption {
    value: string;
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
 * Respuesta del paquete: la prop de Inertia (o el JSON) de una tabla.
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
 * Estado de la tabla que se quiere llevar a la URL.
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
 * Nombres que el servidor acepta como operador (forma de URL y clave).
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
 * Valor de `filter[<col>]` con la sintaxis `[<operador>.]<valor>`.
 * Devuelve `null` si el filtro no tiene valor (no debe ir en la URL).
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
 * Pares `[clave, valor]` del query string para el estado dado. Omite lo que
 * coincide con el valor por defecto para que las URLs queden limpias.
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
 * URL con el estado de la tabla, conservando los parámetros que no son suyos
 * (otras tablas de la página, filtros propios de la pantalla…).
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
    /** Id de la columna del cliente, si lo tiene. */
    getId: (column: T) => string | undefined;
    /** Columnas solo de cliente que van al principio (p. ej. la de selección). */
    isLeading: (column: T) => boolean;
    /** Columna final para un id del servidor; recibe la del cliente si existe. */
    resolve: (id: string, column: T | undefined) => T;
}

/**
 * La clase de la tabla decide qué columnas hay y en qué orden: cada columna del
 * servidor aparece en su orden, usando la del cliente con el mismo id si existe.
 * Las columnas que solo existen en el cliente van al final, salvo las marcadas
 * como iniciales.
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
 * Lista separada por comas; entre comillas los valores con coma, comillas o
 * espacios en los extremos, duplicando las comillas internas.
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
 * Corchetes y comas se dejan legibles: son válidos en un query string.
 */
function encodeKey(key: string): string {
    return encodeURIComponent(key)
        .replaceAll('%5B', '[')
        .replaceAll('%5D', ']');
}

function encodeValue(value: string): string {
    return encodeURIComponent(value).replaceAll('%2C', ',');
}
