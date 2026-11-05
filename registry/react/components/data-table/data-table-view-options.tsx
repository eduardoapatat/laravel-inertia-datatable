'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    type ReactTable,
    type RowData,
    Subscribe,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import * as React from 'react';

import type { DataTableFeatures } from '@/lib/data-table-features';
import { getMessage } from '@/lib/data-table-messages';

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
import { Settings2 } from 'lucide-react';

interface DataTableViewOptionsProps<
    TData extends RowData,
> extends React.ComponentProps<typeof FacetedContent> {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    disabled?: boolean;
}

export function DataTableViewOptions<TData extends RowData>({
    table,
    disabled,
    className,
    ...props
}: DataTableViewOptionsProps<TData>) {
    const dir = useDirection();
    const columns = React.useMemo(
        () =>
            table
                .getAllColumns()
                .filter(
                    (column) =>
                        column.accessorFn !== undefined && column.getCanHide(),
                ),
        [table],
    );

    return (
        <Subscribe source={table.atoms.columnVisibility}>
            {(columnVisibility) => (
                <Faceted
                    multiple
                    value={columns
                        .filter(
                            (column) => columnVisibility[column.id] !== false,
                        )
                        .map((column) => column.id)}
                >
                    <FacetedTrigger asChild>
                        <Button
                            aria-label={getMessage(table, 'view_columns')}
                            variant="outline"
                            className="ms-auto hidden lg:flex"
                            disabled={disabled}
                        >
                            <Settings2 className="text-muted-foreground" />
                            {getMessage(table, 'view')}
                        </Button>
                    </FacetedTrigger>
                    <FacetedContent
                        aria-label={getMessage(table, 'columns')}
                        dir={dir}
                        align="center"
                        className={cn('w-44', className)}
                        {...props}
                    >
                        <FacetedInput
                            placeholder={getMessage(table, 'search_columns')}
                        />
                        <FacetedList>
                            <FacetedEmpty>
                                {getMessage(table, 'no_columns')}
                            </FacetedEmpty>
                            <FacetedGroup>
                                {columns.map((column) => (
                                    <FacetedItem
                                        key={column.id}
                                        value={column.id}
                                        onSelect={() =>
                                            column.toggleVisibility()
                                        }
                                    >
                                        <span className="truncate">
                                            {column.columnDef.meta?.label ??
                                                column.id}
                                        </span>
                                        <FacetedItemIndicator />
                                    </FacetedItem>
                                ))}
                            </FacetedGroup>
                        </FacetedList>
                    </FacetedContent>
                </Faceted>
            )}
        </Subscribe>
    );
}
