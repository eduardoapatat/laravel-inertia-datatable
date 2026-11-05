<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use InertiaDataTable\Tests\Fixtures\Models\Category;
use InertiaDataTable\Tests\Fixtures\Models\Product;
use InertiaDataTable\Tests\Fixtures\Tables\ProductsWithUrlTable;

use function Pest\Laravel\assertDatabaseCount;
use function Pest\Laravel\getJson;

/**
 * Catálogo pequeño con un valor distinto en cada columna filtrable.
 */
function seedCatalog(): void
{
    $home = Category::factory()->create(['name' => 'Hogar']);
    $office = Category::factory()->create(['name' => 'Oficina']);

    Product::factory()->featured()->for($home)->create(['name' => 'Lámpara', 'price' => 30, 'stock' => 2, 'released_on' => '2026-01-10']);
    Product::factory()->draft()->withoutSku()->for($home)->create(['name' => 'Mesa', 'price' => 120, 'stock' => 0, 'released_on' => '2026-02-01']);
    Product::factory()->for($office)->create(['name' => 'Silla', 'price' => 45, 'stock' => 10, 'released_on' => '2026-01-20']);
    Product::factory()->archived()->create(['name' => 'Teclado', 'price' => 60, 'stock' => 4, 'released_on' => '2026-03-05']);
}

it('returns the first page and its pagination meta when no parameters are given', function () {
    Product::factory()->count(12)->create();

    $response = getJson('/products');

    $response->assertOk()
        ->assertJsonCount(10, 'data')
        ->assertJsonPath('meta', ['current_page' => 1, 'per_page' => 10, 'last_page' => 2, 'total' => 12, 'from' => 1, 'to' => 10]);
});

it('clamps a page beyond the last one to the last page', function () {
    Product::factory()->count(12)->create();

    $response = getJson('/products?page=99');

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.current_page', 2)
        ->assertJsonPath('state.pagination', ['pageIndex' => 1, 'pageSize' => 10]);
});

it('uses the requested page size only when it is an allowed option', function (string $perPage, int $expected) {
    Product::factory()->count(25)->create();

    $response = getJson("/products?per_page={$perPage}");

    $response->assertOk()->assertJsonPath('meta.per_page', $expected);
})->with([
    'allowed option' => ['20', 20],
    'value outside the options' => ['1000', 10],
    'non numeric value' => ['all', 10],
]);

it('returns null from and to when no row matches', function () {
    $response = getJson('/products');

    $response->assertOk()
        ->assertJsonPath('meta', ['current_page' => 1, 'per_page' => 10, 'last_page' => 1, 'total' => 0, 'from' => null, 'to' => null]);
});

it('sorts by several columns in the requested priority', function () {
    Product::factory()->create(['name' => 'Bandeja', 'price' => 20]);
    Product::factory()->create(['name' => 'Atril', 'price' => 20]);
    Product::factory()->create(['name' => 'Cojín', 'price' => 90]);

    $response = getJson('/products?sort=-price,name');

    $response->assertOk()->assertJsonPath('data.*.name', ['Cojín', 'Atril', 'Bandeja']);
});

it('reports only the requested sort columns that are sortable', function () {
    Product::factory()->count(2)->create();

    $response = getJson('/products?sort=status,-price');

    $response->assertOk()->assertJsonPath('state.sorting', [['id' => 'price', 'desc' => true]]);
});

it('applies the default sort without reporting it as requested', function () {
    Product::factory()->create(['name' => 'Zócalo']);
    Product::factory()->create(['name' => 'Alfombra']);

    $response = getJson('/products');

    $response->assertOk()
        ->assertJsonPath('data.*.name', ['Alfombra', 'Zócalo'])
        ->assertJsonPath('state.sorting', [])
        ->assertJsonPath('config.default_sorting', [['id' => 'name', 'desc' => false]]);
});

it('adds the primary key as the last sort column so pages are stable', function () {
    Product::factory()->count(2)->create(['price' => 50]);
    DB::enableQueryLog();

    getJson('/products?sort=price')->assertOk();

    $rowsQuery = collect(DB::getQueryLog())->pluck('query')->first(fn (string $sql) => str_contains($sql, 'limit'));
    expect($rowsQuery)->toEndWith(orderByPriceAndId('asc'));
});

it('breaks ties with the primary key in the direction of the first sort column', function () {
    $first = Product::factory()->create(['price' => 50]);
    $second = Product::factory()->create(['price' => 50]);
    DB::enableQueryLog();

    $response = getJson('/products?sort=-price')->assertOk();

    $rowsQuery = collect(DB::getQueryLog())->pluck('query')->first(fn (string $sql) => str_contains($sql, 'limit'));
    expect($rowsQuery)->toEndWith(orderByPriceAndId('desc'))
        ->and(array_column($response->json('data'), 'id'))->toBe([$second->id, $first->id]);
});

it('sorts by the value of a belongs-to relation', function () {
    seedCatalog();

    $response = getJson('/products?sort=-category');

    // Lámpara y Mesa empatan en Hogar: el desempate por id sigue la dirección del orden.
    $response->assertOk()->assertJsonPath('data.*.name', ['Silla', 'Mesa', 'Lámpara', 'Teclado']);
});

it('filters rows with each variant and operator', function (string $query, array $expected) {
    seedCatalog();

    $response = getJson("/products?{$query}");

    $response->assertOk()->assertJsonPath('data.*.name', $expected);
})->with([
    'number greater than' => ['filter[stock]=gt.3', ['Silla', 'Teclado']],
    'number less than or equal' => ['filter[stock]=lte.2', ['Lámpara', 'Mesa']],
    'number not equal' => ['filter[stock]=neq.0', ['Lámpara', 'Silla', 'Teclado']],
    'range with both bounds' => ['filter[price]=40,100', ['Silla', 'Teclado']],
    'range with an open upper bound' => ['filter[price]=100,', ['Mesa']],
    'two filters on one column' => ['filter[price][]=gte.40&filter[price][]=lte.50', ['Silla']],
    'text contains ignoring case' => ['filter[name]=SIL', ['Silla']],
    'text does not contain' => ['filter[name]=not.ilike.e', ['Lámpara', 'Silla']],
    'text equals ignoring case' => ['filter[name]=eq.mesa', ['Mesa']],
    'text negation includes rows without value' => ['filter[sku]=not.ilike.SKU', ['Mesa']],
    'text is empty' => ['filter[sku]=is.empty', ['Mesa']],
    'text is not empty' => ['filter[sku]=not.is.empty', ['Lámpara', 'Silla', 'Teclado']],
    'boolean true' => ['filter[featured]=true', ['Lámpara']],
    'boolean false' => ['filter[featured]=false', ['Mesa', 'Silla', 'Teclado']],
    'date before' => ['filter[released_on]=lt.2026-01-20', ['Lámpara']],
    'date equals the whole day' => ['filter[released_on]=2026-02-01', ['Mesa']],
    'date between inclusive' => ['filter[released_on]=between.2026-01-10,2026-01-20', ['Lámpara', 'Silla']],
    'multi-select any of' => ['filter[status]=active,draft', ['Lámpara', 'Mesa', 'Silla']],
    'multi-select none of' => ['filter[status]=not.in.active', ['Mesa', 'Teclado']],
    'relation value' => ['filter[category]=Hogar', ['Lámpara', 'Mesa']],
    'relation none of includes rows without relation' => ['filter[category]=not.in.Hogar', ['Silla', 'Teclado']],
    'relation is empty' => ['filter[category]=is.empty', ['Teclado']],
    'filters on several columns' => ['filter[status]=active&filter[category]=Oficina', ['Silla']],
    'value that does not fit the variant' => ['filter[stock]=abc', ['Lámpara', 'Mesa', 'Silla', 'Teclado']],
    'unknown column' => ['filter[unknown]=x', ['Lámpara', 'Mesa', 'Silla', 'Teclado']],
]);

it('requires every search word to match a searchable column, including relations', function () {
    seedCatalog();

    $response = getJson('/products?search=sil%20ofi');

    $response->assertOk()
        ->assertJsonPath('data.*.name', ['Silla'])
        ->assertJsonPath('state.globalFilter', 'sil ofi');
});

it('matches LIKE wildcards in the search literally', function () {
    Product::factory()->create(['name' => 'Cupón 50% off']);
    Product::factory()->create(['name' => 'Bolsa 500 g']);
    Product::factory()->create(['name' => 'Caja a_b']);
    Product::factory()->create(['name' => 'Caja axb']);

    $percent = getJson('/products?search='.rawurlencode('50%'));
    $underscore = getJson('/products?search='.rawurlencode('a_b'));

    $percent->assertOk()->assertJsonPath('data.*.name', ['Cupón 50% off']);
    $underscore->assertOk()->assertJsonPath('data.*.name', ['Caja a_b']);
});

it('ignores injection attempts in sort columns and filter keys', function () {
    Product::factory()->count(2)->create();

    $response = getJson('/products?'.http_build_query([
        'sort' => 'name; DROP TABLE products',
        'filter' => ['name) OR 1=1 --' => 'x'],
    ]));

    $response->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('state.sorting', [])
        ->assertJsonPath('state.columnFilters', []);
    assertDatabaseCount('products', 2);
});

it('counts facet options with every filter except the facet own one', function () {
    seedCatalog();

    $response = getJson('/products?filter[status]=active&filter[category]=Hogar');

    $response->assertOk()
        ->assertJsonPath('facets.status', [
            ['value' => 'active', 'label' => 'Activo', 'count' => 1],
            ['value' => 'draft', 'label' => 'Borrador', 'count' => 1],
            ['value' => 'archived', 'label' => 'Archivado', 'count' => 0],
        ])
        ->assertJsonPath('facets.category', [
            ['value' => 'Hogar', 'label' => 'Hogar', 'count' => 1],
            ['value' => 'Oficina', 'label' => 'Oficina', 'count' => 1],
        ]);
});

it('keeps a selected option that no longer has rows with a zero count', function () {
    seedCatalog();

    $response = getJson('/products?filter[category]=Jardín');

    $response->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('facets.category.2', ['value' => 'Jardín', 'label' => 'Jardín', 'count' => 0]);
});

it('returns the bounds of range columns from the unfiltered query', function () {
    seedCatalog();

    $response = getJson('/products?filter[status]=draft');

    $response->assertOk()->assertJsonPath('facets.price', ['min' => 30, 'max' => 120]);
});

it('includes only visible columns, the primary key and non hideable columns in each row', function () {
    seedCatalog();

    $response = getJson('/products?columns=price,category&per_page=10');

    $response->assertOk()
        ->assertJsonPath('data.0', ['id' => 1, 'name' => 'Lámpara', 'price' => 30, 'category' => 'Hogar'])
        ->assertJsonPath('state.columnVisibility', [
            'name' => true, 'sku' => false, 'price' => true, 'stock' => false,
            'status' => false, 'category' => true, 'featured' => false, 'released_on' => false,
        ]);
});

it('shows the default visible columns when no columns are requested', function () {
    seedCatalog();

    $response = getJson('/products');

    $response->assertOk()->assertJsonPath('data.0', [
        'id' => 1, 'name' => 'Lámpara', 'price' => 30, 'stock' => 2,
        'status' => 'active', 'category' => 'Hogar', 'featured' => true,
    ]);
});

it('echoes the applied filters in the ColumnFilterItem shape', function () {
    seedCatalog();

    $response = getJson('/products?filter[status]=active&filter[price][]=gte.10&filter[price][]=lte.50');

    $response->assertOk()->assertJsonPath('state.columnFilters', [
        ['id' => 'status', 'filterId' => 'status-0', 'variant' => 'multi-select', 'operator' => 'inArray', 'value' => ['active']],
        ['id' => 'price', 'filterId' => 'price-0', 'variant' => 'range', 'operator' => 'gte', 'value' => '10'],
        ['id' => 'price', 'filterId' => 'price-1', 'variant' => 'range', 'operator' => 'lte', 'value' => '50'],
    ]);
});

it('describes columns, options and query parameters in config', function () {
    $response = getJson('/products');

    $response->assertOk()
        ->assertJsonPath('config.columns.0', [
            'id' => 'name', 'label' => 'Nombre', 'sortable' => true, 'variant' => 'text',
            'placeholder' => 'Buscar nombre…', 'unit' => null, 'hideable' => false, 'visible' => true,
        ])
        ->assertJsonPath('config.searchable', true)
        ->assertJsonPath('config.per_page', 10)
        ->assertJsonPath('config.per_page_options', [10, 20, 30, 50])
        ->assertJsonPath('config.query', [
            'page' => 'page', 'per_page' => 'per_page', 'sort' => 'sort',
            'filter' => 'filter', 'search' => 'search', 'columns' => 'columns',
        ]);
});

it('limits the rows to the parent model passed to make', function () {
    $home = Category::factory()->create();
    Product::factory()->for($home)->create(['name' => 'Lámpara']);
    Product::factory()->for(Category::factory())->create(['name' => 'Silla']);

    $response = getJson("/categories/{$home->id}/products");

    $response->assertOk()->assertJsonPath('data.*.name', ['Lámpara']);
});

it('shapes each row with the transform method and removes hidden column keys', function () {
    Route::get('/products-with-url', fn () => ProductsWithUrlTable::make());
    $product = Product::factory()->create(['name' => 'Lámpara']);

    $response = getJson('/products-with-url');

    $response->assertOk()->assertJsonPath('data.0', ['id' => $product->id, 'name' => 'Lámpara', 'url' => "/products/{$product->id}"]);
});

/**
 * Final de la consulta de filas con las comillas de la conexión actual (SQLite, MySQL o Postgres).
 */
function orderByPriceAndId(string $direction): string
{
    $grammar = DB::connection()->getQueryGrammar();

    return "order by {$grammar->wrap('products.price')} {$direction}, {$grammar->wrap('products.id')} {$direction} limit 10 offset 0";
}
