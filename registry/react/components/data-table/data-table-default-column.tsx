import type {
    CellContext,
    HeaderContext,
    RowData,
} from '@tanstack/react-table';

import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import type { DataTableFeatures } from '@/lib/data-table-features';
import { formatDate } from '@/lib/data-table-format';
import type { DataTableColumnMeta } from '@/lib/data-table-types';

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
 * Cell of a column the component does not customize, formatted according to
 * the filter declared by the table class.
 */
export function DataTableDefaultCell<TData extends RowData, TValue>({
    cell,
    column,
}: CellContext<DataTableFeatures, TData, TValue>) {
    return formatCellValue(
        column.columnDef.meta as DataTableColumnMeta | undefined,
        cell.getValue(),
    );
}

export function formatCellValue(
    meta: DataTableColumnMeta | undefined,
    value: unknown,
): string {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    if (Array.isArray(value)) {
        return value.map((item) => formatCellValue(meta, item)).join(', ');
    }

    switch (meta?.variant) {
        case 'date':
            return typeof value === 'string' || typeof value === 'number'
                ? formatDate(value)
                : toText(value);
        case 'boolean':
            // Some databases (SQLite, MySQL) return 1/0 instead of true/false.
            return value === true || value === 1 || value === '1'
                ? 'Yes'
                : 'No';
        case 'select':
        case 'multi-select':
            return getOptionLabel(meta, toPrimitive(value));
        case 'number':
            return meta.unit ? `${toText(value)} ${meta.unit}` : toText(value);
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    return toText(value);
}

function toText(value: unknown): string {
    switch (typeof value) {
        case 'string':
            return value;
        case 'number':
        case 'bigint':
        case 'boolean':
            return String(value);
        case 'object':
            return JSON.stringify(value);
        default:
            return '';
    }
}

/**
 * Label of an option (select / multi-select) as declared by the server, to
 * show `Administrator` instead of `admin` in a cell.
 */
export function getOptionLabel(
    meta: DataTableColumnMeta | undefined,
    value: string | number | boolean | null | undefined,
): string {
    const text = value === null || value === undefined ? '' : String(value);
    const options = meta && 'options' in meta ? meta.options : undefined;

    return options?.find((option) => option.value === text)?.label ?? text;
}

function toPrimitive(value: unknown): string | number | boolean | null {
    return typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
        ? value
        : null;
}
