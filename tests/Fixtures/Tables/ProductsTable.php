<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Tables;

use Illuminate\Database\Eloquent\Builder;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\Tests\Fixtures\Models\Product;

class ProductsTable extends DataTable
{
    public function query(): Builder
    {
        return Product::query();
    }

    public function columns(): array
    {
        return [
            Column::text('name', 'Nombre')->sortable()->searchable()->filter('Buscar nombre…')->hideable(false),
            Column::text('sku', 'SKU')->filter()->hidden(),
            Column::number('price', 'Precio')->sortable()->unit('$')->range(),
            Column::number('stock', 'Stock')->filter(),
            Column::option('status', 'Estado')->options(['active' => 'Activo', 'draft' => 'Borrador', 'archived' => 'Archivado'])->filter(multiple: true),
            Column::option('category', 'Categoría')->from('category.name')->filter(multiple: true)->sortable()->searchable(),
            Column::boolean('featured', 'Destacado')->filter(),
            Column::date('released_on', 'Lanzamiento')->filter()->hidden(),
        ];
    }

    public function defaultSort(): string
    {
        return 'name';
    }
}
