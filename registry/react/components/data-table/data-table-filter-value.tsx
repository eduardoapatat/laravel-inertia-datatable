'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { DateRange } from 'react-day-picker';

import type { Column, RowData } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import * as React from 'react';

import { getIsValuelessOperator } from '@/lib/data-table-advanced';
import type { DataTableFeatures } from '@/lib/data-table-features';
import {
    formatFilterDate,
    parseFilterDate,
    pickDateRangeDay,
} from '@/lib/data-table-filter-values';
import { getBooleanFilterOptions } from '@/lib/data-table-filter-options';
import { formatDate, formatNumber } from '@/lib/data-table-format';
import {
    type DataTableMessageKey,
    getMessage,
} from '@/lib/data-table-messages';
import {
    formatRelativeDateRange,
    getRelativeDateLabel,
    RELATIVE_DATE_PRESETS,
} from '@/lib/data-table-relative-date';
import type { ColumnFilterItem } from '@/lib/data-table-types';

import { useCalendarLocale } from '@/components/data-table/data-table-date-filter';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useDirection } from '@/components/ui/direction';
import {
    Faceted,
    FacetedContent,
    FacetedEmpty,
    FacetedGroup,
    FacetedInput,
    FacetedItem,
    FacetedItemCheckbox,
    FacetedItemCount,
    FacetedList,
    FacetedTrigger,
    FacetedValue,
} from '@/components/ui/faceted';
import { Input } from '@/components/ui/input';
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
import { CalendarIcon } from 'lucide-react';

interface DataTableFilterValueProps<TData extends RowData> {
    column: Column<DataTableFeatures, TData>;
    filter: ColumnFilterItem;
    onChange: (value: string | string[]) => void;
    className?: string;
}

/**
 * Value of a row of `DataTableFilterList`, by the variant of its column and
 * its operator: text or number fields (two for `isBetween`), a calendar, a list
 * of options, yes / no or the periods relative to today of `rel`. `is.empty`
 * and `not.is.empty` take none.
 */
export function DataTableFilterValue<TData extends RowData>({
    column,
    filter,
    onChange,
    className,
}: DataTableFilterValueProps<TData>) {
    const table = column.table;
    const label = column.columnDef.meta?.label ?? column.id;
    const ariaLabel = getMessage(table, 'filter_value', { label });

    if (getIsValuelessOperator(filter.operator)) {
        return (
            <div data-slot="data-table-filter-value" className={className} />
        );
    }

    if (filter.operator === 'isRelativeToToday') {
        return (
            <DataTableFilterRelativeValue
                column={column}
                filter={filter}
                onChange={onChange}
                ariaLabel={ariaLabel}
                className={className}
            />
        );
    }

    switch (filter.variant) {
        case 'text':
        case 'number':
        case 'range': {
            const type = filter.variant === 'text' ? 'text' : 'number';

            if (filter.operator === 'isBetween') {
                const [from = '', to = ''] = toList(filter.value);

                return (
                    <div
                        data-slot="data-table-filter-value"
                        className={cn('flex items-center gap-1', className)}
                    >
                        <Input
                            type={type}
                            inputMode="decimal"
                            aria-label={`${ariaLabel}: ${getMessage(table, 'from')}`}
                            placeholder={getMessage(table, 'from')}
                            className="h-8 min-w-0"
                            value={from}
                            onChange={(event) =>
                                onChange([event.target.value, to])
                            }
                        />
                        <Input
                            type={type}
                            inputMode="decimal"
                            aria-label={`${ariaLabel}: ${getMessage(table, 'to')}`}
                            placeholder={getMessage(table, 'to')}
                            className="h-8 min-w-0"
                            value={to}
                            onChange={(event) =>
                                onChange([from, event.target.value])
                            }
                        />
                    </div>
                );
            }

            return (
                <Input
                    data-slot="data-table-filter-value"
                    type={type}
                    inputMode={type === 'number' ? 'decimal' : undefined}
                    aria-label={ariaLabel}
                    placeholder={
                        column.columnDef.meta?.placeholder ??
                        getMessage(table, 'enter_value')
                    }
                    className={cn('h-8', className)}
                    value={toSingle(filter.value)}
                    onChange={(event) => onChange(event.target.value)}
                />
            );
        }
        case 'date':
        case 'date-range':
            return (
                <DataTableFilterDateValue
                    column={column}
                    filter={filter}
                    onChange={onChange}
                    ariaLabel={ariaLabel}
                    className={className}
                />
            );
        case 'boolean': {
            const options = getBooleanFilterOptions(column.columnDef.meta, {
                yes: getMessage(table, 'yes'),
                no: getMessage(table, 'no'),
            });

            return (
                <Select
                    value={toSingle(filter.value) || undefined}
                    onValueChange={onChange}
                >
                    <SelectTrigger
                        data-slot="data-table-filter-value"
                        aria-label={ariaLabel}
                        className={cn('h-8 w-full', className)}
                    >
                        <SelectValue
                            placeholder={getMessage(table, 'select_options')}
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );
        }
        default:
            return (
                <DataTableFilterOptionsValue
                    column={column}
                    filter={filter}
                    onChange={onChange}
                    ariaLabel={ariaLabel}
                    className={className}
                />
            );
    }
}

/**
 * Periods relative to today: the presets, and first the token of the URL when
 * it is not one of them. The days the server resolved it to go in the title.
 */
function DataTableFilterRelativeValue<TData extends RowData>({
    column,
    filter,
    onChange,
    ariaLabel,
    className,
}: DataTableFilterValueProps<TData> & { ariaLabel: string }) {
    const table = column.table;
    const token = toSingle(filter.value);
    const presets: readonly string[] = RELATIVE_DATE_PRESETS;
    const tokens =
        token === '' || presets.includes(token) ? presets : [token, ...presets];
    const message = (
        key: DataTableMessageKey,
        replacements?: Record<string, string | number>,
    ) => getMessage(table, key, replacements);
    const range = formatRelativeDateRange(
        filter.range,
        table.options.meta?.locale,
    );

    return (
        <Select value={token || undefined} onValueChange={onChange}>
            <SelectTrigger
                data-slot="data-table-filter-value"
                aria-label={ariaLabel}
                title={range || undefined}
                className={cn('h-8 w-full', className)}
            >
                <SelectValue placeholder={getMessage(table, 'pick_period')} />
            </SelectTrigger>
            <SelectContent>
                {tokens.map((item) => (
                    <SelectItem key={item} value={item}>
                        {getRelativeDateLabel(item, message)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function DataTableFilterOptionsValue<TData extends RowData>({
    column,
    filter,
    onChange,
    ariaLabel,
    className,
}: DataTableFilterValueProps<TData> & { ariaLabel: string }) {
    const table = column.table;
    const dir = useDirection();
    const options = column.columnDef.meta?.options ?? [];
    const multiple =
        filter.operator === 'inArray' || filter.operator === 'notInArray';
    const items = React.useMemo(
        () =>
            options.map((option) => ({
                value: option.value,
                label: option.label,
            })),
        [options],
    );
    const placeholder = getMessage(table, 'select_options');
    const trigger = (
        <FacetedTrigger asChild>
            <Button
                data-slot="data-table-filter-value"
                variant="outline"
                aria-label={ariaLabel}
                className={cn('h-8 w-full justify-between', className)}
            >
                <FacetedValue>
                    {(selected) => (
                        <span
                            className={cn(
                                'truncate',
                                selected.length === 0 &&
                                    'text-muted-foreground',
                            )}
                        >
                            {selected.length === 0
                                ? placeholder
                                : selected.length > 2
                                  ? getMessage(table, 'selected', {
                                        count: selected.length,
                                    })
                                  : selected
                                        .map((item) => item.label)
                                        .join(', ')}
                        </span>
                    )}
                </FacetedValue>
            </Button>
        </FacetedTrigger>
    );
    const content = (
        <FacetedContent
            aria-label={ariaLabel}
            dir={dir}
            align="start"
            className="w-56"
        >
            <FacetedInput placeholder={placeholder} />
            <FacetedList>
                <FacetedEmpty>{getMessage(table, 'no_options')}</FacetedEmpty>
                <FacetedGroup className="max-h-75 overflow-y-auto">
                    {options.map((option) => (
                        <FacetedItem key={option.value} value={option.value}>
                            {multiple && <FacetedItemCheckbox />}
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
                                        table.options.meta?.locale,
                                    )}
                                </FacetedItemCount>
                            )}
                        </FacetedItem>
                    ))}
                </FacetedGroup>
            </FacetedList>
        </FacetedContent>
    );

    return multiple ? (
        <Faceted
            multiple
            items={items}
            value={toList(filter.value)}
            onValueChange={(value) => onChange(value ?? [])}
        >
            {trigger}
            {content}
        </Faceted>
    ) : (
        <Faceted
            items={items}
            value={toSingle(filter.value)}
            onValueChange={(value) => onChange(value ?? '')}
        >
            {trigger}
            {content}
        </Faceted>
    );
}

function DataTableFilterDateValue<TData extends RowData>({
    column,
    filter,
    onChange,
    ariaLabel,
    className,
}: DataTableFilterValueProps<TData> & { ariaLabel: string }) {
    const table = column.table;
    const dir = useDirection();
    const locale = table.options.meta?.locale;
    const calendarLocale = useCalendarLocale(table);
    const [open, setOpen] = React.useState(false);
    // Start of a range picked with the first click; the value only changes
    // with the second one.
    const [rangeStart, setRangeStart] = React.useState<Date>();
    const isRange = filter.operator === 'isBetween';
    const [from, to] = isRange
        ? toList(filter.value).map((value) => parseFilterDate(value))
        : [parseFilterDate(toSingle(filter.value)), undefined];
    const format = (date: Date | undefined) =>
        formatDate(date, { month: 'short' }, locale);
    const text = isRange
        ? [from, to].some(Boolean)
            ? `${format(from)} - ${format(to)}`
            : ''
        : from
          ? format(from)
          : '';

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                setRangeStart(undefined);
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    data-slot="data-table-filter-value"
                    variant="outline"
                    aria-label={ariaLabel}
                    className={cn(
                        'h-8 w-full justify-start font-normal',
                        !text && 'text-muted-foreground',
                        className,
                    )}
                >
                    <CalendarIcon />
                    <span className="truncate">
                        {text || getMessage(table, 'pick_date')}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                aria-label={ariaLabel}
                dir={dir}
                align="start"
                className="w-auto p-0"
            >
                {isRange ? (
                    <Calendar
                        {...calendarLocale}
                        autoFocus
                        captionLayout="dropdown"
                        mode="range"
                        defaultMonth={rangeStart ?? from ?? to}
                        selected={
                            rangeStart
                                ? { from: rangeStart, to: undefined }
                                : { from, to }
                        }
                        onSelect={(
                            _range: DateRange | undefined,
                            day: Date,
                        ) => {
                            const picked = pickDateRangeDay(rangeStart, day);

                            setRangeStart(picked.start);

                            if (picked.range) {
                                onChange(picked.range.map(formatFilterDate));
                                setOpen(false);
                            }
                        }}
                    />
                ) : (
                    <Calendar
                        {...calendarLocale}
                        autoFocus
                        captionLayout="dropdown"
                        mode="single"
                        defaultMonth={from}
                        selected={from}
                        onSelect={(date) => {
                            onChange(date ? formatFilterDate(date) : '');
                            setOpen(false);
                        }}
                    />
                )}
            </PopoverContent>
        </Popover>
    );
}

function toList(value: string | string[]): string[] {
    return Array.isArray(value) ? value : value === '' ? [] : [value];
}

function toSingle(value: string | string[]): string {
    return Array.isArray(value) ? (value[0] ?? '') : value;
}
