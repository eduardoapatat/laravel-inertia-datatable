'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    type Column,
    type ReactTable,
    type RowData,
    Subscribe,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import * as React from 'react';

import type { DataTableFeatures } from '@/lib/data-table-features';
import { getMessage } from '@/lib/data-table-messages';

import { useDataTable } from '@/components/data-table/data-table-context';
import { DataTableDateFilter } from '@/components/data-table/data-table-date-filter';
import {
    DataTableBooleanFilter,
    DataTableFacetedFilter,
} from '@/components/data-table/data-table-faceted-filter';
import {
    DataTableNumberFilter,
    DataTableTextFilter,
} from '@/components/data-table/data-table-input-filter';
import { DataTableSliderFilter } from '@/components/data-table/data-table-slider-filter';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

interface DataTableToolbarProps<
    TData extends RowData,
> extends React.ComponentProps<'div'> {
    /** Not needed inside `DataTableProvider`. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    /** Shows the global search; by default, when the server allows it. */
    searchable?: boolean;
    searchPlaceholder?: string;
}

/**
 * Default layout: search, filters and Reset on the left; `children` and the
 * column menu on the right. For another layout, place the pieces yourself
 * (`DataTableSearch`, `DataTableFilters`, `DataTableFilter`, the filters of
 * each type, `DataTableResetButton`, `DataTableViewOptions`), anywhere inside a
 * `DataTableProvider`.
 */
export function DataTableToolbar<TData extends RowData>({
    table: tableProp,
    searchable,
    searchPlaceholder,
    children,
    className,
    ...props
}: DataTableToolbarProps<TData>) {
    const table = useDataTable(tableProp, 'DataTableToolbar');

    return (
        <div
            data-slot="data-table-toolbar"
            className={cn(
                'flex w-full items-start justify-between gap-2 p-1',
                className,
            )}
            {...props}
        >
            <div className="flex flex-1 flex-wrap items-center gap-2">
                <DataTableSearch
                    table={table}
                    searchable={searchable}
                    placeholder={searchPlaceholder}
                    className="lg:w-64"
                />
                <DataTableFilters table={table} />
                <DataTableResetButton table={table} />
            </div>
            <div className="flex items-center gap-2">
                {children}
                <DataTableViewOptions
                    table={table}
                    align="end"
                    className="ms-auto hidden lg:flex"
                />
            </div>
        </div>
    );
}

interface DataTableSearchProps<
    TData extends RowData,
> extends React.ComponentProps<'input'> {
    /** Not needed inside `DataTableProvider`. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    /** Shows the global search; by default, when the server allows it. */
    searchable?: boolean;
}

/**
 * Global search (`?search=`). Hidden when the table class declares no
 * `searchable()` column, unless forced with `searchable`.
 */
export function DataTableSearch<TData extends RowData>({
    table: tableProp,
    searchable,
    placeholder: placeholderProp,
    className,
    ...props
}: DataTableSearchProps<TData>) {
    const table = useDataTable(tableProp, 'DataTableSearch');

    if (!(searchable ?? table.options.meta?.searchable)) {
        return null;
    }

    const placeholder = placeholderProp ?? getMessage(table, 'search');

    return (
        <Subscribe source={table.atoms.globalFilter}>
            {(globalFilter) => (
                <Input
                    type="search"
                    aria-label={placeholder}
                    placeholder={placeholder}
                    className={cn('w-40', className)}
                    {...props}
                    value={typeof globalFilter === 'string' ? globalFilter : ''}
                    onChange={(event) =>
                        table.setGlobalFilter(event.target.value)
                    }
                />
            )}
        </Subscribe>
    );
}

interface DataTableFiltersProps<TData extends RowData> {
    /** Not needed inside `DataTableProvider`. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    /** Ids of the columns to show, in this order; all of them by default. */
    columns?: string[];
}

/**
 * One control per filterable column, in the table order or in the order of
 * `columns`. No wrapper: they are laid out inside the parent container.
 */
export function DataTableFilters<TData extends RowData>({
    table: tableProp,
    columns,
}: DataTableFiltersProps<TData>) {
    const table = useDataTable(tableProp, 'DataTableFilters');
    const filterable = table
        .getAllColumns()
        .filter((column) => column.getCanFilter());
    const shown = columns
        ? columns.flatMap((id) =>
              filterable.filter((column) => column.id === id),
          )
        : filterable;

    return (
        <>
            {shown.map((column) => (
                <DataTableToolbarFilter key={column.id} column={column} />
            ))}
        </>
    );
}

interface DataTableFilterProps<TData extends RowData> {
    /** Not needed inside `DataTableProvider`. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    /** Id of the column in the table class. */
    column: string;
}

/**
 * The filter of a single column, with the component of its type. To pass
 * props to it, use that component (`DataTableFacetedFilter`…) instead.
 */
export function DataTableFilter<TData extends RowData>({
    table: tableProp,
    column,
}: DataTableFilterProps<TData>) {
    const table = useDataTable(tableProp, 'DataTableFilter');
    const found = table
        .getAllColumns()
        .find((item) => item.id === column && item.getCanFilter());

    return found ? <DataTableToolbarFilter column={found} /> : null;
}

interface DataTableResetButtonProps<
    TData extends RowData,
> extends React.ComponentProps<typeof Button> {
    /** Not needed inside `DataTableProvider`. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    /** Icon before the text; `null` hides it. */
    icon?: React.ComponentType<React.ComponentProps<'svg'>> | null;
}

/**
 * Clears the filters and the search; only shown while one of them is active.
 * With `children`, they are also its accessible name.
 */
export function DataTableResetButton<TData extends RowData>({
    table: tableProp,
    icon: Icon = X,
    children,
    ...props
}: DataTableResetButtonProps<TData>) {
    const table = useDataTable(tableProp, 'DataTableResetButton');

    function onReset() {
        table.resetColumnFilters(true);
        table.resetGlobalFilter(true);
    }

    return (
        <Subscribe
            source={table.store}
            selector={(state) =>
                state.columnFilters.length > 0 || Boolean(state.globalFilter)
            }
        >
            {(isFiltered) =>
                isFiltered && (
                    <Button
                        aria-label={
                            children === undefined
                                ? getMessage(table, 'reset_filters')
                                : undefined
                        }
                        variant="outline"
                        onClick={onReset}
                        {...props}
                    >
                        {Icon && <Icon />}
                        {children ?? getMessage(table, 'reset')}
                    </Button>
                )
            }
        </Subscribe>
    );
}

interface DataTableToolbarFilterProps<TData extends RowData> {
    column: Column<DataTableFeatures, TData>;
}

/**
 * Filter of a column with the component of its server variant.
 */
function DataTableToolbarFilter<TData extends RowData>({
    column,
}: DataTableToolbarFilterProps<TData>) {
    switch (column.columnDef.meta?.filterVariant) {
        case 'text':
            return <DataTableTextFilter column={column} className="lg:w-56" />;
        case 'number':
            return <DataTableNumberFilter column={column} />;
        case 'range':
            return <DataTableSliderFilter column={column} />;
        case 'date':
        case 'date-range':
            return <DataTableDateFilter column={column} />;
        case 'boolean':
            return <DataTableBooleanFilter column={column} />;
        case 'select':
        case 'multi-select':
            return <DataTableFacetedFilter column={column} />;
        default:
            return null;
    }
}
