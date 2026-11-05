'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { ReactTable, RowData } from '@tanstack/react-table';

import { cn } from '@/lib/utils';
import * as React from 'react';

import type { DataTableFeatures } from '@/lib/data-table-features';
import { formatNumber } from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';

import { getVisibleSelectedRows } from '@/lib/data-table-utils';
import { Button } from '@/components/ui/button';
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

interface DataTablePaginationProps<
    TData extends RowData,
> extends React.ComponentProps<'div'> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    pageSizeOptions?: number[];
}

export function DataTablePagination<TData extends RowData>({
    table,
    pageSizeOptions,
    className,
    ...props
}: DataTablePaginationProps<TData>) {
    return (
        <table.Subscribe
            selector={(state) => ({
                pageIndex: state.pagination.pageIndex,
                pageSize: state.pagination.pageSize,
                selectedRowCount: table.getSelectedRowIds().length,
                visibleSelectedRowCount: getVisibleSelectedRows(table).length,
            })}
        >
            {({
                pageIndex,
                pageSize,
                selectedRowCount,
                visibleSelectedRowCount,
            }) => (
                <DataTablePaginationContent
                    table={table}
                    pageIndex={pageIndex}
                    pageSize={pageSize}
                    selectedRowCount={selectedRowCount}
                    visibleSelectedRowCount={visibleSelectedRowCount}
                    pageSizeOptions={
                        pageSizeOptions ??
                        table.options.meta?.pageSizeOptions ?? [
                            10, 20, 30, 40, 50,
                        ]
                    }
                    className={className}
                    {...props}
                />
            )}
        </table.Subscribe>
    );
}

interface DataTablePaginationContentProps<
    TData extends RowData,
> extends React.ComponentProps<'div'> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    pageIndex: number;
    pageSize: number;
    selectedRowCount: number;
    visibleSelectedRowCount: number;
    pageSizeOptions: number[];
}

function DataTablePaginationContent<TData extends RowData>({
    table,
    pageIndex,
    pageSize,
    selectedRowCount,
    visibleSelectedRowCount,
    pageSizeOptions,
    className,
    ...props
}: DataTablePaginationContentProps<TData>) {
    const pageSizeLabelId = React.useId();
    const pageCount = table.getPageCount();
    const canPreviousPage = table.getCanPreviousPage();
    const canNextPage = table.getCanNextPage();
    const locale = table.options.meta?.locale;
    const count = (value: number) => formatNumber(value, {}, locale);
    const hiddenCount = selectedRowCount - visibleSelectedRowCount;

    return (
        <div
            data-slot="data-table-pagination"
            className={cn(
                'flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8',
                className,
            )}
            {...props}
        >
            <div
                role="status"
                className="flex-1 text-sm whitespace-nowrap text-muted-foreground"
            >
                {selectedRowCount > 0 &&
                    [
                        getMessage(
                            table,
                            selectedRowCount === 1
                                ? 'row_selected'
                                : 'rows_selected',
                            { count: count(selectedRowCount) },
                        ),
                        hiddenCount > 0
                            ? getMessage(table, 'not_shown', {
                                  count: count(hiddenCount),
                              })
                            : null,
                    ]
                        .filter(Boolean)
                        .join(' ')}
            </div>
            <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
                <div className="flex items-center gap-2">
                    <p
                        id={pageSizeLabelId}
                        className="text-sm font-medium whitespace-nowrap"
                    >
                        {getMessage(table, 'rows_per_page')}
                    </p>
                    <Select
                        value={`${pageSize}`}
                        onValueChange={(value) => {
                            table.setPageSize(Number(value));
                        }}
                    >
                        <SelectTrigger
                            aria-labelledby={pageSizeLabelId}
                            className="w-18"
                        >
                            <SelectValue placeholder={pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            <SelectGroup>
                                {pageSizeOptions.map((pageSize) => (
                                    <SelectItem
                                        key={pageSize}
                                        value={`${pageSize}`}
                                    >
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
                <div
                    role="status"
                    className="flex items-center justify-center text-sm font-medium"
                >
                    {getMessage(table, 'page_of', {
                        page: count(pageIndex + 1),
                        pages: count(pageCount),
                    })}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        aria-label={getMessage(table, 'first_page')}
                        variant="outline"
                        size="icon"
                        className="hidden lg:flex"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!canPreviousPage}
                    >
                        <ChevronsLeft className="rtl:rotate-180" />
                    </Button>
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
                    <Button
                        aria-label={getMessage(table, 'last_page')}
                        variant="outline"
                        size="icon"
                        className="hidden lg:flex"
                        onClick={() => table.setPageIndex(pageCount - 1)}
                        disabled={!canNextPage}
                    >
                        <ChevronsRight className="rtl:rotate-180" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
