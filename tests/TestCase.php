<?php

declare(strict_types=1);

namespace EduardoApatat\InertiaDataTable\Tests;

use EduardoApatat\InertiaDataTable\InertiaDataTableServiceProvider;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Category;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Tables\CategoryProductsTable;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Tables\ProductsTable;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Routing\Router;
use Orchestra\Testbench\TestCase as Orchestra;

abstract class TestCase extends Orchestra
{
    use LazilyRefreshDatabase;

    protected function getPackageProviders($app): array
    {
        return [
            InertiaDataTableServiceProvider::class,
        ];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('database.default', 'testing');
    }

    protected function defineDatabaseMigrations(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/Fixtures/migrations');
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
