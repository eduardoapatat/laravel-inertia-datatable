'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { ReactTable, RowData } from '@tanstack/react-table';

import { cn } from '@/lib/utils';
import * as React from 'react';

import type { DataTableFeatures } from '@/lib/data-table-features';
import { formatNumber } from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';

import { getVisibleSelectedRows } from '@/lib/data-table-utils';
import { useDataTable } from '@/components/data-table/data-table-context';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-react';

type Table<TData extends RowData> = ReactTable<
    DataTableFeatures,
    TData,
    unknown
>;

interface DataTablePieceProps<
    TData extends RowData,
> extends React.ComponentProps<'div'> {
    /** Not needed inside `DataTableProvider`. */
    table?: Table<TData>;
}

interface DataTablePaginationProps<
    TData extends RowData,
> extends DataTablePieceProps<TData> {
    pageSizeOptions?: number[];
}

/**
 * Default pagination: selected rows on one side; rows per page, current page
 * and the buttons on the other. For another layout, place the pieces
 * (`DataTableSelectedRows`, `DataTablePageSize`, `DataTablePageInfo`,
 * `DataTablePageNav`) yourself, with `<DataTable pagination={false}>`.
 */
export function DataTablePagination<TData extends RowData>({
    table: tableProp,
    pageSizeOptions,
    className,
    ...props
}: DataTablePaginationProps<TData>) {
    const table = useDataTable(tableProp, 'DataTablePagination');

    return (
        <div
            data-slot="data-table-pagination"
            className={cn(
                'flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8',
                className,
            )}
            {...props}
        >
            <DataTableSelectedRows table={table} className="flex-1" />
            <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
                <DataTablePageSize
                    table={table}
                    pageSizeOptions={pageSizeOptions}
                />
                <DataTablePageInfo table={table} />
                <DataTablePageNav table={table} />
            </div>
        </div>
    );
}

/**
 * "2 rows selected" (and how many of them are on other pages); empty without
 * a selection.
 */
export function DataTableSelectedRows<TData extends RowData>({
    table: tableProp,
    className,
    ...props
}: DataTablePieceProps<TData>) {
    const table = useDataTable(tableProp, 'DataTableSelectedRows');

    return (
        <table.Subscribe
            selector={() => ({
                selected: table.getSelectedRowIds().length,
                visible: getVisibleSelectedRows(table).length,
            })}
        >
            {({ selected, visible }) => {
                const count = (value: number) =>
                    formatNumber(value, {}, table.options.meta?.locale);
                const hidden = selected - visible;

                return (
                    <div
                        role="status"
                        data-slot="data-table-selected-rows"
                        className={cn(
                            'text-sm whitespace-nowrap text-muted-foreground',
                            className,
                        )}
                        {...props}
                    >
                        {selected > 0 &&
                            [
                                getMessage(
                                    table,
                                    selected === 1
                                        ? 'row_selected'
                                        : 'rows_selected',
                                    { count: count(selected) },
                                ),
                                hidden > 0
                                    ? getMessage(table, 'not_shown', {
                                          count: count(hidden),
                                      })
                                    : null,
                            ]
                                .filter(Boolean)
                                .join(' ')}
                    </div>
                );
            }}
        </table.Subscribe>
    );
}

interface DataTablePageSizeProps<
    TData extends RowData,
> extends DataTablePieceProps<TData> {
    /** Sizes to pick from; those of the PHP class by default. */
    pageSizeOptions?: number[];
    /** Side where the list opens. */
    side?: 'top' | 'bottom';
    /** Hides the "Rows per page" text (it stays for screen readers). */
    hideLabel?: boolean;
}

/**
 * "Rows per page" select.
 */
export function DataTablePageSize<TData extends RowData>({
    table: tableProp,
    pageSizeOptions,
    side = 'top',
    hideLabel = false,
    className,
    ...props
}: DataTablePageSizeProps<TData>) {
    const table = useDataTable(tableProp, 'DataTablePageSize');
    const labelId = React.useId();
    const options = pageSizeOptions ??
        table.options.meta?.pageSizeOptions ?? [10, 20, 30, 40, 50];

    return (
        <table.Subscribe selector={(state) => state.pagination.pageSize}>
            {(pageSize) => (
                <div
                    data-slot="data-table-page-size"
                    className={cn('flex items-center gap-2', className)}
                    {...props}
                >
                    <Label
                        id={labelId}
                        htmlFor={`${labelId}-trigger`}
                        className={cn(
                            'whitespace-nowrap',
                            hideLabel && 'sr-only',
                        )}
                    >
                        {getMessage(table, 'rows_per_page')}
                    </Label>
                    <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => {
                            table.setPageSize(Number(value));
                        }}
                    >
                        <SelectTrigger
                            id={`${labelId}-trigger`}
                            aria-labelledby={labelId}
                            className="w-18"
                        >
                            <SelectValue placeholder={pageSize} />
                        </SelectTrigger>
                        <SelectContent side={side}>
                            <SelectGroup>
                                {options.map((option) => (
                                    <SelectItem
                                        key={option}
                                        value={`${option}`}
                                    >
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            )}
        </table.Subscribe>
    );
}

/**
 * "Page 2 of 31".
 */
export function DataTablePageInfo<TData extends RowData>({
    table: tableProp,
    className,
    ...props
}: DataTablePieceProps<TData>) {
    const table = useDataTable(tableProp, 'DataTablePageInfo');

    return (
        <table.Subscribe selector={(state) => state.pagination.pageIndex}>
            {(pageIndex) => {
                // From the server response (rowCount), not from the state.
                const pageCount = table.getPageCount();
                const count = (value: number) =>
                    formatNumber(value, {}, table.options.meta?.locale);

                return (
                    <div
                        role="status"
                        data-slot="data-table-page-info"
                        className={cn(
                            'flex items-center justify-center text-sm font-medium whitespace-nowrap',
                            className,
                        )}
                        {...props}
                    >
                        {getMessage(table, 'page_of', {
                            page: count(pageIndex + 1),
                            pages: count(pageCount),
                        })}
                    </div>
                );
            }}
        </table.Subscribe>
    );
}

interface DataTablePageNavProps<
    TData extends RowData,
> extends DataTablePieceProps<TData> {
    /**
     * First and last page buttons: always, never, or from the `lg` breakpoint
     * (the default).
     */
    firstLast?: boolean | 'lg';
}

/**
 * Buttons to go to the first, previous, next and last page.
 */
export function DataTablePageNav<TData extends RowData>({
    table: tableProp,
    firstLast = 'lg',
    className,
    ...props
}: DataTablePageNavProps<TData>) {
    const table = useDataTable(tableProp, 'DataTablePageNav');
    const edgeClassName = firstLast === 'lg' ? 'hidden lg:flex' : undefined;

    return (
        <table.Subscribe selector={(state) => state.pagination.pageIndex}>
            {(pageIndex) => {
                // From the server response (rowCount), not from the state.
                const pageCount = table.getPageCount();
                const canPreviousPage = pageIndex > 0;
                const canNextPage = pageIndex < pageCount - 1;

                return (
                    <div
                        data-slot="data-table-page-nav"
                        className={cn('flex items-center gap-2', className)}
                        {...props}
                    >
                        {firstLast !== false && (
                            <Button
                                aria-label={getMessage(table, 'first_page')}
                                variant="outline"
                                size="icon"
                                className={edgeClassName}
                                onClick={() => table.setPageIndex(0)}
                                disabled={!canPreviousPage}
                            >
                                <ChevronsLeft className="rtl:rotate-180" />
                            </Button>
                        )}
                        <Button
                            aria-label={getMessage(table, 'previous_page')}
                            variant="outline"
                            size="icon"
                            onClick={() => table.previousPage()}
                            disabled={!canPreviousPage}
                        >
                            <ChevronLeft className="rtl:rotate-180" />
                        </Button>
                        <Button
                            aria-label={getMessage(table, 'next_page')}
                            variant="outline"
                            size="icon"
                            onClick={() => table.nextPage()}
                            disabled={!canNextPage}
                        >
                            <ChevronRight className="rtl:rotate-180" />
                        </Button>
                        {firstLast !== false && (
                            <Button
                                aria-label={getMessage(table, 'last_page')}
                                variant="outline"
                                size="icon"
                                className={edgeClassName}
                                onClick={() =>
                                    table.setPageIndex(pageCount - 1)
                                }
                                disabled={!canNextPage}
                            >
                                <ChevronsRight className="rtl:rotate-180" />
                            </Button>
                        )}
                    </div>
                );
            }}
        </table.Subscribe>
    );
}
