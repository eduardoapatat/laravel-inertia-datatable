import type { HeaderContext, RowData } from '@tanstack/react-table';

import { DataTableCell } from '@/components/data-table/data-table-cells';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/lib/data-table-features';
import type { DataTableColumnMeta } from '@/lib/data-table-types';

export {
    formatCellValue,
    getOption,
    getOptionLabel,
} from '@/lib/data-table-format';

/**
 * Header of a column the component does not customize: the label declared by
 * the table class, with sorting and hiding when the column allows them.
 */
export function DataTableDefaultHeader<TData extends RowData, TValue>({
    column,
}: HeaderContext<DataTableFeatures, TData, TValue>) {
    const meta = column.columnDef.meta as DataTableColumnMeta | undefined;

    return (
        <DataTableColumnHeader
            column={column}
            label={meta?.label ?? column.id}
        />
    );
}

/**
 * Cell of a column the component does not customize, formatted with the
 * column `display` or its filter variant (see `data-table-cells`).
 */
export const DataTableDefaultCell = DataTableCell;
