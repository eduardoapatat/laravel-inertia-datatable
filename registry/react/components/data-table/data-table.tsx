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
import * as React from 'react';

import type { DataTableFeatures } from '@/lib/data-table-features';
import { getMessage } from '@/lib/data-table-messages';

import {
    getAriaSort,
    getColumnClassName,
    getColumnLabelVar,
    getColumnPinningStyle,
    getColumnSizingStyle,
    getVisibleSelectedRows,
    isNumberColumn,
} from '@/lib/data-table-utils';
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
    table: ReactTable<DataTableFeatures, TData, unknown>;
    actionBar?: React.ReactNode;
    /**
     * Renders the pagination below the table. With `false`, place
     * `<DataTablePagination table={table} />` wherever you want (e.g. on top).
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
}

type DataTableRowClassName<TData extends RowData> =
    | string
    | ((row: Row<DataTableFeatures, TData>) => string | undefined);

export function DataTable<TData extends RowData>({
    table,
    actionBar,
    pagination = true,
    headerClassName,
    rowClassName,
    children,
    className,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...props
}: DataTableProps<TData>) {
    const dir = useDirection();

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
            <div className="isolate overflow-hidden rounded-md border">
                <DataTableLayout
                    table={table}
                    aria-label={ariaLabel}
                    aria-labelledby={ariaLabelledBy}
                >
                    <DataTableHeader
                        table={table}
                        className={headerClassName}
                    />
                    <DataTableBody table={table} rowClassName={rowClassName} />
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
    const ref = React.useRef<HTMLTableCellElement>(null);
    useHeaderLabelWidth(
        ref,
        header.column.id,
        isNumberColumn(header.column.columnDef.meta),
    );

    return (
        <Subscribe
            source={header.column.table.atoms.sorting}
            selector={(sorting) => getAriaSort(sorting, header.column.id)}
        >
            {(ariaSort) => (
                <TableHead
                    ref={ref}
                    aria-sort={ariaSort}
                    colSpan={header.colSpan}
                    className={cn(
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

/**
 * Writes on the table the width of the header label of a number column (from
 * the start of the cell content to the end of its last icon), so its cells
 * end their figures right under it, whatever the length of the label.
 */
function useHeaderLabelWidth(
    ref: React.RefObject<HTMLTableCellElement | null>,
    columnId: string,
    enabled: boolean,
) {
    React.useLayoutEffect(() => {
        const cell = ref.current;
        const content = cell?.firstElementChild;
        const table = cell?.closest('table');

        if (!enabled || !cell || !content || !table) {
            return;
        }

        const name = getColumnLabelVar(columnId);

        function measure() {
            if (!cell || !content || !table) return;

            const range = document.createRange();
            range.selectNodeContents(content);
            const label = range.getBoundingClientRect();
            const box = cell.getBoundingClientRect();
            const style = getComputedStyle(cell);
            const width =
                style.direction === 'rtl'
                    ? box.right -
                      Number.parseFloat(style.paddingRight) -
                      label.left
                    : label.right -
                      box.left -
                      Number.parseFloat(style.paddingLeft);

            table.style.setProperty(
                name,
                `${Math.max(0, Math.round(width))}px`,
            );
        }

        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(content);

        return () => {
            observer.disconnect();
            table.style.removeProperty(name);
        };
    }, [ref, columnId, enabled]);
}

function getCellClassName(pinned: ColumnPinningPosition) {
    return pinned
        ? 'overflow-hidden bg-background transition-colors group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-has-[[aria-expanded=true]]/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--background))] group-data-[state=selected]/row:bg-muted'
        : 'overflow-hidden';
}

interface DataTableBodyProps<TData extends RowData> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    rowClassName?: DataTableRowClassName<TData>;
}

function DataTableBody<TData extends RowData>({
    table,
    rowClassName,
}: DataTableBodyProps<TData>) {
    const rows = table.getRowModel().rows;

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
        <TableBody>
            {rows.map((row) => (
                <DataTableRow key={row.id} row={row} className={rowClassName} />
            ))}
        </TableBody>
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

function selectHeaderState(state: TableState<DataTableFeatures>) {
    return {
        columnOrder: state.columnOrder,
        columnPinning: state.columnPinning,
        columnVisibility: state.columnVisibility,
    };
}
