'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { DateRange } from 'react-day-picker';

import { type Column, type RowData, Subscribe } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import * as React from 'react';

import {
    clearColumnFilter,
    type DataTableFeatures,
    getEmptyFilter,
} from '@/lib/data-table-features';

import { formatDate, getEmptyLabel } from '@/lib/data-table-format';
import {
    getMessage,
    getWeekStartsOn,
    type TableWithMeta,
} from '@/lib/data-table-messages';
import { getFilterVariant } from '@/lib/data-table-utils';
import {
    type DataTableFilterPieceProps,
    useDataTableFilterColumn,
} from '@/components/data-table/data-table-context';
import { DataTableEmptyFilter } from '@/components/data-table/data-table-empty-filter';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useDirection } from '@/components/ui/direction';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, CircleX } from 'lucide-react';

type DateSelection = Date[] | DateRange;

type DataTableDateFilterProps<TData extends RowData> =
    DataTableFilterPieceProps<TData>;

/**
 * Calendar filter of a date column: one day with `->filterDate()`, a range
 * with `->filterRange()`.
 */
export function DataTableDateFilter<TData extends RowData>({
    table,
    column: columnProp,
    ...props
}: DataTableDateFilterProps<TData>) {
    const column = useDataTableFilterColumn(
        'DataTableDateFilter',
        columnProp,
        table,
    );

    if (!column) return null;

    const multiple = getFilterVariant(column.columnDef.meta) === 'date-range';

    return (
        <Subscribe
            source={column.table.atoms.columnFilters}
            selector={() => ({
                value: column.getFilterValue(),
                empty: getEmptyFilter(column),
            })}
        >
            {({ value, empty }) => (
                <DataTableDateFilterContent
                    column={column}
                    multiple={multiple}
                    columnFilterValue={value}
                    includesEmpty={empty}
                    {...props}
                />
            )}
        </Subscribe>
    );
}

function DataTableDateFilterContent<TData extends RowData>({
    column,
    title = column.columnDef.meta?.label ?? column.id,
    multiple,
    icon: Icon = CalendarIcon,
    className,
    contentClassName,
    align = 'start',
    disabled,
    columnFilterValue,
    includesEmpty,
}: Omit<DataTableDateFilterProps<TData>, 'column' | 'table'> & {
    column: Column<DataTableFeatures, TData>;
    multiple: boolean;
    columnFilterValue: unknown;
    includesEmpty: boolean;
}) {
    const dir = useDirection();
    const table = column.table;
    const locale = table.options.meta?.locale;
    const calendarLocale = useCalendarLocale(table);
    const selectedDates = React.useMemo<DateSelection>(() => {
        if (!columnFilterValue) {
            return multiple ? { from: undefined, to: undefined } : [];
        }

        const timestamps = parseColumnFilterValue(columnFilterValue);
        if (multiple) {
            return {
                from: parseAsDate(timestamps[0]),
                to: parseAsDate(timestamps[1]),
            };
        }

        const date = parseAsDate(timestamps[0]);
        return date ? [date] : [];
    }, [columnFilterValue, multiple]);

    const onSelect = React.useCallback(
        (date: Date | DateRange | undefined) => {
            if (!date) {
                column.setFilterValue(undefined);
                return;
            }

            if (multiple && !('getTime' in date)) {
                const from = date.from?.getTime();
                const to = date.to?.getTime();
                column.setFilterValue(from || to ? [from, to] : undefined);
            } else if (!multiple && 'getTime' in date) {
                column.setFilterValue(date.getTime());
            }
        },
        [column, multiple],
    );

    const onReset = React.useCallback(
        (event: React.MouseEvent) => {
            event.stopPropagation();
            clearColumnFilter(column);
        },
        [column],
    );

    const hasDates = getIsDateRange(selectedDates)
        ? Boolean(selectedDates.from || selectedDates.to)
        : selectedDates.length > 0;
    const hasValue = hasDates || includesEmpty;
    const dateText = [
        hasDates
            ? getIsDateRange(selectedDates)
                ? formatDateRange(selectedDates, locale)
                : formatDate(selectedDates[0], { month: 'short' }, locale)
            : '',
        includesEmpty ? getEmptyLabel(column.columnDef.meta, table) : '',
    ]
        .filter(Boolean)
        .join(', ');

    const label = (
        <span className="flex min-w-0 items-center gap-2">
            <span>{title}</span>
            {hasValue && (
                <>
                    <Separator
                        orientation="vertical"
                        className="mx-0.5 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                    />
                    {/* Long ranges are cut on small screens; the title shows them whole. */}
                    <span
                        title={dateText}
                        className="max-w-32 truncate sm:max-w-none"
                    >
                        {dateText}
                    </span>
                </>
            )}
        </span>
    );

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn('border-dashed', className)}
                    disabled={disabled}
                >
                    {hasValue ? (
                        <span
                            aria-hidden="true"
                            className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
                            onClick={onReset}
                        >
                            <CircleX />
                        </span>
                    ) : (
                        Icon && <Icon />
                    )}
                    {label}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                aria-label={getMessage(table, 'filter', { label: title })}
                dir={dir}
                className={cn('w-auto p-0', contentClassName)}
                align={align}
            >
                {multiple ? (
                    <Calendar
                        {...calendarLocale}
                        autoFocus
                        captionLayout="dropdown"
                        mode="range"
                        selected={
                            getIsDateRange(selectedDates)
                                ? selectedDates
                                : { from: undefined, to: undefined }
                        }
                        onSelect={onSelect}
                    />
                ) : (
                    <Calendar
                        {...calendarLocale}
                        captionLayout="dropdown"
                        mode="single"
                        selected={
                            !getIsDateRange(selectedDates)
                                ? selectedDates[0]
                                : undefined
                        }
                        onSelect={onSelect}
                    />
                )}
                {column.columnDef.meta?.empty && (
                    <>
                        <Separator />
                        <div className="p-3">
                            <DataTableEmptyFilter
                                column={column}
                                checked={includesEmpty}
                            />
                        </div>
                    </>
                )}
                {hasValue && (
                    <>
                        <Separator />
                        <div className="p-3">
                            <Button
                                aria-label={getMessage(table, 'clear_filter', {
                                    label: title,
                                })}
                                variant="outline"
                                className="w-full"
                                onClick={onReset}
                            >
                                {getMessage(table, 'clear')}
                            </Button>
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}

function parseColumnFilterValue(value: unknown) {
    if (Array.isArray(value)) {
        return value.map((item) =>
            typeof item === 'number' || typeof item === 'string'
                ? item
                : undefined,
        );
    }
    if (typeof value === 'string' || typeof value === 'number') return [value];
    return [];
}

function parseAsDate(timestamp: number | string | undefined): Date | undefined {
    if (!timestamp) return undefined;
    const numericTimestamp =
        typeof timestamp === 'string' ? Number(timestamp) : timestamp;
    const date = new Date(numericTimestamp);
    return !Number.isNaN(date.getTime()) ? date : undefined;
}

function getIsDateRange(value: DateSelection): value is DateRange {
    return !Array.isArray(value);
}

function formatDateRange(range: DateRange, locale?: string) {
    const format = (date: Date | undefined) =>
        formatDate(date, { month: 'short' }, locale);

    if (range.from && range.to) {
        return `${format(range.from)} - ${format(range.to)}`;
    }
    return format(range.from ?? range.to);
}

/**
 * Month and day names, first day of the week and navigation texts of the
 * calendar in the table locale, with Intl (no date-fns locales needed).
 */
function useCalendarLocale(table: TableWithMeta) {
    const locale = table.options.meta?.locale;
    const messages = table.options.meta?.messages;

    return React.useMemo(() => {
        const intl = (options: Intl.DateTimeFormatOptions) => {
            let formatter: Intl.DateTimeFormat;

            try {
                formatter = new Intl.DateTimeFormat(locale, options);
            } catch {
                formatter = new Intl.DateTimeFormat(undefined, options);
            }

            return (date: Date) => formatter.format(date);
        };
        const tableTexts = { options: { meta: { messages } } };

        return {
            weekStartsOn: getWeekStartsOn(locale),
            formatters: {
                formatCaption: intl({ month: 'long', year: 'numeric' }),
                formatMonthDropdown: intl({ month: 'short' }),
                formatYearDropdown: intl({ year: 'numeric' }),
                formatWeekdayName: intl({ weekday: 'short' }),
            },
            labels: {
                labelGrid: intl({ month: 'long', year: 'numeric' }),
                labelWeekday: intl({ weekday: 'long' }),
                labelDayButton: intl({ dateStyle: 'full' }),
                labelPrevious: () => getMessage(tableTexts, 'previous_month'),
                labelNext: () => getMessage(tableTexts, 'next_month'),
            },
        };
    }, [locale, messages]);
}
