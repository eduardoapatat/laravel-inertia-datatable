<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Tables;

use Illuminate\Database\Eloquent\Relations\HasMany;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\Tests\Fixtures\Models\Category;
use InertiaDataTable\Tests\Fixtures\Models\Product;

class CategoryProductsTable extends DataTable
{
    public function __construct(private readonly Category $category) {}

    /**
     * @return HasMany<Product, Category>
     */
    public function query(): HasMany
    {
        return $this->category->products();
    }

    public function columns(): array
    {
        return [Column::text('name')->sortable()];
    }
}
