<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\Tests\Fixtures\Models\Category;
use InertiaDataTable\Tests\Fixtures\Models\Member;
use InertiaDataTable\Tests\Fixtures\Models\Note;
use InertiaDataTable\Tests\Fixtures\Models\Product;
use InertiaDataTable\Tests\Fixtures\Models\Team;

/**
 * @param  list<Column>  $columns
 * @return array<string, mixed>
 */
function resolveProducts(array $columns, string $query): array
{
    return DataTable::for(Product::query())
        ->columns($columns)
        ->withRequest(Request::create('/?'.$query))
        ->toArray();
}

beforeEach(function () {
    Product::factory()->create(['name' => 'Lámpara', 'price' => 30, 'stock' => 2, 'released_on' => '2026-01-10']);
    Product::factory()->create(['name' => 'Mesa', 'price' => 120, 'stock' => 0, 'released_on' => '2026-02-01']);
});

// Postgres takes the type of a value from the column and fails where SQLite and MySQL convert.
it('compares a number filter with any number, also one the column cannot hold', function (string $query, int $rows) {
    $result = resolveProducts([
        Column::number('stock')->filterInput(),
        Column::number('price')->filterRange(),
    ], $query);

    expect($result['data'])->toHaveCount($rows);
})->with([
    'a decimal on an integer column' => ['filter[stock]=1.5', 0],
    'a decimal comparison on an integer column' => ['filter[stock]=gt.1.5', 1],
    'over the range of an integer column' => ['filter[stock]=99999999999999', 0],
    'under an integer over the range' => ['filter[stock]=lt.99999999999999', 2],
    'a decimal range' => ['filter[price]=29.5,30.5', 1],
]);

it('ignores a number that is not finite', function (string $query) {
    $result = resolveProducts([
        Column::number('stock')->filterInput(),
        Column::number('price')->filterRange(),
    ], $query);

    expect($result['data'])->toHaveCount(2)
        ->and($result['state']['columnFilters'])->toBe([]);
})->with(['filter[stock]=1e999', 'filter[price]=1e999,', 'filter[price]=0,-1e999']);

it('ignores a date no database accepts', function () {
    $result = resolveProducts([Column::date('released_on')->filterDate()], 'filter[released_on]=0000-01-01');

    expect($result['data'])->toHaveCount(2)
        ->and($result['state']['columnFilters'])->toBe([]);
});

it('ignores an option that is not valid text when the options are not declared', function () {
    $result = resolveProducts([Column::option('status')->filterSelect()], 'filter[status]=%FF');

    expect($result['data'])->toHaveCount(2)
        ->and($result['state']['columnFilters'])->toBe([])
        ->and(json_encode($result))->toBeString();
});

it('filters a number column as an option without declared options', function (string $query, int $rows) {
    $result = resolveProducts([Column::option('stock')->filterSelect()], $query);

    expect($result['data'])->toHaveCount($rows);
})->with([
    ['filter[stock]=2', 1],
    ['filter[stock]=0,2', 2],
    ['filter[stock]=abc', 0],
    ['filter[stock]=neq.abc', 2],
]);

it('finds a text with accented capitals by its exact value', function () {
    Product::factory()->create(['name' => 'Ángel']);

    $equal = resolveProducts([Column::text('name')->filterInput()], 'filter[name]=eq.Ángel');
    $different = resolveProducts([Column::text('name')->filterInput()], 'filter[name]=neq.Ángel');

    expect(array_column($equal['data'], 'name'))->toBe(['Ángel'])
        ->and(array_column($different['data'], 'name'))->not->toContain('Ángel');
});

it('sorts, filters and searches on a through relation whose tables share a column name', function (string $query, array $titles) {
    $mine = Team::create(['name' => 'Mine']);
    $theirs = Team::create(['name' => 'Theirs']);
    $ana = Member::create(['team_id' => $mine->id, 'name' => 'Ana', 'password' => 'x']);
    $leo = Member::create(['team_id' => $theirs->id, 'name' => 'Leo', 'password' => 'x']);
    Note::create(['member_id' => $leo->id, 'title' => 'Second']);
    Note::create(['member_id' => $ana->id, 'title' => 'First']);

    $result = DataTable::for(Note::query())
        ->columns([
            Column::text('title'),
            Column::text('team')->from('team.name')->sortable()->searchable()->filterInput(),
        ])
        ->withRequest(Request::create('/?'.$query))
        ->toArray();

    expect(array_column($result['data'], 'title'))->toBe($titles)
        ->and(array_column($result['data'], 'team'))->each->toBeIn(['Mine', 'Theirs']);
})->with([
    'sort' => ['sort=team', ['First', 'Second']],
    'filter' => ['filter[team]=Mine', ['First']],
    'negated filter' => ['filter[team]=not.ilike.Mine', ['Second']],
    'search' => ['search=Theirs', ['Second']],
]);

it('sorts the rows without a value first ascending and last descending on every database', function () {
    Product::query()->delete();
    Product::factory()->create(['name' => 'B', 'sku' => 'B-1']);
    Product::factory()->withoutSku()->create(['name' => 'None']);
    Product::factory()->create(['name' => 'A', 'sku' => 'A-1']);

    $names = fn (string $sort): array => array_column(
        resolveProducts([Column::text('name'), Column::text('sku')->sortable()], 'sort='.$sort)['data'],
        'name',
    );

    expect($names('sku'))->toBe(['None', 'A', 'B'])
        ->and($names('-sku'))->toBe(['B', 'A', 'None']);
});

it('sorts the rows without a related value first ascending and last descending', function () {
    Product::query()->delete();
    $category = Category::factory()->create(['name' => 'Home']);
    Product::factory()->for($category)->create(['name' => 'With']);
    Product::factory()->create(['name' => 'Without', 'category_id' => null]);

    $names = fn (string $sort): array => array_column(
        resolveProducts([Column::text('name'), Column::text('category')->from('category.name')->sortable()], 'sort='.$sort)['data'],
        'name',
    );

    expect($names('category'))->toBe(['Without', 'With'])
        ->and($names('-category'))->toBe(['With', 'Without']);
});

it('keeps the primary key of a transformed row whose id column is hidden', function () {
    $result = DataTable::for(Product::query())
        ->columns([Column::number('id')->hidden(), Column::text('name')])
        ->transform(fn (Product $product): array => ['id' => $product->id, 'name' => $product->name])
        ->withRequest(Request::create('/'))
        ->toArray();

    expect($result['data'][0])->toHaveKeys(['id', 'name']);
});
