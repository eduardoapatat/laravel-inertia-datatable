// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type {
    Cell,
    Column,
    RowData,
    SortingState,
    Table,
} from '@tanstack/react-table';

import type { DataTableFeatures } from '@/lib/data-table-features';
import type {
    ColumnDisplay,
    DataTableAlign,
    DataTableColumnMeta,
} from '@/lib/data-table-types';

// `end` adds room before the next column, which usually starts at its start.
const ALIGN_CLASSES: Record<DataTableAlign, string> = {
    start: 'text-start',
    center: 'text-center',
    end: 'pe-8 text-end',
};

export function getAriaSort(
    sorting: SortingState,
    columnId: string,
): React.AriaAttributes['aria-sort'] {
    const sort = sorting[0];
    if (sort?.id !== columnId) return undefined;
    return sort.desc ? 'descending' : 'ascending';
}

export function getVisibleSelectedRows<TData extends RowData>(
    table: Table<DataTableFeatures, TData>,
) {
    return table.getRowModel().rows.filter((row) => row.getIsSelected());
}

export function getColumnPinningStyle<TData extends RowData>(
    column: Column<DataTableFeatures, TData>,
    isPinned = column.getIsPinned(),
): React.CSSProperties {
    return {
        insetInlineStart:
            isPinned === 'start'
                ? `var(${getColumnVar(column.id, 'offset')})`
                : undefined,
        insetInlineEnd:
            isPinned === 'end'
                ? `var(${getColumnVar(column.id, 'offset')})`
                : undefined,
        position: isPinned ? 'sticky' : 'relative',
        // The width is the `w-(--cell-size)` class of the cell, so the Tailwind
        // classes of `meta.className` can replace it (an inline width cannot).
        ['--cell-size' as string]: `var(${getColumnVar(column.id, 'size')})`,
        zIndex: isPinned ? 20 : undefined,
    };
}

/**
 * Width class and the `meta` classes of a column, for its header or its cells
 * (to combine with `cn`, which lets a `w-*` of the page replace the default).
 */
export function getColumnClassName(
    meta: DataTableColumnMeta | undefined,
    part: 'header' | 'cell',
    cell?: Cell<DataTableFeatures, RowData>,
): string[] {
    const own =
        part === 'header'
            ? meta?.headerClassName
            : typeof meta?.cellClassName === 'function'
              ? cell
                  ? meta.cellClassName(cell)
                  : undefined
              : meta?.cellClassName;

    return [
        'w-(--cell-size)',
        ALIGN_CLASSES[getColumnAlign(meta)],
        meta?.className,
        own,
    ].filter((item): item is string => typeof item === 'string' && item !== '');
}

export function getColumnSizingStyle<TData extends RowData>(
    table: Table<DataTableFeatures, TData>,
): React.CSSProperties {
    // No minWidth: with `table-fixed` the browser already widens the table to
    // the sum of its columns, also when Tailwind classes change their width.
    const style: Record<string, string> = {};

    for (const header of table.getFlatHeaders()) {
        style[getColumnVar(header.column.id, 'size')] = `${header.getSize()}px`;
    }

    for (const { column } of table.getLeafHeaders()) {
        const isPinned = column.getIsPinned();
        if (!isPinned) continue;

        const offset =
            isPinned === 'start'
                ? column.getStart('start')
                : column.getAfter('end');
        style[getColumnVar(column.id, 'offset')] = `${offset}px`;
    }

    return style;
}

/**
 * Whether the default cell of the column is a number cell.
 */
export function isNumberColumn(meta: DataTableColumnMeta | undefined) {
    return meta?.display?.type === 'number';
}

/**
 * Whether the cells of the column show a badge (`->badge()`), a bit taller
 * than a line of text.
 */
export function hasBadge(display: ColumnDisplay | undefined) {
    return (
        display !== undefined && 'badge' in display && display.badge === true
    );
}

/**
 * Alignment of the header and the cells of a column: `meta.align`, else `end`
 * for numbers (figures line up) and `start` for the rest.
 */
export function getColumnAlign(
    meta: DataTableColumnMeta | undefined,
): DataTableAlign {
    return meta?.align ?? (isNumberColumn(meta) ? 'end' : 'start');
}

function getColumnVar(columnId: string, property: 'size' | 'offset') {
    const name = columnId.replace(
        /[^a-zA-Z0-9-]/g,
        (char) => `_${char.codePointAt(0)?.toString(16)}_`,
    );
    return `--column-${name}-${property}`;
}
