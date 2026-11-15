'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    type ReactTable,
    type RowData,
    type SortingState,
    Subscribe,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import * as React from 'react';

import { moveItem } from '@/lib/data-table-advanced';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { getMessage } from '@/lib/data-table-messages';

import { useDataTable } from '@/components/data-table/data-table-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDirection } from '@/components/ui/direction';
import {
    Faceted,
    FacetedContent,
    FacetedEmpty,
    FacetedGroup,
    FacetedInput,
    FacetedItem,
    FacetedItemIndicator,
    FacetedList,
    FacetedTrigger,
} from '@/components/ui/faceted';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ArrowDownUp,
    ChevronDown,
    ChevronsUpDown,
    ChevronUp,
    Trash2,
} from 'lucide-react';

interface DataTableSortListProps<TData extends RowData> extends Omit<
    React.ComponentProps<typeof PopoverContent>,
    'className'
> {
    /** Not needed inside `DataTableProvider`. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    disabled?: boolean;
    /** Classes of the button. */
    className?: string;
    /** Classes of the popover. */
    contentClassName?: string;
    /** Icon of the button; `null` hides it. */
    icon?: React.ComponentType<React.ComponentProps<'svg'>> | null;
}

/**
 * Sorting by several columns: a row per column with its direction, in order
 * of priority, up to the most the server sorts by (`max_sorts`).
 */
export function DataTableSortList<TData extends RowData>({
    table: tableProp,
    ...props
}: DataTableSortListProps<TData>) {
    const table = useDataTable(tableProp, 'DataTableSortList');

    return (
        <Subscribe source={table.atoms.sorting}>
            {(sorting) => (
                <DataTableSortListContent
                    table={table}
                    sorting={sorting}
                    {...props}
                />
            )}
        </Subscribe>
    );
}

function DataTableSortListContent<TData extends RowData>({
    table,
    sorting,
    disabled,
    className,
    contentClassName,
    icon: Icon = ArrowDownUp,
    align = 'start',
    ...props
}: Omit<DataTableSortListProps<TData>, 'table'> & {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    sorting: SortingState;
}) {
    const dir = useDirection();
    const columns = table
        .getAllColumns()
        .filter((column) => column.getCanSort());
    const labelOf = (id: string) => {
        const column = columns.find((item) => item.id === id);

        return column?.columnDef.meta?.label ?? id;
    };
    const used = new Set(sorting.map((sort) => sort.id));
    const available = columns.filter((column) => !used.has(column.id));
    const maxSorts = table.options.meta?.maxSorts ?? Infinity;
    const addButtonRef = React.useRef<HTMLButtonElement>(null);

    function addSort() {
        const [column] = available;

        if (column)
            table.setSorting([...sorting, { id: column.id, desc: false }]);
    }

    function removeSort(index: number) {
        table.setSorting(sorting.filter((_, item) => item !== index));
        addButtonRef.current?.focus();
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    data-slot="data-table-sort-list-trigger"
                    variant="outline"
                    className={className}
                    disabled={disabled}
                >
                    {Icon && <Icon className="text-muted-foreground" />}
                    {getMessage(table, 'sort')}
                    {sorting.length > 0 && (
                        <Badge
                            variant="secondary"
                            className="h-[18.24px] rounded-[3.2px] px-[5.12px] font-mono text-[10.4px] font-normal"
                        >
                            {sorting.length}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                data-slot="data-table-sort-list"
                aria-label={getMessage(table, 'sort')}
                dir={dir}
                align={align}
                className={cn(
                    'flex w-[calc(100vw-2rem)] max-w-[30rem] flex-col gap-3.5 p-4',
                    contentClassName,
                )}
                {...props}
            >
                <div className="flex flex-col gap-1">
                    <h4 className="leading-none font-medium">
                        {sorting.length > 0
                            ? getMessage(table, 'sort_by')
                            : getMessage(table, 'sort_none')}
                    </h4>
                    {sorting.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            {getMessage(table, 'sort_description')}
                        </p>
                    )}
                </div>
                {sorting.length > 0 && (
                    <div
                        role="list"
                        className="flex max-h-80 flex-col gap-2 overflow-y-auto py-0.5"
                    >
                        {sorting.map((sort, index) => {
                            const label = labelOf(sort.id);
                            const choices = columns.filter(
                                (column) =>
                                    column.id === sort.id ||
                                    !used.has(column.id),
                            );

                            return (
                                <div
                                    key={sort.id}
                                    role="listitem"
                                    data-slot="data-table-sort-item"
                                    data-column={sort.id}
                                    className="flex items-center gap-2"
                                >
                                    <Faceted
                                        value={sort.id}
                                        onValueChange={(id) => {
                                            if (id && id !== sort.id) {
                                                table.setSorting(
                                                    sorting.map((item, at) =>
                                                        at === index
                                                            ? { ...item, id }
                                                            : item,
                                                    ),
                                                );
                                            }
                                        }}
                                    >
                                        <FacetedTrigger asChild>
                                            <Button
                                                variant="outline"
                                                aria-label={getMessage(
                                                    table,
                                                    'field',
                                                )}
                                                className="h-8 min-w-0 flex-1 justify-between font-normal"
                                            >
                                                <span className="truncate">
                                                    {label}
                                                </span>
                                                <ChevronsUpDown className="text-muted-foreground" />
                                            </Button>
                                        </FacetedTrigger>
                                        <FacetedContent
                                            dir={dir}
                                            align="start"
                                            className="w-48"
                                        >
                                            <FacetedInput
                                                placeholder={getMessage(
                                                    table,
                                                    'search_fields',
                                                )}
                                            />
                                            <FacetedList>
                                                <FacetedEmpty>
                                                    {getMessage(
                                                        table,
                                                        'no_fields',
                                                    )}
                                                </FacetedEmpty>
                                                <FacetedGroup>
                                                    {choices.map((column) => (
                                                        <FacetedItem
                                                            key={column.id}
                                                            value={column.id}
                                                        >
                                                            <span className="truncate">
                                                                {column
                                                                    .columnDef
                                                                    .meta
                                                                    ?.label ??
                                                                    column.id}
                                                            </span>
                                                            <FacetedItemIndicator />
                                                        </FacetedItem>
                                                    ))}
                                                </FacetedGroup>
                                            </FacetedList>
                                        </FacetedContent>
                                    </Faceted>
                                    <Select
                                        value={sort.desc ? 'desc' : 'asc'}
                                        onValueChange={(value) =>
                                            table.setSorting(
                                                sorting.map((item, at) =>
                                                    at === index
                                                        ? {
                                                              ...item,
                                                              desc:
                                                                  value ===
                                                                  'desc',
                                                          }
                                                        : item,
                                                ),
                                            )
                                        }
                                    >
                                        <SelectTrigger
                                            aria-label={getMessage(
                                                table,
                                                'sort_direction',
                                                { label },
                                            )}
                                            className="h-8 w-24 shrink-0"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="min-w-(--radix-select-trigger-width)">
                                            <SelectItem value="asc">
                                                {getMessage(
                                                    table,
                                                    'sort_ascending',
                                                )}
                                            </SelectItem>
                                            <SelectItem value="desc">
                                                {getMessage(
                                                    table,
                                                    'sort_descending',
                                                )}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label={getMessage(
                                            table,
                                            'move_up',
                                            { label },
                                        )}
                                        className="size-8 shrink-0"
                                        disabled={index === 0}
                                        onClick={() =>
                                            table.setSorting(
                                                moveItem(
                                                    sorting,
                                                    index,
                                                    index - 1,
                                                ),
                                            )
                                        }
                                    >
                                        <ChevronUp />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label={getMessage(
                                            table,
                                            'move_down',
                                            { label },
                                        )}
                                        className="size-8 shrink-0"
                                        disabled={index === sorting.length - 1}
                                        onClick={() =>
                                            table.setSorting(
                                                moveItem(
                                                    sorting,
                                                    index,
                                                    index + 1,
                                                ),
                                            )
                                        }
                                    >
                                        <ChevronDown />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label={getMessage(
                                            table,
                                            'remove_sort',
                                            { label },
                                        )}
                                        className="size-8 shrink-0"
                                        onClick={() => removeSort(index)}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="flex w-full items-center gap-2">
                    <Button
                        ref={addButtonRef}
                        size="sm"
                        className="rounded"
                        disabled={
                            available.length === 0 || sorting.length >= maxSorts
                        }
                        onClick={addSort}
                    >
                        {getMessage(table, 'add_sort')}
                    </Button>
                    {sorting.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded"
                            onClick={() => table.setSorting([])}
                        >
                            {getMessage(table, 'reset_sorting')}
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
