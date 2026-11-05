import type { CellContext, RowData } from '@tanstack/react-table';

import type { DataTableFeatures } from '@/lib/data-table-features';
import {
    formatCellValue,
    formatDateValue,
    getFormatContext,
    getOption,
    isDateOnly,
    isEmail,
    isSafeUrl,
    toPrimitive,
    toText,
    truncate,
} from '@/lib/data-table-format';
import type { DataTableColumnMeta } from '@/lib/data-table-types';
import { cn } from '@/lib/utils';

type DataTableCellProps<TData extends RowData, TValue> = CellContext<
    DataTableFeatures,
    TData,
    TValue
>;

function cellSetup<TData extends RowData, TValue>({
    column,
    table,
}: DataTableCellProps<TData, TValue>) {
    const context = getFormatContext(table);

    return {
        meta: column.columnDef.meta as DataTableColumnMeta | undefined,
        locale: context.locale,
        context,
    };
}

/**
 * Default cell: picks the cell of the column type, from the `display` declared
 * in PHP or in the page `meta` or, without it, from the filter variant. Every
 * type cell is exported to reuse its formatting inside a custom `cell`.
 */
export function DataTableCell<TData extends RowData, TValue>(
    props: DataTableCellProps<TData, TValue>,
) {
    const { meta } = cellSetup(props);

    switch (meta?.display?.type ?? typeOfVariant(meta?.variant)) {
        case 'number':
            return <DataTableNumberCell {...props} />;
        case 'date':
            return <DataTableDateCell {...props} />;
        case 'boolean':
            return <DataTableBooleanCell {...props} />;
        case 'option':
            return <DataTableOptionCell {...props} />;
        default:
            return <DataTableTextCell {...props} />;
    }
}

/**
 * Text, cut with `->limit()` (the full text in the tooltip) and shown as a
 * link with `->url()` or `->email()`.
 */
export function DataTableTextCell<TData extends RowData, TValue>(
    props: DataTableCellProps<TData, TValue>,
) {
    const { meta } = cellSetup(props);
    const display = meta?.display?.type === 'text' ? meta.display : undefined;
    const text = toText(props.cell.getValue());
    const shown = truncate(text, display?.limit);
    const title = shown === text ? undefined : text;

    if (display?.link === 'url' && isSafeUrl(text)) {
        return (
            <a
                href={text}
                target="_blank"
                rel="noopener noreferrer"
                title={title}
                className="underline-offset-4 hover:underline"
            >
                {shown}
            </a>
        );
    }

    if (display?.link === 'email' && isEmail(text)) {
        return (
            <a
                href={`mailto:${text}`}
                title={title}
                className="underline-offset-4 hover:underline"
            >
                {shown}
            </a>
        );
    }

    return title === undefined ? shown : <span title={title}>{shown}</span>;
}

/**
 * Number, currency or percentage with Intl and the table locale.
 */
export function DataTableNumberCell<TData extends RowData, TValue>(
    props: DataTableCellProps<TData, TValue>,
) {
    const { meta, locale } = cellSetup(props);

    return (
        <span className="tabular-nums">
            {formatCellValue(
                meta?.display?.type === 'number'
                    ? meta
                    : { ...meta, display: { type: 'number' } },
                props.cell.getValue(),
                locale,
            )}
        </span>
    );
}

/**
 * Date with the preset or Intl options of `->dateFormat()`; relative dates
 * keep the full date in the tooltip.
 */
export function DataTableDateCell<TData extends RowData, TValue>(
    props: DataTableCellProps<TData, TValue>,
) {
    const { meta, locale, context } = cellSetup(props);
    const value = props.cell.getValue();
    const format =
        meta?.display?.type === 'date'
            ? meta.display.format
            : (context.dateFormat ?? 'long');
    const text = formatDateValue(value, format, locale);

    if (text === '') {
        return null;
    }

    return (
        <time
            dateTime={typeof value === 'string' ? value : undefined}
            title={
                format === 'relative'
                    ? formatDateValue(
                          value,
                          isDateOnly(value) ? 'long' : 'datetime',
                          locale,
                      )
                    : undefined
            }
        >
            {text}
        </time>
    );
}

/**
 * The labels of `->booleanLabels()` or the Yes / No texts of the table.
 */
export function DataTableBooleanCell<TData extends RowData, TValue>(
    props: DataTableCellProps<TData, TValue>,
) {
    const { meta, context } = cellSetup(props);

    return formatCellValue(
        meta?.display?.type === 'boolean'
            ? meta
            : { ...meta, display: { type: 'boolean' } },
        props.cell.getValue(),
        context,
    );
}

/**
 * Option labels (select / multi-select) with the icons of the page
 * `meta.options` and, with `->badge()`, as badges.
 */
export function DataTableOptionCell<TData extends RowData, TValue>(
    props: DataTableCellProps<TData, TValue>,
) {
    const { meta } = cellSetup(props);
    const value = props.cell.getValue();
    const badge = meta?.display?.type === 'option' && meta.display.badge;
    const values = (Array.isArray(value) ? value : [value])
        .map(toPrimitive)
        .filter((item) => item !== null && item !== '');

    if (values.length === 0) {
        return null;
    }

    return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
            {values.map((item) => {
                const option = getOption(meta, item);
                const Icon = option?.icon;

                return (
                    <span
                        key={String(item)}
                        data-slot="data-table-option"
                        className={cn(
                            'inline-flex items-center gap-1.5',
                            badge &&
                                'rounded-md border px-2 py-0.5 text-xs font-medium',
                        )}
                    >
                        {Icon && (
                            <Icon
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-muted-foreground"
                            />
                        )}
                        {option?.label ?? String(item)}
                    </span>
                );
            })}
        </span>
    );
}

function typeOfVariant(variant: DataTableColumnMeta['variant']) {
    switch (variant) {
        case 'number':
        case 'date':
        case 'boolean':
            return variant;
        case 'select':
        case 'multi-select':
            return 'option';
        default:
            return 'text';
    }
}
