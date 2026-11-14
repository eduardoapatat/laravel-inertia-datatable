<script lang="ts">
export type Product = {
    id: number;
    name?: string;
    sku?: string;
    category?: string | null;
    status?: string;
    price?: string;
    stock?: number;
    weight?: string | null;
    is_featured?: boolean;
    website?: string | null;
    published_at?: string | null;
    created_at?: string;
};

// The width the skeleton of the page also receives (`sizes`).
export const PRODUCT_COLUMN_SIZES = { name: 320 };
</script>

<script setup lang="ts">
import { createColumnHelper } from '@tanstack/vue-table';
import { DataTable, DataTableToolbar } from '@/components/data-table';
import { useServerDataTable } from '@/composables/useServerDataTable';
import type { DataTableFeatures } from '@/lib/data-table-features';
import type { ServerDataTable } from '@/lib/data-table-server';

const props = withDefaults(
    defineProps<{
        products: ServerDataTable<Product>;
        prop?: string;
    }>(),
    { prop: 'products' },
);

const columnHelper = createColumnHelper<DataTableFeatures, Product>();

const columns = columnHelper.columns([
    columnHelper.accessor('name', { size: PRODUCT_COLUMN_SIZES.name }),
]);

const { table } = useServerDataTable({
    table: () => props.products,
    prop: props.prop,
    columns,
});
</script>

<template>
    <DataTable :table="table" aria-label="Products">
        <DataTableToolbar :table="table" />
    </DataTable>
</template>
