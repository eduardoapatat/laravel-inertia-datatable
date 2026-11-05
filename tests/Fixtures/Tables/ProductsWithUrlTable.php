<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Tables;

use Illuminate\Database\Eloquent\Model;

class ProductsWithUrlTable extends ProductsTable
{
    public function transform(Model $model): array
    {
        return [
            'id' => $model->getKey(),
            'name' => $model->getAttribute('name'),
            'sku' => $model->getAttribute('sku'),
            'url' => "/products/{$model->getKey()}",
        ];
    }
}
