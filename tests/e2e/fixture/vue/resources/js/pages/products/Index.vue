<script setup lang="ts">
import { Deferred, Head } from '@inertiajs/vue3';
import { DataTableSkeleton } from '@/components/data-table';
import ProductsTable, {
    PRODUCT_COLUMN_SIZES,
} from '@/components/data-tables/ProductsTable.vue';
import type { Product } from '@/components/data-tables/ProductsTable.vue';
import type {
    ServerDataTable,
    ServerTableConfig,
} from '@/lib/data-table-server';

defineOptions({
    layout: {
        breadcrumbs: [{ title: 'Products', href: '/products' }],
    },
});

defineProps<{
    products?: ServerDataTable<Product>;
    productsConfig: ServerTableConfig;
}>();
</script>

<template>
    <Head title="Products" />
    <div
        class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4"
    >
        <Deferred data="products">
            <template #fallback>
                <DataTableSkeleton
                    :config="productsConfig"
                    :sizes="PRODUCT_COLUMN_SIZES"
                />
            </template>
            <ProductsTable v-if="products" :products="products" />
        </Deferred>
    </div>
</template>
