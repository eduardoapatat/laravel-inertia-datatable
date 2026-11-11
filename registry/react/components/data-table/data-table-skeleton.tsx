// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import * as React from 'react';

import { DEFAULT_MESSAGES } from '@/lib/data-table-messages';
import type { ServerTableConfig } from '@/lib/data-table-server';
import { getSkeletonShape } from '@/lib/data-table-loading';
import { cn } from '@/lib/utils';

import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface DataTableSkeletonProps extends React.ComponentProps<'div'> {
    /**
     * Config of the table (`->config()` in PHP, which runs no query): the
     * skeleton takes its visible columns with their labels, the page size,
     * the search and the filters. The props below win over it.
     */
    config?: ServerTableConfig;
    /** Needed without `config`. */
    columnCount?: number;
    rowCount?: number;
    filterCount?: number;
    /** Search placeholder in the toolbar (`searchable` with `config`). */
    withSearch?: boolean;
    cellWidths?: string[];
    withViewOptions?: boolean;
    withPagination?: boolean;
    shrinkZero?: boolean;
    /** Text for screen readers; it has no table to read the texts from. */
    label?: string;
    /**
     * Wait before showing it (ms), so a fast load does not flash it; it
     * keeps its space meanwhile. `0` shows it at once.
     */
    delay?: number;
}

function subscribeToNothing() {
    return () => {};
}

export function DataTableSkeleton({
    config,
    columnCount: columnCountProp,
    rowCount: rowCountProp,
    filterCount: filterCountProp,
    withSearch: withSearchProp,
    cellWidths: cellWidthsProp,
    withViewOptions = true,
    withPagination = true,
    shrinkZero = false,
    label: labelProp,
    delay = 150,
    className,
    ...props
}: DataTableSkeletonProps) {
    // Empty on the server render, so it agrees with the first client one.
    const search = React.useSyncExternalStore(
        subscribeToNothing,
        () => window.location.search,
        () => '',
    );
    const shape = config ? getSkeletonShape(config, search) : undefined;
    const headers = columnCountProp === undefined ? shape?.columns : undefined;
    const columnCount = columnCountProp ?? shape?.columns.length ?? 1;
    const rowCount = rowCountProp ?? shape?.rowCount ?? 10;
    const filterCount = filterCountProp ?? shape?.filterCount ?? 0;
    const withSearch = withSearchProp ?? shape?.searchable ?? false;
    const label = labelProp ?? shape?.label ?? DEFAULT_MESSAGES.loading;
    // With the columns of the table, its layout: fixed, 150px by default.
    const cellWidths = cellWidthsProp ?? [headers ? '150px' : 'auto'];
    const [visible, setVisible] = React.useState(delay <= 0);

    React.useEffect(() => {
        if (delay <= 0) {
            return;
        }

        const timer = setTimeout(() => setVisible(true), delay);

        return () => clearTimeout(timer);
    }, [delay]);
    const cozyCellWidths = Array.from(
        { length: columnCount },
        (_, index) => cellWidths[index % cellWidths.length] ?? 'auto',
    );

    return (
        <div
            data-slot="data-table-skeleton"
            role="status"
            className={cn(
                'flex w-full flex-col gap-2.5 overflow-auto',
                !visible && 'invisible',
                className,
            )}
            {...props}
        >
            <span className="sr-only">{label}</span>
            <div
                aria-hidden="true"
                className="flex w-full items-center justify-between gap-2 overflow-auto p-1"
            >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                    {withSearch ? (
                        <Skeleton className="h-9 w-40 rounded-lg lg:w-64" />
                    ) : null}
                    {Array.from({ length: filterCount }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className={cn(
                                'rounded-lg',
                                filterCountProp === undefined &&
                                    shape?.filters[i] === 'input'
                                    ? 'h-9 w-40'
                                    : 'h-8 w-24',
                            )}
                        />
                    ))}
                </div>
                {withViewOptions ? (
                    <Skeleton className="ms-auto hidden h-8 w-18 rounded-lg lg:flex" />
                ) : null}
            </div>
            <div aria-hidden="true" className="rounded-md border">
                <Table className={headers ? 'table-fixed' : undefined}>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {Array.from({ length: columnCount }).map((_, j) => (
                                <TableHead
                                    key={j}
                                    className={
                                        headers?.[j]?.align === 'end'
                                            ? 'pe-8 text-end'
                                            : 'text-start'
                                    }
                                    style={{
                                        width: cozyCellWidths[j],
                                        minWidth: shrinkZero
                                            ? cozyCellWidths[j]
                                            : 'auto',
                                    }}
                                >
                                    {headers ? (
                                        <span className="block truncate">
                                            {headers[j]?.label}
                                        </span>
                                    ) : (
                                        <Skeleton className="h-6 w-full" />
                                    )}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: rowCount }).map((_, i) => (
                            <TableRow key={i} className="hover:bg-transparent">
                                {Array.from({ length: columnCount }).map(
                                    (_, j) => (
                                        <TableCell
                                            key={j}
                                            style={{
                                                width: cozyCellWidths[j],
                                                minWidth: shrinkZero
                                                    ? cozyCellWidths[j]
                                                    : 'auto',
                                            }}
                                        >
                                            <Skeleton
                                                className={cn(
                                                    'w-full',
                                                    headers?.[j]?.badge
                                                        ? 'h-5.5'
                                                        : 'h-5',
                                                )}
                                            />
                                        </TableCell>
                                    ),
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {withPagination ? (
                <div
                    aria-hidden="true"
                    className={cn(
                        'flex w-full items-center gap-4 overflow-auto p-1 sm:gap-8',
                        headers ? 'justify-end' : 'justify-between',
                    )}
                >
                    {/* Selected rows: only tables with a selection column. */}
                    {headers ? null : (
                        <Skeleton className="h-8 w-40 shrink-0 rounded-lg" />
                    )}
                    <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-9 w-24 rounded-lg" />
                            <Skeleton className="h-9 w-18 rounded-lg" />
                        </div>
                        <div className="flex items-center justify-center text-sm font-medium">
                            <Skeleton className="h-9 w-20 rounded-lg" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Skeleton className="hidden size-9 rounded-lg lg:block" />
                            <Skeleton className="size-9 rounded-lg" />
                            <Skeleton className="size-9 rounded-lg" />
                            <Skeleton className="hidden size-9 rounded-lg lg:block" />
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
