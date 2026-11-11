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

import { useDataTable } from '@/components/data-table/data-table-context';
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

interface DataTableViewOptionsProps<TData extends RowData> extends Omit<
    React.ComponentProps<typeof FacetedContent>,
    'className'
> {
    /** Not needed inside `DataTableProvider`. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    disabled?: boolean;
    /** Classes of the button (the toolbar adds `ms-auto hidden lg:flex`). */
    className?: string;
    /** Classes of the popover. */
    contentClassName?: string;
    /** Icon of the button; `null` hides it. */
    icon?: React.ComponentType<React.ComponentProps<'svg'>> | null;
}

/**
 * Column menu: shows and hides the columns the PHP class allows to hide.
 */
export function DataTableViewOptions<TData extends RowData>({
    table: tableProp,
    disabled,
    className,
    contentClassName,
    icon: Icon = Settings2,
    ...props
}: DataTableViewOptionsProps<TData>) {
    const table = useDataTable(tableProp, 'DataTableViewOptions');
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
                            className={className}
                            disabled={disabled}
                        >
                            {Icon && <Icon className="text-muted-foreground" />}
                            {getMessage(table, 'view')}
                        </Button>
                    </FacetedTrigger>
                    <FacetedContent
                        aria-label={getMessage(table, 'columns')}
                        dir={dir}
                        align="center"
                        className={cn('w-44', contentClassName)}
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
