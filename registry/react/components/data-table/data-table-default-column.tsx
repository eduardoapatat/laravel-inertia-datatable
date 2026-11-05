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
 * Cabecera de una columna que no personaliza el componente: la etiqueta que
 * declara la clase de la tabla, con orden y ocultar si la columna lo permite.
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
 * Celda de una columna que no personaliza el componente, formateada según el
 * filtro que declara la clase de la tabla.
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
                : String(value);
        case 'boolean':
            // Algunas bases (SQLite, MySQL) devuelven 1/0 en lugar de true/false.
            return value === true || value === 1 || value === '1'
                ? 'Yes'
                : 'No';
        case 'select':
        case 'multi-select':
            return getOptionLabel(meta, toPrimitive(value));
        case 'number':
            return meta.unit ? `${String(value)} ${meta.unit}` : String(value);
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/**
 * Etiqueta de una opción (select / multi-select) tal como la declara el
 * servidor, para mostrar `Administrador` en lugar de `admin` en una celda.
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
