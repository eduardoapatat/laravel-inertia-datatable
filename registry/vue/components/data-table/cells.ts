import type { FunctionalComponent, HTMLAttributes, VNodeChild } from 'vue';

import type { BadgeVariants } from '@/components/ui/badge';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { getFormatContext } from '@/lib/data-table-format';
import type { TableWithMeta } from '@/lib/data-table-messages';
import type { Cell, SortingState } from '@/lib/data-table-tanstack';
import type { DataTableColumnMeta } from '@/lib/data-table-types';

/**
 * A cell of any row type: the type cells read its value and its column, not
 * the row. Not generic, so `h(DataTableNumberCell, { cell })` type checks.
 */
export type DataTableAnyCell = Cell<DataTableFeatures, any>;

/**
 * A column of any row type, with only what the headers read: its label and its
 * sort and hide menu. A TanStack column of any table fits it, so
 * `h(DataTableColumnHeader, { column, label })` type checks in a custom header.
 */
export interface DataTableAnyColumn {
    id: string;
    table: TableWithMeta & {
        atoms: { sorting: { get: () => SortingState } };
    };
    columnDef: { meta?: DataTableColumnMeta };
    getCanSort: () => boolean;
    getCanHide: () => boolean;
    clearSorting: () => void;
    toggleSorting: (desc?: boolean, isMulti?: boolean) => void;
    toggleVisibility: (value?: boolean) => void;
}

/**
 * Props of the type cells: the TanStack cell (`h(DataTableNumberCell, { cell })`).
 * The other keys of the cell context are accepted too, so they never end up
 * as attributes of the cell.
 */
export interface DataTableCellProps {
    cell: DataTableAnyCell;
    column?: unknown;
    row?: unknown;
    table?: unknown;
    getValue?: unknown;
    renderValue?: unknown;
}

/** Variants of the project's `components/ui/badge`. */
export type DataTableBadgeVariant = BadgeVariants['variant'];

/** Props of the project's Badge that a cell can set per value. */
export interface DataTableBadgeProps {
    variant?: DataTableBadgeVariant;
    class?: HTMLAttributes['class'];
}

export function getCellSetup(cell: DataTableAnyCell) {
    const context = getFormatContext(cell.table);

    return {
        meta: cell.column.columnDef.meta as DataTableColumnMeta | undefined,
        locale: context.locale,
        context,
    };
}

/** Renders what a render function (`renderOption`, a slot) returns. */
export const DataTableRender: FunctionalComponent<{ node: VNodeChild }> = (
    props,
) => props.node;

DataTableRender.props = ['node'];
