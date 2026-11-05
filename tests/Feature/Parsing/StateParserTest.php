<?php

declare(strict_types=1);

use EduardoApatat\InertiaDataTable\Column;
use EduardoApatat\InertiaDataTable\DataTable;
use EduardoApatat\InertiaDataTable\Parsing\StateParser;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Models\Product;
use EduardoApatat\InertiaDataTable\Tests\Fixtures\Tables\ProductsTable;

it('limits the sort to the configured number of columns', function () {
    config(['inertia-datatable.max_sorts' => 2]);

    $state = (new StateParser)->parse(['sort' => 'name,-price,category'], ProductsTable::make()->toDefinition());

    expect(array_map(fn ($item) => $item->id, $state->sorting))->toBe(['name', 'price']);
});

it('keeps the first occurrence of a repeated sort column', function () {
    $state = (new StateParser)->parse(['sort' => 'name,-name'], ProductsTable::make()->toDefinition());

    expect($state->sorting)->toHaveCount(1)
        ->and($state->sorting[0]->desc)->toBeFalse();
});

it('limits the filters to the configured number', function () {
    config(['inertia-datatable.max_filters' => 2]);

    $state = (new StateParser)->parse(
        ['filter' => ['name' => 'a', 'stock' => 'gt.1', 'status' => 'active']],
        ProductsTable::make()->toDefinition(),
    );

    expect(array_map(fn ($filter) => $filter->id, $state->filters))->toBe(['name', 'stock']);
});

it('cuts the search to the configured length', function () {
    config(['inertia-datatable.max_search_length' => 5]);

    $state = (new StateParser)->parse(['search' => '  abcdefgh  '], ProductsTable::make()->toDefinition());

    expect($state->search)->toBe('abcde');
});

it('ignores the search when no column is searchable', function () {
    $definition = DataTable::for(Product::query())->columns([Column::make('name')])->toDefinition();

    $state = (new StateParser)->parse(['search' => 'lámpara'], $definition);

    expect($state->search)->toBe('');
});

it('falls back to the first page for an invalid page', function (string $page) {
    $state = (new StateParser)->parse(['page' => $page], ProductsTable::make()->toDefinition());

    expect($state->page)->toBe(1);
})->with([
    'zero' => ['0'],
    'negative' => ['-3'],
    'text' => ['abc'],
    'decimal' => ['2.5'],
]);

it('uses the default visibility when the columns parameter is blank', function () {
    $state = (new StateParser)->parse(['columns' => ' '], ProductsTable::make()->toDefinition());

    expect($state->visibleColumns)->toBe(['name', 'price', 'stock', 'status', 'category', 'featured']);
});
