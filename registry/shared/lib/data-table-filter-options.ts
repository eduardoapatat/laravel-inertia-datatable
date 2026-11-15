// Copyright (c) 2024 Sadman Sakib. SPDX-License-Identifier: MIT

import type { FilterVariant } from '@/lib/data-table-server';
import type {
    ColumnSelectOption,
    DataTableColumnMeta,
} from '@/lib/data-table-types';

/**
 * Server filter variants that each filter component can edit. A component on
 * another variant would send values the server drops, so it renders nothing.
 */
export const FILTER_COMPONENT_VARIANTS = {
    DataTableTextFilter: ['text'],
    DataTableNumberFilter: ['number'],
    DataTableSliderFilter: ['range'],
    DataTableDateFilter: ['date', 'date-range'],
    DataTableBooleanFilter: ['boolean'],
    DataTableFacetedFilter: ['select', 'multi-select', 'boolean'],
} as const satisfies Record<string, readonly FilterVariant[]>;

export type FilterComponentName = keyof typeof FILTER_COMPONENT_VARIANTS;

/**
 * Component that edits a server filter variant, as the toolbar renders it.
 */
export function getFilterComponentName(
    variant: FilterVariant,
): FilterComponentName | undefined {
    switch (variant) {
        case 'text':
            return 'DataTableTextFilter';
        case 'number':
            return 'DataTableNumberFilter';
        case 'range':
            return 'DataTableSliderFilter';
        case 'date':
        case 'date-range':
            return 'DataTableDateFilter';
        case 'boolean':
            return 'DataTableBooleanFilter';
        case 'select':
        case 'multi-select':
            return 'DataTableFacetedFilter';
        default:
            return undefined;
    }
}

/**
 * Why a filter component can not edit a column, or `undefined` when it can:
 * the column must exist, have a filter declared in the PHP class and use a
 * variant the component edits.
 */
export function getFilterColumnIssue(
    component: FilterComponentName,
    columnId: string,
    column:
        | {
              getCanFilter: () => boolean;
              columnDef: { meta?: DataTableColumnMeta };
          }
        | undefined,
): string | undefined {
    if (!column) {
        return `${component}: the table has no column "${columnId}". Use the id of a column of the PHP table class.`;
    }

    const variant = column.columnDef.meta?.filterVariant;

    if (!column.getCanFilter() || !variant) {
        return `${component}: column "${columnId}" has no filter. Declare it in the PHP table class (\`->filterInput()\`, \`->filterSelect()\`, \`->filterMultiSelect()\`, \`->filterRange()\`, \`->filterDate()\`).`;
    }

    const accepted: readonly FilterVariant[] =
        FILTER_COMPONENT_VARIANTS[component];

    if (accepted.includes(variant)) return undefined;

    const expected = getFilterComponentName(variant);

    return `${component}: column "${columnId}" filters as "${variant}" on the server${expected ? `; use ${expected}` : ''}.`;
}

/**
 * Options of a boolean filter: the labels of `->labels()`, or Yes / No of the
 * table texts, with the icons of `meta.icons`.
 */
export function getBooleanFilterOptions(
    meta: DataTableColumnMeta | undefined,
    texts: { yes: string; no: string },
    labels?: { true: string; false: string },
): ColumnSelectOption[] {
    const display = meta?.display;
    const resolved = labels ??
        (display?.type === 'boolean' ? display.labels : undefined) ?? {
            true: texts.yes,
            false: texts.no,
        };

    return [
        { label: resolved.true, value: 'true', icon: meta?.icons?.true },
        { label: resolved.false, value: 'false', icon: meta?.icons?.false },
    ];
}

/**
 * Options of a select filter, limited to the ones the server declared: a
 * custom list can relabel, reorder or leave out options, never add values.
 */
export function getFacetedFilterOptions(
    serverOptions: ColumnSelectOption[],
    options?: ColumnSelectOption[],
): ColumnSelectOption[] {
    if (!options) return serverOptions;

    const byValue = new Map(
        serverOptions.map((option) => [option.value, option]),
    );

    return options.flatMap((option) => {
        const server = byValue.get(option.value);

        return server ? [{ ...server, ...option }] : [];
    });
}
