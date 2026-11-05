<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Tests\Fixtures\Tables;

use EduardoApatat\InertiaDataTable\Column;
use EduardoApatat\InertiaDataTable\DataTable;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Product;
use Illuminate\Database\Eloquent\Builder;

class ProductsTable extends DataTable
{
    public function query(): Builder
    {
        return Product::query();
    }

    public function columns(): array
    {
        return [
            Column::make('name', 'Nombre')->sortable()->searchable()->text('Buscar nombre…')->hideable(false),
            Column::make('sku', 'SKU')->text()->hidden(),
            Column::make('price', 'Precio')->sortable()->range(unit: '$'),
            Column::make('stock', 'Stock')->number(),
            Column::make('status', 'Estado')->multiSelect(['active' => 'Activo', 'draft' => 'Borrador', 'archived' => 'Archivado']),
            Column::make('category', 'Categoría')->from('category.name')->multiSelect()->sortable()->searchable(),
            Column::make('featured', 'Destacado')->boolean(),
            Column::make('released_on', 'Lanzamiento')->date()->hidden(),
        ];
    }

    public function defaultSort(): string
    {
        return 'name';
    }
}
