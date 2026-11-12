import { createColumnHelper } from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableToolbar } from '@/components/data-table/data-table-toolbar';
import { useServerDataTable } from '@/hooks/use-server-data-table';
import type { DataTableFeatures } from '@/lib/data-table-features';
import type { ServerDataTable } from '@/lib/data-table-server';

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

const columnHelper = createColumnHelper<DataTableFeatures, Product>();

// The width the skeleton of the page also receives (`sizes`).
export const PRODUCT_COLUMN_SIZES = { name: 320 };

const columns = columnHelper.columns([
    columnHelper.accessor('name', { size: PRODUCT_COLUMN_SIZES.name }),
]);

type ProductsTableProps = {
    products: ServerDataTable<Product>;
    prop?: string;
};

export function ProductsTable({
    products,
    prop = 'products',
}: ProductsTableProps) {
    const { table } = useServerDataTable({ table: products, prop, columns });

    return (
        <DataTable table={table} aria-label="Products">
            <DataTableToolbar table={table} />
        </DataTable>
    );
}
