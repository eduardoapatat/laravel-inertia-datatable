// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { Cell, ColumnFilter, RowData } from '@tanstack/react-table';

import type { DataTableFeatures } from '@/lib/data-table-features';
import type { DataTableMessages } from '@/lib/data-table-messages';
import type {
    CurrencyDisplay,
    FilterOperator,
    FilterVariant,
    ServerColumnDisplay,
} from '@/lib/data-table-server';

export interface ColumnSelectOption {
    label: string;
    value: string;
    count?: number;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
}

export type PlainColumnVariant = 'text' | 'boolean';

export interface ColumnVariantOptions {
    number: {
        filter?: 'range';
        min?: number;
        max?: number;
        unit?: string;
    };
    date: {
        filter?: 'range';
    };
    select: {
        options?: ColumnSelectOption[];
    };
    'multi-select': {
        options?: ColumnSelectOption[];
    };
}

export type ColumnVariantMeta =
    | { variant?: PlainColumnVariant }
    | {
          [TVariant in keyof ColumnVariantOptions]: {
              variant: TVariant;
          } & ColumnVariantOptions[TVariant];
      }[keyof ColumnVariantOptions];

/**
 * Loading state of a visit: `busy` after `loadingDelay` (rows dimmed),
 * `slow` after `skeletonDelay` (skeleton rows), `idle` otherwise.
 */
export type DataTableLoadingPhase = 'idle' | 'busy' | 'slow';

/**
 * Table meta: server data the components need (pagination and toolbar)
 * without every page having to pass it.
 */
export interface DataTableTableMeta {
    pageSizeOptions?: number[];
    /** Loading state of the visit in flight (`useServerDataTable`). */
    loading?: DataTableLoadingPhase;
    searchable?: boolean;
    /** Locale to format numbers and dates; the browser's when missing. */
    locale?: string;
    /** Format of the date cells without `->format()`; `long` by default. */
    dateFormat?: DatePreset;
    /** Texts of the UI (see `getMessage`); the English ones when missing. */
    messages?: Partial<DataTableMessages>;
}

/**
 * How the cells of a column are displayed: declared in PHP (`->money('CLP')`)
 * or in the page `meta`, which wins.
 */
export type ColumnDisplay = ServerColumnDisplay;

export type { CurrencyDisplay, FilterOperator, FilterVariant };

export type DatePreset = Extract<
    Extract<ColumnDisplay, { type: 'date' }>['format'],
    string
>;

export type DataTableAlign = 'start' | 'center' | 'end';

export type DataTableCellClassName = (
    cell: Cell<DataTableFeatures, RowData>,
) => string | false | null | undefined;

export type DataTableColumnMeta = {
    label?: string;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
    placeholder?: string;
    /**
     * Position of a column that does not exist in the table class (e.g.
     * selection or actions): at the end unless `'start'` is given.
     */
    position?: 'start' | 'end';
    display?: ColumnDisplay;
    /**
     * Icon per value, shown in the filter list and in the cells of option and
     * boolean columns (`true` / `false`): `{ active: CircleCheck }`. The labels
     * and badge variants still come from PHP.
     */
    icons?: Record<string, React.ComponentType<React.ComponentProps<'svg'>>>;
    /**
     * Tailwind classes of the header and the cells, for example a responsive
     * width (`w-40 md:w-80`, over `size`) or `text-right`.
     */
    className?: string;
    /** Classes of the header only. */
    headerClassName?: string;
    /**
     * Classes of the cells only, or a function of each cell for classes that
     * depend on its value: `(cell) => Number(cell.getValue()) < 100 && 'text-red-600'`
     * (`cell.row.original` is the row).
     */
    cellClassName?: string | DataTableCellClassName;
    /**
     * Alignment of the header and the cells, together so they always line up:
     * `end` for number columns and `start` for the rest by default.
     */
    align?: DataTableAlign;
    /**
     * The filter also offers the rows without a value (`empty: true` in
     * PHP), added with OR to what is picked.
     */
    empty?: boolean;
    /** Rows without a value, for the filter list (from the server facets). */
    emptyCount?: number;
} & ColumnVariantMeta;

export interface ColumnFilterItem<
    TColumnId extends string = string,
> extends ColumnFilter {
    id: TColumnId;
    value: string | string[];
    variant: FilterVariant;
    operator: FilterOperator;
    filterId: string;
}

declare module '@tanstack/react-table' {
    interface ColumnFilter extends Partial<
        Pick<ColumnFilterItem, 'operator' | 'variant' | 'filterId'>
    > {}
}
