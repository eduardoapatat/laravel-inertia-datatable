/**
 * The only file of `lib/` that knows the UI framework: the `lib/data-table-*`
 * files import TanStack Table and the framework types from here, so React and
 * Vue share them and each one installs its own copy of this file.
 */
import type { Component, CSSProperties } from 'vue';

import type { TableFeature } from '@tanstack/vue-table';

import type { ColumnFilterItem } from '@/lib/data-table-types';

export * from '@tanstack/vue-table';

/** An icon component: `meta.icon`, `meta.icons` and the options' `icon`. */
export type DataTableIcon = Component;

/** Inline styles of a header or a cell (the column size). */
export type DataTableStyle = CSSProperties;

declare module '@tanstack/vue-table' {
    interface Plugins {
        dataTableFilteringFeature: TableFeature;
    }

    interface ColumnFilter extends Partial<
        Pick<ColumnFilterItem, 'operator' | 'variant' | 'filterId'>
    > {}
}
