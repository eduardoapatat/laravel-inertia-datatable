'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    type Cell,
    type ColumnPinningPosition,
    FlexRender,
    type Header,
    type ReactTable,
    type Row,
    type RowData,
    Subscribe,
    type TableState,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import * as React from 'react';

import type { DataTableFeatures } from '@/lib/data-table-features';
import type {
    DataTableColumnMeta,
    DataTableLoadingPhase,
} from '@/lib/data-table-types';
import { getMessage } from '@/lib/data-table-messages';

import {
    getAriaSort,
    getColumnAlign,
    getColumnClassName,
    getColumnPinningStyle,
    getColumnSizingStyle,
    getVisibleSelectedRows,
} from '@/lib/data-table-utils';
import { useDataTable } from '@/components/data-table/data-table-context';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { useDirection } from '@/components/ui/direction';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface DataTableProps<
    TData extends RowData,
> extends React.ComponentProps<'div'> {
    /** Not needed inside `DataTableProvider`. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    actionBar?: React.ReactNode;
    /**
     * Renders the pagination below the table. With `false`, place
     * `<DataTablePagination />` or its pieces wherever you want (e.g. on top).
     */
    pagination?: boolean;
    /**
     * Classes of the header row; for its cells, `[&>th]:h-8` (shorter header).
     */
    headerClassName?: string;
    /**
     * Classes of each body row, or a function of the row (for example, to
     * color it by its data); for its cells, `[&>td]:py-1` (compact rows).
     * Declare the function outside the component so rows keep their memo.
     */
    rowClassName?: DataTableRowClassName<TData>;
    /**
     * Shows that a visit is loading: after `loadingDelay` the rows dim, after
     * `skeletonDelay` they turn into skeletons (both options of
     * `useServerDataTable`). With `false`, nothing is shown; handle it
     * yourself with the `loading` the hook returns.
     */
    loading?: 'auto' | false;
}

type DataTableRowClassName<TData extends RowData> =
    | string
    | ((row: Row<DataTableFeatures, TData>) => string | undefined);

export function DataTable<TData extends RowData>({
    table: tableProp,
    actionBar,
    pagination = true,
    headerClassName,
    rowClassName,
    loading = 'auto',
    children,
    className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...props
}: DataTableProps<TData>) {
    const table = useDataTable(tableProp, 'DataTable');
    const dir = useDirection();
    const phase: DataTableLoadingPhase =
        loading === false ? 'idle' : (table.options.meta?.loading ?? 'idle');
    const isLoading = phase !== 'idle';

    return (
        <div
            data-slot="data-table"
            dir={dir}
            className={cn(
                'flex w-full flex-col gap-2.5 overflow-auto',
                className,
            )}
            {...props}
        >
            {children}
            <div
                aria-busy={isLoading || undefined}
                data-loading={isLoading ? phase : undefined}
                className="isolate overflow-hidden rounded-md border"
            >
                <DataTableLayout
                    table={table}
                    aria-label={ariaLabel}
                    aria-labelledby={ariaLabelledBy}
                >
                    <DataTableHeader
                        table={table}
                        className={headerClassName}
                    />
                    <DataTableBody
                        table={table}
                        rowClassName={rowClassName}
                        phase={phase}
                    />
                </DataTableLayout>
            </div>
            {pagination || actionBar ? (
                <div className="flex flex-col gap-2.5">
                    {pagination ? <DataTablePagination table={table} /> : null}
                    {actionBar ? (
                        <DataTableActionBar
                            table={table}
                            actionBar={actionBar}
                        />
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

interface DataTableLayoutProps<TData extends RowData> extends Pick<
    React.ComponentProps<'table'>,
    'aria-label' | 'aria-labelledby'
> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    children: React.ReactNode;
}

function DataTableLayout<TData extends RowData>({
    table,
    children,
    ...props
}: DataTableLayoutProps<TData>) {
    return (
        <table.Subscribe selector={selectLayoutState}>
            {() => (
                <Table
                    className="table-fixed"
                    style={getColumnSizingStyle(table)}
                    {...props}
                >
                    {children}
                </Table>
            )}
        </table.Subscribe>
    );
}

interface DataTableHeaderProps<TData extends RowData> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    className?: string;
}

function DataTableHeader<TData extends RowData>({
    table,
    className,
}: DataTableHeaderProps<TData>) {
    return (
        <table.Subscribe selector={selectHeaderState}>
            {() => (
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow
                            key={headerGroup.id}
                            className={cn('group/row', className)}
                        >
                            {headerGroup.headers.map((header) => (
                                <DataTableHeadCell
                                    key={header.id}
                                    header={header}
                                    pinned={header.column.getIsPinned()}
                                />
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
            )}
        </table.Subscribe>
    );
}

interface DataTableHeadCellProps<TData extends RowData> {
    header: Header<DataTableFeatures, TData>;
    pinned: ColumnPinningPosition;
}

function DataTableHeadCell<TData extends RowData>({
    header,
    pinned,
}: DataTableHeadCellProps<TData>) {
    return (
        <Subscribe
            source={header.column.table.atoms.sorting}
            selector={(sorting) => getAriaSort(sorting, header.column.id)}
        >
            {(ariaSort) => (
                <TableHead
                    aria-sort={ariaSort}
                    colSpan={header.colSpan}
                    data-align={getColumnAlign(header.column.columnDef.meta)}
                    className={cn(
                        'group/head',
                        getCellClassName(pinned),
                        ...getColumnClassName(
                            header.column.columnDef.meta,
                            'header',
                        ),
                    )}
                    style={getColumnPinningStyle(header.column, pinned)}
                >
                    {header.isPlaceholder ? null : (
                        <FlexRender header={header} />
                    )}
                </TableHead>
            )}
        </Subscribe>
    );
}

function getCellClassName(pinned: ColumnPinningPosition) {
    return pinned
        ? 'overflow-hidden bg-background transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-has-[[aria-expanded=true]]/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-data-[state=selected]/row:bg-muted'
        : 'overflow-hidden';
}

interface DataTableBodyProps<TData extends RowData> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    rowClassName?: DataTableRowClassName<TData>;
    phase: DataTableLoadingPhase;
}

function DataTableBody<TData extends RowData>({
    table,
    rowClassName,
    phase,
}: DataTableBodyProps<TData>) {
    const rows = table.getRowModel().rows;

    if (phase === 'slow') {
        return <DataTableSkeletonRows table={table} count={rows.length} />;
    }

    if (!rows.length) {
        return (
            <Subscribe source={table.atoms.columnVisibility}>
                {() => (
                    <TableBody>
                        <TableRow>
                            <TableCell
                                colSpan={
                                    table.getVisibleLeafColumns().length || 1
                                }
                                className="h-24 text-center"
                            >
                                {getMessage(table, 'no_results')}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                )}
            </Subscribe>
        );
    }

    return (
        <TableBody
            className={cn(
                'transition-opacity duration-200 motion-reduce:transition-none',
                phase === 'busy' && 'opacity-60',
            )}
        >
            {rows.map((row) => (
                <DataTableRow key={row.id} row={row} className={rowClassName} />
            ))}
        </TableBody>
    );
}

interface DataTableSkeletonRowsProps<TData extends RowData> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    /** Rows on screen; with none, the page size, so the height stays. */
    count: number;
}

/**
 * Placeholder rows while a slow visit loads, with the classes and styles of
 * the real cells so widths, alignment and pinned columns stay put.
 */
function DataTableSkeletonRows<TData extends RowData>({
    table,
    count,
}: DataTableSkeletonRowsProps<TData>) {
    return (
        <table.Subscribe selector={selectSkeletonState}>
            {({ pageSize }) => (
                <TableBody>
                    {Array.from({ length: count || pageSize }, (_, i) => (
                        <TableRow key={i} className="hover:bg-transparent">
                            {table.getVisibleLeafColumns().map((column) => {
                                const pinned = column.getIsPinned();

                                return (
                                    <TableCell
                                        key={column.id}
                                        className={cn(
                                            getCellClassName(pinned),
                                            ...getColumnClassName(
                                                column.columnDef.meta,
                                                'cell',
                                            ),
                                        )}
                                        style={getColumnPinningStyle(
                                            column,
                                            pinned,
                                        )}
                                    >
                                        <Skeleton
                                            className={cn(
                                                'w-full',
                                                // A badge is a bit taller than a line of text.
                                                hasBadge(column.columnDef.meta)
                                                    ? 'h-5.5'
                                                    : 'h-5',
                                            )}
                                        />
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            )}
        </table.Subscribe>
    );
}

function hasBadge(meta: DataTableColumnMeta | undefined) {
    const display = meta?.display;

    return (
        display !== undefined && 'badge' in display && display.badge === true
    );
}

interface DataTableActionBarProps<TData extends RowData> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    actionBar: React.ReactNode;
}

function DataTableActionBar<TData extends RowData>({
    table,
    actionBar,
}: DataTableActionBarProps<TData>) {
    return (
        <table.Subscribe
            selector={() => getVisibleSelectedRows(table).length > 0}
        >
            {(hasVisibleSelectedRows) =>
                hasVisibleSelectedRows ? actionBar : null
            }
        </table.Subscribe>
    );
}

interface DataTableRowProps<TData extends RowData> {
    row: Row<DataTableFeatures, TData>;
    className?: DataTableRowClassName<TData>;
}

const DataTableRow = React.memo(DataTableRowImpl) as typeof DataTableRowImpl;

function DataTableRowImpl<TData extends RowData>({
    row,
    className,
}: DataTableRowProps<TData>) {
    return (
        <Subscribe
            source={row.table.store}
            selector={(state) => ({
                columnOrder: state.columnOrder,
                columnPinning: state.columnPinning,
                columnVisibility: state.columnVisibility,
                isSelected: state.rowSelection[row.id] === true,
            })}
        >
            {({ isSelected }) => (
                <TableRow
                    data-state={isSelected ? 'selected' : undefined}
                    className={cn(
                        'group/row',
                        typeof className === 'function'
                            ? className(row)
                            : className,
                    )}
                >
                    {row.getVisibleCells().map((cell) => (
                        <DataTableCell
                            key={cell.id}
                            cell={cell}
                            pinned={cell.column.getIsPinned()}
                        />
                    ))}
                </TableRow>
            )}
        </Subscribe>
    );
}

interface DataTableCellProps<TData extends RowData> {
    cell: Cell<DataTableFeatures, TData>;
    pinned: ColumnPinningPosition;
}

const DataTableCell = React.memo(DataTableCellImpl) as typeof DataTableCellImpl;

function DataTableCellImpl<TData extends RowData>({
    cell,
    pinned,
}: DataTableCellProps<TData>) {
    return (
        <TableCell
            className={cn(
                getCellClassName(pinned),
                // Content that does not fit ends in "…" instead of touching
                // the next column; `text-clip` in `meta.cellClassName` undoes it.
                'text-ellipsis',
                ...getColumnClassName(
                    cell.column.columnDef.meta,
                    'cell',
                    cell as Cell<DataTableFeatures, RowData>,
                ),
            )}
            style={getColumnPinningStyle(cell.column, pinned)}
        >
            <FlexRender cell={cell} />
        </TableCell>
    );
}

function selectLayoutState(state: TableState<DataTableFeatures>) {
    return {
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnSizing: state.columnSizing,
        columnVisibility: state.columnVisibility,
    };
}

function selectSkeletonState(state: TableState<DataTableFeatures>) {
    return {
        ...selectHeaderState(state),
        pageSize: state.pagination.pageSize,
    };
}

function selectHeaderState(state: TableState<DataTableFeatures>) {
    return {
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnVisibility: state.columnVisibility,
    };
}
