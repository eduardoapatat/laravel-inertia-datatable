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
            Column::text('name', 'Nombre')->sortable()->searchable()->filterInput('Buscar nombre…')->hideable(false),
            Column::text('sku', 'SKU')->filterInput()->hidden(),
            Column::number('price', 'Precio')->sortable()->unit('$')->filterRange(),
            Column::number('stock', 'Stock')->filterInput(),
            Column::option('status', 'Estado')->options(['active' => 'Activo', 'draft' => 'Borrador', 'archived' => 'Archivado'])->filterMultiSelect(),
            Column::option('category', 'Categoría')->from('category.name')->filterMultiSelect()->sortable()->searchable(),
            Column::boolean('featured', 'Destacado')->filterSelect(),
            Column::date('released_on', 'Lanzamiento')->filterDate()->hidden(),
        ];
    }

    public function defaultSort(): string
    {
        return 'name';
    }
}
