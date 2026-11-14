import type { FunctionalComponent, HTMLAttributes, VNodeChild } from 'vue';

import type { BadgeVariants } from '@/components/ui/badge';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { getFormatContext } from '@/lib/data-table-format';
import type { Cell, RowData } from '@/lib/data-table-tanstack';
import type { DataTableColumnMeta } from '@/lib/data-table-types';

/**
 * Props of the type cells: the TanStack cell. The other keys of the cell
 * context are accepted too, so a cell component can be the `cell` of a
 * column as is (`cell: DataTableNumberCell`).
 */
export interface DataTableCellProps<TData extends RowData = RowData> {
    cell: Cell<DataTableFeatures, TData>;
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

export function getCellSetup<TData extends RowData>(
    cell: Cell<DataTableFeatures, TData>,
) {
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
