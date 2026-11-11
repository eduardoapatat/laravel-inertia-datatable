import type { ServerTableConfig } from '@/lib/data-table-server';
import type {
    DataTableAlign,
    DataTableLoadingPhase,
} from '@/lib/data-table-types';

interface LoadingPhasesOptions {
    /** Before it, a fast response shows nothing (no flicker). */
    loadingDelay: number;
    /** After it, the rows become skeleton rows; `false` never. */
    skeletonDelay: number | false;
    onChange: (phase: DataTableLoadingPhase) => void;
    /** At once when the first visit starts and when the last one ends. */
    onActiveChange?: (active: boolean) => void;
}

/**
 * Timers of the loading state of the visits: `start()` when one begins (`busy`
 * after `loadingDelay`, `slow` after `skeletonDelay`), `finish()` when it ends
 * or is cancelled, `dispose()` on unmount. A visit that replaces another one
 * (the cancelled one finishes right before the new one starts) keeps the
 * state and its timers, so the indicator does not blink between both.
 */
export function createLoadingPhases({
    loadingDelay,
    skeletonDelay,
    onChange,
    onActiveChange,
}: LoadingPhasesOptions) {
    let timers: ReturnType<typeof setTimeout>[] = [];
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let phase: DataTableLoadingPhase = 'idle';
    let inFlight = 0;
    let active = false;

    function set(next: DataTableLoadingPhase) {
        if (next === phase) return;
        phase = next;
        onChange(next);
    }

    function clear() {
        timers.forEach((timer) => clearTimeout(timer));
        timers = [];
        clearTimeout(settleTimer);
        settleTimer = undefined;
    }

    return {
        start() {
            inFlight += 1;
            clearTimeout(settleTimer);
            settleTimer = undefined;

            if (active) return;

            active = true;
            onActiveChange?.(true);
            timers.push(
                setTimeout(() => set('busy'), Math.max(0, loadingDelay)),
            );

            if (skeletonDelay !== false) {
                timers.push(
                    setTimeout(
                        () => set('slow'),
                        Math.max(loadingDelay, skeletonDelay),
                    ),
                );
            }
        },
        finish() {
            inFlight = Math.max(0, inFlight - 1);

            if (inFlight > 0 || !active) return;

            // Wait a tick: the visit that replaces this one starts next.
            clearTimeout(settleTimer);
            settleTimer = setTimeout(() => {
                clear();
                active = false;
                onActiveChange?.(false);
                set('idle');
            }, 0);
        },
        dispose: clear,
    };
}

interface TypedTextState {
    globalFilter: string;
    columnFilters: { id: string; value: unknown }[];
}

/**
 * The state of a response, keeping the spaces around a text the user typed:
 * the server trims the search and the text filters, and writing its value
 * back into the input would eat the space before the next word.
 */
export function keepTypedSpaces<TState extends TypedTextState>(
    fromServer: TState,
    local: TypedTextState,
): TState {
    const typed = (server: unknown, mine: unknown) =>
        typeof server === 'string' &&
        typeof mine === 'string' &&
        mine !== server &&
        mine.trim() === server;

    return {
        ...fromServer,
        globalFilter: typed(fromServer.globalFilter, local.globalFilter)
            ? local.globalFilter
            : fromServer.globalFilter,
        columnFilters: fromServer.columnFilters.map((filter) => {
            const mine = local.columnFilters.find(({ id }) => id === filter.id);

            return typed(filter.value, mine?.value)
                ? { ...filter, value: mine?.value }
                : filter;
        }),
    };
}

export interface DataTableSkeletonShape {
    /** Visible columns, in the server order. */
    columns: {
        id: string;
        label: string;
        align: DataTableAlign;
        /** Its cells hold a badge, a bit taller than a line of text. */
        badge: boolean;
    }[];
    rowCount: number;
    /**
     * A control per column with a filter, also the hidden ones (their filter
     * shows): `input` for the text and number fields, `button` for the rest.
     */
    filters: ('input' | 'button')[];
    filterCount: number;
    searchable: boolean;
    label: string | undefined;
}

/**
 * Shape of the first-load skeleton from the table config (`->config()` in
 * PHP), so it looks like the table that is coming. `search` is the query
 * string of the page (`window.location.search`): its page size and visible
 * columns win over the defaults, with the rules of the server.
 */
export function getSkeletonShape(
    config: ServerTableConfig,
    search = '',
): DataTableSkeletonShape {
    const params = new URLSearchParams(search);
    const perPage = Number(params.get(config.query.per_page));
    // Like the server: an empty list is no list, and the ids are trimmed.
    const columns = params.get(config.query.columns)?.trim();
    const visible = columns
        ? columns.split(',').map((id) => id.trim())
        : undefined;
    const filters = config.columns.flatMap((column) =>
        column.filter
            ? [
                  column.filter.variant === 'text' ||
                  column.filter.variant === 'number'
                      ? ('input' as const)
                      : ('button' as const),
              ]
            : [],
    );

    return {
        columns: config.columns
            .filter((column) =>
                visible
                    ? !column.hideable || visible.includes(column.id)
                    : column.visible,
            )
            .map(({ id, label, display }) => ({
                id,
                label,
                align: display.type === 'number' ? 'end' : 'start',
                badge: 'badge' in display && display.badge === true,
            })),
        rowCount: config.per_page_options.includes(perPage)
            ? perPage
            : config.per_page,
        filters,
        filterCount: filters.length,
        searchable: config.searchable,
        label: config.messages?.loading,
    };
}
