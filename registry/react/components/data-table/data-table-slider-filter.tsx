'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import { type Column, type RowData, Subscribe } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import * as React from 'react';

import {
    clearColumnFilter,
    type DataTableFeatures,
    getEmptyFilter,
} from '@/lib/data-table-features';
import {
    formatNumber,
    getEmptyLabel,
    getFilterAffixes,
    getUnit,
} from '@/lib/data-table-format';
import { getMessage } from '@/lib/data-table-messages';

import {
    getRangeFilterBounds,
    getValidRangeFilterBounds,
} from '@/lib/data-table-filter-values';
import {
    type DataTableFilterPieceProps,
    useDataTableFilterColumn,
} from '@/components/data-table/data-table-context';
import { DataTableEmptyFilter } from '@/components/data-table/data-table-empty-filter';
import { Button } from '@/components/ui/button';
import { useDirection } from '@/components/ui/direction';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { CirclePlus, CircleX } from 'lucide-react';

const INVALID_RING_DELAY_MS = 500;

type RangeValue = [number, number];

interface DataTableSliderFilterProps<
    TData extends RowData,
> extends DataTableFilterPieceProps<TData> {
    /** Step of the slider; by default about 50 steps between the bounds. */
    step?: number;
}

/**
 * Range filter of a number column with `->filterRange()`: a popover with the
 * two bounds and a slider between the min and max of the server.
 */
export function DataTableSliderFilter<TData extends RowData>({
    table,
    column: columnProp,
    ...props
}: DataTableSliderFilterProps<TData>) {
    const column = useDataTableFilterColumn(
        'DataTableSliderFilter',
        columnProp,
        table,
    );

    if (!column) return null;

    return (
        <Subscribe
            source={column.table.atoms.columnFilters}
            selector={() => ({
                value: column.getFilterValue(),
                empty: getEmptyFilter(column),
            })}
        >
            {({ value, empty }) => (
                <DataTableSliderFilterContent
                    column={column}
                    columnFilterValue={value}
                    includesEmpty={empty}
                    {...props}
                />
            )}
        </Subscribe>
    );
}

function DataTableSliderFilterContent<TData extends RowData>({
    column,
    title = column.columnDef.meta?.label ?? column.id,
    step: stepProp,
    icon: Icon = CirclePlus,
    className,
    contentClassName,
    align = 'start',
    disabled,
    columnFilterValue: columnFilterValueProp,
    includesEmpty,
}: Omit<DataTableSliderFilterProps<TData>, 'column' | 'table'> & {
    column: Column<DataTableFeatures, TData>;
    columnFilterValue: unknown;
    includesEmpty: boolean;
}) {
    const dir = useDirection();
    const id = React.useId();

    const meta = column.columnDef.meta;
    // The label of the filter shows the unit as the cells do.
    const unit = getUnit(meta, 'cell');

    // The server sends the bounds of the data; without rows it has none.
    const min = meta?.min ?? 0;
    const max = meta?.max ?? 100;
    const step = stepProp ?? getRangeStep(min, max);

    const bounds = parseRangeBounds(columnFilterValueProp);
    const columnFilterValue: RangeValue | undefined = bounds
        ? [bounds[0] ?? min, bounds[1] ?? max]
        : undefined;
    const range: RangeValue = columnFilterValue ?? [min, max];
    const [drafts, setDrafts] = React.useState<[string | null, string | null]>([
        null,
        null,
    ]);
    const [showInvalid, setShowInvalid] = React.useState(false);
    const invalidTimeoutRef = React.useRef<number | undefined>(undefined);

    React.useEffect(
        () => () => window.clearTimeout(invalidTimeoutRef.current),
        [],
    );

    function onInvalidChange(isInvalid: boolean) {
        window.clearTimeout(invalidTimeoutRef.current);
        if (!isInvalid) {
            setShowInvalid(false);
            return;
        }
        if (showInvalid) return;
        invalidTimeoutRef.current = window.setTimeout(
            () => setShowInvalid(true),
            INVALID_RING_DELAY_MS,
        );
    }

    const table = column.table;
    const locale = table.options.meta?.locale;
    // The bounds in the trigger use the format of the cells (`->money('CLP')`
    // → `$10 - $2.489`); a currency or percentage already says the unit.
    const display = meta?.display?.type === 'number' ? meta.display : undefined;
    const valueFormat = display?.format ?? { maximumFractionDigits: 2 };
    const showUnit = Boolean(unit) && valueFormat.style === undefined;
    // Next to the inputs: the unit, or the symbol and/or code of the currency.
    const affixes = getFilterAffixes(meta);
    // Wide enough for the longest bound (`2491510` does not fit in w-24).
    const digits = Math.max(String(min).length, String(max).length, 4);
    const inputStyle = {
        width: `calc(${digits}ch + ${2.75 + affixes.length * 1.5}rem)`,
    };
    const formatValue = React.useCallback(
        (value: number) =>
            formatNumber(value, valueFormat, locale, display?.currency?.cell),
        [valueFormat, locale, display?.currency?.cell],
    );

    const setRangeFilter = React.useCallback(
        ([start = min, end = max]: [
            number | undefined,
            number | undefined,
        ]) => {
            column.setFilterValue(
                start <= min && end >= max ? undefined : [start, end],
            );
        },
        [column, min, max],
    );

    function getInputValues(
        nextDrafts: [string | null, string | null],
    ): [string, string] {
        return [
            nextDrafts[0] ?? range[0].toString(),
            nextDrafts[1] ?? range[1].toString(),
        ];
    }

    function onDraftChange(index: 0 | 1, value: string) {
        const nextDrafts: [string | null, string | null] =
            index === 0 ? [value, drafts[1]] : [drafts[0], value];
        setDrafts(nextDrafts);

        const nextBounds = getValidRangeFilterBounds(
            getInputValues(nextDrafts),
            [min, max],
        );
        if (nextBounds) setRangeFilter(nextBounds);
        onInvalidChange(!nextBounds);
    }

    function onDraftCommit() {
        if (drafts[0] === null && drafts[1] === null) return;

        setRangeFilter(
            getRangeFilterBounds(getInputValues(drafts), [min, max]),
        );
        setDrafts([null, null]);
        onInvalidChange(false);
    }

    function onInputsBlur(event: React.FocusEvent<HTMLDivElement>) {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        onDraftCommit();
    }

    function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter') onDraftCommit();
    }

    function onSliderValueChange(value: RangeValue) {
        if (Array.isArray(value) && value.length === 2) {
            setDrafts([null, null]);
            onInvalidChange(false);
            setRangeFilter([value[0], value[1]]);
        }
    }

    function onReset(event: React.MouseEvent) {
        event.stopPropagation();
        setDrafts([null, null]);
        onInvalidChange(false);
        clearColumnFilter(column);
    }

    const hasFilter = Boolean(columnFilterValue) || includesEmpty;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn('border-dashed', className)}
                    disabled={disabled}
                >
                    {hasFilter ? (
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
                    <span>{title}</span>
                    {hasFilter ? (
                        <>
                            <Separator
                                orientation="vertical"
                                className="mx-0.5 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                            />
                            {columnFilterValue && (
                                <>
                                    {formatValue(columnFilterValue[0])} -{' '}
                                    {formatValue(columnFilterValue[1])}
                                    {showUnit ? ` ${unit}` : ''}
                                </>
                            )}
                            {columnFilterValue && includesEmpty && ', '}
                            {includesEmpty && getEmptyLabel(meta, table)}
                        </>
                    ) : null}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                aria-label={getMessage(table, 'filter', { label: title })}
                dir={dir}
                align={align}
                className={cn('flex w-auto flex-col gap-4', contentClassName)}
            >
                <div className="flex flex-col gap-3">
                    <Label>{title}</Label>
                    <div
                        className="flex items-center gap-4"
                        onBlur={onInputsBlur}
                    >
                        <Label htmlFor={`${id}-from`} className="sr-only">
                            {getMessage(table, 'from')}
                        </Label>
                        <InputGroup style={inputStyle}>
                            <InputGroupInput
                                id={`${id}-from`}
                                type="number"
                                aria-valuemin={min}
                                aria-valuemax={max}
                                aria-invalid={
                                    (showInvalid && drafts[0] !== null) ||
                                    undefined
                                }
                                inputMode="decimal"
                                placeholder={min.toString()}
                                min={min}
                                max={max}
                                value={drafts[0] ?? range[0].toString()}
                                onChange={(event) =>
                                    onDraftChange(0, event.target.value)
                                }
                                onKeyDown={onInputKeyDown}
                            />
                            {affixes.map((affix) => (
                                <InputGroupAddon
                                    key={affix.align}
                                    align={affix.align}
                                >
                                    <InputGroupText>
                                        {affix.text}
                                    </InputGroupText>
                                </InputGroupAddon>
                            ))}
                        </InputGroup>
                        <Label htmlFor={`${id}-to`} className="sr-only">
                            {getMessage(table, 'to')}
                        </Label>
                        <InputGroup style={inputStyle}>
                            <InputGroupInput
                                id={`${id}-to`}
                                type="number"
                                aria-valuemin={min}
                                aria-valuemax={max}
                                aria-invalid={
                                    (showInvalid && drafts[1] !== null) ||
                                    undefined
                                }
                                inputMode="decimal"
                                placeholder={max.toString()}
                                min={min}
                                max={max}
                                value={drafts[1] ?? range[1].toString()}
                                onChange={(event) =>
                                    onDraftChange(1, event.target.value)
                                }
                                onKeyDown={onInputKeyDown}
                            />
                            {affixes.map((affix) => (
                                <InputGroupAddon
                                    key={affix.align}
                                    align={affix.align}
                                >
                                    <InputGroupText>
                                        {affix.text}
                                    </InputGroupText>
                                </InputGroupAddon>
                            ))}
                        </InputGroup>
                    </div>
                    <Label htmlFor={`${id}-slider`} className="sr-only">
                        {getMessage(table, 'slider', { label: title })}
                    </Label>
                    <Slider
                        id={`${id}-slider`}
                        min={min}
                        max={max}
                        step={step}
                        value={range}
                        onValueChange={onSliderValueChange}
                    />
                    {meta?.empty && (
                        <DataTableEmptyFilter
                            column={column}
                            checked={includesEmpty}
                        />
                    )}
                </div>
                <Button
                    aria-label={getMessage(table, 'clear_filter', {
                        label: title,
                    })}
                    variant="outline"
                    onClick={onReset}
                >
                    {getMessage(table, 'clear')}
                </Button>
            </PopoverContent>
        </Popover>
    );
}

function getRangeStep(min: number, max: number) {
    const rangeSize = max - min;
    if (rangeSize <= 20) return 1;
    if (rangeSize <= 100) return Math.ceil(rangeSize / 20);
    return Math.ceil(rangeSize / 50);
}

function parseRangeBounds(
    value: unknown,
): [number | undefined, number | undefined] | undefined {
    if (!Array.isArray(value) || value.length !== 2) return undefined;

    const [start, end] = value.map(parseRangeBound);
    if (start === null || end === null) return undefined;
    if (start === undefined && end === undefined) return undefined;

    return [start, end];
}

function parseRangeBound(value: unknown) {
    if (value === undefined || value === '') return undefined;
    if (typeof value !== 'number' && typeof value !== 'string') return null;

    const number = Number(value);
    return Number.isNaN(number) ? null : number;
}
