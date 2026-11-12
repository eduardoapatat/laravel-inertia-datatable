<?php

declare(strict_types=1);

use App\DataTables\ProductsTable;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('products', fn () => Inertia::render('products/index', [
        'products' => Inertia::defer(fn () => ProductsTable::make()),
        'productsConfig' => fn () => ProductsTable::make()->config(),
    ]))->name('products.index');
});
