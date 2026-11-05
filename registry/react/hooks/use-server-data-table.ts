import { router } from '@inertiajs/react';
import {
    functionalUpdate,
    type ColumnFiltersState,
    type ColumnVisibilityState,
    type PaginationState,
    type RowData,
    type SortingState,
    type TableOptions,
    type Updater,
    useTable,
} from '@tanstack/react-table';
import * as React from 'react';

import {
    dataTableFeatures,
    type DataTableFeatures,
} from '@/lib/data-table-features';
import {
    arrangeColumns,
    buildTableUrl,
    type ServerColumnConfig,
    type ServerDataTable,
    type ServerFacetOption,
    type ServerFilter,
    type ServerRangeFacet,
    type ServerTableConfig,
    type ServerTableState,
    stateToQuery,
} from '@/lib/data-table-server';
import type {
    ColumnSelectOption,
    DataTableColumnMeta,
} from '@/lib/data-table-types';
import { normalizeColumnFilter } from '@/lib/data-table-utils';

type DataTableColumns<TData extends RowData> = TableOptions<
    DataTableFeatures,
    TData
>['columns'];

type DataTableColumn<TData extends RowData> = DataTableColumns<TData>[number];

interface LocalTableState {
    pagination: PaginationState;
    sorting: SortingState;
    columnFilters: ColumnFiltersState;
    globalFilter: string;
    columnVisibility: ColumnVisibilityState;
}

export interface UseServerDataTableOptions<TData extends RowData> {
    /** Prop de Inertia con la respuesta del paquete laravel-inertia-datatable. */
    table: ServerDataTable<TData>;
    /** Nombre de esa prop: las visitas recargan solo esta prop (`only`). */
    prop: string;
    /** Columnas de TanStack; su `meta` se completa con lo que declara el servidor. */
    columns: DataTableColumns<TData>;
    /** Espera tras escribir un filtro o la búsqueda antes de pedir al servidor. */
    debounceMs?: number;
    getRowId?: TableOptions<DataTableFeatures, TData>['getRowId'];
}

/**
 * Tabla de TanStack en modo servidor: el estado vive en la URL y cada cambio
 * es una visita parcial de Inertia que devuelve la página ya procesada.
 */
export function useServerDataTable<TData extends RowData>({
    table: serverTable,
    prop,
    columns,
    debounceMs = 300,
    getRowId = getDefaultRowId,
}: UseServerDataTableOptions<TData>) {
    const { config, data, facets, meta, state: serverState } = serverTable;

    const [state, setState] = React.useState(() => toLocalState(serverState));
    const [syncedServerState, setSyncedServerState] =
        React.useState(serverState);
    const [draftVersion, setDraftVersion] = React.useState(0);
    const [sentVersion, setSentVersion] = React.useState(0);
    const [isLoading, setIsLoading] = React.useState(false);
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
    const chainRef = React.useRef<{
        base: LocalTableState;
        next: LocalTableState;
    } | null>(null);

    // Cada respuesta trae el estado normalizado: es la fuente de verdad. Si el
    // usuario siguió escribiendo después de la petición, se conservan sus
    // filtros y su búsqueda para no pisar lo que está tecleando.
    if (syncedServerState !== serverState) {
        setSyncedServerState(serverState);
        const fromServer = toLocalState(serverState);
        setState((current) =>
            draftVersion === sentVersion
                ? fromServer
                : {
                      ...fromServer,
                      columnFilters: current.columnFilters,
                      globalFilter: current.globalFilter,
                  },
        );
    }

    React.useEffect(() => () => clearTimeout(timeoutRef.current), []);

    function visit(next: LocalTableState, replace: boolean) {
        const pairs = stateToQuery(toQueryState(next, config), config);

        router.get(
            buildTableUrl(window.location.href, pairs, config.query),
            {},
            {
                only: [prop],
                preserveState: true,
                preserveScroll: true,
                replace,
                onStart: () => setIsLoading(true),
                onFinish: () => setIsLoading(false),
            },
        );
    }

    function visitNow(next: LocalTableState, replace = true) {
        clearTimeout(timeoutRef.current);
        setSentVersion(draftVersion);
        visit(next, replace);
    }

    function visitLater(next: LocalTableState, version: number) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setSentVersion(version);
            visit(next, true);
        }, debounceMs);
    }

    /**
     * Aplica un cambio sobre el último estado del mismo evento: varios setters
     * seguidos (por ejemplo, el botón Reset) no deben pisarse entre sí.
     */
    function update(
        change: (current: LocalTableState) => LocalTableState,
    ): LocalTableState {
        const pending = chainRef.current;
        const base = pending?.base === state ? pending.next : state;
        const next = change(base);
        chainRef.current = { base: state, next };
        setState(next);

        return next;
    }

    function onPaginationChange(updater: Updater<PaginationState>) {
        const next = update((current) => {
            const pagination = functionalUpdate(updater, current.pagination);

            return {
                ...current,
                pagination:
                    pagination.pageSize === current.pagination.pageSize
                        ? pagination
                        : { ...pagination, pageIndex: 0 },
            };
        });
        visitNow(next, next.pagination.pageSize !== state.pagination.pageSize);
    }

    function onSortingChange(updater: Updater<SortingState>) {
        const next = update((current) => ({
            ...current,
            sorting: functionalUpdate(updater, current.sorting),
            pagination: { ...current.pagination, pageIndex: 0 },
        }));
        visitNow(next);
    }

    function onColumnVisibilityChange(updater: Updater<ColumnVisibilityState>) {
        const next = update((current) => ({
            ...current,
            columnVisibility: functionalUpdate(
                updater,
                current.columnVisibility,
            ),
        }));
        visitNow(next);
    }

    function onColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
        const next = update((current) => ({
            ...current,
            columnFilters: functionalUpdate(updater, current.columnFilters),
            pagination: { ...current.pagination, pageIndex: 0 },
        }));
        const version = draftVersion + 1;
        setDraftVersion(version);
        visitLater(next, version);
    }

    function onGlobalFilterChange(updater: Updater<unknown>) {
        const next = update((current) => {
            const value = functionalUpdate(updater, current.globalFilter);

            return {
                ...current,
                globalFilter: typeof value === 'string' ? value : '',
                pagination: { ...current.pagination, pageIndex: 0 },
            };
        });
        const version = draftVersion + 1;
        setDraftVersion(version);
        visitLater(next, version);
    }

    const tableColumns = React.useMemo(
        () => withServerMeta(columns, config, facets),
        [columns, config, facets],
    );

    const table = useTable({
        features: dataTableFeatures,
        columns: tableColumns,
        data,
        getRowId,
        meta: {
            pageSizeOptions: config.per_page_options,
            searchable: config.searchable,
        },
        rowCount: meta.total,
        // Sin filas el servidor informa 1 página, no 0.
        pageCount: meta.last_page,
        state,
        onPaginationChange,
        onSortingChange,
        onColumnFiltersChange,
        onGlobalFilterChange,
        onColumnVisibilityChange,
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
    });

    return { table, isLoading };
}

function toLocalState(state: ServerTableState): LocalTableState {
    return {
        pagination: state.pagination,
        sorting: state.sorting,
        columnFilters: state.columnFilters,
        globalFilter: state.globalFilter,
        columnVisibility: state.columnVisibility,
    };
}

function toQueryState(state: LocalTableState, config: ServerTableConfig) {
    const variants = new Map(
        config.columns.map((column) => [column.id, column.variant]),
    );
    const filters: ServerFilter[] = [];

    for (const filter of state.columnFilters) {
        const variant = variants.get(filter.id);

        if (!variant) {
            continue;
        }

        const item = normalizeColumnFilter(filter, variant);

        // Fechas relativas a hoy: todavía no las soporta el servidor.
        if (item.operator === 'isRelativeToToday') {
            continue;
        }

        filters.push({
            id: item.id,
            variant,
            operator: item.operator,
            value: item.value,
        });
    }

    return {
        pageIndex: state.pagination.pageIndex,
        pageSize: state.pagination.pageSize,
        sorting: state.sorting,
        filters,
        globalFilter: state.globalFilter,
        columnVisibility: state.columnVisibility,
    };
}

/**
 * Ordena las columnas como la clase de la tabla y completa cada una con lo que
 * declara el servidor: etiqueta, variante de filtro, opciones con conteo,
 * límites del rango y capacidades. La `meta` que declare la página (por
 * ejemplo, iconos) tiene prioridad.
 */
function withServerMeta<TData extends RowData>(
    columns: DataTableColumns<TData>,
    config: ServerTableConfig,
    facets: ServerDataTable<TData>['facets'],
): DataTableColumns<TData> {
    const byId = new Map(config.columns.map((column) => [column.id, column]));
    const declared = new Set(columns.map(getColumnId));

    return arrangeColumns(
        columns,
        config.columns
            .map((column) => column.id)
            .filter((id) => declared.has(id)),
        {
            getId: getColumnId,
            isLeading: (column) =>
                (column.meta as DataTableColumnMeta | undefined)?.position ===
                'start',
            resolve: (id, column) => {
                const server = byId.get(id);

                return column && server
                    ? withColumnMeta(column, server, facets[id])
                    : (column as DataTableColumn<TData>);
            },
        },
    );
}

function withColumnMeta<TData extends RowData>(
    column: DataTableColumn<TData>,
    server: ServerColumnConfig,
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
): DataTableColumn<TData> {
    const userMeta = column.meta as DataTableColumnMeta | undefined;

    return {
        ...column,
        meta: {
            ...serverMeta(server, facet, userMeta),
            ...userMeta,
            ...mergedOptions(facet, userMeta),
        } as DataTableColumnMeta,
        enableSorting: column.enableSorting ?? server.sortable,
        enableColumnFilter:
            column.enableColumnFilter ?? server.variant !== null,
        enableHiding: column.enableHiding ?? server.hideable,
    };
}

function serverMeta(
    server: ServerColumnConfig,
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
    userMeta: DataTableColumnMeta | undefined,
): DataTableColumnMeta {
    const base = {
        label: server.label,
        placeholder: server.placeholder ?? undefined,
    };
    const unit = server.unit ?? undefined;

    switch (server.variant) {
        case 'text':
        case 'boolean':
            return { ...base, variant: server.variant };
        case 'number':
            return { ...base, variant: 'number', unit };
        case 'range': {
            const range = isRangeFacet(facet) ? facet : undefined;

            return {
                ...base,
                variant: 'number',
                filter: 'range',
                unit,
                min: range?.min ?? undefined,
                max: range?.max ?? undefined,
            };
        }
        case 'date':
            return { ...base, variant: 'date' };
        case 'date-range':
            return { ...base, variant: 'date', filter: 'range' };
        case 'select':
        case 'multi-select':
            return {
                ...base,
                variant: server.variant,
                options: toOptions(facet, userMeta),
            };
        default:
            return base;
    }
}

/**
 * Las opciones siempre llevan el conteo del servidor, aunque la página las
 * redeclare (por ejemplo, para añadir iconos).
 */
function mergedOptions(
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
    userMeta: DataTableColumnMeta | undefined,
): { options?: ColumnSelectOption[] } {
    return Array.isArray(facet) ? { options: toOptions(facet, userMeta) } : {};
}

function toOptions(
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
    userMeta: DataTableColumnMeta | undefined,
): ColumnSelectOption[] {
    if (!Array.isArray(facet)) {
        return [];
    }

    const declared =
        userMeta && 'options' in userMeta ? (userMeta.options ?? []) : [];

    return facet.map((option) => {
        const own = declared.find((item) => item.value === option.value);

        return {
            ...own,
            value: option.value,
            label: own?.label ?? option.label,
            count: option.count,
        };
    });
}

function isRangeFacet(
    facet: ServerFacetOption[] | ServerRangeFacet | undefined,
): facet is ServerRangeFacet {
    return facet !== undefined && !Array.isArray(facet);
}

function getColumnId<TData extends RowData>(
    column: DataTableColumn<TData>,
): string | undefined {
    if (column.id) {
        return column.id;
    }

    return 'accessorKey' in column && typeof column.accessorKey === 'string'
        ? column.accessorKey
        : undefined;
}

function getDefaultRowId<TData extends RowData>(
    row: TData,
    index: number,
): string {
    const id =
        typeof row === 'object' && row !== null && 'id' in row
            ? row.id
            : undefined;

    return typeof id === 'string' || typeof id === 'number'
        ? String(id)
        : String(index);
}

/**
 * Etiqueta de una opción (select / multi-select) tal como la declara el
 * servidor, para mostrar `Administrador` en lugar de `admin` en una celda.
 */
export function getOptionLabel(
    meta: DataTableColumnMeta | undefined,
    value: string | number | boolean | null | undefined,
): string {
    const text = value === null || value === undefined ? '' : String(value);
    const options = meta && 'options' in meta ? meta.options : undefined;

    return options?.find((option) => option.value === text)?.label ?? text;
}
