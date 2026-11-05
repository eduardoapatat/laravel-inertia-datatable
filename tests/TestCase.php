<?php

declare(strict_types=1);

namespace InertiaDataTable\Tests;

use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Routing\Router;
use InertiaDataTable\InertiaDataTableServiceProvider;
use InertiaDataTable\Tests\Fixtures\Models\Category;
use InertiaDataTable\Tests\Fixtures\Tables\CategoryProductsTable;
use InertiaDataTable\Tests\Fixtures\Tables\ProductsTable;
use Orchestra\Testbench\TestCase as Orchestra;

abstract class TestCase extends Orchestra
{
    use LazilyRefreshDatabase {
        migrateFreshUsing as defaultMigrateFreshUsing;
    }

    protected function getPackageProviders($app): array
    {
        return [
            InertiaDataTableServiceProvider::class,
        ];
    }

    protected function defineEnvironment($app): void
    {
        // In-memory SQLite by default; CI passes DB_CONNECTION=mysql|pgsql and Testbench's DB_* variables.
        $app['config']->set('database.default', env('DB_CONNECTION', 'testing'));
    }

    /**
     * The test migrations go in the migrate:fresh of LazilyRefreshDatabase. With
     * loadMigrationsFrom(), Testbench rolls back after every test while the test transaction
     * is still open, and on Postgres the DROP waits for that lock forever.
     *
     * @return array<string, mixed>
     */
    protected function migrateFreshUsing(): array
    {
        return [
            ...$this->defaultMigrateFreshUsing(),
            '--path' => __DIR__.'/Fixtures/migrations',
            '--realpath' => true,
        ];
    }

    /**
     * @param  Router  $router
     */
    protected function defineRoutes($router): void
    {
        $router->get('/products', fn () => ProductsTable::make());

        $router->get('/categories/{category}/products', fn (string $category) => CategoryProductsTable::make(
            category: Category::query()->findOrFail($category),
        ));
    }
}
