<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use InertiaDataTable\Tests\Fixtures\Models\Product;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'name' => $this->faker->unique()->words(2, true),
            'sku' => $this->faker->unique()->bothify('SKU-####'),
            'status' => 'active',
            'price' => 100,
            'stock' => 5,
            'featured' => false,
            'released_on' => '2026-01-15',
        ];
    }

    public function draft(): static
    {
        return $this->state(['status' => 'draft']);
    }

    public function archived(): static
    {
        return $this->state(['status' => 'archived']);
    }

    public function featured(): static
    {
        return $this->state(['featured' => true]);
    }

    public function withoutSku(): static
    {
        return $this->state(['sku' => null]);
    }
}
