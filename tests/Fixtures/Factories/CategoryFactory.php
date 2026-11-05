<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests\Fixtures\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use InertiaDataTable\Tests\Fixtures\Models\Category;

/**
 * @extends Factory<Category>
 */
class CategoryFactory extends Factory
{
    protected $model = Category::class;

    public function definition(): array
    {
        return ['name' => $this->faker->unique()->word()];
    }
}
