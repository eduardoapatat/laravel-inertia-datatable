<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Fixed data, without Faker, so every e2e test knows the rows it expects:
 *
 * - 40 products, `Product 01` … `Product 39` and one with a very long name (#40).
 * - Status by `$i % 3`: 13 draft, 14 active, 13 archived.
 * - Without category every 8th (5), without weight every 5th (8), unpublished every 7th (5).
 * - Price `$i * 12.5` (12.50 … 500.00); featured every 4th (10).
 * - Published in 2025, month `($i - 1) % 12 + 1`: March holds #3, #15, #27 and #39.
 *
 * And the user the tests log in with: e2e@example.com / password.
 */
class E2eSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'name' => 'E2E',
            'email' => 'e2e@example.com',
            'password' => 'password',
            'email_verified_at' => now(),
        ]);

        $categories = collect(['Books', 'Tools', 'Garden'])
            ->map(fn (string $name) => Category::create(['name' => $name]));
        $statuses = [ProductStatus::Draft, ProductStatus::Active, ProductStatus::Archived];

        foreach (range(1, 40) as $i) {
            Product::create([
                'name' => $i === 40
                    ? 'An extremely long product name that goes on and on past the limit of the column'
                    : sprintf('Product %02d', $i),
                'sku' => sprintf('SKU-%03d', $i),
                'category_id' => $i % 8 === 0 ? null : $categories[($i - 1) % 3]->id,
                'status' => $statuses[$i % 3],
                'price' => $i * 12.5,
                'stock' => $i * 3 % 50,
                'weight' => $i % 5 === 0 ? null : $i * 0.75,
                'is_featured' => $i % 4 === 0,
                'website' => $i % 6 === 0 ? null : "https://example.com/products/{$i}",
                'published_at' => $i % 7 === 0 ? null : Carbon::create(2025, ($i - 1) % 12 + 1, min($i, 28), 12),
                'created_at' => Carbon::create(2026, 1, 1)->addDays($i),
            ]);
        }
    }
}
