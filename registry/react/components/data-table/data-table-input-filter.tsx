'use client';

import {
    type Column,
    type ReactTable,
    type RowData,
    Subscribe,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import type * as React from 'react';

import type { DataTableFeatures } from '@/lib/data-table-features';
import { getFilterAffixes, type FilterAffix } from '@/lib/data-table-format';
import type { FilterComponentName } from '@/lib/data-table-utils';

import {
    type DataTableColumnRef,
    useDataTableFilterColumn,
} from '@/components/data-table/data-table-context';
import { Input } from '@/components/ui/input';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from '@/components/ui/input-group';

interface DataTableInputFilterProps<TData extends RowData> extends Omit<
    React.ComponentProps<'input'>,
    'value' | 'onChange' | 'type'
> {
    /** Not needed inside `DataTableProvider` or with a column object. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    /** Id of the column in the PHP table class (or the TanStack column). */
    column: DataTableColumnRef<TData>;
}

/**
 * Text filter of a column with `->filterInput()` (contains, without case).
 */
export function DataTableTextFilter<TData extends RowData>({
    className,
    ...props
}: DataTableInputFilterProps<TData>) {
    return (
        <ColumnInputFilter
            component="DataTableTextFilter"
            className={cn('w-40', className)}
            {...props}
        />
    );
}

/**
 * Exact value filter of a number column with `->filterInput()`, with the unit
 * or currency of the column next to it.
 */
export function DataTableNumberFilter<TData extends RowData>({
    className,
    ...props
}: DataTableInputFilterProps<TData>) {
    return (
        <ColumnInputFilter
            component="DataTableNumberFilter"
            type="number"
            // `numeric` gives a keypad without a decimal separator on iOS.
            inputMode="decimal"
            className={cn('w-30', className)}
            {...props}
        />
    );
}

function ColumnInputFilter<TData extends RowData>({
    component,
    table,
    column: columnProp,
    type = 'text',
    ...props
}: DataTableInputFilterProps<TData> & {
    component: FilterComponentName;
    type?: 'text' | 'number';
}) {
    const column = useDataTableFilterColumn(component, columnProp, table);

    if (!column) return null;

    const meta = column.columnDef.meta;

    return (
        <DataTableFilterInput
            column={column}
            type={type}
            placeholder={meta?.placeholder ?? meta?.label}
            aria-label={meta?.label ?? column.id}
            affixes={type === 'number' ? getFilterAffixes(meta) : []}
            {...props}
        />
    );
}

interface DataTableFilterInputProps<
    TData extends RowData,
> extends React.ComponentProps<'input'> {
    column: Column<DataTableFeatures, TData>;
    /** Unit or currency next to the value (`getFilterAffixes`). */
    affixes?: FilterAffix[];
}

function DataTableFilterInput<TData extends RowData>({
    column,
    type = 'text',
    affixes = [],
    className,
    ...props
}: DataTableFilterInputProps<TData>) {
    return (
        <Subscribe
            source={column.table.atoms.columnFilters}
            selector={() => column.getFilterValue()}
        >
            {(filterValue) => {
                const inputProps = {
                    type,
                    ...props,
                    value: readFilterInputValue(filterValue),
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                        column.setFilterValue(event.target.value || undefined),
                };

                if (affixes.length === 0)
                    return <Input {...inputProps} className={className} />;

                return (
                    <InputGroup className={className}>
                        <InputGroupInput {...inputProps} />
                        {affixes.map((affix) => (
                            <InputGroupAddon
                                key={affix.align}
                                align={affix.align}
                            >
                                <InputGroupText>{affix.text}</InputGroupText>
                            </InputGroupAddon>
                        ))}
                    </InputGroup>
                );
            }}
        </Subscribe>
    );
}

function readFilterInputValue(value: unknown) {
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value);
    }

    if (Array.isArray(value)) {
        return value.join(',');
    }

    return '';
}
