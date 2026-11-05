<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Tests\Fixtures\Factories;

use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;

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
