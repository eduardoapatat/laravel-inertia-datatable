<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Tests\Fixtures\Tables;

use EduardoApatat\InertiaDataTable\Column;
use EduardoApatat\InertiaDataTable\DataTable;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Category;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Product;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        return [Column::make('name')->sortable()];
    }
}
