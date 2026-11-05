<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Tests\Fixtures\Models;

use EduardoApatat\InertiaDataTable\Tests\Fixtures\Enums\ProductStatus;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
