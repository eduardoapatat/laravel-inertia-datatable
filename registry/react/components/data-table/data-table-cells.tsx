import type { CellContext, RowData } from '@tanstack/react-table';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';

import type { DataTableFeatures } from '@/lib/data-table-features';
import {
    formatBoolean,
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
import type {
    ColumnSelectOption,
    DataTableColumnMeta,
} from '@/lib/data-table-types';

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
 * Number, currency or percentage with Intl and the table locale; the column is
 * aligned to the end with its header (`meta.align` changes it).
 */
export function DataTableNumberCell<TData extends RowData, TValue>(
    props: DataTableCellProps<TData, TValue>,
) {
    const { meta, locale } = cellSetup(props);

    return (
        <span data-slot="data-table-number" className="tabular-nums">
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
        (meta?.display?.type === 'date' ? meta.display.format : undefined) ??
        context.dateFormat ??
        'long';
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
 * The labels of `->booleanLabels()` or the Yes / No texts of the table; with
 * `->badge()`, inside the project's Badge (variant of `true` / `false`, else
 * the column one).
 */
export function DataTableBooleanCell<TData extends RowData, TValue>(
    props: DataTableCellProps<TData, TValue>,
) {
    const { meta, context } = cellSetup(props);
    const display =
        meta?.display?.type === 'boolean' ? meta.display : undefined;
    const value = props.cell.getValue();

    if (display?.badge) {
        if (value === null || value === undefined || value === '') {
            return null;
        }

        const key =
            formatBoolean(value, { true: 'true', false: 'false' }) === 'true'
                ? 'true'
                : 'false';

        return (
            <DataTableOptionBadge
                variant={
                    (display.variants?.[key] ??
                        display.variant ??
                        'outline') as DataTableBadgeVariant
                }
            >
                {formatCellValue(meta, value, context)}
            </DataTableOptionBadge>
        );
    }

    return formatCellValue(
        meta?.display?.type === 'boolean'
            ? meta
            : { ...meta, display: { type: 'boolean' } },
        props.cell.getValue(),
        context,
    );
}

type BadgeProps = React.ComponentProps<typeof Badge>;

/** Variants of the project's `components/ui/badge.tsx`. */
export type DataTableBadgeVariant = BadgeProps['variant'];

interface DataTableOptionBadgeProps extends BadgeProps {
    /** Option of `meta.options`: its icon and label are shown. */
    option?: ColumnSelectOption;
    /** Raw value, shown when there is no option. */
    value?: unknown;
}

/**
 * The project's shadcn Badge with the icon and label of an option: the badge
 * of `->badge()`, exported to reuse it in a custom `cell` with any Badge prop
 * (`variant`, `className`, `children`…).
 */
export function DataTableOptionBadge({
    option,
    value,
    children,
    ...props
}: DataTableOptionBadgeProps) {
    const Icon = option?.icon;

    return (
        <Badge {...props}>
            {Icon && <Icon aria-hidden="true" />}
            {children ?? option?.label ?? toText(value)}
        </Badge>
    );
}

type DataTableOptionCellProps<
    TData extends RowData,
    TValue,
> = DataTableCellProps<TData, TValue> & {
    /**
     * Badge props per value, over the variants declared in PHP; shows
     * badges even without `->badge()`.
     */
    badge?: (
        option: ColumnSelectOption | undefined,
        value: string | number | boolean,
    ) => Partial<BadgeProps>;
    /**
     * Draws each value with anything else (a dot, a tooltip, a link…);
     * the cell still splits multiple values and skips empty ones.
     */
    renderOption?: (
        option: ColumnSelectOption | undefined,
        value: string | number | boolean,
    ) => React.ReactNode;
};

/**
 * Option labels (select / multi-select) with the icons of the page
 * `meta.options`: as badges with `->badge()` or the `badge` prop, or drawn by
 * `renderOption`.
 */
export function DataTableOptionCell<TData extends RowData, TValue>({
    badge: badgeProps,
    renderOption,
    ...props
}: DataTableOptionCellProps<TData, TValue>) {
    const { meta } = cellSetup(props);
    const value = props.cell.getValue();
    const display = meta?.display?.type === 'option' ? meta.display : undefined;
    const asBadge = Boolean(display?.badge) || badgeProps !== undefined;
    const values = (Array.isArray(value) ? value : [value])
        .map(toPrimitive)
        .filter(
            (item): item is string | number | boolean =>
                item !== null && item !== '',
        );

    if (values.length === 0) {
        return null;
    }

    return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
            {values.map((item) => {
                const option = getOption(meta, item);

                if (renderOption) {
                    return (
                        <React.Fragment key={String(item)}>
                            {renderOption(option, item)}
                        </React.Fragment>
                    );
                }

                if (asBadge) {
                    const variant = (display?.variants?.[String(item)] ??
                        display?.variant ??
                        'outline') as DataTableBadgeVariant;

                    return (
                        <DataTableOptionBadge
                            key={String(item)}
                            option={option}
                            value={item}
                            variant={variant}
                            {...badgeProps?.(option, item)}
                        />
                    );
                }

                const Icon = option?.icon;

                return (
                    <span
                        key={String(item)}
                        className="inline-flex items-center gap-1.5"
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
