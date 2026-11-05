// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type {
    ColumnFilter,
    ColumnSort,
    Row,
    RowData,
} from '@tanstack/react-table';

import type { DataTableFeatures } from '@/lib/data-table-features';
import type { DataTableMessages } from '@/lib/data-table-messages';
import type { ServerColumnDisplay } from '@/lib/data-table-server';
import type {
    FILTER_OPERATORS,
    FILTER_VARIANTS,
    JOIN_OPERATORS,
} from '@/lib/data-table-utils';

export interface ColumnSelectOption {
    label: string;
    value: string;
    count?: number;
    icon?: React.ComponentType<React.ComponentProps<'svg'>>;
}

export type PlainColumnVariant =
    | 'text'
    | 'long-text'
    | 'url'
    | 'boolean'
    | 'file';

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

export type ColumnVariant = PlainColumnVariant | keyof ColumnVariantOptions;

export type ColumnVariantMeta =
    | { variant?: PlainColumnVariant }
    | {
          [TVariant in keyof ColumnVariantOptions]: {
              variant: TVariant;
          } & ColumnVariantOptions[TVariant];
      }[keyof ColumnVariantOptions];

/**
 * Table meta: server data the components need (pagination and toolbar)
 * without every page having to pass it.
 */
export interface DataTableTableMeta {
    pageSizeOptions?: number[];
    searchable?: boolean;
    /** Locale to format numbers and dates; the browser's when missing. */
    locale?: string;
    /** Format of the date cells without `->dateFormat()`; `long` by default. */
    dateFormat?: DatePreset;
    /** Texts of the UI (see `getMessage`); the English ones when missing. */
    messages?: Partial<DataTableMessages>;
}

/**
 * How the cells of a column are displayed: declared in PHP (`->money('CLP')`)
 * or in the page `meta`, which wins.
 */
export type ColumnDisplay = ServerColumnDisplay;

export type DatePreset = Extract<
    Extract<ColumnDisplay, { type: 'date' }>['format'],
    string
>;

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
     * Tailwind classes of the header and the cells, for example a responsive
     * width (`w-40 md:w-80`, over `size`) or `text-right`.
     */
    className?: string;
    /** Classes of the header only. */
    headerClassName?: string;
    /** Classes of the cells only. */
    cellClassName?: string;
} & ColumnVariantMeta;

export type FilterVariant = (typeof FILTER_VARIANTS)[number];
export type FilterOperator = keyof typeof FILTER_OPERATORS;
export type JoinOperator = (typeof JOIN_OPERATORS)[number];

export interface FilterOperatorOption {
    label: string;
    value: FilterOperator;
}

export interface ColumnSortItem<
    TColumnId extends string = string,
> extends ColumnSort {
    id: TColumnId;
}

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

export type DataTableColumnConfig = {
    isSortable?: boolean;
} & ColumnVariantMeta;

export type DataTableColumnConfigs = Record<string, DataTableColumnConfig>;

export type FilterableColumnId<TColumnConfigs extends DataTableColumnConfigs> =
    {
        [K in keyof TColumnConfigs]: TColumnConfigs[K] extends {
            variant: ColumnVariant;
        }
            ? K
            : never;
    }[keyof TColumnConfigs] &
        string;

export type SortableColumnId<TColumnConfigs extends DataTableColumnConfigs> = {
    [K in keyof TColumnConfigs]: TColumnConfigs[K] extends { isSortable: false }
        ? never
        : K;
}[keyof TColumnConfigs] &
    string;

export interface DataTableQueryKeys {
    page: string;
    perPage: string;
    sort: string;
    joinOperator: string;
}

export interface DataTableQuery<
    TFilterColumnId extends string = string,
    TSortColumnId extends string = TFilterColumnId,
> {
    page: number;
    perPage: number;
    sorting: ColumnSortItem<TSortColumnId>[];
    filters: ColumnFilterItem<TFilterColumnId>[];
    joinOperator: JoinOperator;
}

export type DataTableColumnConfigsQuery<
    TColumnConfigs extends DataTableColumnConfigs,
> = DataTableQuery<
    FilterableColumnId<TColumnConfigs>,
    SortableColumnId<TColumnConfigs>
>;

export interface DataTableRowAction<TData extends RowData> {
    row: Row<DataTableFeatures, TData>;
    variant: 'update' | 'delete';
}
