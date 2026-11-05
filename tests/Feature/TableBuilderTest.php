<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\Tests\Fixtures\Models\Category;
use InertiaDataTable\Tests\Fixtures\Models\Product;

use function Pest\Laravel\getJson;

it('resolves a table declared with the quick form', function () {
    Route::get('/quick', fn () => DataTable::for(Product::query())
        ->columns([Column::make('name')->sortable()])
        ->perPage(5)
        ->perPageOptions([5, 15]));
    Product::factory()->create(['name' => 'Atril']);
    Product::factory()->create(['name' => 'Banco']);

    $response = getJson('/quick?sort=-name');

    $response->assertOk()
        ->assertJsonPath('data.*.name', ['Banco', 'Atril'])
        ->assertJsonPath('meta.per_page', 5)
        ->assertJsonPath('config.per_page_options', [5, 15]);
});

it('reads its parameters with the table name as prefix', function () {
    Route::get('/quick', fn () => DataTable::for(Product::query())
        ->columns([Column::make('name')])
        ->name('products')
        ->perPage(5)
        ->perPageOptions([5]));
    Product::factory()->count(6)->create();

    $response = getJson('/quick?products_page=2&page=1');

    $response->assertOk()
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('config.query.page', 'products_page')
        ->assertJsonPath('config.query.filter', 'products_filter');
});

it('removes hidden column keys from transformed rows and keeps the other keys', function () {
    Route::get('/quick', fn () => DataTable::for(Product::query())
        ->columns([Column::make('name'), Column::make('sku')->hidden()])
        ->transform(fn (Product $product): array => [
            'name' => $product->name,
            'sku' => $product->sku,
            'url' => "/products/{$product->id}",
        ]));
    $product = Product::factory()->create(['name' => 'Atril']);

    $response = getJson('/quick');

    $response->assertOk()->assertJsonPath('data.0', ['name' => 'Atril', 'url' => "/products/{$product->id}"]);
});

it('rejects a column that reads a to-many relation', function () {
    $table = DataTable::for(Category::query())
        ->columns([Column::make('product')->from('products.name')])
        ->withRequest(Request::create('/'));

    expect(fn () => $table->toArray())->toThrow(LogicException::class, 'is not a to-one relation');
});
