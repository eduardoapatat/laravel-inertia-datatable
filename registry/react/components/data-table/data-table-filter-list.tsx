'use client';

// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import {
    type Column,
    type ColumnFiltersState,
    type ReactTable,
    type RowData,
    Subscribe,
} from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import * as React from 'react';

import {
    changeFilterOperator,
    createFilterListItem,
    FILTER_OPERATORS,
    type FilterJoinCell,
    type FilterListRow,
    getFilterListItems,
    getFilterOperatorMessageKey,
    getIsRowComplete,
    getRowFilters,
    getRowJoinCells,
    reconcileFilterRows,
    setRowsEmpty,
    updateRowFilter,
} from '@/lib/data-table-advanced';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { getMessage } from '@/lib/data-table-messages';
import type { FilterOperator, JoinOperator } from '@/lib/data-table-server';
import type { ColumnFilterItem } from '@/lib/data-table-types';

import { useDataTable } from '@/components/data-table/data-table-context';
import { DataTableFilterValue } from '@/components/data-table/data-table-filter-value';
import { Badge } from '@/components/ui/badge';
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
import { ChevronsUpDown, ListFilter, Trash2 } from 'lucide-react';

type FilterColumn<TData extends RowData> = Column<DataTableFeatures, TData>;

interface DataTableFilterListProps<TData extends RowData> extends Omit<
    React.ComponentProps<typeof PopoverContent>,
    'className'
> {
    /** Not needed inside `DataTableProvider`. */
    table?: ReactTable<DataTableFeatures, TData, unknown>;
    disabled?: boolean;
    /** Classes of the button. */
    className?: string;
    /** Classes of the popover. */
    contentClassName?: string;
    /** Icon of the button; `null` hides it. */
    icon?: React.ComponentType<React.ComponentProps<'svg'>> | null;
}

/**
 * Advanced filters: a row per filter with its column, operator and value,
 * combined with AND or OR (`join`). It edits the same filters as the toolbar,
 * so a toolbar filter shows up here as a row.
 */
export function DataTableFilterList<TData extends RowData>({
    table: tableProp,
    ...props
}: DataTableFilterListProps<TData>) {
    const table = useDataTable(tableProp, 'DataTableFilterList');

    return (
        <Subscribe source={table.atoms.columnFilters}>
            {(columnFilters) => (
                <DataTableFilterListContent
                    table={table}
                    columnFilters={columnFilters}
                    {...props}
                />
            )}
        </Subscribe>
    );
}

function DataTableFilterListContent<TData extends RowData>({
    table,
    columnFilters,
    disabled,
    className,
    contentClassName,
    icon: Icon = ListFilter,
    align = 'start',
    ...props
}: Omit<DataTableFilterListProps<TData>, 'table'> & {
    table: ReactTable<DataTableFeatures, TData, unknown>;
    columnFilters: ColumnFiltersState;
}) {
    const dir = useDirection();
    const id = React.useId();
    const nextKey = React.useRef(0);
    const createKey = React.useCallback(
        () => `${id}-${++nextKey.current}`,
        [id],
    );
    const columns = table
        .getAllColumns()
        .filter(
            (column) =>
                column.getCanFilter() &&
                column.columnDef.meta?.filterVariant !== undefined,
        );
    const getColumn = (columnId: string) =>
        columns.find((column) => column.id === columnId);
    const items = getFilterListItems(
        columnFilters,
        (columnId) => getColumn(columnId)?.columnDef.meta?.filterVariant,
    );

    const [rows, setRows] = React.useState<FilterListRow[]>(() =>
        reconcileFilterRows([], items, createKey),
    );
    const [syncedFilters, setSyncedFilters] = React.useState(columnFilters);

    // A change of the table filters (the server answer, the toolbar) keeps the
    // rows in place, also those still without a value.
    if (syncedFilters !== columnFilters) {
        setSyncedFilters(columnFilters);
        setRows((current) => reconcileFilterRows(current, items, createKey));
    }

    const meta = table.options.meta;
    const join = meta?.join ?? 'and';
    const maxFilters = meta?.maxFilters ?? Infinity;
    const joinCells = getRowJoinCells(rows, join);
    const addButtonRef = React.useRef<HTMLButtonElement>(null);

    function commit(next: FilterListRow[]) {
        const sent = getRowFilters(rows);
        const filters = getRowFilters(next);

        setRows(next);

        if (signature(sent) !== signature(filters)) {
            table.setColumnFilters(filters);
        }
    }

    function updateRow(key: string, filter: ColumnFilterItem) {
        commit(updateRowFilter(rows, key, filter));
    }

    function setRowEmpty(columnId: string, include: boolean) {
        commit(setRowsEmpty(rows, columnId, include));
    }

    function addRow() {
        const [column] = columns;
        const variant = column?.columnDef.meta?.filterVariant;

        if (!column || !variant) return;

        const key = createKey();

        setRows([
            ...rows,
            {
                key,
                filter: createFilterListItem(column.id, variant, key),
                includesEmpty: false,
            },
        ]);
    }

    function removeRow(key: string) {
        commit(rows.filter((row) => row.key !== key));
        addButtonRef.current?.focus();
    }

    function reset() {
        setRows([]);
        table.setColumnFilters([]);
        if (join !== 'and') meta?.setJoin?.('and');
    }

    const appliedCount = rows.filter(getIsRowComplete).length;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    data-slot="data-table-filter-list-trigger"
                    variant="outline"
                    className={className}
                    disabled={disabled}
                >
                    {Icon && <Icon className="text-muted-foreground" />}
                    {getMessage(table, 'filters')}
                    {appliedCount > 0 && (
                        <Badge
                            variant="secondary"
                            className="h-[18.24px] rounded-[3.2px] px-[5.12px] font-mono text-[10.4px] font-normal"
                        >
                            {appliedCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                data-slot="data-table-filter-list"
                aria-label={getMessage(table, 'filters')}
                dir={dir}
                align={align}
                className={cn(
                    'flex w-[calc(100vw-2rem)] max-w-[44rem] flex-col gap-3.5 p-4',
                    contentClassName,
                )}
                {...props}
            >
                <div className="flex flex-col gap-1">
                    <h4 className="leading-none font-medium">
                        {rows.length > 0
                            ? getMessage(table, 'filters')
                            : getMessage(table, 'filters_none')}
                    </h4>
                    {rows.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                            {getMessage(table, 'filters_description')}
                        </p>
                    )}
                </div>
                {rows.length > 0 && (
                    <div
                        role="list"
                        className="flex max-h-80 flex-col gap-2 overflow-y-auto py-0.5"
                    >
                        {rows.map((row, index) => {
                            const column = getColumn(row.filter.id);

                            return column ? (
                                <DataTableFilterItem
                                    key={row.key}
                                    row={row}
                                    joinCell={joinCells[index] ?? 'and'}
                                    column={column}
                                    columns={columns}
                                    join={join}
                                    onJoinChange={meta?.setJoin}
                                    onChange={(filter) =>
                                        updateRow(row.key, filter)
                                    }
                                    onIncludesEmptyChange={(include) =>
                                        setRowEmpty(row.filter.id, include)
                                    }
                                    onRemove={() => removeRow(row.key)}
                                />
                            ) : null;
                        })}
                    </div>
                )}
                <div className="flex w-full items-center gap-2">
                    <Button
                        ref={addButtonRef}
                        size="sm"
                        className="rounded"
                        disabled={
                            columns.length === 0 || rows.length >= maxFilters
                        }
                        onClick={addRow}
                    >
                        {getMessage(table, 'add_filter')}
                    </Button>
                    {rows.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded"
                            onClick={reset}
                        >
                            {getMessage(table, 'reset_filters')}
                        </Button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

interface DataTableFilterItemProps<TData extends RowData> {
    row: FilterListRow;
    joinCell: FilterJoinCell;
    column: FilterColumn<TData>;
    columns: FilterColumn<TData>[];
    join: JoinOperator;
    onJoinChange?: (join: JoinOperator) => void;
    onChange: (filter: ColumnFilterItem) => void;
    onIncludesEmptyChange: (include: boolean) => void;
    onRemove: () => void;
}

function DataTableFilterItem<TData extends RowData>({
    row,
    joinCell,
    column,
    columns,
    join,
    onJoinChange,
    onChange,
    onIncludesEmptyChange,
    onRemove,
}: DataTableFilterItemProps<TData>) {
    const table = column.table;
    const dir = useDirection();
    const { filter } = row;
    const label = column.columnDef.meta?.label ?? column.id;
    const joinText = getMessage(
        table,
        joinCell === 'or' ? 'filter_or' : 'filter_and',
    );

    return (
        <div
            role="listitem"
            data-slot="data-table-filter-item"
            data-column={filter.id}
            className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
        >
            <div className="w-18 shrink-0 text-sm text-muted-foreground">
                {joinCell === 'where' ? (
                    getMessage(table, 'filter_where')
                ) : joinCell === 'select' && onJoinChange ? (
                    <Select
                        value={join}
                        onValueChange={(value) =>
                            onJoinChange(value as JoinOperator)
                        }
                    >
                        <SelectTrigger
                            aria-label={getMessage(table, 'filter_join')}
                            className="h-8 w-full lowercase"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="min-w-(--radix-select-trigger-width)">
                            {(['and', 'or'] as const).map((value) => (
                                <SelectItem
                                    key={value}
                                    value={value}
                                    className="lowercase"
                                >
                                    {getMessage(
                                        table,
                                        value === 'or'
                                            ? 'filter_or'
                                            : 'filter_and',
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <span className="lowercase">{joinText}</span>
                )}
            </div>
            <Faceted
                value={filter.id}
                onValueChange={(columnId) => {
                    const next = columns.find((item) => item.id === columnId);
                    const variant = next?.columnDef.meta?.filterVariant;

                    if (next && variant && columnId !== filter.id) {
                        onChange(
                            createFilterListItem(next.id, variant, row.key),
                        );
                    }
                }}
            >
                <FacetedTrigger asChild>
                    <Button
                        variant="outline"
                        aria-label={getMessage(table, 'field')}
                        className="h-8 w-36 shrink-0 justify-between font-normal"
                    >
                        <span className="truncate">{label}</span>
                        <ChevronsUpDown className="text-muted-foreground" />
                    </Button>
                </FacetedTrigger>
                <FacetedContent dir={dir} align="start" className="w-48">
                    <FacetedInput
                        placeholder={getMessage(table, 'search_fields')}
                    />
                    <FacetedList>
                        <FacetedEmpty>
                            {getMessage(table, 'no_fields')}
                        </FacetedEmpty>
                        <FacetedGroup>
                            {columns.map((item) => (
                                <FacetedItem key={item.id} value={item.id}>
                                    <span className="truncate">
                                        {item.columnDef.meta?.label ?? item.id}
                                    </span>
                                    <FacetedItemIndicator />
                                </FacetedItem>
                            ))}
                        </FacetedGroup>
                    </FacetedList>
                </FacetedContent>
            </Faceted>
            <Select
                value={filter.operator}
                onValueChange={(operator) =>
                    onChange(
                        changeFilterOperator(
                            filter,
                            operator as FilterOperator,
                        ),
                    )
                }
            >
                <SelectTrigger
                    aria-label={getMessage(table, 'filter_operator', {
                        label,
                    })}
                    className="h-8 w-40 shrink-0"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {FILTER_OPERATORS[filter.variant].map((operator) => (
                        <SelectItem key={operator} value={operator}>
                            {getMessage(
                                table,
                                getFilterOperatorMessageKey(
                                    filter.variant,
                                    operator,
                                ),
                            )}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <DataTableFilterValue
                column={column}
                filter={filter}
                includesEmpty={row.includesEmpty}
                className="min-w-40 flex-1"
                onChange={(value) => onChange({ ...filter, value })}
                onIncludesEmptyChange={onIncludesEmptyChange}
            />
            <Button
                variant="outline"
                size="icon"
                aria-label={getMessage(table, 'remove_filter', { label })}
                className="size-8 shrink-0"
                onClick={onRemove}
            >
                <Trash2 />
            </Button>
        </div>
    );
}

/** What the server receives of some filters, to skip a visit that changes nothing. */
function signature(filters: ColumnFilterItem[]) {
    return JSON.stringify(
        filters.map((filter) => [filter.id, filter.operator, filter.value]),
    );
}
