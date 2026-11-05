<?php

declare(strict_types=1);

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Http\Request;
use InertiaDataTable\Column;
use InertiaDataTable\DataTable;
use InertiaDataTable\TableBuilder;
use InertiaDataTable\Tests\Fixtures\Models\Category;
use InertiaDataTable\Tests\Fixtures\Models\Product;

class ProductWithLabel extends Product
{
    protected $table = 'products';

    protected function label(): Attribute
    {
        return Attribute::get(fn (): string => "{$this->name}!");
    }
}

class ProductWithAppendedLabel extends ProductWithLabel
{
    protected $appends = ['label'];
}

/**
 * @return array<string, mixed>
 */
function resolveTable(TableBuilder $table, string $query = ''): array
{
    return $table->withRequest(Request::create('/?'.$query))->toArray();
}

function productsTable(Column ...$columns): TableBuilder
{
    return DataTable::for(Product::query())->columns([Column::text('name', 'Name'), ...$columns]);
}

it('fails on the first load when a sortable column does not exist', function () {
    resolveTable(productsTable(Column::text('weight', 'Weight')->sortable()));
})->throws(LogicException::class, 'The column [weight] is sortable, but [products.weight] does not exist in the database.');

it('names every SQL usage of a missing column', function () {
    resolveTable(productsTable(Column::text('nickname', 'Nickname')->searchable()->filterInput()));
})->throws(LogicException::class, 'The column [nickname] is searchable, filterable, but [products.nickname] does not exist');

it('fails when the default sort uses a missing column', function () {
    resolveTable(productsTable()->defaultSort('-published_at'));
})->throws(LogicException::class, 'The default sort uses [published_at], but [products.published_at] does not exist');

it('checks sortable relation columns against the related table', function () {
    resolveTable(productsTable(Column::text('category', 'Category')->from('category.nme')->sortable()));
})->throws(LogicException::class, 'The column [category] is sortable, but [categories.nme] does not exist');

it('fails when a displayed column has no value in the model', function () {
    Product::factory()->create();

    resolveTable(productsTable(Column::text('nickname', 'Nickname')));
})->throws(LogicException::class, 'The column [nickname] has no value to display: [nickname] is not a column of [products]');

it('fails when a displayed relation column has no value in the related model', function () {
    Product::factory()->for(Category::factory())->create();

    resolveTable(productsTable(Column::text('category', 'Category')->from('category.nme')));
})->throws(LogicException::class, 'The column [category] has no value to display: [nme] is not a column of [categories]');

it('explains that a displayed column is hidden', function () {
    Product::factory()->create();

    resolveTable(productsTable(Column::date('created_at', 'Created')));
})->throws(LogicException::class, '[created_at] is in the $hidden attributes of '.Product::class);

it('explains that a displayed accessor is not appended', function () {
    Product::factory()->create();

    resolveTable(DataTable::for(ProductWithLabel::query())->columns([Column::text('label', 'Label')]));
})->throws(LogicException::class, '[label] is an accessor of '.ProductWithLabel::class.' that is not in $appends');

it('accepts appended accessors, query aliases, transform() and missing relations', function () {
    Product::factory()->create(['name' => 'Lamp']);
    Category::factory()->create(['name' => 'Home']);

    expect(resolveTable(DataTable::for(ProductWithAppendedLabel::query())->columns([Column::text('label', 'Label')]))['data'][0]['label'])->toBe('Lamp!')
        ->and(resolveTable(DataTable::for(Category::query()->withCount('products'))->columns([Column::number('products_count', 'Products')]))['data'][0]['products_count'])->toBe(0)
        ->and(resolveTable(productsTable(Column::text('nickname', 'Nickname'))->transform(fn (Product $product): array => ['nickname' => 'x']))['data'][0]['nickname'])->toBe('x')
        ->and(resolveTable(productsTable(Column::text('category', 'Category')->from('category.nme')))['data'][0]['category'])->toBeNull();
});

it('does not check the displayed columns of an empty table', function () {
    expect(resolveTable(productsTable(Column::text('nickname', 'Nickname')))['data'])->toBe([]);
});

it('does not validate when it is disabled', function () {
    config()->set('inertia-datatable.validate_columns', false);
    Product::factory()->create();

    expect(resolveTable(productsTable(Column::text('weight', 'Weight')->sortable()))['data'][0]['weight'])->toBeNull();
});

it('follows the debug mode by default', function (bool $debug) {
    config()->set('inertia-datatable.validate_columns', null);
    config()->set('app.debug', $debug);
    Product::factory()->create();

    $resolve = fn (): array => resolveTable(productsTable(Column::text('nickname', 'Nickname')));

    $debug
        ? expect($resolve)->toThrow(LogicException::class, 'has no value to display')
        : expect($resolve()['data'][0]['nickname'])->toBeNull();
})->with(['debug on' => true, 'debug off' => false]);
