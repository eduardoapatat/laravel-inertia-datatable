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
import { getFilterUnit } from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';

import {
    getColumnSelectOptions,
    getFilterVariant,
} from '@/lib/data-table-utils';
import { DataTableDateFilter } from '@/components/data-table/data-table-date-filter';
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter';
import { DataTableSliderFilter } from '@/components/data-table/data-table-slider-filter';
import { DataTableViewOptions } from '@/components/data-table/data-table-view-options';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from '@/components/ui/input-group';
import { X } from 'lucide-react';

interface DataTableToolbarProps<
    TData extends RowData,
> extends React.ComponentProps<'div'> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    /** Shows the global search; by default, when the server allows it. */
    searchable?: boolean;
    searchPlaceholder?: string;
}

/**
 * Default layout: search, filters and Reset on the left; `children` and the
 * column menu on the right. For another order, compose the pieces
 * (`DataTableSearch`, `DataTableFilters`, `DataTableFilter`,
 * `DataTableResetButton`, `DataTableViewOptions`) in your own container.
 */
export function DataTableToolbar<TData extends RowData>({
    table,
    searchable,
    searchPlaceholder,
    children,
    className,
    ...props
}: DataTableToolbarProps<TData>) {
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
                />
                <DataTableFilters table={table} />
                <DataTableResetButton table={table} />
            </div>
            <div className="flex items-center gap-2">
                {children}
                <DataTableViewOptions table={table} align="end" />
            </div>
        </div>
    );
}

interface DataTableSearchProps<
    TData extends RowData,
> extends React.ComponentProps<'input'> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    /** Shows the global search; by default, when the server allows it. */
    searchable?: boolean;
}

/**
 * Global search (`?search=`). Hidden when the table class declares no
 * `searchable()` column, unless forced with `searchable`.
 */
export function DataTableSearch<TData extends RowData>({
    table,
    searchable,
    placeholder: placeholderProp,
    className,
    ...props
}: DataTableSearchProps<TData>) {
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
                    className={cn('w-40 lg:w-64', className)}
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
    table: ReactTable<DataTableFeatures, TData, unknown>;
    /** Ids of the columns to show, in this order; all of them by default. */
    columns?: string[];
}

/**
 * One control per filterable column, in the table order or in the order of
 * `columns`. No wrapper: they are laid out inside the parent container.
 */
export function DataTableFilters<TData extends RowData>({
    table,
    columns,
}: DataTableFiltersProps<TData>) {
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
    table: ReactTable<DataTableFeatures, TData, unknown>;
    /** Id of the column in the table class. */
    column: string;
}

/**
 * The filter of a single column, to place it apart from the rest.
 */
export function DataTableFilter<TData extends RowData>({
    table,
    column,
}: DataTableFilterProps<TData>) {
    const found = table
        .getAllColumns()
        .find((item) => item.id === column && item.getCanFilter());

    return found ? <DataTableToolbarFilter column={found} /> : null;
}

interface DataTableResetButtonProps<
    TData extends RowData,
> extends React.ComponentProps<typeof Button> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
}

/**
 * Clears the filters and the search; only shown while one of them is active.
 */
export function DataTableResetButton<TData extends RowData>({
    table,
    children,
    ...props
}: DataTableResetButtonProps<TData>) {
    function onReset() {
        table.resetColumnFilters(true);
        table.resetGlobalFilter(true);
        table.resetJoinOperator(true);
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
                        aria-label={getMessage(table, 'reset_filters')}
                        variant="outline"
                        onClick={onReset}
                        {...props}
                    >
                        <X />
                        {children ?? getMessage(table, 'reset')}
                    </Button>
                )
            }
        </Subscribe>
    );
}

/**
 * Yes / No of the table texts, or the labels of `->booleanLabels()`.
 */
function booleanOptions<TData extends RowData>(
    column: Column<DataTableFeatures, TData>,
) {
    const display = column.columnDef.meta?.display;
    const labels =
        display?.type === 'boolean' && display.labels
            ? display.labels
            : {
                  true: getMessage(column.table, 'yes'),
                  false: getMessage(column.table, 'no'),
              };

    const icons = column.columnDef.meta?.icons;

    return [
        { label: labels.true, value: 'true', icon: icons?.true },
        { label: labels.false, value: 'false', icon: icons?.false },
    ];
}

interface DataTableToolbarFilterProps<TData extends RowData> {
    column: Column<DataTableFeatures, TData>;
}

function DataTableToolbarFilter<TData extends RowData>({
    column,
}: DataTableToolbarFilterProps<TData>) {
    const columnMeta = column.columnDef.meta;
    if (!columnMeta?.variant) return null;

    const title = columnMeta.label ?? column.id;
    const placeholder = columnMeta.placeholder ?? columnMeta.label;
    const filterVariant = getFilterVariant(columnMeta);

    switch (filterVariant) {
        case 'text':
            return (
                <DataTableFilterInput
                    column={column}
                    placeholder={placeholder}
                    className="w-40 lg:w-56"
                />
            );

        case 'number':
            return (
                <DataTableFilterInput
                    column={column}
                    type="number"
                    inputMode="numeric"
                    placeholder={placeholder}
                    unit={getFilterUnit(columnMeta)}
                    className="w-30"
                />
            );

        case 'range':
            return <DataTableSliderFilter column={column} title={title} />;

        case 'date':
        case 'date-range':
            return (
                <DataTableDateFilter
                    column={column}
                    title={title}
                    multiple={filterVariant === 'date-range'}
                />
            );

        case 'boolean':
            return (
                <DataTableFacetedFilter
                    column={column}
                    title={title}
                    options={booleanOptions(column)}
                />
            );

        case 'select':
        case 'multi-select':
            return (
                <DataTableFacetedFilter
                    column={column}
                    title={title}
                    options={getColumnSelectOptions(columnMeta)}
                    multiple={filterVariant === 'multi-select'}
                />
            );

        default:
            return null;
    }
}

interface DataTableFilterInputProps<
    TData extends RowData,
> extends React.ComponentProps<'input'> {
    column: Column<DataTableFeatures, TData>;
    /** Unit or currency code after the value (`getFilterUnit`). */
    unit?: string;
}

function DataTableFilterInput<TData extends RowData>({
    column,
    type = 'text',
    unit,
    className,
    ...props
}: DataTableFilterInputProps<TData>) {
    return (
        <Subscribe
            source={column.table.atoms.columnFilters}
            selector={() => column.getFilterValue()}
        >
            {(filterValue) => {
                const inputProps = {
                    type,
                    ...props,
                    value: readFilterInputValue(filterValue),
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                        column.setFilterValue(event.target.value || undefined),
                };

                if (!unit)
                    return <Input {...inputProps} className={className} />;

                return (
                    <InputGroup className={className}>
                        <InputGroupInput {...inputProps} />
                        <InputGroupAddon align="inline-end">
                            <InputGroupText>{unit}</InputGroupText>
                        </InputGroupAddon>
                    </InputGroup>
                );
            }}
        </Subscribe>
    );
}

function readFilterInputValue(value: unknown) {
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.join(',');
    }

    return '';
}
