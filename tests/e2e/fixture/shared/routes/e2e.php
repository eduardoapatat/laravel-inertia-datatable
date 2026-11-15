<?php

declare(strict_types=1);

use App\DataTables\ProductsTable;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware(['auth', 'verified'])->group(function () {
    // The page of the React fixture (`products/index.tsx`) or the Vue one (`products/Index.vue`).
    $page = file_exists(resource_path('js/pages/products/Index.vue')) ? 'products/Index' : 'products/index';

    Route::get('products', fn () => Inertia::render($page, [
        'products' => Inertia::defer(fn () => ProductsTable::make()),
        'productsConfig' => fn () => ProductsTable::make()->config(),
    ]))->name('products.index');

    // The same page with the rows in the response, so Inertia SSR renders them (ssr.spec.ts).
    Route::get('products/eager', fn () => Inertia::render($page, [
        'products' => ProductsTable::make(),
        'productsConfig' => fn () => ProductsTable::make()->config(),
    ]))->name('products.eager');

    // The table with DataTableFilterList and DataTableSortList (advanced-filters.spec.ts).
    Route::get('products/advanced', fn () => Inertia::render($page, [
        'products' => ProductsTable::make(),
        'productsConfig' => fn () => ProductsTable::make()->config(),
        'advanced' => true,
    ]))->name('products.advanced');
});
