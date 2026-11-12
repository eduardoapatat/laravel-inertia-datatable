'use client';

import { type Column, type RowData } from '@tanstack/react-table';
import * as React from 'react';

import {
    type DataTableFeatures,
    setEmptyFilter,
} from '@/lib/data-table-features';
import { getEmptyLabel } from '@/lib/data-table-format';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface DataTableEmptyFilterProps<TData extends RowData, TValue> {
    column: Column<DataTableFeatures, TData, TValue>;
    /** Whether the rows without a value are included (`getEmptyFilter`). */
    checked: boolean;
}

/**
 * Check of the range and date filters that adds the rows without a value
 * (`empty: true` in PHP) to the picked range, or shows only them.
 */
export function DataTableEmptyFilter<TData extends RowData, TValue>({
    column,
    checked,
}: DataTableEmptyFilterProps<TData, TValue>) {
    const id = React.useId();

    return (
        <div
            data-slot="data-table-empty-filter"
            className="flex items-center gap-2"
        >
            <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(value) =>
                    setEmptyFilter(column, value === true)
                }
            />
            <Label htmlFor={id} className="font-normal">
                {getEmptyLabel(column.columnDef.meta, column.table)}
            </Label>
        </div>
    );
}
