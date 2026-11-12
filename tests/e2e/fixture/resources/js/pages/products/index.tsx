import { Deferred, Head } from '@inertiajs/react';
import {
    PRODUCT_COLUMN_SIZES,
    ProductsTable,
} from '@/components/data-tables/products-table';
import type { Product } from '@/components/data-tables/products-table';
import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';
import type {
    ServerDataTable,
    ServerTableConfig,
} from '@/lib/data-table-server';

type Props = {
    products?: ServerDataTable<Product>;
    productsConfig: ServerTableConfig;
};

export default function ProductsIndex(props: Props) {
    const { products, productsConfig } = props;
    const skeleton = (
        <DataTableSkeleton
            config={productsConfig}
            sizes={PRODUCT_COLUMN_SIZES}
        />
    );

    return (
        <>
            <Head title="Products" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Deferred data="products" fallback={skeleton}>
                    {products && <ProductsTable products={products} />}
                </Deferred>
            </div>
        </>
    );
}

ProductsIndex.layout = {
    breadcrumbs: [{ title: 'Products', href: '/products' }],
};
