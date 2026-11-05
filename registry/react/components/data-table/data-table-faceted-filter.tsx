'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type * as React from 'react';

import { type Column, type RowData, Subscribe } from '@tanstack/react-table';

import type { DataTableFeatures } from '@/lib/data-table-features';
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
    FacetedItemIndicator,
    FacetedList,
    FacetedTrigger,
    FacetedValue,
} from '@/components/ui/faceted';
import { Separator } from '@/components/ui/separator';
import { CirclePlus, CircleX } from 'lucide-react';

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
            selector={() => column.getFilterValue()}
        >
            {(filterValue) => (
                <DataTableFacetedFilterContent
                    column={column}
                    columnFilterValue={filterValue}
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
}

function DataTableFacetedFilterContent<TData extends RowData, TValue>({
    column,
    title = column?.columnDef.meta?.label ?? column?.id,
    options,
    multiple = false,
    columnFilterValue,
}: DataTableFacetedFilterContentProps<TData, TValue>) {
    const dir = useDirection();
    // Los filtros booleanos guardan un único valor ('true' / 'false').
    const isScalar = column?.columnDef.meta?.variant === 'boolean';
    const selectedValues = Array.isArray(columnFilterValue)
        ? columnFilterValue.filter(
              (value): value is string => typeof value === 'string',
          )
        : typeof columnFilterValue === 'string'
          ? [columnFilterValue]
          : [];
    const hasSelection = selectedValues.length > 0;

    function onValueChange(value: string | string[] | undefined) {
        const values = Array.isArray(value) ? value : value ? [value] : [];

        if (values.length === 0) {
            column?.setFilterValue(undefined);
        } else {
            column?.setFilterValue(isScalar ? values[0] : values);
        }
    }

    function onReset(event: React.MouseEvent) {
        event.stopPropagation();
        column?.setFilterValue(undefined);
    }

    return (
        <Faceted
            value={multiple ? selectedValues : selectedValues[0]}
            onValueChange={onValueChange}
            items={options}
            multiple={multiple}
        >
            <FacetedTrigger asChild>
                <Button variant="outline">
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
                                                {selected.length} selected
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
                aria-label={`${title} filter`}
                dir={dir}
                className="w-50"
            >
                <FacetedInput placeholder={title} />
                <FacetedList className="max-h-full">
                    <FacetedEmpty>No results found.</FacetedEmpty>
                    <FacetedGroup className="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto">
                        {options.map((option) => (
                            <FacetedItem
                                key={option.value}
                                value={option.value}
                            >
                                {option.icon && <option.icon />}
                                <span className="flex-1 truncate">
                                    {option.label}
                                </span>
                                <FacetedItemIndicator>
                                    {option.count}
                                </FacetedItemIndicator>
                            </FacetedItem>
                        ))}
                    </FacetedGroup>
                    <FacetedClear>Clear filters</FacetedClear>
                </FacetedList>
            </FacetedContent>
        </Faceted>
    );
}
