'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type * as React from 'react';

import { type Column, type RowData, Subscribe } from '@tanstack/react-table';

import {
    clearColumnFilter,
    type DataTableFeatures,
    getEmptyFilter,
    setEmptyFilter,
} from '@/lib/data-table-features';
import { formatNumber, getEmptyLabel } from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';
import type { ColumnSelectOption } from '@/lib/data-table-types';

import { Button } from '@/components/ui/button';
import { useDirection } from '@/components/ui/direction';
import {
    Faceted,
    FacetedBadge,
    FacetedBadgeList,
    FacetedClear,
    FacetedContent,
    FacetedEmpty,
    FacetedGroup,
    FacetedInput,
    FacetedItem,
    FacetedItemCheckbox,
    FacetedItemCount,
    FacetedList,
    FacetedSeparator,
    FacetedTrigger,
    FacetedValue,
} from '@/components/ui/faceted';
import { Separator } from '@/components/ui/separator';
import { CirclePlus, CircleX } from 'lucide-react';

/**
 * Value of the "without value" item inside the list: never sent, it becomes an
 * `is.empty` filter next to the picked values.
 */
const EMPTY_VALUE = '\u0000empty';

interface DataTableFacetedFilterProps<TData extends RowData, TValue> {
    column?: Column<DataTableFeatures, TData, TValue>;
    title?: string;
    options: ColumnSelectOption[];
    multiple?: boolean;
}

export function DataTableFacetedFilter<TData extends RowData, TValue>({
    column,
    ...props
}: DataTableFacetedFilterProps<TData, TValue>) {
    if (!column) {
        return <DataTableFacetedFilterContent column={column} {...props} />;
    }

    return (
        <Subscribe
            source={column.table.atoms.columnFilters}
            selector={() => ({
                value: column.getFilterValue(),
                empty: getEmptyFilter(column),
            })}
        >
            {({ value, empty }) => (
                <DataTableFacetedFilterContent
                    column={column}
                    columnFilterValue={value}
                    includesEmpty={empty}
                    {...props}
                />
            )}
        </Subscribe>
    );
}

interface DataTableFacetedFilterContentProps<
    TData extends RowData,
    TValue,
> extends DataTableFacetedFilterProps<TData, TValue> {
    columnFilterValue?: unknown;
    includesEmpty?: boolean;
}

function DataTableFacetedFilterContent<TData extends RowData, TValue>({
    column,
    title = column?.columnDef.meta?.label ?? column?.id,
    options,
    multiple = false,
    columnFilterValue,
    includesEmpty = false,
}: DataTableFacetedFilterContentProps<TData, TValue>) {
    const table = column?.table;
    const meta = column?.columnDef.meta;
    const dir = useDirection();
    // Boolean filters store a single value ('true' / 'false').
    const isScalar = meta?.variant === 'boolean';
    const pickedValues = Array.isArray(columnFilterValue)
        ? columnFilterValue.filter(
              (value): value is string => typeof value === 'string',
          )
        : typeof columnFilterValue === 'string'
          ? [columnFilterValue]
          : [];
    const selectedValues = includesEmpty
        ? [...pickedValues, EMPTY_VALUE]
        : pickedValues;
    const hasSelection = selectedValues.length > 0;
    // With `empty: true` in PHP, the rows without a value go last.
    const emptyOption = meta?.empty
        ? {
              value: EMPTY_VALUE,
              label: getEmptyLabel(meta, table),
              count: meta.emptyCount,
          }
        : undefined;
    const items = emptyOption ? [...options, emptyOption] : options;

    function onValueChange(value: string | string[] | undefined) {
        const values = Array.isArray(value) ? value : value ? [value] : [];
        const picked = values.filter((item) => item !== EMPTY_VALUE);

        column?.setFilterValue(
            picked.length === 0 ? undefined : isScalar ? picked[0] : picked,
        );

        if (column && emptyOption) {
            setEmptyFilter(column, values.includes(EMPTY_VALUE));
        }
    }

    function onReset(event: React.MouseEvent) {
        event.stopPropagation();

        if (column) {
            clearColumnFilter(column);
        }
    }

    return (
        <Faceted
            value={multiple ? selectedValues : selectedValues[0]}
            onValueChange={onValueChange}
            items={items}
            multiple={multiple}
        >
            <FacetedTrigger asChild>
                <Button variant="outline" className="border-dashed">
                    {hasSelection ? (
                        <span
                            aria-hidden="true"
                            className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
                            onClick={onReset}
                        >
                            <CircleX />
                        </span>
                    ) : (
                        <CirclePlus />
                    )}
                    {title}
                    {hasSelection && (
                        <>
                            <Separator
                                orientation="vertical"
                                className="mx-0.5 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                            />
                            <FacetedValue>
                                {(selected) => (
                                    <FacetedBadgeList>
                                        {selected.length > 2 ? (
                                            <FacetedBadge>
                                                {getMessage(table, 'selected', {
                                                    count: selected.length,
                                                })}
                                            </FacetedBadge>
                                        ) : (
                                            selected.map((item) => (
                                                <FacetedBadge key={item.value}>
                                                    <span className="truncate">
                                                        {item.label}
                                                    </span>
                                                </FacetedBadge>
                                            ))
                                        )}
                                    </FacetedBadgeList>
                                )}
                            </FacetedValue>
                        </>
                    )}
                </Button>
            </FacetedTrigger>
            <FacetedContent
                aria-label={getMessage(table, 'filter', {
                    label: title ?? '',
                })}
                dir={dir}
                className="w-50"
            >
                <FacetedInput placeholder={title} />
                <FacetedList className="max-h-full">
                    <FacetedEmpty>
                        {getMessage(table, 'no_options')}
                    </FacetedEmpty>
                    <FacetedGroup className="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
                        {options.map((option) => (
                            <FacetedItem
                                key={option.value}
                                value={option.value}
                            >
                                <FacetedItemCheckbox />
                                {option.icon && (
                                    <option.icon className="text-muted-foreground" />
                                )}
                                <span className="flex-1 truncate">
                                    {option.label}
                                </span>
                                {option.count !== undefined && (
                                    <FacetedItemCount>
                                        {formatNumber(
                                            option.count,
                                            {},
                                            table?.options.meta?.locale,
                                        )}
                                    </FacetedItemCount>
                                )}
                            </FacetedItem>
                        ))}
                    </FacetedGroup>
                    {emptyOption && (
                        <>
                            <FacetedSeparator />
                            <FacetedGroup>
                                <FacetedItem value={emptyOption.value}>
                                    <FacetedItemCheckbox />
                                    <span className="flex-1 truncate">
                                        {emptyOption.label}
                                    </span>
                                    {emptyOption.count !== undefined && (
                                        <FacetedItemCount>
                                            {formatNumber(
                                                emptyOption.count,
                                                {},
                                                table?.options.meta?.locale,
                                            )}
                                        </FacetedItemCount>
                                    )}
                                </FacetedItem>
                            </FacetedGroup>
                        </>
                    )}
                    <FacetedClear>
                        {getMessage(table, 'clear_filters')}
                    </FacetedClear>
                </FacetedList>
            </FacetedContent>
        </Faceted>
    );
}
