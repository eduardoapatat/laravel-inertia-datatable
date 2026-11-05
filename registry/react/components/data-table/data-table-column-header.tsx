'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    type Column,
    type RowData,
    type SortDirection,
    type SortingState,
    Subscribe,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import * as React from 'react';

import type { DataTableFeatures } from '@/lib/data-table-features';
import { getMessage } from '@/lib/data-table-messages';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Check,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    EyeOff,
} from 'lucide-react';

interface DataTableColumnHeaderProps<
    TData extends RowData,
    TValue,
> extends React.ComponentProps<typeof DropdownMenuTrigger> {
    column: Column<DataTableFeatures, TData, TValue>;
    label: string;
}

export function DataTableColumnHeader<TData extends RowData, TValue>({
    column,
    label,
    className,
    ...props
}: DataTableColumnHeaderProps<TData, TValue>) {
    if (!column.getCanSort() && !column.getCanHide()) {
        return <div className={className}>{label}</div>;
    }

    return (
        <Subscribe
            source={column.table.store}
            selector={(state) => ({
                sortDirection: getSortDirection(state.sorting, column.id),
            })}
        >
            {(headerState) => (
                <DataTableColumnHeaderMenu
                    column={column}
                    label={label}
                    className={className}
                    sortDirection={headerState.sortDirection}
                    {...props}
                />
            )}
        </Subscribe>
    );
}

interface DataTableColumnHeaderMenuProps<
    TData extends RowData,
    TValue,
> extends DataTableColumnHeaderProps<TData, TValue> {
    sortDirection: SortDirection | 'none';
}

function DataTableColumnHeaderMenu<TData extends RowData, TValue>({
    column,
    label,
    className,
    sortDirection,
    ...props
}: DataTableColumnHeaderMenuProps<TData, TValue>) {
    function onSortDirectionChange(direction: SortDirection) {
        if (sortDirection === direction) {
            column.clearSorting();
            return;
        }

        column.toggleSorting(direction === 'desc', true);
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className={cn(
                    '-ms-1.5 flex h-8 items-center gap-1.5 rounded-md px-2 py-1.5 hover:bg-accent focus:ring-1 focus:ring-ring focus:outline-none data-[state=open]:bg-accent rtl:flex-row-reverse [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground',
                    className,
                )}
                {...props}
            >
                {label}
                {column.getCanSort() &&
                    (sortDirection === 'desc' ? (
                        <ChevronDown />
                    ) : sortDirection === 'asc' ? (
                        <ChevronUp />
                    ) : (
                        <ChevronsUpDown />
                    ))}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="min-w-28 data-[state=closed]:fill-mode-forwards"
            >
                {column.getCanSort() && (
                    <>
                        <SortItem
                            checked={sortDirection === 'asc'}
                            onSelect={() => onSortDirectionChange('asc')}
                        >
                            <ChevronUp />
                            {getMessage(column.table, 'sort_ascending')}
                        </SortItem>
                        <SortItem
                            checked={sortDirection === 'desc'}
                            onSelect={() => onSortDirectionChange('desc')}
                        >
                            <ChevronDown />
                            {getMessage(column.table, 'sort_descending')}
                        </SortItem>
                    </>
                )}
                {column.getCanHide() && (
                    <DropdownMenuItem
                        className="[&_svg]:text-muted-foreground"
                        onSelect={() => column.toggleVisibility(false)}
                    >
                        <EyeOff />
                        {getMessage(column.table, 'hide')}
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function getSortDirection(
    sorting: SortingState,
    columnId: string,
): SortDirection | 'none' {
    const sort = sorting.find((sort) => sort.id === columnId);
    if (!sort) return 'none';
    return sort.desc ? 'desc' : 'asc';
}

/**
 * Sort option with its check at the end, whatever the side the project's
 * `DropdownMenuCheckboxItem` puts it on.
 */
function SortItem({
    checked,
    children,
    className,
    ...props
}: React.ComponentProps<typeof DropdownMenuItem> & { checked: boolean }) {
    return (
        <DropdownMenuItem
            role="menuitemcheckbox"
            aria-checked={checked}
            className={cn('[&_svg]:text-muted-foreground', className)}
            {...props}
        >
            {children}
            <Check
                className={cn(
                    'ms-auto text-foreground!',
                    !checked && 'invisible',
                )}
            />
        </DropdownMenuItem>
    );
}
