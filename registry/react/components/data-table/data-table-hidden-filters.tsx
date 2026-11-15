'use client';

import type { Column, RowData } from '@tanstack/react-table';
import { cn } from '@/lib/utils';

import type { DataTableFeatures } from '@/lib/data-table-features';
import { getMessage } from '@/lib/data-table-messages';

import { Badge } from '@/components/ui/badge';

interface DataTableHiddenFiltersProps<TData extends RowData> {
    column: Column<DataTableFeatures, TData>;
    /** `getHiddenFilterCount(column)`; nothing renders with 0. */
    count: number;
    className?: string;
}

/**
 * `+N` mark of a toolbar filter whose column has filters it can not show,
 * made in the filter list (`Name is mesa`).
 */
export function DataTableHiddenFilters<TData extends RowData>({
    column,
    count,
    className,
}: DataTableHiddenFiltersProps<TData>) {
    if (count === 0) return null;

    const text = getMessage(column.table, 'hidden_filters_label', {
        count,
        label: column.columnDef.meta?.label ?? column.id,
    });

    return (
        <Badge
            data-slot="data-table-hidden-filters"
            variant="secondary"
            title={text}
            className={cn('rounded-sm px-1 font-normal', className)}
        >
            <span aria-hidden="true">
                {getMessage(column.table, 'hidden_filters', { count })}
            </span>
            <span className="sr-only">{text}</span>
        </Badge>
    );
}
