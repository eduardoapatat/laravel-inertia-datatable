'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { DateRange } from 'react-day-picker';

import { type Column, type RowData, Subscribe } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import * as React from 'react';

import type { ColumnFilter } from '@/lib/data-table-tanstack';
import {
    clearColumnFilter,
    type DataTableFeatures,
    getEmptyFilter,
    getRelativeFilter,
    setRelativeFilter,
} from '@/lib/data-table-features';

import { formatDate, getEmptyLabel } from '@/lib/data-table-format';
import {
    type DataTableMessageKey,
    getMessage,
    getWeekStartsOn,
    type TableWithMeta,
} from '@/lib/data-table-messages';
import { pickDateRangeDay } from '@/lib/data-table-filter-values';
import {
    formatRelativeDateRange,
    getRelativeDateLabel,
    RELATIVE_DATE_PRESETS,
} from '@/lib/data-table-relative-date';
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
 * with `->filterRange()`. With `presets: true`, periods relative to today
 * (`rel`) next to the calendar.
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

    const multiple = column.columnDef.meta?.filterVariant === 'date-range';

    return (
        <Subscribe
            source={column.table.atoms.columnFilters}
            selector={() => ({
                value: column.getFilterValue(),
                empty: getEmptyFilter(column),
                relative: getRelativeFilter(column),
            })}
        >
            {({ value, empty, relative }) => (
                <DataTableDateFilterContent
                    column={column}
                    multiple={multiple}
                    columnFilterValue={value}
                    includesEmpty={empty}
                    relativeFilter={relative}
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
    relativeFilter,
}: Omit<DataTableDateFilterProps<TData>, 'column' | 'table'> & {
    column: Column<DataTableFeatures, TData>;
    multiple: boolean;
    columnFilterValue: unknown;
    includesEmpty: boolean;
    relativeFilter: ColumnFilter | undefined;
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

    // Start of a range picked with the first click; the filter only changes
    // with the second one, so the table does not search a one-day range.
    const [rangeStart, setRangeStart] = React.useState<Date>();

    const presets = column.columnDef.meta?.presets ?? false;
    const relativeToken =
        typeof relativeFilter?.value === 'string' && relativeFilter.value !== ''
            ? relativeFilter.value
            : undefined;
    const message = (
        key: DataTableMessageKey,
        replacements?: Record<string, string | number>,
    ) => getMessage(table, key, replacements);

    const onSelect = React.useCallback(
        (date: Date | undefined) => {
            // A picked day replaces the period relative to today.
            setRelativeFilter(column, undefined);
            column.setFilterValue(date ? date.getTime() : undefined);
        },
        [column],
    );

    const onPreset = React.useCallback(
        (token: string) => {
            setRangeStart(undefined);
            setRelativeFilter(
                column,
                token === relativeToken ? undefined : token,
            );
        },
        [column, relativeToken],
    );

    const onRangeSelect = React.useCallback(
        (_range: DateRange | undefined, day: Date) => {
            const picked = pickDateRangeDay(rangeStart, day);

            setRangeStart(picked.start);

            if (picked.range) {
                setRelativeFilter(column, undefined);
                column.setFilterValue([
                    picked.range[0].getTime(),
                    picked.range[1].getTime(),
                ]);
            }
        },
        [column, rangeStart],
    );

    const onReset = React.useCallback(
        (event: React.MouseEvent) => {
            event.stopPropagation();
            setRangeStart(undefined);
            clearColumnFilter(column);
        },
        [column],
    );

    const hasDates = getIsDateRange(selectedDates)
        ? Boolean(selectedDates.from || selectedDates.to)
        : selectedDates.length > 0;
    const hasValue = hasDates || includesEmpty || relativeToken !== undefined;
    const dateText = [
        relativeToken !== undefined
            ? getRelativeDateLabel(relativeToken, message)
            : hasDates
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
                        title={[
                            dateText,
                            formatRelativeDateRange(
                                relativeFilter?.range,
                                locale,
                            ),
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                        className="max-w-32 truncate sm:max-w-none"
                    >
                        {dateText}
                    </span>
                </>
            )}
        </span>
    );

    return (
        <Popover onOpenChange={() => setRangeStart(undefined)}>
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
                <div className="flex flex-col sm:flex-row">
                    {presets && (
                        <div
                            role="group"
                            aria-label={getMessage(table, 'pick_period')}
                            className="flex flex-col gap-0.5 border-b p-2 sm:border-e sm:border-b-0"
                        >
                            {RELATIVE_DATE_PRESETS.map((token) => (
                                <Button
                                    key={token}
                                    variant="ghost"
                                    size="sm"
                                    aria-pressed={token === relativeToken}
                                    className="justify-start font-normal aria-pressed:bg-accent aria-pressed:text-accent-foreground"
                                    onClick={() => onPreset(token)}
                                >
                                    {getRelativeDateLabel(token, message)}
                                </Button>
                            ))}
                        </div>
                    )}
                    {multiple ? (
                        <Calendar
                            {...calendarLocale}
                            autoFocus
                            captionLayout="dropdown"
                            mode="range"
                            defaultMonth={
                                rangeStart ??
                                (getIsDateRange(selectedDates)
                                    ? (selectedDates.from ?? selectedDates.to)
                                    : undefined)
                            }
                            selected={
                                rangeStart
                                    ? { from: rangeStart, to: undefined }
                                    : getIsDateRange(selectedDates)
                                      ? selectedDates
                                      : { from: undefined, to: undefined }
                            }
                            onSelect={onRangeSelect}
                        />
                    ) : (
                        <Calendar
                            {...calendarLocale}
                            captionLayout="dropdown"
                            mode="single"
                            defaultMonth={
                                !getIsDateRange(selectedDates)
                                    ? selectedDates[0]
                                    : undefined
                            }
                            selected={
                                !getIsDateRange(selectedDates)
                                    ? selectedDates[0]
                                    : undefined
                            }
                            onSelect={onSelect}
                        />
                    )}
                </div>
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
export function useCalendarLocale(table: TableWithMeta) {
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
                labelMonthDropdown: () => getMessage(tableTexts, 'month'),
                labelYearDropdown: () => getMessage(tableTexts, 'year'),
            },
        };
    }, [locale, messages]);
}
