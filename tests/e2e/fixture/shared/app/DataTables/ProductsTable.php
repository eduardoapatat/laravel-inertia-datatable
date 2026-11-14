<?php

declare(strict_types=1);

namespace App\DataTables;

use App\Enums\ProductStatus;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;

/**
 * Every kind of column and filter of the package, on the data of E2eSeeder.
 */
class ProductsTable extends DataTable
{
    /**
     * @return Builder<Product>
     */
    public function query(): Builder
    {
        return Product::query();
    }

    /**
     * @return list<Column>
     */
    public function columns(): array
    {
        return [
            Column::text('name')->sortable()->searchable()->filterInput()->limit(40)->hideable(false),
            Column::text('sku', 'SKU')->sortable()->searchable()->filterInput(),
            Column::option('category')->from('category.name')->sortable()->searchable()->filterSelect(empty: true)->whenEmpty('No category'),
            Column::option('status')->options(ProductStatus::class)->badge()->sortable()->filterSelect(),
            Column::number('price')->sortable()->money('USD')->filterRange(),
            Column::number('stock')->sortable()->filterInput(),
            Column::number('weight')->sortable()->unit('kg')->filterRange(empty: true)->whenEmpty('—'),
            Column::boolean('is_featured', 'Featured')->filterSelect(),
            Column::text('website')->url()->whenEmpty('—'),
            Column::date('published_at', 'Published')->sortable()->filterRange(empty: true)->whenEmpty('Unpublished'),
            Column::date('created_at', 'Created')->sortable()->hidden(),
        ];
    }

    public function defaultSort(): ?string
    {
        return 'name';
    }
}
