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
        // SQLite en memoria por defecto; el CI pasa DB_CONNECTION=mysql|pgsql y los DB_* de Testbench.
        $app['config']->set('database.default', env('DB_CONNECTION', 'testing'));
    }

    /**
     * Las migraciones de prueba van en el migrate:fresh de LazilyRefreshDatabase. Con
     * loadMigrationsFrom(), Testbench hace rollback tras cada test con la transacción del
     * test abierta, y en Postgres el DROP se queda esperando ese bloqueo.
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
