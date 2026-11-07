<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use InertiaDataTable\Tests\Fixtures\Enums\ProductStatus;
use InertiaDataTable\Tests\Fixtures\Factories\ProductFactory;

class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    protected $guarded = [];

    protected $hidden = ['created_at', 'updated_at'];

    /**
     * @return BelongsTo<Category, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * @return BelongsTo<Category, $this>
     */
    public function publicCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id')->where('name', 'not like', 'Secret%');
    }

    protected function casts(): array
    {
        return [
            'status' => ProductStatus::class,
            'featured' => 'boolean',
            'released_on' => 'date:Y-m-d',
        ];
    }

    protected static function newFactory(): ProductFactory
    {
        return ProductFactory::new();
    }
}
